import type { AuthVerifyResponse } from "@deepmind/shared";
import { createEffect, createSignal, Show } from "solid-js";
import { fetchAuthMe } from "../api/client";
import { getActiveFirebaseConfig, useAuth } from "./firebaseAuth";

export function AuthBar() {
  const auth = useAuth();
  const firebaseCfg = getActiveFirebaseConfig();

  const [verifyInfo, setVerifyInfo] = createSignal<AuthVerifyResponse | null>(null);
  const [verifying, setVerifying] = createSignal<boolean>(false);
  const [showEmailPanel, setShowEmailPanel] = createSignal<boolean>(false);
  const [emailInput, setEmailInput] = createSignal<string>("");
  const [passwordInput, setPasswordInput] = createSignal<string>("");

  const refreshBackendAuth = async () => {
    setVerifying(true);
    try {
      const info = await fetchAuthMe();
      setVerifyInfo(info);
    } catch {
      setVerifyInfo(null);
    } finally {
      setVerifying(false);
    }
  };

  createEffect(() => {
    // Re-verify against /api/auth/me whenever the active session changes
    auth.session();
    void refreshBackendAuth();
  });

  const providerBadgeText = () => {
    const current = auth.user();
    if (!current) return "unauthenticated";
    if (current.provider === "anonymous") return "firebase-anon";
    return current.provider;
  };

  const storeBadgeText = () => {
    const info = verifyInfo();
    if (!info) {
      return verifying() ? "Checking Store..." : "Backend Store Ready";
    }
    return info.storeBackend === "firestore"
      ? "Firestore Native (asia-northeast3)"
      : "In-Memory Fast Store";
  };

  const handleAnonSignIn = async () => {
    try {
      await auth.signInAnonymously();
    } catch {
      // Error surfaced via auth.error()
    }
  };

  const handleEmailSignIn = async () => {
    if (!emailInput().trim() || !passwordInput()) return;
    try {
      await auth.signInWithEmail(emailInput(), passwordInput());
      setShowEmailPanel(false);
      setPasswordInput("");
    } catch {
      // Error surfaced via auth.error()
    }
  };

  const handleEmailSignUp = async () => {
    if (!emailInput().trim() || !passwordInput()) return;
    try {
      await auth.signUpWithEmail(emailInput(), passwordInput());
      setShowEmailPanel(false);
      setPasswordInput("");
    } catch {
      // Error surfaced via auth.error()
    }
  };

  const handleDemoSwitch = () => {
    const suffix = Math.floor(100 + Math.random() * 900);
    auth.signInDemo(`Hacker #${suffix}`);
  };

  return (
    <div class="auth-bar-wrapper">
      <div class="auth-bar">
        <div class="auth-status-group">
          <span class="auth-project-pill" title="GCP Project & Identity Platform">
            GCP: <strong>{firebaseCfg.projectId}</strong>
          </span>

          <span
            class={`auth-store-pill ${
              verifyInfo()?.storeBackend === "firestore" ? "store-firestore" : "store-memory"
            }`}
          >
            <span class="status-dot" />
            <span>{storeBadgeText()}</span>
          </span>

          <Show
            when={auth.user()}
            fallback={<span class="auth-user-badge provider-none">Not Signed In</span>}
          >
            {(currentUser) => (
              <div class="auth-user-badge">
                <span class={`provider-tag provider-${providerBadgeText()}`}>
                  {providerBadgeText()}
                </span>
                <strong class="auth-user-name">
                  {currentUser().email || currentUser().displayName || currentUser().uid}
                </strong>
                <span class="auth-uid-code">uid:{currentUser().uid.slice(0, 14)}</span>
              </div>
            )}
          </Show>
        </div>

        <div class="auth-actions-group">
          <button
            type="button"
            class="btn btn-auth-anon"
            disabled={auth.loading()}
            onClick={handleAnonSignIn}
          >
            ⚡ 1-Click Firebase Anon Auth
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            onClick={() => setShowEmailPanel((prev) => !prev)}
          >
            🔐 Email Auth
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            disabled={auth.loading()}
            onClick={handleDemoSwitch}
          >
            🧪 Demo User
          </button>

          <Show when={auth.user()}>
            <button type="button" class="btn btn-ghost" onClick={() => auth.signOut()}>
              Sign Out
            </button>
          </Show>
        </div>
      </div>

      <Show when={showEmailPanel()}>
        <div class="auth-email-popover">
          <label class="auth-inline-field">
            <span>Email</span>
            <input
              type="email"
              class="input"
              placeholder="hacker@deepmind.dev"
              value={emailInput()}
              onInput={(e) => setEmailInput(e.currentTarget.value)}
            />
          </label>

          <label class="auth-inline-field">
            <span>Password</span>
            <input
              type="password"
              class="input"
              placeholder="Min 6 characters"
              value={passwordInput()}
              onInput={(e) => setPasswordInput(e.currentTarget.value)}
            />
          </label>

          <div class="auth-inline-buttons">
            <button
              type="button"
              class="btn btn-primary"
              disabled={auth.loading() || !emailInput().trim() || passwordInput().length < 6}
              onClick={handleEmailSignIn}
            >
              Sign In
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={auth.loading() || !emailInput().trim() || passwordInput().length < 6}
              onClick={handleEmailSignUp}
            >
              Sign Up (Identity Platform)
            </button>
          </div>
        </div>
      </Show>

      <Show when={auth.error()}>{(err) => <div class="error-banner">{err()}</div>}</Show>
    </div>
  );
}
