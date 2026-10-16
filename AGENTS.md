# Gemini 4 Argon Zero-Overhead Hyper-Parallel Monorepo (`AGENTS.md`)

## 1. Stack Architecture (Zero-Overhead Default)

- **Runtime & Package Manager**: `bun` (native TypeScript execution, workspace filtering, zero-compile dev)
- **Formatter & Linter**: `@biomejs/biome` (single binary via `bun check` / `bun format`)
- **Shared Contracts (`packages/shared`)**: Pure TypeScript interfaces shared across `packages/argon-orchestrator`, `apps/web`, and mirrored in `apps/api`.
- **TS Parallel Engine (`packages/argon-orchestrator`)**: Bun + TypeScript + `@google/genai >= 2.29.1` Interactions API parallel runner.
- **Backend Server (`apps/api`)**: Go 1.27 + Gin (`github.com/gin-gonic/gin`) + Goroutine worker pools & SSE streaming calling the Gemini Interactions API (`gemini-4-argon` and `antigravity-preview-09-2026`).
- **Frontend UI (`apps/web`)**: SolidJS + Vite + TypeScript (fine-grained reactivity with zero Virtual DOM overhead).

---

## 2. Antigravity Multi-Agent Parallel Execution Protocol

When scaffolding or building features, **maximize parallel execution** using `invoke_subagent` with `Model="inherit"` (Gemini 4 Argon):

1. **Phase 0: Contract Lock (`packages/shared`)**
   - Update shared types in `packages/shared/src/index.ts` first so parallel workers never collide.
2. **Phase 1: Single-Call Parallel Fan-Out (`invoke_subagent`)**
   - Launch `agent-pipeline-worker`, `backend-worker`, and `frontend-worker` **simultaneously in a single `invoke_subagent` call**:
     - `agent-pipeline-worker` → strictly owns `packages/argon-orchestrator/`
     - `backend-worker` → strictly owns `apps/api/` (Go + Gin)
     - `frontend-worker` → strictly owns `apps/web/` (SolidJS + Vite)
   - **Zero File Overlap**: Subagents MUST NOT edit files outside their assigned directory.
3. **Phase 2: Integration & Verification (`qa-integrator`)**
   - Run `bun install`, `go mod tidy`, typechecks, and Biome checks across the monorepo.

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
