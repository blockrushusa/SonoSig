"use client";

import { getChainName, type ProofPayload } from "@/lib/audio-watermark";

export type AudioProfile = {
  bitDepth?: string;
  bitRate?: string;
  channels?: string;
  dataSize?: string;
  duration?: string;
  encoding?: string;
  fileName?: string;
  fileSize?: string;
  format?: string;
  lastModified?: string;
  mimeType?: string;
  sampleFrames?: string;
  sampleRate?: string;
};

export type ProofDetailsTab = "proof" | "metadata" | "profile";

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

type DetailEntry = {
  label: string;
  value?: string;
  mono?: boolean;
};

export function ProofDetailsTabs({
  activeTab,
  audioHashStatus,
  audioHashStatusReason,
  onTabChange,
  payload,
  profile,
}: {
  activeTab: ProofDetailsTab;
  audioHashStatus?: "verified" | "unverified";
  audioHashStatusReason?: string;
  onTabChange: (tab: ProofDetailsTab) => void;
  payload: ProofPayload;
  profile?: AudioProfile;
}) {
  const proofEntries = getProofEntries(
    payload,
    audioHashStatus,
    audioHashStatusReason,
  );
  const songEntries = getSongMetadataEntries(payload);
  const profileEntries = getProfileEntries(payload, profile);
  const hasMetadata = songEntries.length > 0;
  const hasProfile = profileEntries.length > 0;

  return (
    <div className="mt-4">
      <div className="inline-flex rounded-md border border-white/10 bg-white/[0.04] p-1">
        <TabButton
          active={activeTab === "proof"}
          label="Proof"
          onClick={() => onTabChange("proof")}
        />
        <TabButton
          active={activeTab === "metadata"}
          disabled={!hasMetadata}
          label="Metadata"
          onClick={() => onTabChange("metadata")}
        />
        <TabButton
          active={activeTab === "profile"}
          disabled={!hasProfile}
          label="Profile"
          onClick={() => onTabChange("profile")}
        />
      </div>

      {activeTab === "metadata" && hasMetadata ? (
        <DetailList entries={songEntries} />
      ) : activeTab === "profile" && hasProfile ? (
        <DetailList entries={profileEntries} />
      ) : (
        <DetailList entries={proofEntries} />
      )}
    </div>
  );
}

function TabButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={
        active
          ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
          : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      }
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function DetailList({ entries }: { entries: DetailEntry[] }) {
  return (
    <dl className="mt-4 grid gap-3 text-sm text-zinc-300">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt className="text-zinc-500">{entry.label}</dt>
          <dd className={entry.mono ? "break-all font-mono" : "break-all"}>
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function getProofEntries(
  payload: ProofPayload,
  audioHashStatus?: "verified" | "unverified",
  audioHashStatusReason?: string,
) {
  const entries: DetailEntry[] = [
    { label: "Protocol", value: payload.protocol },
    { label: "Signature Type", value: payload.signature_type },
    { label: "Wallet", value: payload.wallet, mono: true },
    { label: "Address", value: payload.address, mono: true },
    { label: "Issued", value: payload.issued_at },
    { label: "Nonce", value: payload.nonce, mono: true },
    { label: "Chain", value: payload.chain ?? getChainName(payload.chain_id) },
    { label: "Chain ID", value: payload.chain_id.toString() },
    { label: "Domain", value: payload.domain },
    { label: "URI", value: payload.uri },
    { label: "ENS", value: payload.ens || "Not provided" },
    { label: "Manifest", value: payload.manifest || "Not provided" },
    { label: "Verified by", value: payload.verifiedBy ?? "SonoSig.com" },
    { label: "Source File", value: payload.sourceFileName },
    {
      label: "Audio Hash Verification",
      value:
        audioHashStatus === "verified"
          ? "Verified"
          : audioHashStatus === "unverified"
            ? audioHashStatusReason
            : undefined,
    },
    {
      label: "Audio Fingerprint",
      value: payload.audio_fingerprint,
      mono: true,
    },
    { label: "Audio Hash", value: payload.audio_hash, mono: true },
    { label: "Signature", value: payload.signature, mono: true },
  ];

  return entries.filter((entry): entry is DetailEntry & { value: string } =>
    Boolean(entry.value),
  );
}

function getProfileEntries(payload: ProofPayload, profile?: AudioProfile) {
  return [
    { label: "File Name", value: profile?.fileName ?? payload.sourceFileName },
    { label: "Format", value: profile?.format },
    { label: "Encoding", value: profile?.encoding },
    { label: "Duration", value: profile?.duration },
    { label: "Bitrate", value: profile?.bitRate },
    { label: "Sample Rate", value: profile?.sampleRate },
    { label: "Channels", value: profile?.channels },
    { label: "Bit Depth", value: profile?.bitDepth },
    { label: "Sample Frames", value: profile?.sampleFrames },
    { label: "Audio Data Size", value: profile?.dataSize },
    { label: "File Size", value: profile?.fileSize },
    { label: "MIME Type", value: profile?.mimeType },
    { label: "Last Modified", value: profile?.lastModified },
  ].filter((entry): entry is { label: string; value: string } =>
    Boolean(entry.value),
  );
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
