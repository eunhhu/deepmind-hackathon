---
name: argon-parallel-scaffolder
description: >-
  Use this skill when scaffolding or building full-stack monorepo features in parallel using
  Antigravity subagents and the Gemini 4 Argon (`gemini-4-argon`) parallel Interactions API engine.
---

# Gemini 4 Argon Hyper-Parallel Scaffolding Workflow

This skill coordinates **two levels of massive parallelism**:
1. **IDE-Level Agentic Parallelism**: Spawning multiple Gemini 4 Argon subagents concurrently via `invoke_subagent` with strict directory isolation.
2. **Application-Level API Parallelism**: Using `packages/argon-orchestrator` to run parallel `gemini-4-argon` Interactions API calls, context-forked fan-out (`previous_interaction_id`), background long-decode (>64K tokens), and remote `antigravity-preview-09-2026` sandboxed agent swarms.

## Monorepo Target Layout

```text
/Users/sunwoo/work/deepmind/
├── AGENTS.md                           # Always-on parallel & Gemini 4 Argon rules
├── packages/
│   ├── shared/                         # Shared contracts, schemas, types (Phase 0)
│   └── argon-orchestrator/             # Reusable Python & TS Gemini 4 Argon parallel engine
│       ├── python/argon_parallel.py    # Async fan-out, context forking, background swarm
│       └── ts/src/index.ts             # TypeScript parallel orchestrator for @google/genai
└── apps/
    ├── backend/                        # Backend API & worker service (backend-worker)
    └── frontend/                       # Web UI & streaming step visualizer (frontend-worker)
```

## Step-by-Step Scaffolding Execution Procedure

### Step 1: Lock Contracts (`packages/shared`)
Before spawning parallel builders, write the shared data models, API route contracts, and environment variable definitions in `packages/shared/`.

### Step 2: Single-Call Multi-Subagent Dispatch (`invoke_subagent`)
Invoke `backend-worker`, `frontend-worker`, and `agent-pipeline-worker` **simultaneously in one `invoke_subagent` call**:
- Always set `Model: "inherit"` so every subagent runs on Gemini 4 Argon.
- Give each subagent:
  1. Its exact owned directory (`apps/backend`, `apps/frontend`, `packages/argon-orchestrator`, etc.).
  2. The path to the shared contracts in `packages/shared`.
  3. Explicit instructions not to touch files outside its directory.

### Step 3: Integration & Verification (`qa-integrator`)
After parallel workers finish, run `qa-integrator` or execute workspace build/test scripts to verify end-to-end integration.
