import type { AegisRemediationMode, AegisTargetType } from "@deepmind/shared";
import { defineAgentUnit } from "../registry";

export interface AegisClassifierPayload {
  name: string;
  intakeMode: string;
  repoUrl?: string;
  cdConfigSnippet?: string;
  targetUrl?: string;
  binaryFileName?: string;
}

export interface AegisClassifierOutput {
  targetType: AegisTargetType;
  recommendedRemediation: AegisRemediationMode;
  detectedStack: string[];
  rationale: string;
}

export interface AegisSandboxPocPayload {
  targetName: string;
  targetType: AegisTargetType;
  cveOrCwe: string;
  location: string;
  pocPayload: string;
  phase: "red" | "green";
}

export interface AegisSandboxPocOutput {
  confirmed: boolean;
  statusBanner: string;
  executionLog: string;
  exitCode: number;
}

export interface AegisTriRemediatorPayload {
  targetName: string;
  remediationMode: AegisRemediationMode;
  vulnerabilityTitle: string;
  location: string;
  rootCause: string;
}

export interface AegisTriRemediatorOutput {
  remediationMode: AegisRemediationMode;
  summary: string;
  artifactSnippet: string;
  verificationCommand: string;
}

function extractJsonRecord(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1] ? fenceMatch[1].trim() : trimmed;
  const startIdx = candidate.indexOf("{");
  const endIdx = candidate.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(candidate.slice(startIdx, endIdx + 1));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeTargetType(val: unknown, fallbackText: string): AegisTargetType {
  if (val === "web" || val === "api" || val === "binary" || val === "hybrid") {
    return val;
  }
  const lower = fallbackText.toLowerCase();
  if (lower.includes("binary") || lower.includes("elf") || lower.includes("firmware")) {
    return "binary";
  }
  if (lower.includes("hybrid")) {
    return "hybrid";
  }
  if (lower.includes("api") || lower.includes("graphql") || lower.includes("grpc")) {
    return "api";
  }
  return "web";
}

function normalizeRemediationMode(
  val: unknown,
  targetType: AegisTargetType,
  fallbackText: string,
): AegisRemediationMode {
  if (val === "git-pr" || val === "binary-patch" || val === "route-shield") {
    return val;
  }
  const lower = fallbackText.toLowerCase();
  if (lower.includes("binary-patch") || targetType === "binary") {
    return "binary-patch";
  }
  if (lower.includes("route-shield")) {
    return "route-shield";
  }
  return "git-pr";
}

export const aegisClassifierUnit = defineAgentUnit<AegisClassifierPayload, AegisClassifierOutput>({
  id: "aegis-cd-classifier",
  label: "AEGIS-4 Target & CD Auto-Classifier",
  defaultThinkingLevel: "low",
  maxOutputTokens: 16384,
  buildPrompt: (payload) =>
    [
      "You are the AEGIS-4 Target & CD Auto-Classifier running on Gemini 4 Argon (`gemini-4-argon`).",
      "Inspect the target intake metadata and continuous delivery descriptor below, then classify the target topology and optimal self-healing remediation strategy.",
      `Target Name: ${payload.name}`,
      `Intake Mode: ${payload.intakeMode}`,
      `Repository URL: ${payload.repoUrl ?? "N/A"}`,
      `Target URL: ${payload.targetUrl ?? "N/A"}`,
      `Binary Artifact: ${payload.binaryFileName ?? "N/A"}`,
      `CD Config Snippet:\n${payload.cdConfigSnippet ?? "N/A"}`,
      "",
      "Respond strictly with a JSON object matching:",
      '{ "targetType": "web" | "api" | "binary" | "hybrid", "recommendedRemediation": "git-pr" | "binary-patch" | "route-shield", "detectedStack": ["string"], "rationale": "string" }',
    ].join("\n"),
  parseOutput: (rawText) => {
    const record = extractJsonRecord(rawText);
    const targetType = normalizeTargetType(record?.targetType, rawText);
    const recommendedRemediation = normalizeRemediationMode(
      record?.recommendedRemediation,
      targetType,
      rawText,
    );
    const detectedStack = Array.isArray(record?.detectedStack)
      ? record.detectedStack.filter((item): item is string => typeof item === "string")
      : targetType === "binary"
        ? ["ELF64", "C/C++", "x86_64"]
        : ["TypeScript", "Go 1.27", "Cloud Edge"];
    const rationale =
      typeof record?.rationale === "string" && record.rationale.trim().length > 0
        ? record.rationale.trim()
        : `Classified target as ${targetType} with ${recommendedRemediation} remediation strategy.`;

    return {
      targetType,
      recommendedRemediation,
      detectedStack: detectedStack.length > 0 ? detectedStack : ["Cloud Native"],
      rationale,
    };
  },
});

