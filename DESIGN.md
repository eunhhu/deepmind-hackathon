---
version: alpha
name: Elysium
description: Neutral product-grade design system with subtle hairline borders, spacious 8pt rhythm, and domain-clean hierarchy across Web, macOS, iOS, Android, and Windows.
colors:
  primary: "#111827"
  secondary: "#4B5563"
  tertiary: "#4F46E5"
  neutral: "#F8F9FA"
  surface-canvas: "#F8F9FA"
  surface-default: "#FFFFFF"
  surface-subtle: "#F2F4F7"
  surface-elevated: "#FFFFFF"
  surface-inverse: "#111827"
  surface-canvas-dark: "#111214"
  surface-default-dark: "#17181C"
  surface-subtle-dark: "#212329"
  surface-elevated-dark: "#1D1F25"
  text-primary: "#111827"
  text-secondary: "#4B5563"
  text-disabled: "#9CA3AF"
  text-on-action: "#FFFFFF"
  text-brand: "#4F46E5"
  text-primary-dark: "#F3F4F6"
  text-secondary-dark: "#9CA3AF"
  text-brand-dark: "#818CF8"
  border-subtle: "#EAECF0"
  border-control: "#DFE3E8"
  border-focus: "#4F46E5"
  border-subtle-dark: "#252830"
  border-control-dark: "#2E323C"
  border-focus-dark: "#818CF8"
  action-primary: "#4F46E5"
  action-primary-hover: "#4338CA"
  action-primary-pressed: "#3730A3"
  action-subtle: "#EEF2FF"
  status-success-text: "#15803D"
  status-success-surface: "#DCFCE7"
  status-success-text-dark: "#B0F4B2"
  status-success-surface-dark: "#053C01"
  status-warning-text: "#B45309"
  status-warning-surface: "#FEF3C7"
  status-warning-text-dark: "#FFDDA5"
  status-warning-surface-dark: "#470E00"
  status-danger-text: "#B91C1C"
  status-danger-surface: "#FEE2E2"
  status-danger-action: "#DC2626"
  status-danger-text-dark: "#FECACA"
  status-danger-surface-dark: "#7F1D1D"
typography:
  title-lg:
    fontFamily: Pretendard Variable
    fontSize: 40px
    fontWeight: 700
    lineHeight: 52px
    letterSpacing: "-0.015em"
  h1:
    fontFamily: Pretendard Variable
    fontSize: 32px
    fontWeight: 700
    lineHeight: 44px
    letterSpacing: "-0.01em"
  h2:
    fontFamily: Pretendard Variable
    fontSize: 24px
    fontWeight: 700
    lineHeight: 34px
    letterSpacing: "-0.005em"
  h3:
    fontFamily: Pretendard Variable
    fontSize: 20px
    fontWeight: 600
    lineHeight: 30px
    letterSpacing: "-0.003em"
  h4:
    fontFamily: Pretendard Variable
    fontSize: 18px
    fontWeight: 600
    lineHeight: 28px
  reading-md:
    fontFamily: Pretendard Variable
    fontSize: 16px
    fontWeight: 400
    lineHeight: 28px
  body-md:
    fontFamily: Pretendard Variable
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-sm:
    fontFamily: Pretendard Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
  label-lg:
    fontFamily: Pretendard Variable
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
  label-md:
    fontFamily: Pretendard Variable
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  label-sm:
    fontFamily: Pretendard Variable
    fontSize: 13px
    fontWeight: 600
    lineHeight: 20px
    fontFeature: "tnum"
  code-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 48px
  jumbo: 64px
