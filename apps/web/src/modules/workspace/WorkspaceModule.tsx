import type {
  ArgonThinkingLevel,
  EntityRecord,
  StoreBackendType,
  WorkspaceAiSynthesizeResponse,
  WorkspaceItemData,
  WorkspaceItemStatus,
} from "@deepmind/shared";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  createEntity,
  createWorkspaceItem,
  deleteEntity,
  deleteWorkspaceItem,
  listEntities,
  listWorkspaceItems,
  synthesizeWorkspaceItem,
  updateWorkspaceItem,
} from "../../core/api/client";
import { useAuth } from "../../core/auth/firebaseAuth";

const STATUS_ORDER: WorkspaceItemStatus[] = ["todo", "in_progress", "done"];

function nextStatus(current: WorkspaceItemStatus): WorkspaceItemStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? "todo";
}

export function WorkspaceModule() {
  const auth = useAuth();

  // Workspace Items State
  const [items, setItems] = createSignal<EntityRecord<WorkspaceItemData>[]>([]);
  const [storeBackend, setStoreBackend] = createSignal<StoreBackendType>("firestore");
  const [loadingItems, setLoadingItems] = createSignal<boolean>(false);
  const [filterStatus, setFilterStatus] = createSignal<WorkspaceItemStatus | "all">("all");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  // New Item Draft State
  const [draftTitle, setDraftTitle] = createSignal<string>(
    "Autonomous Multi-Agent Firestore Sync Pipeline",
  );
  const [draftCategory, setDraftCategory] = createSignal<string>("Architecture");
  const [draftDescription, setDraftDescription] = createSignal<string>(
    "Coordinate parallel Gemini 4 Argon agent units with sub-millisecond Go Gin workers and real-time Cloud Firestore entity persistence.",
  );
  const [draftTags, setDraftTags] = createSignal<string>("gemini-4-argon, firestore, solidjs");
  const [draftAiSummary, setDraftAiSummary] = createSignal<string>("");
  const [thinkingLevel, setThinkingLevel] = createSignal<ArgonThinkingLevel>("high");
  const [dryRunAi, setDryRunAi] = createSignal<boolean>(true);
  const [synthesizingId, setSynthesizingId] = createSignal<string | null>(null);
  const [lastSynthMeta, setLastSynthMeta] = createSignal<WorkspaceAiSynthesizeResponse | null>(
    null,
  );

  // Generic Firestore Collection Inspector State (/api/db/:collection)
  const [customCollection, setCustomCollection] = createSignal<string>("ideas");
  const [customDocs, setCustomDocs] = createSignal<EntityRecord<Record<string, unknown>>[]>([]);
  const [customBackend, setCustomBackend] = createSignal<StoreBackendType>("firestore");
  const [customJsonInput, setCustomJsonInput] = createSignal<string>(
    '{\n  "name": "Zero-VDOM Agent Telemetry",\n  "priority": "P0",\n  "score": 98\n}',
  );
  const [loadingCustom, setLoadingCustom] = createSignal<boolean>(false);

  const loadWorkspace = async () => {
    setLoadingItems(true);
    setErrorMessage(null);
    try {
      const res = await listWorkspaceItems();
      setItems(res.items ?? []);
      if (res.backend) {
        setStoreBackend(res.backend);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadCustomCollection = async () => {
    const col = customCollection().trim();
    if (!col) return;
    setLoadingCustom(true);
    setErrorMessage(null);
    try {
      const res = await listEntities<Record<string, unknown>>(col);
      setCustomDocs(res.items ?? []);
      if (res.backend) {
        setCustomBackend(res.backend);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCustom(false);
    }
  };

  createEffect(() => {
    auth.session();
    void loadWorkspace();
    void loadCustomCollection();
  });

  const filteredItems = createMemo(() => {
    const status = filterStatus();
    if (status === "all") return items();
    return items().filter((item) => item.data?.status === status);
  });

  const handleCreateItem = async () => {
    if (!draftTitle().trim()) return;
    setErrorMessage(null);
    const parsedTags = draftTags()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: WorkspaceItemData = {
      title: draftTitle().trim(),
      description: draftDescription().trim(),
      category: draftCategory().trim() || "General",
      status: "todo",
      aiSummary: draftAiSummary().trim() || undefined,
      tags: parsedTags.length > 0 ? parsedTags : ["hackathon"],
    };

    try {
      const created = await createWorkspaceItem(payload);
      setItems((prev) => [created, ...prev]);
      setDraftTitle("");
      setDraftDescription("");
      setDraftAiSummary("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSynthesizeDraft = async () => {
    if (!draftTitle().trim()) return;
    setSynthesizingId("draft");
    setErrorMessage(null);
    try {
      const res = await synthesizeWorkspaceItem({
        title: draftTitle().trim(),
        description: draftDescription().trim(),
        thinkingLevel: thinkingLevel(),
        dryRun: dryRunAi(),
      });
      setLastSynthMeta(res);
      setDraftAiSummary(res.aiSummary);
      if (res.suggestedTags && res.suggestedTags.length > 0) {
        setDraftTags(res.suggestedTags.join(", "));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSynthesizingId(null);
    }
  };

  const handleSynthesizeExisting = async (record: EntityRecord<WorkspaceItemData>) => {
    setSynthesizingId(record.id);
    setErrorMessage(null);
    try {
      const res = await synthesizeWorkspaceItem({
        itemId: record.id,
        title: record.data.title,
        description: record.data.description,
        thinkingLevel: thinkingLevel(),
        dryRun: dryRunAi(),
      });
      setLastSynthMeta(res);

      const returnedItem = res.item;
      if (returnedItem) {
        setItems((prev) => prev.map((it) => (it.id === record.id ? returnedItem : it)));
      } else {
        const mergedTags = Array.from(
          new Set([...(record.data.tags ?? []), ...(res.suggestedTags ?? [])]),
        );
        const updated = await updateWorkspaceItem(record.id, {
          ...record.data,
          aiSummary: res.aiSummary,
          tags: mergedTags,
        });
        setItems((prev) => prev.map((it) => (it.id === record.id ? updated : it)));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSynthesizingId(null);
    }
  };

  const handleToggleStatus = async (record: EntityRecord<WorkspaceItemData>) => {
    setErrorMessage(null);
    const targetStatus = nextStatus(record.data.status || "todo");
    try {
      const updated = await updateWorkspaceItem(record.id, {
        ...record.data,
        status: targetStatus,
      });
      setItems((prev) => prev.map((it) => (it.id === record.id ? updated : it)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteItem = async (id: string) => {
    setErrorMessage(null);
    try {
      await deleteWorkspaceItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateCustomDoc = async () => {
    const col = customCollection().trim();
    if (!col) return;
    setErrorMessage(null);
    try {
      const parsed = JSON.parse(customJsonInput()) as Record<string, unknown>;
      const created = await createEntity<Record<string, unknown>>(col, parsed);
      setCustomDocs((prev) => [created, ...prev]);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? `Invalid JSON or API Error: ${err.message}` : String(err),
      );
    }
  };

  const handleDeleteCustomDoc = async (id: string) => {
    const col = customCollection().trim();
    if (!col) return;
    setErrorMessage(null);
    try {
      await deleteEntity(col, id);
      setCustomDocs((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div class="module-container">
      <Show when={errorMessage()}>{(msg) => <div class="error-banner">{msg()}</div>}</Show>

      <div class="workspace-grid">
        {/* Left Column: Create + Gemini 4 Argon Synthesis */}
        <section class="panel">
          <div class="panel-header">
            <h2>Create &amp; Synthesize Workspace Entity</h2>
            <span class="pill">
              Store: <strong>{storeBackend()}</strong>
            </span>
          </div>

          <label class="field-label">
            <span>Feature / Task Title</span>
            <input
              type="text"
              class="input"
              value={draftTitle()}
              onInput={(e) => setDraftTitle(e.currentTarget.value)}
              placeholder="e.g., Real-time Multi-Agent RAG Pipeline"
            />
          </label>

          <div class="control-grid">
            <label class="field-label">
              <span>Category</span>
              <input
                type="text"
                class="input"
                value={draftCategory()}
                onInput={(e) => setDraftCategory(e.currentTarget.value)}
                placeholder="Architecture / UI / Agent"
              />
            </label>

            <label class="field-label">
              <span>Argon Thinking Level</span>
              <select
                class="select"
                value={thinkingLevel()}
                onChange={(e) => setThinkingLevel(e.currentTarget.value as ArgonThinkingLevel)}
              >
                <option value="low">low (Fast synthesis)</option>
                <option value="medium">medium (Balanced)</option>
                <option value="high">high (Deep architecture)</option>
              </select>
            </label>
          </div>

          <label class="field-label">
            <span>Detailed Specification / Context</span>
            <textarea
              class="textarea"
              value={draftDescription()}
              onInput={(e) => setDraftDescription(e.currentTarget.value)}
              placeholder="Describe the feature unit, data schema, or agent objective..."
            />
          </label>

          <label class="field-label">
            <span>Tags (comma-separated)</span>
            <input
              type="text"
              class="input"
              value={draftTags()}
              onInput={(e) => setDraftTags(e.currentTarget.value)}
              placeholder="gemini-4-argon, firestore, hackathon"
            />
          </label>

          <Show when={draftAiSummary()}>
            <div class="ai-summary-box">
              <div class="ai-summary-header">
                <span>✨ Gemini 4 Argon Executive Synthesis</span>
                <Show when={lastSynthMeta()}>
                  {(meta) => (
                    <span class="ai-meta-tag">
                      {meta().interactionId} &bull; {meta().durationMs}ms
                    </span>
                  )}
                </Show>
              </div>
              <p>{draftAiSummary()}</p>
            </div>
          </Show>

          <label class="checkbox-row">
            <input
              type="checkbox"
              checked={dryRunAi()}
              onChange={(e) => setDryRunAi(e.currentTarget.checked)}
            />
            <span>Dry-Run AI Synthesis (Instant zero-latency mock when offline)</span>
          </label>

          <div class="action-bar">
            <button
              type="button"
              class="btn btn-primary"
              disabled={!draftTitle().trim()}
              onClick={handleCreateItem}
            >
              💾 Save to Firestore / Store
            </button>

            <button
              type="button"
              class="btn btn-secondary"
              disabled={!draftTitle().trim() || synthesizingId() === "draft"}
              onClick={handleSynthesizeDraft}
            >
              {synthesizingId() === "draft"
                ? "✨ Synthesizing..."
                : "✨ Synthesize with Gemini 4 Argon"}
            </button>
          </div>

          {/* Generic Firestore Collection Inspector */}
          <div class="inspector-divider" />

          <div class="panel-header">
            <h2>🗄️ Generic Firestore Collection Inspector (/api/db/:collection)</h2>
            <span class="pill">
              Backend: <strong>{customBackend()}</strong>
            </span>
          </div>

          <div class="inspector-bar">
            <label class="field-label inspector-col-input">
              <span>Collection Name</span>
              <input
                type="text"
                class="input"
                value={customCollection()}
                onInput={(e) => setCustomCollection(e.currentTarget.value)}
                placeholder="ideas, users, metrics..."
              />
            </label>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={loadingCustom()}
              onClick={loadCustomCollection}
            >
              {loadingCustom() ? "Loading..." : "Fetch Docs"}
            </button>
          </div>

          <label class="field-label">
            <span>JSON Document Payload</span>
            <textarea
              class="textarea"
              value={customJsonInput()}
              onInput={(e) => setCustomJsonInput(e.currentTarget.value)}
            />
          </label>

          <button type="button" class="btn btn-secondary" onClick={handleCreateCustomDoc}>
            + Insert JSON Document into /api/db/{customCollection().trim() || "collection"}
          </button>

          <div class="custom-docs-list">
            <For each={customDocs()}>
              {(doc) => (
                <div class="custom-doc-card">
                  <div class="custom-doc-header">
                    <span class="task-id-tag">
                      {doc.collection}/{doc.id}
                    </span>
                    <span class="result-meta">owner: {doc.ownerUid}</span>
                    <button
                      type="button"
                      class="btn btn-ghost"
                      onClick={() => handleDeleteCustomDoc(doc.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <pre class="output-pre compact-pre">{JSON.stringify(doc.data, null, 2)}</pre>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* Right Column: Live Workspace Items Board */}
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Workspace Entities ({filteredItems().length})</h2>
              <p class="brand-subtitle">
                Backed by <code>/api/modules/workspace/items</code> &amp;{" "}
                <code>workspace-synthesizer</code> Agent Unit
              </p>
            </div>

            <div class="filter-pills">
              <For each={["all", "todo", "in_progress", "done"] as const}>
                {(st) => (
                  <button
                    type="button"
                    class={`btn btn-ghost ${filterStatus() === st ? "filter-active" : ""}`}
                    onClick={() => setFilterStatus(st)}
                  >
                    {st}
                  </button>
                )}
              </For>
              <button
                type="button"
                class="btn btn-ghost"
                disabled={loadingItems()}
                onClick={loadWorkspace}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <Show
            when={filteredItems().length > 0}
            fallback={
              <div class="empty-state">
                No workspace items found for filter <strong>{filterStatus()}</strong>. Create an
                item on the left to persist it to Cloud Firestore / Memory Store!
              </div>
            }
          >
            <div class="results-grid">
              <For each={filteredItems()}>
                {(record) => (
                  <article class="result-card">
                    <div class="result-card-header">
                      <div>
                        <div class="result-title">{record.data?.title}</div>
                        <div class="result-meta">
                          <span>ID: {record.id}</span>
                          <span>Category: {record.data?.category || "General"}</span>
                          <span>Owner: {record.ownerUid}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        class={`status-badge status-btn status-${
                          record.data?.status === "done"
                            ? "completed"
                            : record.data?.status === "in_progress"
                              ? "in_progress"
                              : "queued"
                        }`}
                        title="Click to cycle status (todo -> in_progress -> done)"
                        onClick={() => handleToggleStatus(record)}
                      >
                        {record.data?.status || "todo"} ↻
                      </button>
                    </div>

                    <p class="item-description">{record.data?.description}</p>

                    <Show when={record.data?.aiSummary}>
                      {(summary) => (
                        <div class="ai-summary-box">
                          <div class="ai-summary-header">
                            <span>✨ Gemini 4 Argon Executive Summary</span>
                          </div>
                          <p>{summary()}</p>
                        </div>
                      )}
                    </Show>

                    <Show when={record.data?.tags && record.data.tags.length > 0}>
                      <div class="tag-row">
                        <For each={record.data.tags}>
                          {(tag) => <span class="tag-chip">#{tag}</span>}
                        </For>
                      </div>
                    </Show>

                    <div class="card-footer-actions">
                      <button
                        type="button"
                        class="btn btn-secondary"
                        disabled={synthesizingId() === record.id}
                        onClick={() => handleSynthesizeExisting(record)}
                      >
                        {synthesizingId() === record.id
                          ? "✨ Synthesizing..."
                          : "✨ Synthesize with Gemini 4 Argon"}
                      </button>

                      <button
                        type="button"
                        class="btn btn-ghost"
                        onClick={() => handleDeleteItem(record.id)}
                      >
                        Delete
                      </button>
                    </div>
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
