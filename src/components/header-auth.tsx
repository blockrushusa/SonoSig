"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/firebase/use-auth-user";
import { trackEvent } from "@/lib/analytics";
import {
  buildWalletLoginMessage,
  createWalletLoginNonce,
} from "@/lib/wallet-auth";

type AuthMode = "signin" | "signup";

type WalletLoginResponse = {
  error?: string;
  token?: string;
};

function getUserLabel(displayName: string | null, email: string | null) {
  return displayName || email || "Signed in";
}

function getInitial(displayName: string | null, email: string | null) {
  return getUserLabel(displayName, email).slice(0, 1).toUpperCase();
}

export function HeaderAuth() {
  const { auth, user, isLoading } = useAuthUser();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      await signOut(auth);
      disconnect();
      trackEvent("logout", { method: "firebase" });
    } finally {
      setIsBusy(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <span className="rounded-md border border-amber-300/30 px-3 py-2 text-sm font-medium text-amber-100">
        Auth not configured
      </span>
    );
  }

  if (isLoading) {
    return <div className="h-10 w-32 animate-pulse rounded-md bg-white/10" />;
  }

  if (!user) {
    return (
      <>
        <button
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-cyan-100"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setIsModalOpen(true);
            trackEvent("login_modal_open", { location: "header" });
          }}
          type="button"
        >
          Log in
        </button>
        {isModalOpen ? (
          <LoginModal
            auth={auth}
            error={error}
            isBusy={isBusy}
            onClose={() => setIsModalOpen(false)}
            onError={setError}
            onSetBusy={setIsBusy}
            onSuccess={setSuccess}
            success={success}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-white">
          {getUserLabel(user.displayName, user.email)}
        </p>
        <p className="truncate text-xs text-zinc-400">{user.email}</p>
      </div>
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-10 w-10 rounded-full border border-white/15 object-cover"
          src={user.photoURL}
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-cyan-300 text-sm font-semibold text-zinc-950">
          {getInitial(user.displayName, user.email)}
        </div>
      )}
      <button
        className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
        disabled={isBusy}
        onClick={handleSignOut}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

