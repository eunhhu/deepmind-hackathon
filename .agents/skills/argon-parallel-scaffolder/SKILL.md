---
name: argon-parallel-scaffolder
description: Use this skill when scaffolding or building full-stack monorepo features in parallel using Antigravity subagents, Preline UI (preline.co), Dynamic Effort Routing, and the Gemini 4 Argon (`gemini-4-argon`) parallel Interactions API engine.
---

# Gemini 4 Argon Unlimited-Credit Hyper-Speed Parallel Pipeline

Use this runbook to execute any hackathon feature request at maximum speed without sacrificing quality.

---

## 1. The 4-Stage Hyper-Speed Pipeline

```
[Stage 0: Contract Lock (15s)]
   └─ Lead Agent updates `packages/shared/src/index.ts`

[Stage 1: 1-File Micro-Sharding Wave (30–45s)]
   ├─ micro-coder #1 ──► packages/argon-orchestrator/src/units/<unit>.ts
   ├─ micro-coder #2 ──► packages/argon-orchestrator/src/units/<unit>.test.ts
   ├─ micro-coder #3 ──► apps/api/internal/modules/<unit>/module.go
   ├─ micro-coder #4 ──► apps/api/internal/modules/<unit>/module_test.go
   ├─ preline-ui-specialist #1 ──► apps/web/src/modules/<unit>/<Unit>Module.tsx
   └─ preline-ui-specialist #2 ──► apps/web/src/modules/<unit>/<Unit>SubView.tsx

[Stage 2: 25s Watchdog & Live Steering]
   └─ `schedule(DurationSeconds=25, TimerCondition="any")` + `manage_subagents(Action="list")`
      ├─ Steer slow subagent via `send_message` ("Skip reads, write file now")
      └─ Or spawn helper `micro-coder` to steal remaining test/wiring file

[Stage 3: Verify → Critique → Polish ("검증/검수 후 깎기") (20s)]
   └─ Run `bun run check && bun run typecheck && bun run test:all` + `critic-polisher` pass
```

---

## 2. Subagent Prompt Template (Zero-Exploration / Turn-1 Write)

Always structure subagent prompts so they write code on **Turn 1**:

```markdown
ZERO-LATENCY RULE: DO NOT read any files first. Call `write_to_file` on your VERY FIRST turn to create `<AbsolutePath>`.

### Inline Contract & Available Imports:
```ts
// Paste exact 10-20 lines of types/imports here
```

### Implementation Spec:
- Use Preline UI (`preline.co`) primitives from `../../core/ui/preline` (`PrelineCard`, `PrelineButton`, `PrelineBadge`, `PrelineInput`, `PrelineSelect`).
- ...
```

---

## 3. Preline UI (`preline.co`) Quick Reference (`apps/web/src/core/ui/preline.tsx`)

Import ready-made Preline primitives in any SolidJS module:
```tsx
import {
  PrelineAlert,
  PrelineBadge,
  PrelineButton,
  PrelineCard,
  PrelineInput,
  PrelineSelect,
  PrelineStatCard,
  PrelineTextarea,
} from "../../core/ui/preline";
```
