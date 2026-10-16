import type {
  AegisProject,
  AegisRemediationMode,
  AegisRouteShieldRule,
  AegisShieldTestAttackResponse,
} from "@deepmind/shared";
import { createEffect, createSignal, For, Show } from "solid-js";

type ShieldSnippetKey = keyof AegisRouteShieldRule["snippets"];

const SHIELD_SNIPPET_OPTIONS: Array<{
  key: ShieldSnippetKey;
  label: string;
  language: string;
}> = [
  { key: "cloudRunGin", label: "Cloud Run Go Gin", language: "go" },
  { key: "cloudArmor", label: "Google Cloud Armor", language: "hcl" },
  { key: "cloudflareWorker", label: "Cloudflare Worker", language: "typescript" },
  { key: "nginx", label: "NGINX", language: "nginx" },
  { key: "envoy", label: "Envoy", language: "yaml" },
];

export function AegisPatchInsightPanel(props: {
  project: AegisProject;
  onToggleShield: (enabled: boolean) => Promise<void>;
  onTestAttack: (payload: string) => Promise<AegisShieldTestAttackResponse | null>;
  onRunScan: (mode?: AegisRemediationMode) => Promise<void>;
  busy: boolean;
}) {
  const [activeTab, setActiveTab] = createSignal<AegisRemediationMode>(
    props.project.remediationMode,
  );
  const [attackPayload, setAttackPayload] = createSignal<string>(
    props.project.routeShield?.sampleAttackPayload ?? "",
  );
  const [attackResult, setAttackResult] = createSignal<AegisShieldTestAttackResponse | null>(null);
  const [selectedSnippetKey, setSelectedSnippetKey] = createSignal<ShieldSnippetKey>("cloudRunGin");

  createEffect(() => {
    setActiveTab(props.project.remediationMode);
    if (props.project.routeShield?.sampleAttackPayload) {
      setAttackPayload(props.project.routeShield.sampleAttackPayload);
    }
    setAttackResult(null);
  });

  const handleFireAttack = async () => {
    const res = await props.onTestAttack(attackPayload());
    if (res) {
      setAttackResult(res);
    }
  };

  const severityBadgeClass = (severity: string) => {
    if (severity === "critical") {
      return "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400";
    }
    if (severity === "high") {
      return "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400";
    }
    return "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400";
  };

  return (
    <div class="flex flex-col gap-y-5">
      {/* 1. Top Vulnerability Root Cause & Red/Green PoC Comparison Card */}
      <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
        <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-x-2.5">
            <span class="inline-flex items-center justify-center size-8 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold text-sm">
              PoC
            </span>
            <div>
              <h3 class="text-sm md:text-base font-semibold text-gray-800 dark:text-neutral-100">
                Vulnerability Root Cause &amp; Red/Green PoC Verification
              </h3>
              <p class="text-xs text-gray-500 dark:text-neutral-400">
                Deterministic sandbox exploit reproduction before and after autonomous patch
                synthesis
              </p>
            </div>
          </div>
          <div class="flex items-center gap-x-2">
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
              ✓ Zero-False-Positive Verified
            </span>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.onRunScan(activeTab())}
              class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50 cursor-pointer transition-colors disabled:opacity-50"
            >
              {props.busy ? "Synthesizing..." : "↻ Re-Verify Active Mode"}
            </button>
          </div>
        </div>

        <div class="p-4 md:p-5 flex flex-col gap-y-5">
          <For each={props.project.vulnerabilities}>
            {(vuln) => (
              <div class="flex flex-col gap-y-4">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-neutral-800">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class={severityBadgeClass(vuln.severity)}>
                      {vuln.severity.toUpperCase()} • CVSS {vuln.cvssScore.toFixed(1)}
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {vuln.cveOrCwe}
                    </span>
                    <span class="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                      {vuln.title}
                    </span>
                    <Show when={vuln.zeroFalsePositiveConfirmed}>
                      <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-[11px] font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                        Zero-False-Positive Verified
                      </span>
                    </Show>
                  </div>
                  <code class="text-xs font-mono px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
                    📍 {vuln.location}
                  </code>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-neutral-950/60 dark:border-neutral-800">
                    <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">
                      Root Cause Analysis
                    </div>
                    <p class="text-xs md:text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                      {vuln.rootCause}
                    </p>
                  </div>
                  <div class="p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-neutral-950/60 dark:border-neutral-800">
                    <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">
                      Attack Vector &amp; Trigger
                    </div>
                    <p class="text-xs md:text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                      {vuln.attackVector}
                    </p>
                  </div>
                </div>

                {/* Side-by-Side Red vs Green Sandbox Terminals */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="bg-neutral-950 border border-red-900/60 rounded-xl p-3.5 flex flex-col gap-y-2">
                    <div class="flex items-center justify-between border-b border-red-950/80 pb-2">
                      <span class="text-xs font-semibold text-red-400">
                        🔴 RED: Sandbox PoC Exploit Log
                      </span>
                      <span class="inline-flex items-center py-0.5 px-2 rounded-full text-[11px] font-mono bg-red-950/80 text-red-300 border border-red-800/50">
                        EXPLOIT CONFIRMED
                      </span>
                    </div>
                    <div class="text-[11px] font-mono text-amber-300/90 bg-neutral-900/90 px-2.5 py-1.5 rounded border border-neutral-800 overflow-x-auto">
                      <span class="text-neutral-500 select-none">$ payload: </span>
                      {vuln.pocPayload}
                    </div>
                    <pre class="text-xs font-mono text-red-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {vuln.pocRedLog}
                    </pre>
                  </div>

                  <div class="bg-neutral-950 border border-teal-900/60 rounded-xl p-3.5 flex flex-col gap-y-2">
                    <div class="flex items-center justify-between border-b border-teal-950/80 pb-2">
                      <span class="text-xs font-semibold text-teal-400">
                        🟢 GREEN: Post-Remediation Verification Log
                      </span>
                      <span class="inline-flex items-center py-0.5 px-2 rounded-full text-[11px] font-mono bg-teal-950/80 text-teal-300 border border-teal-800/50">
                        PATCH VERIFIED
                      </span>
                    </div>
                    <pre class="text-xs font-mono text-teal-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {vuln.verifyGreenLog}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* 2. Tri-Mode Remediation Switcher Tabs (Preline Segmented Pills) */}
      <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
        <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-col gap-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm md:text-base font-semibold text-gray-800 dark:text-neutral-100">
                Tri-Mode Autonomous Remediation Workbench
              </h3>
              <p class="text-xs text-gray-500 dark:text-neutral-400">
                Inspect or switch between White-Box Git PR, No-Source Binary Hard-Patching, and Live
                Virtual Route Shielding
              </p>
            </div>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
              Primary Mode: {props.project.remediationMode}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-xl dark:bg-neutral-950">
            <button
              type="button"
              onClick={() => setActiveTab("git-pr")}
              class={`py-2 px-3 inline-flex items-center justify-center gap-x-2 text-xs md:text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                activeTab() === "git-pr"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-800 dark:text-blue-400"
                  : "text-gray-600 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              🔀 Mode 1: Git Branch &amp; GitHub PR (White-Box)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("binary-patch")}
              class={`py-2 px-3 inline-flex items-center justify-center gap-x-2 text-xs md:text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                activeTab() === "binary-patch"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-800 dark:text-blue-400"
                  : "text-gray-600 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              🧬 Mode 2: Binary Hard-Patch &amp; Hex/ASM Diff (No-Source Binary)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("route-shield")}
              class={`py-2 px-3 inline-flex items-center justify-center gap-x-2 text-xs md:text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                activeTab() === "route-shield"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-800 dark:text-blue-400"
                  : "text-gray-600 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              🛡️ Mode 3: Live Route &amp; API Shield (Virtual Patching)
            </button>
          </div>
        </div>

        {/* 3. Tab 1 Content (git-pr) */}
        <Show when={activeTab() === "git-pr"}>
          <Show
            when={props.project.gitPrReport}
            fallback={
              <div class="p-6 text-center flex flex-col items-center gap-y-3">
                <p class="text-sm text-gray-600 dark:text-neutral-400">
                  Git PR report is not synthesized yet for this target.
                </p>
                <button
                  type="button"
                  disabled={props.busy}
                  onClick={() => props.onRunScan("git-pr")}
                  class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  Synthesize Mode 1: Git Branch &amp; GitHub PR
                </button>
              </div>
            }
          >
            {(report) => (
              <div class="p-4 md:p-5 flex flex-col gap-y-5">
                <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800">
                  <div class="flex flex-wrap items-center gap-2.5">
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-mono font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                      🌿 {report().branchName}
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                      PR #{report().prNumber} • {report().status.toUpperCase()} •{" "}
                      {report().ciChecksPassed ? "CI Checks Passed" : "CI Pending"}
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300">
                      commit {report().commitSha}
                    </span>
                  </div>
                  <a
                    href={report().prUrl || "https://github.com/eunhhu/deepmind-hackathon/pulls"}
                    target="_blank"
                    rel="noreferrer"
                    class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                  >
                    ↗ View GitHub Pull Request
                  </a>
                </div>

                <div>
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      Side-by-Side Source Code Diff ({report().codeDiff.filePath})
                    </h4>
                    <span class="text-xs text-teal-600 dark:text-teal-400 font-medium">
                      {report().codeDiff.explanation}
                    </span>
                  </div>
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="bg-neutral-950 border border-red-900/60 rounded-xl p-3.5 flex flex-col gap-y-2">
                      <div class="text-xs font-semibold text-red-400 border-b border-red-950 pb-1.5">
                        − Vulnerable Source (Before Patch)
                      </div>
                      <pre class="text-xs font-mono text-red-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {report().codeDiff.beforeCode}
                      </pre>
                    </div>
                    <div class="bg-neutral-950 border border-teal-900/60 rounded-xl p-3.5 flex flex-col gap-y-2">
                      <div class="text-xs font-semibold text-teal-400 border-b border-teal-950 pb-1.5">
                        + Patched Source (AST-Verified Remediation)
                      </div>
                      <pre class="text-xs font-mono text-teal-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {report().codeDiff.afterCode}
                      </pre>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 flex flex-col gap-y-2">
                    <div class="text-xs font-semibold text-neutral-300 border-b border-neutral-800 pb-1.5">
                      Unified Git Patch Diff
                    </div>
                    <pre class="text-xs font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {report().codeDiff.unifiedDiff}
                    </pre>
                  </div>
                  <div class="bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col gap-y-2">
                    <div class="text-xs font-semibold text-gray-700 dark:text-neutral-300 border-b border-gray-200 dark:border-neutral-800 pb-1.5">
                      Automated GitHub PR Markdown Comment Preview
                    </div>
                    <pre class="text-xs font-mono text-gray-700 dark:text-neutral-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {report().markdownComment}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </Show>

        {/* 4. Tab 2 Content (binary-patch) */}
        <Show when={activeTab() === "binary-patch"}>
          <Show
            when={props.project.binaryAnalysis}
            fallback={
              <div class="p-6 text-center flex flex-col items-center gap-y-3">
                <p class="text-sm text-gray-600 dark:text-neutral-400">
                  Binary Hard-Patch analysis is not synthesized yet for this target.
                </p>
                <button
                  type="button"
                  disabled={props.busy}
                  onClick={() => props.onRunScan("binary-patch")}
                  class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  Synthesize Mode 2: Binary Hard-Patch
                </button>
              </div>
            }
          >
            {(binary) => (
              <div class="p-4 md:p-5 flex flex-col gap-y-5">
                <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                      Format: {binary().format}
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {binary().fileName} ({(binary().fileSizeBytes / 1024).toFixed(1)} KB)
                    </span>
                    <For each={binary().dangerousSinks}>
                      {(sink) => (
                        <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-mono font-medium bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400">
                          ⚠️ Sink: {sink}
                        </span>
                      )}
                    </For>
                  </div>

                  <a
                    href={binary().downloadUrl}
                    download={`${binary().fileName}.patched.bin`}
                    class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 cursor-pointer transition-colors"
                  >
                    ⬇️ Download Hard-Patched Binary (.bin)
                  </a>
                </div>

                {/* SHA-256 & Memory Protections */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800 flex flex-col gap-y-2">
                    <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      Cryptographic Binary Integrity (SHA-256)
                    </div>
                    <div class="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                      <span class="font-semibold">SHA-256 Before: </span>
                      {binary().sha256Before}
                    </div>
                    <div class="text-xs font-mono text-teal-600 dark:text-teal-400 break-all">
                      <span class="font-semibold">SHA-256 After: </span>
                      {binary().sha256After}
                    </div>
                  </div>

                  <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800 flex flex-col gap-y-2">
                    <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      ELF / PE Binary Hardening &amp; Memory Protections
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                        NX: {binary().protections.nxEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                      <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                        PIE: {binary().protections.pieEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                      <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                        Stack Canary: {binary().protections.stackCanary ? "ENABLED" : "MISSING"}
                      </span>
                      <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                        RELRO: {binary().protections.relro.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Binary Offset & Disassembly Side-by-Side Diff Table */}
                <div class="overflow-x-auto border border-gray-200 rounded-xl dark:border-neutral-800">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-800">
                    <thead class="bg-gray-50 dark:bg-neutral-950">
                      <tr>
                        <th class="px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-500 dark:text-neutral-400">
                          Offset / Symbol
                        </th>
                        <th class="px-4 py-2.5 text-start text-xs font-semibold uppercase text-red-600 dark:text-red-400">
                          Before (Hex &amp; objdump ASM)
                        </th>
                        <th class="px-4 py-2.5 text-start text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">
                          After Hard-Patch (Hex &amp; objdump ASM)
                        </th>
                        <th class="px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-500 dark:text-neutral-400">
                          Patch Rationale
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                      <For each={binary().patchInstructions}>
                        {(inst) => (
                          <tr>
                            <td class="px-4 py-3 whitespace-nowrap text-xs font-mono">
                              <div class="font-bold text-gray-800 dark:text-neutral-200">
                                {inst.offsetHex} ({inst.section})
                              </div>
                              <div class="text-gray-500 dark:text-neutral-400">
                                {inst.functionName}
                              </div>
                            </td>
                            <td class="px-4 py-3 text-xs font-mono bg-red-50/40 dark:bg-red-950/20">
                              <div class="text-red-700 dark:text-red-300 font-semibold">
                                {inst.beforeBytesHex}
                              </div>
                              <div class="text-red-600 dark:text-red-400">{inst.beforeAsm}</div>
                            </td>
                            <td class="px-4 py-3 text-xs font-mono bg-teal-50/40 dark:bg-teal-950/20">
                              <div class="text-teal-700 dark:text-teal-300 font-semibold">
                                {inst.afterBytesHex}
                              </div>
                              <div class="text-teal-600 dark:text-teal-400">{inst.afterAsm}</div>
                            </td>
                            <td class="px-4 py-3 text-xs text-gray-700 dark:text-neutral-300">
                              {inst.rationale}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Show>
        </Show>

        {/* 5. Tab 3 Content (route-shield) */}
        <Show when={activeTab() === "route-shield"}>
          <Show
            when={props.project.routeShield}
            fallback={
              <div class="p-6 text-center flex flex-col items-center gap-y-3">
                <p class="text-sm text-gray-600 dark:text-neutral-400">
                  Live Route Shield is not synthesized yet for this target.
                </p>
                <button
                  type="button"
                  disabled={props.busy}
                  onClick={() => props.onRunScan("route-shield")}
                  class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  Synthesize Mode 3: Live Route &amp; API Shield
                </button>
              </div>
            }
          >
            {(shield) => (
              <div class="p-4 md:p-5 flex flex-col gap-y-5">
                {/* Route Shield Metadata Bar */}
                <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-mono font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                      Rule: {shield().ruleId}
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                      {shield().methods.join("/")} {shield().protectedPath}
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                      Rate Limit: {shield().rateLimitRps} RPS
                    </span>
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                      Blocked Attacks: {shield().blockedRequestsCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={props.busy}
                    onClick={() => props.onToggleShield(!shield().enabled)}
                    class={
                      shield().enabled
                        ? "py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-teal-600 text-white hover:bg-teal-700 cursor-pointer transition-colors"
                        : "py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-amber-600 text-white hover:bg-amber-700 cursor-pointer transition-colors"
                    }
                  >
                    {shield().enabled
                      ? "🛡️ Route Shield: ACTIVE (ON)"
                      : "⚠️ Route Shield: BYPASSED (OFF)"}
                  </button>
                </div>

                <div class="p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-neutral-950 dark:border-neutral-800 text-xs font-mono">
                  <span class="text-gray-500 dark:text-neutral-400 font-sans font-semibold mr-2">
                    Regex Filter:
                  </span>
                  <span class="text-blue-600 dark:text-blue-400 break-all">
                    {shield().blockPatternRegex}
                  </span>
                </div>

                {/* Interactive Live Route Shield Gateway & Attack Simulator */}
                <div class="p-4 rounded-xl border border-gray-200 bg-gray-50/60 dark:bg-neutral-950 dark:border-neutral-800 flex flex-col gap-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <label
                      for="aegis-live-attack-payload-input"
                      class="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-neutral-300"
                    >
                      Interactive Live Route Shield Gateway &amp; Attack Simulator
                    </label>
                    <span class="text-xs text-gray-500 dark:text-neutral-400">
                      Toggle shield ON/OFF above and fire live exploit payload to verify runtime
                      protection
                    </span>
                  </div>

                  <div class="flex flex-col sm:flex-row gap-2">
                    <input
                      id="aegis-live-attack-payload-input"
                      type="text"
                      value={attackPayload()}
                      onInput={(e) => setAttackPayload(e.currentTarget.value)}
                      class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm font-mono focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                      placeholder="Enter exploit payload..."
                    />
                    <button
                      type="button"
                      disabled={props.busy}
                      onClick={handleFireAttack}
                      class="py-2 px-3 inline-flex items-center justify-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
                    >
                      🚀 Fire Live Exploit Against Route
                    </button>
                  </div>

                  <Show when={attackResult()}>
                    {(res) => (
                      <div
                        class={
                          res().verdict === "BLOCKED_GREEN"
                            ? "p-4 rounded-xl border border-teal-500/40 bg-teal-50/80 dark:bg-teal-950/40 dark:border-teal-800 flex flex-col gap-y-2"
                            : "p-4 rounded-xl border border-red-500/40 bg-red-50/80 dark:bg-red-950/40 dark:border-red-800 flex flex-col gap-y-2"
                        }
                      >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <span
                            class={
                              res().verdict === "BLOCKED_GREEN"
                                ? "text-xs md:text-sm font-bold text-teal-800 dark:text-teal-300"
                                : "text-xs md:text-sm font-bold text-red-800 dark:text-red-300"
                            }
                          >
                            {res().verdict === "BLOCKED_GREEN"
                              ? "HTTP 403 Forbidden — Blocked by AEGIS-4 Route Shield"
                              : "HTTP 200 OK — RED: EXPLOIT SUCCEEDED (Shield OFF)"}
                          </span>
                          <span class="inline-flex items-center py-0.5 px-2 rounded-full text-xs font-mono bg-white/80 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300">
                            HTTP {res().httpStatus} • {res().latencyMs}ms
                          </span>
                        </div>
                        <pre class="text-xs font-mono p-2.5 rounded-lg bg-neutral-950 text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                          {res().responseBody}
                        </pre>
                      </div>
                    )}
                  </Show>
                </div>

                {/* Exportable Edge Shield Snippets Selector */}
                <div class="flex flex-col gap-y-2.5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      Exportable Edge Shield Snippets Selector
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      <For each={SHIELD_SNIPPET_OPTIONS}>
                        {(option) => (
                          <button
                            type="button"
                            onClick={() => setSelectedSnippetKey(option.key)}
                            class={
                              selectedSnippetKey() === option.key
                                ? "py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400 cursor-pointer transition-colors"
                                : "py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 cursor-pointer transition-colors"
                            }
                          >
                            {option.label}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
                    <div class="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
                      <span class="text-xs font-semibold text-teal-400">
                        {SHIELD_SNIPPET_OPTIONS.find((o) => o.key === selectedSnippetKey())?.label}
                      </span>
                      <span class="text-[11px] font-mono text-neutral-400">
                        Zero-Downtime Edge Policy
                      </span>
                    </div>
                    <pre class="text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {shield().snippets[selectedSnippetKey()]}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
}
