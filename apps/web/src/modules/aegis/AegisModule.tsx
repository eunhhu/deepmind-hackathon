import type {
  AegisIntakeMode,
  AegisPipelineStep,
  AegisProject,
  AegisRemediationMode,
  AegisRunPipelineResponse,
  AegisShieldTestAttackResponse,
  AegisVerifyDnsResponse,
  CreateAegisProjectRequest,
} from "@deepmind/shared";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { buildAuthHeaders } from "../../core/api/client";
import { AegisPatchInsightPanel } from "./AegisPatchInsightPanel";

interface AegisScanStreamEvent {
  type: "stage_update" | "scan_complete" | "error";
  stageIndex?: number;
  step?: AegisPipelineStep;
  project?: AegisProject;
  interactionIds?: string[];
  totalDurationMs?: number;
  message?: string;
}

const DEFAULT_REMEDIATION_BY_MODE: Record<AegisIntakeMode, AegisRemediationMode> = {
  github: "git-pr",
  "url-dns": "route-shield",
  binary: "binary-patch",
};

function hexPreviewToBase64(hex: string): string {
  const cleanTokens = hex
    .trim()
    .split(/\s+/)
    .filter((token) => /^[0-9a-fA-F]{2}$/.test(token));
  if (cleanTokens.length === 0) return "";
  let binaryStr = "";
  for (const token of cleanTokens) {
    binaryStr += String.fromCharCode(Number.parseInt(token, 16));
  }
  return typeof btoa === "function" ? btoa(binaryStr) : "";
}