components:
  app-canvas:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.primary}"
    padding: 48px
  app-canvas-neutral:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    padding: 48px
  app-canvas-dark:
    backgroundColor: "{colors.surface-canvas-dark}"
    textColor: "{colors.text-primary-dark}"
    padding: 48px
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-on-action}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  button-primary-focus:
    backgroundColor: "{colors.border-focus}"
    textColor: "{colors.text-on-action}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
    textColor: "{colors.text-on-action}"
  button-primary-pressed:
    backgroundColor: "{colors.action-primary-pressed}"
    textColor: "{colors.text-on-action}"
  button-secondary:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  button-secondary-dark:
    backgroundColor: "{colors.surface-default-dark}"
    textColor: "{colors.text-primary-dark}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  button-subtle:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  button-subtle-dark:
    backgroundColor: "{colors.surface-subtle-dark}"
    textColor: "{colors.text-secondary-dark}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  button-danger:
    backgroundColor: "{colors.status-danger-action}"
    textColor: "{colors.text-on-action}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 40px
  input-field:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  input-field-disabled:
    backgroundColor: "{colors.border-subtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  divider-control:
    backgroundColor: "{colors.border-control}"
    textColor: "{colors.primary}"
    height: 1px
  divider-control-dark:
    backgroundColor: "{colors.border-control-dark}"
    textColor: "{colors.text-primary-dark}"
    height: 1px
  divider-subtle-dark:
    backgroundColor: "{colors.border-subtle-dark}"
    textColor: "{colors.text-primary-dark}"
    height: 1px
  chip-default:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 40px
  chip-selected:
    backgroundColor: "{colors.action-subtle}"
    textColor: "{colors.text-brand}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 40px
  chip-selected-dark:
    backgroundColor: "{colors.surface-default-dark}"
    textColor: "{colors.text-brand-dark}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 40px
  chip-focus-dark:
    backgroundColor: "{colors.surface-canvas-dark}"
    textColor: "{colors.border-focus-dark}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 40px
  card-default:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  sheet-reader:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 48px
  modal-dialog:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  modal-dialog-dark:
    backgroundColor: "{colors.surface-elevated-dark}"
    textColor: "{colors.text-primary-dark}"
    rounded: "{rounded.lg}"
    padding: 24px
  toast-inverse:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.text-on-action}"
    rounded: "{rounded.md}"
    padding: 16px
  toast-muted:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.text-disabled}"
    rounded: "{rounded.md}"
    padding: 16px
  badge-brand:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.text-on-action}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-success:
    backgroundColor: "{colors.status-success-surface}"
    textColor: "{colors.status-success-text}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-success-dark:
    backgroundColor: "{colors.status-success-surface-dark}"
    textColor: "{colors.status-success-text-dark}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-warning:
    backgroundColor: "{colors.status-warning-surface}"
    textColor: "{colors.status-warning-text}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-warning-dark:
    backgroundColor: "{colors.status-warning-surface-dark}"
    textColor: "{colors.status-warning-text-dark}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-danger:
    backgroundColor: "{colors.status-danger-surface}"
    textColor: "{colors.status-danger-text}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-danger-dark:
    backgroundColor: "{colors.status-danger-surface-dark}"
    textColor: "{colors.status-danger-text-dark}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
---

## Overview

**Elysium Design System v1.0 (Lectern Revision)** is a neutral, product-grade visual system built for focused productivity, knowledge workflows, and security/developer consoles across Web, macOS, iOS, Android, and Windows.

This revision replaces legacy purple-tinted canvases (`#F8F6FF`), heavy high-contrast slate control outlines (`#53576F`, `#898EAA`), and cramped padding with **pure neutral surfaces**, **low-contrast `1px` hairline borders**, **generous 8pt spatial rhythm**, and **strict action hierarchy**. Interfaces should feel calm, effortless, and self-evident—never exposing internal design-system codenames, AI model identifiers, or raw database/API scaffolding to end users.

## Colors

### Neutral Surfaces & Hairline Borders (Light & Dark)
- **Canvas (`{colors.surface-canvas}` `#F8F9FA` Light / `{colors.surface-canvas-dark}` `#111214` Dark):** App background canvas providing subtle contrast behind elevated cards and reading sheets. Never use purple-tinted backgrounds.
- **Default Surface (`{colors.surface-default}` `#FFFFFF` Light / `{colors.surface-default-dark}` `#17181C` Dark):** Primary surface for cards, sidebars, reading sheets, and text inputs.
- **Subtle Surface (`{colors.surface-subtle}` `#F2F4F7` Light / `{colors.surface-subtle-dark}` `#212329` Dark):** Secondary containers, audio player bars, code blocks, and subtle utility controls.
- **Elevated Surface (`{colors.surface-elevated}` `#FFFFFF` Light / `{colors.surface-elevated-dark}` `#1D1F25` Dark):** Modals, popovers, and floating dialogs.
- **Subtle Border (`{colors.border-subtle}` `#EAECF0` Light / `{colors.border-subtle-dark}` `#252830` Dark):** `1px solid` hairline dividers and card borders.
- **Control Border (`{colors.border-control}` `#DFE3E8` Light / `{colors.border-control-dark}` `#2E323C` Dark):** `1px solid` hairline borders for text inputs, secondary buttons, and unselected filter chips. Never use thick or high-contrast slate borders (`#53576F`, `#898EAA`).

