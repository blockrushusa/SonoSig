"use client";

import { namehash, normalize } from "viem/ens";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { isAddress, type Address, type Hash } from "viem";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ProofDetailsTabs,
  type ProofDetailsTab,
} from "@/components/proof-details-tabs";
import { trackEvent } from "@/lib/analytics";
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

type PostTarget = "ens" | "pacstac";
type EnsPostPhase = "confirming-wallet" | "idle" | "resolving" | "submitted";
type EnsReceiptStatus = "success" | "reverted";

const SONOSIG_ENS_RECORD_KEY = "com.sonosig";

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

type EnsResolverClient = {
  getEnsResolver: (parameters: { name: string }) => Promise<Address | null>;
};

export function PostEnsSignature() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const [hash, setHash] = useState<Hash | undefined>();
  const [isEnsPosting, setIsEnsPosting] = useState(false);
  const [ensPostPhase, setEnsPostPhase] = useState<EnsPostPhase>("idle");
  const [receiptStatus, setReceiptStatus] = useState<EnsReceiptStatus | null>(
    null,
  );
  const [receiptPollError, setReceiptPollError] = useState("");
  const [receiptWaitStartedAt, setReceiptWaitStartedAt] = useState<
    number | null
  >(null);
  const [receiptWaitSeconds, setReceiptWaitSeconds] = useState(0);
  const {
    data: receipt,
    error: receiptError,
    isLoading: isConfirming,
  } = useWaitForTransactionReceipt({
    chainId: mainnet.id,
    hash,
    query: {
      enabled: Boolean(hash),
      refetchInterval: 4_000,
    },
  });
  const [lastProof] = useState<ProofPayload | null>(() => getStoredProof());
  const [postTarget, setPostTarget] = useState<PostTarget>("ens");
  const [ensName, setEnsName] = useState("");
  const [ensOptions, setEnsOptions] = useState<string[]>([]);
  const [isEnsLoading, setIsEnsLoading] = useState(false);
  const [pacstacRegistration, setPacstacRegistration] =
    useState<PacStacRegistration | null>(() =>
      getStoredPacStacRegistration(lastProof),
    );
  const [isPacstacPosting, setIsPacstacPosting] = useState(false);
  const [status, setStatus] = useState("");
  const didEditEnsRef = useRef(false);

  const normalizedName = useMemo(() => {
    try {
      return ensName ? normalize(ensName) : "";
    } catch {
      return "";
    }
  }, [ensName]);

  const activeReceiptStatus = receiptStatus ?? receipt?.status ?? null;
  const isEnsConfirmed = activeReceiptStatus === "success";
  const isEnsReverted = activeReceiptStatus === "reverted";
  const isEnsReceiptFailed = isEnsReverted || Boolean(receiptError);
  const isWaitingForReceipt = Boolean(
    hash && ensPostPhase === "submitted" && !activeReceiptStatus && !receiptError,
  );
  const displayStatus = postTarget === "ens" && isEnsConfirmed
    ? "ENS text record updated on Ethereum mainnet."
    : postTarget === "ens" && isEnsReverted
      ? "The ENS transaction was mined but reverted. The text record was not changed."
      : postTarget === "ens" && receiptError
        ? "SonoSig could not confirm the transaction receipt. Check the explorer link for the final status."
        : postTarget === "ens" && (isConfirming || isWaitingForReceipt)
          ? `Transaction submitted. Watching Ethereum mainnet for the receipt${receiptWaitSeconds ? ` (${receiptWaitSeconds}s)` : ""}...`
          : status;

  const ensRecordValue = pacstacRegistration?.claimId
    ? JSON.stringify({
        v: 1,
        latest: pacstacRegistration.claimId,
      })
    : "";
  const isEnsProgressModalOpen =
    (isEnsPosting || isConfirming || ensPostPhase !== "idle") &&
    !isEnsConfirmed &&
    !isEnsReceiptFailed;

  useEffect(() => {
    didEditEnsRef.current = false;

    let isActive = true;

    if (!address || !publicClient) {
      queueMicrotask(() => {
        if (!isActive) {
          return;
        }

        setEnsOptions([]);
        setEnsName("");
        setIsEnsLoading(false);
      });

      return () => {
        isActive = false;
      };
    }

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setEnsOptions([]);
      setIsEnsLoading(true);
    });

    const ensClient = publicClient;
    const walletAddress = address;

    async function loadEnsOptions() {
      const options: string[] = [];

      try {
        const response = await fetch(`/api/ens/names?address=${walletAddress}`);

        if (response.ok) {
          const body = (await response.json()) as { names?: string[] };

          for (const name of body.names ?? []) {
            addEnsOption(options, name);
          }
        }
      } catch {
        // Indexed ENS ownership lookup is best-effort.
      }

      try {
        const reverseName = await ensClient.getEnsName({
          address: walletAddress,
        });
        addEnsOption(options, reverseName);
      } catch {
        // Reverse ENS lookup is best-effort.
      }

      const proofEns = lastProof?.ens?.trim();

      if (proofEns) {
        try {
          const normalizedProofEns = normalize(proofEns);
          const proofEnsAddress = await ensClient.getEnsAddress({
            name: normalizedProofEns,
          });

          if (
            proofEnsAddress &&
            proofEnsAddress.toLowerCase() === walletAddress.toLowerCase()
          ) {
            addEnsOption(options, normalizedProofEns);
          }
        } catch {
          // Ignore invalid or unresolved proof ENS names.
        }
      }

      if (!isActive) {
        return;
      }

      setEnsOptions(options);

      if (!didEditEnsRef.current) {
        setEnsName(options[0] ?? "");
      }
    }

    loadEnsOptions()
      .catch(() => {
        if (isActive) {
          setEnsOptions([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsEnsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [address, lastProof?.ens, publicClient]);

  async function handlePost() {
    if (!isConnected || !address) {
      logEnsPost("blocked: wallet not connected");
      setStatus("Connect a wallet first.");
      trackEvent("ens_post_blocked", { reason: "wallet_not_connected" });
      return;
    }

    if (!normalizedName) {
      logEnsPost("blocked: invalid ENS name", { ensName });
      setStatus("Enter a valid ENS name.");
      trackEvent("ens_post_blocked", { reason: "invalid_ens_name" });
      return;
    }

    if (!pacstacRegistration?.claimId || !ensRecordValue) {
      logEnsPost("blocked: missing PacStac registration", { normalizedName });
      setStatus("Register this SonoSig claim with PacStac before publishing to ENS.");
      trackEvent("ens_post_blocked", { reason: "missing_pacstac_claim" });
      return;
    }

    if (!walletClient) {
      logEnsPost("blocked: wallet client unavailable", { normalizedName });
      setStatus("Wallet is not ready. Reconnect your wallet and try again.");
      trackEvent("ens_post_blocked", { reason: "wallet_client_unavailable" });
      return;
    }

    try {
      setIsEnsPosting(true);
      setHash(undefined);
      setReceiptStatus(null);
      setReceiptPollError("");
      setReceiptWaitStartedAt(null);
      setReceiptWaitSeconds(0);
      setEnsPostPhase("resolving");
      logEnsPost("start", {
        claimId: pacstacRegistration.claimId,
        ensName: normalizedName,
        recordKey: SONOSIG_ENS_RECORD_KEY,
      });
      trackEvent("ens_post_start", {
        has_claim_id: Boolean(pacstacRegistration.claimId),
      });
      setStatus("Resolving ENS resolver...");

      if (chainId !== mainnet.id) {
        logEnsPost("switching chain", {
          currentChainId: chainId,
          targetChainId: mainnet.id,
        });
        await switchChainAsync({ chainId: mainnet.id });
      }

      const resolver = await getEnsResolverAddress(normalizedName, publicClient);
      logEnsPost("resolver resolved", {
        ensName: normalizedName,
        resolver,
      });

      if (!resolver) {
        logEnsPost("blocked: no resolver", { ensName: normalizedName });
        setEnsPostPhase("idle");
        setStatus("This ENS name has no resolver configured.");
        trackEvent("ens_post_blocked", { reason: "no_resolver" });
        return;
      }

      setEnsPostPhase("confirming-wallet");
      logEnsPost("wallet confirmation requested", {
        ensName: normalizedName,
        resolver,
      });
      setStatus("Confirm the ENS text record update in your wallet.");
      const transactionHash = await walletClient.writeContract({
        abi: ENS_TEXT_ABI,
        address: resolver,
        args: [
          namehash(normalizedName),
          SONOSIG_ENS_RECORD_KEY,
          ensRecordValue,
        ],
        chain: mainnet,
        functionName: "setText",
      });
      logEnsPost("transaction submitted", {
        ensName: normalizedName,
        transactionHash,
      });
      trackEvent("ens_post_submitted", {
        record_key: SONOSIG_ENS_RECORD_KEY,
      });
      setEnsPostPhase("submitted");
      setReceiptWaitStartedAt(Date.now());
      setHash(transactionHash);
    } catch (error) {
      const message = formatEnsPostError(error);
      logEnsPost("error", {
        error,
        message,
      });
      setEnsPostPhase("idle");
      setStatus(message);
      trackEvent("ens_post_failed", { reason: message });
    } finally {
      setIsEnsPosting(false);
    }
  }

  useEffect(() => {
    if (!hash) {
      return;
    }

    logEnsPost("waiting for confirmation", { transactionHash: hash });
  }, [hash]);

  useEffect(() => {
    if (!hash || !publicClient || receiptStatus) {
      return;
    }

    const receiptClient = publicClient;
    const receiptHash = hash;
    let isActive = true;

    async function pollReceipt() {
      try {
        const polledReceipt = await receiptClient.getTransactionReceipt({
          hash: receiptHash,
        });

        if (!isActive) {
          return;
        }

        setReceiptStatus(polledReceipt.status);
        setReceiptPollError("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message = getErrorMessage(error).toLowerCase();

        if (
          message.includes("not found") ||
          message.includes("could not find") ||
          message.includes("transaction receipt")
        ) {
          return;
        }

        setReceiptPollError(
          "The app RPC has not returned a receipt yet. Check the explorer link for the final transaction status.",
        );
      }
    }

    void pollReceipt();
    const interval = window.setInterval(() => {
      void pollReceipt();
    }, 4_000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [hash, publicClient, receiptStatus]);

  useEffect(() => {
    if (!receiptWaitStartedAt || !isWaitingForReceipt) {
      return;
    }

    const updateElapsedTime = () => {
      setReceiptWaitSeconds(
        Math.max(0, Math.floor((Date.now() - receiptWaitStartedAt) / 1_000)),
      );
    };

    updateElapsedTime();
    const interval = window.setInterval(updateElapsedTime, 1_000);

    return () => window.clearInterval(interval);
  }, [isWaitingForReceipt, receiptWaitStartedAt]);

  useEffect(() => {
    if (!isEnsConfirmed || !hash) {
      return;
    }

    logEnsPost("confirmed", { transactionHash: hash });
    queueMicrotask(() => {
      setEnsPostPhase("idle");
      setStatus("ENS text record updated on Ethereum mainnet.");
    });
    trackEvent("ens_post_confirmed");
  }, [hash, isEnsConfirmed]);

  useEffect(() => {
    if (!hash || !isEnsReceiptFailed) {
      return;
    }

    if (isEnsReverted) {
      logEnsPost("reverted", { transactionHash: hash });
      queueMicrotask(() => {
        setEnsPostPhase("idle");
        setStatus(
          "The ENS transaction was mined but reverted. The text record was not changed.",
        );
      });
      trackEvent("ens_post_failed", { reason: "transaction_reverted" });
      return;
    }

    const message =
      receiptPollError ||
      "SonoSig could not confirm the transaction receipt. Check the explorer link for the final status.";
    logEnsPost("receipt watch error", { transactionHash: hash, message });
    queueMicrotask(() => {
      setEnsPostPhase("idle");
      setStatus(message);
    });
    trackEvent("ens_post_failed", { reason: message });
  }, [hash, isEnsReceiptFailed, isEnsReverted, receiptPollError]);

  async function handleRegisterPacStac() {
    if (!lastProof) {
      setStatus("Create a signed SonoSig proof first.");
      trackEvent("pacstac_register_blocked", { reason: "missing_proof" });
      return;
    }

    setIsPacstacPosting(true);
    setPacstacRegistration(null);
    setStatus("Registering signed claim with PacStac...");
    trackEvent("pacstac_register_start", {
      has_song_metadata: Boolean(lastProof.song),
    });

    try {
      const response = await fetch("/api/pacstac/sonosig/claims", {
        body: JSON.stringify({ proof: lastProof }),
        headers: {
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
      const registration = responseBody as PacStacRegistration;
      storePacStacRegistration(lastProof, registration);
      trackEvent("pacstac_register_success", {
        idempotent: Boolean(registration.idempotent),
        status: registration.status,
      });
      const claimLabel = registration.claimId
        ? ` Claim ID: ${registration.claimId}`
        : "";

      setStatus(
        registration.idempotent
          ? `This SonoSig claim was already registered with PacStac.${claimLabel} Visit PacStac.com to add your claim to your account.`
          : `This SonoSig claim is now registered and indexed by PacStac.${claimLabel} Visit PacStac.com to add your claim to your account.`,
      );
    } catch (error) {
      trackEvent("pacstac_register_failed", {
        reason:
          error instanceof Error
            ? error.message
            : "Unable to register PacStac claim.",
      });
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
      <EnsProgressModal
        elapsedSeconds={receiptWaitSeconds}
        hash={hash}
        isOpen={isEnsProgressModalOpen}
        phase={ensPostPhase}
        receiptPollError={receiptPollError}
      />
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
        Post
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
        Post a SonoSig claim.
      </h1>

      <div className="mt-8 grid gap-4">
        <ProofPostingSummary
          proof={lastProof}
          signature={lastProof?.signature}
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
              onClick={() => {
                trackEvent("post_target_select", { target });
                setPostTarget(target);
              }}
              type="button"
            >
              {target === "ens" ? "ENS" : "PacStac"}
            </button>
          ))}
        </div>

        {postTarget === "ens" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {ensOptions.length ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-zinc-300">ENS</span>
                  <select
                    className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                    onChange={(event) => {
                      didEditEnsRef.current = true;
                      setEnsName(
                        event.target.value === "__custom__"
                          ? ""
                          : event.target.value,
                      );
                    }}
                    value={
                      ensOptions.includes(ensName) ? ensName : "__custom__"
                    }
                  >
                    {ensOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value="__custom__">Custom ENS</option>
                  </select>
                </label>
              ) : null}

              <label
                className={
                  ensOptions.length ? "grid gap-2" : "grid gap-2 md:col-span-2"
                }
              >
                <span className="text-sm font-medium text-zinc-300">
                  {ensOptions.length ? "Alternate ENS" : "ENS name"}
                </span>
                <input
                  className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                  onChange={(event) => {
                    didEditEnsRef.current = true;
                    setEnsName(event.target.value);
                  }}
                  placeholder={isEnsLoading ? "Resolving ENS..." : "name.eth"}
                  value={ensOptions.includes(ensName) ? "" : ensName}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">TXT key</span>
              <input
                className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-200 outline-none"
                readOnly
                value={SONOSIG_ENS_RECORD_KEY}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">
                TXT value
              </span>
              <textarea
                className="min-h-28 rounded-md border border-white/15 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-200 outline-none"
                placeholder='{"v":1,"latest":"sonosig:sha256:<claim_hash>"}'
                readOnly
                value={ensRecordValue}
              />
              <span className="text-xs leading-5 text-zinc-500">
                {pacstacRegistration?.claimId
                  ? "SonoSig writes one ENS text record that points readers to the latest verified PacStac claim instead of storing the full signature on ENS."
                  : "Register with PacStac first; then SonoSig will generate this single ENS text-record value."}
              </span>
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
            disabled={
              isEnsPosting ||
              isConfirming ||
              isWaitingForReceipt ||
              !pacstacRegistration?.claimId
            }
            onClick={handlePost}
            type="button"
          >
            {isEnsPosting || isConfirming || isWaitingForReceipt
              ? "Posting..."
              : "Post to ENS"}
          </button>
        ) : pacstacRegistration ? null : (
          <button
            className="ml-auto w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPacstacPosting || !lastProof}
            onClick={handleRegisterPacStac}
            type="button"
          >
            {isPacstacPosting ? "Registering..." : "Register with PacStac"}
          </button>
        )}

        <p className="max-w-full break-words text-center text-sm leading-6 text-zinc-400">
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

function EnsProgressModal({
  elapsedSeconds,
  hash,
  isOpen,
  phase,
  receiptPollError,
}: {
  elapsedSeconds: number;
  hash?: Hash;
  isOpen: boolean;
  phase: EnsPostPhase;
  receiptPollError: string;
}) {
  if (!isOpen) {
    return null;
  }

  const explorerUrl = hash ? getEtherscanTransactionUrl(hash) : "";
  const title =
    phase === "submitted"
      ? "Transaction submitted. Waiting for confirmation..."
      : phase === "confirming-wallet"
        ? "Confirm the ENS update in your wallet..."
        : "Preparing ENS update...";
  const detail =
    phase === "submitted"
      ? "SonoSig is polling Ethereum mainnet for the transaction receipt through the app RPC. MetaMask or the explorer may show success first; this screen closes when SonoSig receives the same receipt."
      : phase === "confirming-wallet"
        ? "Your wallet should open a transaction request for the ENS text record."
        : "SonoSig is resolving the ENS name and preparing the text-record call.";
  const stepLabel =
    phase === "submitted"
      ? "Step 3 of 3"
      : phase === "confirming-wallet"
        ? "Step 2 of 3"
        : "Step 1 of 3";

  return (
    <div
      aria-labelledby="ens-progress-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-cyan-300/20 bg-[#10161c] p-6 shadow-2xl shadow-cyan-950/40">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="grid h-14 w-14 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10"
          >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-200 border-t-transparent" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              ENS update
            </p>
            <h2
              className="mt-2 text-xl font-semibold leading-snug text-white"
              id="ens-progress-title"
            >
              {title}
            </h2>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[ens-progress_1.4s_ease-in-out_infinite] rounded-full bg-cyan-300" />
        </div>

        <div className="mt-5 grid gap-3 text-sm leading-6 text-zinc-300">
          <p className="font-medium text-cyan-200">{stepLabel}</p>
          <p>{detail}</p>
          {phase === "submitted" ? (
            <p className="text-zinc-400">
              Watching mainnet receipt
              {elapsedSeconds ? ` for ${elapsedSeconds}s` : ""}. No new wallet
              action is needed unless the transaction fails or reverts.
            </p>
          ) : null}
          {receiptPollError ? (
            <p className="text-amber-100">{receiptPollError}</p>
          ) : null}
        </div>
        {hash ? (
          <div className="mt-4 grid gap-3">
            <code className="block break-all rounded-md border border-white/10 bg-black/35 px-3 py-3 font-mono text-xs text-zinc-300">
              {hash}
            </code>
            <a
              className="w-fit rounded-md border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-200 hover:text-white"
              href={explorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              View on Etherscan
            </a>
          </div>
        ) : null}
      </div>
      <style jsx>{`
        @keyframes ens-progress {
          0% {
            transform: translateX(-110%);
          }
          50% {
            transform: translateX(70%);
          }
          100% {
            transform: translateX(210%);
          }
        }
      `}</style>
    </div>
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

function getStoredPacStacRegistration(proof: ProofPayload | null) {
  if (typeof window === "undefined" || !proof) {
    return null;
  }

  const storedRegistration = localStorage.getItem(
    "sonosig:last-pacstac-registration",
  );

  if (!storedRegistration) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedRegistration) as {
      proofAudioHash?: string;
      registration?: PacStacRegistration;
    };

    if (parsed.proofAudioHash !== proof.audio_hash) {
      return null;
    }

    return parsed.registration ?? null;
  } catch {
    return null;
  }
}

function storePacStacRegistration(
  proof: ProofPayload | null,
  registration: PacStacRegistration,
) {
  if (typeof window === "undefined" || !proof) {
    return;
  }

  localStorage.setItem(
    "sonosig:last-pacstac-registration",
    JSON.stringify({
      proofAudioHash: proof.audio_hash,
      registration,
    }),
  );
}

function addEnsOption(options: string[], value: string | null | undefined) {
  if (!value) {
    return;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return;
  }

  if (
    options.some(
      (option) => option.toLowerCase() === normalizedValue.toLowerCase(),
    )
  ) {
    return;
  }

  options.push(normalizedValue);
}

async function getEnsResolverAddress(
  name: string,
  publicClient: EnsResolverClient | undefined,
) {
  try {
    const response = await fetch(
      `/api/ens/resolver?name=${encodeURIComponent(name)}`,
    );

    if (response.ok) {
      const body = (await response.json()) as { resolver?: string };

      if (body.resolver && isAddress(body.resolver)) {
        return body.resolver;
      }
    }

    if (response.status === 404) {
      return null;
    }
  } catch {
    // Fall back to browser RPC below.
  }

  try {
    return (await publicClient?.getEnsResolver({ name })) ?? null;
  } catch {
    throw new Error(
      "The ENS network request failed before the wallet could open. Try again, or update the com.sonosig text record manually in ENS Manager.",
    );
  }
}

function formatEnsPostError(error: unknown) {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("user rejected") ||
    normalizedMessage.includes("user denied") ||
    normalizedMessage.includes("rejected the request")
  ) {
    return "ENS update cancelled. No record was changed.";
  }

  if (
    normalizedMessage.includes("insufficient funds") ||
    normalizedMessage.includes("exceeds the balance")
  ) {
    return "The wallet does not have enough ETH on mainnet to update this ENS record.";
  }

  if (
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("not authorised") ||
    normalizedMessage.includes("not authorized") ||
    normalizedMessage.includes("reverted") ||
    normalizedMessage.includes("execution reverted")
  ) {
    return "The ENS resolver rejected the update. Connect the wallet that owns or manages this ENS name, or update the record manually in ENS Manager.";
  }

  if (
    normalizedMessage.includes("wrong network") ||
    normalizedMessage.includes("chain mismatch") ||
    normalizedMessage.includes("switch chain")
  ) {
    return "Switch to Ethereum mainnet to update this ENS record.";
  }

  const cleanedMessage = message
    .split("Raw Call Arguments")[0]
    .split("Request Arguments")[0]
    .split("Contract Call")[0]
    .trim();

  return cleanedMessage
    ? truncateEnd(cleanedMessage, 160)
    : "Unable to update the ENS text record.";
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error) {
    const maybeError = error as {
      details?: unknown;
      message?: unknown;
      shortMessage?: unknown;
    };

    if (typeof maybeError.shortMessage === "string") {
      return maybeError.shortMessage;
    }

    if (typeof maybeError.details === "string") {
      return maybeError.details;
    }

    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }
  }

  return "Unable to update the ENS text record.";
}

function truncateEnd(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function getEtherscanTransactionUrl(hash: Hash) {
  return `https://etherscan.io/tx/${hash}`;
}

function logEnsPost(message: string, context?: Record<string, unknown>) {
  if (context) {
    console.info(`[SonoSig ENS] ${message}`, context);
    return;
  }

  console.info(`[SonoSig ENS] ${message}`);
}
