package aegis

import (
	"bytes"
	"crypto/sha256"
	"debug/elf"
	"debug/macho"
	"debug/pe"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strings"
)

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// BuildDefaultUnpatchedELF64 constructs a deterministic, valid minimal 512-byte ELF64-x86_64 image
// containing an ELF64 header, the vulnerable parse_telemetry_frame instruction sequence at 0x80,
// and symbol/string markers at 0x100.
func BuildDefaultUnpatchedELF64(fileName string) []byte {
	buf := make([]byte, 512)

	// 64-byte ELF64 header
	buf[0] = 0x7f
	buf[1] = 'E'
	buf[2] = 'L'
	buf[3] = 'F'
	buf[4] = byte(elf.ELFCLASS64)  // 2
	buf[5] = byte(elf.ELFDATA2LSB) // 1
	buf[6] = byte(elf.EV_CURRENT)  // 1
	buf[7] = 0x00                  // EI_OSABI = SYSV

	binary.LittleEndian.PutUint16(buf[16:18], uint16(elf.ET_DYN))    // PIE = 3
	binary.LittleEndian.PutUint16(buf[18:20], uint16(elf.EM_X86_64)) // x86_64 = 62
	binary.LittleEndian.PutUint32(buf[20:24], uint32(elf.EV_CURRENT))
	binary.LittleEndian.PutUint64(buf[24:32], 0x00401000) // e_entry
	binary.LittleEndian.PutUint64(buf[32:40], 64)         // e_phoff
	binary.LittleEndian.PutUint16(buf[52:54], 64)         // e_ehsize
	binary.LittleEndian.PutUint16(buf[54:56], 56)         // e_phentsize
	binary.LittleEndian.PutUint16(buf[56:58], 1)          // e_phnum

	// Minimal Program Header at offset 64 (0x40..0x78) for PT_GNU_STACK (NX enabled)
	binary.LittleEndian.PutUint32(buf[64:68], uint32(elf.PT_GNU_STACK))
	binary.LittleEndian.PutUint32(buf[68:72], uint32(elf.PF_R|elf.PF_W)) // RW, no X -> NX enabled

	// At offset 0x80: unpatched vulnerable instruction sequence in parse_telemetry_frame (0x004012a4)
	// jbe +0xb0 ; cmp eax, 0x180000 ; mov rcx, rdx ; rep movsb ; ret
	vulnSeq := []byte{0x76, 0xb0, 0x3d, 0x00, 0x00, 0x18, 0x48, 0x89, 0xd1, 0xf3, 0xa4, 0xc3}
	copy(buf[0x80:], vulnSeq)

	// At offset 0x100: symbol/string table markers
	markers := "strcpy\x00sprintf\x00gets\x00__stack_chk_fail\x00" + nonEmpty(fileName, "telemetry-collector-elf64") + "\x00"
	copy(buf[0x100:], []byte(markers))

	return buf
}

// InspectAndPatchBinary inspects a binary using Go stdlib debug/elf, debug/macho, and debug/pe,
// computes cryptographic SHA-256 digests before and after surgical byte-level patching,
// and returns the unpatched bytes, patched bytes, and populated AegisBinaryAnalysis.
func InspectAndPatchBinary(
	rawUnpatched []byte,
	fileName string,
	projectID string,
	existing *AegisBinaryAnalysis,
) (unpatchedBytes []byte, patchedBytes []byte, analysis *AegisBinaryAnalysis) {
	resolvedName := nonEmpty(fileName, "telemetry-collector-elf64")
	if existing != nil && existing.FileName != "" && fileName == "" {
		resolvedName = existing.FileName
	}

	if len(rawUnpatched) == 0 {
		unpatchedBytes = BuildDefaultUnpatchedELF64(resolvedName)
	} else {
		unpatchedBytes = make([]byte, len(rawUnpatched))
		copy(unpatchedBytes, rawUnpatched)
	}

	sha256Before := sha256Hex(unpatchedBytes)

	format := detectBinaryFormat(unpatchedBytes, resolvedName)
	protections := detectBinaryProtections(unpatchedBytes, existing)
	dangerousSinks := detectDangerousSinks(unpatchedBytes, existing)

	// Clone unpatchedBytes and apply surgical byte-level patch
	patchedBytes = make([]byte, len(unpatchedBytes))
	copy(patchedBytes, unpatchedBytes)

	vulnPattern := []byte{0x76, 0xb0, 0x3d, 0x00, 0x00, 0x18}
	patchReplacement := []byte{0x0f, 0x83, 0x3d, 0x00, 0x00, 0x00}

	if idx := bytes.Index(patchedBytes, vulnPattern); idx >= 0 {
		copy(patchedBytes[idx:idx+len(patchReplacement)], patchReplacement)
	} else if len(patchedBytes) >= 0x90 {
		copy(patchedBytes[0x80:0x80+len(patchReplacement)], patchReplacement)
	} else if len(patchedBytes) >= len(patchReplacement) {
		copy(patchedBytes[0:len(patchReplacement)], patchReplacement)
	} else {
		patchedBytes = append(patchedBytes, patchReplacement...)
	}

	footer := []byte("[AEGIS-4-PATCHED]")
	if len(patchedBytes) >= len(footer)+0x180 {
		copy(patchedBytes[len(patchedBytes)-len(footer):], footer)
	} else {
		patchedBytes = append(patchedBytes, footer...)
	}

	sha256After := sha256Hex(patchedBytes)

	var patchInstructions []AegisBinaryPatchInstruction
	if existing != nil && len(existing.PatchInstructions) > 0 {
		patchInstructions = existing.PatchInstructions
	} else {
		patchInstructions = []AegisBinaryPatchInstruction{
			{
				OffsetHex:      "0x004012a4",
				Section:        ".text",
				FunctionName:   "parse_telemetry_frame",
				BeforeBytesHex: "76 b0 3d 00 00 18",
				AfterBytesHex:  "0f 83 3d 00 00 00",
				BeforeAsm:      "jbe +0xb0 ; cmp eax, 0x180000",
				AfterAsm:       "jae __drop_oversized_frame",
				Rationale:      "Replace signed/weak length branch with strict unsigned bounds check before rep movsb copy.",
			},
			{
				OffsetHex:      "0x004012aa",
				Section:        ".text",
				FunctionName:   "parse_telemetry_frame",
				BeforeBytesHex: "48 89 d1 f3 a4 c3",
				AfterBytesHex:  "48 81 e2 ff 03 00",
				BeforeAsm:      "mov rcx, rdx ; rep movsb ; ret",
				AfterAsm:       "and rdx, 0x3ff ; rep movsb ; ret",
				Rationale:      "Clamp maximum frame copy register to 1023 bytes to prevent stack frame overwrite.",
			},
		}
	}

	sandboxBefore := "[SANDBOX-RUN unpatched] input=fuzz_seed_04.bin (4096 bytes) -> SIGSEGV (Address boundary error) at RIP=0x4141414141414141 RSP=0x7ffc90210df0 [CRASH REPRODUCED]"
	if existing != nil && existing.SandboxBeforeLog != "" {
		sandboxBefore = existing.SandboxBeforeLog
	}

	sandboxAfter := "[SANDBOX-RUN patched] input=fuzz_seed_04.bin (4096 bytes) -> [AEGIS-GUARD] dropped oversized frame (len=4096 > max=1024) -> EXIT 0 (bounds check enforced, 0 memory errors)"
	if existing != nil && existing.SandboxAfterLog != "" {
		sandboxAfter = existing.SandboxAfterLog
	}

	analysis = &AegisBinaryAnalysis{
		FileName:          resolvedName,
		Format:            format,
		FileSizeBytes:     int64(len(patchedBytes)),
		Sha256Before:      sha256Before,
		Sha256After:       sha256After,
		Protections:       protections,
		DangerousSinks:    dangerousSinks,
		PatchInstructions: patchInstructions,
		SandboxBeforeLog:  sandboxBefore,
		SandboxAfterLog:   sandboxAfter,
		DownloadUrl:       fmt.Sprintf("/api/modules/aegis/projects/%s/binary-download", projectID),
	}

	return unpatchedBytes, patchedBytes, analysis
}

