import { createUniqueId, type JSX, Show, splitProps } from "solid-js";

export type PrelineBadgeVariant =
  | "blue"
  | "teal"
  | "emerald"
  | "amber"
  | "red"
  | "purple"
  | "indigo"
  | "gray"
  | "violet"
  | "rose";

const badgeClasses: Record<PrelineBadgeVariant, string> = {
  emerald: "bg-[#DCFCE7] text-[#15803D] border-transparent dark:bg-[#053C01] dark:text-[#B0F4B2]",
  teal: "bg-[#DCFCE7] text-[#15803D] border-transparent dark:bg-[#053C01] dark:text-[#B0F4B2]",
  amber: "bg-[#FEF3C7] text-[#B45309] border-transparent dark:bg-[#470E00] dark:text-[#FFDDA5]",
  red: "bg-[#FEE2E2] text-[#B91C1C] border-transparent dark:bg-[#7F1D1D] dark:text-[#FECACA]",
  rose: "bg-[#FEE2E2] text-[#B91C1C] border-transparent dark:bg-[#7F1D1D] dark:text-[#FECACA]",
  blue: "bg-[#EEF2FF] text-[#4F46E5] border-transparent dark:bg-indigo-500/16 dark:text-[#818CF8]",
  indigo:
    "bg-[#EEF2FF] text-[#4F46E5] border-transparent dark:bg-indigo-500/16 dark:text-[#818CF8]",
  purple:
    "bg-[#EEF2FF] text-[#4F46E5] border-transparent dark:bg-indigo-500/16 dark:text-[#818CF8]",
  violet:
    "bg-[#EEF2FF] text-[#4F46E5] border-transparent dark:bg-indigo-500/16 dark:text-[#818CF8]",
  gray: "bg-[#F2F4F7] text-[#4B5563] border-transparent dark:bg-[#212329] dark:text-[#9CA3AF]",
};

const dotClasses: Record<PrelineBadgeVariant, string> = {
  emerald: "bg-[#15803D] dark:bg-[#B0F4B2]",
  teal: "bg-[#15803D] dark:bg-[#B0F4B2]",
  amber: "bg-[#B45309] dark:bg-[#FFDDA5]",
  red: "bg-[#B91C1C] dark:bg-[#FECACA]",
  rose: "bg-[#B91C1C] dark:bg-[#FECACA]",
  blue: "bg-[#4F46E5] dark:bg-[#818CF8]",
  indigo: "bg-[#4F46E5] dark:bg-[#818CF8]",
  purple: "bg-[#4F46E5] dark:bg-[#818CF8]",
  violet: "bg-[#4F46E5] dark:bg-[#818CF8]",
  gray: "bg-[#4B5563] dark:bg-[#9CA3AF]",
};

