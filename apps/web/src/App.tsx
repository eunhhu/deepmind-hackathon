import { type Component, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { AuthBar, aegisViewMode } from "./core/auth/AuthBar";
import { AegisModule } from "./modules/aegis/AegisModule";
import { FRONTEND_MODULES } from "./modules/registry";

type OpsTabId = "aegis-verification" | "workspace" | "pipeline";

const OPS_TABS: ReadonlyArray<{
  id: OpsTabId;
  label: string;
  testId: string;
}> = [
  {
    id: "aegis-verification",
    label: "Verification Matrix & Swarm Loop",
    testId: "ops-tab-aegis-verification",
  },
  {
    id: "workspace",
    label: "Parallel Workspace",
    testId: "ops-tab-workspace",
  },
  {
    id: "pipeline",
    label: "Effort Router & Critic Polisher",
    testId: "ops-tab-pipeline",
  },
];

export const App: Component = () => {
  const [activeOpsTab, setActiveOpsTab] = createSignal<OpsTabId>("aegis-verification");

  const workspaceModules = () => FRONTEND_MODULES.filter((mod) => mod.id === "workspace");
  const pipelineModules = () => FRONTEND_MODULES.filter((mod) => mod.id === "swarm");

  return (
    <div class="min-h-screen bg-[#F8F9FA] dark:bg-[#111214] text-[#111827] dark:text-[#F3F4F6] flex flex-col">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[12px] focus:bg-[#4F46E5] focus:text-white focus:text-[14px] focus:font-semibold"
      >
        Skip to main content
      </a>

      <AuthBar />

      <main id="main-content" class="flex-1">
        <Show
          when={aegisViewMode() === "product"}
          fallback={
            <div
              data-testid="aegis-ops-console-view"
              class="max-w-[1440px] mx-auto p-6 lg:p-12 space-y-6"
            >
              <div class="bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] rounded-[16px] p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div class="space-y-1">
                  <div class="inline-flex items-center gap-2 text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4F46E5] dark:text-[#818CF8]">
                    <span>Internal Operator Diagnostics</span>
                  </div>
                  <h1 class="text-[22px] leading-[30px] font-bold tracking-[-0.02em] text-[#111827] dark:text-[#F3F4F6]">
                    Gemini 4 Argon Swarm &amp; Infrastructure Console
                  </h1>
                  <p class="text-[14px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF]">
                    Inspect formal verification matrices, parallel sandbox workspaces, and effort
                    routing telemetry.
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Ops console sections"
                  class="flex flex-wrap items-center gap-2"
                >
                  <For each={OPS_TABS}>
                    {(tab) => {
                      const isSelected = () => activeOpsTab() === tab.id;
                      return (
                        <button
                          type="button"
                          role="tab"
                          data-testid={tab.testId}
                          aria-selected={isSelected()}
                          onClick={() => setActiveOpsTab(tab.id)}
                          class={`h-10 rounded-full px-4 inline-flex items-center gap-2 text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
                            isSelected()
                              ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-[#17181C] dark:text-[#818CF8] dark:border-[#818CF8]"
                              : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C] dark:hover:bg-[#212329]"
                          }`}
                        >
                          <span>{tab.label}</span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>

              <Show when={activeOpsTab() === "aegis-verification"}>
                <AegisModule viewMode="ops" />
              </Show>

              <Show when={activeOpsTab() === "workspace"}>
                <div class="space-y-6">
                  <For each={workspaceModules()}>
                    {(mod) => <Dynamic component={mod.Component} />}
                  </For>
                </div>
              </Show>

              <Show when={activeOpsTab() === "pipeline"}>
                <div class="space-y-6">
                  <For each={pipelineModules()}>
                    {(mod) => <Dynamic component={mod.Component} />}
                  </For>
                </div>
              </Show>
            </div>
          }
        >
          <div data-testid="aegis-product-view">
            <AegisModule viewMode="product" />
          </div>
        </Show>
      </main>

      <footer class="border-t border-[#EAECF0] dark:border-[#252830] bg-white dark:bg-[#17181C] py-4 px-6">
        <div class="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] leading-[20px] text-[#6B7280] dark:text-[#6E7686]">
          <span>AEGIS-4 Automated Vulnerability Remediation &amp; Verification Platform</span>
          <span>Deterministic Patch Validation &amp; Runtime Shielding</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
