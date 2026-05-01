"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { verifyMessage } from "viem";
import {
  ProofDetailsTabs,
  type AudioProfile,
  type ProofDetailsTab,
} from "@/components/proof-details-tabs";
import { trackEvent } from "@/lib/analytics";
import {
  buildSiweMessage,
  createWatermarkedAudioProofHashes,
  decodeAudioFile,
  readPayloadFromAudio,
  type ProofPayload,
} from "@/lib/audio-watermark";
import {
  getWeb3Transactions,
  type Web3Transaction,
} from "@/lib/web3-transactions";

type AudioHeader = {
  bitDepth?: string;
  byteRate?: number;
  dataSize?: number;
  encoding: string;
  format: string;
};

type VerificationResult =
  | {
      audioHashStatus: "verified" | "unverified";
      audioHashStatusReason?: string;
      profile: AudioProfile;
      status: "valid";
      payload: ProofPayload;
    }
  | {
      profile?: AudioProfile;
      status: "invalid";
      reason: string;
      payload?: ProofPayload;
    };

type ProvenanceStatus = {
  ens: ProvenanceServiceStatus;
  pacstac: ProvenanceServiceStatus;
};

type ProvenanceServiceStatus = {
  claimId?: string;
  detail: string;
  hash?: string;
  label: string;
  state: "failed" | "missing" | "registered" | "submitted";
};

