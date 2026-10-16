import type {
  AuthVerifyResponse,
  CreateEntityRequest,
  EntityRecord,
  FeatureModuleMeta,
  ListEntitiesResponse,
  UpdateEntityRequest,
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