export function PrelineBadge(props: {
  variant?: PrelineBadgeVariant;
  dot?: boolean;
  pulse?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  const variant = () => props.variant ?? "gray";
  return (
    <span
      class={`inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-[13px] leading-[20px] font-semibold border tabular-nums ${badgeClasses[variant()]} ${props.class ?? ""}`}
    >
      <Show when={props.dot}>
        <span
          class={`size-1.5 inline-block rounded-full ${dotClasses[variant()]} ${props.pulse ? "animate-pulse" : ""}`}
        />
      </Show>
      {props.children}
    </span>
  );
}

export function PrelineCard(props: {
  title?: JSX.Element;
  subtitle?: JSX.Element;
  headerRight?: JSX.Element;
  footer?: JSX.Element;
  class?: string;
  bodyClass?: string;
  children: JSX.Element;
}) {
  return (
    <div
      class={`flex flex-col bg-white border border-[#EAECF0] rounded-[16px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#17181C] dark:border-[#252830] ${props.class ?? ""}`}
    >
      <Show when={props.title || props.headerRight}>
        <div class="px-6 py-4 border-b border-[#EAECF0] dark:border-[#252830] flex flex-wrap items-center justify-between gap-3">
          <div>
            <Show when={props.title}>
              <h3 class="text-[18px] leading-[28px] font-semibold text-[#111827] dark:text-[#F3F4F6] flex items-center gap-2">
                {props.title}
              </h3>
            </Show>
            <Show when={props.subtitle}>
              <p class="text-[13px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                {props.subtitle}
              </p>
            </Show>
          </div>
          <Show when={props.headerRight}>
            <div class="flex items-center gap-2 flex-wrap">{props.headerRight}</div>
          </Show>
        </div>
      </Show>
      <div class={props.bodyClass ?? "p-6"}>{props.children}</div>
      <Show when={props.footer}>
        <div class="bg-[#F8F9FA] border-t border-[#EAECF0] rounded-b-[16px] py-3 px-6 dark:bg-[#212329]/50 dark:border-[#252830]">
          {props.footer}
        </div>
      </Show>
    </div>
  );
}

export type PrelineButtonVariant =
  | "primary"
  | "secondary"
  | "soft"
  | "danger"
  | "emerald"
  | "amber"
  | "ghost";

export type PrelineButtonSize = "xs" | "sm" | "md";

const buttonVariantClasses: Record<PrelineButtonVariant, string> = {
  primary:
    "border-transparent bg-[#4F46E5] text-white hover:bg-[#4338CA] active:bg-[#3730A3] shadow-2xs",
  secondary:
    "border-[#DFE3E8] bg-white text-[#111827] shadow-2xs hover:bg-[#F8F9FA] dark:bg-[#17181C] dark:border-[#2E323C] dark:text-[#F3F4F6] dark:hover:bg-[#212329]",
  soft: "border-transparent bg-[#F2F4F7] text-[#4B5563] hover:bg-[#EAECF0] dark:bg-[#212329] dark:text-[#9CA3AF] dark:hover:bg-[#2E323C]",
  danger:
    "border-transparent bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] shadow-2xs",
  emerald:
    "border-transparent bg-[#15803D] text-white hover:bg-[#166534] active:bg-[#14532D] shadow-2xs",
  amber:
    "border-transparent bg-[#B45309] text-white hover:bg-[#92400E] active:bg-[#78350F] shadow-2xs",
  ghost:
    "border-transparent bg-transparent text-[#4B5563] hover:bg-[#F2F4F7] dark:text-[#9CA3AF] dark:hover:bg-[#212329]",
};

const buttonSizeClasses: Record<PrelineButtonSize, string> = {
  xs: "h-8 px-3 text-[13px] leading-[20px] rounded-[8px] gap-1.5",
  sm: "h-10 px-4 text-[14px] leading-[20px] rounded-[12px] gap-2",
  md: "h-10 px-4 text-[14px] leading-[20px] rounded-[12px] gap-2",
};

export function PrelineButton(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: PrelineButtonVariant;
    size?: PrelineButtonSize;
  },
) {
  const [local, rest] = splitProps(props, ["variant", "size", "class", "children", "type"]);
  const variant = () => local.variant ?? "secondary";
  const size = () => local.size ?? "sm";

  return (
    <button
      type={local.type ?? "button"}
      class={`inline-flex items-center justify-center font-semibold border focus-visible:outline-hidden focus-visible:border-[#4F46E5] dark:focus-visible:border-[#818CF8] focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.14)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all duration-150 ${buttonVariantClasses[variant()]} ${buttonSizeClasses[size()]} ${local.class ?? ""}`}
      {...rest}
    >
      {local.children}
    </button>
  );
}

export function PrelineInput(
  props: JSX.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    showLabel?: boolean;
    wrapperClass?: string;
  },
) {
  const [local, rest] = splitProps(props, [
    "class",
    "label",
    "showLabel",
    "wrapperClass",
    "id",
    "aria-label",
    "placeholder",
  ]);
  const fallbackId = createUniqueId();
  const inputId = () => local.id ?? fallbackId;
  const ariaLabel = () =>
    local["aria-label"] ??
    local.label ??
    (typeof local.placeholder === "string" ? local.placeholder : undefined) ??
    "Text input";
  const shouldRenderLabel = () => Boolean(local.label) && local.showLabel !== false;

  const control = (
    <input
      id={inputId()}
      aria-label={ariaLabel()}
      placeholder={local.placeholder}
      class={`h-10 px-3 block w-full bg-white border border-[#DFE3E8] rounded-[8px] text-[14px] leading-[20px] text-[#111827] placeholder-[#9CA3AF] focus:border-[#4F46E5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.14)] focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none dark:bg-[#17181C] dark:border-[#2E323C] dark:text-[#F3F4F6] dark:placeholder-[#9CA3AF] dark:focus:border-[#818CF8] transition-all duration-150 ${local.class ?? ""}`}
      {...rest}
    />
  );

  return (
    <Show when={shouldRenderLabel()} fallback={control}>
      <div class={local.wrapperClass ?? "w-full"}>
        <label
          for={inputId()}
          class="block text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6] mb-2"
        >
          {local.label}
        </label>
        {control}
      </div>
    </Show>
  );
}

export function PrelineSelect(
  props: JSX.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    showLabel?: boolean;
    wrapperClass?: string;
  },
) {
  const [local, rest] = splitProps(props, [
    "class",
    "children",
    "label",
    "showLabel",
    "wrapperClass",
    "id",
    "aria-label",
  ]);
  const fallbackId = createUniqueId();
  const selectId = () => local.id ?? fallbackId;
  const ariaLabel = () => local["aria-label"] ?? local.label ?? "Select option";
  const shouldRenderLabel = () => Boolean(local.label) && local.showLabel !== false;

  const control = (
    <select
      id={selectId()}
      aria-label={ariaLabel()}
      class={`h-10 px-3 pe-9 block w-full bg-white border border-[#DFE3E8] rounded-[8px] text-[14px] leading-[20px] text-[#111827] focus:border-[#4F46E5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.14)] focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none dark:bg-[#17181C] dark:border-[#2E323C] dark:text-[#F3F4F6] dark:focus:border-[#818CF8] cursor-pointer transition-all duration-150 ${local.class ?? ""}`}
      {...rest}
    >
      {local.children}
    </select>
  );

  return (
    <Show when={shouldRenderLabel()} fallback={control}>
      <div class={local.wrapperClass ?? "w-full"}>
        <label
          for={selectId()}
          class="block text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6] mb-2"
        >
          {local.label}
        </label>
        {control}
      </div>
    </Show>
  );
}

