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

// ============================================================================
// 6. AEGIS-4: Autonomous Exploit Verification, Binary Hot-Patch & Route-Shield
// ============================================================================

export type AegisIntakeMode = "github" | "url-dns" | "binary";

export type AegisTargetType = "web" | "api" | "binary" | "hybrid";

export type AegisRemediationMode = "git-pr" | "binary-patch" | "route-shield";

export type AegisDefenseStatus =
  | "unprotected"
  | "poc_confirmed_red"
  | "patched_via_pr"
  | "protected_via_route_shield"
  | "binary_hard_patched";

export type AegisSeverity = "critical" | "high" | "medium" | "low";

export type AegisStageId = "recon" | "poc_red" | "remediation" | "verify_green";

export type AegisStageStatus = "pending" | "running" | "passed_green" | "confirmed_red" | "failed";

export interface AegisTimelineStep {
  stage: AegisStageId;
  title: string;
  modelUsed: string;
  status: AegisStageStatus;
  durationMs: number;
  summary: string;
  commandOrLog: string;
  timestamp: string;
}

export interface AegisCodePatchDiff {
  filePath: string;
  language: string;
  beforeCode: string;
  afterCode: string;
  unifiedDiff: string;
  explanation: string;
}

export interface AegisGitHubPrReport {
  branchName: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  commitSha: string;
  status: "open" | "merged" | "draft";
  ciChecksPassed: boolean;
  markdownComment: string;
  codeDiff: AegisCodePatchDiff;
}

export interface AegisBinaryPatchInstruction {
  offsetHex: string;
  section: string;
  functionName: string;
  beforeBytesHex: string;
  afterBytesHex: string;
  beforeAsm: string;
  afterAsm: string;
  rationale: string;
}

export interface AegisBinaryAnalysis {
  fileName: string;
  format: "ELF64-x86_64" | "PE32+-x64" | "Mach-O-arm64" | "APK-Dalvik";
  fileSizeBytes: number;
  sha256Before: string;
  sha256After: string;
  protections: {
    nxEnabled: boolean;
    pieEnabled: boolean;
    stackCanary: boolean;
    relro: "full" | "partial" | "none";
  };
  dangerousSinks: string[];
  patchInstructions: AegisBinaryPatchInstruction[];
  sandboxBeforeLog: string;
  sandboxAfterLog: string;
  downloadUrl: string;
}

export interface AegisRouteShieldRule {
  ruleId: string;
  enabled: boolean;
  protectedPath: string;
  methods: string[];
  blockPatternRegex: string;
  rateLimitRps: number;
  blockedRequestsCount: number;
  lastBlockedAt?: string;
  sampleAttackPayload: string;
  snippets: {
    cloudRunGin: string;
    cloudArmor: string;
    cloudflareWorker: string;
    nginx: string;
    envoy: string;
  };
}

export interface AegisVulnerabilityFinding {
  id: string;
  cveOrCwe: string;
  title: string;
  severity: AegisSeverity;
  cvssScore: number;
  location: string;
  rootCause: string;
  attackVector: string;
  pocPayload: string;
  pocRedLog: string;
  verifyGreenLog: string;
  zeroFalsePositiveConfirmed: boolean;
}

export type AegisDeliveryChannel = "github" | "web_url" | "api_server" | "binary_app";

export type AegisSecuritySolutionId =
  | "ast-pr-patch"
  | "cicd-webhook"
  | "sandbox-dast"
  | "reverse-proxy-shield"
  | "binary-hard-patch"
  | "prepatched-installer"
  | "local-self-healing-sdk";

export interface AegisDeliveryChannelInputs {
  githubRepoUrl?: string;
  webTargetUrl?: string;
  apiServerUrl?: string;
  binaryAppName?: string;
}

export interface AegisSecuritySolutionOption {
  id: AegisSecuritySolutionId;
  title: string;
  subtitle: string;
  matchedChannels: AegisDeliveryChannel[];
  badge: string;
  recommended: boolean;
}

export interface AegisAutomationHookConfig {
  enabled: boolean;
  webhookUrl: string;
  secretHeader: string;
  triggers: string[];
  lastTriggeredAt?: string;
  totalRuns: number;
  lastRunVerdict?: string;
}

export interface AegisLocalSdkStatus {
  sdkPackage: string;
  sdkVersion: string;
  centralServerUrl: string;
  connected: boolean;
  autoPatchLocal: boolean;
  patchedFilesCount: number;
  lastSyncedAt?: string;
  lastLocalPatchSummary?: string;
  embedSnippet: string;
}

export interface AegisSafeDeliveryStatus {
  prepatchedAppReady: boolean;
  prepatchedInstallerName: string;
  prepatchedDownloadUrl: string;
  prepatchedSha256: string;
  reverseProxyReady: boolean;
  reverseProxyEndpoint: string;
  upstreamOrigin: string;
  protectionMode: string;
}

