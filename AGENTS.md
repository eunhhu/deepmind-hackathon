# Gemini 4 Argon Zero-Overhead Hyper-Parallel Monorepo (`AGENTS.md`)

## 1. Stack Architecture (Zero-Overhead Default)

- **Runtime & Package Manager**: `bun` (native TypeScript execution, `bun test` runner, workspace filtering, zero-compile dev)
- **Formatter & Linter**: `@biomejs/biome` (single binary via `bun run check` / `bun run format`)
- **Shared Contracts (`packages/shared`)**: Pure TypeScript interfaces shared across `packages/argon-orchestrator`, `apps/web`, and mirrored in `apps/api`.
- **TS Parallel Engine & Modular Agent Units (`packages/argon-orchestrator`)**: Bun + TypeScript + `@google/genai >= 2.29.1` Interactions API parallel runner + `AgentUnitRegistry` (`src/units/<unit>.ts`).
- **Backend Server (`apps/api`)**:
  - Go 1.27 + Gin (`github.com/gin-gonic/gin`) + Goroutine worker pools & SSE streaming calling the Gemini Interactions API (`gemini-4-argon` and `antigravity-preview-09-2026`).
  - **Auth (`internal/auth`)**: Zero-overhead Firebase / Identity Platform RS256 JWT verifier (`h2gdm-hack26icn-2693`) + 1-click Hackathon Demo Auth (`X-Demo-User`).
  - **Database (`internal/store`)**: Dual-mode Cloud Firestore Native REST (`asia-northeast3` on `h2gdm-hack26icn-2693` via Cloud Run ADC) + Thread-Safe In-Memory Store (`MemoryStore`), exposed via both generic `/api/db/:collection` CRUD and modular domain services.
  - **Modular Feature Registry (`internal/modules/<unit>`)**: Plug-and-play `modules.Module` interface mounted at `/api/modules/<unit>`.
- **Frontend UI (`apps/web`)**:
  - SolidJS + Vite + TypeScript (fine-grained reactivity with zero Virtual DOM overhead).
  - **Core Auth & API (`src/core/auth`, `src/core/api`)**: Live Firebase Identity Platform client (Anonymous + Email/Password + Demo) & typed `apiClient`.
  - **Modular Feature Registry (`src/modules/<unit>`)**: Plug-and-play `FrontendFeatureModule` registry rendered automatically in `App.tsx`.

---

## 2. 4-Hour Hackathon Hyper-Parallel Slicing Protocol

When the user provides a hackathon product idea or feature set, **immediately decompose it into isolated vertical/horizontal units** and execute in parallel using `invoke_subagent` with `Model="inherit"` (`gemini-4-argon`):

### Phase 0: Contract Lock (`packages/shared/src/index.ts`)
- Define all shared domain data structures, API request/response payloads, and `FeatureModuleMeta` in `packages/shared/src/index.ts` first.

### Phase 1: Single-Call Parallel Fan-Out (`invoke_subagent`)
Launch parallel subagents **simultaneously in a single `invoke_subagent` call** with strict directory ownership (zero merge conflicts):

1. **`agent-pipeline-worker`** → owns `packages/argon-orchestrator/src/units/<unit>.ts`
   - Implements `defineAgentUnit` specs, prompt builders, structured JSON output parsers, and unit tests in `packages/argon-orchestrator/src/`.
2. **`backend-worker`** → owns `apps/api/internal/modules/<unit>/`
   - Implements `modules.Module` (`module.go` + `module_test.go`) using `deps.Store` (Cloud Firestore / Memory) and `deps.Argon` (Gemini 4 Argon parallel client), and registers the module in `cmd/server/main.go`.
3. **`frontend-worker`** → owns `apps/web/src/modules/<unit>/`
   - Implements the SolidJS reactive module component (`<Unit>Module.tsx`) using `useAuth()` and `apiClient`, and registers it in `apps/web/src/modules/registry.ts`.

> **Multiple Feature Units in Parallel**: If an idea has 3 distinct feature modules (e.g., `ingest`, `analyzer`, `visualizer`), you can spawn multiple `backend-worker` and `frontend-worker` instances where each worker is restricted to its own `apps/api/internal/modules/<feature>/` or `apps/web/src/modules/<feature>/` subdirectory!

### Phase 2: Integration & Verification (`qa-integrator`)
- Run `bun run check`, `bun run typecheck`, `bun run test`, and `cd apps/api && go test -v -race ./...`.

---

## 3. Gemini 4 Argon (`gemini-4-argon`) Interactions API Rules (Mandatory)

1. **Endpoint & SDKs**:
   - Always use the **Interactions API** (`POST https://generativelanguage.googleapis.com/v1beta/interactions` or `client.interactions.create(...)` in `@google/genai >= 2.29.1` / `google.golang.org/genai`).
   - Never use legacy `generateContent` or deprecated `gemini-2.5-*` / `gemini-2.0-*` / `gemini-1.5-*` models.
2. **Models & Agents**:
   - `gemini-4-argon`: 1M unified context window, up to 1M token long decode.
   - `gemini-3.8-flash` / `gemini-3.5-flash-lite`: high-speed auxiliary tasks.
   - `antigravity-preview-09-2026`: Managed Linux sandbox agent (`environment: "remote"`, `agent_config: { type: "antigravity", model: "gemini-4-argon" }`).
3. **Strict Parameter Rules for `gemini-4-argon`**:
   - **NO `temperature`, `top_p`, `top_k`** (never include them in `generation_config`).
   - **NO explicit `cachedContents`** (rely on automatic 95% implicit caching for >= 4,096 tokens or `previous_interaction_id` context forking).
   - Use `generation_config: { thinking_level: "low" | "medium" | "high", max_output_tokens: ... }` (default `65536`, minimum recommended `32768`).
   - For **Long Decode (`max_output_tokens > 65536` up to `1048576`)**, `background: true` is **required**, and all `model_output` steps across server continuation hops must be joined.
