/**
 * Shared Zero-Overhead Contracts between:
 * - `apps/api` (Go 1.27 + Gin + Goroutine Gemini 4 Argon Engine)
 * - `packages/argon-orchestrator` (Bun + TS `@google/genai` Parallel Engine)
 * - `apps/web` (SolidJS Zero-VDOM Reactive UI)
 */

export type ArgonThinkingLevel = "low" | "medium" | "high";

export type ArgonModelId = "gemini-4-argon" | "gemini-3.8-flash" | "gemini-3.5-flash-lite";

export type ArgonAgentId =
  | "antigravity-preview-09-2026"
  | "deep-research-preview-04-2026"
  | "deep-research-max-preview-04-2026";

export type InteractionStatus =
  | "queued"
  | "in_progress"
  | "requires_action"
  | "completed"
  | "incomplete"
  | "failed"
  | "cancelled";

export interface ParallelTaskInput {
  id: string;
  label: string;
  prompt: string;
  thinkingLevel?: ArgonThinkingLevel;
  maxOutputTokens?: number;
  background?: boolean;
  useManagedAgent?: boolean;
}

export interface ParallelSwarmRequest {
  /** Optional shared context (>4,096 tokens triggers 95% implicit cache discount via root interaction fork) */
  sharedContext?: string;
  systemInstruction?: string;
  model?: ArgonModelId;
  defaultThinkingLevel?: ArgonThinkingLevel;
  maxConcurrency?: number;
  tasks: ParallelTaskInput[];
}

export interface StepSummary {
  index: number;
  type:
    | "user_input"
    | "thought"
    | "model_output"
    | "function_call"
    | "function_result"
    | "google_search_call"
    | "google_search_result"
    | "code_execution_call"
    | "code_execution_result"
    | "url_context_call"
    | "url_context_result"
    | string;
  text?: string;
  thoughtSummary?: string;
}

export interface ParallelTaskResult {
  taskId: string;
  label: string;
  interactionId: string;
  status: InteractionStatus;
  outputText: string;
  steps: StepSummary[];
  durationMs: number;
  totalTokens?: number;
  error?: string;
}

export interface ParallelSwarmResponse {
  rootInteractionId?: string;
  totalDurationMs: number;
  results: ParallelTaskResult[];
}
