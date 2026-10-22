import { type Component, createSignal, For, onCleanup, onMount, Show } from "solid-js";

export type AegisViewMode = "product" | "ops";
export type AegisProductSection =
  | "landing"
  | "signup"
  | "onboarding"
  | "projects"
  | "vulnerabilities"
  | "remediation"
  | "automation-sdk"
  | "safe-delivery"
  | "verification-sandbox";

export type AegisRoutePath =
  | "/"
  | "/signup"
  | "/onboarding"
  | "/app/projects"
  | "/app/vulnerabilities"
  | "/app/remediation"
  | "/app/automation-sdk"
  | "/app/safe-delivery"
  | "/app/verification-sandbox"
  | "/ops";

export function normalizeAegisRoute(rawPath: string): AegisRoutePath {
  const cleaned = (rawPath || "/").split("?")[0].replace(/\/+$/, "") || "/";
  switch (cleaned) {
    case "/":
      return "/";
    case "/signup":
      return "/signup";
    case "/onboarding":
      return "/onboarding";
    case "/app":
    case "/app/projects":
      return "/app/projects";
    case "/app/vulnerabilities":
      return "/app/vulnerabilities";
    case "/app/remediation":
      return "/app/remediation";
    case "/app/automation-sdk":
      return "/app/automation-sdk";
    case "/app/safe-delivery":
      return "/app/safe-delivery";
    case "/app/verification-sandbox":
      return "/app/verification-sandbox";
    case "/ops":
      return "/ops";
    default:
      return "/";
  }
}

export function routeToSection(route: AegisRoutePath): AegisProductSection {
  switch (route) {
    case "/":
      return "landing";
    case "/signup":
      return "signup";
    case "/onboarding":
      return "onboarding";
    case "/app/projects":
      return "projects";
    case "/app/vulnerabilities":
      return "vulnerabilities";
    case "/app/remediation":
      return "remediation";
    case "/app/automation-sdk":
      return "automation-sdk";
    case "/app/safe-delivery":
      return "safe-delivery";
    case "/app/verification-sandbox":
      return "verification-sandbox";
    case "/ops":
      return "projects";
  }
}

export function sectionToRoute(section: AegisProductSection): AegisRoutePath {
  switch (section) {
    case "landing":
      return "/";
    case "signup":
      return "/signup";
    case "onboarding":
      return "/onboarding";
    case "projects":
      return "/app/projects";
    case "vulnerabilities":
      return "/app/vulnerabilities";
    case "remediation":
      return "/app/remediation";
    case "automation-sdk":
      return "/app/automation-sdk";
    case "safe-delivery":
      return "/app/safe-delivery";
    case "verification-sandbox":
      return "/app/verification-sandbox";
  }
}

const initialRoute: AegisRoutePath =
  typeof window !== "undefined" ? normalizeAegisRoute(window.location.pathname) : "/";

export const [aegisRoute, setAegisRouteSignal] = createSignal<AegisRoutePath>(initialRoute);
export const [aegisViewMode, setAegisViewModeSignal] = createSignal<AegisViewMode>(
  initialRoute === "/ops" ? "ops" : "product",
);
export const [aegisProductSection, setAegisProductSectionSignal] =
  createSignal<AegisProductSection>(routeToSection(initialRoute));

export function navigateAegisRoute(nextRoute: AegisRoutePath, replace = false): void {
  if (typeof window !== "undefined" && window.location.pathname !== nextRoute) {
    window.history[replace ? "replaceState" : "pushState"]({}, "", nextRoute);
  }
  setAegisRouteSignal(nextRoute);
  setAegisViewModeSignal(nextRoute === "/ops" ? "ops" : "product");
  setAegisProductSectionSignal(routeToSection(nextRoute));
}

export function setAegisViewMode(
  modeOrUpdater: AegisViewMode | ((prev: AegisViewMode) => AegisViewMode),
): void {
  const nextMode =
    typeof modeOrUpdater === "function" ? modeOrUpdater(aegisViewMode()) : modeOrUpdater;
  if (nextMode === "ops") {
    navigateAegisRoute("/ops");
  } else if (aegisRoute() === "/ops") {
    navigateAegisRoute("/app/projects");
  } else {
    setAegisViewModeSignal("product");
  }
}

export function setAegisProductSection(section: AegisProductSection): void {
  navigateAegisRoute(sectionToRoute(section));
}

interface ProductNavChip {
  id: AegisProductSection;
  label: string;
  route: AegisRoutePath;
  testId: string;
}

