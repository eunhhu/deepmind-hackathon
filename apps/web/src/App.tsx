import type { FeatureModuleMeta } from "@deepmind/shared";
import { createSignal, For, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { fetchBackendModules } from "./core/api/client";
import { AuthBar } from "./core/auth/AuthBar";
import { FRONTEND_MODULES, getFrontendModule } from "./modules/registry";

export function App() {
  const [activeModuleId, setActiveModuleId] = createSignal<string>(
    FRONTEND_MODULES[0]?.id ?? "aegis",
  );
  const [backendModules, setBackendModules] = createSignal<FeatureModuleMeta[]>([]);
  const [showArchGuide, setShowArchGuide] = createSignal<boolean>(false);

  onMount(async () => {
    try {
      const discovered = await fetchBackendModules();
      setBackendModules(discovered);
    } catch {
      // Backend may not be running in isolated frontend dev mode
    }
  });

  const activeModule = () => getFrontendModule(activeModuleId()) ?? FRONTEND_MODULES[0];

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-neutral-950 text-gray-800 dark:text-neutral-200">
      <AuthBar />

      <div class="max-w-[85rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Hero Card */}
        <section class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800">
          <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2.5">
                <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-400">
                  AEGIS-4
                </span>
                <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                  gemini-4-argon + antigravity-preview-09-2026
                </span>
                <h1 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Autonomous Exploit Verification, Binary Hot-Patch &amp; Route-Shield Platform
                </h1>
              </div>
              <p class="text-xs sm:text-sm text-gray-600 dark:text-neutral-400">
                Zero-False-Positive Sandbox PoC (RED &rarr; GREEN) &bull; DNS TXT Ownership Gate
                &bull; GitHub Security PR &bull; ELF64 Binary Hot-Patch &bull; Live Edge Route
                Shield
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500">
                <span>Modules:</span>
                <strong class="font-semibold">
                  {backendModules().length || FRONTEND_MODULES.length}
                </strong>
              </span>
              <button
                type="button"
                class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                onClick={() => setShowArchGuide((prev) => !prev)}
              >
                {showArchGuide() ? "Hide Architecture" : "Platform Architecture"}
              </button>
            </div>
          </div>

          {/* Preline 3-Column Architecture Callout Grid */}
          <Show when={showArchGuide()}>
            <div class="p-4 md:p-5 bg-gray-50/50 dark:bg-neutral-900/50 rounded-b-xl">
              <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 space-y-2">
                  <div class="flex items-center justify-between gap-x-2">
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                      1. 3-Mode Intake &amp; DNS Gate
                    </span>
                    <span class="text-xs font-mono text-gray-400 dark:text-neutral-500">FR-1</span>
                  </div>
                  <code class="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-md block truncate">
                    github &bull; url-dns (_aegis-verify TXT) &bull; binary
                  </code>
                  <p class="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
                    Auto-classifies GitHub CD workflows, enforces Google DoH DNS TXT domain
                    ownership before scanning, and parses ELF64/PE32+/Mach-O headers.
                  </p>
                </div>

                <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 space-y-2">
                  <div class="flex items-center justify-between gap-x-2">
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500">
                      2. Red-to-Green Sandbox Loop
                    </span>
                    <span class="text-xs font-mono text-gray-400 dark:text-neutral-500">FR-2</span>
                  </div>
                  <code class="text-xs font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-1 rounded-md block truncate">
                    Recon -&gt; PoC (RED) -&gt; Patch -&gt; Re-Verify (GREEN)
                  </code>
                  <p class="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
                    Zero false positives: every finding is proved with a live sandbox PoC before
                    remediation and re-tested post-patch until blocked.
                  </p>
                </div>

                <div class="flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 space-y-2 sm:col-span-2 lg:col-span-1">
                  <div class="flex items-center justify-between gap-x-2">
                    <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                      3. Tri-Mode Self-Healing
                    </span>
                    <span class="text-xs font-mono text-gray-400 dark:text-neutral-500">FR-3</span>
                  </div>
                  <code class="text-xs font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md block truncate">
                    git-pr &bull; binary-patch &bull; route-shield
                  </code>
                  <p class="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
                    Generates source code GitHub PR diffs, instruction-level binary hot-patches with
                    1-click ELF download, and live Edge Route Shields.
                  </p>
                </div>
              </div>
            </div>
          </Show>
        </section>

        {/* Preline Segmented Nav Tabs */}
        <nav
          class="flex flex-wrap gap-2 bg-gray-100 p-1.5 rounded-xl dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800"
          aria-label="Feature Modules"
        >
          <For each={FRONTEND_MODULES}>
            {(mod) => {
              const isActive = () => activeModuleId() === mod.id;
              return (
                <button
                  type="button"
                  class={
                    isActive()
                      ? "flex-1 min-w-[220px] text-left p-3 rounded-lg bg-white text-gray-900 shadow-2xs border border-gray-200/80 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 cursor-pointer transition-all"
                      : "flex-1 min-w-[220px] text-left p-3 rounded-lg bg-transparent text-gray-600 hover:bg-white/60 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200 cursor-pointer transition-all"
                  }
                  onClick={() => setActiveModuleId(mod.id)}
                >
                  <div class="flex items-center justify-between gap-x-2 mb-1">
                    <span class="text-sm font-semibold tracking-tight">{mod.title}</span>
                    <span
                      class={
                        isActive()
                          ? "inline-flex items-center gap-x-1.5 py-0.5 px-2 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400"
                          : "inline-flex items-center gap-x-1.5 py-0.5 px-2 rounded-full text-[11px] font-medium bg-gray-200/80 text-gray-700 dark:bg-neutral-800 dark:text-neutral-400"
                      }
                    >
                      {mod.badge}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-neutral-400 line-clamp-1">
                    {mod.subtitle}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-gray-400 dark:text-neutral-500">
                    <span>API: {mod.apiPrefix}</span>
                    <Show when={mod.collections.length > 0}>
                      <span>&bull; DB: {mod.collections.join(", ")}</span>
                    </Show>
                  </div>
                </button>
              );
            }}
          </For>
        </nav>

        {/* Active Module Viewport */}
        <main>
          <Show when={activeModule()}>{(mod) => <Dynamic component={mod().Component} />}</Show>
        </main>
      </div>
    </div>
  );
}
