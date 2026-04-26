"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

export function ProofDraftCard() {
  const { user } = useAuthUser();
  const db = useMemo(() => getFirebaseDb(), []);
  const [status, setStatus] = useState("Ready for authenticated proof work.");
  const [isBusy, setIsBusy] = useState(false);

  async function handleCreateProofDraft() {
    if (!db || !user) {
      setStatus("Sign in with Google before creating a proof draft.");
      return;
    }

    setIsBusy(true);
    setStatus("Writing proof draft...");

    try {
      await addDoc(collection(db, "audioProofs"), {
        ownerUid: user.uid,
        status: "draft",
        source: "sonosig-web",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStatus("Proof draft written to Firestore.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to write proof draft.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Proof workspace</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Authenticated users can create Firestore-backed proof drafts.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-medium text-cyan-200">
          Firebase
        </span>
      </div>
      <p className="mt-6 text-sm leading-6 text-zinc-300">{status}</p>
      <button
        className="mt-6 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!user || isBusy}
        onClick={handleCreateProofDraft}
        type="button"
      >
        Create proof draft
      </button>
    </div>
  );
}
