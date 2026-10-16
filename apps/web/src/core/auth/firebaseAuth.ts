import {
  type AuthSession,
  type AuthUser,
  DEFAULT_FIREBASE_CONFIG,
  type FirebaseClientConfig,
} from "@deepmind/shared";
import { type Accessor, createSignal } from "solid-js";

const STORAGE_KEY = "argon_auth_session_v1";

interface IdentityToolkitSignUpResponse {
  idToken: string;
  email?: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  displayName?: string;
}

interface IdentityToolkitErrorPayload {
  error?: {
    code?: number;
    message?: string;
  };
}

export function getActiveFirebaseConfig(): FirebaseClientConfig {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  };
}

function createDemoSession(name?: string): AuthSession {
  const cleanName = name?.trim() || "Argon Hackathon Builder";
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const uid = `demo-${slug || "hacker"}`;
  const user: AuthUser = {
    uid,
    displayName: cleanName,
    email: `${uid}@demo.argon.local`,
    provider: "demo",
    isAnonymous: false,
  };
  return {
    user,
    idToken: `demo-token-${uid}`,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.user?.uid || !parsed?.idToken) return null;
    if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(nextSession: AuthSession | null): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    if (!nextSession) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    }
  } catch {
    // Ignore storage quota errors in restricted webviews
  }
}

const initialSession = readStoredSession() ?? createDemoSession();
writeStoredSession(initialSession);

const [sessionSignal, setSessionSignal] = createSignal<AuthSession | null>(initialSession);
const [loadingSignal, setLoadingSignal] = createSignal<boolean>(false);
const [errorSignal, setErrorSignal] = createSignal<string | null>(null);

function updateSession(next: AuthSession | null): void {
  setSessionSignal(next);
  writeStoredSession(next);
}

export function getCurrentSession(): AuthSession | null {
  return sessionSignal();
}

async function callIdentityToolkit(
  endpoint: "accounts:signUp" | "accounts:signInWithPassword",
  payload: Record<string, unknown>,
): Promise<IdentityToolkitSignUpResponse> {
  const { apiKey } = getActiveFirebaseConfig();
  const url = `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errJson = (await response.json()) as IdentityToolkitErrorPayload;
      if (errJson.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      // Fallback to status code
    }
    throw new Error(`Firebase Identity Platform Error: ${message}`);
  }

  return (await response.json()) as IdentityToolkitSignUpResponse;
}

export async function signInAnonymously(): Promise<AuthSession> {
  setLoadingSignal(true);
  setErrorSignal(null);
  try {
    const data = await callIdentityToolkit("accounts:signUp", {
      returnSecureToken: true,
    });
    const expiresInSec = Number(data.expiresIn) || 3600;
    const nextSession: AuthSession = {
      user: {
        uid: data.localId,
        displayName: `Anon #${data.localId.slice(0, 6)}`,
        provider: "anonymous",
        isAnonymous: true,
      },
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    updateSession(nextSession);
    return nextSession;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setErrorSignal(msg);
    throw err;
  } finally {
    setLoadingSignal(false);
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthSession> {
  setLoadingSignal(true);
  setErrorSignal(null);
  try {
    const cleanEmail = email.trim();
    const data = await callIdentityToolkit("accounts:signUp", {
      email: cleanEmail,
      password,
      returnSecureToken: true,
    });
    const expiresInSec = Number(data.expiresIn) || 3600;
    const nextSession: AuthSession = {
      user: {
        uid: data.localId,
        email: data.email || cleanEmail,
        displayName: data.displayName || cleanEmail.split("@")[0],
        provider: "password",
        isAnonymous: false,
      },
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    updateSession(nextSession);
    return nextSession;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setErrorSignal(msg);
    throw err;
  } finally {
    setLoadingSignal(false);
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  setLoadingSignal(true);
  setErrorSignal(null);
  try {
    const cleanEmail = email.trim();
    const data = await callIdentityToolkit("accounts:signInWithPassword", {
      email: cleanEmail,
      password,
      returnSecureToken: true,
    });
    const expiresInSec = Number(data.expiresIn) || 3600;
    const nextSession: AuthSession = {
      user: {
        uid: data.localId,
        email: data.email || cleanEmail,
        displayName: data.displayName || cleanEmail.split("@")[0],
        provider: "password",
        isAnonymous: false,
      },
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    updateSession(nextSession);
    return nextSession;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setErrorSignal(msg);
    throw err;
  } finally {
    setLoadingSignal(false);
  }
}

export function signInDemo(name?: string): AuthSession {
  setErrorSignal(null);
  const nextSession = createDemoSession(name);
  updateSession(nextSession);
  return nextSession;
}

export function signOut(): void {
  setErrorSignal(null);
  updateSession(null);
}

export interface UseAuthReturn {
  session: Accessor<AuthSession | null>;
  user: Accessor<AuthUser | null>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  signInAnonymously: () => Promise<AuthSession>;
  signInWithEmail: (email: string, password: string) => Promise<AuthSession>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthSession>;
  signInDemo: (name?: string) => AuthSession;
  signOut: () => void;
}

export function useAuth(): UseAuthReturn {
  const user: Accessor<AuthUser | null> = () => sessionSignal()?.user ?? null;
  return {
    session: sessionSignal,
    user,
    loading: loadingSignal,
    error: errorSignal,
    signInAnonymously,
    signInWithEmail,
    signUpWithEmail,
    signInDemo,
    signOut,
  };
}
