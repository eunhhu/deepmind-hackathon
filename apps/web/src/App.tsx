import type {
  ArgonThinkingLevel,
  ParallelSwarmRequest,
  ParallelSwarmResponse,
  ParallelTaskInput,
  ParallelTaskResult,
} from "@deepmind/shared";
import { createMemo, createSignal, For, Show } from "solid-js";

const DEFAULT_SHARED_CONTEXT = `Monorepo Architecture Contract:
- Runtime: Bun + TypeScript (packages/shared, packages/argon-orchestrator, apps/web) & Go 1.27 + Gin (apps/api)
- Primary Model: gemini-4-argon via Interactions API (POST /v1beta/interactions)
- Managed Sandbox Agent: antigravity-preview-09-2026 (environment: "remote")
- Strict Rules: Never send temperature, top_p, top_k, or explicit cachedContents. Rely on 95% implicit caching and previous_interaction_id context forking.`;

const INITIAL_TASKS: ParallelTaskInput[] = [
  {
    id: "worker-domain",
    label: "Core Domain & Shared Contracts Architect",
    prompt:
      "Design zero-overhead TypeScript & Go struct alignment for ParallelSwarmRequest, StepSummary, and SSE event payloads.",
    thinkingLevel: "high",
    useManagedAgent: false,
    background: false,
  },
  {
    id: "worker-go-gin",
    label: "Go 1.27 Gin Goroutine Pool Engineer",
    prompt:
      "Audit the bounded channel semaphore and errgroup fan-out pattern for dispatching concurrent Gemini 4 Argon interactions.",
    thinkingLevel: "medium",
    useManagedAgent: false,
    background: false,
  },
  {
    id: "worker-solid-ui",
    label: "SolidJS Fine-Grained Stream Architect",
    prompt:
      "Verify fine-grained signal updates for real-time SSE step visualization without Virtual DOM diffing overhead.",
    thinkingLevel: "low",
    useManagedAgent: false,
    background: false,
  },
  {
    id: "worker-sandbox-audit",
    label: "Antigravity Sandbox Security & Long-Decode Auditor",
    prompt:
      "Validate Gemini 4 Argon parameter invariants (no temperature/top_p/top_k, background=true for >65,536 max_output_tokens).",
    thinkingLevel: "high",
    useManagedAgent: true,
    background: true,
    maxOutputTokens: 262144,
  },
];

