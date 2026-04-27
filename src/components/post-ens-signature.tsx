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
import type { ProofPayload } from "@/lib/audio-watermark";

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

export function PostEnsSignature() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const { data: hash, isPending, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const [lastProof] = useState<ProofPayload | null>(() => getStoredProof());
  const [ensName, setEnsName] = useState("");
  const [recordKey, setRecordKey] = useState("com.sonosig.signature");
  const [signature, setSignature] = useState(lastProof?.signature ?? "");
  const [status, setStatus] = useState(
    lastProof
      ? "Loaded the latest local SonoSig proof."
      : "Load a SonoSig proof or paste a signature.",
  );

  const normalizedName = useMemo(() => {
    try {
      return ensName ? normalize(ensName) : "";
    } catch {
      return "";
    }
  }, [ensName]);

  const displayStatus = isSuccess
    ? "ENS text record updated."
    : isConfirming
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

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
        Post
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
        Post a SonoSig signature to ENS.
      </h1>

      <div className="mt-8 grid gap-4">
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

        {lastProof ? (
          <div className="rounded-md border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-300">
            <span className="text-zinc-500">Latest proof wallet</span>
            <span className="ml-3 break-all font-mono">{lastProof.address}</span>
          </div>
        ) : null}

        <button
          className="ml-auto w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending || isConfirming}
          onClick={handlePost}
          type="button"
        >
          {isPending || isConfirming ? "Posting..." : "Post to ENS"}
        </button>

        <p className="text-center text-sm leading-6 text-zinc-400">
          {displayStatus}
        </p>
      </div>
    </section>
  );
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