export function VerifyWatermarkStudio() {
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [provenance, setProvenance] = useState<ProvenanceStatus | null>(null);
  const [status, setStatus] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [activeTab, setActiveTab] = useState<ProofDetailsTab>("proof");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("audio/") && !isSupportedAudioName(file.name)) {
      setStatus("Choose an audio file.");
      trackEvent("verify_file_rejected", {
        file_type: file.type || "unknown",
      });
      return;
    }

    void handleVerify(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleVerify(file: File) {
    setSelectedFileName(file.name);
    setVerification(null);
    setProvenance(null);
    setActiveTab("proof");
    setIsVerifying(true);
    setStatus("Reading watermark locally...");
    trackEvent("verify_start", {
      file_type: file.type || "unknown",
      size_bytes: file.size,
    });

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const profile = await createAudioProfile(file, bytes);
      const payload = readPayloadFromAudio(bytes);
      let audioHashStatus: "verified" | "unverified" = "verified";
      let audioHashStatusReason: string | undefined;

      try {
        const audioProofHashes = await createWatermarkedAudioProofHashes(bytes);

        if (!audioProofHashesMatch(audioProofHashes, payload)) {
          setVerification({
            status: "invalid",
            reason: "Watermark found, but the audio fingerprint does not match.",
            payload,
            profile,
          });
          setStatus("Audio fingerprint failed.");
          trackEvent("verify_failed", { reason: "audio_fingerprint_mismatch" });
          return;
        }
      } catch {
        audioHashStatus = "unverified";
        audioHashStatusReason =
          "Exact audio-hash verification is available for PCM WAV and AIFF. This file still contains a signed SonoSig payload.";
      }

      const isValid = await verifyMessage({
        address: payload.wallet,
        message: buildSiweMessage(payload),
        signature: payload.signature,
      });

      if (!isValid) {
        setVerification({
          status: "invalid",
          reason: "Watermark found, but the SIWE signature is invalid.",
          payload,
          profile,
        });
        setStatus("Watermark signature failed.");
        trackEvent("verify_failed", { reason: "signature_invalid" });
        return;
      }

      setVerification({
        audioHashStatus,
        audioHashStatusReason,
        status: "valid",
        payload,
        profile,
      });
      setProvenance(getProofProvenanceStatus(payload));
      setStatus(
        audioHashStatus === "verified"
          ? "Watermark verified."
          : "Watermark signature verified.",
      );
      trackEvent("verify_success", {
        audio_hash_status: audioHashStatus,
        has_song_metadata: Boolean(payload.song),
      });
    } catch (error) {
      setVerification({
        status: "invalid",
        reason:
          error instanceof Error ? error.message : "Unable to verify watermark.",
      });
      setStatus("No valid watermark found.");
      trackEvent("verify_failed", {
        reason: error instanceof Error ? error.message : "no_valid_watermark",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  const hasResult = Boolean(verification);
  const isUploadCompact = Boolean(selectedFileName || isVerifying || hasResult);
  const containerClass = hasResult
    ? "mx-auto w-full max-w-5xl"
    : "mx-auto w-full max-w-3xl";

  return (
    <div className={containerClass}>
      <section className="min-h-[26rem] rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
          Verify Now
        </p>

        <div className="mt-7 grid gap-5">
          <div
            className={
              isDraggingFile
                ? `${getVerifyUploadZoneSizeClass(isUploadCompact)} grid cursor-pointer place-items-center rounded-lg border border-cyan-300 bg-cyan-300/10 text-center transition-all duration-500 ease-out`
                : `${getVerifyUploadZoneSizeClass(isUploadCompact)} grid cursor-pointer place-items-center rounded-lg border border-dashed border-white/15 bg-zinc-950/70 text-center transition-all duration-500 ease-out hover:border-cyan-300/70 hover:bg-cyan-300/[0.06]`
            }
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }

              setIsDraggingFile(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div
              className={
                isUploadCompact
                  ? "grid justify-items-center gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:text-left"
                  : "grid justify-items-center gap-4"
              }
            >
              <div
                className={
                  isUploadCompact
                    ? "grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 transition-all duration-500"
                    : "grid h-14 w-14 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 transition-all duration-500"
                }
              >
                <span className="text-xl font-semibold text-cyan-200">+</span>
              </div>
              <div>
                <p
                  className={
                    isUploadCompact
                      ? "max-w-full truncate text-base font-semibold text-white"
                      : "text-lg font-semibold text-white"
                  }
                >
                  {selectedFileName || "Drop watermarked audio here"}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  {selectedFileName
                    ? "Click to choose a different file"
                    : "Verify a watermarked file from your device"}
                </p>
              </div>
              <span className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950">
                Choose File
              </span>
            </div>
            <input
              ref={fileInputRef}
              aria-label="Upload watermarked audio file"
              accept="audio/wav,audio/aiff,audio/mp4,audio/ogg,.wav,.aif,.aiff,.m4a,.oga,.ogg,.opus"
              className="sr-only"
              disabled={isVerifying}
              onChange={(event) => {
                handleFileSelection(event.target.files?.[0] ?? null);
              }}
              type="file"
            />
          </div>

          <Link
            className={`${getVerifyUploadZoneSizeClass(false)} grid cursor-pointer place-items-center rounded-lg border border-dashed border-white/15 bg-zinc-950/70 text-center transition-all duration-500 ease-out hover:border-cyan-300/70 hover:bg-cyan-300/[0.06]`}
            href="/website-scanner"
          >
            <div className="grid justify-items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 transition-all duration-500">
                <span className="text-xl font-semibold text-cyan-200">+</span>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  Scan a website for audio files that carry embedded SonoSig
                  proofs.
                </p>
                <p className="mt-2 text-sm text-zinc-400">Agentic Scan</p>
              </div>
              <span className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950">
                Scan
              </span>
            </div>
          </Link>

          {status && verification?.status !== "valid" ? (
            <p className="text-center text-sm leading-6 text-zinc-400">
              {status}
            </p>
          ) : null}
        </div>

        {verification ? (
          <div className="mt-8 rounded-lg bg-[#071014] p-5">
            {verification.status === "valid" ? (
              <div className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-left text-cyan-100">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300 text-base font-black text-zinc-950"
                >
                  ✓
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    Verified
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {verification.audioHashStatus === "verified"
                      ? "Audio hash and wallet signature match this file."
                      : "Wallet signature matches this embedded SonoSig proof."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="font-semibold text-red-300">Invalid watermark</p>
            )}
            {verification.status === "invalid" ? (
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {verification.reason}
              </p>
            ) : (
              <>
                {provenance ? (
                  <ProvenancePanel provenance={provenance} />
                ) : null}
                <details
                  className="mt-5 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      trackEvent("verify_proof_info_expand");
                    }
                  }}
                >
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
                    Proof info
                  </summary>
                  <ProofDetailsTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    payload={verification.payload}
                    profile={verification.profile}
                    audioHashStatus={verification.audioHashStatus}
                    audioHashStatusReason={verification.audioHashStatusReason}
                  />
                </details>
              </>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProvenancePanel({ provenance }: { provenance: ProvenanceStatus }) {
  return (
    <section className="mt-5 grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Provenance history
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Registration signals for this proof
          </h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ProvenanceCard
          service="PacStac"
          status={provenance.pacstac}
        />
        <ProvenanceCard service="ENS" status={provenance.ens} />
      </div>
    </section>
  );
}

function ProvenanceCard({
  service,
  status,
}: {
  service: "ENS" | "PacStac";
  status: ProvenanceServiceStatus;
}) {
  const isPositive =
    status.state === "registered" || status.state === "submitted";
  const isFailed = status.state === "failed";
  const tone = isPositive
    ? "border-emerald-300/30 bg-emerald-400/10"
    : isFailed
      ? "border-red-400/30 bg-red-500/10"
      : "border-white/10 bg-zinc-950/50";
  const icon = isPositive ? "✓" : isFailed ? "!" : "-";
  const iconClass = isPositive
    ? "bg-emerald-300 text-emerald-950"
    : isFailed
      ? "bg-red-300 text-red-950"
      : "bg-zinc-800 text-zinc-300";

  return (
    <article className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-black ${iconClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{service}</h3>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
              {status.label}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{status.detail}</p>
          {status.claimId ? (
            <p className="mt-3 break-all font-mono text-xs text-cyan-100">
              {status.claimId}
            </p>
          ) : null}
          {status.hash ? (
            <a
              className="mt-3 inline-flex rounded-md border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
              href={`https://etherscan.io/tx/${status.hash}`}
              rel="noreferrer"
              target="_blank"
            >
              View transaction
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getVerifyUploadZoneSizeClass(isCompact: boolean) {
  return isCompact ? "min-h-24 p-4" : "min-h-44 p-6";
}

function isSupportedAudioName(name: string) {
  return /\.(aif|aiff|m4a|oga|ogg|opus|wav)$/i.test(name);
}

function getProofProvenanceStatus(payload: ProofPayload): ProvenanceStatus {
  const transactions = getWeb3Transactions().filter((transaction) =>
    isProofTransaction(transaction, payload),
  );
  const pacstacRegistration =
    transactions.find(
      (transaction) => transaction.type === "pacstac-registration",
    ) ?? getLegacyPacStacRegistration(payload);
  const ensTransaction = getBestEnsTransaction(
    transactions.filter((transaction) => transaction.type === "ens-text-record"),
  );

  return {
    ens: ensTransaction
      ? toEnsProvenanceStatus(ensTransaction)
      : {
          detail:
            "No ENS text-record update for this proof was found in this browser history.",
          label: "Not found",
          state: "missing",
        },
    pacstac: pacstacRegistration
      ? toPacStacProvenanceStatus(pacstacRegistration)
      : {
          detail:
            "No PacStac registration for this proof was found in this browser history.",
          label: "Not found",
          state: "missing",
        },
  };
}

function isProofTransaction(
  transaction: Web3Transaction,
  payload: ProofPayload,
) {
  return (
    transaction.proofAudioHash === payload.audio_hash
  );
}

function getBestEnsTransaction(transactions: Web3Transaction[]) {
  return (
    transactions.find((transaction) => transaction.status === "confirmed") ??
    transactions.find((transaction) => transaction.status === "submitted") ??
    transactions.find((transaction) => transaction.status === "failed") ??
    null
  );
}

function toPacStacProvenanceStatus(
  transaction: Web3Transaction,
): ProvenanceServiceStatus {
  return {
    claimId: transaction.claimId,
    detail: transaction.idempotent
      ? "This proof was already registered with PacStac and is ready for discovery."
      : "This proof is registered with PacStac and available for discovery.",
    label: "Registered",
    state: "registered",
  };
}

function toEnsProvenanceStatus(
  transaction: Web3Transaction,
): ProvenanceServiceStatus {
  if (transaction.status === "confirmed") {
    return {
      claimId: transaction.claimId,
      detail: transaction.ensName
        ? `The com.sonosig text record was confirmed for ${transaction.ensName}.`
        : "The ENS text-record update was confirmed on Ethereum mainnet.",
      hash: transaction.hash,
      label: "Registered",
      state: "registered",
    };
  }

  if (transaction.status === "submitted") {
    return {
      claimId: transaction.claimId,
      detail:
        "The ENS transaction was submitted and is waiting for confirmation.",
      hash: transaction.hash,
      label: "Submitted",
      state: "submitted",
    };
  }

  return {
    claimId: transaction.claimId,
    detail:
      transaction.error ??
      "An ENS transaction for this proof failed or reverted.",
    hash: transaction.hash,
    label: "Failed",
    state: "failed",
  };
}

function getLegacyPacStacRegistration(payload: ProofPayload) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedRegistration = window.localStorage.getItem(
    "sonosig:last-pacstac-registration",
  );

  if (!storedRegistration) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedRegistration) as {
      proofAudioHash?: string;
      registration?: {
        claimId?: string;
        createdAt?: string;
        idempotent?: boolean;
        namespace?: string;
        status?: string;
        wallet?: string;
      };
    };

    if (parsed.proofAudioHash !== payload.audio_hash || !parsed.registration) {
      return null;
    }

    return {
      claimId: parsed.registration.claimId,
      createdAt: parsed.registration.createdAt ?? new Date().toISOString(),
      id: `pacstac:${parsed.registration.claimId ?? parsed.proofAudioHash}`,
      idempotent: parsed.registration.idempotent,
      namespace: parsed.registration.namespace,
      network: "PacStac",
      proofAudioHash: parsed.proofAudioHash,
      registrationStatus: parsed.registration.status,
      status: "confirmed",
      title: "PacStac claim registration",
      type: "pacstac-registration",
      updatedAt: new Date().toISOString(),
      wallet: parsed.registration.wallet ?? payload.wallet,
    } satisfies Web3Transaction;
  } catch {
    return null;
  }
}

function audioProofHashesMatch(
  audioProofHashes: { audio_fingerprint: string; audio_hash: string },
  payload: ProofPayload,
) {
  const legacyFingerprint = `fp_${audioProofHashes.audio_hash
    .replace(/^sha256:/, "")
    .slice(0, 12)}`;

  return (
    audioProofHashes.audio_hash === payload.audio_hash &&
    (audioProofHashes.audio_fingerprint === payload.audio_fingerprint ||
      legacyFingerprint === payload.audio_fingerprint)
  );
}

async function createAudioProfile(file: File, bytes: Uint8Array) {
  const header = readAudioHeader(bytes);
  const profile: AudioProfile = {
    bitDepth: header.bitDepth,
    dataSize: header.dataSize ? formatBytes(header.dataSize) : undefined,
    encoding: header.encoding,
    fileName: file.name,
    fileSize: formatBytes(file.size),
    format: header.format,
    lastModified: new Date(file.lastModified).toISOString(),
    mimeType: file.type || "Unknown",
  };

  try {
    const audioBuffer = await decodeAudioFile(file);
    const duration = audioBuffer.duration;

    profile.duration = formatDuration(duration);
    profile.bitRate =
      duration > 0 ? `${Math.round((file.size * 8) / duration / 1000)} kbps` : undefined;
    profile.channels = String(audioBuffer.numberOfChannels);
    profile.sampleFrames = audioBuffer.length.toLocaleString();
    profile.sampleRate = `${audioBuffer.sampleRate.toLocaleString()} Hz`;
  } catch {
    if (header.byteRate) {
      profile.bitRate = `${Math.round((header.byteRate * 8) / 1000)} kbps`;
    }
  }

  return profile;
}

function readAudioHeader(bytes: Uint8Array): AudioHeader {
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
    return readWavHeader(bytes);
  }

  if (readAscii(bytes, 0, 4) === "FORM" && readAscii(bytes, 8, 4) === "AIFF") {
    return readAiffHeader(bytes);
  }

  if (readAscii(bytes, 4, 4) === "ftyp") {
    return { encoding: "AAC/MP4", format: "M4A/MP4" };
  }

  if (readAscii(bytes, 0, 4) === "OggS") {
    return { encoding: readOggEncoding(bytes), format: "OGG" };
  }

  return { encoding: "Unknown", format: "Unknown" };
}

function readOggEncoding(bytes: Uint8Array) {
  const header = new TextDecoder("latin1").decode(
    bytes.slice(0, Math.min(bytes.length, 256)),
  );

  if (header.includes("OpusHead")) {
    return "Opus";
  }

  if (header.includes("vorbis")) {
    return "Vorbis";
  }

  return "Ogg";
}

function readWavHeader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let audioFormat = 0;
  let bitDepth = 0;
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkStart, true);
      byteRate = view.getUint32(chunkStart + 8, true);
      bitDepth = view.getUint16(chunkStart + 14, true);
    }

    if (chunkId === "data") {
      dataSize = chunkSize;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  return {
    bitDepth: bitDepth ? `${bitDepth}-bit` : undefined,
    byteRate,
    dataSize,
    encoding: audioFormat === 1 ? "PCM" : `WAV format ${audioFormat}`,
    format: "WAV",
  };
}

function readAiffHeader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let bitDepth = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, false);
    const chunkStart = offset + 8;

    if (chunkId === "COMM") {
      bitDepth = view.getUint16(chunkStart + 6, false);
    }

    if (chunkId === "SSND") {
      dataSize = Math.max(0, chunkSize - 8);
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  return {
    bitDepth: bitDepth ? `${bitDepth}-bit` : undefined,
    dataSize,
    encoding: "PCM",
    format: "AIFF",
  };
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder("latin1").decode(bytes.slice(offset, offset + length));
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.round((value % 1) * 1000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}
