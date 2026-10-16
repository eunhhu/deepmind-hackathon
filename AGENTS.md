# Gemini 4 Argon Zero-Overhead Hyper-Parallel Monorepo (`AGENTS.md`)

## 1. Stack Architecture & Design System (Zero-Overhead Default)

- **Runtime & Package Manager**: `bun` (native TypeScript execution, `bun test` runner, workspace filtering, zero-compile dev)
- **Formatter & Linter**: `@biomejs/biome` (single binary via `bun run check` / `bun run format`)
- **Design System (Mandatory)**: **Preline UI (`preline.co`) + Tailwind CSS v4 (`@tailwindcss/vite`)**
  - All SolidJS UI components MUST use Preline UI utility patterns and the shared primitives in `apps/web/src/core/ui/preline.tsx` (`PrelineCard`, `PrelineButton`, `PrelineBadge`, `PrelineInput`, `PrelineSelect`, `PrelineTextarea`, `PrelineStatCard`, `PrelineAlert`).
  - Never write bloated custom CSS files; use Tailwind v4 + Preline classes (`bg-white border border-gray-200 shadow-2xs rounded-xl dark:bg-neutral-900 dark:border-neutral-800`, etc.).
- **Shared Contracts (`packages/shared`)**: Pure TypeScript interfaces shared across `packages/argon-orchestrator`, `apps/web`, and mirrored in `apps/api`.
- **TS Parallel Engine, Effort Router & Modular Agent Units (`packages/argon-orchestrator`)**:
  - Bun + TypeScript + `@google/genai >= 2.29.1` Interactions API parallel runner (`src/index.ts`), `AgentUnitRegistry` (`src/registry.ts`), and Dynamic Effort Router + Verify-Critique-Polish engine (`src/router.ts`).
- **Backend Server (`apps/api`)**:
  - Go 1.27 + Gin (`github.com/gin-gonic/gin`) + Goroutine worker pools & SSE streaming calling the Gemini Interactions API (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `antigravity-preview-09-2026`).
  - **Auth (`internal/auth`)**: Zero-overhead Firebase / Identity Platform RS256 JWT verifier (`h2gdm-hack26icn-2693`) + 1-click Hackathon Demo Auth (`X-Demo-User`).
  - **Database (`internal/store`)**: Dual-mode Cloud Firestore Native REST (`asia-northeast3` on `h2gdm-hack26icn-2693` via Cloud Run ADC) + Thread-Safe In-Memory Store (`MemoryStore`), exposed via `/api/db/:collection` CRUD and modular domain services.
  - **Modular Feature Registry (`internal/modules/<unit>`)**: Plug-and-play `modules.Module` interface mounted at `/api/modules/<unit>` (includes `workspace` and `pipeline`).
- **Frontend UI (`apps/web`)**:
  - SolidJS + Vite + TypeScript + Preline UI (`preline.co`) + Tailwind CSS v4.
  - **Core Auth, API & Preline Kit (`src/core/auth`, `src/core/api`, `src/core/ui/preline.tsx`)**.
  - **Modular Feature Registry (`src/modules/<unit>`)**: Plug-and-play `FrontendFeatureModule` registry rendered automatically in `App.tsx`.

---

## 2. Unlimited-Credit Hyper-Speed Parallel Execution Protocol (Mandatory)

API credits are unlimited; **wall-clock latency is the only bottleneck**. Follow these 5 rules on every task:

### Rule 1: 1-File / 1-Micro-Unit Sharding (6–12 Subagents Per Wave)
- **NEVER** assign more than 1–2 files to a single subagent.
- When building a feature, decompose it into **6 to 12 micro-tasks** and launch `micro-coder` and `preline-ui-specialist` subagents **simultaneously in a single `invoke_subagent` call** (`Model="inherit"`).

