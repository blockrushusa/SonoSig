"use client";

import { useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  OUTPUT_FORMATS,
  buildSiweMessage,
  createAudioFingerprint,
  createOutputName,
  createSiweFields,
  decodeAudioFile,
  encodePayload,
  encodeWatermarkedPcmWithProgress,
  inferOutputFormat,
  writeAudioFile,
  type OutputFormat,
  type ProofPayload,
} from "@/lib/audio-watermark";

type EncodedAudio = {
  url: string;
  fileName: string;
  format: OutputFormat;
};

type SongMetadata = NonNullable<ProofPayload["song"]>;

export function CreateWatermarkStudio() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("wav");
  const [encodedAudio, setEncodedAudio] = useState<EncodedAudio | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isEncoding, setIsEncoding] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embeddingWaveform, setEmbeddingWaveform] = useState<number[]>([]);
  const [embeddingAddress, setEmbeddingAddress] = useState("");
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [embeddingSignature, setEmbeddingSignature] = useState("");
  const [songMetadata, setSongMetadata] = useState<SongMetadata>({});
  const outputUrlRef = useRef<string | null>(null);

  const canEncode = Boolean(isConnected && address && chainId && sourceFile);

  async function handleEncode() {
    if (!sourceFile || !address || !chainId) {
      setStatus("Connect a wallet and select an audio file first.");
      return;
    }

    setIsEncoding(true);
    setStatus("Decoding audio locally...");

    try {
      const audioBuffer = await decodeAudioFile(sourceFile);
      setEmbeddingWaveform(createWaveformPeaks(audioBuffer));
      setStatus("Fingerprinting audio locally...");
      const audioFingerprint = await createAudioFingerprint(audioBuffer);
      const song = cleanSongMetadata(songMetadata);
      const siweFields = {
        ...createSiweFields(address, chainId),
        audioFingerprint,
        ...(song ? { song } : {}),
      };
      setStatus("Preparing SIWE message...");
      const message = buildSiweMessage(siweFields);
      const signature = await signMessageAsync({ message });
      setEmbeddingAddress(address);
      setEmbeddingSignature(signature);
      const payload = {
        v: 1,
        ...siweFields,
        signature,
      } as const;
      localStorage.setItem("sonosig:last-proof", JSON.stringify(payload));

      const payloadBytes = encodePayload(payload);
      const requiredSamples = payloadBytes.length * 8;
      const availableSamples = audioBuffer.length * audioBuffer.numberOfChannels;

      if (requiredSamples > availableSamples) {
        throw new Error(
          "The proof payload is too large for this audio file. Use a longer track.",
        );
      }

      setStatus(
        "Embedding proof payload via browser... Client side only.... No audio is uploaded.",
      );
      setIsEmbedding(true);
      setEmbeddingProgress(0);
      await nextFrame();
      const watermarked = await encodeWatermarkedPcmWithProgress(
        audioBuffer,
        payloadBytes,
        (progress) => setEmbeddingProgress(progress * 0.35),
      );
      setEmbeddingProgress(0.35);
      const blob = await writeAudioFile(
        watermarked,
        outputFormat,
        payloadBytes,
        (progress) => setEmbeddingProgress(0.35 + progress * 0.65),
      );
      setEmbeddingProgress(1);
      await nextFrame();
      const url = URL.createObjectURL(blob);

      if (outputUrlRef.current) {
        URL.revokeObjectURL(outputUrlRef.current);
      }

      outputUrlRef.current = url;
      setEncodedAudio({
        url,
        fileName: createOutputName(sourceFile.name, outputFormat),
        format: outputFormat,
      });
      setStatus("Watermarked audio is ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Encoding failed.");
    } finally {
      setIsEmbedding(false);
      setIsEncoding(false);
    }
  }

  return (
    <div>
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Create
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-controls="create-options"
              aria-expanded={isOptionsOpen}
              aria-label="Settings"
              className="grid h-12 w-12 place-items-center rounded-md border border-white/10 text-3xl text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              onClick={() => setIsOptionsOpen((value) => !value)}
              title="Settings"
              type="button"
            >
              <span aria-hidden="true">⚙</span>
            </button>
            <button
              className="h-9 rounded-md border border-white/10 px-3 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              onClick={() => setIsHelpOpen(true)}
              type="button"
            >
              Help
            </button>
          </div>
        </div>

        {isOptionsOpen ? (
          <div className="mt-4 grid gap-4" id="create-options">
            <div className="ml-auto flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950/70 p-1">
              {OUTPUT_FORMATS.map((format) => (
                <button
                  aria-pressed={outputFormat === format.value}
                  className={
                    outputFormat === format.value
                      ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
                      : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  }
                  key={format.value}
                  onClick={() => {
                    setOutputFormat(format.value);
                    setEncodedAudio(null);
                  }}
                  type="button"
                >
                  {format.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-4 md:grid-cols-2">
              <MetadataInput
                label="Song"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, title: value }))
                }
                value={songMetadata.title ?? ""}
              />
              <MetadataInput
                label="Artist"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, artist: value }))
                }
                value={songMetadata.artist ?? ""}
              />
              <MetadataInput
                label="Album"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, album: value }))
                }
                value={songMetadata.album ?? ""}
              />
              <MetadataInput
                label="Year"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, year: value }))
                }
                value={songMetadata.year ?? ""}
              />
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-zinc-300">Notes</span>
                <textarea
                  className="min-h-20 rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                  onChange={(event) =>
                    setSongMetadata((metadata) => ({
                      ...metadata,
                      notes: event.target.value,
                    }))
                  }
                  value={songMetadata.notes ?? ""}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4">
          <label className="grid gap-2">
            <input
              aria-label="Choose an audio file"
              accept="audio/*"
              className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSourceFile(file);
                setOutputFormat(inferOutputFormat(file));
                setEncodedAudio(null);
              }}
              type="file"
            />
          </label>

          <button
            className="ml-auto w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEncode || isEncoding || isPending}
            onClick={handleEncode}
            type="button"
          >
            {isEncoding || isPending ? "Encoding..." : "Continue"}
          </button>

          {status ? (
            <p className="text-center text-sm leading-6 text-zinc-400">
              {status}
            </p>
          ) : null}

          {isEmbedding ? (
            <EmbeddingVisualization
              address={embeddingAddress}
              peaks={embeddingWaveform}
              progress={embeddingProgress}
              signature={embeddingSignature}
            />
          ) : null}
        </div>

        {encodedAudio ? (
          <div className="mt-8 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-5">
            <h2 className="text-lg font-semibold text-white">
              Watermarked file
            </h2>
            <audio className="mt-4 w-full" controls src={encodedAudio.url} />
            <div className="mt-4 flex justify-end">
              <a
                className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
                download={encodedAudio.fileName}
                href={encodedAudio.url}
              >
                Download
              </a>
            </div>
          </div>
        ) : null}
      </section>

      {isHelpOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
          role="presentation"
        >
          <div
            aria-labelledby="create-help-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-lg border border-white/10 bg-[#11151c] p-6 shadow-2xl shadow-black/50"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
                  Help
                </p>
                <h2
                  className="mt-3 text-2xl font-semibold text-white"
                  id="create-help-title"
                >
                  Link an audio file to your wallet.
                </h2>
              </div>
              <button
                className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsHelpOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <p className="mt-6 text-sm leading-6 text-zinc-300">
              Sign a SIWE message, embed the proof payload into a local audio
              file, and export a watermarked file in the browser.
            </p>
            <h3 className="mt-6 text-base font-semibold text-white">
              Client-side only
            </h3>
            <ul className="mt-6 grid gap-3 text-sm leading-6 text-zinc-300">
              <li>Audio files are decoded in this browser only.</li>
              <li>
                No waveform, stem, metadata, payload, or output file is uploaded.
              </li>
              <li>
                The exported file is generated locally as a downloadable audio
                file.
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmbeddingVisualization({
  address,
  peaks,
  progress,
  signature,
}: {
  address: string;
  peaks: number[];
  progress: number;
  signature: string;
}) {
  const waveform = peaks.length
    ? peaks
    : [0.34, 0.56, 0.42, 0.76, 0.52, 0.88, 0.46, 0.68];
  const viewWidth = 240;
  const viewHeight = 120;
  const centerY = viewHeight / 2;
  const waveformPath = buildWaveformArea(waveform, viewWidth, centerY);
  const upperStrand = buildHelixPath(waveform, viewWidth, centerY, 0);
  const lowerStrand = buildHelixPath(waveform, viewWidth, centerY, Math.PI);
  const walletStrandText = repeatHelixText(formatReadableHex(address), 16);
  const signatureStrandText = repeatHelixText(formatReadableHex(signature), 7);

  return (
    <div
      aria-label="Embedding proof payload"
      className="overflow-hidden rounded-lg bg-[#071014] p-4"
      role="status"
    >
      <div className="relative overflow-hidden rounded-md bg-zinc-950/45 px-3 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(103,232,249,0.18),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(34,211,238,0.14),transparent_32%)]" />
        <div className="absolute inset-x-8 top-1/2 h-px bg-cyan-300/15" />
        <div className="relative">
          <svg
            className="h-64 w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          >
            <defs>
              <linearGradient id="dna-waveform-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#cffafe" stopOpacity="0.95" />
                <stop offset="48%" stopColor="#67e8f9" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.22" />
              </linearGradient>
              <clipPath id="encoding-progress-clip">
                <rect
                  height={viewHeight}
                  width={Math.max(0.1, viewWidth * progress)}
                  x="0"
                  y="0"
                />
              </clipPath>
            </defs>

            <path d={upperStrand} fill="none" id="wallet-address-helix" />
            <path d={lowerStrand} fill="none" id="siwe-signature-helix" />

            <path
              d={waveformPath}
              fill="url(#dna-waveform-fill)"
              opacity="0.88"
            />
            <path
              d={waveformPath}
              fill="none"
              stroke="#a5f3fc"
              strokeOpacity="0.35"
              strokeWidth="0.6"
            />

            <g clipPath="url(#encoding-progress-clip)">
              <text
                fill="none"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="6.8"
                fontWeight="700"
                letterSpacing="0.35"
                opacity="0.95"
                stroke="#020617"
                strokeWidth="1.2"
              >
                <textPath href="#wallet-address-helix" startOffset="-6%">
                  {walletStrandText}
                </textPath>
              </text>
              <text
                fill="#f8fafc"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="6.8"
                fontWeight="700"
                letterSpacing="0.35"
              >
                <textPath href="#wallet-address-helix" startOffset="-6%">
                  {walletStrandText}
                </textPath>
              </text>
              <text
                fill="none"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="5.6"
                fontWeight="650"
                letterSpacing="0.28"
                opacity="0.95"
                stroke="#020617"
                strokeWidth="1"
              >
                <textPath href="#siwe-signature-helix" startOffset="-8%">
                  {signatureStrandText}
                </textPath>
              </text>
              <text
                fill="#67e8f9"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="5.6"
                fontWeight="650"
                letterSpacing="0.28"
              >
                <textPath href="#siwe-signature-helix" startOffset="-8%">
                  {signatureStrandText}
                </textPath>
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function repeatHelixText(value: string, count: number) {
  const text = value || "pending";
  return Array.from({ length: count }, () => text).join(" / ");
}

function MetadataInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <input
        className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function cleanSongMetadata(metadata: SongMetadata) {
  const song = Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key, value?.trim()])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as SongMetadata;

  return Object.keys(song).length ? song : null;
}

function formatReadableHex(value: string) {
  return value
    .replace(/^0x/i, "0x ")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function buildWaveformArea(peaks: number[], width: number, centerY: number) {
  const top = peaks.map((peak, index) => {
    const x = (index / (peaks.length - 1)) * width;
    const y = centerY - Math.max(3, peak * 24);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const bottom = peaks
    .map((peak, index) => {
      const x = (index / (peaks.length - 1)) * width;
      const y = centerY + Math.max(3, peak * 24);
      return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .reverse();

  return `${top.join(" ")} ${bottom.join(" ")} Z`;
}

function buildHelixPath(
  peaks: number[],
  width: number,
  centerY: number,
  phaseOffset: number,
) {
  const pointCount = 96;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const peak = peaks[Math.min(peaks.length - 1, Math.floor(progress * peaks.length))];
    const amplitude = 26 + peak * 10;
    const x = progress * width;
    const y = centerY + Math.sin(progress * Math.PI * 8 + phaseOffset) * amplitude;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  return points.join(" ");
}

function createWaveformPeaks(audioBuffer: AudioBuffer) {
  const sampleCount = 320;
  const peaks: number[] = [];
  const channels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channel) => audioBuffer.getChannelData(channel),
  );
  const samplesPerPeak = Math.max(1, Math.floor(audioBuffer.length / sampleCount));

  for (let index = 0; index < sampleCount; index += 1) {
    const start = index * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, audioBuffer.length);
    let peak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      for (const channelData of channels) {
        peak = Math.max(peak, Math.abs(channelData[sampleIndex] ?? 0));
      }
    }

    peaks.push(Math.min(1, Math.max(0.05, peak)));
  }

  const maxPeak = Math.max(...peaks);
  return peaks.map((peak) => peak / maxPeak);
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