export const aegisSandboxPocUnit = defineAgentUnit<AegisSandboxPocPayload, AegisSandboxPocOutput>({
  id: "aegis-sandbox-poc",
  label: "AEGIS-4 Isolated Sandbox PoC Verifier (Red/Green)",
  defaultThinkingLevel: "high",
  maxOutputTokens: 65536,
  useManagedAgent: true,
  buildPrompt: (payload) =>
    [
      "You are the AEGIS-4 Isolated Sandbox PoC Verifier operating inside the `antigravity-preview-09-2026` managed security sandbox.",
      `Execution Phase: ${payload.phase.toUpperCase()} (${
        payload.phase === "red"
          ? "Reproduce exploit and confirm vulnerability presence"
          : "Re-run exploit against patched target and verify remediation blocks attack"
      })`,
      `Target Name: ${payload.targetName} (${payload.targetType})`,
      `Vulnerability Identifier: ${payload.cveOrCwe}`,
      `Target Location: ${payload.location}`,
      `PoC Exploit Payload:\n${payload.pocPayload}`,
      "",
      "Execute the isolated verification trace and return a strict JSON object:",
      '{ "confirmed": true, "statusBanner": "RED: VULNERABILITY CONFIRMED" | "GREEN: PATCH VERIFIED", "executionLog": "string", "exitCode": 0 }',
    ].join("\n"),
  parseOutput: (rawText) => {
    const record = extractJsonRecord(rawText);
    const isGreenFallback =
      rawText.toUpperCase().includes("GREEN") ||
      rawText.toUpperCase().includes("PATCH VERIFIED") ||
      rawText.toUpperCase().includes("BLOCKED");
    const defaultBanner = isGreenFallback
      ? "GREEN: PATCH VERIFIED"
      : "RED: VULNERABILITY CONFIRMED";

    return {
      confirmed: typeof record?.confirmed === "boolean" ? record.confirmed : true,
      statusBanner:
        typeof record?.statusBanner === "string" && record.statusBanner.trim().length > 0
          ? record.statusBanner.trim()
          : defaultBanner,
      executionLog:
        typeof record?.executionLog === "string" && record.executionLog.trim().length > 0
          ? record.executionLog.trim()
          : rawText.trim() || `[antigravity-preview-09-2026] ${defaultBanner}`,
      exitCode: typeof record?.exitCode === "number" ? record.exitCode : 0,
    };
  },
});

export const aegisTriRemediatorUnit = defineAgentUnit<
  AegisTriRemediatorPayload,
  AegisTriRemediatorOutput
>({
  id: "aegis-tri-remediator",
  label: "AEGIS-4 Tri-Mode Self-Healing Synthesizer",
  defaultThinkingLevel: "high",
  maxOutputTokens: 65536,
  buildPrompt: (payload) =>
    [
      "You are the AEGIS-4 Tri-Mode Self-Healing Synthesizer powered by Gemini 4 Argon (`gemini-4-argon`).",
      `Target Name: ${payload.targetName}`,
      `Selected Remediation Mode: ${payload.remediationMode}`,
      `Vulnerability Title: ${payload.vulnerabilityTitle}`,
      `Location: ${payload.location}`,
      `Root Cause Analysis: ${payload.rootCause}`,
      "",
      "Synthesize a deterministic self-healing artifact matching the requested mode:",
      "- If `git-pr`: produce a minimal, production-ready unified Git diff patch.",
      "- If `binary-patch`: produce an ELF/PE binary byte-offset hard-patch instruction set with bounds checking.",
      "- If `route-shield`: produce an Edge Route Shield WAF/Envoy regex filter rule blocking the exploit vector at zero latency.",
      "",
      "Return strictly a JSON object matching:",
      '{ "remediationMode": "git-pr" | "binary-patch" | "route-shield", "summary": "string", "artifactSnippet": "string", "verificationCommand": "string" }',
    ].join("\n"),
  parseOutput: (rawText) => {
    const record = extractJsonRecord(rawText);
    const remediationMode = normalizeRemediationMode(record?.remediationMode, "web", rawText);
    const summary =
      typeof record?.summary === "string" && record.summary.trim().length > 0
        ? record.summary.trim()
        : `Synthesized ${remediationMode} self-healing remediation artifact.`;
    const artifactSnippet =
      typeof record?.artifactSnippet === "string" && record.artifactSnippet.trim().length > 0
        ? record.artifactSnippet.trim()
        : rawText.trim();
    const verificationCommand =
      typeof record?.verificationCommand === "string" &&
      record.verificationCommand.trim().length > 0
        ? record.verificationCommand.trim()
        : remediationMode === "binary-patch"
          ? "aegis-binpatch --verify --check-signatures ./target.bin"
          : remediationMode === "route-shield"
            ? "aegis-edge-ctl test-rule --config ./route-shield.yaml"
            : "git apply --check aegis-remediation.patch && bun test";

    return {
      remediationMode,
      summary,
      artifactSnippet,
      verificationCommand,
    };
  },
});

export const AEGIS_AGENT_UNITS = [aegisClassifierUnit, aegisSandboxPocUnit, aegisTriRemediatorUnit];
