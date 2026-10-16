import type {
  ArgonThinkingLevel,
  EffortRouteDecision,
  ParallelSwarmRequest,
  ParallelSwarmResponse,
  ParallelTaskInput,
  ParallelTaskResult,
  TaskComplexityHint,
  VerifyCritiquePolishResponse,
} from "@deepmind/shared";
import { createMemo, createSignal, For, Show } from "solid-js";
import { buildAuthHeaders } from "../../core/api/client";

const DEFAULT_SHARED_CONTEXT = `Monorepo Architecture Contract:
- Runtime: Bun + TypeScript (packages/shared, packages/argon-orchestrator, apps/web) & Go 1.27 + Gin (apps/api)
- Design System: Preline UI (preline.co) + Tailwind CSS v4 (@tailwindcss/vite)
- Primary Model: gemini-4-argon via Interactions API (POST /v1beta/interactions)
- Managed Sandbox Agent: antigravity-preview-09-2026 (environment: "remote")
- Strict Rules: Never send temperature, top_p, top_k, or explicit cachedContents. Rely on 95% implicit caching and previous_interaction_id context forking.`;

const SAMPLE_DRAFT_SPEC = `// Preline UI + Go Gin Feature Spec: Real-Time Incident Triage Card
export interface IncidentCardProps {
  id: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  latencyMs: number;
}
// Goal: Audit Preline UI hierarchy, dark mode contrast, and Go Gin SSE error recovery.`;

const INITIAL_TASKS: ParallelTaskInput[] = [
  {
    id: "worker-domain",
    label: "Core Domain & Shared Contracts Architect",
    prompt:
      "Design zero-overhead TypeScript & Go struct alignment for ParallelSwarmRequest, StepSummary, and SSE event payloads.",
    thinkingLevel: "low",
    useManagedAgent: false,
    background: false,
  },
  {
    id: "worker-go-gin",
    label: "Go 1.27 Gin Goroutine Pool Engineer",
    prompt:
      "Audit the bounded channel semaphore and fan-out pattern for dispatching concurrent Gemini 4 Argon interactions.",
    thinkingLevel: "low",
    useManagedAgent: false,
    background: false,
  },
  {
    id: "worker-preline-ui",
    label: "Preline UI (preline.co) + SolidJS Specialist",
    prompt:
      "Review Preline UI card density, dark-mode border tokens, and zero-VDOM SolidJS signal updates for live SSE streams.",
    thinkingLevel: "low",
    useManagedAgent: false,
    background: false,
  },
  {
    id: "worker-critic-qa",
    label: "Automated Verify-Critique-Polish Auditor",
    prompt:
      "Verify Gemini 4 Argon parameter hygiene (no temperature/top_p/top_k, background=true for >65536 tokens) and edge-case recovery.",
    thinkingLevel: "high",
    useManagedAgent: false,
    background: false,
  },
];

