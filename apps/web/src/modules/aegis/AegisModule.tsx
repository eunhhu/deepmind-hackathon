import type {
  AegisDeliveryChannel,
  AegisIntakeMode,
  AegisProject,
  AegisRemediationMode,
  AegisSecuritySolutionId,
  AegisSecuritySolutionOption,
  AegisShieldTestAttackResponse,
  AegisTimelineStep,
  AegisVerifyDnsResponse,
} from "@deepmind/shared";
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import {
  buildAuthHeaders,
  recommendAegisSolutions,
  resetAegisProjects,
  streamAegisPipeline,
  uploadAegisBinary,
} from "../../core/api/client";
import { aegisRoute, navigateAegisRoute } from "../../core/auth/AuthBar";
import {
  PrelineAlert,
  PrelineBadge,
  PrelineButton,
  PrelineCard,
  PrelineInput,
} from "../../core/ui/preline";
import { AegisLandingHero } from "./AegisLandingHero";
import { type AegisInsightTab, AegisPatchInsightPanel } from "./AegisPatchInsightPanel";

const DEFAULT_SOLUTIONS_CATALOG: AegisSecuritySolutionOption[] = [
  {
    id: "ast-pr-patch",
    title: "AST Source Patch & GitHub PR",
    subtitle: "Synthesizes minimal-diff source code patches and opens verified GitHub PRs.",
    matchedChannels: ["github"],
    badge: "GitHub Code",
    recommended: true,
  },
  {
    id: "cicd-webhook",
    title: "Automated CI/CD Security Hook Gate",
    subtitle: "Attaches a webhook gate on git.push / deploy to auto-verify & block regressions.",
    matchedChannels: ["github", "web_url", "api_server"],
    badge: "Automation Hook",
    recommended: true,
  },
  {
    id: "local-self-healing-sdk",
    title: "Local Self-Healing SDK (@aegis/self-healing-sdk)",
    subtitle: "Central Aegis Server runs deep Argon analysis; SDK auto-patches local source code.",
    matchedChannels: ["github", "api_server", "web_url"],
    badge: "Central Analyze + Local Patch",
    recommended: true,
  },
  {
    id: "sandbox-dast",
    title: "Zero-False-Positive Sandbox DAST Fuzzing",
    subtitle: "Reproduces live SSRF/SQLi/Auth exploits in an isolated container after DNS gate.",
    matchedChannels: ["web_url", "api_server"],
    badge: "Live Link / API",
    recommended: true,
  },
  {
    id: "reverse-proxy-shield",
    title: "Protected Reverse Proxy & Edge Route Shield",
    subtitle: "Wraps your live web/API service behind Aegis zero-downtime virtual WAF proxy.",
    matchedChannels: ["web_url", "api_server"],
    badge: "Safe Reverse Proxy",
    recommended: true,
  },
  {
    id: "binary-hard-patch",
    title: "No-Source ELF/PE Machine-Code Hard Patch",
    subtitle: "Injects register bounds guards at vulnerable instruction offsets without source.",
    matchedChannels: ["binary_app"],
    badge: "Binary / Single App",
    recommended: true,
  },
  {
    id: "prepatched-installer",
    title: "Pre-Patched Installable / Standalone App Bundle",
    subtitle: "Generates a signed, pre-patched standalone app or installer ready for distribution.",
    matchedChannels: ["binary_app", "github"],
    badge: "Safe App Delivery",
    recommended: true,
  },
];

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

  // New Project Onboarding State (Route: /onboarding — Steps 3, 4 & 5)
  const [newName, setNewName] = createSignal("");
  const [newMode, setNewMode] = createSignal<AegisIntakeMode>("url-dns");
  const [newRepoUrl, setNewRepoUrl] = createSignal("https://github.com/acme-corp/checkout-api");
  const [newTargetUrl, setNewTargetUrl] = createSignal(
    "https://pay.staging.acme-cloud.io/api/v1/webhooks/preview",
  );
  const [newApiServerUrl, setNewApiServerUrl] = createSignal(
    "https://api.acme-cloud.io/v2/settlement/execute",
  );
  const [newBinaryName, setNewBinaryName] = createSignal("edge-telemetry-gateway.elf");
  const [selectedChannels, setSelectedChannels] = createSignal<AegisDeliveryChannel[]>([
    "github",
    "web_url",
    "api_server",
    "binary_app",
  ]);
  const [recommendedSolutions, setRecommendedSolutions] =
    createSignal<AegisSecuritySolutionOption[]>(DEFAULT_SOLUTIONS_CATALOG);
  const [selectedSolutions, setSelectedSolutions] = createSignal<AegisSecuritySolutionId[]>([
    "ast-pr-patch",
    "cicd-webhook",
    "local-self-healing-sdk",
    "sandbox-dast",
    "reverse-proxy-shield",
    "binary-hard-patch",
    "prepatched-installer",
  ]);
  const [solutionAnalysisSummary, setSolutionAnalysisSummary] = createSignal(
    "Matched autonomous security solutions based on your selected software delivery channels.",
  );
  const [analyzingSolutions, setAnalyzingSolutions] = createSignal(false);

  // Active sub-mode inside /app/remediation ("git" | "binary" | "shield")
  const [remediationSubTab, setRemediationSubTab] = createSignal<"git" | "binary" | "shield">(
    "git",
  );

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

  let lastSyncedProjectId = "";
  createEffect(() => {
    const proj = selectedProject();
    if (proj && proj.id !== lastSyncedProjectId) {
      lastSyncedProjectId = proj.id;
      if (proj.remediationMode === "binary-patch") {
        setRemediationSubTab("binary");
      } else if (proj.remediationMode === "route-shield") {
        setRemediationSubTab("shield");
      } else {
        setRemediationSubTab("git");
      }
    }
  });

  function syncSolutionsForChannels(channels: AegisDeliveryChannel[]) {
    const matched = DEFAULT_SOLUTIONS_CATALOG.map((item) => ({
      ...item,
      recommended: item.matchedChannels.some((ch) => channels.includes(ch)),
    }));
    setRecommendedSolutions(matched);
    const recIds = matched.filter((m) => m.recommended).map((m) => m.id);
    if (recIds.length > 0) {
      setSelectedSolutions(recIds);
    }
    if (
      channels.includes("binary_app") &&
      !channels.includes("github") &&
      !channels.includes("web_url")
    ) {
      setNewMode("binary");
    } else if (
      (channels.includes("web_url") || channels.includes("api_server")) &&
      !channels.includes("github")
    ) {
      setNewMode("url-dns");
    } else if (channels.includes("github")) {
      setNewMode("github");
    }
  }

  function toggleDeliveryChannel(ch: AegisDeliveryChannel) {
    const current = selectedChannels();
    const exists = current.includes(ch);
    const next = exists
      ? current.length > 1
        ? current.filter((c) => c !== ch)
        : current
      : [...current, ch];
    setSelectedChannels(next);
    syncSolutionsForChannels(next);
  }

  function toggleSolutionSelection(id: AegisSecuritySolutionId) {
    const current = selectedSolutions();
    if (current.includes(id)) {
      if (current.length > 1) {
        setSelectedSolutions(current.filter((item) => item !== id));
      }
    } else {
      setSelectedSolutions([...current, id]);
    }
  }

  async function handleAnalyzeDeliverySolutions() {
    setAnalyzingSolutions(true);
    try {
      const res = await recommendAegisSolutions(selectedChannels(), {
        githubRepoUrl: selectedChannels().includes("github") ? newRepoUrl() : undefined,
        webTargetUrl: selectedChannels().includes("web_url") ? newTargetUrl() : undefined,
        apiServerUrl: selectedChannels().includes("api_server") ? newApiServerUrl() : undefined,
        binaryAppName: selectedChannels().includes("binary_app") ? newBinaryName() : undefined,
      });
      if (res.recommendedSolutions && res.recommendedSolutions.length > 0) {
        setRecommendedSolutions(res.recommendedSolutions);
        setSelectedSolutions(
          res.recommendedSolutions.filter((s) => s.recommended).map((s) => s.id),
        );
      }
      if (res.analysisSummary) {
        setSolutionAnalysisSummary(res.analysisSummary);
      }
    } catch {
      syncSolutionsForChannels(selectedChannels());
    } finally {
      setAnalyzingSolutions(false);
    }
  }

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
    const channels = selectedChannels();
    const includeGithub = newMode() === "github" || channels.includes("github");
    const includeWeb = newMode() === "url-dns" || channels.includes("web_url");
    const includeApi = channels.includes("api_server");
    const includeBinary = newMode() === "binary" || channels.includes("binary_app");
    try {
      const res = await aegisFetch<{ project: AegisProject }>("/api/modules/aegis/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newName().trim(),
          intakeMode: newMode(),
          repoUrl: includeGithub ? newRepoUrl().trim() : undefined,
          targetUrl: includeWeb
            ? newTargetUrl().trim()
            : includeApi
              ? newApiServerUrl().trim()
              : undefined,
          apiServerUrl: includeApi ? newApiServerUrl().trim() : undefined,
          binaryFileName: includeBinary ? newBinaryName().trim() : undefined,
          deliveryChannels: channels,
          channelInputs: {
            githubRepoUrl: includeGithub ? newRepoUrl().trim() : undefined,
            webTargetUrl: includeWeb ? newTargetUrl().trim() : undefined,
            apiServerUrl: includeApi ? newApiServerUrl().trim() : undefined,
            binaryAppName: includeBinary ? newBinaryName().trim() : undefined,
          },
          selectedSolutions: selectedSolutions(),
        }),
      });
      setProjects((prev) => [res.project, ...prev]);
      setSelectedProjectId(res.project.id);
      setNewName("");
      navigateAegisRoute("/app/projects");
      setNotice(
        res.project.intakeMode === "url-dns"
          ? `Created URL target "${res.project.name}". Verify DNS TXT record (${res.project.dnsTxtRecordName}) before active fuzzing.`
          : `Created security target "${res.project.name}" with ${channels.length} delivery channel(s) & ${selectedSolutions().length} defense solutions. Ready for 1-Click Security Audit & Auto-Fix.`,
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

  const activeInsightTab = (): AegisInsightTab => {
    const r = aegisRoute();
    if (r === "/app/automation-sdk") return "automation-sdk";
    if (r === "/app/safe-delivery") return "safe-delivery";
    if (r === "/app/verification-sandbox") return "verification";
    return remediationSubTab();
  };

  const handleSelectInsightTab = (tab: AegisInsightTab) => {
    if (tab === "automation-sdk") {
      navigateAegisRoute("/app/automation-sdk");
    } else if (tab === "safe-delivery") {
      navigateAegisRoute("/app/safe-delivery");
    } else if (tab === "verification") {
      navigateAegisRoute("/app/verification-sandbox");
    } else {
      setRemediationSubTab(tab);
      navigateAegisRoute("/app/remediation");
    }
  };

  return (
    <div class="w-full">
      {/* Dedicated Ops & Engine Console Verification View (Route: /ops) */}
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

      {/* Product Mode: Strictly Isolated Route Pages */}
      <Show when={!isOpsMode()}>
        {/* ROUTE 1: "/" — Standalone Public SaaS Landing Page (NO Dashboard!) */}
        <Show when={aegisRoute() === "/"}>
          <AegisLandingHero
            mode="landing"
            activeProjectsCount={projects().length}
            selectedChannels={selectedChannels()}
            onChannelsChange={(channels) => {
              setSelectedChannels(channels);
              syncSolutionsForChannels(channels);
            }}
            onNavigateSignUp={() => navigateAegisRoute("/signup")}
            onOpenConsole={() => navigateAegisRoute("/app/projects")}
            onQuickOpenNewProject={() => navigateAegisRoute("/onboarding")}
            onStartWithChannels={(channels, userProfile) => {
              if (channels.length > 0) {
                setSelectedChannels(channels);
                syncSolutionsForChannels(channels);
              }
              if (userProfile?.org && !newName()) {
                setNewName(
                  `${userProfile.org.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-core-service`,
                );
              }
              navigateAegisRoute("/onboarding");
              void handleAnalyzeDeliverySolutions();
            }}
          />
        </Show>

        {/* ROUTE 2: "/signup" — Standalone Dedicated Sign Up & Workspace Setup Page (NO Landing Hero, NO Dashboard!) */}
        <Show when={aegisRoute() === "/signup"}>
          <AegisLandingHero
            mode="signup"
            activeProjectsCount={projects().length}
            selectedChannels={selectedChannels()}
            onChannelsChange={(channels) => {
              setSelectedChannels(channels);
              syncSolutionsForChannels(channels);
            }}
            onNavigateLanding={() => navigateAegisRoute("/")}
            onOpenConsole={() => navigateAegisRoute("/app/projects")}
            onQuickOpenNewProject={() => navigateAegisRoute("/onboarding")}
            onStartWithChannels={(channels, userProfile) => {
              if (channels.length > 0) {
                setSelectedChannels(channels);
                syncSolutionsForChannels(channels);
              }
              if (userProfile?.org && !newName()) {
                setNewName(
                  `${userProfile.org.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-core-service`,
                );
              }
              navigateAegisRoute("/onboarding");
              void handleAnalyzeDeliverySolutions();
            }}
          />
        </Show>

        {/* ROUTE 3: "/onboarding" — Dedicated Full-Page New Project & Multi-Select SW Delivery + Tailored Security Solutions Wizard */}
        <Show when={aegisRoute() === "/onboarding"}>
          <div data-testid="onboarding-page-view" class="max-w-[920px] mx-auto p-6 lg:p-12">
            <div class="bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-6 lg:p-10 shadow-2xs space-y-6">
              <div class="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EAECF0] dark:border-[#252830]">
                <div>
                  <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8]">
                    Step 3–5 • Guided Project Onboarding
                  </span>
                  <h1
                    id="new-target-modal-title"
                    class="text-[26px] leading-[34px] font-bold tracking-[-0.02em] text-[#111827] dark:text-[#F3F4F6] mt-0.5"
                  >
                    Create Security Project &amp; Select Defense Solutions
                  </h1>
                  <p class="text-[14px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF] mt-1">
                    Select one or multiple software delivery channels, analyze your stack, and
                    provision tailored autonomous defense solutions.
                  </p>
                </div>
                <PrelineButton
                  variant="secondary"
                  size="sm"
                  onClick={() => navigateAegisRoute("/app/projects")}
                >
                  ← Back to Security Console
                </PrelineButton>
              </div>

              <form onSubmit={handleCreateProject} class="space-y-6">
                <PrelineInput
                  label="Step 3: Project / Software Service Name"
                  data-testid="new-project-name-input"
                  placeholder="e.g. korea-pay-webhook-edge"
                  value={newName()}
                  onInput={(e) => setNewName(e.currentTarget.value)}
                  required
                />

                {/* Step 4: Multi-Select SW Service Delivery Channels */}
                <div class="space-y-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="block text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                      Step 4: Select SW Service Delivery Methods (Multi-Select Supported)
                    </span>
                    <span class="text-[12px] leading-[16px] font-medium text-[#4F46E5] dark:text-[#818CF8]">
                      {selectedChannels().length} selected
                    </span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        {
                          id: "github" as AegisDeliveryChannel,
                          label: "GitHub Source Code (깃헙 코드)",
                          desc: "Repository + CI/CD Workflow",
                        },
                        {
                          id: "web_url" as AegisDeliveryChannel,
                          label: "Web Service Link (웹 링크)",
                          desc: "Live Web URL + DNS TXT Gate",
                        },
                        {
                          id: "api_server" as AegisDeliveryChannel,
                          label: "API Server Endpoint (API 서버 주소)",
                          desc: "REST / GraphQL / Webhook API",
                        },
                        {
                          id: "binary_app" as AegisDeliveryChannel,
                          label: "Installable / Single App / Binary (설치형/바이너리)",
                          desc: "Standalone App or ELF64/PE Binary",
                        },
                      ] as const
                    ).map((ch) => {
                      const active = () => selectedChannels().includes(ch.id);
                      return (
                        <button
                          type="button"
                          data-testid={`channel-toggle-${ch.id}`}
                          onClick={() => toggleDeliveryChannel(ch.id)}
                          class={`p-4 rounded-[14px] border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                            active()
                              ? "bg-[#EEF2FF]/75 border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:border-[#818CF8]"
                              : "bg-white border-[#DFE3E8] hover:bg-[#F8F9FA] dark:bg-[#17181C] dark:border-[#2E323C]"
                          }`}
                        >
                          <div>
                            <div class="text-[13px] leading-[18px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                              {ch.label}
                            </div>
                            <div class="text-[12px] leading-[16px] text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                              {ch.desc}
                            </div>
                          </div>
                          <span
                            class={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              active()
                                ? "bg-[#4F46E5] text-white"
                                : "bg-[#F2F4F7] text-[#4B5563] dark:bg-[#212329] dark:text-[#9CA3AF]"
                            }`}
                          >
                            {active() ? "Selected" : "Select"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Intake Mode Quick Selector */}
                <div>
                  <span class="block text-[13px] leading-[18px] font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-2">
                    Primary Verification Pipeline Mode
                  </span>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="intake-mode-github"
                      onClick={() => {
                        setNewMode("github");
                        if (!selectedChannels().includes("github")) {
                          toggleDeliveryChannel("github");
                        }
                      }}
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
                      onClick={() => {
                        setNewMode("url-dns");
                        if (!selectedChannels().includes("web_url")) {
                          toggleDeliveryChannel("web_url");
                        }
                      }}
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
                      onClick={() => {
                        setNewMode("binary");
                        if (!selectedChannels().includes("binary_app")) {
                          toggleDeliveryChannel("binary_app");
                        }
                      }}
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

                {/* Channel-Specific Inputs */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Show when={newMode() === "github" || selectedChannels().includes("github")}>
                    <PrelineInput
                      label="GitHub Repository URL"
                      data-testid="new-project-repo-input"
                      placeholder="https://github.com/org/repo"
                      value={newRepoUrl()}
                      onInput={(e) => setNewRepoUrl(e.currentTarget.value)}
                    />
                  </Show>

                  <Show when={newMode() === "url-dns" || selectedChannels().includes("web_url")}>
                    <PrelineInput
                      label="Target Web Service Link URL"
                      data-testid="new-project-url-input"
                      placeholder="https://pay.korea-fintech.kr/v3/settlement/callback"
                      value={newTargetUrl()}
                      onInput={(e) => setNewTargetUrl(e.currentTarget.value)}
                    />
                  </Show>

                  <Show when={selectedChannels().includes("api_server")}>
                    <PrelineInput
                      label="API Server Endpoint URL"
                      data-testid="new-project-api-input"
                      placeholder="https://api.acme-cloud.io/v2/settlement/execute"
                      value={newApiServerUrl()}
                      onInput={(e) => setNewApiServerUrl(e.currentTarget.value)}
                    />
                  </Show>

                  <Show when={newMode() === "binary" || selectedChannels().includes("binary_app")}>
                    <PrelineInput
                      label="Installable App / Single App / Binary Artifact Name"
                      data-testid="new-project-binary-input"
                      placeholder="edge-telemetry-gateway.elf"
                      value={newBinaryName()}
                      onInput={(e) => setNewBinaryName(e.currentTarget.value)}
                    />
                  </Show>
                </div>

                {/* Step 5: Tailored Security Solutions Analysis & Selection */}
                <div
                  data-testid="solution-analysis-box"
                  class="rounded-[16px] p-5 bg-[#F8F9FA] dark:bg-[#212329] border border-[#EAECF0] dark:border-[#252830] space-y-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8] block">
                        Step 5 • Delivery-Matched Security Solutions
                      </span>
                      <p class="text-[13px] leading-[18px] text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                        {solutionAnalysisSummary()}
                      </p>
                    </div>
                    <PrelineButton
                      type="button"
                      variant="secondary"
                      size="xs"
                      data-testid="analyze-solutions-btn"
                      disabled={analyzingSolutions()}
                      onClick={handleAnalyzeDeliverySolutions}
                    >
                      {analyzingSolutions() ? "Analyzing..." : "Analyze & Match Solutions"}
                    </PrelineButton>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <For each={recommendedSolutions()}>
                      {(sol) => {
                        const isPicked = () => selectedSolutions().includes(sol.id);
                        return (
                          <button
                            type="button"
                            data-testid={`solution-option-${sol.id}`}
                            onClick={() => toggleSolutionSelection(sol.id)}
                            class={`p-3.5 rounded-[12px] border text-left transition-all cursor-pointer ${
                              isPicked()
                                ? "bg-white dark:bg-[#17181C] border-[1.5px] border-[#4F46E5] dark:border-[#818CF8]"
                                : "bg-white/60 dark:bg-[#17181C]/60 border-[#DFE3E8] dark:border-[#2E323C] opacity-75"
                            }`}
                          >
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-[13px] leading-[18px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                                {sol.title}
                              </span>
                              <PrelineBadge variant={isPicked() ? "emerald" : "gray"}>
                                {isPicked() ? "Enabled" : sol.badge}
                              </PrelineBadge>
                            </div>
                            <p class="text-[12px] leading-[16px] text-[#4B5563] dark:text-[#9CA3AF] mt-1">
                              {sol.subtitle}
                            </p>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>

                <div class="pt-3 border-t border-[#EAECF0] dark:border-[#252830] flex items-center justify-end gap-3">
                  <PrelineButton
                    variant="secondary"
                    size="sm"
                    onClick={() => navigateAegisRoute("/app/projects")}
                  >
                    Cancel
                  </PrelineButton>
                  <PrelineButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    data-testid="create-project-submit-btn"
                  >
                    Create &amp; Setup Defense Solutions →
                  </PrelineButton>
                </div>
              </form>
            </div>
          </div>
        </Show>

        {/* ROUTE 4: "/app/*" — Dedicated Security Console Sub-Routes (NEVER renders Landing Hero!) */}
        <Show when={aegisRoute().startsWith("/app")}>
          <div class="min-h-[calc(100vh-120px)] flex flex-col lg:flex-row items-stretch">
            {/* Left Configuration Sidebar (390px-400px fixed desktop width) */}
            <aside
              aria-label="Monitored Security Targets"
              class="w-full lg:w-[390px] xl:w-[400px] shrink-0 bg-white dark:bg-[#17181C] border-b lg:border-b-0 lg:border-r border-[#EAECF0] dark:border-[#252830] p-6 space-y-5 flex flex-col justify-between"
            >
              <div class="space-y-5">
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
                    onClick={() => navigateAegisRoute("/onboarding")}
                  >
                    + New Target
                  </PrelineButton>
                </div>

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

            {/* Right Main Workspace / Route Reader Canvas */}
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
                  <section
                    aria-label="Target Security Workspace"
                    class="bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-6 lg:p-10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6"
                  >
                    {/* Target Header + Scan Actions */}
                    <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-6 pb-6 border-b border-[#EAECF0] dark:border-[#252830]">
                      <div class="space-y-2">
                        <div class="flex flex-wrap items-center gap-2.5">
                          <PrelineBadge variant="blue">
                            {intakeBadgeLabel(proj().intakeMode)}
                          </PrelineBadge>
                          <PrelineBadge variant={defenseBadgeVariant(proj().defenseStatus)} dot>
                            {defenseBadgeLabel(proj().defenseStatus)}
                          </PrelineBadge>
                          <Show
                            when={
                              proj().deliveryChannels && (proj().deliveryChannels?.length ?? 0) > 0
                            }
                          >
                            <span
                              data-testid="project-delivery-channels-badge"
                              class="px-2.5 py-0.5 rounded-full text-[12px] leading-[16px] font-semibold bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8]"
                            >
                              Channels: {proj().deliveryChannels?.join(" + ")}
                            </span>
                          </Show>
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
                          variant="secondary"
                          size="sm"
                          data-testid="stream-scan-btn"
                          disabled={
                            scanning() || (proj().intakeMode === "url-dns" && !proj().dnsVerified)
                          }
                          onClick={() => handleStreamScan(proj().id, proj().remediationMode)}
                        >
                          {scanning() ? "Verifying in Sandbox..." : "Run Security Scan"}
                        </PrelineButton>

                        <PrelineButton
                          variant="primary"
                          size="sm"
                          data-testid="one-click-audit-fix-btn"
                          disabled={
                            scanning() || (proj().intakeMode === "url-dns" && !proj().dnsVerified)
                          }
                          onClick={async () => {
                            await handleRunScan(proj().id, proj().remediationMode);
                            navigateAegisRoute("/app/remediation");
                          }}
                        >
                          {scanning() ? "Auditing & Auto-Fixing..." : "1-Click Audit & Auto-Fix"}
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
                            Active black-box fuzzing is locked until domain ownership is confirmed
                            for <code class="font-mono font-semibold">{proj().dnsDomain}</code>.
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

                    {/* Dedicated Workspace Sub-Route Navigation Bar */}
                    <div
                      role="navigation"
                      aria-label="Target workspace sub-routes"
                      class="p-3 rounded-[16px] bg-[#F8F9FA] dark:bg-[#212329]/70 border border-[#EAECF0] dark:border-[#252830] flex flex-wrap items-center gap-2"
                    >
                      <button
                        type="button"
                        data-testid="subroute-tab-overview"
                        onClick={() => navigateAegisRoute("/app/projects")}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/projects"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Overview &amp; Pipeline
                      </button>

                      <button
                        type="button"
                        data-testid="subroute-tab-vulnerabilities"
                        onClick={() => navigateAegisRoute("/app/vulnerabilities")}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/vulnerabilities"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Vulnerabilities ({proj().vulnerabilities.length})
                      </button>

                      <button
                        type="button"
                        data-testid="remediation-tab-git-pr"
                        onClick={() => {
                          setRemediationSubTab("git");
                          navigateAegisRoute("/app/remediation");
                        }}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/remediation" && remediationSubTab() === "git"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Source Patch &amp; PR
                      </button>

                      <button
                        type="button"
                        data-testid="remediation-tab-binary-patch"
                        onClick={() => {
                          setRemediationSubTab("binary");
                          navigateAegisRoute("/app/remediation");
                        }}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/remediation" && remediationSubTab() === "binary"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        ELF64 Binary Patch
                      </button>

                      <button
                        type="button"
                        data-testid="remediation-tab-route-shield"
                        onClick={() => {
                          setRemediationSubTab("shield");
                          navigateAegisRoute("/app/remediation");
                        }}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/remediation" && remediationSubTab() === "shield"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Edge Route Shield
                      </button>

                      <button
                        type="button"
                        data-testid="remediation-tab-automation-sdk"
                        onClick={() => navigateAegisRoute("/app/automation-sdk")}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/automation-sdk"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Automation Hook &amp; Local SDK
                      </button>

                      <button
                        type="button"
                        data-testid="remediation-tab-safe-delivery"
                        onClick={() => navigateAegisRoute("/app/safe-delivery")}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/safe-delivery"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Pre-Patched App &amp; Reverse Proxy
                      </button>

                      <button
                        type="button"
                        data-testid="remediation-tab-verification-ops"
                        onClick={() => navigateAegisRoute("/app/verification-sandbox")}
                        class={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                          aegisRoute() === "/app/verification-sandbox"
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                            : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C]"
                        }`}
                      >
                        Verification Sandbox
                      </button>
                    </div>

                    {/* SUB-ROUTE 4A: "/app/projects" — Overview & 4-Step Verification Pipeline ONLY */}
                    <Show when={aegisRoute() === "/app/projects"}>
                      <div class="space-y-6">
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

                        {/* Route Summary Navigation Cards (No stacked full panels!) */}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div class="p-5 rounded-[16px] border border-[#EAECF0] dark:border-[#252830] bg-[#F8F9FA] dark:bg-[#212329]/50 flex flex-col justify-between gap-4">
                            <div class="space-y-1.5">
                              <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4F46E5] dark:text-[#818CF8]">
                                Step 6A • Vulnerability Report
                              </span>
                              <h3 class="text-[17px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                                {proj().vulnerabilities.length} Confirmed Exploit Finding
                                {proj().vulnerabilities.length === 1 ? "" : "s"}
                              </h3>
                              <p class="text-[13px] font-mono text-[#4B5563] dark:text-[#9CA3AF] truncate">
                                {proj().vulnerabilities[0]?.location ??
                                  proj().targetUrl ??
                                  proj().repoUrl}
                              </p>
                            </div>
                            <div>
                              <PrelineButton
                                variant="secondary"
                                size="xs"
                                onClick={() => navigateAegisRoute("/app/vulnerabilities")}
                              >
                                Inspect Vulnerability Report →
                              </PrelineButton>
                            </div>
                          </div>

                          <div class="p-5 rounded-[16px] border border-[#EAECF0] dark:border-[#252830] bg-[#F8F9FA] dark:bg-[#212329]/50 flex flex-col justify-between gap-4">
                            <div class="space-y-1.5">
                              <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4F46E5] dark:text-[#818CF8]">
                                Step 6B • Verified Remediation
                              </span>
                              <h3 class="text-[17px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                                Source Patch PR, ELF64 Binary &amp; Edge Shield
                              </h3>
                              <p class="text-[13px] text-[#4B5563] dark:text-[#9CA3AF]">
                                Primary Mode: {proj().remediationMode} • Status:{" "}
                                {defenseBadgeLabel(proj().defenseStatus)}
                              </p>
                            </div>
                            <div>
                              <PrelineButton
                                variant="secondary"
                                size="xs"
                                onClick={() => navigateAegisRoute("/app/remediation")}
                              >
                                Open Remediation Artifacts →
                              </PrelineButton>
                            </div>
                          </div>

                          <div class="p-5 rounded-[16px] border border-[#EAECF0] dark:border-[#252830] bg-[#F8F9FA] dark:bg-[#212329]/50 flex flex-col justify-between gap-4">
                            <div class="space-y-1.5">
                              <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4F46E5] dark:text-[#818CF8]">
                                Step 7 • CI/CD Hook &amp; Local SDK
                              </span>
                              <h3 class="text-[17px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                                Automation Webhook &amp; @aegis/self-healing-sdk
                              </h3>
                              <p class="text-[13px] text-[#4B5563] dark:text-[#9CA3AF]">
                                Central Aegis Server analyzes; Local SDK auto-patches source files.
                              </p>
                            </div>
                            <div>
                              <PrelineButton
                                variant="secondary"
                                size="xs"
                                onClick={() => navigateAegisRoute("/app/automation-sdk")}
                              >
                                Configure Hook &amp; Download SDK →
                              </PrelineButton>
                            </div>
                          </div>

                          <div class="p-5 rounded-[16px] border border-[#EAECF0] dark:border-[#252830] bg-[#F8F9FA] dark:bg-[#212329]/50 flex flex-col justify-between gap-4">
                            <div class="space-y-1.5">
                              <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4F46E5] dark:text-[#818CF8]">
                                Step 8 • Safe Production Delivery
                              </span>
                              <h3 class="text-[17px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
                                Pre-Patched Installer &amp; Reverse Proxy Gateway
                              </h3>
                              <p class="text-[13px] text-[#4B5563] dark:text-[#9CA3AF]">
                                Ship signed standalone bundles or route live traffic through Aegis
                                Edge Proxy.
                              </p>
                            </div>
                            <div>
                              <PrelineButton
                                variant="secondary"
                                size="xs"
                                onClick={() => navigateAegisRoute("/app/safe-delivery")}
                              >
                                Open Safe Delivery &amp; Proxy →
                              </PrelineButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Show>

                    {/* SUB-ROUTE 4B: "/app/vulnerabilities" — Confirmed Vulnerabilities & PoC Evidence Report ONLY */}
                    <Show when={aegisRoute() === "/app/vulnerabilities"}>
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
                            onClick={() => navigateAegisRoute("/app/remediation")}
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
                                              vuln.severity === "critical" ||
                                              vuln.severity === "high"
                                                ? "red"
                                                : "amber"
                                            }
                                          >
                                            {vuln.severity.toUpperCase()} • CVSS{" "}
                                            {vuln.cvssScore.toFixed(1)}
                                          </PrelineBadge>
                                          <PrelineBadge variant="blue">
                                            {vuln.cveOrCwe}
                                          </PrelineBadge>
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

                    {/* SUB-ROUTES 4C–4F: "/app/remediation", "/app/automation-sdk", "/app/safe-delivery", "/app/verification-sandbox" */}
                    <Show
                      when={
                        aegisRoute() === "/app/remediation" ||
                        aegisRoute() === "/app/automation-sdk" ||
                        aegisRoute() === "/app/safe-delivery" ||
                        aegisRoute() === "/app/verification-sandbox"
                      }
                    >
                      <AegisPatchInsightPanel
                        project={proj()}
                        liveSteps={liveSteps()}
                        activeTab={activeInsightTab()}
                        onSelectTab={handleSelectInsightTab}
                        expanded={true}
                        onExpand={() => {}}
                        attackPayload={attackPayload()}
                        setAttackPayload={setAttackPayload}
                        attackResult={attackResult()}
                        onToggleShield={(enabled) => handleToggleShield(proj().id, enabled)}
                        onTestAttack={() => handleTestAttack(proj().id)}
                        onProjectUpdate={updateProjectInList}
                      />
                    </Show>
                  </section>
                )}
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
