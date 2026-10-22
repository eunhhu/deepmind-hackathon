import type { AegisDeliveryChannel } from "@deepmind/shared";
import { createSignal, For, Show } from "solid-js";
import { PrelineBadge, PrelineButton, PrelineInput } from "../../core/ui/preline";

export interface AegisLandingHeroProps {
  mode?: "landing" | "signup";
  selectedChannels?: AegisDeliveryChannel[];
  onChannelsChange?: (channels: AegisDeliveryChannel[]) => void;
  onNavigateSignUp?: () => void;
  onNavigateLanding?: () => void;
  onOpenConsole?: () => void;
  onStartWithChannels: (
    channels: AegisDeliveryChannel[],
    userProfile?: { name: string; org: string; email: string },
  ) => void;
  onQuickOpenNewProject: () => void;
  activeProjectsCount: number;
}

interface DeliveryChannelOption {
  id: AegisDeliveryChannel;
  label: string;
  tag: string;
  desc: string;
}

const DELIVERY_CHANNEL_OPTIONS: DeliveryChannelOption[] = [
  {
    id: "github",
    label: "GitHub Repository",
    tag: "Source & AST",
    desc: "Automated PR diffs, CI/CD webhook gating, and @aegis/sdk local patch application.",
  },
  {
    id: "web_url",
    label: "Live Web URL",
    tag: "Browser & DOM",
    desc: "Headless browser exploit reproduction, WAF virtual shielding, and reverse-proxy protection.",
  },
  {
    id: "api_server",
    label: "API Server Endpoint",
    tag: "REST / GraphQL / gRPC",
    desc: "Schema-driven fuzzing, auth-bypass PoC verification, and zero-downtime edge filtering.",
  },
  {
    id: "binary_app",
    label: "Standalone / Binary App",
    tag: "ELF / PE / Mach-O / Container",
    desc: "Sandboxed binary analysis, symbol-hardened rebuilds, and signed installer distribution.",
  },
];

const ARCHITECTURE_STAGES = [
  {
    step: "01",
    title: "01 Multi-Vector Service Intake",
    badge: "GitHub • Web • API • Binary",
    desc: "Ingest source repositories, live production URLs, OpenAPI endpoints, or compiled binaries into isolated ephemeral sandboxes.",
  },
  {
    step: "02",
    title: "02 Tailored Solution Matching",
    badge: "Deterministic PoC",
    desc: "Match attack surfaces with autonomous red-team harnesses to prove exploitability with zero false positives.",
  },
  {
    step: "03",
    title: "03 1-Click Audit, CI/CD Hook & Local SDK",
    badge: "@aegis/sdk",
    desc: "Trigger instant 1-click audits, wire GitHub CI/CD webhooks, or sync surgical patches locally via @aegis/sdk.",
  },
  {
    step: "04",
    title: "04 Safe Production Delivery",
    badge: "Signed Build & Proxy",
    desc: "Verify patched builds against regression suites and deliver hardened containers, installers, or edge proxy rules.",
  },
];

