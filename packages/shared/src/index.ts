/**
 * Shared Zero-Overhead Contracts between:
 * - `apps/api` (Go 1.27 + Gin + Goroutine Gemini 4 Argon Engine + Firebase Auth + Firestore Store)
 * - `packages/argon-orchestrator` (Bun + TS `@google/genai` Parallel Engine & Modular Agent Units)
 * - `apps/web` (SolidJS Zero-VDOM Reactive UI + Plug-and-Play Feature Module Registry)
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

// ============================================================================
// 1. Firebase / Identity Platform Auth Contracts
// ============================================================================

export interface FirebaseClientConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
}

/**
 * Pre-provisioned GCP Identity Platform + Cloud Firestore Native configuration
 * for the `h2gdm-hack26icn-2693` project (`asia-northeast3`).
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseClientConfig = {
  projectId: "h2gdm-hack26icn-2693",
  apiKey: "AIzaSyDWI2e6DvGGycnWS0swngY4ghGlFPy_GhU",
  authDomain: "h2gdm-hack26icn-2693.firebaseapp.com",
};

export type AuthProviderType = "anonymous" | "password" | "google" | "demo";

export interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  provider: AuthProviderType;
  isAnonymous: boolean;
}

export interface AuthSession {
  user: AuthUser;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthVerifyResponse {
  authenticated: boolean;
  user: AuthUser;
  projectId: string;
  storeBackend: "firestore" | "memory";
}

// ============================================================================
// 2. Cloud Firestore + In-Memory Dual Store Entity Contracts
// ============================================================================

export type StoreBackendType = "firestore" | "memory";

export interface EntityRecord<T = Record<string, unknown>> {
  id: string;
  collection: string;
  ownerUid: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityRequest<T = Record<string, unknown>> {
  id?: string;
  data: T;
}

export interface UpdateEntityRequest<T = Record<string, unknown>> {
  data: Partial<T>;
}

export interface ListEntitiesResponse<T = Record<string, unknown>> {
  collection: string;
  backend: StoreBackendType;
  items: EntityRecord<T>[];
}

// ============================================================================
// 3. Modular Hackathon Feature Unit & Agent Pipeline Contracts
// ============================================================================

export interface FeatureModuleMeta {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  apiPrefix: string;
  collections: string[];
  agentUnitIds: string[];
}

export interface AgentUnitInput<TPayload = Record<string, unknown>> {
  unitId: string;
  payload: TPayload;
  sharedContext?: string;
  previousInteractionId?: string;
  thinkingLevel?: ArgonThinkingLevel;
  maxOutputTokens?: number;
  useManagedAgent?: boolean;
}

export interface AgentUnitResult<TOutput = Record<string, unknown>> {
  unitId: string;
  interactionId: string;
  status: InteractionStatus;
  rawText: string;
  structuredOutput?: TOutput;
  steps: StepSummary[];
  durationMs: number;
  error?: string;
}

// ============================================================================
// 4. Built-in Starter Module ("workspace") Contracts (Template for Parallel Units)
// ============================================================================

export type WorkspaceItemStatus = "todo" | "in_progress" | "done";

export interface WorkspaceItemData {
  title: string;
  description: string;
  status: WorkspaceItemStatus;
  category: string;
  aiSummary?: string;
  tags: string[];
}

export interface WorkspaceAiSynthesizeRequest {
  itemId?: string;
  title: string;
  description: string;
  thinkingLevel?: ArgonThinkingLevel;
  dryRun?: boolean;
}

export interface WorkspaceAiSynthesizeResponse {
  item?: EntityRecord<WorkspaceItemData>;
  aiSummary: string;
  suggestedTags: string[];
  interactionId: string;
  durationMs: number;
}

// ============================================================================
// 5. Dynamic Effort Routing & Automated Verify-Critique-Polish Contracts
// ============================================================================

export type EffortTier =
  | "instant-flash-lite" // gemini-3.5-flash-lite (thinking_level: low, maxOutputTokens: 16384)
  | "fast-flash" // gemini-3.8-flash (thinking_level: low, maxOutputTokens: 32768)
  | "parallel-argon-low" // gemini-4-argon (thinking_level: low, maxOutputTokens: 32768)
  | "balanced-argon-med" // gemini-4-argon (thinking_level: medium, maxOutputTokens: 65536)
  | "deep-argon-high" // gemini-4-argon (thinking_level: high, maxOutputTokens: 65536)
  | "long-decode-argon" // gemini-4-argon (thinking_level: high, maxOutputTokens: 262144, background: true)
  | "autonomous-sandbox"; // antigravity-preview-09-2026 (remote Linux sandbox)

export type TaskComplexityHint =
  | "trivial"
  | "fast"
  | "standard"
  | "complex"
  | "extreme"
  | "sandbox";

export interface EffortRouteDecision {
  tier: EffortTier;
  model: ArgonModelId;
  thinkingLevel: ArgonThinkingLevel;
  maxOutputTokens: number;
  background: boolean;
  useManagedAgent: boolean;
  rationale: string;
}

export interface VerifyCritiquePolishRequest {
  artifactTitle: string;
  artifactType: "ui-preline" | "api-go-gin" | "agent-unit" | "full-feature";
  draftContent: string;
  requirements?: string;
  sharedContext?: string;
  dryRun?: boolean;
}

export interface CritiqueRubricItem {
  dimension: string;
  score: number; // 1..10
  issue: string;
  fixApplied: string;
}

export interface VerifyCritiquePolishResponse {
  artifactTitle: string;
  routeUsed: EffortRouteDecision;
  parallelDraftsCount: number;
  initialScore: number;
  finalScore: number;
  critiqueItems: CritiqueRubricItem[];
  polishedOutput: string;
  totalDurationMs: number;
  steps: ParallelTaskResult[];
}
