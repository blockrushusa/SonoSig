"use client";

import { useRef, useState, type DragEvent } from "react";
import { verifyMessage } from "viem";
import {
  ProofDetailsTabs,
  type AudioProfile,
  type ProofDetailsTab,
} from "@/components/proof-details-tabs";
import {
  buildSiweMessage,
  createWatermarkedAudioProofHashes,
  decodeAudioFile,
  readPayloadFromAudio,
  type ProofPayload,
} from "@/lib/audio-watermark";

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

export function VerifyWatermarkStudio() {
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
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
    setActiveTab("proof");
    setIsVerifying(true);
    setStatus("Reading watermark locally...");

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
        return;
      }

      setVerification({
        audioHashStatus,
        audioHashStatusReason,
        status: "valid",
        payload,
        profile,
      });
      setStatus(
        audioHashStatus === "verified"
          ? "Watermark verified."
          : "Watermark signature verified.",
      );
    } catch (error) {
      setVerification({
        status: "invalid",
        reason:
          error instanceof Error ? error.message : "Unable to verify watermark.",
      });
      setStatus("No valid watermark found.");
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
          Verify
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
                    : "Click to upload or drag a file into this box"}
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
              <details className="mt-5 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3">
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
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function getVerifyUploadZoneSizeClass(isCompact: boolean) {
  return isCompact ? "min-h-24 p-4" : "min-h-44 p-6";
}

function isSupportedAudioName(name: string) {
  return /\.(aif|aiff|m4a|oga|ogg|opus|wav)$/i.test(name);
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
