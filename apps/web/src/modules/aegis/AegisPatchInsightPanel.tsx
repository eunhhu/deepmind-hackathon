import type {
  AegisCreatePrResponse,
  AegisProject,
  AegisShieldTestAttackResponse,
  AegisTimelineStep,
} from "@deepmind/shared";
import { createEffect, createSignal, For, Show } from "solid-js";
import {
  createAegisGitHubPr,
  getAegisBinaryDownloadUrl,
  getAegisPatchDownloadUrl,
} from "../../core/api/client";
import {
  PrelineAlert,
  PrelineBadge,
  PrelineButton,
  PrelineCard,
  PrelineInput,
} from "../../core/ui/preline";

export function AegisPatchInsightPanel(props: {
  project: AegisProject;
  liveSteps: AegisTimelineStep[];
  expanded: boolean;
  onExpand: () => void;
  attackPayload: string;
  setAttackPayload: (val: string) => void;
  attackResult: AegisShieldTestAttackResponse | null;
  onToggleShield: (enabled: boolean) => Promise<void>;
  onTestAttack: () => Promise<void>;
  onProjectUpdate: (project: AegisProject) => void;
}) {
  const defaultTab = () => {
    const mode = props.project.remediationMode;
    if (mode === "binary-patch") return "binary" as const;
    if (mode === "route-shield") return "shield" as const;
    return "git" as const;
  };

  const [activeTab, setActiveTab] = createSignal<"git" | "binary" | "shield" | "verification">(
    defaultTab(),
  );
  const [diffViewMode, setDiffViewMode] = createSignal<"split" | "unified">("split");
  const [creatingPr, setCreatingPr] = createSignal(false);
  const [prResult, setPrResult] = createSignal<AegisCreatePrResponse | null>(null);
  const [activeSnippet, setActiveSnippet] = createSignal<
    "cloudRunGin" | "cloudArmor" | "cloudflareWorker" | "nginx" | "envoy"
  >("cloudRunGin");

  let lastProjectId = "";
  createEffect(() => {
    const id = props.project.id;
    const mode = props.project.remediationMode;
    if (id !== lastProjectId) {
      lastProjectId = id;
      setPrResult(null);
      setDiffViewMode("split");
      if (mode === "binary-patch") setActiveTab("binary");
      else if (mode === "route-shield") setActiveTab("shield");
      else setActiveTab("git");
    }
  });

  function selectTab(tab: "git" | "binary" | "shield" | "verification") {
    setActiveTab(tab);
    props.onExpand();
  }

  async function handleCreatePr() {
    setCreatingPr(true);
    try {
      const res = await createAegisGitHubPr(props.project.id);
      props.onProjectUpdate(res.project);
      setPrResult(res);
    } finally {
      setCreatingPr(false);
    }
  }

  const timelineSteps = () =>
    props.liveSteps.length > 0 ? props.liveSteps : props.project.timeline;

  return (
    <div class="space-y-6">
      {/* Segmented Remediation Mode Bar (DESIGN.md 40px Pill Filter Chips) */}
      <div class="bg-[#F8F9FA] dark:bg-[#212329]/60 border border-[#EAECF0] dark:border-[#252830] rounded-[16px] p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8]">
            Remediation &amp; Runtime Defense
          </span>
          <h3 class="text-[20px] leading-[28px] font-semibold tracking-[-0.015em] text-[#111827] dark:text-[#F3F4F6] mt-0.5">
            Verified Patch Artifacts &amp; Virtual WAF Shielding
          </h3>
        </div>

        <div
          class="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Remediation Artifact Mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={props.expanded && activeTab() === "git"}
            data-testid="remediation-tab-git-pr"
            onClick={() => selectTab("git")}
            class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
              props.expanded && activeTab() === "git"
                ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
            }`}
          >
            Source Patch &amp; PR
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.expanded && activeTab() === "binary"}
            data-testid="remediation-tab-binary-patch"
            onClick={() => selectTab("binary")}
            class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
              props.expanded && activeTab() === "binary"
                ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
            }`}
          >
            ELF64 Binary Patch
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.expanded && activeTab() === "shield"}
            data-testid="remediation-tab-route-shield"
            onClick={() => selectTab("shield")}
            class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
              props.expanded && activeTab() === "shield"
                ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
            }`}
          >
            Edge Route Shield
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.expanded && activeTab() === "verification"}
            data-testid="remediation-tab-verification-ops"
            onClick={() => selectTab("verification")}
            class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              props.expanded && activeTab() === "verification"
                ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
            }`}
          >
            <span>Verification Sandbox</span>
          </button>
        </div>
      </div>

      {/* Focused Remediation Detail View (Only ONE active panel rendered when expanded) */}
      <Show when={props.expanded}>
        {/* Mode 1: Source Patch & GitHub Pull Request */}
        <Show when={activeTab() === "git"}>
          <Show
            when={props.project.gitPrReport}
            fallback={
              <PrelineAlert variant="amber" title="Source Repository Not Attached">
                This target uses no-source binary or live URL intake. Switch to{" "}
                <strong>ELF64 Binary Patch</strong> or <strong>Edge Route Shield</strong> to inspect
                active defenses.
              </PrelineAlert>
            }
          >
            {(pr) => (
              <PrelineCard
                title={pr().prTitle}
                subtitle={`Branch: ${pr().branchName} • Commit: ${pr().commitSha} • Target File: ${pr().codeDiff.filePath}`}
                headerRight={
                  <div class="flex flex-wrap items-center gap-2">
                    <PrelineBadge variant={pr().ciChecksPassed ? "emerald" : "amber"} dot>
                      {pr().status === "draft"
                        ? "Verified & Ready for PR"
                        : `PR #${pr().prNumber} Opened`}
                    </PrelineBadge>
                    <a
                      href={getAegisPatchDownloadUrl(props.project.id)}
                      download={`${props.project.id}.patch`}
                      data-testid="download-patch-link"
                      class="h-10 px-4 inline-flex items-center gap-2 text-[14px] leading-[20px] font-semibold rounded-[12px] border border-[#DFE3E8] bg-white text-[#111827] hover:bg-[#F8F9FA] dark:bg-[#17181C] dark:border-[#2E323C] dark:text-[#F3F4F6] transition-all"
                    >
                      Download .patch
                    </a>
                    <PrelineButton
                      variant="primary"
                      size="sm"
                      data-testid="create-pr-btn"
                      disabled={creatingPr()}
                      onClick={handleCreatePr}
                    >
                      {creatingPr()
                        ? "Opening PR..."
                        : pr().status === "open"
                          ? `Update PR #${pr().prNumber}`
                          : "Create Pull Request"}
                    </PrelineButton>
                  </div>
                }
              >
                <div class="space-y-5">
                  <Show when={prResult()}>
                    {(created) => (
                      <div
                        data-testid="pr-created-banner"
                        class="rounded-[12px] p-4 bg-[#DCFCE7] border border-[#15803D]/25 text-[14px] leading-[20px] text-[#15803D] dark:bg-[#053C01] dark:border-[#B0F4B2]/25 dark:text-[#B0F4B2] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span class="font-semibold">
                            GitHub Pull Request #{created().prNumber} Created:
                          </span>{" "}
                          <span>{created().prTitle}</span>
                        </div>
                        <span class="font-mono text-[13px] underline">{created().prUrl}</span>
                      </div>
                    )}
                  </Show>

                  <div class="bg-[#F2F4F7] dark:bg-[#212329] rounded-[12px] p-4 border border-[#EAECF0] dark:border-[#252830] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                        Minimal-Diff Remediation Summary
                      </h4>
                      <p class="text-[14px] leading-[22px] text-[#111827] dark:text-[#F3F4F6]">
                        {pr().codeDiff.explanation}
                      </p>
                    </div>

                    {/* Segmented Diff Mode Switcher */}
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDiffViewMode("split")}
                        class={`h-8 px-3 rounded-full text-[13px] leading-[20px] font-semibold transition-all cursor-pointer ${
                          diffViewMode() === "split"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Side-by-Side Diff
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiffViewMode("unified")}
                        class={`h-8 px-3 rounded-full text-[13px] leading-[20px] font-semibold transition-all cursor-pointer ${
                          diffViewMode() === "unified"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Unified .patch
                      </button>
                    </div>
                  </div>

                  {/* Before vs After Code Comparison */}
                  <Show when={diffViewMode() === "split"}>
                    <div
                      data-testid="code-diff-viewer"
                      class="grid grid-cols-1 lg:grid-cols-2 gap-4"
                    >
                      <div class="rounded-[12px] border border-[#B91C1C]/25 bg-[#FEE2E2]/35 dark:bg-[#7F1D1D]/20 dark:border-[#FECACA]/20 overflow-hidden">
                        <div class="px-4 py-2.5 bg-[#FEE2E2] dark:bg-[#7F1D1D]/50 border-b border-[#B91C1C]/20 flex items-center justify-between">
                          <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#B91C1C] dark:text-[#FECACA]">
                            Vulnerable Source (Before)
                          </span>
                          <span class="font-mono text-[13px] text-[#B91C1C] dark:text-[#FECACA]">
                            {pr().codeDiff.filePath}
                          </span>
                        </div>
                        <pre class="p-4 text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] overflow-x-auto whitespace-pre-wrap">
                          {pr().codeDiff.beforeCode}
                        </pre>
                      </div>

                      <div class="rounded-[12px] border border-[#15803D]/25 bg-[#DCFCE7]/35 dark:bg-[#053C01]/25 dark:border-[#B0F4B2]/20 overflow-hidden">
                        <div class="px-4 py-2.5 bg-[#DCFCE7] dark:bg-[#053C01]/60 border-b border-[#15803D]/20 flex items-center justify-between">
                          <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#15803D] dark:text-[#B0F4B2]">
                            Verified Remediation (After)
                          </span>
                          <span class="font-mono text-[13px] text-[#15803D] dark:text-[#B0F4B2]">
                            AST Minimal Diff
                          </span>
                        </div>
                        <pre class="p-4 text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] overflow-x-auto whitespace-pre-wrap">
                          {pr().codeDiff.afterCode}
                        </pre>
                      </div>
                    </div>
                  </Show>

                  {/* Unified Git Patch */}
                  <Show when={diffViewMode() === "unified"}>
                    <div
                      data-testid="code-diff-viewer"
                      class="rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] overflow-hidden"
                    >
                      <div class="px-4 py-2.5 border-b border-[#EAECF0] dark:border-[#252830] flex items-center justify-between">
                        <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF]">
                          Unified Git Diff Patch
                        </span>
                        <span class="font-mono text-[13px] text-[#15803D] dark:text-[#B0F4B2]">
                          git apply ready
                        </span>
                      </div>
                      <pre class="p-4 text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] overflow-x-auto whitespace-pre">
                        {pr().codeDiff.unifiedDiff}
                      </pre>
                    </div>
                  </Show>
                </div>
              </PrelineCard>
            )}
          </Show>
        </Show>

        {/* Mode 2: ELF64 Binary Disassembly & Byte-Level Hot Patch */}
        <Show when={activeTab() === "binary"}>
          <Show
            when={props.project.binaryAnalysis}
            fallback={
              <PrelineAlert variant="amber" title="No ELF/PE Binary Artifact Attached">
                Select a no-source binary target or upload an ELF64 executable to inspect
                instruction-level hot-patching.
              </PrelineAlert>
            }
          >
            {(bin) => (
              <PrelineCard
                title={`Binary Patch Artifact: ${bin().fileName} (${bin().architecture})`}
                subtitle={`Size: ${(bin().sizeBytes / 1024).toFixed(1)} KB • Sinks Neutralized: ${bin().dangerousSinks.join(", ")}`}
                headerRight={
                  <a
                    href={getAegisBinaryDownloadUrl(props.project.id)}
                    download={`patched-${bin().fileName}`}
                    data-testid="download-binary-link"
                    class="h-10 px-4 inline-flex items-center gap-2 text-[14px] leading-[20px] font-semibold rounded-[12px] bg-[#4F46E5] text-white hover:bg-[#4338CA] dark:bg-[#818CF8] dark:text-[#111214] transition-all"
                  >
                    Download Patched ELF64 Binary
                  </a>
                }
              >
                <div class="space-y-6">
                  {/* Protection Flags & SHA256 Digest Comparison */}
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="p-4 rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] space-y-2">
                      <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF]">
                        ELF Security Flags
                      </span>
                      <div class="flex flex-wrap gap-2">
                        <PrelineBadge variant={bin().protections.nx ? "emerald" : "red"}>
                          NX: {bin().protections.nx ? "ENABLED" : "DISABLED"}
                        </PrelineBadge>
                        <PrelineBadge variant={bin().protections.pie ? "emerald" : "amber"}>
                          PIE: {bin().protections.pie ? "ENABLED" : "DISABLED"}
                        </PrelineBadge>
                        <PrelineBadge variant={bin().protections.stackCanary ? "emerald" : "red"}>
                          Canary: {bin().protections.stackCanary ? "PRESENT" : "MISSING"}
                        </PrelineBadge>
                        <PrelineBadge variant="blue">
                          RELRO: {bin().protections.relro.toUpperCase()}
                        </PrelineBadge>
                      </div>
                    </div>

                    <div class="p-4 rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] font-mono text-[13px] leading-[20px] space-y-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[#B91C1C] dark:text-[#FECACA] font-semibold">
                          SHA256 Before:
                        </span>
                        <span class="text-[#4B5563] dark:text-[#9CA3AF] truncate max-w-[260px]">
                          {bin().sha256Before}
                        </span>
                      </div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[#15803D] dark:text-[#B0F4B2] font-semibold">
                          SHA256 After:
                        </span>
                        <span class="text-[#111827] dark:text-[#F3F4F6] truncate max-w-[260px]">
                          {bin().sha256After}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Byte-Level Disassembly Patch Table */}
                  <div
                    data-testid="binary-patch-table"
                    class="overflow-x-auto border border-[#EAECF0] dark:border-[#252830] rounded-[12px]"
                  >
                    <table class="min-w-full divide-y divide-[#EAECF0] dark:divide-[#252830] text-[13px] leading-[20px]">
                      <thead class="bg-[#F2F4F7] dark:bg-[#212329]">
                        <tr>
                          <th class="px-4 py-3 text-left font-semibold text-[#111827] dark:text-[#F3F4F6]">
                            Offset
                          </th>
                          <th class="px-4 py-3 text-left font-semibold text-[#B91C1C] dark:text-[#FECACA]">
                            Original Instruction / Bytes
                          </th>
                          <th class="px-4 py-3 text-left font-semibold text-[#15803D] dark:text-[#B0F4B2]">
                            Patched Instruction / Bytes
                          </th>
                          <th class="px-4 py-3 text-left font-semibold text-[#111827] dark:text-[#F3F4F6]">
                            Engineering Rationale
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-[#EAECF0] dark:divide-[#252830] bg-white dark:bg-[#17181C]">
                        <For each={bin().patchInstructions}>
                          {(inst) => (
                            <tr>
                              <td class="px-4 py-3 font-mono font-semibold text-[#4F46E5] dark:text-[#818CF8]">
                                {inst.offsetHex}
                              </td>
                              <td class="px-4 py-3 font-mono text-[#B91C1C] dark:text-[#FECACA]">
                                <div>{inst.beforeAsm}</div>
                                <div class="text-[12px] opacity-75">[{inst.beforeBytesHex}]</div>
                              </td>
                              <td class="px-4 py-3 font-mono text-[#15803D] dark:text-[#B0F4B2]">
                                <div>{inst.afterAsm}</div>
                                <div class="text-[12px] opacity-75">[{inst.afterBytesHex}]</div>
                              </td>
                              <td class="px-4 py-3 text-[#4B5563] dark:text-[#9CA3AF]">
                                {inst.rationale}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </PrelineCard>
            )}
          </Show>
        </Show>

        {/* Mode 3: Edge Route Shield / Virtual WAF */}
        <Show when={activeTab() === "shield"}>
          <Show
            when={props.project.routeShield}
            fallback={
              <PrelineAlert variant="amber" title="No Route Shield Configured">
                Run a security scan on a URL endpoint to synthesize edge WAF rules and reverse-proxy
                snippets.
              </PrelineAlert>
            }
          >
            {(shield) => (
              <PrelineCard
                title={`Virtual Patch Route Shield (${shield().ruleId})`}
                subtitle={`Protected Path: ${shield().protectedPath} • Blocked Attacks: ${shield().blockedRequestsCount}`}
                headerRight={
                  <div class="flex items-center gap-2">
                    <PrelineBadge
                      variant={shield().enabled ? "emerald" : "red"}
                      dot
                      pulse={shield().enabled}
                    >
                      {shield().enabled ? "SHIELD ACTIVE (403 BLOCK)" : "SHIELD BYPASSED"}
                    </PrelineBadge>
                    <PrelineButton
                      variant={shield().enabled ? "danger" : "primary"}
                      size="sm"
                      data-testid="toggle-shield-btn"
                      onClick={() => props.onToggleShield(!shield().enabled)}
                    >
                      {shield().enabled ? "Disable Route Shield" : "Enable Route Shield"}
                    </PrelineButton>
                  </div>
                }
              >
                <div class="space-y-6">
                  <div class="p-4 rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF] block">
                        Active Block Pattern (Regex)
                      </span>
                      <code class="text-[13px] leading-[20px] font-mono text-[#4F46E5] dark:text-[#818CF8] break-all">
                        {shield().blockPatternRegex}
                      </code>
                    </div>
                    <PrelineBadge variant="blue">
                      Rate Limit: {shield().rateLimitRps} RPS
                    </PrelineBadge>
                  </div>

                  {/* Multi-Target Edge Snippet Exporter */}
                  <div>
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF]">
                        Exportable Hot-Reload WAF Rules
                      </span>
                      <div class="flex flex-wrap gap-1.5">
                        {(
                          [
                            ["cloudRunGin", "Cloud Run / Gin"],
                            ["cloudArmor", "GCP Cloud Armor"],
                            ["cloudflareWorker", "Cloudflare Worker"],
                            ["nginx", "NGINX"],
                            ["envoy", "Envoy Proxy"],
                          ] as const
                        ).map(([key, label]) => (
                          <button
                            type="button"
                            onClick={() => setActiveSnippet(key)}
                            class={`h-8 px-3 rounded-full text-[13px] leading-[20px] font-semibold transition-all cursor-pointer ${
                              activeSnippet() === key
                                ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                                : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <pre class="p-4 rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] overflow-x-auto whitespace-pre">
                      {shield().snippets[activeSnippet()]}
                    </pre>
                  </div>
                </div>
              </PrelineCard>
            )}
          </Show>
        </Show>

        {/* Mode 4: Dedicated Verification Sandbox & Live Exploit Lab Tab */}
        <Show when={activeTab() === "verification"}>
          <PrelineCard
            title="Verification Sandbox & Live Exploit Replay Lab"
            subtitle="4-Stage Red-to-Green Deterministic Sandbox Execution Logs & Live Attack Replay"
            headerRight={
              <Show when={props.project.routeShield}>
                {(shield) => (
                  <div class="flex items-center gap-2">
                    <PrelineBadge variant={shield().enabled ? "emerald" : "red"} dot>
                      {shield().enabled ? "SHIELD ON" : "SHIELD OFF"}
                    </PrelineBadge>
                    <PrelineButton
                      variant="secondary"
                      size="sm"
                      data-testid="toggle-shield-btn"
                      onClick={() => props.onToggleShield(!shield().enabled)}
                    >
                      {shield().enabled ? "Disable Route Shield" : "Enable Route Shield"}
                    </PrelineButton>
                  </div>
                )}
              </Show>
            }
          >
            <div class="space-y-6">
              {/* Live Exploit Payload Tester */}
              <Show when={props.project.routeShield}>
                <div class="p-5 rounded-[16px] bg-[#F8F9FA] dark:bg-[#212329]/60 border border-[#EAECF0] dark:border-[#252830] space-y-4">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 class="text-[16px] leading-[24px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                        Live Exploit Payload Replay Tester
                      </h4>
                      <p class="text-[13px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF]">
                        Dispatch a real exploit payload against the protected proxy endpoint to
                        verify deterministic 403 blocking.
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div class="flex-1">
                      <PrelineInput
                        label="Exploit Request Payload"
                        value={props.attackPayload}
                        onInput={(e) => props.setAttackPayload(e.currentTarget.value)}
                        placeholder='{"url":"http://169.254.169.254/latest/meta-data/iam/"}'
                        class="font-mono text-[13px]"
                      />
                    </div>
                    <PrelineButton
                      variant="primary"
                      size="sm"
                      data-testid="test-attack-btn"
                      onClick={() => props.onTestAttack()}
                    >
                      Fire Live Exploit Payload
                    </PrelineButton>
                  </div>

                  <Show when={props.attackResult}>
                    {(res) => (
                      <div
                        data-testid="attack-verdict-banner"
                        class={`p-4 rounded-[12px] border text-[13px] leading-[20px] font-mono ${
                          res().verdict === "BLOCKED_GREEN"
                            ? "bg-[#DCFCE7] border-[#15803D]/25 text-[#15803D] dark:bg-[#053C01] dark:border-[#B0F4B2]/25 dark:text-[#B0F4B2]"
                            : "bg-[#FEE2E2] border-[#B91C1C]/25 text-[#B91C1C] dark:bg-[#7F1D1D] dark:border-[#FECACA]/25 dark:text-[#FECACA]"
                        }`}
                      >
                        <div class="flex items-center justify-between font-bold mb-1">
                          <span>
                            Verdict: {res().verdict} (HTTP {res().httpStatus})
                          </span>
                          <span class="tabular-nums">{res().latencyMs} ms</span>
                        </div>
                        <div class="opacity-90 break-all">{res().responseBody}</div>
                      </div>
                    )}
                  </Show>
                </div>
              </Show>

              {/* 4-Stage Red-to-Green Sandbox Execution Logs */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <For each={timelineSteps()}>
                  {(step, idx) => (
                    <div class="p-4 rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[13px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                          Stage {idx() + 1}: {step.title}
                        </span>
                        <PrelineBadge
                          variant={
                            step.status === "passed_green"
                              ? "emerald"
                              : step.status === "confirmed_red"
                                ? "red"
                                : "blue"
                          }
                        >
                          {step.status.toUpperCase()} ({step.durationMs}ms)
                        </PrelineBadge>
                      </div>
                      <p class="text-[13px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF]">
                        {step.summary}
                      </p>
                      <pre class="p-3 rounded-[8px] bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] overflow-x-auto whitespace-pre-wrap">
                        {step.commandOrLog}
                      </pre>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </PrelineCard>
        </Show>
      </Show>
    </div>
  );
}
