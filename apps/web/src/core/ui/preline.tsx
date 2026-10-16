import { type JSX, Show, splitProps } from "solid-js";

export type PrelineBadgeVariant = "blue" | "teal" | "amber" | "red" | "purple" | "gray";

const BADGE_VARIANTS: Record<PrelineBadgeVariant, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-500",
  red: "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-500",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-800/30 dark:text-purple-400",
  gray: "bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white",
};

const BADGE_DOT_VARIANTS: Record<PrelineBadgeVariant, string> = {
  blue: "bg-blue-800 dark:bg-blue-400",
  teal: "bg-teal-800 dark:bg-teal-500",
  amber: "bg-amber-800 dark:bg-amber-500",
  red: "bg-red-800 dark:bg-red-500",
  purple: "bg-purple-800 dark:bg-purple-400",
  gray: "bg-gray-800 dark:bg-white",
};

export function PrelineBadge(props: {
  variant?: PrelineBadgeVariant;
  dot?: boolean;
  children: JSX.Element;
  class?: string;
}) {
  const variant = () => props.variant ?? "blue";
  return (
    <span
      class={`inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium ${BADGE_VARIANTS[variant()]} ${props.class ?? ""}`}
    >
      <Show when={props.dot}>
        <span class={`size-1.5 inline-block rounded-full ${BADGE_DOT_VARIANTS[variant()]}`} />
      </Show>
      {props.children}
    </span>
  );
}

export function PrelineCard(props: {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: PrelineBadgeVariant;
  headerActions?: JSX.Element;
  children: JSX.Element;
  class?: string;
  bodyClass?: string;
}) {
  return (
    <div
      class={`flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 ${props.class ?? ""}`}
    >
      <Show when={props.title || props.headerActions}>
        <div class="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <Show when={props.title}>
                <h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  {props.title}
                </h3>
              </Show>
              <Show when={props.badge}>
                {(badgeText) => (
                  <PrelineBadge variant={props.badgeVariant ?? "blue"} dot>
                    {badgeText()}
                  </PrelineBadge>
                )}
              </Show>
            </div>
            <Show when={props.subtitle}>
              <p class="text-xs text-gray-500 dark:text-neutral-400">{props.subtitle}</p>
            </Show>
          </div>
          <Show when={props.headerActions}>
            <div class="flex items-center gap-2">{props.headerActions}</div>
          </Show>
        </div>
      </Show>
      <div class={`p-4 md:p-5 flex-1 ${props.bodyClass ?? ""}`}>{props.children}</div>
    </div>
  );
}

export type PrelineButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
export type PrelineButtonSize = "xs" | "sm" | "md";

const BUTTON_VARIANTS: Record<PrelineButtonVariant, string> = {
  primary: "border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
  secondary:
    "border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800",
  soft: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50",
  ghost:
    "border-transparent text-gray-800 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800",
  danger: "border-transparent bg-red-600 text-white hover:bg-red-700 focus:bg-red-700",
};

const BUTTON_SIZES: Record<PrelineButtonSize, string> = {
  xs: "py-1.5 px-2.5 text-xs gap-x-1.5 rounded-lg",
  sm: "py-2 px-3 text-xs gap-x-2 rounded-lg",
  md: "py-2 px-3 text-sm gap-x-2 rounded-lg",
};

export function PrelineButton(props: {
  variant?: PrelineButtonVariant;
  size?: PrelineButtonSize;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  children: JSX.Element;
  class?: string;
  title?: string;
}) {
  const variant = () => props.variant ?? "primary";
  const size = () => props.size ?? "md";
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      class={`inline-flex items-center justify-center font-medium border focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors ${BUTTON_VARIANTS[variant()]} ${BUTTON_SIZES[size()]} ${props.class ?? ""}`}
    >
      {props.children}
    </button>
  );
}

const INPUT_BASE_CLASSES =
  "py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500 dark:focus:ring-neutral-600";

export function PrelineInput(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return <input class={`${INPUT_BASE_CLASSES} ${local.class ?? ""}`} {...rest} />;
}

export function PrelineSelect(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <select class={`${INPUT_BASE_CLASSES} ${local.class ?? ""}`} {...rest}>
      {local.children}
    </select>
  );
}

export function PrelineTextarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return <textarea class={`${INPUT_BASE_CLASSES} ${local.class ?? ""}`} {...rest} />;
}

export function PrelineStatCard(props: {
  label: string;
  value: string | number;
  hint?: string;
  badge?: string;
  badgeVariant?: PrelineBadgeVariant;
  class?: string;
}) {
  return (
    <div
      class={`flex flex-col bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800 p-4 md:p-5 ${props.class ?? ""}`}
    >
      <div class="flex items-center justify-between gap-x-2">
        <p class="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-neutral-400">
          {props.label}
        </p>
        <Show when={props.badge}>
          {(badgeText) => (
            <PrelineBadge variant={props.badgeVariant ?? "teal"} dot>
              {badgeText()}
            </PrelineBadge>
          )}
        </Show>
      </div>
      <div class="mt-1 flex items-baseline gap-x-2">
        <h3 class="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-neutral-200">
          {props.value}
        </h3>
      </div>
      <Show when={props.hint}>
        <p class="mt-1 text-xs text-gray-500 dark:text-neutral-500">{props.hint}</p>
      </Show>
    </div>
  );
}

export type PrelineAlertVariant = "info" | "success" | "warning" | "danger";

const ALERT_VARIANTS: Record<PrelineAlertVariant, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-800/10 dark:border-blue-900 dark:text-blue-400",
  success:
    "bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-800/10 dark:border-teal-900 dark:text-teal-500",
  warning:
    "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-800/10 dark:border-amber-900 dark:text-amber-500",
  danger:
    "bg-red-50 border-red-200 text-red-800 dark:bg-red-800/10 dark:border-red-900 dark:text-red-500",
};

export function PrelineAlert(props: {
  variant?: PrelineAlertVariant;
  title?: string;
  children: JSX.Element;
  class?: string;
}) {
  const variant = () => props.variant ?? "info";
  return (
    <div
      role="alert"
      class={`border text-sm rounded-lg p-4 ${ALERT_VARIANTS[variant()]} ${props.class ?? ""}`}
    >
      <Show when={props.title}>
        <h4 class="font-semibold mb-1">{props.title}</h4>
      </Show>
      <div>{props.children}</div>
    </div>
  );
}
