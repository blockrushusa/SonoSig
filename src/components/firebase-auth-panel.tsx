"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseConfigured,
} from "@/lib/firebase/client";

export function FirebaseAuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | null>(null);

  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);

  useEffect(() => {
    if (!auth) {
      return;
    }

    return onAuthStateChanged(auth, setUser);
  }, [auth]);

  async function handleEmailSignIn() {
    if (!auth) {
      setError("Firebase is not configured yet.");
      return;
    }

    setError(null);
    setStatus("Signing in");
    await signInWithEmailAndPassword(auth, email, password);
    setStatus("Signed in");
  }

  async function handleEmailSignUp() {
    if (!auth) {
      setError("Firebase is not configured yet.");
      return;
    }

    setError(null);
    setStatus("Creating account");
    await createUserWithEmailAndPassword(auth, email, password);
    setStatus("Account created");
  }

  async function handleAnonymousSignIn() {
    if (!auth) {
      setError("Firebase is not configured yet.");
      return;
    }

    setError(null);
    setStatus("Creating anonymous session");
    await signInAnonymously(auth);
    setStatus("Signed in anonymously");
  }

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    setError(null);
    await signOut(auth);
    setStatus("Signed out");
  }

  async function handleCreateProofDraft() {
    if (!db || !user) {
      setError("Sign in before creating a Firestore proof draft.");
      return;
    }

    setError(null);
    setStatus("Writing proof draft");
    await addDoc(collection(db, "audioProofs"), {
      ownerUid: user.uid,
      status: "draft",
      source: "sonosig-web",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setStatus("Proof draft written to Firestore");
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Firebase</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Auth and Firestore are ready for project credentials.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-medium text-cyan-200">
          {isFirebaseConfigured ? "Configured" : "Needs env"}
        </span>
      </div>

      <div className="mt-6 space-y-3 text-sm text-zinc-300">
        <p>Status: {status}</p>
        <p>User: {user?.email ?? user?.uid ?? "Not signed in"}</p>
        {error ? <p className="text-red-300">{error}</p> : null}
      </div>

      <div className="mt-6 grid gap-3">
        <input
          autoComplete="email"
          className="rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          value={email}
        />
        <input
          autoComplete="current-password"
          className="rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isFirebaseConfigured}
          onClick={handleEmailSignIn}
          type="button"
        >
          Email sign-in
        </button>
        <button
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isFirebaseConfigured}
          onClick={handleEmailSignUp}
          type="button"
        >
          Create account
        </button>
        <button
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isFirebaseConfigured}
          onClick={handleAnonymousSignIn}
          type="button"
        >
          Anonymous sign-in
        </button>
        <button
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!user}
          onClick={handleCreateProofDraft}
          type="button"
        >
          Create proof draft
        </button>
        <button
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!user}
          onClick={handleSignOut}
          type="button"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