const PRODUCT_NAV_CHIPS: readonly ProductNavChip[] = [
  {
    id: "landing",
    label: "Landing",
    route: "/",
    testId: "product-nav-landing",
  },
  {
    id: "projects",
    label: "Targets & Overview",
    route: "/app/projects",
    testId: "product-nav-projects",
  },
  {
    id: "vulnerabilities",
    label: "Vulnerabilities & Reports",
    route: "/app/vulnerabilities",
    testId: "product-nav-vulnerabilities",
  },
  {
    id: "remediation",
    label: "Remediation & Shields",
    route: "/app/remediation",
    testId: "product-nav-remediation",
  },
  {
    id: "automation-sdk",
    label: "CI/CD & Local SDK",
    route: "/app/automation-sdk",
    testId: "product-nav-automation-sdk",
  },
  {
    id: "safe-delivery",
    label: "Safe Delivery & Proxy",
    route: "/app/safe-delivery",
    testId: "product-nav-safe-delivery",
  },
];

export const AuthBar: Component = () => {
  const [isDark, setIsDark] = createSignal(false);

  const syncFromWindowLocation = () => {
    if (typeof window === "undefined") return;
    const normalized = normalizeAegisRoute(window.location.pathname);
    setAegisRouteSignal(normalized);
    setAegisViewModeSignal(normalized === "/ops" ? "ops" : "product");
    setAegisProductSectionSignal(routeToSection(normalized));
  };

  onMount(() => {
    syncFromWindowLocation();
    if (typeof document !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", syncFromWindowLocation);
      onCleanup(() => {
        window.removeEventListener("popstate", syncFromWindowLocation);
      });
    }
  });

  const toggleTheme = () => {
    const nextDark = !isDark();
    setIsDark(nextDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextDark);
    }
  };

  return (
    <header class="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-200 dark:bg-neutral-900/95 dark:border-neutral-800">
      <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <button
            type="button"
            data-testid="brand-home-btn"
            onClick={() => navigateAegisRoute("/")}
            class="inline-flex items-center gap-2.5 text-left group focus:outline-hidden cursor-pointer shrink-0"
          >
            <span class="size-9 rounded-xl bg-blue-600 text-white inline-flex items-center justify-center font-bold text-sm shadow-2xs group-hover:bg-blue-700 transition-colors">
              A
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold tracking-tight text-gray-900 dark:text-white">
                  Aegis Security Cloud
                </span>
                <span class="inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                  v2.5
                </span>
              </div>
              <p class="text-[11px] text-gray-500 dark:text-neutral-400 hidden sm:block">
                Autonomous AppSec &amp; Runtime Verification
              </p>
            </div>
          </button>

          <Show when={aegisViewMode() === "product"}>
            <nav
              aria-label="Product workspace sections"
              class="hidden xl:flex items-center gap-1 pl-3 border-l border-gray-200 dark:border-neutral-800 overflow-x-auto"
            >
              <For each={PRODUCT_NAV_CHIPS}>
                {(chip) => {
                  const isActive = () =>
                    aegisViewMode() === "product" && aegisProductSection() === chip.id;
                  return (
                    <button
                      type="button"
                      data-testid={chip.testId}
                      onClick={() => navigateAegisRoute(chip.route)}
                      class={`py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        isActive()
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400"
                          : "text-gray-600 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                }}
              </For>
            </nav>
          </Show>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <div
            data-testid="operator-session-pill"
            class="hidden md:inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500"
          >
            <span class="size-1.5 rounded-full bg-teal-500" />
            <span>SecOps Workspace Active</span>
          </div>

          <button
            type="button"
            data-testid="toggle-ops-console-btn"
            onClick={() => setAegisViewMode((prev) => (prev === "ops" ? "product" : "ops"))}
            class={
              aegisViewMode() === "ops"
                ? "py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 cursor-pointer transition-colors"
                : "py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
            }
          >
            <svg
              class="size-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
            <span>{aegisViewMode() === "ops" ? "Exit Ops Console" : "Ops Console"}</span>
          </button>

          <button
            type="button"
            data-testid="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            class="py-2 px-2.5 inline-flex items-center justify-center text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
          >
            <Show
              when={isDark()}
              fallback={
                <svg
                  class="size-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              }
            >
              <svg
                class="size-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            </Show>
          </button>
        </div>
      </div>

      <Show when={aegisViewMode() === "ops"}>
        <div
          data-testid="ops-infrastructure-strip"
          class="bg-gray-100/80 dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 px-4 sm:px-6 lg:px-8 py-2"
        >
          <div class="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-neutral-400">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-x-1.5 py-0.5 px-2 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                Internal SecOps &amp; Red-Team Telemetry
              </span>
              <span>Route: /ops</span>
            </div>
            <div class="flex items-center gap-4 font-mono text-[11px]">
              <span>SANDBOX: ISOLATED</span>
              <span>TELEMETRY: STREAMING</span>
            </div>
          </div>
        </div>
      </Show>
    </header>
  );
};

export default AuthBar;
