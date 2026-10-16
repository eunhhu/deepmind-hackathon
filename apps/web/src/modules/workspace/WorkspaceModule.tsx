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

const CATEGORY_OPTIONS = [
  "Architecture",
  "Agent Unit",
  "Firestore & Storage",
  "Preline UI / Frontend",
  "Security & Auth",
  "General",
] as const;

const QUICK_COLLECTIONS = ["ideas", "users", "metrics", "audit_logs"] as const;

function nextStatus(current: WorkspaceItemStatus): WorkspaceItemStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? "todo";
}

function statusLabel(status: WorkspaceItemStatus | "all"): string {
  switch (status) {
    case "all":
      return "All";
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
  }
}

function statusBadgeClass(status: WorkspaceItemStatus | undefined): string {
  switch (status) {
    case "done":
      return "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-800/30 dark:text-teal-400 dark:hover:bg-teal-800/50 cursor-pointer transition-colors";
    case "in_progress":
      return "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-800/30 dark:text-amber-400 dark:hover:bg-amber-800/50 cursor-pointer transition-colors";
    default:
      return "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 cursor-pointer transition-colors";
  }
}

function statusDotClass(status: WorkspaceItemStatus | undefined): string {
  switch (status) {
    case "done":
      return "size-1.5 inline-block rounded-full bg-teal-800 dark:bg-teal-400";
    case "in_progress":
      return "size-1.5 inline-block rounded-full bg-amber-800 dark:bg-amber-400";
    default:
      return "size-1.5 inline-block rounded-full bg-gray-600 dark:bg-neutral-400";
  }
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
  const [draftSuggestedTags, setDraftSuggestedTags] = createSignal<string[]>([]);
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
  const [inspectorOpen, setInspectorOpen] = createSignal<boolean>(true);

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

  const inProgressCount = createMemo(
    () => items().filter((item) => item.data?.status === "in_progress").length,
  );

  const completedCount = createMemo(
    () => items().filter((item) => item.data?.status === "done").length,
  );

  const activeUserUid = createMemo(() => auth.user()?.uid ?? "anonymous");

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
      setDraftSuggestedTags([]);
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
        setDraftSuggestedTags(res.suggestedTags);
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

  const handleSelectQuickCollection = (col: string) => {
    setCustomCollection(col);
    void loadCustomCollection();
  };

  return (
    <div class="space-y-6">
      {/* Error Alert Banner */}
      <Show when={errorMessage()}>
        {(msg) => (
          <div
            class="bg-red-50 border border-red-200 text-sm text-red-800 rounded-xl p-4 dark:bg-red-800/10 dark:border-red-900 dark:text-red-400 flex items-center justify-between gap-x-3"
            role="alert"
          >
            <div class="flex items-center gap-x-2">
              <span class="font-semibold">Error:</span>
              <span>{msg()}</span>
            </div>
            <button
              type="button"
              class="py-1 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-800/30 dark:text-red-400 dark:hover:bg-red-800/50 cursor-pointer transition-colors"
              onClick={() => setErrorMessage(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </Show>

      {/* 1. Top KPI Row */}
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workspace Items */}
        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <div class="flex items-center justify-between gap-x-2">
            <p class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-neutral-400">
              Total Workspace Items
            </p>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
              All Entities
            </span>
          </div>
          <div class="mt-2 flex items-baseline gap-x-2">
            <h3 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-neutral-100">
              {items().length}
            </h3>
            <span class="text-xs text-gray-500 dark:text-neutral-400">
              /api/modules/workspace/items
            </span>
          </div>
        </div>

        {/* In-Progress Count */}
        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <div class="flex items-center justify-between gap-x-2">
            <p class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-neutral-400">
              In-Progress Count
            </p>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
              Active
            </span>
          </div>
          <div class="mt-2 flex items-baseline gap-x-2">
            <h3 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-neutral-100">
              {inProgressCount()}
            </h3>
            <span class="text-xs text-gray-500 dark:text-neutral-400">status: in_progress</span>
          </div>
        </div>

        {/* Completed Count */}
        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <div class="flex items-center justify-between gap-x-2">
            <p class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-neutral-400">
              Completed Count
            </p>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
              Done
            </span>
          </div>
          <div class="mt-2 flex items-baseline gap-x-2">
            <h3 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-neutral-100">
              {completedCount()}
            </h3>
            <span class="text-xs text-gray-500 dark:text-neutral-400">status: done</span>
          </div>
        </div>

        {/* Active Auth User & Store Backend */}
        <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5">
          <div class="flex items-center justify-between gap-x-2">
            <p class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-neutral-400">
              Auth User &amp; Backend
            </p>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500">
              {storeBackend()}
            </span>
          </div>
          <div class="mt-2 flex flex-col gap-y-0.5">
            <span
              class="text-sm font-semibold text-gray-800 dark:text-neutral-100 truncate"
              title={activeUserUid()}
            >
              UID: {activeUserUid()}
            </span>
            <span class="text-xs text-gray-500 dark:text-neutral-400">
              Store Backend: <strong class="font-medium">{storeBackend()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Two-Column Main Layout */}
      <div class="grid lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-4): Create & Synthesize Item */}
        <div class="lg:col-span-4">
          <section class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
            <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-x-3">
              <div>
                <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
                  Create &amp; Synthesize Item
                </h2>
                <p class="text-xs text-gray-500 dark:text-neutral-400">
                  Persist entities &amp; run Gemini 4 Argon synthesis
                </p>
              </div>
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                {storeBackend()}
              </span>
            </div>

            <div class="p-4 md:p-5 space-y-4">
              {/* Title */}
              <div>
                <label
                  for="workspace-draft-title"
                  class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                >
                  Title
                </label>
                <input
                  id="workspace-draft-title"
                  type="text"
                  class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                  value={draftTitle()}
                  onInput={(e) => setDraftTitle(e.currentTarget.value)}
                  placeholder="e.g., Autonomous Multi-Agent Firestore Sync Pipeline"
                />
              </div>

              {/* Category Select & Argon Thinking Level */}
              <div class="grid sm:grid-cols-2 gap-3">
                <div>
                  <label
                    for="workspace-draft-category"
                    class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                  >
                    Category
                  </label>
                  <select
                    id="workspace-draft-category"
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                    value={draftCategory()}
                    onChange={(e) => setDraftCategory(e.currentTarget.value)}
                  >
                    <For each={CATEGORY_OPTIONS}>{(cat) => <option value={cat}>{cat}</option>}</For>
                  </select>
                </div>

                <div>
                  <label
                    for="workspace-thinking-level"
                    class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                  >
                    Argon Thinking
                  </label>
                  <select
                    id="workspace-thinking-level"
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                    value={thinkingLevel()}
                    onChange={(e) => setThinkingLevel(e.currentTarget.value as ArgonThinkingLevel)}
                  >
                    <option value="low">Low (Fast)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Deep)</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label
                  for="workspace-draft-tags"
                  class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                >
                  Tags (comma-separated)
                </label>
                <input
                  id="workspace-draft-tags"
                  type="text"
                  class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                  value={draftTags()}
                  onInput={(e) => setDraftTags(e.currentTarget.value)}
                  placeholder="gemini-4-argon, firestore, solidjs"
                />
              </div>

              {/* Description Textarea */}
              <div>
                <label
                  for="workspace-draft-description"
                  class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                >
                  Description
                </label>
                <textarea
                  id="workspace-draft-description"
                  rows={4}
                  class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                  value={draftDescription()}
                  onInput={(e) => setDraftDescription(e.currentTarget.value)}
                  placeholder="Describe the feature unit, data schema, or agent objective..."
                />
              </div>

              {/* Dry-Run Checkbox */}
              <div class="flex items-center gap-x-2.5">
                <input
                  id="workspace-dry-run-checkbox"
                  type="checkbox"
                  class="shrink-0 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:checked:bg-blue-500 dark:checked:border-blue-500"
                  checked={dryRunAi()}
                  onChange={(e) => setDryRunAi(e.currentTarget.checked)}
                />
                <label
                  for="workspace-dry-run-checkbox"
                  class="text-xs text-gray-600 dark:text-neutral-400 select-none cursor-pointer"
                >
                  Dry-Run AI Synthesis (zero-latency deterministic fallback)
                </label>
              </div>

              {/* Draft AI Summary & Suggested Tags Alert Box */}
              <Show when={draftAiSummary()}>
                <div class="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 dark:border-indigo-800/50 dark:bg-indigo-950/30 space-y-2">
                  <div class="flex items-center justify-between gap-x-2">
                    <span class="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                      ✨ Draft AI Synthesis (Gemini 4 Argon)
                    </span>
                    <Show when={lastSynthMeta()}>
                      {(meta) => (
                        <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-300">
                          {meta().interactionId} &bull; {meta().durationMs}ms
                        </span>
                      )}
                    </Show>
                  </div>
                  <p class="text-xs leading-relaxed text-gray-700 dark:text-neutral-300">
                    {draftAiSummary()}
                  </p>
                  <Show when={draftSuggestedTags().length > 0}>
                    <div class="flex flex-wrap items-center gap-1.5 pt-1">
                      <span class="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">
                        Suggested Tags:
                      </span>
                      <For each={draftSuggestedTags()}>
                        {(tag) => (
                          <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-300">
                            #{tag}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* Two Preline Action Buttons */}
              <div class="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  class="py-2 px-3 inline-flex items-center justify-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                  disabled={!draftTitle().trim()}
                  onClick={handleCreateItem}
                >
                  + Save to Firestore
                </button>

                <button
                  type="button"
                  class="py-2 px-3 inline-flex items-center justify-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-200 focus:outline-hidden dark:bg-indigo-800/30 dark:text-indigo-300 dark:hover:bg-indigo-800/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                  disabled={!draftTitle().trim() || synthesizingId() === "draft"}
                  onClick={handleSynthesizeDraft}
                >
                  {synthesizingId() === "draft"
                    ? "✨ Synthesizing Draft..."
                    : "✨ Draft AI Synthesis (Gemini 4 Argon)"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (lg:col-span-8): Workspace Items (/api/modules/workspace/items) */}
        <div class="lg:col-span-8">
          <section class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
            <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
                  Workspace Items (/api/modules/workspace/items)
                </h2>
                <p class="text-xs text-gray-500 dark:text-neutral-400">
                  Showing {filteredItems().length} of {items().length} items &bull; Click status
                  badge to cycle state
                </p>
              </div>

              {/* Filter Pills + Refresh Button */}
              <div class="flex flex-wrap items-center gap-1.5">
                <For each={["all", "todo", "in_progress", "done"] as const}>
                  {(st) => (
                    <button
                      type="button"
                      class={
                        filterStatus() === st
                          ? "py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50 cursor-pointer transition-colors"
                          : "py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                      }
                      onClick={() => setFilterStatus(st)}
                    >
                      {statusLabel(st)}
                    </button>
                  )}
                </For>

                <button
                  type="button"
                  class="py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer transition-colors"
                  disabled={loadingItems()}
                  onClick={loadWorkspace}
                >
                  {loadingItems() ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div class="p-4 md:p-5">
              <Show
                when={filteredItems().length > 0}
                fallback={
                  <div class="text-center py-10 px-4 border border-dashed border-gray-200 rounded-xl dark:border-neutral-800">
                    <p class="text-sm font-medium text-gray-700 dark:text-neutral-300">
                      No workspace items matching filter "{statusLabel(filterStatus())}"
                    </p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                      Use the "Create &amp; Synthesize Item" form on the left to save a new item to
                      Firestore.
                    </p>
                  </div>
                }
              >
                <div class="space-y-4">
                  <For each={filteredItems()}>
                    {(record) => (
                      <article class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5 space-y-3">
                        {/* Item Top Row: Badges + Title + Status cycle button */}
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                                {record.data?.category || "General"}
                              </span>
                              <span class="text-xs font-mono text-gray-400 dark:text-neutral-500">
                                #{record.id}
                              </span>
                              <span class="text-xs text-gray-400 dark:text-neutral-500">
                                owner: {record.ownerUid}
                              </span>
                            </div>
                            <h3 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
                              {record.data?.title}
                            </h3>
                          </div>

                          <button
                            type="button"
                            class={statusBadgeClass(record.data?.status)}
                            title="Click to cycle status (todo -> in_progress -> done)"
                            onClick={() => handleToggleStatus(record)}
                          >
                            <span class={statusDotClass(record.data?.status)} />
                            {statusLabel(record.data?.status || "todo")} ↻
                          </button>
                        </div>

                        {/* Item Description */}
                        <p class="text-sm text-gray-600 dark:text-neutral-300 leading-relaxed">
                          {record.data?.description}
                        </p>

                        {/* AI Executive Summary Callout Box */}
                        <Show when={record.data?.aiSummary}>
                          {(summary) => (
                            <div class="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 dark:border-indigo-800/50 dark:bg-indigo-950/30 space-y-1.5">
                              <div class="flex items-center justify-between gap-x-2">
                                <span class="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                                  ✨ AI Executive Summary
                                </span>
                                <span class="text-[11px] text-indigo-600 dark:text-indigo-400">
                                  Gemini 4 Argon
                                </span>
                              </div>
                              <p class="text-xs leading-relaxed text-gray-700 dark:text-neutral-300">
                                {summary()}
                              </p>
                            </div>
                          )}
                        </Show>

                        {/* Tags & Actions Footer */}
                        <div class="pt-2 border-t border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <Show
                              when={record.data?.tags && record.data.tags.length > 0}
                              fallback={
                                <span class="text-xs text-gray-400 dark:text-neutral-500">
                                  No tags
                                </span>
                              }
                            >
                              <For each={record.data.tags}>
                                {(tag) => (
                                  <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
                                    #{tag}
                                  </span>
                                )}
                              </For>
                            </Show>
                          </div>

                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-800/30 dark:text-indigo-300 dark:hover:bg-indigo-800/50 disabled:opacity-50 cursor-pointer transition-colors"
                              disabled={synthesizingId() === record.id}
                              onClick={() => handleSynthesizeExisting(record)}
                            >
                              {synthesizingId() === record.id
                                ? "✨ Synthesizing..."
                                : "✨ Synthesize with Argon"}
                            </button>

                            <button
                              type="button"
                              class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-red-600 shadow-2xs hover:bg-red-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                              onClick={() => handleDeleteItem(record.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </section>
        </div>
      </div>

      {/* 3. Bottom Collapsible/Card Section: Generic Firestore Collection Inspector */}
      <section class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
        <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-x-3">
            <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-100">
              🗄️ Generic Firestore Collection Inspector (/api/db/:collection)
            </h2>
            <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500">
              Backend: {customBackend()}
            </span>
          </div>

          <button
            type="button"
            class="py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
            onClick={() => setInspectorOpen((prev) => !prev)}
          >
            {inspectorOpen() ? "Collapse Inspector" : "Expand Inspector"}
          </button>
        </div>

        <Show when={inspectorOpen()}>
          <div class="p-4 md:p-5 grid lg:grid-cols-12 gap-6">
            {/* Left Inspector Controls */}
            <div class="lg:col-span-5 space-y-4">
              <div>
                <label
                  for="inspector-collection-input"
                  class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                >
                  Target Collection Name
                </label>
                <div class="flex gap-2">
                  <input
                    id="inspector-collection-input"
                    type="text"
                    class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                    value={customCollection()}
                    onInput={(e) => setCustomCollection(e.currentTarget.value)}
                    placeholder="ideas, users, metrics, audit_logs..."
                  />
                  <button
                    type="button"
                    class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 shrink-0 cursor-pointer transition-colors"
                    disabled={loadingCustom()}
                    onClick={loadCustomCollection}
                  >
                    {loadingCustom() ? "Loading..." : "Fetch Docs"}
                  </button>
                </div>

                {/* Quick Collection Presets */}
                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <span class="text-xs text-gray-500 dark:text-neutral-400">Presets:</span>
                  <For each={QUICK_COLLECTIONS}>
                    {(col) => (
                      <button
                        type="button"
                        class={
                          customCollection() === col
                            ? "py-1 px-2.5 inline-flex items-center gap-x-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400 cursor-pointer transition-colors"
                            : "py-1 px-2.5 inline-flex items-center gap-x-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
                        }
                        onClick={() => handleSelectQuickCollection(col)}
                      >
                        {col}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div>
                <label
                  for="inspector-json-payload"
                  class="block text-sm font-medium mb-1.5 text-gray-800 dark:text-neutral-200"
                >
                  Raw JSON Document Payload
                </label>
                <textarea
                  id="inspector-json-payload"
                  rows={5}
                  class="py-2 px-3 block w-full font-mono border border-gray-200 rounded-lg text-xs focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                  value={customJsonInput()}
                  onInput={(e) => setCustomJsonInput(e.currentTarget.value)}
                />
              </div>

              <button
                type="button"
                class="w-full py-2 px-3 inline-flex items-center justify-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={handleCreateCustomDoc}
              >
                + Insert JSON Document into /api/db/{customCollection().trim() || "collection"}
              </button>
            </div>

            {/* Right Inspector Documents Table / Card View */}
            <div class="lg:col-span-7 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  Documents in{" "}
                  <code class="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-xs font-mono">
                    /api/db/{customCollection().trim() || "ideas"}
                  </code>{" "}
                  ({customDocs().length})
                </h3>
              </div>

              <Show
                when={customDocs().length > 0}
                fallback={
                  <div class="text-center py-8 px-4 border border-dashed border-gray-200 rounded-xl dark:border-neutral-800">
                    <p class="text-xs text-gray-500 dark:text-neutral-400">
                      No documents found in collection{" "}
                      <strong class="font-semibold text-gray-700 dark:text-neutral-300">
                        {customCollection()}
                      </strong>
                      . Insert a JSON document on the left to inspect it.
                    </p>
                  </div>
                }
              >
                <div class="grid sm:grid-cols-2 gap-3">
                  <For each={customDocs()}>
                    {(doc) => (
                      <div class="flex flex-col bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 dark:bg-neutral-950/60 dark:border-neutral-800 space-y-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-xs font-mono font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400 truncate">
                            {doc.collection}/{doc.id}
                          </span>
                          <button
                            type="button"
                            class="py-1 px-2 inline-flex items-center text-xs font-medium rounded-lg border border-gray-200 bg-white text-red-600 hover:bg-red-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                            onClick={() => handleDeleteCustomDoc(doc.id)}
                          >
                            Delete
                          </button>
                        </div>
                        <div class="text-[11px] text-gray-500 dark:text-neutral-400">
                          Owner UID: <span class="font-mono">{doc.ownerUid}</span>
                        </div>
                        <pre class="p-2.5 rounded-lg bg-white border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800 text-xs font-mono text-gray-800 dark:text-neutral-200 overflow-x-auto">
                          {JSON.stringify(doc.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </section>
    </div>
  );
}