export function PrelineTextarea(
  props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    showLabel?: boolean;
    wrapperClass?: string;
  },
) {
  const [local, rest] = splitProps(props, [
    "class",
    "label",
    "showLabel",
    "wrapperClass",
    "id",
    "aria-label",
    "placeholder",
  ]);
  const fallbackId = createUniqueId();
  const textareaId = () => local.id ?? fallbackId;
  const ariaLabel = () =>
    local["aria-label"] ??
    local.label ??
    (typeof local.placeholder === "string" ? local.placeholder : undefined) ??
    "Text area";
  const shouldRenderLabel = () => Boolean(local.label) && local.showLabel !== false;

  const control = (
    <textarea
      id={textareaId()}
      aria-label={ariaLabel()}
      placeholder={local.placeholder}
      class={`py-2.5 px-3 block w-full bg-white border border-[#DFE3E8] rounded-[8px] text-[14px] leading-[20px] text-[#111827] placeholder-[#9CA3AF] focus:border-[#4F46E5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.14)] focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none dark:bg-[#17181C] dark:border-[#2E323C] dark:text-[#F3F4F6] dark:placeholder-[#9CA3AF] dark:focus:border-[#818CF8] transition-all duration-150 ${local.class ?? ""}`}
      {...rest}
    />
  );

  return (
    <Show when={shouldRenderLabel()} fallback={control}>
      <div class={local.wrapperClass ?? "w-full"}>
        <label
          for={textareaId()}
          class="block text-[14px] leading-[20px] font-semibold text-[#111827] dark:text-[#F3F4F6] mb-2"
        >
          {local.label}
        </label>
        {control}
      </div>
    </Show>
  );
}

export function PrelineStatCard(props: {
  label: string;
  value: JSX.Element;
  badge?: JSX.Element;
  subtext?: JSX.Element;
  icon?: JSX.Element;
}) {
  return (
    <div class="flex flex-col bg-white border border-[#EAECF0] rounded-[16px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#17181C] dark:border-[#252830]">
      <div class="p-6 flex gap-x-4 items-start justify-between">
        <div class="grow">
          <div class="flex items-center gap-x-2">
            <p class="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.04em] text-[#4B5563] dark:text-[#9CA3AF]">
              {props.label}
            </p>
          </div>
          <div class="mt-2 flex items-baseline gap-x-2">
            <h3 class="text-xl sm:text-2xl font-bold text-[#111827] dark:text-[#F3F4F6] tracking-[-0.02em] tabular-nums">
              {props.value}
            </h3>
            <Show when={props.badge}>{props.badge}</Show>
          </div>
          <Show when={props.subtext}>
            <p class="mt-1.5 text-[13px] leading-[20px] text-[#4B5563] dark:text-[#9CA3AF]">
              {props.subtext}
            </p>
          </Show>
        </div>
        <Show when={props.icon}>
          <div class="shrink-0 flex justify-center items-center size-10 bg-[#EEF2FF] text-[#4F46E5] rounded-[12px] dark:bg-indigo-500/16 dark:text-[#818CF8]">
            {props.icon}
          </div>
        </Show>
      </div>
    </div>
  );
}

export function PrelineAlert(props: {
  variant?: "blue" | "teal" | "amber" | "red";
  title?: JSX.Element;
  children: JSX.Element;
  class?: string;
}) {
  const styles = {
    blue: "bg-[#EEF2FF] border-[#4F46E5]/20 text-[#4F46E5] dark:bg-indigo-500/16 dark:border-[#818CF8]/30 dark:text-[#818CF8]",
    teal: "bg-[#DCFCE7] border-[#15803D]/20 text-[#15803D] dark:bg-[#053C01] dark:border-[#B0F4B2]/25 dark:text-[#B0F4B2]",
    amber:
      "bg-[#FEF3C7] border-[#B45309]/20 text-[#B45309] dark:bg-[#470E00] dark:border-[#FFDDA5]/25 dark:text-[#FFDDA5]",
    red: "bg-[#FEE2E2] border-[#B91C1C]/20 text-[#B91C1C] dark:bg-[#7F1D1D] dark:border-[#FECACA]/25 dark:text-[#FECACA]",
  };
  const variant = () => props.variant ?? "blue";
  return (
    <div
      class={`rounded-[12px] p-4 border text-[14px] leading-[22px] ${styles[variant()]} ${props.class ?? ""}`}
      role="alert"
    >
      <Show when={props.title}>
        <h4 class="font-semibold mb-1">{props.title}</h4>
      </Show>
      <div class="text-[13px] leading-[20px] opacity-95">{props.children}</div>
    </div>
  );
}
