"use client";

import { namehash, normalize } from "viem/ens";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { useMemo, useState } from "react";
import {
  ProofDetailsTabs,
  type ProofDetailsTab,
} from "@/components/proof-details-tabs";
import type { ProofPayload } from "@/lib/audio-watermark";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

const ENS_TEXT_ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "string", name: "key", type: "string" },
      { internalType: "string", name: "value", type: "string" },
    ],
    name: "setText",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type PostTarget = "ens" | "pacstac";

type PacStacRegistration = {
  attestation?: {
    alg?: string;
    hash?: string;
    kid?: string;
    sig?: string;
  };
  audioFingerprint?: string;
  audioHash?: string;
  claimId?: string;
  createdAt?: string;
  idempotent?: boolean;
  namespace?: string;
  status?: string;
  wallet?: string;
};

export function PostEnsSignature() {
  const { address, isConnected } = useAccount();
  const { user } = useAuthUser();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const { data: hash, isPending, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const [lastProof] = useState<ProofPayload | null>(() => getStoredProof());
  const [postTarget, setPostTarget] = useState<PostTarget>("ens");
  const [ensName, setEnsName] = useState("");
  const [recordKey, setRecordKey] = useState("com.sonosig.signature");
  const [signature, setSignature] = useState(lastProof?.signature ?? "");
  const [pacstacRegistration, setPacstacRegistration] =
    useState<PacStacRegistration | null>(null);
  const [isPacstacPosting, setIsPacstacPosting] = useState(false);
  const [status, setStatus] = useState("");

  const normalizedName = useMemo(() => {
    try {
      return ensName ? normalize(ensName) : "";
    } catch {
      return "";
    }
  }, [ensName]);

  const displayStatus = postTarget === "ens" && isSuccess
    ? "ENS text record updated."
    : postTarget === "ens" && isConfirming
      ? "Transaction submitted. Waiting for confirmation..."
      : status;

  async function handlePost() {
    if (!isConnected || !address) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (!normalizedName) {
      setStatus("Enter a valid ENS name.");
      return;
    }

    if (!signature.trim()) {
      setStatus("Add a signature to post.");
      return;
    }

    if (!publicClient) {
      setStatus("ENS lookup is unavailable.");
      return;
    }

    try {
      setStatus("Resolving ENS resolver...");

      if (chainId !== mainnet.id) {
        await switchChainAsync({ chainId: mainnet.id });
      }

      const resolver = await publicClient.getEnsResolver({
        name: normalizedName,
      });

      if (!resolver) {
        setStatus("This ENS name has no resolver configured.");
        return;
      }

      setStatus("Confirm the ENS text record update in your wallet.");
      await writeContractAsync({
        abi: ENS_TEXT_ABI,
        address: resolver,
        args: [namehash(normalizedName), recordKey.trim(), signature.trim()],
        chainId: mainnet.id,
        functionName: "setText",
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to post record.");
    }
  }

  async function handleRegisterPacStac() {
    if (!lastProof) {
      setStatus("Create a signed SonoSig proof first.");
      return;
    }

    if (!user) {
      setStatus("Sign in before registering with PacStac.");
      return;
    }

    setIsPacstacPosting(true);
    setPacstacRegistration(null);
    setStatus("Registering signed claim with PacStac...");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pacstac/sonosig/claims", {
        body: JSON.stringify({ proof: lastProof }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const responseBody = (await response.json()) as
        | PacStacRegistration
        | { error?: string; pacstac?: unknown };

      if (!response.ok) {
        const message =
          "error" in responseBody && responseBody.error
            ? responseBody.error
            : "Unable to register PacStac claim.";

        throw new Error(message);
      }

      setPacstacRegistration(responseBody as PacStacRegistration);
      setStatus(
        (responseBody as PacStacRegistration).idempotent
          ? "PacStac already has this exact claim."
          : "PacStac claim registered.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to register PacStac claim.",
      );
    } finally {
      setIsPacstacPosting(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
        Post
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
        Post a SonoSig claim.
      </h1>

      <div className="mt-8 grid gap-4">
        <ProofPostingSummary
          proof={lastProof}
          signature={postTarget === "ens" ? signature : lastProof?.signature}
          target={postTarget}
        />

        <div
          aria-label="Post target"
          className="flex w-fit items-center gap-1 rounded-md border border-white/10 bg-zinc-950/70 p-1"
          role="group"
        >
          {(["ens", "pacstac"] as const).map((target) => (
            <button
              aria-pressed={postTarget === target}
              className={
                postTarget === target
                  ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
                  : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
              }
              key={target}
              onClick={() => setPostTarget(target)}
              type="button"
            >
              {target === "ens" ? "ENS" : "PacStac"}
            </button>
          ))}
        </div>

        {postTarget === "ens" ? (
          <>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">ENS name</span>
              <input
                className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                onChange={(event) => setEnsName(event.target.value)}
                placeholder="name.eth"
                value={ensName}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">TXT key</span>
              <input
                className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                onChange={(event) => setRecordKey(event.target.value)}
                value={recordKey}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">Signature</span>
              <textarea
                className="min-h-32 rounded-md border border-white/15 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                onChange={(event) => setSignature(event.target.value)}
                value={signature}
              />
            </label>
          </>
        ) : null}

        {pacstacRegistration ? (
          <div className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-zinc-300">
            <div className="grid gap-2 font-mono text-xs">
              {pacstacRegistration.status ? (
                <span>Status: {pacstacRegistration.status}</span>
              ) : null}
              {pacstacRegistration.claimId ? (
                <span className="break-all">
                  Claim ID: {pacstacRegistration.claimId}
                </span>
              ) : null}
              {pacstacRegistration.attestation?.hash ? (
                <span className="break-all">
                  Attestation: {pacstacRegistration.attestation.hash}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {postTarget === "ens" ? (
          <button
            className="ml-auto w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending || isConfirming}
            onClick={handlePost}
            type="button"
          >
            {isPending || isConfirming ? "Posting..." : "Post to ENS"}
          </button>
        ) : (
          <button
            className="ml-auto w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPacstacPosting || !lastProof}
            onClick={handleRegisterPacStac}
            type="button"
          >
            {isPacstacPosting ? "Registering..." : "Register with PacStac"}
          </button>
        )}

        <p className="text-center text-sm leading-6 text-zinc-400">
          {displayStatus}
        </p>
      </div>
    </section>
  );
}

function ProofPostingSummary({
  proof,
  signature,
  target,
}: {
  proof: ProofPayload | null;
  signature?: string;
  target: PostTarget;
}) {
  const [detailsTab, setDetailsTab] = useState<ProofDetailsTab>("proof");
  const songTitle =
    proof?.song?.title?.trim() ||
    proof?.sourceFileName?.trim() ||
    proof?.song?.isrc?.trim() ||
    "Untitled SonoSig claim";
  const songMeta = [proof?.song?.artist, proof?.song?.album]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" / ");
  const signatureValue = signature?.trim() || "No signature";
  const isMissingProof = !proof;

  return (
    <section className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
            Posting to {target === "ens" ? "ENS" : "PacStac"}
          </p>
          <h2 className="mt-3 break-words text-2xl font-semibold text-white">
            {isMissingProof ? "No local proof loaded" : songTitle}
          </h2>
          {songMeta ? (
            <p className="mt-1 break-words text-sm text-zinc-400">{songMeta}</p>
          ) : null}
        </div>
        {proof?.song?.isrc ? (
          <span className="rounded border border-white/10 bg-zinc-950 px-2.5 py-1 font-mono text-xs text-zinc-300">
            {proof.song.isrc}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2">
        <span className="text-sm font-medium text-zinc-300">Signature</span>
        <code className="block overflow-hidden text-ellipsis rounded-md border border-white/10 bg-zinc-950 px-3 py-3 font-mono text-xs text-zinc-300">
          {truncateMiddle(signatureValue, 34, 24)}
        </code>
      </div>

      <details className="mt-4 rounded-md border border-white/10 bg-zinc-950/70 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
          More info
        </summary>
        {proof ? (
          <ProofDetailsTabs
            activeTab={detailsTab}
            onTabChange={setDetailsTab}
            payload={proof}
          />
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            Create a signed SonoSig proof before posting a complete claim.
          </p>
        )}
      </details>
    </section>
  );
}

function truncateMiddle(value: string, startLength: number, endLength: number) {
  if (value.length <= startLength + endLength + 3) {
    return value;
  }

  return `${value.slice(0, startLength)}...${value.slice(-endLength)}`;
}

function getStoredProof() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedProof = localStorage.getItem("sonosig:last-proof");

  if (!storedProof) {
    return null;
  }

  try {
    return JSON.parse(storedProof) as ProofPayload;
  } catch {
    return null;
  }
}
