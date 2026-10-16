import type {
  AegisBinaryUploadRequest,
  AegisCreatePrResponse,
  AegisProject,
  AegisRemediationMode,
  AegisScanStreamEvent,
  AegisUpdateShieldRuleRequest,
  AuthVerifyResponse,
  CreateEntityRequest,
  EntityRecord,
  FeatureModuleMeta,
  ListEntitiesResponse,
  UpdateEntityRequest,
  VerifyCritiquePolishResponse,
  WorkspaceAiSynthesizeRequest,
  WorkspaceAiSynthesizeResponse,
  WorkspaceItemData,
} from "@deepmind/shared";
import { getCurrentSession } from "../auth/firebaseAuth";

export function buildAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  const session = getCurrentSession();
  if (session) {
    if (session.user.provider === "demo") {
      headers["X-Demo-User"] = session.user.uid;
    } else if (session.idToken) {
      headers.Authorization = `Bearer ${session.idToken}`;
    }
  }
  return headers;
}

async function apiRequest<TResponse>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<TResponse> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: buildAuthHeaders(options.headers),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `API ${options.method ?? "GET"} ${path} failed (${response.status}): ${errText}`,
    );
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  return (await response.json()) as TResponse;
}

function unwrapEntityRecord<T>(raw: unknown): EntityRecord<T> {
  if (raw && typeof raw === "object" && "item" in raw) {
    const wrapped = (raw as { item?: EntityRecord<T> }).item;
    if (wrapped) return wrapped;
  }
  return raw as EntityRecord<T>;
}

export async function fetchAuthMe(): Promise<AuthVerifyResponse> {
  return apiRequest<AuthVerifyResponse>("/api/auth/me");
}

export async function fetchBackendModules(): Promise<FeatureModuleMeta[]> {
  const res = await apiRequest<FeatureModuleMeta[] | { modules?: FeatureModuleMeta[] }>(
    "/api/modules",
  );
  if (Array.isArray(res)) {
    return res;
  }
  return res.modules ?? [];
}

// ============================================================================
// Generic Cloud Firestore / In-Memory Dual Store CRUD (/api/db/:collection)
// ============================================================================

export async function listEntities<T = Record<string, unknown>>(
  collection: string,
): Promise<ListEntitiesResponse<T>> {
  return apiRequest<ListEntitiesResponse<T>>(`/api/db/${encodeURIComponent(collection)}`);
}

export async function createEntity<T = Record<string, unknown>>(
  collection: string,
  data: T,
  id?: string,
): Promise<EntityRecord<T>> {
  const payload: CreateEntityRequest<T> = { id, data };
  const raw = await apiRequest<EntityRecord<T> | { item: EntityRecord<T> }>(
    `/api/db/${encodeURIComponent(collection)}`,
    {
      method: "POST",
      body: payload,
    },
  );
  return unwrapEntityRecord<T>(raw);
}