export function SwarmModule() {
  // Section 1: Effort Router + Verify-Critique-Polish Studio State
  const [artifactTitle, setArtifactTitle] = createSignal("Preline Incident Triage Module");
  const [artifactType, setArtifactType] = createSignal<
    "ui-preline" | "api-go-gin" | "agent-unit" | "full-feature"
  >("ui-preline");
  const [complexityHint, setComplexityHint] = createSignal<TaskComplexityHint>("fast");
  const [requiresSandbox, setRequiresSandbox] = createSignal(false);
  const [requiresLongDecode, setRequiresLongDecode] = createSignal(false);
  const [draftContent, setDraftContent] = createSignal(SAMPLE_DRAFT_SPEC);
  const [routeDecision, setRouteDecision] = createSignal<EffortRouteDecision | null>(null);
  const [polishResult, setPolishResult] = createSignal<VerifyCritiquePolishResponse | null>(null);
  const [studioLoading, setStudioLoading] = createSignal(false);
  const [studioError, setStudioError] = createSignal<string | null>(null);

  // Section 2: Hyper-Parallel Swarm State
  const [sharedContext, setSharedContext] = createSignal(DEFAULT_SHARED_CONTEXT);
  const [defaultThinkingLevel, setDefaultThinkingLevel] = createSignal<ArgonThinkingLevel>("low");
  const [maxConcurrency, setMaxConcurrency] = createSignal(8);
  const [dryRun, setDryRun] = createSignal(true);
  const [tasks, setTasks] = createSignal<ParallelTaskInput[]>(INITIAL_TASKS);
  const [resultsMap, setResultsMap] = createSignal<Record<string, ParallelTaskResult>>({});
  const [rootInteractionId, setRootInteractionId] = createSignal<string | undefined>(undefined);
  const [totalDurationMs, setTotalDurationMs] = createSignal<number | undefined>(undefined);
  const [isRunning, setIsRunning] = createSignal(false);
  const [activeMode, setActiveMode] = createSignal<"stream" | "batch" | null>(null);
  const [errorBanner, setErrorBanner] = createSignal<string | null>(null);

  const orderedResults = createMemo(() => {
    const map = resultsMap();
    return tasks()
      .map((t) => map[t.id])
      .filter((r): r is ParallelTaskResult => Boolean(r));
  });

  const completedCount = createMemo(
    () => orderedResults().filter((r) => r.status === "completed").length,
  );

  const handleRouteEffort = async () => {
    setStudioLoading(true);
    setStudioError(null);
    try {
      const res = await fetch("/api/modules/pipeline/route", {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt: draftContent(),
          complexityHint: complexityHint(),
          requiresSandbox: requiresSandbox(),
          requiresLongDecode: requiresLongDecode(),
        }),
      });
      if (!res.ok) {
        throw new Error(`Route HTTP ${res.status}`);
      }
      const data = (await res.json()) as EffortRouteDecision;
      setRouteDecision(data);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : String(err));
    } finally {
      setStudioLoading(false);
    }
  };

  const handleRunPolishLoop = async () => {
    setStudioLoading(true);
    setStudioError(null);
    try {
      const query = dryRun() ? "?dryRun=true" : "";
      const res = await fetch(`/api/modules/pipeline/polish${query}`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          artifactTitle: artifactTitle(),
          artifactType: artifactType(),
          draftContent: draftContent(),
          sharedContext: sharedContext(),
          dryRun: dryRun(),
        }),
      });
      if (!res.ok) {
        throw new Error(`Polish HTTP ${res.status}`);
      }
      const data = (await res.json()) as VerifyCritiquePolishResponse;
      setPolishResult(data);
      setRouteDecision(data.routeUsed);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : String(err));
    } finally {
      setStudioLoading(false);
    }
  };

  const addTask = () => {
    const nextIdx = tasks().length + 1;
    setTasks((prev) => [
      ...prev,
      {
        id: `worker-${nextIdx}-${Date.now().toString(36).slice(-3)}`,
        label: `Parallel Micro-Unit #${nextIdx}`,
        prompt:
          "Implement isolated feature module unit with Preline UI components and zero file conflicts.",
        thinkingLevel: defaultThinkingLevel(),
        useManagedAgent: false,
        background: false,
      },
    ]);
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTask = <K extends keyof ParallelTaskInput>(
    id: string,
    key: K,
    value: ParallelTaskInput[K],
  ) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
  };

  const buildPayload = (): ParallelSwarmRequest => ({
    sharedContext: sharedContext().trim() || undefined,
    model: "gemini-4-argon",
    defaultThinkingLevel: defaultThinkingLevel(),
    maxConcurrency: maxConcurrency(),
    tasks: tasks().map((t) => ({
      ...t,
      maxOutputTokens: t.background ? 262144 : 65536,
    })),
  });

  const runBatchSwarm = async () => {
    if (isRunning() || tasks().length === 0) return;
    setIsRunning(true);
    setActiveMode("batch");
    setErrorBanner(null);
    setResultsMap({});
    setRootInteractionId(undefined);
    setTotalDurationMs(undefined);

    try {
      const query = dryRun() ? "?dryRun=true" : "";
      const res = await fetch(`/api/swarm/run${query}`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as ParallelSwarmResponse;
      const nextMap: Record<string, ParallelTaskResult> = {};
      for (const item of data.results) {
        nextMap[item.taskId] = item;
      }
      setResultsMap(nextMap);
      setRootInteractionId(data.rootInteractionId);
      setTotalDurationMs(data.totalDurationMs);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setActiveMode(null);
    }
  };

  const runStreamSwarm = async () => {
    if (isRunning() || tasks().length === 0) return;
    setIsRunning(true);
    setActiveMode("stream");
    setErrorBanner(null);
    setRootInteractionId(undefined);
    setTotalDurationMs(undefined);

    const queuedMap: Record<string, ParallelTaskResult> = {};
    for (const t of tasks()) {
      queuedMap[t.id] = {
        taskId: t.id,
        label: t.label,
        interactionId: "pending...",
        status: "in_progress",
        outputText: "",
        steps: [],
        durationMs: 0,
      };
    }
    setResultsMap(queuedMap);

    try {
      const query = dryRun() ? "?dryRun=true" : "";
      const res = await fetch(`/api/swarm/stream${query}`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLine += line.slice(5).trim();
            }
          }
          if (!dataLine) continue;

          if (eventName === "task_result") {
            const taskRes = JSON.parse(dataLine) as ParallelTaskResult;
            setResultsMap((prev) => ({ ...prev, [taskRes.taskId]: taskRes }));
          } else if (eventName === "swarm_complete") {
            const summary = JSON.parse(dataLine) as ParallelSwarmResponse;
            setRootInteractionId(summary.rootInteractionId);
            setTotalDurationMs(summary.totalDurationMs);
          }
        }
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setActiveMode(null);
    }
  };

  return (
    <div class="space-y-6">
      {/* Section 1: Dynamic Effort Router + Automated Verify-Critique-Polish Studio */}
      <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
        <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800/30 dark:text-indigo-300">
                Effort Router + Critic Loop
              </span>
              <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
                검증 / 검수 후 깎기 (Verify → Critique → Polish) 파이프라인 스튜디오
              </h2>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
              태스크 복잡도에 따라 최적의 Gemini 모델/Thinking Level을 라우팅하고, 병렬 크리틱
              에이전트가 UI·아키텍처·엣지케이스를 검수한 뒤 최종 결과물을 다듬습니다.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              disabled={studioLoading()}
              onClick={handleRouteEffort}
              class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 disabled:opacity-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
            >
              🧭 Route Effort Tier
            </button>
            <button
              type="button"
              disabled={studioLoading()}
              onClick={handleRunPolishLoop}
              class="py-2 px-3.5 inline-flex items-center gap-x-2 text-xs font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {studioLoading() ? "⏳ Running Critic Loop..." : "💎 Run Verify → Critique → Polish"}
            </button>
          </div>
        </div>

        <div class="p-4 md:p-5 space-y-4">
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                for="studio-artifact-title"
                class="block text-xs font-medium mb-1.5 text-gray-700 dark:text-neutral-300"
              >
                Artifact Title
              </label>
              <input
                id="studio-artifact-title"
                type="text"
                value={artifactTitle()}
                onInput={(e) => setArtifactTitle(e.currentTarget.value)}
                class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
              />
            </div>

            <div>
              <label
                for="studio-artifact-type"
                class="block text-xs font-medium mb-1.5 text-gray-700 dark:text-neutral-300"
              >
                Artifact Target Layer
              </label>
              <select
                id="studio-artifact-type"
                value={artifactType()}
                onChange={(e) =>
                  setArtifactType(
                    e.currentTarget.value as
                      | "ui-preline"
                      | "api-go-gin"
                      | "agent-unit"
                      | "full-feature",
                  )
                }
                class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
              >
                <option value="ui-preline">Preline UI (SolidJS + Tailwind v4)</option>
                <option value="api-go-gin">Go 1.27 Gin Backend Module</option>
                <option value="agent-unit">Gemini 4 Argon Agent Unit</option>
                <option value="full-feature">Full-Stack Vertical Slice</option>
              </select>
            </div>

            <div>
              <label
                for="studio-complexity-hint"
                class="block text-xs font-medium mb-1.5 text-gray-700 dark:text-neutral-300"
              >
                Effort Complexity Hint
              </label>
              <select
                id="studio-complexity-hint"
                value={complexityHint()}
                onChange={(e) => setComplexityHint(e.currentTarget.value as TaskComplexityHint)}
                class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
              >
                <option value="trivial">trivial (gemini-3.5-flash-lite • low)</option>
                <option value="fast">fast (gemini-3.8-flash • low)</option>
                <option value="standard">standard (gemini-4-argon • medium)</option>
                <option value="complex">complex (gemini-4-argon • high)</option>
                <option value="extreme">extreme (256K Long Decode • background)</option>
                <option value="sandbox">sandbox (antigravity-preview-09-2026)</option>
              </select>
            </div>

            <div class="flex flex-col justify-end gap-2">
              <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresSandbox()}
                  onChange={(e) => setRequiresSandbox(e.currentTarget.checked)}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700"
                />
                <span>Force Remote Linux Sandbox</span>
              </label>
              <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresLongDecode()}
                  onChange={(e) => setRequiresLongDecode(e.currentTarget.checked)}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700"
                />
                <span>Force 256K+ Long Decode</span>
              </label>
            </div>
          </div>

          <div>
            <label
              for="studio-draft-content"
              class="block text-xs font-medium mb-1.5 text-gray-700 dark:text-neutral-300"
            >
              Draft Code / Spec to Verify, Critique & Polish
            </label>
            <textarea
              id="studio-draft-content"
              rows={3}
              value={draftContent()}
              onInput={(e) => setDraftContent(e.currentTarget.value)}
              class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-xs font-mono focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
            />
          </div>

          <Show when={studioError()}>
            {(err) => (
              <div class="bg-red-50 border border-red-200 text-xs text-red-800 rounded-lg p-3 dark:bg-red-800/10 dark:border-red-900 dark:text-red-400">
                {err()}
              </div>
            )}
          </Show>

          <Show when={routeDecision()}>
            {(route) => (
              <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 dark:bg-blue-950/20 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                    Tier: {route().tier}
                  </span>
                  <span class="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-mono bg-white border border-gray-200 text-gray-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200">
                    model={route().model}
                  </span>
                  <span class="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-mono bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                    thinking={route().thinkingLevel}
                  </span>
                  <span class="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-mono bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300">
                    maxTokens={route().maxOutputTokens.toLocaleString()}
                  </span>
                </div>
                <span class="text-xs text-gray-600 dark:text-neutral-400">{route().rationale}</span>
              </div>
            )}
          </Show>

          <Show when={polishResult()}>
            {(res) => (
              <div class="grid lg:grid-cols-12 gap-4 pt-2">
                <div class="lg:col-span-5 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                      Parallel Critic Rubric ({res().parallelDraftsCount} Auditors)
                    </span>
                    <span class="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                      Score {res().initialScore.toFixed(1)} → {res().finalScore.toFixed(1)} / 10 (
                      {res().totalDurationMs}ms)
                    </span>
                  </div>
                  <For each={res().critiqueItems}>
                    {(item) => (
                      <div class="p-3 rounded-lg border border-gray-200 bg-gray-50/70 dark:bg-neutral-950 dark:border-neutral-800 space-y-1">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-semibold text-gray-800 dark:text-neutral-200">
                            {item.dimension}
                          </span>
                          <span class="text-xs font-mono text-blue-600 dark:text-blue-400">
                            {item.score}/10
                          </span>
                        </div>
                        <p class="text-xs text-gray-600 dark:text-neutral-400">
                          <strong>Issue:</strong> {item.issue}
                        </p>
                        <p class="text-xs text-teal-700 dark:text-teal-400">
                          <strong>Fix:</strong> {item.fixApplied}
                        </p>
                      </div>
                    )}
                  </For>
                </div>

                <div class="lg:col-span-7 flex flex-col">
                  <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400 mb-2">
                    Polished Production Output (검수 후 깎인 코드/명세)
                  </span>
                  <pre class="flex-1 p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                    {res().polishedOutput}
                  </pre>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>

      {/* Section 2: Gemini 4 Argon Hyper-Parallel Swarm Console */}
      <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-neutral-800 pb-4">
          <div class="flex flex-wrap items-center gap-4">
            <div>
              <label
                for="swarm-thinking-select"
                class="block text-xs font-medium mb-1 text-gray-600 dark:text-neutral-400"
              >
                Default Thinking Level
              </label>
              <select
                id="swarm-thinking-select"
                value={defaultThinkingLevel()}
                onChange={(e) =>
                  setDefaultThinkingLevel(e.currentTarget.value as ArgonThinkingLevel)
                }
                class="py-1.5 px-3 block border border-gray-200 rounded-lg text-xs font-medium dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
              >
                <option value="low">low (Ultra-Fast Parallel)</option>
                <option value="medium">medium (Balanced Synthesis)</option>
                <option value="high">high (Deep Architecture)</option>
              </select>
            </div>

            <div>
              <label
                for="swarm-concurrency-input"
                class="block text-xs font-medium mb-1 text-gray-600 dark:text-neutral-400"
              >
                Goroutine Concurrency ({maxConcurrency()})
              </label>
              <input
                id="swarm-concurrency-input"
                type="range"
                min="1"
                max="32"
                value={maxConcurrency()}
                onInput={(e) => setMaxConcurrency(Number(e.currentTarget.value))}
                class="w-36 accent-blue-600"
              />
            </div>

            <label class="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-neutral-300 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={dryRun()}
                onChange={(e) => setDryRun(e.currentTarget.checked)}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-neutral-950 dark:border-neutral-700"
              />
              <span>Instant Dry-Run Simulation</span>
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRunning()}
              onClick={runStreamSwarm}
              class="py-2 px-3.5 inline-flex items-center gap-x-2 text-xs font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isRunning() && activeMode() === "stream"
                ? "⚡ Streaming Parallel SSE..."
                : "⚡ Stream Parallel Swarm (SSE)"}
            </button>
            <button
              type="button"
              disabled={isRunning()}
              onClick={runBatchSwarm}
              class="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 disabled:opacity-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
            >
              {isRunning() && activeMode() === "batch"
                ? "🚀 Running Batch..."
                : "🚀 Run Batch Swarm"}
            </button>
            <button
              type="button"
              disabled={isRunning()}
              onClick={addTask}
              class="py-2 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
            >
              + Add Task
            </button>
          </div>
        </div>

        <div>
          <label
            for="swarm-shared-context"
            class="block text-xs font-medium mb-1 text-gray-600 dark:text-neutral-400"
          >
            Shared Root Context (Forked via <code class="font-mono">previous_interaction_id</code>{" "}
            for 95% Implicit Cache Discount)
          </label>
          <textarea
            id="swarm-shared-context"
            rows={2}
            value={sharedContext()}
            onInput={(e) => setSharedContext(e.currentTarget.value)}
            class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-xs font-mono dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-300"
          />
        </div>
      </div>

      <Show when={errorBanner()}>
        {(err) => (
          <div class="bg-red-50 border border-red-200 text-xs text-red-800 rounded-xl p-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            <strong>Execution Error:</strong> {err()}
          </div>
        )}
      </Show>

      <div class="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Parallel Task Shards */}
        <div class="lg:col-span-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-200">
              Parallel Worker Shards ({tasks().length})
            </h3>
            <span class="text-xs text-gray-500 dark:text-neutral-400">
              1 Unit = 1 Goroutine / Subagent
            </span>
          </div>

          <For each={tasks()}>
            {(task, idx) => (
              <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl p-4 dark:bg-neutral-900 dark:border-neutral-800 space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="inline-flex items-center py-0.5 px-2 rounded-md text-xs font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    #{idx() + 1} • {task.id}
                  </span>
                  <button
                    type="button"
                    disabled={isRunning() || tasks().length <= 1}
                    onClick={() => removeTask(task.id)}
                    class="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>

                <div>
                  <label
                    for={`task-label-${task.id}`}
                    class="block text-xs font-medium mb-1 text-gray-600 dark:text-neutral-400"
                  >
                    Unit Role
                  </label>
                  <input
                    id={`task-label-${task.id}`}
                    type="text"
                    value={task.label}
                    onInput={(e) => updateTask(task.id, "label", e.currentTarget.value)}
                    class="py-1.5 px-2.5 block w-full border border-gray-200 rounded-lg text-xs dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
                  />
                </div>

                <div>
                  <label
                    for={`task-prompt-${task.id}`}
                    class="block text-xs font-medium mb-1 text-gray-600 dark:text-neutral-400"
                  >
                    Prompt
                  </label>
                  <textarea
                    id={`task-prompt-${task.id}`}
                    rows={2}
                    value={task.prompt}
                    onInput={(e) => updateTask(task.id, "prompt", e.currentTarget.value)}
                    class="py-1.5 px-2.5 block w-full border border-gray-200 rounded-lg text-xs font-mono dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
                  />
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <select
                    aria-label="Task Thinking Level"
                    value={task.thinkingLevel ?? defaultThinkingLevel()}
                    onChange={(e) =>
                      updateTask(
                        task.id,
                        "thinkingLevel",
                        e.currentTarget.value as ArgonThinkingLevel,
                      )
                    }
                    class="py-1 px-2 border border-gray-200 rounded-md text-xs dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-300"
                  >
                    <option value="low">thinking: low</option>
                    <option value="medium">thinking: medium</option>
                    <option value="high">thinking: high</option>
                  </select>

                  <div class="flex items-center gap-3">
                    <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(task.useManagedAgent)}
                        onChange={(e) =>
                          updateTask(task.id, "useManagedAgent", e.currentTarget.checked)
                        }
                        class="rounded border-gray-300 text-blue-600"
                      />
                      <span>Sandbox Agent</span>
                    </label>
                    <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(task.background)}
                        onChange={(e) => updateTask(task.id, "background", e.currentTarget.checked)}
                        class="rounded border-gray-300 text-blue-600"
                      />
                      <span>256K Long-Decode</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Right Column: Live Parallel Execution Telemetry */}
        <div class="lg:col-span-7 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-200">
              Live Parallel Telemetry ({completedCount()}/{tasks().length} Completed)
            </h3>
            <div class="flex items-center gap-2">
              <Show when={rootInteractionId()}>
                {(rootId) => (
                  <span class="inline-flex items-center py-0.5 px-2 rounded-md text-xs font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    Root Fork: {rootId()}
                  </span>
                )}
              </Show>
              <Show when={totalDurationMs() !== undefined}>
                <span class="inline-flex items-center py-0.5 px-2 rounded-md text-xs font-mono bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                  Wall Time: {totalDurationMs()} ms
                </span>
              </Show>
            </div>
          </div>

          <Show
            when={orderedResults().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center dark:bg-neutral-900 dark:border-neutral-800">
                <p class="text-sm font-medium text-gray-700 dark:text-neutral-300">
                  Ready for Parallel Fan-Out
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                  Click "⚡ Stream Parallel Swarm (SSE)" above to watch concurrent Gemini 4 Argon
                  goroutines stream back in real time.
                </p>
              </div>
            }
          >
            <div class="space-y-3">
              <For each={orderedResults()}>
                {(res) => (
                  <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl p-4 dark:bg-neutral-900 dark:border-neutral-800 space-y-2.5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 class="text-sm font-semibold text-gray-800 dark:text-neutral-100">
                          {res.label}
                        </h4>
                        <div class="flex flex-wrap items-center gap-3 text-xs font-mono text-gray-500 dark:text-neutral-400 mt-0.5">
                          <span>ID: {res.taskId}</span>
                          <span>Interaction: {res.interactionId}</span>
                          <span>Latency: {res.durationMs}ms</span>
                          <Show when={res.totalTokens}>
                            {(tokens) => <span>Tokens: {tokens().toLocaleString()}</span>}
                          </Show>
                        </div>
                      </div>
                      <span
                        class={`inline-flex items-center py-1 px-2.5 rounded-full text-xs font-semibold ${
                          res.status === "completed"
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                            : res.status === "failed"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        {res.status}
                      </span>
                    </div>

                    <Show when={res.steps && res.steps.length > 0}>
                      <div class="space-y-1.5">
                        <For each={res.steps}>
                          {(step) => (
                            <Show when={step.type === "thought" || step.thoughtSummary}>
                              <details class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs dark:bg-neutral-950 dark:border-neutral-800">
                                <summary class="font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
                                  Step #{step.index} • {step.type}
                                </summary>
                                <p class="mt-1.5 text-gray-600 dark:text-neutral-400 font-mono">
                                  {step.thoughtSummary ?? step.text}
                                </p>
                              </details>
                            </Show>
                          )}
                        </For>
                      </div>
                    </Show>

                    <Show when={res.error}>
                      {(err) => (
                        <div class="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
                          {err()}
                        </div>
                      )}
                    </Show>

                    <Show when={res.outputText}>
                      <pre class="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                        {res.outputText}
                      </pre>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