export interface AegisProject {
  id: string;
  name: string;
  subtitle: string;
  intakeMode: AegisIntakeMode;
  targetType: AegisTargetType;
  remediationMode: AegisRemediationMode;
  defenseStatus: AegisDefenseStatus;
  // Intake specifics
  repoUrl?: string;
  cdWorkflowPath?: string;
  targetUrl?: string;
  apiServerUrl?: string;
  dnsDomain?: string;
  dnsTxtRecordName?: string;
  dnsTxtToken?: string;
  dnsVerified: boolean;
  binaryFileName?: string;
  deliveryChannels?: AegisDeliveryChannel[];
  channelInputs?: AegisDeliveryChannelInputs;
  selectedSolutions?: AegisSecuritySolutionId[];
  automationHook?: AegisAutomationHookConfig;
  localSdkStatus?: AegisLocalSdkStatus;
  safeDeliveryStatus?: AegisSafeDeliveryStatus;
  // Core security telemetry
  vulnerabilities: AegisVulnerabilityFinding[];
  timeline: AegisTimelineStep[];
  gitPrReport?: AegisGitHubPrReport;
  binaryAnalysis?: AegisBinaryAnalysis;
  routeShield?: AegisRouteShieldRule;
  lastScanDurationMs: number;
  updatedAt: string;
}

export interface CreateAegisProjectRequest {
  name: string;
  intakeMode: AegisIntakeMode;
  repoUrl?: string;
  cdConfigSnippet?: string;
  targetUrl?: string;
  apiServerUrl?: string;
  binaryFileName?: string;
  binarySizeBytes?: number;
  binaryHexPreview?: string;
  deliveryChannels?: AegisDeliveryChannel[];
  channelInputs?: AegisDeliveryChannelInputs;
  selectedSolutions?: AegisSecuritySolutionId[];
}

export interface AegisVerifyDnsRequest {
  projectId: string;
  simulateTxtPropagation?: boolean;
}

export interface AegisVerifyDnsResponse {
  projectId: string;
  domain: string;
  txtRecordName: string;
  expectedToken: string;
  dnsVerified: boolean;
  resolverUsed: string;
  message: string;
  project: AegisProject;
}

export interface AegisRunPipelineRequest {
  projectId: string;
  remediationMode?: AegisRemediationMode;
  dryRun?: boolean;
}

export interface AegisRunPipelineResponse {
  project: AegisProject;
  interactionIds: string[];
  totalDurationMs: number;
}

export interface AegisShieldTestAttackRequest {
  projectId: string;
  attackPath?: string;
  attackPayload?: string;
}

export interface AegisShieldTestAttackResponse {
  projectId: string;
  shieldEnabled: boolean;
  httpStatus: number;
  verdict: "BLOCKED_GREEN" | "EXPLOITED_RED";
  ruleTriggered?: string;
  responseBody: string;
  latencyMs: number;
  project: AegisProject;
}

export interface AegisScanStreamEvent {
  type: "stage_update" | "scan_complete";
  stageIndex?: number;
  step?: AegisTimelineStep;
  project?: AegisProject;
  interactionIds?: string[];
  totalDurationMs?: number;
}

export interface AegisBinaryUploadRequest {
  fileName: string;
  format?: "ELF64" | "PE32+" | "Mach-O" | "APK";
  base64Data: string;
}

export interface AegisUpdateShieldRuleRequest {
  protectedPath?: string;
  methods?: string[];
  mitigationPattern?: string;
  blockPatternRegex?: string;
  rateLimitPerMinute?: number;
  rateLimitRps?: number;
}

export interface AegisCreatePrResponse {
  projectId: string;
  prUrl: string;
  prBranch: string;
  prNumber: number;
  prTitle: string;
  status: "ready_to_open" | "opened" | "merged";
  patchFileUrl: string;
  ghCliCommand: string;
  project: AegisProject;
}

export type AegisPipelineStep = AegisTimelineStep;
export type AegisGitPrReport = AegisGitHubPrReport;

export interface AegisRecommendSolutionsRequest {
  deliveryChannels: AegisDeliveryChannel[];
  channelInputs?: AegisDeliveryChannelInputs;
}

export interface AegisRecommendSolutionsResponse {
  deliveryChannels: AegisDeliveryChannel[];
  recommendedSolutions: AegisSecuritySolutionOption[];
  analysisSummary: string;
}

export interface AegisWebhookTriggerResponse {
  projectId: string;
  triggered: boolean;
  event: string;
  verdict: string;
  remediationApplied: string;
  timestamp: string;
  project: AegisProject;
}

export interface AegisLocalSdkPatchResponse {
  projectId: string;
  centralServerUrl: string;
  centralAnalysisModel: string;
  localPatchApplied: boolean;
  patchedFile: string;
  patchSummary: string;
  timestamp: string;
  project: AegisProject;
}