export function AegisLandingHero(props: AegisLandingHeroProps) {
  const [internalMode, setInternalMode] = createSignal<"landing" | "signup">("landing");
  const [localChannels, setLocalChannels] = createSignal<AegisDeliveryChannel[]>([
    "github",
    "web_url",
  ]);
  const [name, setName] = createSignal("Jihoon Kim");
  const [org, setOrg] = createSignal("Acme Cloud FinTech");
  const [email, setEmail] = createSignal("secops@acme-cloud.io");

  const activeMode = () => props.mode ?? internalMode();

  const currentChannels = (): AegisDeliveryChannel[] => {
    if (props.selectedChannels && props.selectedChannels.length > 0) {
      return props.selectedChannels;
    }
    return localChannels();
  };

  const toggleChannel = (channel: AegisDeliveryChannel) => {
    const current = currentChannels();
    const exists = current.includes(channel);
    const next: AegisDeliveryChannel[] = exists
      ? current.length > 1
        ? current.filter((c) => c !== channel)
        : current
      : [...current, channel];
    setLocalChannels(next);
    props.onChannelsChange?.(next);
  };

  const handleStartClick = () => {
    if (props.onNavigateSignUp) {
      props.onNavigateSignUp();
    } else {
      setInternalMode("signup");
    }
  };

  const handleBackToLanding = () => {
    if (props.onNavigateLanding) {
      props.onNavigateLanding();
    } else {
      setInternalMode("landing");
    }
  };

  const handleCompleteSignUp = () => {
    props.onStartWithChannels(currentChannels(), {
      name: name().trim() || "Jihoon Kim",
      org: org().trim() || "Acme Cloud FinTech",
      email: email().trim() || "secops@acme-cloud.io",
    });
  };

  return (
    <Show
      when={activeMode() === "signup"}
      fallback={
        <section
          data-testid="aegis-landing-hero"
          class="max-w-[1440px] mx-auto p-6 lg:p-12 space-y-8"
        >
          <div class="bg-white dark:bg-[#17181C] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-8 lg:p-12 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)] space-y-8">
            {/* Top Eyebrow Bar */}
            <div class="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-neutral-800">
              <div class="flex flex-wrap items-center gap-3">
                <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <span class="size-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                  AEGIS — AUTONOMOUS SOFTWARE DEFENSE
                </span>
                <PrelineBadge variant="teal">Zero False-Positive Guarantee</PrelineBadge>
                <PrelineBadge variant="blue">
                  {props.activeProjectsCount} Active Monitored Services
                </PrelineBadge>
              </div>
              <div class="flex items-center gap-2">
                <PrelineButton
                  variant="secondary"
                  size="sm"
                  data-testid="hero-open-console-btn"
                  onClick={() => props.onOpenConsole?.()}
                >
                  Open Security Console →
                </PrelineButton>
              </div>
            </div>

            {/* Main 12-Column Grid */}
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              {/* Left Column (7 cols) */}
              <div class="lg:col-span-7 space-y-6">
                <div class="space-y-4">
                  <h1 class="text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-gray-900 dark:text-neutral-100 leading-[1.15]">
                    Is Your Software Service Truly Safe? Verify, Patch &amp; Deliver Autonomously.
                  </h1>
                  <p class="text-base text-gray-600 dark:text-neutral-400 leading-relaxed">
                    Connect your GitHub repository, live web link, API server endpoint, or
                    standalone installable binary. Aegis reproduces real exploits inside an isolated
                    sandbox, synthesizes deterministic patches via{" "}
                    <code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-xs font-mono text-blue-600 dark:text-blue-400">
                      @aegis/sdk
                    </code>
                    , and ships pre-patched installers or hardened reverse-proxy defenses.
                  </p>
                </div>

                {/* Interactive Multi-Select SW Service Delivery Preview */}
                <div
                  data-testid="hero-delivery-preview"
                  class="flex flex-col bg-gray-50/80 dark:bg-neutral-900/90 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 md:p-5 space-y-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-neutral-300">
                      Select Your Software Service Delivery Vectors (Multi-Select)
                    </span>
                    <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {currentChannels().length} selected
                    </span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <For each={DELIVERY_CHANNEL_OPTIONS}>
                      {(item) => {
                        const isSelected = () => currentChannels().includes(item.id);
                        return (
                          <button
                            type="button"
                            data-testid={`hero-channel-${item.id}`}
                            onClick={() => toggleChannel(item.id)}
                            class={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                              isSelected()
                                ? "bg-blue-50/90 border-blue-600 dark:bg-blue-950/40 dark:border-blue-500 shadow-2xs"
                                : "bg-white border-gray-200 hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:bg-neutral-800/70"
                            }`}
                          >
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                                {item.label}
                              </span>
                              <span
                                class={`inline-flex items-center py-0.5 px-2 rounded-full text-[11px] font-medium ${
                                  isSelected()
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                                }`}
                              >
                                {isSelected() ? "Selected" : item.tag}
                              </span>
                            </div>
                            <p class="text-xs text-gray-600 dark:text-neutral-400 leading-snug">
                              {item.desc}
                            </p>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>

                {/* Primary CTA Row */}
                <div class="flex flex-wrap items-center gap-3 pt-2">
                  <PrelineButton
                    variant="primary"
                    size="md"
                    data-testid="hero-start-btn"
                    onClick={handleStartClick}
                  >
                    Start Free Security Audit &amp; Sign Up →
                  </PrelineButton>
                  <PrelineButton
                    variant="secondary"
                    size="md"
                    data-testid="hero-direct-new-project-btn"
                    onClick={() => props.onQuickOpenNewProject()}
                  >
                    New Project Wizard
                  </PrelineButton>
                  <PrelineButton
                    variant="secondary"
                    size="md"
                    data-testid="hero-go-dashboard-btn"
                    onClick={() => props.onOpenConsole?.()}
                  >
                    Go to Security Console
                  </PrelineButton>
                </div>
              </div>

              {/* Right Column (5 cols) */}
              <div class="lg:col-span-5">
                <div class="flex flex-col bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-2xs rounded-xl overflow-hidden">
                  <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-x-3">
                    <div>
                      <h2 class="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                        8-Stage Verification &amp; Delivery Architecture
                      </h2>
                      <p class="text-xs text-gray-500 dark:text-neutral-400">
                        End-to-end autonomous pipeline from intake to hardened release
                      </p>
                    </div>
                    <PrelineBadge variant="blue">v2.5 Pipeline</PrelineBadge>
                  </div>
                  <div class="p-4 md:p-5 space-y-3">
                    <For each={ARCHITECTURE_STAGES}>
                      {(phase) => (
                        <div class="p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 space-y-1.5">
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-bold text-gray-900 dark:text-neutral-100">
                              {phase.title}
                            </span>
                            <span class="inline-flex items-center py-0.5 px-2 rounded-full text-[11px] font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-400">
                              {phase.badge}
                            </span>
                          </div>
                          <p class="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
                            {phase.desc}
                          </p>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      }
    >
      <section data-testid="signup-modal" class="max-w-[580px] mx-auto py-12 px-6">
        <div class="bg-white dark:bg-[#1D1F25] border border-[#EAECF0] dark:border-[#252830] rounded-[24px] p-8 lg:p-10 shadow-sm space-y-6">
          {/* Top Header */}
          <div class="space-y-3 border-b border-gray-200 dark:border-neutral-800 pb-5">
            <div class="flex items-center justify-between gap-3">
              <PrelineBadge variant="blue">Step 2 of 8 • Workspace Onboarding</PrelineBadge>
              <PrelineButton variant="secondary" size="sm" onClick={handleBackToLanding}>
                ← Back to Landing
              </PrelineButton>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-neutral-100">
              Create Your Aegis Defense Account
            </h1>
            <p class="text-sm text-gray-600 dark:text-neutral-400">
              Provision an isolated sandbox workspace and tailor your autonomous verification &amp;
              patch delivery pipeline.
            </p>
          </div>

          {/* Selected Delivery Channels Summary & Toggle */}
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-neutral-300">
                Selected SW Delivery Channels
              </span>
              <span class="text-xs text-gray-500 dark:text-neutral-400">
                Click to toggle channels
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={DELIVERY_CHANNEL_OPTIONS}>
                {(option) => {
                  const active = () => currentChannels().includes(option.id);
                  return (
                    <button
                      type="button"
                      onClick={() => toggleChannel(option.id)}
                      class={`py-1.5 px-3 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
                        active()
                          ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-800/30 dark:border-blue-700 dark:text-blue-400"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400"
                      }`}
                    >
                      <span>{active() ? "✓" : "+"}</span>
                      <span>{option.label}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Sign-up Inputs */}
          <div class="space-y-4">
            <PrelineInput
              label="Developer / Operator Name"
              data-testid="signup-name-input"
              value={name()}
              placeholder="e.g. Jihoon Kim"
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <PrelineInput
              label="Company / Organization"
              data-testid="signup-org-input"
              value={org()}
              placeholder="e.g. Acme Cloud FinTech"
              onInput={(e) => setOrg(e.currentTarget.value)}
            />
            <PrelineInput
              label="Work Email"
              type="email"
              data-testid="signup-email-input"
              value={email()}
              placeholder="e.g. secops@acme-cloud.io"
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>

          {/* Action Buttons */}
          <div class="flex items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
            <PrelineButton variant="secondary" onClick={handleBackToLanding}>
              ← Back to Landing
            </PrelineButton>
            <PrelineButton
              variant="primary"
              data-testid="signup-submit-btn"
              onClick={handleCompleteSignUp}
            >
              Complete Sign Up &amp; Configure Project →
            </PrelineButton>
          </div>
        </div>
      </section>
    </Show>
  );
}
