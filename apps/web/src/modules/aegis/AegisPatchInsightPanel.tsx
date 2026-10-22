import type {
  AegisCreatePrResponse,
  AegisProject,
  AegisShieldTestAttackResponse,
  AegisTimelineStep,
} from "@deepmind/shared";
import { createSignal, For, Show } from "solid-js";
import {
  createAegisGitHubPr,
  getAegisBinaryDownloadUrl,
  getAegisPatchDownloadUrl,
  updateAegisShieldRule,
  uploadAegisBinary,
} from "../../core/api/client";
import { AegisLifecyclePanel } from "./AegisLifecyclePanel";

export type AegisInsightTab =
  | "git"
  | "binary"
  | "shield"
  | "automation-sdk"
  | "safe-delivery"
  | "verification";

export function AegisPatchInsightPanel(props: {
  project: AegisProject;
  liveSteps: AegisTimelineStep[];
  activeTab?: AegisInsightTab;
  onSelectTab?: (tab: AegisInsightTab) => void;
  expanded: boolean;
  onExpand: () => void;
  attackPayload: string;
  setAttackPayload: (val: string) => void;
  attackResult: AegisShieldTestAttackResponse | null;
  onToggleShield: (enabled: boolean) => Promise<void>;
  onTestAttack: () => Promise<void>;
  onProjectUpdate: (project: AegisProject) => void;
}) {
  const [internalTab, setInternalTab] = createSignal<AegisInsightTab>("git");
  const [prResult, setPrResult] = createSignal<AegisCreatePrResponse | null>(null);
  const [creatingPr, setCreatingPr] = createSignal(false);
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  const [wafSnippetKey, setWafSnippetKey] = createSignal<
    "cloudRunGin" | "cloudArmor" | "cloudflareWorker" | "nginx" | "envoy"
  >("cloudRunGin");
  const [customRegex, setCustomRegex] = createSignal("");
  const [customRps, setCustomRps] = createSignal(25);
  const [savingRule, setSavingRule] = createSignal(false);
  const [uploadingBinary, setUploadingBinary] = createSignal(false);

  const currentTab = () => props.activeTab ?? internalTab();

  const selectTab = (tab: AegisInsightTab) => {
    setInternalTab(tab);
    if (props.onSelectTab) {
      props.onSelectTab(tab);
    }
    props.onExpand();
  };

  const isRemediationArtifactTab = () => {
    const tab = currentTab();
    return tab === "git" || tab === "binary" || tab === "shield";
  };

  const primaryVuln = () => props.project.vulnerabilities[0];

  const copyToClipboard = (key: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleCreatePr = async () => {
    setCreatingPr(true);
    try {
      const res = await createAegisGitHubPr(props.project.id);
      setPrResult(res);
      if (res.project) {
        props.onProjectUpdate(res.project);
      }
    } finally {
      setCreatingPr(false);
    }
  };

  const handleSaveShieldRule = async () => {
    const shield = props.project.routeShield;
    if (!shield) return;
    setSavingRule(true);
    try {
      const updated = await updateAegisShieldRule(props.project.id, {
        protectedPath: shield.protectedPath,
        blockPatternRegex: customRegex().trim() || shield.blockPatternRegex,
        rateLimitRps: customRps() || shield.rateLimitRps,
      });
      props.onProjectUpdate(updated);
    } finally {
      setSavingRule(false);
    }
  };

  const handleBinaryUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingBinary(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 4096));
      let binaryStr = "";
      for (const b of bytes) {
        binaryStr += String.fromCharCode(b);
      }
      const base64Data = btoa(binaryStr);
      const updated = await uploadAegisBinary(props.project.id, {
        fileName: file.name,
        format: "ELF64",
        base64Data,
      });
      props.onProjectUpdate(updated);
    } finally {
      setUploadingBinary(false);
    }
  };

  const diffLines = () => {
    const raw = props.project.gitPrReport?.codeDiff.unifiedDiff ?? "";
    return raw.split("\n");
  };

  return (
    <div class="space-y-4">
      {/* Top Summary Header Card */}
      <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center size-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <svg
                class="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <title>Remediation Command Center</title>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-bold text-gray-900 dark:text-white">
                  {props.project.name} · Remediation & Verification Workspace
                </h2>
                <Show when={primaryVuln()}>
                  {(v) => (
                    <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400">
                      {v().cveOrCwe} · CVSS {v().cvssScore.toFixed(1)}
                    </span>
                  )}
                </Show>
                <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                  Status: {props.project.defenseStatus}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                {props.project.subtitle}
              </p>
            </div>
          </div>

          {/* Route-Synchronized Workspace Navigation Pills */}
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => selectTab("git")}
              class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                isRemediationArtifactTab()
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              1. Remediation Artifacts
            </button>
            <button
              type="button"
              data-testid="tab-automation-sdk"
              onClick={() => selectTab("automation-sdk")}
              class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                currentTab() === "automation-sdk"
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              2. Automation & SDK
            </button>
            <button
              type="button"
              data-testid="tab-safe-delivery"
              onClick={() => selectTab("safe-delivery")}
              class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                currentTab() === "safe-delivery"
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              3. Safe Delivery & Rollback
            </button>
            <button
              type="button"
              onClick={() => selectTab("verification")}
              class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                currentTab() === "verification"
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              4. Verification Sandbox
            </button>
          </div>
        </div>
      </div>

      <Show when={props.expanded}>
        {/* 1. Remediation Artifacts Card (git / binary / shield) */}
        <Show when={isRemediationArtifactTab()}>
          <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
            <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                  Synthesized Remediation Artifacts
                </h3>
                <p class="text-xs text-gray-500 dark:text-neutral-400">
                  Switch between Source Patch Pull Request, ELF64 Binary Hot-Patch, and Edge Route
                  Shield WAF
                </p>
              </div>

              {/* 3-Pill Remediation Artifact Mode Switcher */}
              <div class="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-neutral-800">
                <button
                  type="button"
                  data-testid="remediation-tab-git-pr"
                  onClick={() => selectTab("git")}
                  class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    currentTab() === "git"
                      ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-900 dark:text-blue-400"
                      : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  Source Patch PR
                </button>
                <button
                  type="button"
                  data-testid="remediation-tab-binary-patch"
                  onClick={() => selectTab("binary")}
                  class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    currentTab() === "binary"
                      ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-900 dark:text-blue-400"
                      : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  ELF64 Binary Patch
                </button>
                <button
                  type="button"
                  data-testid="remediation-tab-route-shield"
                  onClick={() => selectTab("shield")}
                  class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    currentTab() === "shield"
                      ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-900 dark:text-blue-400"
                      : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  Edge Route Shield
                </button>
              </div>
            </div>

            {/* Tab 1A: Source Patch & GitHub Pull Request */}
            <Show when={currentTab() === "git"}>
              <div class="p-4 md:p-5 space-y-4">
                <Show
                  when={props.project.gitPrReport}
                  fallback={
                    <div class="p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
                      No git source diff available for this target. Switch to ELF64 Binary Patch or
                      Edge Route Shield.
                    </div>
                  }
                >
                  {(report) => (
                    <>
                      <div class="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-3.5">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-gray-900 dark:text-white font-mono">
                              {report().codeDiff.filePath}
                            </span>
                            <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                              Branch: {report().branchName}
                            </span>
                            <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                              PR #{report().prNumber} ({report().status})
                            </span>
                          </div>
                          <p class="text-xs text-gray-600 dark:text-neutral-400">
                            {report().codeDiff.explanation}
                          </p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <a
                            data-testid="download-patch-link"
                            href={getAegisPatchDownloadUrl(props.project.id)}
                            download
                            class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 transition-colors"
                          >
                            Download .patch
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("diff", report().codeDiff.unifiedDiff)}
                            class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                          >
                            {copiedKey() === "diff" ? "Copied Diff!" : "Copy Unified Diff"}
                          </button>
                          <button
                            type="button"
                            data-testid="create-pr-btn"
                            disabled={creatingPr()}
                            onClick={handleCreatePr}
                            class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            {creatingPr() ? "Creating GitHub PR..." : "Create / Sync GitHub PR"}
                          </button>
                        </div>
                      </div>

                      <Show when={prResult()}>
                        {(pr) => (
                          <div
                            data-testid="pr-created-banner"
                            class="rounded-xl border border-teal-200 bg-teal-50/90 dark:border-teal-900/60 dark:bg-teal-950/40 p-3.5 space-y-1.5 text-xs text-teal-900 dark:text-teal-200"
                          >
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <span class="font-bold">
                                GitHub Pull Request #{pr().prNumber} Ready ({pr().status})
                              </span>
                              <a
                                href={pr().prUrl}
                                target="_blank"
                                rel="noreferrer"
                                class="font-mono underline font-semibold"
                              >
                                {pr().prUrl}
                              </a>
                            </div>
                            <div class="font-mono text-[11px] bg-teal-950/10 dark:bg-black/30 rounded p-2">
                              {pr().ghCliCommand}
                            </div>
                          </div>
                        )}
                      </Show>

                      {/* Unified Code Diff Viewer */}
                      <div
                        data-testid="code-diff-viewer"
                        class="rounded-xl border border-gray-200 dark:border-neutral-800 bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto p-4 leading-relaxed"
                      >
                        <For each={diffLines()}>
                          {(line) => {
                            const isAdd = line.startsWith("+") && !line.startsWith("+++");
                            const isDel = line.startsWith("-") && !line.startsWith("---");
                            const isHunk = line.startsWith("@@");
                            return (
                              <div
                                class={`px-2 py-0.5 whitespace-pre ${
                                  isAdd
                                    ? "bg-teal-950/70 text-teal-300 border-l-2 border-teal-400"
                                    : isDel
                                      ? "bg-red-950/70 text-red-300 border-l-2 border-red-400"
                                      : isHunk
                                        ? "text-blue-400 font-semibold"
                                        : "text-neutral-300"
                                }`}
                              >
                                {line}
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </>
                  )}
                </Show>
              </div>
            </Show>

            {/* Tab 1B: ELF64 Binary Disassembly & Byte-Level Hot Patch */}
            <Show when={currentTab() === "binary"}>
              <div class="p-4 md:p-5 space-y-4">
                <Show
                  when={props.project.binaryAnalysis}
                  fallback={
                    <div class="p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
                      No ELF64 binary analysis loaded for this project.
                    </div>
                  }
                >
                  {(bin) => (
                    <>
                      <div class="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-3.5">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-gray-900 dark:text-white font-mono">
                              {bin().fileName}
                            </span>
                            <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                              {bin().format} · {(bin().fileSizeBytes / 1024).toFixed(1)} KB
                            </span>
                            <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                              NX: {bin().protections.nxEnabled ? "ON" : "OFF"} · PIE:{" "}
                              {bin().protections.pieEnabled ? "ON" : "OFF"} · RELRO:{" "}
                              {bin().protections.relro.toUpperCase()}
                            </span>
                          </div>
                          <p class="text-[11px] font-mono text-gray-500 dark:text-neutral-400">
                            SHA256 Before: {bin().sha256Before.slice(0, 24)}… → After:{" "}
                            {bin().sha256After.slice(0, 24)}…
                          </p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <label class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                            <span>
                              {uploadingBinary() ? "Analyzing ELF..." : "Upload ELF64 Binary"}
                            </span>
                            <input
                              type="file"
                              class="hidden"
                              onChange={(e) => handleBinaryUpload(e.currentTarget.files?.[0])}
                            />
                          </label>
                          <a
                            data-testid="download-binary-link"
                            href={getAegisBinaryDownloadUrl(props.project.id)}
                            download
                            class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Download Patched Binary
                          </a>
                        </div>
                      </div>

                      <div
                        data-testid="binary-patch-table"
                        class="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800"
                      >
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-800 text-left text-xs">
                          <thead class="bg-gray-50 dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 uppercase">
                            <tr>
                              <th class="px-4 py-2.5 font-semibold">Offset / Symbol</th>
                              <th class="px-4 py-2.5 font-semibold">
                                Vulnerable Instruction (Before)
                              </th>
                              <th class="px-4 py-2.5 font-semibold">
                                Hard-Patched Instruction (After)
                              </th>
                              <th class="px-4 py-2.5 font-semibold">Security Rationale</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-200 dark:divide-neutral-800 font-mono">
                            <For each={bin().patchInstructions}>
                              {(inst) => (
                                <tr class="hover:bg-gray-50/70 dark:hover:bg-neutral-800/50">
                                  <td class="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">
                                    <div>{inst.offsetHex}</div>
                                    <div class="text-[11px] text-gray-500">
                                      {inst.section} · {inst.functionName}
                                    </div>
                                  </td>
                                  <td class="px-4 py-3 text-red-600 dark:text-red-400">
                                    <div class="font-bold">{inst.beforeBytesHex}</div>
                                    <div class="text-[11px] opacity-85">{inst.beforeAsm}</div>
                                  </td>
                                  <td class="px-4 py-3 text-teal-600 dark:text-teal-400">
                                    <div class="font-bold">{inst.afterBytesHex}</div>
                                    <div class="text-[11px] opacity-85">{inst.afterAsm}</div>
                                  </td>
                                  <td class="px-4 py-3 font-sans text-gray-700 dark:text-neutral-300">
                                    {inst.rationale}
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Show>
              </div>
            </Show>

            {/* Tab 1C: Edge Route Shield / Virtual WAF */}
            <Show when={currentTab() === "shield"}>
              <div class="p-4 md:p-5 space-y-4">
                <Show when={props.project.routeShield}>
                  {(shield) => (
                    <>
                      <div class="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-gray-900 dark:text-white font-mono">
                              {shield().ruleId} · {shield().protectedPath}
                            </span>
                            <span
                              class={`inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium ${
                                shield().enabled
                                  ? "bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400"
                              }`}
                            >
                              {shield().enabled ? "Edge Shield Active" : "Edge Shield Disabled"}
                            </span>
                            <span class="text-xs text-gray-500 dark:text-neutral-400">
                              Blocked Requests: {shield().blockedRequestsCount}
                            </span>
                          </div>
                          <p class="text-xs font-mono text-blue-600 dark:text-blue-400">
                            Regex: {shield().blockPatternRegex}
                          </p>
                        </div>
                        <button
                          type="button"
                          data-testid="toggle-shield-btn"
                          onClick={() => props.onToggleShield(!shield().enabled)}
                          class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors"
                        >
                          {shield().enabled ? "Disable Route Shield" : "Enable Route Shield"}
                        </button>
                      </div>

                      {/* Custom Regex & Rate Limit Editor */}
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-gray-50/50 dark:bg-neutral-950/50 border border-gray-200 dark:border-neutral-800 rounded-xl p-3.5">
                        <div class="md:col-span-2 space-y-1">
                          <label
                            for="shield-regex-input"
                            class="block text-xs font-medium text-gray-700 dark:text-neutral-300"
                          >
                            Override Block Pattern Regex
                          </label>
                          <input
                            id="shield-regex-input"
                            type="text"
                            value={customRegex() || shield().blockPatternRegex}
                            onInput={(e) => setCustomRegex(e.currentTarget.value)}
                            class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-xs font-mono focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                          />
                        </div>
                        <div class="flex items-center gap-2">
                          <input
                            type="number"
                            value={customRps() || shield().rateLimitRps}
                            onInput={(e) => setCustomRps(Number(e.currentTarget.value) || 25)}
                            class="py-2 px-3 block w-24 border border-gray-200 rounded-lg text-xs font-mono dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                          />
                          <button
                            type="button"
                            disabled={savingRule()}
                            onClick={handleSaveShieldRule}
                            class="py-2 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white cursor-pointer transition-colors"
                          >
                            {savingRule() ? "Saving..." : "Update Rule"}
                          </button>
                        </div>
                      </div>

                      {/* Multi-Target WAF Snippets */}
                      <div class="space-y-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-neutral-800">
                            <For
                              each={
                                [
                                  { id: "cloudRunGin", label: "Cloud Run Gin" },
                                  { id: "cloudArmor", label: "Cloud Armor" },
                                  {
                                    id: "cloudflareWorker",
                                    label: "Cloudflare",
                                  },
                                  { id: "nginx", label: "NGINX" },
                                  { id: "envoy", label: "Envoy" },
                                ] as const
                              }
                            >
                              {(item) => (
                                <button
                                  type="button"
                                  onClick={() => setWafSnippetKey(item.id)}
                                  class={`py-1 px-2.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                                    wafSnippetKey() === item.id
                                      ? "bg-white text-blue-600 shadow-2xs dark:bg-neutral-900 dark:text-blue-400"
                                      : "text-gray-600 dark:text-neutral-400"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              )}
                            </For>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard("waf", shield().snippets[wafSnippetKey()])
                            }
                            class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 cursor-pointer transition-colors"
                          >
                            {copiedKey() === "waf" ? "Copied Snippet!" : "Copy WAF Rule"}
                          </button>
                        </div>
                        <pre class="rounded-xl border border-gray-200 dark:border-neutral-800 bg-neutral-950 text-neutral-100 font-mono text-xs p-4 overflow-x-auto">
                          {shield().snippets[wafSnippetKey()]}
                        </pre>
                      </div>
                    </>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* 2. Automation & SDK View */}
        <Show when={currentTab() === "automation-sdk"}>
          <AegisLifecyclePanel
            mode="automation-sdk"
            project={props.project}
            onProjectUpdate={props.onProjectUpdate}
            onTestReverseProxyAttack={props.onTestAttack}
            lastAttackResult={props.attackResult}
          />
        </Show>

        {/* 3. Safe Delivery & Rollback View */}
        <Show when={currentTab() === "safe-delivery"}>
          <AegisLifecyclePanel
            mode="safe-delivery"
            project={props.project}
            onProjectUpdate={props.onProjectUpdate}
            onTestReverseProxyAttack={props.onTestAttack}
            lastAttackResult={props.attackResult}
          />
        </Show>

        {/* 4. Verification Sandbox & Live Exploit Replay Lab */}
        <Show when={currentTab() === "verification"}>
          <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
            <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                  Verification Sandbox & Live Exploit Replay Lab
                </h3>
                <p class="text-xs text-gray-500 dark:text-neutral-400">
                  Replay PoC exploit payloads against the sandboxed target and verify 4-stage
                  Red-to-Green defense proof
                </p>
              </div>
              <Show when={props.project.routeShield}>
                {(shield) => (
                  <button
                    type="button"
                    data-testid="toggle-shield-btn"
                    onClick={() => props.onToggleShield(!shield().enabled)}
                    class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                      shield().enabled
                        ? "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-800/30 dark:text-teal-400 dark:border-teal-800"
                        : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-800/30 dark:text-amber-400 dark:border-amber-800"
                    }`}
                  >
                    {shield().enabled
                      ? "Edge Shield: ENABLED (Click to Disable)"
                      : "Edge Shield: DISABLED (Click to Enable)"}
                  </button>
                )}
              </Show>
            </div>

            <div class="p-4 md:p-5 space-y-4">
              <div class="space-y-2">
                <label
                  for="exploit-payload-input"
                  class="block text-xs font-semibold text-gray-700 dark:text-neutral-300"
                >
                  HTTP / Binary Exploit Replay Payload
                </label>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input
                    id="exploit-payload-input"
                    type="text"
                    value={props.attackPayload}
                    onInput={(e) => props.setAttackPayload(e.currentTarget.value)}
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-xs font-mono focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                  />
                  <button
                    type="button"
                    data-testid="test-attack-btn"
                    onClick={() => props.onTestAttack()}
                    class="py-2 px-4 inline-flex items-center justify-center gap-x-2 text-xs font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors shrink-0"
                  >
                    Replay Exploit Payload
                  </button>
                </div>
              </div>

              <Show when={props.attackResult}>
                {(result) => (
                  <div
                    data-testid="attack-verdict-banner"
                    class={`rounded-xl border p-4 text-xs space-y-1.5 ${
                      result().verdict === "BLOCKED_GREEN"
                        ? "border-teal-200 bg-teal-50/90 text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200"
                        : "border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                    }`}
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2 font-bold">
                      <span>
                        {result().verdict === "BLOCKED_GREEN"
                          ? `BLOCKED_GREEN (HTTP ${result().httpStatus}) — Exploit Neutralized at Edge`
                          : `EXPLOITED_RED (HTTP ${result().httpStatus}) — Target Vulnerable`}
                      </span>
                      <span class="font-mono">
                        Latency: {result().latencyMs}ms
                        {result().ruleTriggered ? ` · Rule: ${result().ruleTriggered}` : ""}
                      </span>
                    </div>
                    <pre class="font-mono text-[11px] whitespace-pre-wrap opacity-90">
                      {result().responseBody}
                    </pre>
                  </div>
                )}
              </Show>

              {/* 4-Stage Red-to-Green Sandbox Execution Logs */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <For each={props.liveSteps}>
                  {(step, idx) => (
                    <div class="rounded-xl border border-gray-200 dark:border-neutral-800 p-3.5 bg-gray-50/60 dark:bg-neutral-950 space-y-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-bold text-gray-900 dark:text-white">
                          Stage {idx() + 1} · {step.title}
                        </span>
                        <span
                          class={`inline-flex items-center py-0.5 px-2 rounded-full text-[11px] font-semibold ${
                            step.status === "passed_green"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400"
                              : step.status === "confirmed_red"
                                ? "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400"
                          }`}
                        >
                          {step.status} · {step.durationMs}ms
                        </span>
                      </div>
                      <p class="text-xs text-gray-600 dark:text-neutral-400">{step.summary}</p>
                      <pre class="text-[11px] font-mono text-gray-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-lg p-2.5 whitespace-pre-wrap">
                        {step.commandOrLog}
                      </pre>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