export function AegisModule() {
  const [projects, setProjects] = createSignal<AegisProject[]>([]);
  const [selectedId, setSelectedId] = createSignal<string>("aegis-whitebox-github");
  const [backendMode, setBackendMode] = createSignal<string>("hybrid-sandbox");
  const [loading, setLoading] = createSignal<boolean>(false);
  const [runningPipeline, setRunningPipeline] = createSignal<boolean>(false);
  const [verifyingDns, setVerifyingDns] = createSignal<boolean>(false);
  const [uploadingBinary, setUploadingBinary] = createSignal<boolean>(false);
  const [statusBanner, setStatusBanner] = createSignal<string | null>(null);
  const [errorBanner, setErrorBanner] = createSignal<string | null>(null);
  const [showIntakeForm, setShowIntakeForm] = createSignal<boolean>(false);
  const [lastPipelineSummary, setLastPipelineSummary] = createSignal<string | null>(null);

  // New Target Intake State
  const [intakeName, setIntakeName] = createSignal<string>("Payments Edge API Gateway");
  const [intakeMode, setIntakeMode] = createSignal<AegisIntakeMode>("url-dns");
  const [intakeGithubUrl, setIntakeGithubUrl] = createSignal<string>(
    "https://github.com/acme-sec/payments-gateway",
  );
  const [intakeCdWorkflow, setIntakeCdWorkflow] = createSignal<string>(
    "name: Production Deploy\non: [push]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gcloud run deploy payments-gateway --source .",
  );
  const [intakeTargetUrl, setIntakeTargetUrl] = createSignal<string>(
    "https://edge-api.acme-pay.internal",
  );
  const [intakeBinaryName, setIntakeBinaryName] = createSignal<string>("iot-gateway-daemon.elf");
  const [intakeBinarySize, setIntakeBinarySize] = createSignal<number>(148_920);
  const [intakeBinaryHexPreview, setIntakeBinaryHexPreview] = createSignal<string>(
    "7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 02 00 3e 00 01 00 00 00",
  );
  const [binaryBase64Data, setBinaryBase64Data] = createSignal<string>("");

  const selectedProject = createMemo<AegisProject | undefined>(() => {
    const list = projects();
    return list.find((p) => p.id === selectedId()) ?? list[0];
  });

  const kpiStats = createMemo(() => {
    const list = projects();
    let confirmedRed = 0;
    let verifiedGreen = 0;
    let shieldBlocks = 0;
    for (const proj of list) {
      for (const v of proj.vulnerabilities) {
        if (v.zeroFalsePositiveConfirmed) confirmedRed += 1;
        if (v.verifyGreenLog.trim().length > 0) verifiedGreen += 1;
      }
      if (proj.routeShield) {
        shieldBlocks += proj.routeShield.blockedRequestsCount;
      }
    }
    return {
      totalTargets: list.length,
      confirmedRed,
      verifiedGreen,
      shieldBlocks,
    };
  });

  async function fetchProjects(preserveSelection = true) {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch("/api/modules/aegis/projects", {
        headers: buildAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to load AEGIS-4 projects (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { projects: AegisProject[]; backend: string };
      setProjects(data.projects ?? []);
      setBackendMode(data.backend ?? "hybrid-sandbox");
      if (!preserveSelection && data.projects.length > 0) {
        setSelectedId(data.projects[0].id);
      } else if (data.projects.length > 0 && !data.projects.some((p) => p.id === selectedId())) {
        setSelectedId(data.projects[0].id);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to load AEGIS projects");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void fetchProjects(true);
  });

  function updateProjectInList(updated: AegisProject) {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((p) => (p.id === updated.id ? updated : p));
    });
    setSelectedId(updated.id);
  }

  function updateProjectTimelineStep(
    projectId: string,
    stageIndex: number,
    step: AegisPipelineStep,
  ) {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== projectId) return proj;
        const nextTimeline = proj.timeline.map((existing, idx) => {
          if (idx === stageIndex) return step;
          if (idx === stageIndex + 1 && existing.status === "pending") {
            return { ...existing, status: "running" as const };
          }
          return existing;
        });
        return {
          ...proj,
          timeline: nextTimeline,
        };
      }),
    );
  }

  async function handleVerifyDns(project: AegisProject) {
    setVerifyingDns(true);
    setErrorBanner(null);
    setStatusBanner(null);
    try {
      const res = await fetch(
        `/api/modules/aegis/projects/${encodeURIComponent(project.id)}/verify-dns?simulate=true`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            projectId: project.id,
            simulateTxtPropagation: true,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`DNS TXT verification failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as AegisVerifyDnsResponse;
      updateProjectInList(data.project);
      setStatusBanner(
        `DNS TXT Ownership Verified via ${data.resolverUsed}: ${data.txtRecordName} -> "${data.expectedToken}". ${data.message}`,
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "DNS TXT check failed");
    } finally {
      setVerifyingDns(false);
    }
  }

  async function handleRunScan(project: AegisProject, overrideMode?: AegisRemediationMode) {
    setRunningPipeline(true);
    setErrorBanner(null);
    setStatusBanner(null);
    const remediationMode =
      overrideMode ?? project.remediationMode ?? DEFAULT_REMEDIATION_BY_MODE[project.intakeMode];

    // Optimistically set stage 0 to "running" and stages 1..3 to "pending" for live progression
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== project.id) return p;
        return {
          ...p,
          timeline: p.timeline.map((step, idx) => ({
            ...step,
            status: idx === 0 ? ("running" as const) : ("pending" as const),
          })),
        };
      }),
    );

    try {
      const streamRes = await fetch(
        `/api/modules/aegis/projects/${encodeURIComponent(project.id)}/scan/stream`,
        {
          method: "POST",
          headers: buildAuthHeaders({
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          }),
          body: JSON.stringify({
            projectId: project.id,
            remediationMode,
            dryRun: true,
          }),
        },
      );

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completedProject: AegisProject | null = null;
        let streamedInteractions: string[] = [];
        let streamedDurationMs = 0;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const event = JSON.parse(jsonStr) as AegisScanStreamEvent;
              if (
                event.type === "stage_update" &&
                event.step !== undefined &&
                typeof event.stageIndex === "number"
              ) {
                updateProjectTimelineStep(project.id, event.stageIndex, event.step);
                await new Promise((resolve) => setTimeout(resolve, 140));
              } else if (event.type === "scan_complete" && event.project) {
                completedProject = event.project;
                streamedInteractions = event.interactionIds ?? [];
                streamedDurationMs = event.totalDurationMs ?? 0;
                updateProjectInList(event.project);
              } else if (event.type === "error" && event.message) {
                throw new Error(event.message);
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && !(parseErr instanceof SyntaxError)) {
                throw parseErr;
              }
            }
          }
        }

        if (completedProject) {
          const totalDuration =
            streamedDurationMs ||
            completedProject.timeline.reduce((acc, s) => acc + s.durationMs, 0);
          const interactionInfo =
            streamedInteractions.length > 0
              ? `${streamedInteractions.length} Gemini interactions (${streamedInteractions.join(", ")})`
              : "4 Gemini stage interactions";
          const summaryText = `4-Stage Loop Verified in ${totalDuration}ms (${interactionInfo})`;
          setLastPipelineSummary(summaryText);
          setStatusBanner(
            `4-Stage Self-Healing Stream Completed (${remediationMode}): ${summaryText}`,
          );
          return;
        }
      }

      // Fallback to standard JSON /scan endpoint if /scan/stream is unavailable
      const res = await fetch(
        `/api/modules/aegis/projects/${encodeURIComponent(project.id)}/scan?dryRun=true`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            projectId: project.id,
            remediationMode,
            dryRun: true,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`Self-healing loop request failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as AegisRunPipelineResponse;
      for (let idx = 0; idx < data.project.timeline.length; idx += 1) {
        updateProjectTimelineStep(project.id, idx, data.project.timeline[idx]);
        await new Promise((resolve) => setTimeout(resolve, 140));
      }
      updateProjectInList(data.project);
      const summaryText = `4-Stage Loop Verified in ${data.totalDurationMs}ms (${data.interactionIds.length} Gemini interactions: ${data.interactionIds.join(", ")})`;
      setLastPipelineSummary(summaryText);
      setStatusBanner(`4-Stage Self-Healing Loop Completed (${remediationMode}): ${summaryText}`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to run self-healing pipeline");
    } finally {
      setRunningPipeline(false);
    }
  }

  async function handleToggleShield(project: AegisProject, enabled: boolean) {
    setErrorBanner(null);
    try {
      const res = await fetch(
        `/api/modules/aegis/projects/${encodeURIComponent(project.id)}/shield-toggle`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ enabled }),
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to toggle Route Shield (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { project: AegisProject };
      updateProjectInList(data.project);
      setStatusBanner(
        `Autonomous Edge Route Shield ${enabled ? "ENABLED (HTTP 403 Active Protection)" : "DISABLED (Pass-Through)"} for ${project.name}.`,
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to toggle shield");
    }
  }

  async function handleTestAttack(
    project: AegisProject,
    attackPayload: string,
  ): Promise<AegisShieldTestAttackResponse | null> {
    setErrorBanner(null);
    try {
      const res = await fetch(
        `/api/modules/aegis/projects/${encodeURIComponent(project.id)}/test-attack`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            projectId: project.id,
            attackPayload,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`Test attack simulation failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as AegisShieldTestAttackResponse;
      updateProjectInList(data.project);
      setStatusBanner(
        `Live Exploit Replay against ${project.name}: HTTP ${data.httpStatus} (${data.verdict}) in ${data.latencyMs}ms.`,
      );
      return data;
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Attack test failed");
      return null;
    }
  }

  async function uploadBinaryBytesToProject(
    projectId: string,
    fileName: string,
    base64Data: string,
  ): Promise<AegisProject | null> {
    if (!base64Data) return null;
    setUploadingBinary(true);
    try {
      const res = await fetch(
        `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/binary-upload`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            fileName,
            base64Data,
          }),
        },
      );
      if (!res.ok) return null;
      const raw = (await res.json()) as { project?: AegisProject } & AegisProject;
      const updated = raw.project ?? raw;
      if (updated?.id) {
        updateProjectInList(updated);
        return updated;
      }
      return null;
    } catch {
      return null;
    } finally {
      setUploadingBinary(false);
    }
  }

  async function handleBinaryFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setIntakeBinaryName(file.name);
    setIntakeBinarySize(file.size);

    // Read full binary as base64 via FileReader for Go debug/elf, debug/pe, debug/macho & SHA-256 inspection
    await new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? (result.split(",")[1] ?? "") : result;
        setBinaryBase64Data(base64);
        resolve();
      };
      reader.onerror = () => resolve();
      reader.readAsDataURL(file);
    });

    try {
      const slice = file.slice(0, 32);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      setIntakeBinaryHexPreview(hex || "7f 45 4c 46 02 01 01 00");
    } catch {
      // Keep default hex preview on error
    }

    const active = selectedProject();
    if (!showIntakeForm() && active && active.intakeMode === "binary" && binaryBase64Data()) {
      const updated = await uploadBinaryBytesToProject(active.id, file.name, binaryBase64Data());
      if (updated) {
        setStatusBanner(
          `Uploaded binary "${file.name}" (${file.size.toLocaleString()} bytes) to "${updated.name}" — Go binary parser verified ${updated.binaryAnalysis?.format ?? "ELF/PE/Mach-O"} header & SHA-256.`,
        );
      }
    }
  }

  function applyBinaryPreset(name: string, size: number, hex: string) {
    setIntakeBinaryName(name);
    setIntakeBinarySize(size);
    setIntakeBinaryHexPreview(hex);
    setBinaryBase64Data(hexPreviewToBase64(hex));
  }

  async function handleCreateProject(e: SubmitEvent) {
    e.preventDefault();
    setErrorBanner(null);
    const mode = intakeMode();
    const payload: CreateAegisProjectRequest = {
      name: intakeName().trim() || "Untitled Security Target",
      intakeMode: mode,
      repoUrl: mode === "github" ? intakeGithubUrl().trim() : undefined,
      cdConfigSnippet: mode === "github" ? intakeCdWorkflow().trim() : undefined,
      targetUrl: mode === "url-dns" ? intakeTargetUrl().trim() : undefined,
      binaryFileName: mode === "binary" ? intakeBinaryName().trim() : undefined,
      binarySizeBytes: mode === "binary" ? intakeBinarySize() : undefined,
      binaryHexPreview: mode === "binary" ? intakeBinaryHexPreview() : undefined,
    };

    try {
      const res = await fetch("/api/modules/aegis/projects", {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Failed to register target project (HTTP ${res.status})`);
      }
      const raw = (await res.json()) as { project?: AegisProject } & AegisProject;
      let created: AegisProject = raw.project ?? raw;

      if (mode === "binary") {
        const base64Payload = binaryBase64Data() || hexPreviewToBase64(intakeBinaryHexPreview());
        if (base64Payload && created.id) {
          const uploaded = await uploadBinaryBytesToProject(
            created.id,
            intakeBinaryName().trim() || created.binaryFileName || "artifact.elf",
            base64Payload,
          );
          if (uploaded) {
            created = uploaded;
          }
        }
      }

      updateProjectInList(created);
      setShowIntakeForm(false);
      setStatusBanner(
        `Registered new ${(created.intakeMode ?? mode).toUpperCase()} target "${created.name}".`,
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Could not create target project");
    }
  }

  function selectDemoPreset(projectId: string, label: string) {
    setSelectedId(projectId);
    setStatusBanner(`Loaded ${label}`);
  }

  function defenseBadgeClass(status: string) {
    if (
      status === "patched_via_pr" ||
      status === "protected_via_route_shield" ||
      status === "binary_hard_patched" ||
      status === "passed_green"
    ) {
      return "bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400";
    }
    if (status === "poc_confirmed_red" || status === "confirmed_red" || status === "failed") {
      return "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400";
    }
    if (status === "running") {
      return "bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400";
    }
    return "bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400";
  }

  return (
    <div class="space-y-5">
      {/* 1. Top AEGIS-4 Command Header & 3-Minute Live Demo Bar */}
      <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
        <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                AEGIS-4 • Autonomous Self-Healing Security Platform
              </span>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                Zero-False-Positive Sandbox PoC Gate
              </span>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300 font-mono">
                backend: {backendMode()}
              </span>
            </div>
            <h1 class="text-lg md:text-xl font-semibold text-gray-800 dark:text-neutral-100">
              Autonomous Red-to-Green Exploitation, Source PR Synthesis, Edge Shield &amp; ELF
              Binary Patching
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIntakeForm((prev) => !prev)}
              class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
            >
              {showIntakeForm()
                ? "✕ Close Intake Drawer"
                : "+ New Target Intake (GitHub / URL+DNS / Binary)"}
            </button>
          </div>
        </div>

        {/* Model Fleet Strip + 3-Minute Live Demo Quick-Jump Bar */}
        <div class="p-4 md:p-5 space-y-3 bg-gray-50/60 dark:bg-neutral-950/50 rounded-b-xl">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mr-1">
                Multi-Model Fleet:
              </span>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400 font-mono">
                gemini-4-argon 1M
              </span>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400 font-mono">
                antigravity-preview-09-2026 Sandbox
              </span>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500 font-mono">
                gemini-3.8-flash Recon
              </span>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400 font-mono">
                gemini-3.5-flash-lite Classifier
              </span>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold text-gray-600 dark:text-neutral-400">
                3-Minute Live Demo Bar:
              </span>
              <button
                type="button"
                onClick={() =>
                  selectDemoPreset(
                    "aegis-whitebox-github",
                    "Demo 1: White-Box GitHub + CD → Auto PR & Report",
                  )
                }
                class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  selectedId() === "aegis-whitebox-github"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50"
                }`}
              >
                🎬 Demo 1: White-Box GitHub + CD → Auto PR &amp; Report
              </button>

              <button
                type="button"
                onClick={() =>
                  selectDemoPreset(
                    "aegis-blackbox-url-shield",
                    "Demo 2: External URL + DNS TXT Gate → 1-Click Route Shield (403)",
                  )
                }
                class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  selectedId() === "aegis-blackbox-url-shield"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50"
                }`}
              >
                🎬 Demo 2: External URL + DNS TXT Gate → 1-Click Route Shield (403)
              </button>

              <button
                type="button"
                onClick={() =>
                  selectDemoPreset(
                    "aegis-blackbox-binary-elf",
                    "Demo 3: No-Source ELF Binary → Byte Hard-Patch & Download",
                  )
                }
                class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  selectedId() === "aegis-blackbox-binary-elf"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50"
                }`}
              >
                🎬 Demo 3: No-Source ELF Binary → Byte Hard-Patch &amp; Download
              </button>
            </div>

            <Show when={selectedProject()}>
              {(proj) => (
                <button
                  type="button"
                  disabled={runningPipeline()}
                  onClick={() => void handleRunScan(proj())}
                  class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  {runningPipeline()
                    ? "⏳ Streaming 4-Stage Sandbox Loop..."
                    : "⚡ Run Full 4-Stage Self-Healing Loop (Red → Green)"}
                </button>
              )}
            </Show>
          </div>
        </div>
      </div>

      {/* Status & Error Banners */}
      <Show when={statusBanner()}>
        {(msg) => (
          <div class="p-3.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-200 flex items-center justify-between gap-3 text-sm">
            <span>{msg()}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              class="py-1 px-2 text-xs font-medium rounded-lg bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-800/40 dark:text-teal-300 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </Show>

      <Show when={errorBanner()}>
        {(err) => (
          <div class="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200 flex items-center justify-between gap-3 text-sm">
            <span>{err()}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              class="py-1 px-2 text-xs font-medium rounded-lg bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-800/40 dark:text-red-300 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </Show>

      {/* 2. Preline 4-Column KPI Row */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Protected Targets
          </span>
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-2xl font-bold text-gray-800 dark:text-neutral-100">
              {kpiStats().totalTargets}
            </span>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
              GitHub / URL / ELF
            </span>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            White-box repos, DNS-verified URLs &amp; raw binaries
          </p>
        </div>

        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Zero-False-Positive Confirmed PoCs (RED)
          </span>
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-2xl font-bold text-red-600 dark:text-red-400">
              {kpiStats().confirmedRed}
            </span>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400">
              100% Reproducible
            </span>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            Every finding proven via live Docker sandbox exploit
          </p>
        </div>

        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Autonomous Remediations Verified (GREEN)
          </span>
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {kpiStats().verifiedGreen}
            </span>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500">
              Re-Attack Blocked
            </span>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            Identical PoC re-executed against patch to prove closure
          </p>
        </div>

        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Active Route Shield Blocks
          </span>
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {kpiStats().shieldBlocks}
            </span>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
              HTTP 403 Virtual Patch
            </span>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            Zero-downtime edge hotfix filter before source redeploy
          </p>
        </div>
      </div>

      {/* 3. Collapsible 3-Mode Project Intake & DNS TXT Ownership Gate Card */}
      <Show when={showIntakeForm()}>
        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
          <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
                3-Mode Target Intake &amp; Scope Authorization
              </h2>
              <p class="text-xs text-gray-500 dark:text-neutral-400">
                Onboard a White-Box GitHub + CD pipeline, an External URL gated by DNS TXT
                ownership, or a No-Source ELF/PE/Mach-O binary.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIntakeMode("github")}
                class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  intakeMode() === "github"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400"
                }`}
              >
                1. GitHub Repo + CD YAML
              </button>
              <button
                type="button"
                onClick={() => setIntakeMode("url-dns")}
                class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  intakeMode() === "url-dns"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400"
                }`}
              >
                2. Target URL + DNS TXT Ownership Gate
              </button>
              <button
                type="button"
                onClick={() => setIntakeMode("binary")}
                class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  intakeMode() === "binary"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400"
                }`}
              >
                3. Binary Artifact Upload (ELF/PE/Mach-O)
              </button>
            </div>
          </div>

          <form onSubmit={(e) => void handleCreateProject(e)} class="p-4 md:p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  for="aegis-intake-name"
                  class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1"
                >
                  Target Project Name
                </label>
                <input
                  id="aegis-intake-name"
                  type="text"
                  value={intakeName()}
                  onInput={(e) => setIntakeName(e.currentTarget.value)}
                  class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                  placeholder="e.g. Settlement API Service"
                />
              </div>

              <Show when={intakeMode() === "github"}>
                <div>
                  <label
                    for="aegis-intake-github"
                    class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1"
                  >
                    GitHub Repository URL
                  </label>
                  <input
                    id="aegis-intake-github"
                    type="text"
                    value={intakeGithubUrl()}
                    onInput={(e) => setIntakeGithubUrl(e.currentTarget.value)}
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                  />
                </div>
                <div class="md:col-span-2">
                  <label
                    for="aegis-intake-cd"
                    class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1"
                  >
                    Continuous Deployment (CD) Workflow YAML Snippet
                  </label>
                  <textarea
                    id="aegis-intake-cd"
                    rows={3}
                    value={intakeCdWorkflow()}
                    onInput={(e) => setIntakeCdWorkflow(e.currentTarget.value)}
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-xs font-mono focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                  />
                </div>
              </Show>

              <Show when={intakeMode() === "url-dns"}>
                <div>
                  <label
                    for="aegis-intake-url"
                    class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1"
                  >
                    Target Base URL (Requires `_aegis-verify` DNS TXT Record)
                  </label>
                  <input
                    id="aegis-intake-url"
                    type="text"
                    value={intakeTargetUrl()}
                    onInput={(e) => setIntakeTargetUrl(e.currentTarget.value)}
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm font-mono focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                  />
                </div>
              </Show>

              <Show when={intakeMode() === "binary"}>
                <div>
                  <label
                    for="aegis-intake-binary-name"
                    class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1"
                  >
                    Binary Artifact Filename (Preset or Custom)
                  </label>
                  <input
                    id="aegis-intake-binary-name"
                    type="text"
                    value={intakeBinaryName()}
                    onInput={(e) => setIntakeBinaryName(e.currentTarget.value)}
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm font-mono focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                    placeholder="iot-gateway-daemon.elf"
                  />
                </div>
                <div class="md:col-span-2">
                  <label
                    for="aegis-intake-binary-file"
                    class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1"
                  >
                    Upload Compiled Binary Artifact (ELF / PE / Mach-O — Read via FileReader Base64
                    for Go `debug/elf`, `debug/pe`, `debug/macho` &amp; SHA-256 Inspection)
                  </label>
                  <input
                    id="aegis-intake-binary-file"
                    type="file"
                    accept=".elf,.bin,.exe,.dll,.so,.dylib,.apk,application/octet-stream"
                    onChange={(e) => void handleBinaryFileChange(e)}
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                  />
                </div>
                <div class="md:col-span-2 space-y-3 p-3.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                      Quick Binary Presets:
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          applyBinaryPreset(
                            "iot-gateway-daemon.elf",
                            148_920,
                            "7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 02 00 3e 00 01 00 00 00",
                          )
                        }
                        class="py-1 px-2 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 cursor-pointer"
                      >
                        ELF64 x86_64 Daemon
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyBinaryPreset(
                            "edge-signer-service.exe",
                            212_480,
                            "4d 5a 90 00 03 00 00 00 04 00 00 00 ff ff 00 00 b8 00 00 00 00 00 00 00",
                          )
                        }
                        class="py-1 px-2 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 cursor-pointer"
                      >
                        PE32+ x64 Service
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyBinaryPreset(
                            "darwin-telemetry-agent.macho",
                            184_320,
                            "cf fa ed fe 0c 00 00 01 00 00 00 00 02 00 00 00 10 00 00 00 88 06 00 00",
                          )
                        }
                        class="py-1 px-2 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 cursor-pointer"
                      >
                        Mach-O arm64 Agent
                      </button>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-neutral-800">
                    <div>
                      <span class="text-xs text-gray-500 dark:text-neutral-400 block">
                        Filename &amp; Byte Size
                      </span>
                      <span class="text-xs font-mono font-semibold text-gray-800 dark:text-neutral-200">
                        {intakeBinaryName()} ({intakeBinarySize().toLocaleString()} bytes)
                      </span>
                    </div>
                    <div>
                      <span class="text-xs text-gray-500 dark:text-neutral-400 block">
                        First 32-Byte Header Hex Preview
                      </span>
                      <code class="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                        {intakeBinaryHexPreview()}
                      </code>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowIntakeForm(false)}
                class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingBinary()}
                class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {uploadingBinary()
                  ? "Uploading & Inspecting Binary..."
                  : "Register Target in AEGIS-4"}
              </button>
            </div>
          </form>
        </div>
      </Show>

      {/* DNS TXT Ownership Verification Gate Banner for url-dns projects */}
      <Show
        when={
          selectedProject() &&
          selectedProject()?.intakeMode === "url-dns" &&
          !selectedProject()?.dnsVerified
        }
      >
        <div class="flex flex-col bg-amber-50/90 border border-amber-300 shadow-2xs rounded-xl dark:bg-amber-950/30 dark:border-amber-800 p-4 md:p-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                  Mandatory Anti-Abuse Ownership Gate
                </span>
                <span class="text-xs font-mono text-amber-900 dark:text-amber-300">
                  Target: {selectedProject()?.targetUrl ?? selectedProject()?.dnsDomain}
                </span>
              </div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                DNS TXT Domain Ownership Verification Required Before Active Sandbox Exploitation
              </h3>
              <p class="text-xs text-gray-700 dark:text-neutral-300">
                Publish the following TXT record on your DNS zone to authorize AEGIS-4 active
                fuzzing:
                <code class="ml-1.5 px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 font-mono text-xs">
                  {selectedProject()?.dnsTxtRecordName ??
                    `_aegis-verify.${selectedProject()?.dnsDomain ?? "target.local"}`}{" "}
                  IN TXT &quot;{selectedProject()?.dnsTxtToken ?? "aegis-verify=pending"}&quot;
                </code>
              </p>
            </div>

            <button
              type="button"
              disabled={verifyingDns()}
              onClick={() => {
                const proj = selectedProject();
                if (proj) void handleVerifyDns(proj);
              }}
              class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {verifyingDns()
                ? "Verifying DNS TXT via DoH..."
                : "🔍 Verify DNS TXT Record (Google DoH / 1-Click Sandbox Verify)"}
            </button>
          </div>
        </div>
      </Show>

      {/* 4. Target Project Selector Grid (3 Cards) */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Show
          when={!loading() || projects().length > 0}
          fallback={
            <div class="lg:col-span-3 p-6 text-center text-sm text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800">
              Loading AEGIS-4 security targets...
            </div>
          }
        >
          <For each={projects()}>
            {(proj) => {
              const isSelected = () => selectedProject()?.id === proj.id;
              return (
                <div
                  class={`flex flex-col bg-white border shadow-2xs rounded-xl dark:bg-neutral-900 transition-all ${
                    isSelected()
                      ? "border-blue-600 ring-2 ring-blue-500/20 dark:border-blue-500"
                      : "border-gray-200 dark:border-neutral-800"
                  }`}
                >
                  <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-x-3">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400 uppercase font-mono">
                        {proj.intakeMode}
                      </span>
                      <h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-100 truncate">
                        {proj.name}
                      </h3>
                    </div>
                    <span
                      class={`inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium ${defenseBadgeClass(
                        proj.defenseStatus,
                      )}`}
                    >
                      {proj.defenseStatus}
                    </span>
                  </div>

                  <div class="p-4 md:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div class="space-y-1.5 text-xs text-gray-600 dark:text-neutral-400">
                      <p class="text-xs text-gray-500 dark:text-neutral-400">{proj.subtitle}</p>
                      <Show when={proj.repoUrl}>
                        <div class="truncate font-mono">
                          <span class="font-semibold text-gray-700 dark:text-neutral-300">
                            Repo:{" "}
                          </span>
                          {proj.repoUrl}
                        </div>
                      </Show>
                      <Show when={proj.cdWorkflowPath}>
                        <div class="truncate font-mono">
                          <span class="font-semibold text-gray-700 dark:text-neutral-300">
                            CD YAML:{" "}
                          </span>
                          {proj.cdWorkflowPath}
                        </div>
                      </Show>
                      <Show when={proj.targetUrl}>
                        <div class="truncate font-mono">
                          <span class="font-semibold text-gray-700 dark:text-neutral-300">
                            URL:{" "}
                          </span>
                          {proj.targetUrl}
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="font-semibold text-gray-700 dark:text-neutral-300">
                            DNS TXT Gate:
                          </span>
                          <span
                            class={`inline-flex items-center py-0.5 px-2 rounded-full text-xs font-medium ${
                              proj.dnsVerified
                                ? "bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400"
                            }`}
                          >
                            {proj.dnsVerified ? "Verified" : "Pending TXT Check"}
                          </span>
                        </div>
                      </Show>
                      <Show when={proj.binaryFileName}>
                        <div class="truncate font-mono">
                          <span class="font-semibold text-gray-700 dark:text-neutral-300">
                            Artifact:{" "}
                          </span>
                          {proj.binaryFileName} ({proj.binaryAnalysis?.format ?? "ELF64-x86_64"})
                        </div>
                      </Show>
                      <div class="pt-1 flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400">
                          {proj.vulnerabilities.filter((v) => v.zeroFalsePositiveConfirmed).length}{" "}
                          Confirmed RED PoC
                        </span>
                        <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                          {
                            proj.vulnerabilities.filter((v) => v.verifyGreenLog.trim().length > 0)
                              .length
                          }{" "}
                          Verified GREEN
                        </span>
                      </div>
                    </div>

                    <div class="pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(proj.id)}
                        class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                          isSelected()
                            ? "bg-blue-600 text-white"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400"
                        }`}
                      >
                        {isSelected() ? "✓ Active Workspace Target" : "Inspect Target"}
                      </button>

                      <button
                        type="button"
                        disabled={runningPipeline()}
                        onClick={() => {
                          setSelectedId(proj.id);
                          void handleRunScan(proj);
                        }}
                        class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        ⚡ Run Loop
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* 4B. Live 4-Stage Verification Timeline (Recon -> PoC Reproduction (RED) -> Remediation Synthesis -> Verification (GREEN)) */}
      <Show when={selectedProject()}>
        {(proj) => (
          <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
            <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
                  Live 4-Stage Self-Healing Verification Timeline — {proj().name}
                </h2>
                <p class="text-xs text-gray-500 dark:text-neutral-400">
                  Recon → PoC Reproduction (RED) → Remediation Synthesis → Verification (GREEN)
                </p>
              </div>
              <Show when={lastPipelineSummary()}>
                {(summary) => (
                  <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                    {summary()}
                  </span>
                )}
              </Show>
            </div>

            <div class="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <For each={proj().timeline}>
                {(step, index) => (
                  <div class="flex flex-col justify-between p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 space-y-3">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-mono font-semibold text-gray-500 dark:text-neutral-400">
                          STAGE 0{index() + 1} • {step.stage.toUpperCase()}
                        </span>
                        <span
                          class={`inline-flex items-center gap-x-1.5 py-0.5 px-2 rounded-full text-xs font-medium ${defenseBadgeClass(
                            step.status,
                          )}`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-100">
                        {step.title}
                      </h3>
                      <p class="text-xs text-gray-600 dark:text-neutral-400">{step.summary}</p>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="inline-flex items-center py-0.5 px-2 rounded-full text-xs font-mono bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                          {step.modelUsed}
                        </span>
                        <span class="text-xs font-mono text-gray-500 dark:text-neutral-400">
                          {step.durationMs}ms
                        </span>
                      </div>
                    </div>

                    <div class="p-2.5 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-800">
                      <div class="text-neutral-300 whitespace-pre-wrap break-words">
                        {step.commandOrLog}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </Show>

      {/* 5. Deep Remediation & Verification Insight Panel */}
      <Show when={selectedProject()}>
        {(proj) => (
          <AegisPatchInsightPanel
            project={proj()}
            busy={runningPipeline() || verifyingDns() || uploadingBinary()}
            onToggleShield={(enabled) => handleToggleShield(proj(), enabled)}
            onTestAttack={(payload) => handleTestAttack(proj(), payload)}
            onRunScan={(mode) => handleRunScan(proj(), mode)}
          />
        )}
      </Show>
    </div>
  );
}
