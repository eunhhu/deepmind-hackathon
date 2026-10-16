import type {
  AegisIntakeMode,
  AegisProject,
  AegisRemediationMode,
  AegisShieldTestAttackResponse,
  AegisTimelineStep,
  AegisVerifyDnsResponse,
} from "@deepmind/shared";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import {
  buildAuthHeaders,
  resetAegisProjects,
  streamAegisPipeline,
  uploadAegisBinary,
} from "../../core/api/client";
import { aegisProductSection, setAegisProductSection } from "../../core/auth/AuthBar";
import {
  PrelineAlert,
  PrelineBadge,
  PrelineButton,
  PrelineCard,
  PrelineInput,
} from "../../core/ui/preline";
import { AegisPatchInsightPanel } from "./AegisPatchInsightPanel";

async function aegisFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...buildAuthHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AEGIS API error (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export function AegisModule(props: { viewMode?: "product" | "ops" } = {}) {
  const isOpsMode = () => props.viewMode === "ops";
  const [projects, setProjects] = createSignal<AegisProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);
  const [scanning, setScanning] = createSignal(false);
  const [verifyingDns, setVerifyingDns] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);

  // New Project Onboarding Modal State
  const [showNewForm, setShowNewForm] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newMode, setNewMode] = createSignal<AegisIntakeMode>("url-dns");
  const [newRepoUrl, setNewRepoUrl] = createSignal("https://github.com/acme-corp/checkout-api");
  const [newTargetUrl, setNewTargetUrl] = createSignal(
    "https://pay.staging.acme-cloud.io/api/v1/webhooks/preview",
  );
  const [newBinaryName, setNewBinaryName] = createSignal("edge-telemetry-gateway.elf");

  // Live Exploit Payload Tester State
  const [attackPayload, setAttackPayload] = createSignal(
    '{"previewUrl":"http://169.254.169.254/latest/meta-data/iam/security-credentials/prod-admin-role"}',
  );
  const [attackResult, setAttackResult] = createSignal<AegisShieldTestAttackResponse | null>(null);

  // Live SSE Timeline Stream State
  const [liveSteps, setLiveSteps] = createSignal<AegisTimelineStep[]>([]);
  const [uploadingBinary, setUploadingBinary] = createSignal(false);

  // Selected Finding Accordion State (progressive disclosure)
  const [expandedFindingId, setExpandedFindingId] = createSignal<string | null>(null);

  const selectedProject = createMemo(() => projects().find((p) => p.id === selectedProjectId()));

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const res = await aegisFetch<{
        backendMode: string;
        projects: AegisProject[];
      }>("/api/modules/aegis/projects");
      setProjects(res.projects ?? []);
      if (!selectedProjectId() && res.projects && res.projects.length > 0) {
        setSelectedProjectId(res.projects[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AEGIS-4 projects");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void loadProjects();
  });

  function updateProjectInList(updated: AegisProject) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProjectId(updated.id);
  }

  async function handleResetDemoProjects() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await resetAegisProjects();
      setProjects(res.projects ?? []);
      if (res.projects && res.projects.length > 0) {
        setSelectedProjectId(res.projects[0].id);
      }
      setNotice("Demo targets restored to clean baseline (3 flagship targets).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset demo projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: Event) {
    e.preventDefault();
    if (!newName().trim()) return;
    setError(null);
    setNotice(null);
    try {
      const res = await aegisFetch<{ project: AegisProject }>("/api/modules/aegis/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newName().trim(),
          intakeMode: newMode(),
          repoUrl: newMode() === "github" ? newRepoUrl().trim() : undefined,
          targetUrl: newMode() === "url-dns" ? newTargetUrl().trim() : undefined,
          binaryFileName: newMode() === "binary" ? newBinaryName().trim() : undefined,
        }),
      });
      setProjects((prev) => [res.project, ...prev]);
      setSelectedProjectId(res.project.id);
      setAegisProductSection("projects");
      setNewName("");
      setShowNewForm(false);
      setNotice(
        res.project.intakeMode === "url-dns"
          ? `Created URL target "${res.project.name}". Verify DNS TXT record (${res.project.dnsTxtRecordName}) before active fuzzing.`
          : `Created security target "${res.project.name}". Ready for Red-to-Green verification.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create target project");
    }
  }

  async function handleVerifyDns(projectId: string) {
    setVerifyingDns(true);
    setError(null);
    setNotice(null);
    try {
      const res = await aegisFetch<AegisVerifyDnsResponse>(
        `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/verify-dns`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            simulateTxtPropagation: true,
          }),
        },
      );
      updateProjectInList(res.project);
      setNotice(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DNS TXT verification failed");
    } finally {
      setVerifyingDns(false);
    }
  }

  async function handleRunScan(projectId: string, remediationMode?: AegisRemediationMode) {
    setScanning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await aegisFetch<{
        project: AegisProject;
        interactionIds: string[];
        totalDurationMs: number;
      }>(`/api/modules/aegis/projects/${encodeURIComponent(projectId)}/scan`, {
        method: "POST",
        body: JSON.stringify({
          projectId,
          remediationMode,
          dryRun: false,
        }),
      });
      updateProjectInList(res.project);
      setNotice(
        `Completed deterministic security scan for ${res.project.name} in ${res.totalDurationMs} ms.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleStreamScan(projectId: string, remediationMode?: AegisRemediationMode) {
    setScanning(true);
    setError(null);
    setNotice(null);
    setLiveSteps([]);
    try {
      await streamAegisPipeline(projectId, remediationMode, false, (evt) => {
        if (evt.step) {
          const step = evt.step;
          setLiveSteps((prev) => [...prev, step]);
        }
        if (evt.type === "scan_complete" && evt.project) {
          updateProjectInList(evt.project);
          setLiveSteps([]);
          setNotice(
            `4-stage Red-to-Green autonomous verification completed in ${evt.totalDurationMs ?? 0} ms.`,
          );
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live SSE scan stream failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleBinaryFileSelect(projectId: string, file: File) {
    setUploadingBinary(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 65536));
      let binaryStr = "";
      for (const b of bytes) {
        binaryStr += String.fromCharCode(b);
      }
      const base64Data = btoa(binaryStr);
      const updated = await uploadAegisBinary(projectId, {
        fileName: file.name,
        base64Data,
      });
      updateProjectInList(updated);
      setNotice(
        `Uploaded binary "${file.name}" (${file.size} bytes) & generated byte-level hot-patch.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Binary upload failed");
    } finally {
      setUploadingBinary(false);
    }
  }

  async function handleToggleShield(projectId: string, enabled: boolean) {
    setError(null);
    try {
      const res = await aegisFetch<{ project: AegisProject }>(
        `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/shield-toggle`,
        {
          method: "POST",
          body: JSON.stringify({ enabled }),
        },
      );
      updateProjectInList(res.project);
      if (enabled) {
        setAttackResult(null);
      }
      setNotice(
        enabled
          ? "Route Shield virtual patch ENABLED — exploit payloads are now blocked at the edge."
          : "Route Shield virtual patch DISABLED — target route is exposed to raw requests.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle Route Shield");
    }
  }

  async function handleTestAttack(projectId: string) {
    setError(null);
    try {
      const res = await aegisFetch<AegisShieldTestAttackResponse>(
        `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/test-attack`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            attackPayload: attackPayload(),
          }),
        },
      );
      setAttackResult(res);
      updateProjectInList(res.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live attack test failed");
    }
  }

  function defenseBadgeVariant(status: AegisProject["defenseStatus"]) {
    switch (status) {
      case "patched_via_pr":
      case "protected_via_route_shield":
      case "binary_hard_patched":
        return "emerald" as const;
      case "poc_confirmed_red":
        return "red" as const;
      default:
        return "amber" as const;
    }
  }

  function defenseBadgeLabel(status: AegisProject["defenseStatus"]) {
    switch (status) {
      case "patched_via_pr":
        return "VERIFIED GREEN • PR READY";
      case "protected_via_route_shield":
        return "VERIFIED GREEN • SHIELD ON";
      case "binary_hard_patched":
        return "VERIFIED GREEN • ELF PATCHED";
      case "poc_confirmed_red":
        return "EXPLOITABLE RED";
      default:
        return "PENDING VERIFICATION";
    }
  }

  function intakeBadgeLabel(mode: AegisIntakeMode) {
    switch (mode) {
      case "github":
        return "GitHub Repository";
      case "url-dns":
        return "Live URL + DNS Gate";
      case "binary":
        return "No-Source ELF64 Binary";
    }
  }

  return (
    <div class="w-full">
      {/* Dedicated Ops & Engine Console Verification View */}
      <Show when={isOpsMode()}>
        <div class="space-y-6">
          <PrelineCard
            title="4-Stage Red-to-Green Formal Sandbox Verification Matrix"
            subtitle="Deterministic PoC reproduction, patch synthesis, and zero-regression execution telemetry"
            headerRight={
              <div class="flex flex-wrap items-center gap-2">
                <For each={projects()}>
                  {(p) => (
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(p.id)}
                      class={`h-10 px-4 rounded-full text-[13px] leading-[20px] font-semibold transition-all cursor-pointer ${
                        selectedProjectId() === p.id
                          ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                          : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                      }`}
                    >
                      {p.name}
                    </button>
                  )}
                </For>
              </div>
            }
          >
            <Show when={selectedProject()}>
              {(proj) => (
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <For each={liveSteps().length > 0 ? liveSteps() : proj().timeline}>
                    {(step, idx) => (
                      <div class="p-4 rounded-[16px] border border-[#EAECF0] dark:border-[#252830] bg-[#F2F4F7] dark:bg-[#212329] flex flex-col justify-between gap-3">
                        <div>
                          <div class="flex items-center justify-between gap-2 mb-2">
                            <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF]">
                              Stage {idx() + 1}
                            </span>
                            <PrelineBadge
                              variant={
                                step.status === "passed_green"
                                  ? "emerald"
                                  : step.status === "confirmed_red"
                                    ? "red"
                                    : "blue"
                              }
                              dot
                            >
                              {step.status.toUpperCase()}
                            </PrelineBadge>
                          </div>
                          <h4 class="text-[16px] leading-[24px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                            {step.title}
                          </h4>
                          <p class="text-[13px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF] mt-1">
                            {step.summary}
                          </p>
                        </div>

                        <div class="space-y-2">
                          <div class="flex items-center justify-between text-[12px] font-mono text-[#6B7280] dark:text-[#6E7686] tabular-nums">
                            <span>{step.modelUsed}</span>
                            <span>{step.durationMs} ms</span>
                          </div>
                          <pre class="p-3 rounded-[8px] bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] text-[13px] leading-[20px] text-[#111827] dark:text-[#F3F4F6] font-mono overflow-x-auto whitespace-pre-wrap">
                            {step.commandOrLog}
                          </pre>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </Show>
          </PrelineCard>
        </div>
      </Show>

      {/* Product Mode: DESIGN.md Desktop App Shell (390px-400px Left Sidebar + 48px Reader Canvas) */}
      <Show when={!isOpsMode()}>
        <div class="min-h-[calc(100vh-120px)] flex flex-col lg:flex-row items-stretch">
          {/* Left Configuration Sidebar (390px-400px fixed desktop width, 24px internal padding, 20px vertical section gap) */}
          <aside
            aria-label="Monitored Security Targets"
            class="w-full lg:w-[390px] xl:w-[400px] shrink-0 bg-white dark:bg-[#17181C] border-b lg:border-b-0 lg:border-r border-[#EAECF0] dark:border-[#252830] p-6 space-y-5 flex flex-col justify-between"
          >
            <div class="space-y-5">
              {/* Sidebar Header: ONE primary CTA (#4F46E5) */}
              <div class="flex items-center justify-between gap-3">
                <div>
                  <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8]">
                    Target Inventory
                  </span>
                  <h2 class="text-[18px] leading-[28px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                    Protected Assets ({projects().length})
                  </h2>
                </div>
                <PrelineButton
                  variant="primary"
                  size="sm"
                  data-testid="toggle-new-project-btn"
                  onClick={() => setShowNewForm(true)}
                >
                  + New Target
                </PrelineButton>
              </div>

              {/* Target List Cards (12px vertical gap, 16px radius, 24px horizontal / 20px vertical padding) */}
              <div class="space-y-3">
                <For each={projects()}>
                  {(p) => {
                    const isSelected = () => selectedProjectId() === p.id;
                    const critCount = () =>
                      p.vulnerabilities.filter((v) => v.severity === "critical").length;
                    return (
                      <button
                        type="button"
                        data-testid={`project-card-${p.id}`}
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setAttackResult(null);
                          setAegisProductSection("projects");
                        }}
                        class={`w-full text-left px-6 py-5 rounded-[16px] border transition-all cursor-pointer ${
                          isSelected()
                            ? "bg-[#EEF2FF]/65 border-[1.5px] border-[#4F46E5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-indigo-500/12 dark:border-[#818CF8]"
                            : "bg-white border-[#EAECF0] hover:border-[#DFE3E8] hover:bg-[#F8F9FA] dark:bg-[#17181C] dark:border-[#252830] dark:hover:bg-[#212329]"
                        }`}
                      >
                        <div class="flex items-center justify-between gap-2 mb-2">
                          <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF]">
                            {intakeBadgeLabel(p.intakeMode)}
                          </span>
                          <PrelineBadge variant={defenseBadgeVariant(p.defenseStatus)} dot>
                            {defenseBadgeLabel(p.defenseStatus)}
                          </PrelineBadge>
                        </div>

                        <h3 class="text-[16px] leading-[24px] font-semibold text-[#111827] dark:text-[#F3F4F6] truncate">
                          {p.name}
                        </h3>

                        <p class="mt-1 text-[13px] leading-[20px] font-mono text-[#4B5563] dark:text-[#9CA3AF] truncate">
                          {p.repoUrl ?? p.targetUrl ?? p.binaryFileName}
                        </p>

                        <div class="mt-3 pt-3 border-t border-[#EAECF0] dark:border-[#252830] flex items-center justify-between text-[13px] leading-[20px] tabular-nums">
                          <span class="text-[#4B5563] dark:text-[#9CA3AF] font-medium">
                            {p.vulnerabilities.length} finding
                            {p.vulnerabilities.length === 1 ? "" : "s"} ({critCount()} critical)
                          </span>
                          <Show when={!p.dnsVerified && p.intakeMode === "url-dns"}>
                            <span class="text-[#B45309] dark:text-[#FFDDA5] font-semibold">
                              DNS Pending
                            </span>
                          </Show>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Sidebar Footer: Clean Demo Reset & Summary */}
            <div class="pt-4 border-t border-[#EAECF0] dark:border-[#252830] flex items-center justify-between gap-2">
              <span class="text-[13px] leading-[20px] text-[#6B7280] dark:text-[#6E7686] tabular-nums">
                {
                  projects().filter(
                    (p) =>
                      p.defenseStatus === "patched_via_pr" ||
                      p.defenseStatus === "protected_via_route_shield" ||
                      p.defenseStatus === "binary_hard_patched",
                  ).length
                }{" "}
                / {projects().length} targets verified green
              </span>
              <PrelineButton
                variant="secondary"
                size="xs"
                data-testid="reset-demo-projects-btn"
                disabled={loading()}
                onClick={handleResetDemoProjects}
              >
                Reset Demo
              </PrelineButton>
            </div>
          </aside>

          {/* Main Workspace / Reader Canvas (48px outer padding on desktop) */}
          <div class="flex-1 min-w-0 p-6 lg:p-12 space-y-6">
            <Show when={error()}>
              {(errMsg) => (
                <PrelineAlert variant="red" title="Security Operation Error">
                  {errMsg()}
                </PrelineAlert>
              )}
            </Show>

            <Show when={notice()}>
              {(msg) => (
                <PrelineAlert variant="teal" title="Verification Update">
                  {msg()}
                </PrelineAlert>
              )}
            </Show>

            <Show
              when={selectedProject()}
              fallback={
                <div class="bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-6 lg:p-12 text-center">
                  <p class="text-[15px] leading-[24px] text-[#4B5563] dark:text-[#9CA3AF]">
                    Select a security target from the left sidebar to inspect findings and
                    remediation artifacts.
                  </p>
                </div>
              }
            >
              {(proj) => (
                /* Primary Reading & Workspace Sheet (rounded-[24px], 48px internal padding on desktop) */
                <section
                  aria-label="Target Security Workspace"
                  class="bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-6 lg:p-12 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6"
                >
                  {/* Workspace Sheet Header: Target Metadata + ONE Primary Scan Action */}
                  <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-6 pb-6 border-b border-[#EAECF0] dark:border-[#252830]">
                    <div class="space-y-2">
                      <div class="flex flex-wrap items-center gap-2.5">
                        <PrelineBadge variant="blue">
                          {intakeBadgeLabel(proj().intakeMode)}
                        </PrelineBadge>
                        <PrelineBadge variant={defenseBadgeVariant(proj().defenseStatus)} dot>
                          {defenseBadgeLabel(proj().defenseStatus)}
                        </PrelineBadge>
                        <span class="text-[13px] leading-[20px] text-[#6B7280] dark:text-[#6E7686] tabular-nums">
                          Scan Latency: {proj().lastScanDurationMs} ms
                        </span>
                      </div>

                      <h1 class="text-[28px] leading-[36px] font-bold tracking-[-0.02em] text-[#111827] dark:text-[#F3F4F6]">
                        {proj().name}
                      </h1>

                      <p class="text-[13px] leading-[20px] font-mono text-[#4B5563] dark:text-[#9CA3AF] break-all">
                        {proj().repoUrl ?? proj().targetUrl ?? proj().binaryFileName}
                      </p>
                    </div>

                    {/* Action Group: Strictly ONE Primary Button (#4F46E5) per active view */}
                    <div class="flex flex-wrap items-center gap-3 shrink-0">
                      <Show when={proj().intakeMode === "binary"}>
                        <label class="h-10 px-4 inline-flex items-center gap-2 text-[14px] leading-[20px] font-semibold rounded-[12px] border border-[#DFE3E8] bg-white text-[#111827] hover:bg-[#F8F9FA] dark:bg-[#17181C] dark:border-[#2E323C] dark:text-[#F3F4F6] cursor-pointer">
                          <span>{uploadingBinary() ? "Uploading ELF..." : "Upload ELF/PE"}</span>
                          <input
                            type="file"
                            class="hidden"
                            aria-label="Upload ELF or PE binary"
                            onChange={(e) => {
                              const f = e.currentTarget.files?.[0];
                              if (f) void handleBinaryFileSelect(proj().id, f);
                            }}
                          />
                        </label>
                      </Show>

                      <PrelineButton
                        variant="secondary"
                        size="sm"
                        data-testid="rescan-btn"
                        disabled={
                          scanning() || (proj().intakeMode === "url-dns" && !proj().dnsVerified)
                        }
                        onClick={() => handleRunScan(proj().id, proj().remediationMode)}
                      >
                        {scanning() ? "Scanning..." : "Quick Re-Scan"}
                      </PrelineButton>

                      <PrelineButton
                        variant={aegisProductSection() === "remediation" ? "secondary" : "primary"}
                        size="sm"
                        data-testid="stream-scan-btn"
                        disabled={
                          scanning() || (proj().intakeMode === "url-dns" && !proj().dnsVerified)
                        }
                        onClick={() => handleStreamScan(proj().id, proj().remediationMode)}
                      >
                        {scanning() ? "Verifying in Sandbox..." : "Run Security Scan"}
                      </PrelineButton>
                    </div>
                  </div>

                  {/* DNS TXT Ownership Gate Card (Shown when URL target is unverified) */}
                  <Show when={proj().intakeMode === "url-dns" && !proj().dnsVerified}>
                    <div
                      data-testid="dns-verify-card"
                      class="rounded-[16px] p-6 bg-[#FEF3C7]/60 border border-[#B45309]/25 dark:bg-[#470E00]/50 dark:border-[#FFDDA5]/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-2">
                          <PrelineBadge variant="amber" dot>
                            Authorization Gate Required
                          </PrelineBadge>
                          <span class="text-[14px] leading-[20px] font-semibold text-[#B45309] dark:text-[#FFDDA5]">
                            DNS TXT Domain Ownership Verification
                          </span>
                        </div>
                        <p class="text-[14px] leading-[22px] text-[#111827] dark:text-[#F3F4F6]">
                          Active black-box fuzzing is locked until domain ownership is confirmed for{" "}
                          <code class="font-mono font-semibold">{proj().dnsDomain}</code>.
                        </p>
                        <div class="pt-1 font-mono text-[13px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF]">
                          TXT Record:{" "}
                          <span class="font-semibold text-[#111827] dark:text-[#F3F4F6]">
                            {proj().dnsTxtRecordName}
                          </span>{" "}
                          ={" "}
                          <span class="font-semibold text-[#4F46E5] dark:text-[#818CF8]">
                            {proj().dnsTxtToken}
                          </span>
                        </div>
                      </div>

                      <PrelineButton
                        variant="amber"
                        size="sm"
                        data-testid="dns-verify-btn"
                        disabled={verifyingDns()}
                        onClick={() => handleVerifyDns(proj().id)}
                      >
                        {verifyingDns() ? "Checking DNS TXT..." : "Verify DNS Ownership"}
                      </PrelineButton>
                    </div>
                  </Show>

                  {/* Compact 4-Step Verification Status Stepper */}
                  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <For each={liveSteps().length > 0 ? liveSteps() : proj().timeline}>
                      {(step, idx) => (
                        <div class="px-4 py-3.5 rounded-[12px] bg-[#F2F4F7] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] flex items-center justify-between gap-2">
                          <div class="min-w-0">
                            <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF] block">
                              Step {idx() + 1}
                            </span>
                            <span class="text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6] truncate block">
                              {step.title}
                            </span>
                          </div>
                          <PrelineBadge
                            variant={
                              step.status === "passed_green"
                                ? "emerald"
                                : step.status === "confirmed_red"
                                  ? "red"
                                  : "blue"
                            }
                          >
                            {step.durationMs}ms
                          </PrelineBadge>
                        </div>
                      )}
                    </For>
                  </div>

                  {/* Section 1: Confirmed Vulnerability Findings (Full in "projects" / "vulnerabilities", Compact Summary Strip in "remediation") */}
                  <Show
                    when={
                      aegisProductSection() === "projects" ||
                      aegisProductSection() === "vulnerabilities"
                    }
                    fallback={
                      <Show when={proj().vulnerabilities[0]}>
                        {(firstVuln) => (
                          <div class="px-5 py-3.5 rounded-[12px] bg-[#F8F9FA] dark:bg-[#212329]/60 border border-[#EAECF0] dark:border-[#252830] flex flex-wrap items-center justify-between gap-3">
                            <div class="flex flex-wrap items-center gap-2.5 min-w-0">
                              <PrelineBadge variant="red">
                                {firstVuln().severity.toUpperCase()} • CVSS{" "}
                                {firstVuln().cvssScore.toFixed(1)}
                              </PrelineBadge>
                              <PrelineBadge variant="blue">{firstVuln().cveOrCwe}</PrelineBadge>
                              <span class="text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6] truncate">
                                {firstVuln().title}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAegisProductSection("vulnerabilities")}
                              class="text-[13px] leading-[20px] font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:underline cursor-pointer shrink-0"
                            >
                              ← Inspect Finding Details
                            </button>
                          </div>
                        )}
                      </Show>
                    }
                  >
                    <div class="space-y-4">
                      <div class="flex items-center justify-between gap-2">
                        <div>
                          <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8]">
                            Zero False-Positive Guarantee
                          </span>
                          <h2 class="text-[20px] leading-[28px] font-semibold tracking-[-0.015em] text-[#111827] dark:text-[#F3F4F6]">
                            Confirmed Vulnerabilities ({proj().vulnerabilities.length})
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAegisProductSection("remediation")}
                          class="text-[14px] leading-[20px] font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:underline cursor-pointer"
                        >
                          Open Remediation Artifacts →
                        </button>
                      </div>

                      <Show
                        when={proj().vulnerabilities.length > 0}
                        fallback={
                          <PrelineAlert variant="amber" title="Awaiting Initial Verification Scan">
                            Verify domain ownership (if required) and click{" "}
                            <strong>Run Security Scan</strong> to execute the 4-stage Red-to-Green
                            verification pipeline.
                          </PrelineAlert>
                        }
                      >
                        <div class="space-y-4">
                          <For each={proj().vulnerabilities}>
                            {(vuln) => {
                              const isExpanded = () => expandedFindingId() === vuln.id;
                              return (
                                <div class="rounded-[16px] border border-[#EAECF0] dark:border-[#252830] bg-white dark:bg-[#17181C] p-6 space-y-4">
                                  <div class="flex flex-wrap items-start justify-between gap-3">
                                    <div class="space-y-1">
                                      <div class="flex flex-wrap items-center gap-2">
                                        <PrelineBadge
                                          variant={
                                            vuln.severity === "critical" || vuln.severity === "high"
                                              ? "red"
                                              : "amber"
                                          }
                                        >
                                          {vuln.severity.toUpperCase()} • CVSS{" "}
                                          {vuln.cvssScore.toFixed(1)}
                                        </PrelineBadge>
                                        <PrelineBadge variant="blue">{vuln.cveOrCwe}</PrelineBadge>
                                        <Show when={vuln.zeroFalsePositiveConfirmed}>
                                          <PrelineBadge variant="emerald" dot>
                                            PoC Reproduced &amp; Verified Green
                                          </PrelineBadge>
                                        </Show>
                                      </div>
                                      <h3 class="text-[18px] leading-[28px] font-semibold text-[#111827] dark:text-[#F3F4F6] pt-1">
                                        {vuln.title}
                                      </h3>
                                      <p class="text-[13px] leading-[20px] font-mono text-[#4F46E5] dark:text-[#818CF8]">
                                        Location: {vuln.location}
                                      </p>
                                    </div>

                                    <PrelineButton
                                      variant="secondary"
                                      size="xs"
                                      onClick={() =>
                                        setExpandedFindingId(isExpanded() ? null : vuln.id)
                                      }
                                    >
                                      {isExpanded() ? "Hide PoC Evidence" : "Inspect PoC Evidence"}
                                    </PrelineButton>
                                  </div>

                                  <p class="text-[15px] leading-[24px] text-[#4B5563] dark:text-[#9CA3AF]">
                                    {vuln.rootCause}
                                  </p>

                                  <Show when={isExpanded()}>
                                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                                      <div class="p-4 rounded-[12px] bg-[#FEE2E2]/45 border border-[#B91C1C]/20 dark:bg-[#7F1D1D]/20 dark:border-[#FECACA]/20 space-y-1.5">
                                        <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#B91C1C] dark:text-[#FECACA] block">
                                          Stage 2 — Red PoC Exploit Log
                                        </span>
                                        <pre class="text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] whitespace-pre-wrap">
                                          {vuln.pocRedLog}
                                        </pre>
                                      </div>
                                      <div class="p-4 rounded-[12px] bg-[#DCFCE7]/45 border border-[#15803D]/20 dark:bg-[#053C01]/25 dark:border-[#B0F4B2]/20 space-y-1.5">
                                        <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#15803D] dark:text-[#B0F4B2] block">
                                          Stage 4 — Green Verification Log
                                        </span>
                                        <pre class="text-[13px] leading-[20px] font-mono text-[#111827] dark:text-[#F3F4F6] whitespace-pre-wrap">
                                          {vuln.verifyGreenLog}
                                        </pre>
                                      </div>
                                    </div>
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>

                  {/* Section 2: Tri-Mode Remediation & Verification Sandbox Panel */}
                  <AegisPatchInsightPanel
                    project={proj()}
                    liveSteps={liveSteps()}
                    expanded={aegisProductSection() === "remediation"}
                    onExpand={() => setAegisProductSection("remediation")}
                    attackPayload={attackPayload()}
                    setAttackPayload={setAttackPayload}
                    attackResult={attackResult()}
                    onToggleShield={(enabled) => handleToggleShield(proj().id, enabled)}
                    onTestAttack={() => handleTestAttack(proj().id)}
                    onProjectUpdate={updateProjectInList}
                  />
                </section>
              )}
            </Show>
          </div>
        </div>

        {/* Clean Modal Dialog for Target Onboarding (DESIGN.md Elevated Surface #FFFFFF / #1D1F25) */}
        <Show when={showNewForm()}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-target-modal-title"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          >
            <div class="w-full max-w-[560px] bg-white dark:bg-[#1D1F25] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-6 lg:p-8 shadow-xl space-y-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8]">
                    Target Onboarding
                  </span>
                  <h2
                    id="new-target-modal-title"
                    class="text-[22px] leading-[30px] font-bold tracking-[-0.02em] text-[#111827] dark:text-[#F3F4F6] mt-0.5"
                  >
                    Register Security Target
                  </h2>
                </div>
                <PrelineButton variant="ghost" size="xs" onClick={() => setShowNewForm(false)}>
                  Close
                </PrelineButton>
              </div>

              <form onSubmit={handleCreateProject} class="space-y-5">
                {/* Intake Mode Filter Chips (40px pill chips) */}
                <div>
                  <span class="block text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6] mb-2">
                    Target Intake Mode
                  </span>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="intake-mode-github"
                      onClick={() => setNewMode("github")}
                      class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
                        newMode() === "github"
                          ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                          : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                      }`}
                    >
                      GitHub Repo
                    </button>
                    <button
                      type="button"
                      data-testid="intake-mode-url-dns"
                      onClick={() => setNewMode("url-dns")}
                      class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
                        newMode() === "url-dns"
                          ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                          : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                      }`}
                    >
                      URL + DNS Gate
                    </button>
                    <button
                      type="button"
                      data-testid="intake-mode-binary"
                      onClick={() => setNewMode("binary")}
                      class={`h-10 px-4 rounded-full text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
                        newMode() === "binary"
                          ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                          : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                      }`}
                    >
                      No-Source Binary
                    </button>
                  </div>
                </div>

                <PrelineInput
                  label="Project / Service Identifier"
                  data-testid="new-project-name-input"
                  placeholder="e.g. korea-pay-webhook-edge"
                  value={newName()}
                  onInput={(e) => setNewName(e.currentTarget.value)}
                  required
                />

                <Show when={newMode() === "github"}>
                  <PrelineInput
                    label="GitHub Repository URL"
                    data-testid="new-project-repo-input"
                    placeholder="https://github.com/org/repo"
                    value={newRepoUrl()}
                    onInput={(e) => setNewRepoUrl(e.currentTarget.value)}
                  />
                </Show>

                <Show when={newMode() === "url-dns"}>
                  <PrelineInput
                    label="Target Endpoint URL"
                    data-testid="new-project-url-input"
                    placeholder="https://pay.korea-fintech.kr/v3/settlement/callback"
                    value={newTargetUrl()}
                    onInput={(e) => setNewTargetUrl(e.currentTarget.value)}
                  />
                </Show>

                <Show when={newMode() === "binary"}>
                  <PrelineInput
                    label="ELF64 / PE Binary Artifact Name"
                    data-testid="new-project-binary-input"
                    placeholder="edge-telemetry-gateway.elf"
                    value={newBinaryName()}
                    onInput={(e) => setNewBinaryName(e.currentTarget.value)}
                  />
                </Show>

                <div class="pt-2 flex items-center justify-end gap-3">
                  <PrelineButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowNewForm(false)}
                  >
                    Cancel
                  </PrelineButton>
                  <PrelineButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    data-testid="create-project-submit-btn"
                  >
                    Create &amp; Initialize Target
                  </PrelineButton>
                </div>
              </form>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