### Brand Accent & Interactive States
- **Primary Action (`{colors.action-primary}` `#4F46E5`):** Deep indigo reserved strictly for the single primary CTA in a functional region (`{colors.action-primary-hover}` `#4338CA` on hover, `{colors.action-primary-pressed}` `#3730A3` on press).
- **Subtle Selection (`{colors.action-subtle}` `#EEF2FF` Light / `rgba(79, 70, 229, 0.16)` Dark):** Selected card and filter chip background paired with `{colors.text-brand}` (`#4F46E5` Light / `{colors.text-brand-dark}` `#818CF8` Dark) and a `1.5px solid` `{colors.border-focus}` border.
- **Focus Ring (`{colors.border-focus}` `#4F46E5` Light / `{colors.border-focus-dark}` `#6366F1` Dark):** `1px solid` border combined with `box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.14)` so focus transitions never shift layout geometry.

### Semantic Status Tokens
- **Success:** `{colors.status-success-text}` (`#15803D` Light / `{colors.status-success-text-dark}` `#B0F4B2` Dark) on `{colors.status-success-surface}` (`#DCFCE7` Light / `{colors.status-success-surface-dark}` `#053C01` Dark).
- **Warning:** `{colors.status-warning-text}` (`#B45309` Light / `{colors.status-warning-text-dark}` `#FFDDA5` Dark) on `{colors.status-warning-surface}` (`#FEF3C7` Light / `{colors.status-warning-surface-dark}` `#470E00` Dark).
- **Danger:** `{colors.status-danger-text}` (`#B91C1C` Light / `{colors.status-danger-text-dark}` `#FECACA` Dark) on `{colors.status-danger-surface}` (`#FEE2E2` Light / `{colors.status-danger-surface-dark}` `#7F1D1D` Dark); solid destructive fill `{colors.status-danger-action}` (`#DC2626`).

## Typography

- **Primary UI & Reading Font:** `Pretendard Variable` (fallbacks: `-apple-system`, `BlinkMacSystemFont`, `Inter`, `sans-serif`).
- **Monospace Font:** `JetBrains Mono` for code blocks, hashes, CLI snippets, file paths, and numeric badges.
- **Korean & Numeric Rules:** Always apply `word-break: keep-all; overflow-wrap: break-word;` on Korean headings, titles, and callouts. Always apply `font-variant-numeric: tabular-nums;` on timestamps, timers, counters, and metrics.
- **Scale Hierarchy:**
  - `title-lg` (`40px/52px`, `700`, `-0.015em`): Hero or cover display.
  - `h1` (`32px/44px`, `700`, `-0.01em`): Document title (`padding-bottom: 24px`, `margin-bottom: 32px`, `1px solid` bottom divider).
  - `h2` (`24px/34px`, `700`, `-0.005em`): Major section heading (`margin: 48px 0 16px`).
  - `h3` (`20px/30px`, `600`, `-0.003em`): Subsection or modal title (`margin: 32px 0 12px`).
  - `h4` (`18px/28px`, `600`): Card header or panel title.
  - `reading-md` (`16px/28px`, `400`): Long-form Markdown body copy and lists.
  - `body-md` (`16px/24px`, `400`): Default UI copy and input text.
  - `body-sm` (`14px/22px`, `400`): Secondary descriptions and card excerpts.
  - `label-md` (`14px/20px`, `600`): External input labels, secondary buttons, and filter chips.
  - `label-sm` (`13px/20px`, `600`, `tabular-nums`): Category tags, status pills, and timestamps.

## Layout

All spacing follows an **8pt grid with a 4pt sub-grid** (`{spacing.xxs}` `4px` through `{spacing.jumbo}` `64px`).

- **Desktop App Shell:**
  - **Left Sidebar:** `380px–400px` fixed width (`340pt` inside macOS popovers), `24px` (`{spacing.xl}`) internal padding, `20px` (`{spacing.lg}`) vertical section gap, `1px solid` `{colors.border-subtle}` right border.
  - **Card List Container:** `20px 24px` padding on `{colors.surface-canvas}` background with `12px` (`{spacing.sm}`) vertical gap between cards so `{colors.surface-default}` cards have crisp elevation contrast.
  - **Main Workspace / Reader Canvas:** `48px` (`{spacing.xxxl}`) outer horizontal and vertical padding, `48px` gap between the primary content sheet and any right-hand `240px` sticky TOC or inspector rail.
- **Mobile Adaptive Shell:**
  - Single-screen hierarchy with a fixed bottom navigation bar (`64px` height + `env(safe-area-inset-bottom)`), minimum `48px` touch targets, and `56px` full-width primary CTA buttons.

