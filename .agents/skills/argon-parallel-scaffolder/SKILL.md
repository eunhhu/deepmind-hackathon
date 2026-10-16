---
name: argon-parallel-scaffolder
description: Use this skill when scaffolding or building full-stack monorepo features in parallel using Antigravity subagents and the Gemini 4 Argon (`gemini-4-argon`) parallel Interactions API engine.
---

# Gemini 4 Argon 4-Hour Hackathon Hyper-Parallel Scaffolder

Use this runbook to turn any hackathon idea into a tested, deployed full-stack product in minutes using **parallel Antigravity subagents** + **pre-wired Firebase Auth (`h2gdm-hack26icn-2693`) + Cloud Firestore (`asia-northeast3`) + Gemini 4 Argon (`gemini-4-argon`)**.

---

## 1. Pre-Built Infrastructure You Already Have

1. **Authentication (`Firebase Identity Platform` + `Demo Auth`)**:
   - Frontend: `useAuth()` in `apps/web/src/core/auth/firebaseAuth.ts` & `<AuthBar />` (supports 1-click Live Firebase Anonymous JWT, Email/Password JWT, and 0ms Demo User).
   - Backend: `auth.AuthMiddleware` & `auth.CurrentUser(c)` in `apps/api/internal/auth/firebase.go` (verifies RS256 Google SecureToken JWTs for `h2gdm-hack26icn-2693` + `X-Demo-User` header).
2. **Database (`Cloud Firestore Native` + `In-Memory Dual Store`)**:
   - Instant Zero-Code CRUD from Frontend: `listEntities(col)`, `createEntity(col, data)`, `updateEntity(col, id, patch)`, `deleteEntity(col, id)` in `apps/web/src/core/api/client.ts` backed by `/api/db/:collection`.
   - Backend Go Store: `deps.Store.Put/Get/Update/Delete/List` in `apps/api/internal/store/store.go` (uses Cloud Firestore Native REST in `asia-northeast3` on Cloud Run via ADC, or thread-safe `MemoryStore` locally/in tests).
3. **Plug-and-Play Module Registries (Zero Conflict Routing)**:
   - **AI Agent Units**: `packages/argon-orchestrator/src/units/<unit>.ts` registered in `AgentUnitRegistry`.
   - **Backend Go Modules**: `apps/api/internal/modules/<unit>/module.go` implementing `modules.Module` (`RegisterRoutes(rg *gin.RouterGroup, deps *modules.Dependencies)`), mounted automatically at `/api/modules/<unit>`.
   - **Frontend SolidJS Modules**: `apps/web/src/modules/<unit>/<Unit>Module.tsx` registered in `apps/web/src/modules/registry.ts`, rendered automatically as a top-level tab in `App.tsx`.

---

## 2. Step-by-Step 4-Hour Hackathon Execution Protocol

When the user gives you an idea (e.g., *"Let's build an AI Incident War-Room with Log Triage, Root-Cause Graph, and Auto-Patch Generator"*):

### Step 1: Lock Shared Contracts (`packages/shared/src/index.ts`) — ~60 seconds
Add the domain interfaces (`IncidentRecord`, `TriageRequest`, `TriageResponse`, etc.) directly to `packages/shared/src/index.ts`.

### Step 2: Single-Call Parallel Subagent Fan-Out (`invoke_subagent`) — ~3 minutes
Spawn subagents concurrently in **one `invoke_subagent` call** with `Model: "inherit"`:

- **Subagent 1 (`agent-pipeline-worker`)**:
  - Owns `packages/argon-orchestrator/src/units/<unit>.ts` and `packages/argon-orchestrator/src/index.test.ts`.
  - Defines the `gemini-4-argon` prompt & output parser using `defineAgentUnit`.
- **Subagent 2 (`backend-worker`)**:
  - Owns `apps/api/internal/modules/<unit>/module.go` and `apps/api/internal/modules/<unit>/module_test.go`.
  - Implements REST/SSE endpoints using `deps.Store` (Firestore/Memory) and `deps.Argon` (`gemini-4-argon`), registers the module in `apps/api/cmd/server/main.go`, and runs `go test -v -race ./...`.
- **Subagent 3 (`frontend-worker`)**:
  - Owns `apps/web/src/modules/<unit>/<Unit>Module.tsx`.
  - Builds the reactive SolidJS UI using `apiClient` and `useAuth()`, registers the module in `apps/web/src/modules/registry.ts`, and runs `bun run typecheck && bun test`.

### Step 3: Verify & Ship to Cloud Run — ~60 seconds
Run from the repo root:
```bash
bun run check && bun run typecheck && bun run test:all
git add -A && git commit -m "feat: add <unit> module" && git push origin main
```
GitHub Actions CI + Cloud Run CD (`.github/workflows/cd-gcp.yml`) will automatically build and deploy both `argon-api` and `argon-web` to `asia-northeast3`.
