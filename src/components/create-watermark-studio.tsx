"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
import { mainnet } from "wagmi/chains";
import { readAudioMetadata } from "@/lib/audio-metadata";
import { trackEvent } from "@/lib/analytics";
import {
  OUTPUT_FORMATS,
  buildSiweMessage,
  createAudioProofHashes,
  createOutputName,
  createSiweFields,
  decodeAudioFile,
  encodePayload,
  encodeWatermarkedPcmWithProgress,
  getOutputFormat,
  getSupportedOutputFormat,
  inferOutputFormat,
  isOutputFormatSupported,
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
type ProofMetadata = {
  ens: string;
  manifest: string;
};
type VisualizationMode = "original" | "signal-atlas" | "eight-bit";

const VISUALIZATION_MODES: Array<{
  label: string;
  value: VisualizationMode;
}> = [
  { label: "Original", value: "original" },
  { label: "Signal Atlas", value: "signal-atlas" },
  { label: "8-Bit", value: "eight-bit" },
];

export function CreateWatermarkStudio() {
  const { address, chainId, isConnected } = useAccount();
  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const { signMessageAsync, isPending } = useSignMessage();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("wav");
  const [encodedAudio, setEncodedAudio] = useState<EncodedAudio | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isEncoding, setIsEncoding] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [hasVisualizationPreview, setHasVisualizationPreview] = useState(false);
  const [embeddingWaveform, setEmbeddingWaveform] = useState<number[]>([]);
  const [embeddingAddress, setEmbeddingAddress] = useState("");
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [visualizationMode, setVisualizationMode] =
    useState<VisualizationMode>("original");
  const [embeddingSignature, setEmbeddingSignature] = useState("");
  const [proofMetadata, setProofMetadata] = useState<ProofMetadata>({
    ens: "",
    manifest: "",
  });
  const [ensOptions, setEnsOptions] = useState<string[]>([]);
  const [isEnsLoading, setIsEnsLoading] = useState(false);
  const [songMetadata, setSongMetadata] = useState<SongMetadata>({});
  const didEditEnsRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlRef = useRef<string | null>(null);

  const canEncode = Boolean(isConnected && address && chainId && sourceFile);

  function handleFileSelection(file: File | null) {
    void handleSourceFileChange(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0] ?? null;

    if (file?.type.startsWith("audio/")) {
      handleFileSelection(file);
    } else if (file) {
      setStatus("Choose an audio file.");
    }
  }

  async function handleSourceFileChange(file: File | null) {
    setSourceFile(file);
    const inferredFormat = inferOutputFormat(file);
    const supportedFormat = getSupportedOutputFormat(inferredFormat);
    setOutputFormat(supportedFormat);
    setEncodedAudio(null);
    setHasVisualizationPreview(false);
    setEmbeddingProgress(0);
    setEmbeddingSignature("");
    setEmbeddingAddress(address ?? "");
    setIsPlaybackPlaying(false);
    setPlaybackDuration(0);
    setPlaybackTime(0);

    if (!file) {
      setStatus("");
      return;
    }

    trackEvent("audio_file_selected", {
      file_type: file.type || "unknown",
      output_format: supportedFormat,
      size_bytes: file.size,
    });

    if (inferredFormat !== supportedFormat) {
      setStatus(
        `${getOutputFormat(inferredFormat).label} export is not supported in this browser. Using ${getOutputFormat(supportedFormat).label}.`,
      );
    } else {
      setStatus("");
    }

    try {
      const metadata = await readAudioMetadata(file);
      setSongMetadata((current) => mergeMissingMetadata(current, metadata));
    } catch {
      // Metadata extraction is best-effort. Encoding can continue without tags.
    }

    try {
      const audioBuffer = await decodeAudioFile(file);
      setEmbeddingWaveform(createWaveformPeaks(audioBuffer));
      setHasVisualizationPreview(true);
    } catch {
      // Waveform preview is best-effort. Encoding will report decode failures.
    }
  }

  useEffect(() => {
    didEditEnsRef.current = false;

    let isActive = true;

    if (!address || !mainnetPublicClient) {
      queueMicrotask(() => {
        if (!isActive) {
          return;
        }

        setEnsOptions([]);
        setIsEnsLoading(false);
        setProofMetadata((metadata) => ({ ...metadata, ens: "" }));
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

    mainnetPublicClient
      .getEnsName({ address })
      .then((ensName) => {
        if (!isActive) {
          return;
        }

        const options = ensName ? [ensName] : [];
        setEnsOptions(options);
        setProofMetadata((metadata) => {
          if (didEditEnsRef.current) {
            return metadata;
          }

          return { ...metadata, ens: ensName ?? "" };
        });
      })
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
  }, [address, mainnetPublicClient]);

  async function handleEncode() {
    if (!sourceFile || !address || !chainId) {
      setStatus("Connect a wallet and select an audio file first.");
      trackEvent("audio_encode_blocked", {
        has_file: Boolean(sourceFile),
        wallet_connected: Boolean(address),
      });
      return;
    }

    if (!isOutputFormatSupported(outputFormat)) {
      setStatus(
        `${getOutputFormat(outputFormat).label} export is not supported in this browser. Choose WAV or AIFF.`,
      );
      trackEvent("audio_encode_blocked", {
        output_format: outputFormat,
        reason: "unsupported_format",
      });
      return;
    }

    setIsEncoding(true);
    setStatus("Decoding audio locally...");
    trackEvent("audio_encode_start", {
      output_format: outputFormat,
      song_metadata_present: Boolean(cleanSongMetadata(songMetadata)),
      wallet_connected: Boolean(address),
    });

    try {
      const audioBuffer = await decodeAudioFile(sourceFile);
      setEmbeddingWaveform(createWaveformPeaks(audioBuffer));
      setEmbeddingAddress(address);
      setEmbeddingSignature("");
      setEmbeddingProgress(0.03);
      setIsEmbedding(true);
      setStatus("Fingerprinting audio locally...");
      const audioProofHashes = await createAudioProofHashes(audioBuffer);
      const song = cleanSongMetadata(songMetadata);
      const siweFields = {
        ...createSiweFields(address, chainId),
        ens: proofMetadata.ens.trim(),
        manifest: proofMetadata.manifest.trim(),
        audioFingerprint: audioProofHashes.audio_hash,
        ...audioProofHashes,
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
        sourceFileName: sourceFile.name,
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
      trackEvent("audio_encode_success", {
        output_format: outputFormat,
        payload_bytes: payloadBytes.length,
      });
      setStatus("");
    } catch (error) {
      trackEvent("audio_encode_failed", {
        output_format: outputFormat,
        reason: error instanceof Error ? error.message : "unknown",
      });
      setStatus(error instanceof Error ? error.message : "Encoding failed.");
    } finally {
      setIsEmbedding(false);
      setIsEncoding(false);
    }
  }

  async function handleTogglePlayback() {
    const audio = audioRef.current;

    if (!audio || !encodedAudio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      trackEvent("encoded_audio_play");
    } else {
      audio.pause();
      trackEvent("encoded_audio_pause");
    }
  }

  const hasPreview = hasVisualizationPreview || isEmbedding || Boolean(encodedAudio);
  const isUploadCompact = Boolean(sourceFile || hasPreview || isEncoding || isPending);
  const containerClass = hasPreview
    ? "mx-auto w-full max-w-6xl"
    : "mx-auto w-full max-w-3xl";
  const continueLabel = isEncoding || isPending
    ? "Encoding..."
    : sourceFile && !canEncode
      ? "Connect wallet"
      : "Continue";

  function renderContinueButton(className: string) {
    return (
      <ConnectButton.Custom>
        {({ mounted, openConnectModal }) => (
          <button
            className={className}
            disabled={!sourceFile || isEncoding || isPending || !mounted}
            onClick={() => {
              if (!canEncode) {
                setStatus("Connect your wallet to sign this proof.");
                trackEvent("wallet_connect_open", { location: "create_continue" });
                openConnectModal?.();
                return;
              }

              void handleEncode();
            }}
            type="button"
          >
            {continueLabel}
          </button>
        )}
      </ConnectButton.Custom>
    );
  }

  return (
    <div className={containerClass}>
      <section className="min-h-[26rem] rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex items-center justify-between gap-5">
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
              {OUTPUT_FORMATS.map((format) => {
                const isSupported = isOutputFormatSupported(format.value);

                return (
                  <button
                    aria-disabled={!isSupported}
                    aria-pressed={outputFormat === format.value}
                    className={
                      !isSupported
                        ? "cursor-not-allowed rounded px-3 py-1.5 text-sm font-semibold text-zinc-600"
                        : outputFormat === format.value
                          ? "rounded bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-cyan-950"
                          : "rounded px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    }
                    disabled={!isSupported}
                    key={format.value}
                    onClick={() => {
                      setOutputFormat(format.value);
                      setEncodedAudio(null);
                    }}
                    title={
                      isSupported
                        ? undefined
                        : `${format.label} export is not supported in this browser`
                    }
                    type="button"
                  >
                    {format.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-4 md:grid-cols-2">
              {ensOptions.length ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-zinc-300">ENS</span>
                  <select
                    className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                    onChange={(event) => {
                      didEditEnsRef.current = true;
                      setProofMetadata((metadata) => ({
                        ...metadata,
                        ens:
                          event.target.value === "__custom__"
                            ? ""
                            : event.target.value,
                      }));
                    }}
                    value={
                      ensOptions.includes(proofMetadata.ens)
                        ? proofMetadata.ens
                        : "__custom__"
                    }
                  >
                    {ensOptions.map((ensName) => (
                      <option key={ensName} value={ensName}>
                        {ensName}
                      </option>
                    ))}
                    <option value="__custom__">Custom ENS</option>
                  </select>
                </label>
              ) : null}
              <MetadataInput
                label={ensOptions.length ? "Alternate ENS" : "ENS"}
                onChange={(value) => {
                  didEditEnsRef.current = true;
                  setProofMetadata((metadata) => ({ ...metadata, ens: value }));
                }}
                placeholder={isEnsLoading ? "Resolving ENS..." : "artist.eth"}
                value={
                  ensOptions.includes(proofMetadata.ens) ? "" : proofMetadata.ens
                }
              />
              <MetadataInput
                label="Manifest"
                onChange={(value) =>
                  setProofMetadata((metadata) => ({
                    ...metadata,
                    manifest: value,
                  }))
                }
                placeholder="ipfs://bafy..."
                value={proofMetadata.manifest}
              />
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
                label="Album Artist"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({
                    ...metadata,
                    albumArtist: value,
                  }))
                }
                value={songMetadata.albumArtist ?? ""}
              />
              <MetadataInput
                label="Album"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, album: value }))
                }
                value={songMetadata.album ?? ""}
              />
              <MetadataInput
                label="Composer"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, composer: value }))
                }
                value={songMetadata.composer ?? ""}
              />
              <MetadataInput
                label="Genre"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, genre: value }))
                }
                value={songMetadata.genre ?? ""}
              />
              <MetadataInput
                label="Release Date"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({
                    ...metadata,
                    releaseDate: value,
                  }))
                }
                value={songMetadata.releaseDate ?? ""}
              />
              <MetadataInput
                label="Year"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, year: value }))
                }
                value={songMetadata.year ?? ""}
              />
              <MetadataInput
                label="Track"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({
                    ...metadata,
                    trackNumber: value,
                  }))
                }
                value={songMetadata.trackNumber ?? ""}
              />
              <MetadataInput
                label="Disc"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({
                    ...metadata,
                    discNumber: value,
                  }))
                }
                value={songMetadata.discNumber ?? ""}
              />
              <MetadataInput
                label="ISRC"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, isrc: value }))
                }
                value={songMetadata.isrc ?? ""}
              />
              <MetadataInput
                label="BPM"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, bpm: value }))
                }
                value={songMetadata.bpm ?? ""}
              />
              <MetadataInput
                label="Key"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({ ...metadata, key: value }))
                }
                value={songMetadata.key ?? ""}
              />
              <MetadataInput
                label="Publisher"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({
                    ...metadata,
                    publisher: value,
                  }))
                }
                value={songMetadata.publisher ?? ""}
              />
              <MetadataInput
                label="Copyright"
                onChange={(value) =>
                  setSongMetadata((metadata) => ({
                    ...metadata,
                    copyright: value,
                  }))
                }
                value={songMetadata.copyright ?? ""}
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

        <div className="mt-7 grid gap-5">
          <div
            className={
              isDraggingFile
                ? `${getUploadZoneSizeClass(isUploadCompact)} grid cursor-pointer place-items-center rounded-lg border border-cyan-300 bg-cyan-300/10 text-center transition-all duration-500 ease-out`
                : `${getUploadZoneSizeClass(isUploadCompact)} grid cursor-pointer place-items-center rounded-lg border border-dashed border-white/15 bg-zinc-950/70 text-center transition-all duration-500 ease-out hover:border-cyan-300/70 hover:bg-cyan-300/[0.06]`
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
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
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
                  {sourceFile ? sourceFile.name : "Drop audio here"}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  {sourceFile ? "Click to choose a different file" : "Click to upload or drag a file into this box"}
                </p>
              </div>
              <span className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950">
                Choose File
              </span>
            </div>
            <input
              ref={fileInputRef}
              aria-label="Choose an audio file"
              accept="audio/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleFileSelection(file);
              }}
              type="file"
            />
          </div>
          {!encodedAudio && !hasPreview ? (
            renderContinueButton(
              "mx-auto w-full max-w-48 rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50",
            )
          ) : null}

          {status ? (
            <p className="text-center text-sm leading-6 text-zinc-400">
              {status}
            </p>
          ) : null}

          {hasPreview ? (
            <EmbeddingVisualization
              address={embeddingAddress}
              audioUrl={encodedAudio?.url}
              canPlay={Boolean(encodedAudio)}
              duration={playbackDuration}
              isActive={isEmbedding || isEncoding || isPending}
              onDurationChange={(duration) => setPlaybackDuration(duration)}
              onEnded={() => {
                setIsPlaybackPlaying(false);
                setPlaybackTime(0);
              }}
              onPlayStateChange={(isPlaying) => setIsPlaybackPlaying(isPlaying)}
              onTimeChange={(time) => setPlaybackTime(time)}
              peaks={embeddingWaveform}
              progress={
                encodedAudio && playbackDuration > 0
                  ? playbackTime / playbackDuration
                  : embeddingProgress
              }
              ref={audioRef}
              signature={embeddingSignature}
              time={playbackTime}
              visualizationMode={visualizationMode}
              onVisualizationModeChange={setVisualizationMode}
            />
          ) : null}

          {!encodedAudio && hasPreview ? (
            <div className="flex justify-end">
              {renderContinueButton(
                "w-full rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-40",
              )}
            </div>
          ) : null}

        </div>

        {encodedAudio ? (
          <div className="mt-8 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <button
                aria-label={
                  isPlaybackPlaying ? "Pause watermarked audio" : "Play watermarked audio"
                }
                className="grid h-12 w-12 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300 text-lg font-semibold text-zinc-950 transition hover:bg-cyan-200"
                onClick={() => {
                  void handleTogglePlayback();
                }}
                type="button"
              >
                <span aria-hidden="true">{isPlaybackPlaying ? "II" : "▶"}</span>
              </button>
              <a
                className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
                download={encodedAudio.fileName}
                href={encodedAudio.url}
                onClick={() =>
                  trackEvent("encoded_audio_download", {
                    output_format: encodedAudio.format,
                  })
                }
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

function getUploadZoneSizeClass(isCompact: boolean) {
  return isCompact ? "min-h-24 p-4" : "min-h-44 p-6";
}

function EmbeddingVisualization({
  address,
  audioUrl,
  canPlay,
  duration,
  isActive,
  onDurationChange,
  onEnded,
  onPlayStateChange,
  onTimeChange,
  peaks,
  progress,
  ref,
  signature,
  time,
  visualizationMode,
  onVisualizationModeChange,
}: {
  address: string;
  audioUrl?: string;
  canPlay: boolean;
  duration: number;
  isActive: boolean;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onTimeChange: (time: number) => void;
  peaks: number[];
  progress: number;
  ref: React.RefObject<HTMLAudioElement | null>;
  signature: string;
  time: number;
  visualizationMode: VisualizationMode;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
}) {
  const waveform = peaks.length
    ? peaks
    : [0.34, 0.56, 0.42, 0.76, 0.52, 0.88, 0.46, 0.68];
  const clampedProgress = clamp01(progress);
  const statusLabel = canPlay
    ? "Now hearing"
    : isActive
      ? "Encoding proof"
      : "Signal ready";
  const timeLabel = canPlay
    ? `${formatPlaybackTime(time)} / ${formatPlaybackTime(duration)}`
    : isActive
      ? `${Math.round(clampedProgress * 100)}% encoded`
      : "Ready to encode";

  return (
    <div
      aria-label={canPlay ? "Watermarked audio playback" : "Embedding proof payload"}
      className="overflow-hidden rounded-lg bg-[#071014] p-4"
      role="status"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
            {statusLabel}
          </p>
          <p className="mt-1 font-mono text-sm text-zinc-200">{timeLabel}</p>
        </div>
        <div
          aria-label="Visualization"
          className="flex items-center gap-1 rounded-md border border-white/10 bg-zinc-950/70 p-1"
          role="group"
        >
          {VISUALIZATION_MODES.map((mode) => (
            <button
              aria-pressed={visualizationMode === mode.value}
              className={
                visualizationMode === mode.value
                  ? "rounded bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-950"
                  : "rounded px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
              }
              key={mode.value}
              onClick={() => {
                trackEvent("visualization_mode_select", { mode: mode.value });
                onVisualizationModeChange(mode.value);
              }}
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      {audioUrl ? (
        <audio
          onDurationChange={(event) =>
            onDurationChange(event.currentTarget.duration || 0)
          }
          onEnded={onEnded}
          onPause={() => onPlayStateChange(false)}
          onPlay={() => onPlayStateChange(true)}
          onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime)}
          ref={ref}
          src={audioUrl}
        />
      ) : null}
      {visualizationMode === "original" ? (
        <OriginalEmbeddingVisualization
          address={address}
          peaks={waveform}
          progress={clampedProgress}
          signature={signature}
        />
      ) : visualizationMode === "signal-atlas" ? (
        <SignalAtlasVisualization
          peaks={waveform}
          progress={clampedProgress}
        />
      ) : (
        <EightBitVisualization
          peaks={waveform}
          progress={clampedProgress}
        />
      )}
    </div>
  );
}

function OriginalEmbeddingVisualization({
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
  const viewWidth = 240;
  const viewHeight = 120;
  const centerY = viewHeight / 2;
  const waveformPath = buildWaveformArea(peaks, viewWidth, centerY);
  const upperStrand = buildHelixPath(peaks, viewWidth, centerY, 0);
  const lowerStrand = buildHelixPath(peaks, viewWidth, centerY, Math.PI);
  const walletStrandText = repeatHelixText(formatReadableHex(address), 16);
  const signatureStrandText = repeatHelixText(formatReadableHex(signature), 7);

  return (
    <div className="relative overflow-hidden rounded-md px-3 py-5">
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
  );
}

function SignalAtlasVisualization({
  peaks,
  progress,
}: {
  peaks: number[];
  progress: number;
}) {
  const viewWidth = 320;
  const viewHeight = 190;
  const plot = {
    left: 20,
    right: 304,
    top: 20,
    bottom: 142,
  };
  const width = plot.right - plot.left;
  const height = plot.bottom - plot.top;
  const samples = sampleSeries(peaks, 80);
  const average = rollingAverage(samples, 7);
  const cumulative = cumulativeMean(samples);
  const waveformPath = buildLinePath(samples, plot.left, plot.top, width, height);
  const averagePath = buildLinePath(average, plot.left, plot.top, width, height);
  const cumulativePath = buildLinePath(
    cumulative,
    plot.left,
    plot.top + 12,
    width,
    height - 24,
  );
  const transients = deltaSeries(samples);
  const roughness = rollingAverage(transients, 5);
  const featureRows = [
    { color: "#0f766e", values: samples, y: 151 },
    { color: "#dc2626", values: transients, y: 162 },
    { color: "#0891b2", values: roughness, y: 173 },
  ];
  const progressX = plot.left + width * progress;
  const progressSampleIndex = Math.min(
    samples.length - 1,
    Math.max(0, Math.floor(progress * (samples.length - 1))),
  );
  const activePeak = samples[progressSampleIndex] ?? 0;
  const activeY = plot.bottom - activePeak * height;
  const tickValues = [0.25, 0.5, 0.75];

  return (
    <div className="relative overflow-hidden rounded-md border border-white/10 bg-[#f8faf7] px-3 py-4 text-zinc-950">
      <svg
        className="h-72 w-full"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      >
        <title>Signal atlas audio envelope analysis</title>
        <desc>
          The chart plots normalized audio peak energy over time, rolling
          average, cumulative mean, transient changes, and local roughness from
          the selected audio file.
        </desc>
        <defs>
          <clipPath id="signal-atlas-progress-clip">
            <rect
              height={viewHeight}
              width={Math.max(0.1, progressX)}
              x="0"
              y="0"
            />
          </clipPath>
          <linearGradient id="signal-atlas-energy" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <rect fill="#f8faf7" height={viewHeight} width={viewWidth} />
        {tickValues.map((tick) => {
          const y = plot.bottom - tick * height;

          return (
            <line
              key={tick}
              stroke="#111827"
              strokeOpacity="0.12"
              strokeWidth="0.5"
              x1={plot.left}
              x2={plot.right}
              y1={y}
              y2={y}
            />
          );
        })}

        <path
          d={`${waveformPath} L ${plot.right} ${plot.bottom} L ${plot.left} ${plot.bottom} Z`}
          fill="url(#signal-atlas-energy)"
        />
        <path
          d={cumulativePath}
          fill="none"
          stroke="#dc2626"
          strokeOpacity="0.68"
          strokeWidth="1"
        />
        <path
          d={averagePath}
          fill="none"
          stroke="#111827"
          strokeOpacity="0.72"
          strokeWidth="0.95"
        />
        <path
          d={waveformPath}
          fill="none"
          stroke="#0f766e"
          strokeOpacity="0.9"
          strokeWidth="1.2"
        />

        {samples.map((peak, index) => {
          const x = plot.left + (index / (samples.length - 1)) * width;
          const y = plot.bottom - peak * height;
          const isMajor = index % 10 === 0;

          return (
            <g key={`sample-${index}`}>
              <line
                stroke="#111827"
                strokeOpacity={isMajor ? "0.16" : "0.055"}
                strokeWidth={isMajor ? "0.45" : "0.25"}
                x1={x}
                x2={x}
                y1={plot.bottom}
                y2={y}
              />
              <circle
                cx={x}
                cy={y}
                fill={index / (samples.length - 1) <= progress ? "#0f766e" : "#f8faf7"}
                r={isMajor ? "1.45" : "0.88"}
                stroke="#0f766e"
                strokeOpacity="0.82"
                strokeWidth="0.45"
              />
            </g>
          );
        })}

        {featureRows.map((row, rowIndex) => (
          <g key={`feature-row-${rowIndex}`}>
            <line
              stroke="#111827"
              strokeOpacity="0.12"
              strokeWidth="0.45"
              x1={plot.left}
              x2={plot.right}
              y1={row.y}
              y2={row.y}
            />
            {row.values.map((value, index) => {
              const x = plot.left + (index / (row.values.length - 1)) * width;
              const barHeight = Math.max(0.7, value * 9);
              const isEncoded = index / (row.values.length - 1) <= progress;

              return (
                <rect
                  fill={isEncoded ? row.color : "#111827"}
                  height={barHeight}
                  key={`feature-${rowIndex}-${index}`}
                  opacity={isEncoded ? "0.76" : "0.16"}
                  width="1.35"
                  x={x}
                  y={row.y - barHeight / 2}
                />
              );
            })}
          </g>
        ))}

        <g clipPath="url(#signal-atlas-progress-clip)">
          <rect
            fill="#67e8f9"
            height={viewHeight}
            opacity="0.08"
            width={viewWidth}
          />
          <path
            d={waveformPath}
            fill="none"
            stroke="#0e7490"
            strokeWidth="2"
          />
        </g>

        <line
          stroke="#dc2626"
          strokeDasharray="2 2"
          strokeOpacity="0.72"
          strokeWidth="0.8"
          x1={progressX}
          x2={progressX}
          y1="14"
          y2="181"
        />
        <circle
          cx={progressX}
          cy={activeY}
          fill="#f8faf7"
          r="4.4"
          stroke="#dc2626"
          strokeWidth="1.2"
        />
        <circle cx={progressX} cy={activeY} fill="#dc2626" r="1.4" />
      </svg>
    </div>
  );
}

function EightBitVisualization({
  peaks,
  progress,
}: {
  peaks: number[];
  progress: number;
}) {
  const columns = 64;
  const rows = 32;
  const cellWidth = 5;
  const cellHeight = 5;
  const viewWidth = columns * cellWidth;
  const viewHeight = rows * cellHeight;
  const center = (rows - 1) / 2;
  const cells = buildEightBitAudioCells(peaks, columns, rows);

  return (
    <div className="relative overflow-hidden rounded-md bg-[#06151d] p-3">
      <svg
        className="h-72 w-full [image-rendering:pixelated]"
        preserveAspectRatio="none"
        role="img"
        shapeRendering="crispEdges"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      >
        <title>8-bit audio amplitude artifact map</title>
        <desc>
          Pixel columns represent time, rows represent normalized amplitude
          bands, color represents local energy and transients, and opacity
          follows encode progress.
        </desc>
        {cells.map((cell) => {
          const columnProgress = cell.column / Math.max(1, columns - 1);
          const isEncoded = columnProgress <= progress;

          return (
            <rect
              fill={cell.fill}
              height={cellHeight}
              key={`${cell.column}-${cell.row}`}
              opacity={isEncoded ? cell.opacity : cell.opacity * 0.36}
              width={cellWidth}
              x={cell.column * cellWidth}
              y={cell.row * cellHeight}
            />
          );
        })}

        {Array.from({ length: columns }, (_, column) => {
          const sample = sampleSeries(peaks, columns)[column] ?? 0;
          const yTop = Math.round((center - sample * center) * cellHeight);
          const yBottom = Math.round((center + sample * center) * cellHeight);

          return (
            <line
              key={`edge-${column}`}
              opacity={column / Math.max(1, columns - 1) <= progress ? "0.55" : "0.18"}
              stroke="#e0f2fe"
              strokeWidth="1"
              x1={column * cellWidth + cellWidth / 2}
              x2={column * cellWidth + cellWidth / 2}
              y1={yTop}
              y2={yBottom}
            />
          );
        })}

      </svg>
    </div>
  );
}

function buildEightBitAudioCells(peaks: number[], columns: number, rows: number) {
  const samples = sampleSeries(peaks, columns);
  const center = (rows - 1) / 2;

  return samples.flatMap((peak, column) => {
    const previous = samples[Math.max(0, column - 1)] ?? peak;
    const next = samples[Math.min(samples.length - 1, column + 1)] ?? peak;
    const transient = clamp01(Math.abs(peak - previous) + Math.abs(next - peak));
    const neighborhood = samples.slice(
      Math.max(0, column - 2),
      Math.min(samples.length, column + 3),
    );
    const localMean =
      neighborhood.reduce((sum, value) => sum + value, 0) / neighborhood.length;
    const roughness =
      neighborhood.reduce((sum, value, index) => {
        if (index === 0) {
          return sum;
        }

        return sum + Math.abs(value - (neighborhood[index - 1] ?? value));
      }, 0) / Math.max(1, neighborhood.length - 1);

    return Array.from({ length: rows }, (_, row) => {
      const normalizedDistance = Math.abs(row - center) / center;
      const insideEnvelope = normalizedDistance <= Math.max(0.04, peak);
      const edgeDistance = Math.abs(normalizedDistance - peak);
      const nearEnvelopeEdge = edgeDistance <= 1 / center;
      const nearCenter = normalizedDistance <= 1 / center;
      const intensity = clamp01(
        insideEnvelope
          ? 0.48 + peak * 0.3 + localMean * 0.14 + transient * 0.28
          : 0.12 + localMean * 0.18 + (1 - normalizedDistance) * 0.08,
      );
      const fill = insideEnvelope
        ? nearEnvelopeEdge
          ? "#e0f2fe"
          : transient > 0.24
            ? "#facc15"
            : roughness > 0.11
              ? "#fb7185"
              : peak > 0.68
                ? "#22c55e"
                : "#38bdf8"
        : nearCenter
          ? "#1e293b"
          : "#06151d";

      return {
        column,
        fill,
        opacity: insideEnvelope ? intensity : Math.max(0.22, intensity),
        row,
      };
    });
  });
}

function repeatHelixText(value: string, count: number) {
  const text = value || "pending";
  return Array.from({ length: count }, () => text).join(" / ");
}

function formatPlaybackTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function mergeMissingMetadata(current: SongMetadata, extracted: SongMetadata) {
  return {
    ...extracted,
    ...Object.fromEntries(
      Object.entries(current).filter(([, value]) => Boolean(value?.trim())),
    ),
  } as SongMetadata;
}

function MetadataInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <input
        className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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

function buildLinePath(
  values: number[],
  left: number,
  top: number,
  width: number,
  height: number,
) {
  return values
    .map((value, index) => {
      const x = left + (index / (values.length - 1)) * width;
      const y = top + (1 - clamp01(value)) * height;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function sampleSeries(values: number[], count: number) {
  if (!values.length) {
    return Array.from({ length: count }, (_, index) => {
      const phase = index / Math.max(1, count - 1);

      return 0.3 + Math.sin(phase * Math.PI * 6) * 0.12;
    });
  }

  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = (index / Math.max(1, count - 1)) * (values.length - 1);
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(values.length - 1, lowerIndex + 1);
    const blend = sourceIndex - lowerIndex;
    const lower = values[lowerIndex] ?? 0;
    const upper = values[upperIndex] ?? lower;

    return clamp01(lower + (upper - lower) * blend);
  });
}

function rollingAverage(values: number[], windowSize: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - Math.floor(windowSize / 2));
    const end = Math.min(values.length, start + windowSize);
    const window = values.slice(start, end);
    const total = window.reduce((sum, value) => sum + value, 0);

    return total / window.length;
  });
}

function cumulativeMean(values: number[]) {
  let total = 0;

  return values.map((value, index) => {
    total += value;

    return total / (index + 1);
  });
}

function deltaSeries(values: number[]) {
  const deltas = values.map((value, index) => {
    const previous = values[Math.max(0, index - 1)] ?? value;
    const next = values[Math.min(values.length - 1, index + 1)] ?? value;

    return Math.max(Math.abs(value - previous), Math.abs(next - value));
  });
  const maxDelta = Math.max(...deltas);

  if (maxDelta <= 0) {
    return deltas;
  }

  return deltas.map((value) => clamp01(value / maxDelta));
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
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