function LoginModal({
  auth,
  error,
  isBusy,
  onClose,
  onError,
  onSetBusy,
  onSuccess,
  success,
}: {
  auth: Auth | null;
  error: string | null;
  isBusy: boolean;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSetBusy: (value: boolean) => void;
  onSuccess: (message: string | null) => void;
  success: string | null;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleGoogleSignIn() {
    if (!auth) {
      onError("Firebase is not configured.");
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    provider.setCustomParameters({ prompt: "select_account" });

    onError(null);
    onSuccess(null);
    onSetBusy(true);

    try {
      await signInWithPopup(auth, provider);
      trackEvent("login", { method: "google" });
      onClose();
    } catch (signInError) {
      onError(getAuthErrorMessage(signInError, "Google sign-in failed."));
    } finally {
      onSetBusy(false);
    }
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) {
      onError("Firebase is not configured.");
      return;
    }

    onError(null);
    onSuccess(null);
    onSetBusy(true);

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        trackEvent("sign_up", { method: "email" });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        trackEvent("login", { method: "email" });
      }

      onClose();
    } catch (authError) {
      onError(
        getAuthErrorMessage(
          authError,
          authMode === "signup"
            ? "Unable to create that email account."
            : "Email sign-in failed.",
        ),
      );
    } finally {
      onSetBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!auth || !email.trim()) {
      onError("Enter your email first.");
      return;
    }

    onError(null);
    onSuccess(null);
    onSetBusy(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      trackEvent("password_reset_request", { method: "email" });
      onSuccess("Password reset email sent.");
    } catch (resetError) {
      onError(getAuthErrorMessage(resetError, "Unable to send reset email."));
    } finally {
      onSetBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-labelledby="login-title"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#11161d] p-6 text-zinc-50 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              SonoSig
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white" id="login-title">
              Log in to continue
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use Google, email, or a wallet signature.
            </p>
          </div>
          <button
            aria-label="Close login"
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-lg font-semibold text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <button
            className="flex items-center justify-center gap-3 rounded-md border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-70"
            disabled={isBusy}
            onClick={handleGoogleSignIn}
            type="button"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-zinc-950 text-xs font-black text-white">
              G
            </span>
            Continue with Google
          </button>

          <WalletLoginPanel
            auth={auth}
            disabled={isBusy}
            onClose={onClose}
            onError={onError}
            onSetBusy={onSetBusy}
            onSuccess={onSuccess}
          />
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Email
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-md border border-white/10 bg-zinc-950/70 p-1">
          {(["signin", "signup"] as const).map((mode) => (
            <button
              aria-pressed={authMode === mode}
              className={
                authMode === mode
                  ? "rounded bg-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-950"
                  : "rounded px-3 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
              }
              key={mode}
              onClick={() => {
                onError(null);
                onSuccess(null);
                trackEvent("login_auth_mode_select", { mode });
                setAuthMode(mode);
              }}
              type="button"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form className="grid gap-3" onSubmit={handleEmailAuth}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-300">Email</span>
            <input
              autoComplete="email"
              className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-300">Password</span>
            <input
              autoComplete={authMode === "signin" ? "current-password" : "new-password"}
              className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              type="password"
              value={password}
            />
          </label>
          <button
            className="mt-1 rounded-md bg-cyan-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
            disabled={isBusy || !email.trim() || password.length < 6}
            type="submit"
          >
            {isBusy
              ? "Working..."
              : authMode === "signin"
                ? "Sign in with email"
                : "Create email account"}
          </button>
        </form>

        <button
          className="mt-3 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60"
          disabled={isBusy}
          onClick={handlePasswordReset}
          type="button"
        >
          Send password reset
        </button>

        {error ? (
          <p className="mt-4 rounded-md border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm leading-6 text-red-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-100">
            {success}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function WalletLoginPanel({
  auth,
  disabled,
  onClose,
  onError,
  onSetBusy,
  onSuccess,
}: {
  auth: Auth | null;
  disabled: boolean;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSetBusy: (value: boolean) => void;
  onSuccess: (message: string | null) => void;
}) {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const shouldLoginAfterConnectRef = useRef(false);

  const handleWalletLogin = useCallback(async () => {
    if (!auth) {
      onError("Firebase is not configured.");
      return;
    }

    if (!address || !chainId) {
      onError("Connect a wallet first.");
      return;
    }

    onError(null);
    onSuccess(null);
    onSetBusy(true);

    try {
      const message = buildWalletLoginMessage({
        address,
        chainId,
        domain: window.location.host,
        issuedAt: new Date().toISOString(),
        nonce: createWalletLoginNonce(),
        uri: window.location.origin,
      });
      const signature = await signMessageAsync({ message });
      trackEvent("wallet_login_signature_signed", {
        chain_id: chainId,
        wallet_connected: true,
      });
      const response = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      const body = (await response.json()) as WalletLoginResponse;

      if (!response.ok || !body.token) {
        throw new Error(body.error || "Wallet login failed.");
      }

      await signInWithCustomToken(auth, body.token);
      trackEvent("login", { chain_id: chainId, method: "wallet" });
      onClose();
    } catch (walletError) {
      onError(getAuthErrorMessage(walletError, "Wallet login failed."));
    } finally {
      onSetBusy(false);
    }
  }, [
    address,
    auth,
    chainId,
    onClose,
    onError,
    onSetBusy,
    onSuccess,
    signMessageAsync,
  ]);

  useEffect(() => {
    if (
      !shouldLoginAfterConnectRef.current ||
      !isConnected ||
      !address ||
      !chainId ||
      disabled
    ) {
      return;
    }

    shouldLoginAfterConnectRef.current = false;
    void handleWalletLogin();
  }, [
    address,
    chainId,
    disabled,
    handleWalletLogin,
    isConnected,
  ]);

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openChainModal, openConnectModal }) => {
        const connected = mounted && account && chain && isConnected;

        if (!mounted) {
          return <div className="h-11 animate-pulse rounded-md bg-white/10" />;
        }

        if (!connected) {
          return (
            <button
              className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
              disabled={disabled}
              onClick={() => {
                onError(null);
                onSuccess(null);
                shouldLoginAfterConnectRef.current = true;
                trackEvent("wallet_login_connect_start");
                openConnectModal();
              }}
              type="button"
            >
              Login with wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-200 disabled:cursor-wait disabled:opacity-60"
            disabled={disabled}
            onClick={() => {
              trackEvent("wallet_login_switch_network");
              openChainModal();
            }}
            type="button"
            >
              Switch wallet network
            </button>
          );
        }

        return (
          <button
            className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
            disabled={disabled}
            onClick={handleWalletLogin}
            type="button"
          >
            Login with wallet
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return cleanupFirebaseError(error.message);
  }

  return fallback;
}

function cleanupFirebaseError(message: string) {
  return message
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(auth\/[^)]+\)\.?$/i, ".")
    .trim();
}