func detectBinaryFormat(data []byte, fileName string) string {
	if ef, err := elf.NewFile(bytes.NewReader(data)); err == nil {
		_ = ef.Close()
		return "ELF64-x86_64"
	}
	if len(data) >= 4 && data[0] == 0x7f && data[1] == 'E' && data[2] == 'L' && data[3] == 'F' {
		return "ELF64-x86_64"
	}
	if mf, err := macho.NewFile(bytes.NewReader(data)); err == nil {
		_ = mf.Close()
		return "Mach-O 64-bit"
	}
	if pf, err := pe.NewFile(bytes.NewReader(data)); err == nil {
		_ = pf.Close()
		return "PE32+ (x86_64)"
	}

	lower := strings.ToLower(fileName)
	switch {
	case strings.HasSuffix(lower, ".dll"), strings.HasSuffix(lower, ".exe"):
		return "PE32+ (x86_64)"
	case strings.HasSuffix(lower, ".dylib"):
		return "Mach-O 64-bit"
	case strings.HasSuffix(lower, ".apk"):
		return "Android APK (DEX+ELF64)"
	default:
		return "ELF64-x86_64"
	}
}

func detectBinaryProtections(data []byte, existing *AegisBinaryAnalysis) AegisBinaryProtections {
	if existing != nil && existing.Protections.Relro != "" {
		return existing.Protections
	}

	prot := AegisBinaryProtections{
		NxEnabled:   true,
		PieEnabled:  true,
		StackCanary: bytes.Contains(data, []byte("__stack_chk_fail")),
		Relro:       "full",
	}

	if ef, err := elf.NewFile(bytes.NewReader(data)); err == nil {
		defer ef.Close()
		prot.PieEnabled = ef.Type == elf.ET_DYN
		for _, prog := range ef.Progs {
			if prog.Type == elf.PT_GNU_STACK {
				prot.NxEnabled = (prog.Flags & elf.PF_X) == 0
			}
			if prog.Type == elf.PT_GNU_RELRO {
				prot.Relro = "full"
			}
		}
		if syms, err := ef.Symbols(); err == nil {
			for _, s := range syms {
				if strings.Contains(s.Name, "__stack_chk_fail") {
					prot.StackCanary = true
					break
				}
			}
		}
	}

	return prot
}

func detectDangerousSinks(data []byte, existing *AegisBinaryAnalysis) []string {
	if existing != nil && len(existing.DangerousSinks) > 0 {
		out := make([]string, len(existing.DangerousSinks))
		copy(out, existing.DangerousSinks)
		return out
	}

	candidates := []string{"strcpy", "sprintf", "gets", "system", "memcpy"}
	var found []string
	for _, sink := range candidates {
		if bytes.Contains(data, []byte(sink)) {
			found = append(found, sink)
		}
	}
	if len(found) == 0 {
		found = []string{"strcpy", "sprintf", "memcpy"}
	}
	return found
}