export async function updateEntity<T = Record<string, unknown>>(
  collection: string,
  id: string,
  data: Partial<T>,
): Promise<EntityRecord<T>> {
  const payload: UpdateEntityRequest<T> = { data };
  const raw = await apiRequest<EntityRecord<T> | { item: EntityRecord<T> }>(
    `/api/db/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
  return unwrapEntityRecord<T>(raw);
}

export async function deleteEntity(
  collection: string,
  id: string,
): Promise<{ deleted: boolean; id: string }> {
  return apiRequest<{ deleted: boolean; id: string }>(
    `/api/db/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

// ============================================================================
// Starter "workspace" Module API (/api/modules/workspace/*)
// ============================================================================

export async function listWorkspaceItems(): Promise<ListEntitiesResponse<WorkspaceItemData>> {
  return apiRequest<ListEntitiesResponse<WorkspaceItemData>>("/api/modules/workspace/items");
}

export async function createWorkspaceItem(
  data: WorkspaceItemData,
): Promise<EntityRecord<WorkspaceItemData>> {
  const raw = await apiRequest<
    EntityRecord<WorkspaceItemData> | { item: EntityRecord<WorkspaceItemData> }
  >("/api/modules/workspace/items", {
    method: "POST",
    body: {
      ...data,
      data,
    },
  });
  return unwrapEntityRecord<WorkspaceItemData>(raw);
}

export async function updateWorkspaceItem(
  id: string,
  data: Partial<WorkspaceItemData>,
): Promise<EntityRecord<WorkspaceItemData>> {
  const raw = await apiRequest<
    EntityRecord<WorkspaceItemData> | { item: EntityRecord<WorkspaceItemData> }
  >(`/api/modules/workspace/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: {
      ...data,
      data,
    },
  });
  return unwrapEntityRecord<WorkspaceItemData>(raw);
}

export async function deleteWorkspaceItem(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiRequest<{ deleted: boolean; id: string }>(
    `/api/modules/workspace/items/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export async function synthesizeWorkspaceItem(
  req: WorkspaceAiSynthesizeRequest,
): Promise<WorkspaceAiSynthesizeResponse> {
  return apiRequest<WorkspaceAiSynthesizeResponse>("/api/modules/workspace/synthesize", {
    method: "POST",
    body: req,
  });
}

export function getAegisBinaryDownloadUrl(projectId: string): string {
  return `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/binary-download`;
}

export function getAegisPatchDownloadUrl(projectId: string): string {
  return `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/patch-download`;
}

export function getAegisShieldProxyUrl(
  projectId: string,
  proxyPath = "/api/v1/webhooks/preview",
): string {
  const normalized = proxyPath.startsWith("/") ? proxyPath : `/${proxyPath}`;
  return `/api/modules/aegis/shield-proxy/${encodeURIComponent(projectId)}${normalized}`;
}

export async function streamAegisPipeline(
  projectId: string,
  remediationMode: AegisRemediationMode | undefined,
  dryRun: boolean,
  onEvent: (evt: AegisScanStreamEvent) => void,
): Promise<void> {
  const res = await fetch(
    `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/scan/stream`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ projectId, remediationMode, dryRun }),
    },
  );
  if (!res.ok || !res.body) {
    throw new Error(`SSE stream failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (dataLine) {
        onEvent(JSON.parse(dataLine) as AegisScanStreamEvent);
      }
    }
  }
}

export async function uploadAegisBinary(
  projectId: string,
  req: AegisBinaryUploadRequest,
): Promise<AegisProject> {
  const raw = await apiRequest<{ project?: AegisProject } & AegisProject>(
    `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/binary-upload`,
    {
      method: "POST",
      body: req,
    },
  );
  return raw.project ?? raw;
}

export async function createAegisGitHubPr(projectId: string): Promise<AegisCreatePrResponse> {
  return apiRequest<AegisCreatePrResponse>(
    `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/create-pr`,
    {
      method: "POST",
      body: {},
    },
  );
}

export async function updateAegisShieldRule(
  projectId: string,
  req: AegisUpdateShieldRuleRequest,
): Promise<AegisProject> {
  const raw = await apiRequest<{ project?: AegisProject } & AegisProject>(
    `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/shield-rule`,
    {
      method: "PATCH",
      body: req,
    },
  );
  return raw.project ?? raw;
}

export async function polishAegisProject(
  projectId: string,
  dryRun = true,
): Promise<VerifyCritiquePolishResponse & { project?: AegisProject }> {
  return apiRequest<VerifyCritiquePolishResponse & { project?: AegisProject }>(
    `/api/modules/aegis/projects/${encodeURIComponent(projectId)}/polish?dryRun=${dryRun ? "true" : "false"}`,
    {
      method: "POST",
      body: {},
    },
  );
}

export async function resetAegisProjects(): Promise<{
  reset: boolean;
  projects: AegisProject[];
  count: number;
}> {
  return apiRequest<{ reset: boolean; projects: AegisProject[]; count: number }>(
    "/api/modules/aegis/reset",
    {
      method: "POST",
      body: {},
    },
  );
}

export async function deleteAegisProject(projectId: string): Promise<{ deleted: string }> {
  return apiRequest<{ deleted: string }>(
    `/api/modules/aegis/projects/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
    },
  );
}
