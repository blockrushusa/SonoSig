"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

function getUserLabel(displayName: string | null, email: string | null) {
  return displayName || email || "Signed in";
}

function getInitial(displayName: string | null, email: string | null) {
  return getUserLabel(displayName, email).slice(0, 1).toUpperCase();
}

export function HeaderAuth() {
  const { auth, user, isLoading } = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleGoogleSignIn() {
    if (!auth) {
      setError("Firebase is not configured.");
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    provider.setCustomParameters({ prompt: "select_account" });

    setError(null);
    setIsBusy(true);

    try {
      await signInWithPopup(auth, provider);
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Google sign-in failed.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      await signOut(auth);
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
    return (
      <div className="h-10 w-32 animate-pulse rounded-md bg-white/10" />
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-70"
          disabled={isBusy}
          onClick={handleGoogleSignIn}
          type="button"
        >
          Sign in with Google
        </button>
        {error ? (
          <p className="max-w-56 text-right text-xs leading-5 text-red-300">
            {error}
          </p>
        ) : null}
      </div>
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
