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

  const isFirestore = () => verifyInfo()?.storeBackend === "firestore";

  const storeBadgeText = () => {
    const info = verifyInfo();
    if (!info) {
      return verifying() ? "Checking Store..." : "In-Memory Fast Store";
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
    <header class="sticky top-0 inset-x-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-200 dark:bg-neutral-900/95 dark:border-neutral-800">
      <div class="max-w-[85rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left side: Brand logo, title, GCP project pill, Store Backend pill */}
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="flex items-center gap-x-2.5">
            <div class="size-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shadow-2xs text-xs tracking-tighter">
              A4
            </div>
            <span class="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
              AEGIS-4 &bull; Gemini 4 Argon
            </span>
          </div>

          <span
            class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-200"
            title="GCP Project & Identity Platform"
          >
            <span class="text-gray-500 dark:text-neutral-400">GCP:</span>
            <strong class="font-semibold">{firebaseCfg.projectId}</strong>
          </span>

          <span
            class={
              isFirestore()
                ? "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-800/30 dark:text-teal-500"
                : "inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400"
            }
          >
            <span
              class={
                isFirestore()
                  ? "size-1.5 inline-block rounded-full bg-teal-600 dark:bg-teal-400"
                  : "size-1.5 inline-block rounded-full bg-blue-600 dark:bg-blue-400"
              }
            />
            <span>{storeBadgeText()}</span>
          </span>
        </div>

        {/* Right side: Current user badge + Preline auth action buttons */}
        <div class="flex flex-wrap items-center gap-2">
          <Show
            when={auth.user()}
            fallback={
              <span class="inline-flex items-center gap-x-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                Not Signed In
              </span>
            }
          >
            {(currentUser) => (
              <div class="inline-flex items-center gap-x-2 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200">
                <span class="inline-flex items-center py-0.5 px-1.5 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-800/40 dark:text-blue-300">
                  {providerBadgeText()}
                </span>
                <strong class="font-semibold text-gray-900 dark:text-white">
                  {currentUser().email || currentUser().displayName || currentUser().uid}
                </strong>
                <code class="text-[11px] text-gray-500 dark:text-neutral-400 font-mono">
                  uid:{currentUser().uid.slice(0, 12)}
                </code>
              </div>
            )}
          </Show>

          <button
            type="button"
            class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
            disabled={auth.loading()}
            onClick={handleAnonSignIn}
          >
            ⚡ 1-Click Firebase Anon
          </button>

          <button
            type="button"
            class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 cursor-pointer transition-colors"
            onClick={() => setShowEmailPanel((prev) => !prev)}
          >
            🔐 Email Auth
          </button>

          <button
            type="button"
            class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-800/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
            disabled={auth.loading()}
            onClick={handleDemoSwitch}
          >
            🧪 Demo
          </button>

          <Show when={auth.user()}>
            <button
              type="button"
              class="py-1.5 px-2.5 inline-flex items-center gap-x-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
              onClick={() => auth.signOut()}
            >
              Sign Out
            </button>
          </Show>
        </div>
      </div>

      {/* Inline Email / Password Preline Popover Bar */}
      <Show when={showEmailPanel()}>
        <div class="border-t border-gray-200 bg-gray-50/90 dark:bg-neutral-900 dark:border-neutral-800">
          <div class="max-w-[85rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-end gap-3">
            <label class="flex-1 min-w-[200px] block">
              <span class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                Email Address
              </span>
              <input
                type="email"
                class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                placeholder="hacker@deepmind.dev"
                value={emailInput()}
                onInput={(e) => setEmailInput(e.currentTarget.value)}
              />
            </label>

            <label class="flex-1 min-w-[200px] block">
              <span class="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                Password
              </span>
              <input
                type="password"
                class="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-500"
                placeholder="Min 6 characters"
                value={passwordInput()}
                onInput={(e) => setPasswordInput(e.currentTarget.value)}
              />
            </label>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                disabled={auth.loading() || !emailInput().trim() || passwordInput().length < 6}
                onClick={handleEmailSignIn}
              >
                Sign In
              </button>
              <button
                type="button"
                class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                disabled={auth.loading() || !emailInput().trim() || passwordInput().length < 6}
                onClick={handleEmailSignUp}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={auth.error()}>
        {(err) => (
          <div class="border-t border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900/60">
            <div class="max-w-[85rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 text-xs font-medium text-red-800 dark:text-red-300">
              {err()}
            </div>
          </div>
        )}
      </Show>
    </header>
  );
}