export function App() {
  const [thinkingLevel, setThinkingLevel] = createSignal<ArgonThinkingLevel>("high");
  const [maxConcurrency, setMaxConcurrency] = createSignal<number>(8);
  const [sharedContext, setSharedContext] = createSignal<string>(DEFAULT_SHARED_CONTEXT);
  const [dryRun, setDryRun] = createSignal<boolean>(true);
  const [tasks, setTasks] = createSignal<ParallelTaskInput[]>(INITIAL_TASKS);

  const [isRunning, setIsRunning] = createSignal<boolean>(false);
  const [activeMode, setActiveMode] = createSignal<"stream" | "batch" | null>(null);
  const [rootInteractionId, setRootInteractionId] = createSignal<string | undefined>(undefined);
  const [totalDurationMs, setTotalDurationMs] = createSignal<number>(0);
  const [results, setResults] = createSignal<ParallelTaskResult[]>([]);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const completedCount = createMemo(() => results().filter((r) => r.status === "completed").length);

  const totalTokensUsed = createMemo(() =>
    results().reduce((acc, item) => acc + (item.totalTokens ?? 0), 0),
  );

  const updateTask = (index: number, patch: Partial<ParallelTaskInput>) => {
    setTasks((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addTask = () => {
    const nextNum = tasks().length + 1;
    setTasks((prev) => [
      ...prev,
      {
        id: `worker-${nextNum}-${Date.now().toString(36).slice(-4)}`,
        label: `Parallel Worker #${nextNum}`,
        prompt:
          "Analyze module boundaries and propose high-concurrency optimizations for Gemini 4 Argon.",
        thinkingLevel: thinkingLevel(),
        useManagedAgent: false,
        background: false,
      },
    ]);
  };

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildPayload = (): ParallelSwarmRequest => ({
    sharedContext: sharedContext().trim() || undefined,
    model: "gemini-4-argon",
    defaultThinkingLevel: thinkingLevel(),
    maxConcurrency: maxConcurrency(),
    tasks: tasks(),
  });

  const upsertTaskResult = (incoming: ParallelTaskResult) => {
    setResults((prev) => {
      const idx = prev.findIndex((r) => r.taskId === incoming.taskId);
      if (idx === -1) {
        return [...prev, incoming];
      }
      return prev.map((item, i) => (i === idx ? incoming : item));
    });
  };

  const seedQueuedResults = () => {
    const initial: ParallelTaskResult[] = tasks().map((t) => ({
      taskId: t.id,
      label: t.label,
      interactionId: "pending...",
      status: "in_progress",
      outputText: "",
      steps: [],
      durationMs: 0,
    }));
    setResults(initial);
  };

  const runBatchSwarm = async () => {
    if (isRunning() || tasks().length === 0) return;
    setIsRunning(true);
    setActiveMode("batch");
    setErrorMessage(null);
    setRootInteractionId(undefined);
    setTotalDurationMs(0);
    seedQueuedResults();

    const startedAt = performance.now();
    try {
      const query = dryRun() ? "?dryRun=true" : "";
      const response = await fetch(`/api/swarm/run${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as ParallelSwarmResponse;
      setRootInteractionId(data.rootInteractionId);
      setTotalDurationMs(data.totalDurationMs || Math.round(performance.now() - startedAt));
      setResults(data.results ?? []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setActiveMode(null);
    }
  };

  const runStreamSwarm = async () => {
    if (isRunning() || tasks().length === 0) return;
    setIsRunning(true);
    setActiveMode("stream");
    setErrorMessage(null);
    setRootInteractionId(undefined);
    setTotalDurationMs(0);
    seedQueuedResults();

    const startedAt = performance.now();
    try {
      const query = dryRun() ? "?dryRun=true" : "";
      const response = await fetch(`/api/swarm/stream${query}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(buildPayload()),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported by response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const rawData = line.slice(5).trim();
          if (!rawData || rawData === "[DONE]") continue;

          try {
            const parsed = JSON.parse(rawData) as Record<string, unknown>;
            if (typeof parsed.rootInteractionId === "string") {
              setRootInteractionId(parsed.rootInteractionId);
            }
            if (typeof parsed.totalDurationMs === "number") {
              setTotalDurationMs(parsed.totalDurationMs);
            }
            if (typeof parsed.taskId === "string" && typeof parsed.status === "string") {
              upsertTaskResult(parsed as unknown as ParallelTaskResult);
            } else if (
              parsed.result &&
              typeof (parsed.result as Record<string, unknown>).taskId === "string"
            ) {
              upsertTaskResult(parsed.result as ParallelTaskResult);
            } else if (Array.isArray(parsed.results)) {
              for (const item of parsed.results as ParallelTaskResult[]) {
                upsertTaskResult(item);
              }
            }
          } catch {
            // Ignore malformed SSE comment or partial frame
          }
        }
      }

      if (totalDurationMs() === 0) {
        setTotalDurationMs(Math.round(performance.now() - startedAt));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setActiveMode(null);
    }
  };

  return (
    <div class="app-shell">
      <header class="top-bar">
        <div>
          <div class="brand-title">
            <span class="brand-badge">gemini-4-argon</span>
            <h1>Hyper-Parallel Swarm Console</h1>
          </div>
          <p class="brand-subtitle">
            Zero-VDOM SolidJS Reactive Telemetry &bull; Go 1.27 Goroutine Fan-Out &bull;
            Interactions API v1beta
          </p>
        </div>

        <div class="telemetry-pills">
          <div class="pill">
            <span>Workers:</span>
            <strong>
              {completedCount()} / {tasks().length}
            </strong>
          </div>
          <div class="pill">
            <span>Swarm Latency:</span>
            <strong>{totalDurationMs()} ms</strong>
          </div>
          <div class="pill">
            <span>Total Tokens:</span>
            <strong>{totalTokensUsed().toLocaleString()}</strong>
          </div>
          <Show when={rootInteractionId()}>
            {(rootId) => (
              <div class="pill">
                <span>Cached Root ID:</span>
                <strong>{rootId()}</strong>
              </div>
            )}
          </Show>
        </div>
      </header>

      <Show when={errorMessage()}>
        {(msg) => <div class="error-banner">Swarm Execution Error: {msg()}</div>}
      </Show>

      <div class="workspace-grid">
        <section class="panel">
          <div class="panel-header">
            <h2>Swarm Orchestration Controls</h2>
            <label class="checkbox-row">
              <input
                type="checkbox"
                checked={dryRun()}
                onChange={(e) => setDryRun(e.currentTarget.checked)}
              />
              <span>Dry-Run Mode (?dryRun=true)</span>
            </label>
          </div>

          <div class="control-grid">
            <label class="field-label">
              <span>Default Thinking Level</span>
              <select
                class="select"
                value={thinkingLevel()}
                onChange={(e) => setThinkingLevel(e.currentTarget.value as ArgonThinkingLevel)}
              >
                <option value="low">low (Fastest routing)</option>
                <option value="medium">medium (Balanced engineering)</option>
                <option value="high">high (Deep reasoning)</option>
              </select>
            </label>

            <label class="field-label">
              <span>Max Goroutine Concurrency (1-32)</span>
              <input
                type="number"
                class="input"
                min={1}
                max={32}
                value={maxConcurrency()}
                onInput={(e) =>
                  setMaxConcurrency(Math.max(1, Math.min(32, Number(e.currentTarget.value) || 1)))
                }
              />
            </label>
          </div>

          <label class="field-label">
            <span>
              Shared Context Prefix (&gt;4,096 tokens triggers 95% implicit cache via
              previous_interaction_id)
            </span>
            <textarea
              class="textarea"
              value={sharedContext()}
              onInput={(e) => setSharedContext(e.currentTarget.value)}
              placeholder="Shared architectural context forked by all parallel workers..."
            />
          </label>

          <div class="action-bar">
            <button
              type="button"
              class="btn btn-primary"
              disabled={isRunning() || tasks().length === 0}
              onClick={runStreamSwarm}
            >
              {activeMode() === "stream"
                ? "Streaming SSE Workers..."
                : "Stream Parallel Swarm (SSE)"}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={isRunning() || tasks().length === 0}
              onClick={runBatchSwarm}
            >
              {activeMode() === "batch" ? "Running Batch..." : "Batch Fan-Out"}
            </button>
          </div>

          <div class="panel-header">
            <h2>Parallel Worker Queue ({tasks().length})</h2>
            <button type="button" class="btn btn-ghost" onClick={addTask}>
              + Add Worker
            </button>
          </div>

          <div class="task-editor-list">
            <For each={tasks()}>
              {(task, index) => (
                <div class="task-editor-card">
                  <div class="task-editor-top">
                    <span class="task-id-tag">{task.id}</span>
                    <button
                      type="button"
                      class="btn btn-ghost"
                      disabled={tasks().length <= 1}
                      onClick={() => removeTask(index())}
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    type="text"
                    class="input"
                    value={task.label}
                    onInput={(e) => updateTask(index(), { label: e.currentTarget.value })}
                    placeholder="Worker role label"
                  />

                  <textarea
                    class="textarea"
                    value={task.prompt}
                    onInput={(e) => updateTask(index(), { prompt: e.currentTarget.value })}
                    placeholder="Task prompt for this parallel worker..."
                  />

                  <div class="task-toggles">
                    <label class="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(task.useManagedAgent)}
                        onChange={(e) =>
                          updateTask(index(), {
                            useManagedAgent: e.currentTarget.checked,
                          })
                        }
                      />
                      <span>Managed Agent (antigravity-preview-09-2026)</span>
                    </label>

                    <label class="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(task.background)}
                        onChange={(e) => {
                          const enabled = e.currentTarget.checked;
                          updateTask(index(), {
                            background: enabled,
                            maxOutputTokens: enabled ? 262144 : 65536,
                          });
                        }}
                      />
                      <span>Long-Decode Background (262,144 tokens)</span>
                    </label>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>Live Parallel Worker Telemetry &amp; Thought Streams</h2>
            <span class="pill">
              Model: <strong>gemini-4-argon</strong>
            </span>
          </div>

          <Show
            when={results().length > 0}
            fallback={
              <div class="empty-state">
                Click <strong>Stream Parallel Swarm (SSE)</strong> or <strong>Batch Fan-Out</strong>{" "}
                to launch concurrent Gemini 4 Argon workers.
              </div>
            }
          >
            <div class="results-grid">
              <For each={results()}>
                {(res) => (
                  <article class="result-card">
                    <div class="result-card-header">
                      <div>
                        <div class="result-title">{res.label}</div>
                        <div class="result-meta">
                          <span>ID: {res.taskId}</span>
                          <span>Interaction: {res.interactionId}</span>
                          <span>Latency: {res.durationMs} ms</span>
                          <Show when={res.totalTokens}>
                            {(tokens) => <span>Tokens: {tokens().toLocaleString()}</span>}
                          </Show>
                        </div>
                      </div>
                      <span class={`status-badge status-${res.status}`}>{res.status}</span>
                    </div>

                    <Show when={res.steps && res.steps.length > 0}>
                      <div class="steps-list">
                        <For each={res.steps}>
                          {(step) => (
                            <Show when={step.type === "thought" || step.thoughtSummary}>
                              <details class="step-box" open>
                                <summary>
                                  Step #{step.index} &bull; {step.type}
                                </summary>
                                <p>{step.thoughtSummary ?? step.text}</p>
                              </details>
                            </Show>
                          )}
                        </For>
                      </div>
                    </Show>

                    <Show when={res.error}>{(err) => <div class="error-banner">{err()}</div>}</Show>

                    <Show when={res.outputText}>
                      <pre class="output-pre">{res.outputText}</pre>
                    </Show>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </div>
  );
}