## Elevation & Depth

Elysium relies primarily on **surface tonal contrast + `1px` hairline borders** rather than heavy drop shadows:
- **Level 0 (Canvas):** `{colors.surface-canvas}` (`#F8F9FA` / `#111214`).
- **Level 1 (Cards & Sheets):** `{colors.surface-default}` (`#FFFFFF` / `#17181C`) with `1px solid` `{colors.border-subtle}` and subtle ambient shadow (`0 1px 2px rgba(16, 24, 40, 0.04)`).
- **Level 2 (Modals & Popovers):** `{colors.surface-elevated}` (`#FFFFFF` / `#1D1F25`) with `1px solid` `{colors.border-subtle}` and elevated shadow (`0 20px 40px -12px rgba(16, 24, 40, 0.16)` in Light / `0 24px 48px rgba(0, 0, 0, 0.56)` in Dark).

## Shapes

- `{rounded.xs}` (`4px`): Inline code tokens.
- `{rounded.sm}` (`8px`): Text inputs, select boxes, and timestamp chips.
- `{rounded.md}` (`12px`): Standard buttons, code blocks, alerts, and toasts.
- `{rounded.lg}` (`16px`): Lecture/project list cards, modals, audio player bars, and TOC rails.
- `{rounded.xl}` (`24px`): Primary reading/document sheets (`{components.sheet-reader}`) and authentication cards.
- `{rounded.full}` (`999px`): Filter chips (`{components.chip-default}`, `{components.chip-selected}`) and status badges.

## Components

- **Buttons (`{components.button-primary}`, `{components.button-secondary}`, `{components.button-danger}`):**
  - Desktop height `40px` (`32px` compact utility, `48px` prominent CTA, `56px` mobile full-width), `0 16px` horizontal padding, `8px` icon-text gap, `{rounded.md}` (`12px`).
  - **One Primary Action per Region:** Each functional container (sidebar header, top context bar, modal footer) may contain at most **one** `{components.button-primary}`. All sibling actions must use `{components.button-secondary}` (`1px solid` `{colors.border-control}`).
- **Text Inputs (`{components.input-field}`):**
  - Every input requires an explicit external label above it (`{typography.label-md}` `14px/20px SemiBold`, `8px` gap).
  - Height `40px` (`48px` on mobile), `{rounded.sm}` (`8px`), `0 12px` padding, `{colors.surface-default}` fill, `1px solid` `{colors.border-control}` border, and soft focus glow (`0 0 0 3px rgba(79, 70, 229, 0.14)`).
- **Filter Chips (`{components.chip-default}`, `{components.chip-selected}`):**
  - Height `40px`, `{rounded.full}` (`999px`), `0 16px` padding, `8px` gap.
  - Selected state pairs `{colors.action-subtle}` fill, `{colors.text-brand}` label, and `1.5px solid` `{colors.border-focus}` border (never rely on color alone).
- **Cards (`{components.card-default}`) & Reading Sheets (`{components.sheet-reader}`):**
  - List cards use `20px–24px` padding, `{rounded.lg}` (`16px`), `8px` internal vertical rhythm, and `1px solid` `{colors.border-subtle}`.
  - Main reading/workspace sheets use `48px` padding and `{rounded.xl}` (`24px`).

## Do's and Don'ts

- **Do** keep one primary `#4F46E5` (`{colors.action-primary}`) button per functional region and demote secondary/management actions to neutral bordered buttons or modals.
- **Do** use `1px solid` low-contrast hairline borders (`#EAECF0` / `#252830` for cards; `#DFE3E8` / `#2E323C` for controls) and `3px` soft focus rings.
- **Do** enforce `48px` outer desktop padding, `20px–24px` card padding, and `40px` control heights across web and native clients.
- **Don't** use purple-tinted canvas backgrounds (`#F8F6FF`) or thick high-contrast slate control borders (`#53576F`, `#898EAA`).
- **Don't** ship cramped `10px–12px` card padding, `28px–34px` tiny buttons, or `6–8` equal-weight buttons in a single toolbar.
- **Don't** leak internal design-system names (`Elysium 1.0`), AI model/provider names (`Gemini`, `Argon`, `BYOK`), or raw API/DB identifiers into user-facing product UI.
- **Don't** leave default native system bezels (`.roundedBorder` or default macOS push buttons) in SwiftUI/AppKit; always use `.buttonStyle(.plain)` and `.textFieldStyle(.plain)` styled with Elysium surface and border tokens.