### Rule 2: Zero-Exploration Inline-Contract Prompts (Context Optimization)
- Subagents waste 60% of their time reading existing files to discover interfaces.
- The Lead Orchestrator MUST paste the **exact 10–25 line TypeScript/Go contract snippet and imports directly inside each subagent's `Prompt`** and start the prompt with:
  `ZERO-LATENCY RULE: DO NOT read any files first. Call write_to_file on your VERY FIRST turn to create <TargetFile>.`

### Rule 3: Live Bottleneck Watchdog & Active Steering (`schedule` + `manage_subagents` + `send_message`)
- Whenever spawning a parallel subagent wave, arm a **25-second watchdog timer** (`schedule(DurationSeconds=25, TimerCondition="any")`).
- When woken up, call `manage_subagents(Action="list")` to inspect `state` and `stateDetail` of still-running subagents:
  - If a subagent is lagging or running unnecessary commands, immediately **steer it via `send_message`** (`"Skip exploratory steps and write <TargetFile> now"`).
  - If a subagent has multiple remaining files/tests, **offload/steal the remaining file** to a fresh `micro-coder` subagent immediately.

### Rule 4: Dynamic Effort Routing (`routeTaskEffort`)
Route runtime Gemini Interactions API calls by task complexity (`packages/argon-orchestrator/src/router.ts` & `/api/modules/pipeline/route`):
- `instant-flash-lite` (`gemini-3.5-flash-lite`, `thinking_level: "low"`, `16K` tokens): classification, tag extraction, quick validation (<600ms).
- `fast-flash` (`gemini-3.8-flash`, `thinking_level: "low"`, `32K` tokens): fast UI copy, lightweight summarization (<1s).
- `parallel-argon-low` (`gemini-4-argon`, `thinking_level: "low"`, `32K` tokens): high-speed parallel code/feature generation (~1.5–3s).
- `balanced-argon-med` (`gemini-4-argon`, `thinking_level: "medium"`, `64K` tokens): multi-file synthesis & refiner pass.
- `deep-argon-high` (`gemini-4-argon`, `thinking_level: "high"`, `64K` tokens): complex architecture & security auditing.
- `long-decode-argon` (`gemini-4-argon`, `thinking_level: "high"`, `256K–1M` tokens, `background: true`): massive single-shot artifact generation.
- `autonomous-sandbox` (`antigravity-preview-09-2026`, `environment: "remote"`): isolated Linux sandbox execution.

### Rule 5: Automated Verify → Critique → Polish Loop (`critic-polisher`)
Every wave ends with a fast **Verify → Critique → Polish (검증/검수 후 깎기)** pass:
1. **Verify**: Run `bun run check && bun run typecheck && bun run test && (cd apps/api && go test -race ./...)`.
2. **Critique**: Audit Preline UI visual hierarchy (`preline.co` spacing, badges, dark mode contrast, empty/loading/error states) and Go/TS edge-case safety.
3. **Polish**: Apply surgical `replace_file_content` refinements so the feature ships at production quality on the first push.

---

## 3. Gemini 4 Argon (`gemini-4-argon`) Interactions API Rules (Mandatory)

1. **Endpoint & SDKs**:
   - Always use the **Interactions API** (`POST https://generativelanguage.googleapis.com/v1beta/interactions` or `client.interactions.create(...)`).
   - Never use legacy `generateContent` or deprecated `gemini-2.5-*` / `gemini-2.0-*` / `gemini-1.5-*` models.
2. **Strict Parameter Rules for `gemini-4-argon`**:
   - **NO `temperature`, `top_p`, `top_k`** (never include them in `generation_config`).
   - **NO explicit `cachedContents`** (rely on automatic 95% implicit caching for >= 4,096 tokens or `previous_interaction_id` context forking).
   - Use `generation_config: { thinking_level: "low" | "medium" | "high", max_output_tokens: ... }`.
   - For **Long Decode (`max_output_tokens > 65536` up to `1048576`)**, `background: true` is **required**, and all `model_output` steps across server continuation hops must be joined.
