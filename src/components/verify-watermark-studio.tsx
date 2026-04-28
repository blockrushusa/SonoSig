"use client";

import { useState } from "react";
import { verifyMessage } from "viem";
import {
  buildSiweMessage,
  createWatermarkedAudioProofHashes,
  decodeAudioFile,
  getChainName,
  readPayloadFromAudio,
  type ProofPayload,
} from "@/lib/audio-watermark";

type AudioProfile = {
  bitDepth?: string;
  bitRate?: string;
  channels?: string;
  dataSize?: string;
  duration?: string;
  encoding?: string;
  fileName: string;
  fileSize: string;
  format: string;
  lastModified: string;
  mimeType: string;
  sampleFrames?: string;
  sampleRate?: string;
};

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

type VerifyTab = "proof" | "metadata" | "profile";

const SONG_METADATA_LABELS: Array<{
  key: keyof NonNullable<ProofPayload["song"]>;
  label: string;
}> = [
  { key: "title", label: "Song" },
  { key: "artist", label: "Artist" },
  { key: "albumArtist", label: "Album Artist" },
  { key: "album", label: "Album" },
  { key: "composer", label: "Composer" },
  { key: "genre", label: "Genre" },
  { key: "releaseDate", label: "Release Date" },
  { key: "year", label: "Year" },
  { key: "trackNumber", label: "Track" },
  { key: "discNumber", label: "Disc" },
  { key: "isrc", label: "ISRC" },
  { key: "bpm", label: "BPM" },
  { key: "key", label: "Key" },
  { key: "publisher", label: "Publisher" },
  { key: "copyright", label: "Copyright" },
  { key: "notes", label: "Notes" },
];

export function VerifyWatermarkStudio() {
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<VerifyTab>("proof");

  async function handleVerify(file: File) {
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

        if (
          audioProofHashes.audio_hash !== payload.audio_hash ||
          audioProofHashes.audio_fingerprint !== payload.audio_fingerprint
        ) {
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

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
        Verify
      </p>

      <div className="mt-8 grid gap-4">
        <label>
          <input
            aria-label="Upload watermarked audio file"
            accept="audio/wav,audio/aiff,audio/mp4,audio/ogg,.wav,.aif,.aiff,.m4a,.oga,.ogg,.opus"
            className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
            disabled={isVerifying}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleVerify(file);
              }
            }}
            type="file"
          />
        </label>

        <p className="text-sm leading-6 text-zinc-400">{status}</p>
      </div>

      {verification ? (
        <div className="mt-8 rounded-lg border border-white/10 bg-zinc-950 p-5">
          <p
            className={
              verification.status === "valid"
                ? "font-semibold text-cyan-200"
                : "font-semibold text-red-300"
            }
          >
            {verification.status === "valid"
              ? verification.audioHashStatus === "verified"
                ? "Valid watermark"
                : "Valid signature"
              : "Invalid watermark"}
          </p>
          {verification.status === "invalid" ? (
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {verification.reason}
            </p>
          ) : (
            <VerificationDetails
              activeTab={activeTab}
              onTabChange={setActiveTab}
              payload={verification.payload}
              profile={verification.profile}
              audioHashStatus={verification.audioHashStatus}
              audioHashStatusReason={verification.audioHashStatusReason}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

function VerificationDetails({
  activeTab,
  audioHashStatus,
  audioHashStatusReason,
  onTabChange,
  payload,
  profile,
}: {
  activeTab: VerifyTab;
  audioHashStatus: "verified" | "unverified";
  audioHashStatusReason?: string;
  onTabChange: (tab: VerifyTab) => void;
  payload: ProofPayload;
  profile: AudioProfile;
}) {
  const songEntries = getSongMetadataEntries(payload);
  const hasMetadata = songEntries.length > 0;
  const profileEntries = getProfileEntries(profile);

  return (
    <div className="mt-4">
      <div className="inline-flex rounded-md border border-white/10 bg-white/[0.04] p-1">
        <button
          aria-pressed={activeTab === "proof"}
          className={
            activeTab === "proof"
              ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
              : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
          }
          onClick={() => onTabChange("proof")}
          type="button"
        >
          Proof
        </button>
        <button
          aria-pressed={activeTab === "metadata"}
          className={
            activeTab === "metadata"
              ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
              : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          }
          disabled={!hasMetadata}
          onClick={() => onTabChange("metadata")}
          type="button"
        >
          Metadata
        </button>
        <button
          aria-pressed={activeTab === "profile"}
          className={
            activeTab === "profile"
              ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
              : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
          }
          onClick={() => onTabChange("profile")}
          type="button"
        >
          Profile
        </button>
      </div>

      {activeTab === "metadata" && hasMetadata ? (
        <dl className="mt-4 grid gap-3 text-sm text-zinc-300">
          {songEntries.map((entry) => (
            <div key={entry.label}>
              <dt className="text-zinc-500">{entry.label}</dt>
              <dd className="break-all">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : activeTab === "profile" ? (
        <dl className="mt-4 grid gap-3 text-sm text-zinc-300">
          {profileEntries.map((entry) => (
            <div key={entry.label}>
              <dt className="text-zinc-500">{entry.label}</dt>
              <dd className="break-all">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm text-zinc-300">
          <div>
            <dt className="text-zinc-500">Wallet</dt>
            <dd className="break-all">{payload.wallet}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Issued</dt>
            <dd>{payload.issued_at}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Chain</dt>
            <dd>{payload.chain ?? getChainName(payload.chain_id)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Chain ID</dt>
            <dd>{payload.chain_id}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">ENS</dt>
            <dd>{payload.ens || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Manifest</dt>
            <dd className="break-all">{payload.manifest || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Verified by</dt>
            <dd>{payload.verifiedBy ?? "SonoSig.com"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Audio hash verification</dt>
            <dd>
              {audioHashStatus === "verified"
                ? "Verified"
                : audioHashStatusReason}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Audio fingerprint</dt>
            <dd className="break-all font-mono">{payload.audio_fingerprint}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Audio hash</dt>
            <dd className="break-all font-mono">{payload.audio_hash}</dd>
          </div>
        </dl>
      )}
    </div>
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

function getProfileEntries(profile: AudioProfile) {
  return [
    { label: "File Name", value: profile.fileName },
    { label: "Format", value: profile.format },
    { label: "Encoding", value: profile.encoding },
    { label: "Duration", value: profile.duration },
    { label: "Bitrate", value: profile.bitRate },
    { label: "Sample Rate", value: profile.sampleRate },
    { label: "Channels", value: profile.channels },
    { label: "Bit Depth", value: profile.bitDepth },
    { label: "Sample Frames", value: profile.sampleFrames },
    { label: "Audio Data Size", value: profile.dataSize },
    { label: "File Size", value: profile.fileSize },
    { label: "MIME Type", value: profile.mimeType },
    { label: "Last Modified", value: profile.lastModified },
  ].filter((entry): entry is { label: string; value: string } =>
    Boolean(entry.value),
  );
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

function getSongMetadataEntries(payload: ProofPayload) {
  const song = payload.song;

  if (!song) {
    return [];
  }

  return SONG_METADATA_LABELS.map(({ key, label }) => ({
    label,
    value: song[key],
  })).filter((entry): entry is { label: string; value: string } =>
    Boolean(entry.value),
  );
}
