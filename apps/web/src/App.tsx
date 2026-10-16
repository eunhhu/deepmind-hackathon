import type { FeatureModuleMeta } from "@deepmind/shared";
import { createSignal, For, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { fetchBackendModules } from "./core/api/client";
import { AuthBar } from "./core/auth/AuthBar";
import { FRONTEND_MODULES, getFrontendModule } from "./modules/registry";

export function App() {
  const [activeModuleId, setActiveModuleId] = createSignal<string>(
    FRONTEND_MODULES[0]?.id ?? "workspace",
  );
  const [backendModules, setBackendModules] = createSignal<FeatureModuleMeta[]>([]);
  const [showArchGuide, setShowArchGuide] = createSignal<boolean>(true);

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
    <div class="app-shell">
      <AuthBar />

      <header class="top-bar">
        <div>
          <div class="brand-title">
            <span class="brand-badge">gemini-4-argon</span>
            <h1>Hackathon Modular AI Command Center</h1>
          </div>
          <p class="brand-subtitle">
            SolidJS Zero-VDOM UI &bull; Firebase Identity Platform &bull; Cloud Firestore
            (asia-northeast3) &bull; Go 1.27 + Interactions API v1beta
          </p>
        </div>

        <div class="telemetry-pills">
          <div class="pill">
            <span>Frontend Modules:</span>
            <strong>{FRONTEND_MODULES.length}</strong>
          </div>
          <div class="pill">
            <span>Backend Modules:</span>
            <strong>{backendModules().length || FRONTEND_MODULES.length}</strong>
          </div>
          <button
            type="button"
            class="btn btn-ghost"
            onClick={() => setShowArchGuide((prev) => !prev)}
          >
            {showArchGuide() ? "Hide Plug-and-Play Guide" : "Show Plug-and-Play Guide"}
          </button>
        </div>
      </header>

      <Show when={showArchGuide()}>
        <section class="arch-guide-banner">
          <div class="arch-guide-header">
            <strong>⚡ Zero-Collision Parallel Subagent Plug-and-Play Architecture</strong>
            <span>Add any hackathon feature in 3 isolated units without merge conflicts:</span>
          </div>
          <div class="arch-guide-grid">
            <div class="arch-guide-step">
              <span class="arch-step-badge">1. Agent Unit (TS)</span>
              <code>packages/argon-orchestrator/src/units/&lt;unit&gt;.ts</code>
              <p>Register specialized Gemini 4 Argon prompt/schema unit in the agent registry.</p>
            </div>
            <div class="arch-guide-step">
              <span class="arch-step-badge">2. Backend Route (Go)</span>
              <code>apps/api/internal/modules/&lt;unit&gt;/</code>
              <p>Mount Gin endpoints + Firestore collections via ModuleRegistry.</p>
            </div>
            <div class="arch-guide-step">
              <span class="arch-step-badge">3. Reactive UI (SolidJS)</span>
              <code>apps/web/src/modules/&lt;unit&gt;/</code>
              <p>Register FrontendFeatureModule in registry.ts for instant navigation.</p>
            </div>
          </div>
        </section>
      </Show>

      <nav class="module-nav-bar" aria-label="Feature Modules">
        <For each={FRONTEND_MODULES}>
          {(mod) => (
            <button
              type="button"
              class={`module-tab-btn ${activeModuleId() === mod.id ? "module-tab-active" : ""}`}
              onClick={() => setActiveModuleId(mod.id)}
            >
              <div class="module-tab-top">
                <span class="module-tab-title">{mod.title}</span>
                <span class="module-tab-badge">{mod.badge}</span>
              </div>
              <span class="module-tab-subtitle">{mod.subtitle}</span>
              <div class="module-tab-meta">
                <span>API: {mod.apiPrefix}</span>
                <Show when={mod.collections.length > 0}>
                  <span>Firestore: {mod.collections.join(", ")}</span>
                </Show>
                <Show when={mod.agentUnitIds.length > 0}>
                  <span>Agents: {mod.agentUnitIds.join(", ")}</span>
                </Show>
              </div>
            </button>
          )}
        </For>
      </nav>

      <main class="module-stage">
        <Show when={activeModule()}>{(mod) => <Dynamic component={mod().Component} />}</Show>
      </main>
    </div>
  );
}
