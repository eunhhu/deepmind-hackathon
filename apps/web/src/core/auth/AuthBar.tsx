import { type Component, createSignal, onMount, Show } from "solid-js";

export type AegisViewMode = "product" | "ops";
export type AegisProductSection = "projects" | "vulnerabilities" | "remediation";

export const [aegisViewMode, setAegisViewMode] = createSignal<AegisViewMode>("product");
export const [aegisProductSection, setAegisProductSection] =
  createSignal<AegisProductSection>("projects");

const PRODUCT_NAV_ITEMS: ReadonlyArray<{
  id: AegisProductSection;
  label: string;
  testId: string;
}> = [
  {
    id: "projects",
    label: "Targets & Overview",
    testId: "product-nav-projects",
  },
  {
    id: "vulnerabilities",
    label: "Vulnerabilities & Reports",
    testId: "product-nav-vulnerabilities",
  },
  {
    id: "remediation",
    label: "Remediation & Shields",
    testId: "product-nav-remediation",
  },
];

export const AuthBar: Component = () => {
  const [isDark, setIsDark] = createSignal(false);

  onMount(() => {
    if (typeof document !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
  });

  const toggleTheme = () => {
    if (typeof document !== "undefined") {
      const nextDark = document.documentElement.classList.toggle("dark");
      setIsDark(nextDark);
    }
  };

  const handleBrandClick = () => {
    setAegisViewMode("product");
    setAegisProductSection("projects");
  };

  const toggleOpsConsole = () => {
    setAegisViewMode((prev) => (prev === "product" ? "ops" : "product"));
  };

  return (
    <header class="relative z-40 bg-white dark:bg-[#17181C] border-b border-[#EAECF0] dark:border-[#252830]">
      <div class="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBrandClick}
            class="inline-flex items-center gap-3 text-left focus:outline-hidden rounded-[10px] cursor-pointer group"
          >
            <span class="w-9 h-9 rounded-[10px] bg-[#4F46E5] text-white inline-flex items-center justify-center shadow-2xs transition-transform group-hover:scale-[1.02]">
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div class="flex items-center gap-2.5">
              <span class="text-[16px] leading-[24px] font-bold tracking-tight text-[#111827] dark:text-[#F3F4F6]">
                AEGIS-4
              </span>
              <span class="text-[13px] leading-[20px] font-semibold text-[#4B5563] dark:text-[#9CA3AF] px-2.5 py-0.5 rounded-full bg-[#F2F4F7] dark:bg-[#212329]">
                Security Console
              </span>
            </div>
          </button>
        </div>

        {/* Product Navigation Filter Chips */}
        <Show when={aegisViewMode() === "product"}>
          <nav aria-label="Product sections" class="flex items-center gap-2">
            {PRODUCT_NAV_ITEMS.map((item) => {
              const isSelected = () => aegisProductSection() === item.id;
              return (
                <button
                  type="button"
                  data-testid={item.testId}
                  aria-current={isSelected() ? "page" : undefined}
                  onClick={() => setAegisProductSection(item.id)}
                  class={`h-10 rounded-full px-4 inline-flex items-center gap-2 text-[14px] leading-[20px] font-semibold transition-all cursor-pointer ${
                    isSelected()
                      ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-[#17181C] dark:text-[#818CF8] dark:border-[#818CF8]"
                      : "bg-white text-[#4B5563] border border-[#DFE3E8] hover:bg-[#F2F4F7] dark:bg-[#17181C] dark:text-[#9CA3AF] dark:border-[#2E323C] dark:hover:bg-[#212329]"
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </Show>

        {/* Right Utility Controls */}
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            data-testid="theme-toggle-btn"
            class="h-10 px-3 rounded-[12px] border border-[#DFE3E8] dark:border-[#2E323C] bg-white dark:bg-[#17181C] text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F2F4F7] dark:hover:bg-[#212329] text-[13px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>{isDark() ? "☀️ Light" : "🌙 Dark"}</span>
          </button>

          <div
            data-testid="operator-session-pill"
            class="h-10 px-3.5 rounded-full bg-[#F2F4F7] dark:bg-[#212329] text-[13px] font-semibold text-[#111827] dark:text-[#F3F4F6] inline-flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-[#059669] dark:bg-[#34D399]" />
            <span>SecOps Operator</span>
          </div>

          <button
            type="button"
            data-testid="toggle-ops-console-btn"
            onClick={toggleOpsConsole}
            class={`h-10 px-4 rounded-[12px] text-[14px] leading-[20px] font-semibold border transition-colors cursor-pointer inline-flex items-center gap-2 ${
              aegisViewMode() === "ops"
                ? "bg-[#EEF2FF] text-[#4F46E5] border-[1.5px] border-[#4F46E5] dark:bg-indigo-500/16 dark:text-[#818CF8] dark:border-[#818CF8]"
                : "bg-white dark:bg-[#17181C] text-[#111827] dark:text-[#F3F4F6] border-[#DFE3E8] dark:border-[#2E323C] hover:bg-[#F2F4F7] dark:hover:bg-[#212329]"
            }`}
          >
            <span>
              {aegisViewMode() === "ops" ? "← Back to Product Console" : "⚙️ Ops & Engine Console"}
            </span>
          </button>
        </div>
      </div>

      {/* Ops Infrastructure Strip — strictly hidden from DOM in Product mode */}
      <Show when={aegisViewMode() === "ops"}>
        <div
          data-testid="ops-infrastructure-strip"
          class="bg-[#F2F4F7] dark:bg-[#212329] border-t border-[#EAECF0] dark:border-[#252830] px-6 py-2"
        >
          <div class="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[12px] leading-[18px] font-medium text-[#4B5563] dark:text-[#9CA3AF]">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1.5 font-semibold text-[#111827] dark:text-[#F3F4F6]">
                <span class="w-2 h-2 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
                Engine Telemetry Active
              </span>
              <span>•</span>
              <span class="font-mono">Runtime: Gemini 4 Argon Swarm</span>
              <span>•</span>
              <span class="font-mono">Verification Loop: Z3 + Container Sandbox</span>
            </div>
            <div class="flex items-center gap-3 font-mono">
              <span>PostgreSQL + Redis Queue: Connected</span>
            </div>
          </div>
        </div>
      </Show>
    </header>
  );
};

export default AuthBar;
