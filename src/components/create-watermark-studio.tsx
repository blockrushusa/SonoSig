"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useRef, useState } from "react";
import { isAddress, type Address, type Hash } from "viem";
import { namehash, normalize } from "viem/ens";
import {
  useAccount,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
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
import {
  createWeb3TransactionId,
  updateWeb3Transaction,
  upsertPacStacRegistrationTransaction,
  upsertWeb3Transaction,
} from "@/lib/web3-transactions";

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
type PostPhase =
  | "confirming-wallet"
  | "idle"
  | "pacstac"
  | "resolving"
  | "submitted";
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
type MainnetReceiptClient = {
  getTransactionReceipt: (parameters: { hash: Hash }) => Promise<{
    status: "reverted" | "success";
  }>;
  waitForTransactionReceipt: (parameters: { hash: Hash }) => Promise<{
    status: "reverted" | "success";
  }>;
};

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

const SONOSIG_ENS_RECORD_KEY = "com.sonosig";

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
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("wav");
  const [encodedAudio, setEncodedAudio] = useState<EncodedAudio | null>(null);
  const [encodedProof, setEncodedProof] = useState<ProofPayload | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [shouldPostPacStac, setShouldPostPacStac] = useState(true);
  const [shouldPostEns, setShouldPostEns] = useState(true);
  const [shouldDownloadRegistration, setShouldDownloadRegistration] =
    useState(true);
  const [isPostingProof, setIsPostingProof] = useState(false);
  const [postPhase, setPostPhase] = useState<PostPhase>("idle");
  const [postStatus, setPostStatus] = useState("");
  const [postTransactionHash, setPostTransactionHash] = useState<Hash | null>(
    null,
  );
  const [pacStacPostSuccess, setPacStacPostSuccess] = useState(false);
  const [ensPostSuccess, setEnsPostSuccess] = useState(false);
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
    setEncodedProof(null);
    setIsPostModalOpen(false);
    setPostPhase("idle");
    setPostStatus("");
    setPostTransactionHash(null);
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

    const ensClient = mainnetPublicClient;
    const walletAddress = address;

    async function loadEnsOptions() {
      const options: string[] = [];

      try {
        const response = await fetch(`/api/ens/names?address=${walletAddress}`);

        if (response.ok) {
          const body = (await response.json()) as { names?: string[] };

          for (const ensName of body.names ?? []) {
            addEnsOption(options, ensName);
          }
        }
      } catch {
        // Indexed ENS ownership lookup is best-effort.
      }

      try {
        const reverseName = await ensClient.getEnsName({ address: walletAddress });
        addEnsOption(options, reverseName);
      } catch {
        // Reverse ENS lookup is best-effort.
      }

      if (!isActive) {
        return;
      }

      setEnsOptions(options);
      setProofMetadata((metadata) => {
        if (didEditEnsRef.current) {
          return metadata;
        }

        return { ...metadata, ens: options[0] ?? "" };
      });
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
      setEncodedProof(payload);
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

  function handleOpenPostModal() {
    setShouldPostPacStac(true);
    setShouldPostEns(true);
    setShouldDownloadRegistration(true);
    setPostPhase("idle");
    setPostStatus("");
    setPostTransactionHash(null);
    setPacStacPostSuccess(false);
    setEnsPostSuccess(false);
    setIsPostModalOpen(true);
    trackEvent("create_post_modal_open");
  }

  async function handlePostProof() {
    if (!encodedProof) {
      setPostStatus("Encode an audio proof before posting.");
      return;
    }

    if (
      (!shouldPostPacStac || pacStacPostSuccess) &&
      (!shouldPostEns || ensPostSuccess)
    ) {
      setIsPostModalOpen(false);
      return;
    }

    if (!shouldPostPacStac && !shouldPostEns) {
      setPostStatus("Choose PacStac, ENS, or both.");
      return;
    }

    const ensName = proofMetadata.ens.trim() || encodedProof.ens?.trim() || "";

    if (shouldPostEns && !ensName) {
      setPostStatus("Add an ENS name in settings before posting to ENS.");
      return;
    }

    setIsPostingProof(true);
    setPostStatus("");
    setPostTransactionHash(null);
    trackEvent("create_post_start", {
      ens_selected: shouldPostEns,
      pacstac_selected: shouldPostPacStac,
    });

    try {
      let registration: PacStacRegistration | null =
        getStoredPacStacRegistration(encodedProof);
      let ensTransactionHash: Hash | null = null;

      if (shouldPostPacStac && !pacStacPostSuccess) {
        setPostPhase("pacstac");
        setPostStatus(getPostingStatusLabel(shouldPostPacStac, shouldPostEns));
        registration = await registerPacStacClaim(encodedProof);
        storePacStacRegistration(encodedProof, registration);
        setPacStacPostSuccess(true);
        setPostStatus("PacStac registration complete.");
        trackEvent("create_post_pacstac_success", {
          idempotent: Boolean(registration.idempotent),
          status: registration.status,
        });
      }

      if (shouldPostEns) {
        const normalizedName = normalize(ensName);
        const pacstacWalletPointer = buildPacStacWalletPointer(
          registration?.wallet ?? encodedProof.wallet,
        );

        if (!walletClient) {
          throw new Error("Wallet is not ready. Reconnect your wallet and try again.");
        }

        if (!mainnetPublicClient) {
          throw new Error("Ethereum mainnet RPC is not ready. Try again.");
        }

        setPostPhase("resolving");
        setPostStatus(getPostingStatusLabel(shouldPostPacStac, shouldPostEns));

        if (chainId !== mainnet.id) {
          await switchChainAsync({ chainId: mainnet.id });
        }

        const resolver = await getEnsResolverAddress(
          normalizedName,
          mainnetPublicClient,
        );

        if (!resolver) {
          throw new Error("This ENS name has no resolver configured.");
        }

        setPostPhase("confirming-wallet");
        setPostStatus("Confirm the ENS text record update in your wallet.");
        const transactionHash = await walletClient.writeContract({
          abi: ENS_TEXT_ABI,
          address: resolver,
          args: [
            namehash(normalizedName),
            SONOSIG_ENS_RECORD_KEY,
            pacstacWalletPointer,
          ],
          chain: mainnet,
          functionName: "setText",
        });

        setPostPhase("submitted");
        ensTransactionHash = transactionHash;
        setPostTransactionHash(transactionHash);
        setEnsPostSuccess(true);
        setPostStatus("ENS transaction submitted. Track confirmation on Transactions.");
        trackEvent("create_post_ens_submitted");
        storeSubmittedEnsTransaction({
          claimId: registration?.claimId,
          ensName: normalizedName,
          hash: transactionHash,
          proof: encodedProof,
        });
        void monitorSubmittedEnsTransaction(mainnetPublicClient, transactionHash);
      }

      setPostPhase("idle");
      setPostStatus(
        shouldPostEns
          ? "ENS transaction submitted. Track confirmation on Transactions."
          : "",
      );
      if (shouldDownloadRegistration) {
        downloadRegistrationInfo(encodedProof, {
          ensName: shouldPostEns
            ? proofMetadata.ens.trim() || encodedProof.ens?.trim() || ""
            : "",
          ensTransactionHash,
          pacstacRegistration: registration,
          postedToEns: shouldPostEns,
          postedToPacStac: shouldPostPacStac,
        });
      }
      trackEvent("create_post_success", {
        ens_selected: shouldPostEns,
        pacstac_selected: shouldPostPacStac,
      });
    } catch (error) {
      const message = formatPostError(error);
      setPostPhase("idle");
      setPostStatus(message);
      trackEvent("create_post_failed", { reason: message });
    } finally {
      setIsPostingProof(false);
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
              <div className="flex flex-wrap justify-end gap-2">
                <a
                  className="rounded-md border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/10 hover:text-white"
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
                <button
                  className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!encodedProof}
                  onClick={handleOpenPostModal}
                  type="button"
                >
                  Post
                </button>
              </div>
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

      {isPostModalOpen ? (
        <PostProofModal
          ensName={proofMetadata.ens || encodedProof?.ens || ""}
          ensOptions={ensOptions}
          ensSuccess={ensPostSuccess}
          hash={postTransactionHash}
          isEnsLoading={isEnsLoading}
          isPosting={isPostingProof}
          onClose={() => {
            if (!isPostingProof) {
              setIsPostModalOpen(false);
            }
          }}
          onContinue={() => {
            void handlePostProof();
          }}
          onEnsChange={(checked) => {
            setShouldPostEns(checked);
          }}
          onEnsNameChange={(value) => {
            didEditEnsRef.current = true;
            setProofMetadata((metadata) => ({ ...metadata, ens: value }));
          }}
          onRegistrationDownloadChange={setShouldDownloadRegistration}
          onPacStacChange={(checked) => {
            setShouldPostPacStac(checked);
            setPacStacPostSuccess(false);
          }}
          pacStacSuccess={pacStacPostSuccess}
          phase={postPhase}
          shouldDownloadRegistration={shouldDownloadRegistration}
          shouldPostEns={shouldPostEns}
          shouldPostPacStac={shouldPostPacStac}
          status={postStatus}
        />
      ) : null}
    </div>
  );
}

function getUploadZoneSizeClass(isCompact: boolean) {
  return isCompact ? "min-h-24 p-4" : "min-h-44 p-6";
}

function PostProofModal({
  ensName,
  ensOptions,
  ensSuccess,
  hash,
  isEnsLoading,
  isPosting,
  onClose,
  onContinue,
  onEnsChange,
  onPacStacChange,
  onEnsNameChange,
  onRegistrationDownloadChange,
  pacStacSuccess,
  phase,
  shouldDownloadRegistration,
  shouldPostEns,
  shouldPostPacStac,
  status,
}: {
  ensName: string;
  ensOptions: string[];
  ensSuccess: boolean;
  hash: Hash | null;
  isEnsLoading: boolean;
  isPosting: boolean;
  onClose: () => void;
  onContinue: () => void;
  onEnsChange: (checked: boolean) => void;
  onEnsNameChange: (value: string) => void;
  onPacStacChange: (checked: boolean) => void;
  onRegistrationDownloadChange: (checked: boolean) => void;
  pacStacSuccess: boolean;
  phase: PostPhase;
  shouldDownloadRegistration: boolean;
  shouldPostEns: boolean;
  shouldPostPacStac: boolean;
  status: string;
}) {
  const canContinue = !isPosting && (shouldPostPacStac || shouldPostEns);
  const isSelectedFlowComplete =
    (!shouldPostPacStac || pacStacSuccess) && (!shouldPostEns || ensSuccess);
  const isManualEnsSelected =
    !ensOptions.length || !ensOptions.includes(ensName.trim());
  const phaseLabel =
    phase === "idle"
      ? ""
      : getPostingStatusLabel(shouldPostPacStac, shouldPostEns);

  return (
    <div
      aria-labelledby="post-proof-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-cyan-300/20 bg-[#10161c] p-6 shadow-2xl shadow-cyan-950/40">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Post proof
            </p>
          </div>
          <button
            className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPosting}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <label
            className={
              pacStacSuccess
                ? "flex items-start gap-4 rounded-md border border-emerald-300/40 bg-emerald-400/15 p-4 shadow-lg shadow-emerald-950/30"
                : "flex items-start gap-3 rounded-md border border-white/10 bg-zinc-950/60 p-4"
            }
          >
            <input
              checked={shouldPostPacStac}
              className={pacStacSuccess ? "sr-only" : "mt-1 h-4 w-4 accent-cyan-300"}
              disabled={isPosting}
              onChange={(event) => onPacStacChange(event.target.checked)}
              type="checkbox"
            />
            {pacStacSuccess ? (
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-300 text-3xl font-bold text-emerald-950"
              >
                ✓
              </span>
            ) : null}
            <span>
              <span
                className={
                  pacStacSuccess
                    ? "block text-base font-semibold text-emerald-50"
                    : "block text-sm font-semibold text-white"
                }
              >
                {pacStacSuccess ? "PacStac registration complete" : "PacStac"}
              </span>
              <span
                className={
                  pacStacSuccess
                    ? "mt-1 block text-sm leading-6 text-emerald-100"
                    : "mt-1 block text-sm leading-6 text-zinc-400"
                }
              >
                {pacStacSuccess ? (
                  <>
                    The signed proof is registered and ready for discovery.{" "}
                    <a
                      className="font-semibold text-emerald-50 underline decoration-emerald-200/60 underline-offset-4 transition hover:decoration-emerald-50"
                      href="https://pacstac.com/?utm_source=sonosig&utm_medium=create_post_modal&utm_campaign=audio_provenance"
                      rel="noreferrer"
                      target="_blank"
                    >
                      View on PacStac
                    </a>
                  </>
                ) : (
                  "Register the signed proof so agents and apps can discover the claim ID."
                )}
              </span>
            </span>
          </label>

          <label
            className={
              ensSuccess
                ? "flex items-start gap-4 rounded-md border border-emerald-300/40 bg-emerald-400/15 p-4 shadow-lg shadow-emerald-950/30"
                : "flex items-start gap-3 rounded-md border border-white/10 bg-zinc-950/60 p-4"
            }
          >
            <input
              checked={shouldPostEns}
              className={ensSuccess ? "sr-only" : "mt-1 h-4 w-4 accent-cyan-300"}
              disabled={isPosting}
              onChange={(event) => onEnsChange(event.target.checked)}
              type="checkbox"
            />
            {ensSuccess ? (
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-300 text-3xl font-bold text-emerald-950"
              >
                ✓
              </span>
            ) : null}
            <span>
              <span
                className={
                  ensSuccess
                    ? "block text-base font-semibold text-emerald-50"
                    : "block text-sm font-semibold text-white"
                }
              >
                {ensSuccess ? "ENS registration complete" : "ENS"}
              </span>
              <span
                className={
                  ensSuccess
                    ? "mt-1 block text-sm leading-6 text-emerald-100"
                    : "mt-1 block text-sm leading-6 text-zinc-400"
                }
              >
                {ensSuccess
                  ? "The ENS text record is updated on Ethereum mainnet."
                  : (
                      <>
                        Write the PacStac wallet collection pointer to the `com.sonosig` text record
                        {ensName.trim()
                          ? ` for ${ensName.trim()}.`
                          : ". Add an ENS name in settings before continuing."}
                      </>
                    )}
              </span>
              {shouldPostEns && !ensSuccess ? (
                <div className="mt-4 grid gap-3">
                  {ensOptions.length ? (
                    <select
                      className="w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-300"
                      disabled={isPosting}
                      onChange={(event) => {
                        onEnsNameChange(
                          event.target.value === "__manual__"
                            ? ""
                            : event.target.value,
                        );
                      }}
                      value={
                        ensOptions.includes(ensName.trim())
                          ? ensName.trim()
                          : "__manual__"
                      }
                    >
                      {ensOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="__manual__">Manual ENS name</option>
                    </select>
                  ) : null}
                  {isManualEnsSelected ? (
                    <input
                      className="w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300"
                      disabled={isPosting}
                      onChange={(event) => onEnsNameChange(event.target.value)}
                      placeholder={isEnsLoading ? "Loading ENS names..." : "name.eth"}
                      value={ensName}
                    />
                  ) : null}
                </div>
              ) : null}
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border border-white/10 bg-zinc-950/60 p-4">
            <input
              checked={shouldDownloadRegistration}
              className="mt-1 h-4 w-4 accent-cyan-300"
              disabled={isPosting}
              onChange={(event) =>
                onRegistrationDownloadChange(event.target.checked)
              }
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-white">
                Download Registration
              </span>
              <span className="mt-1 block text-sm leading-6 text-zinc-400">
                Save a local JSON receipt with the proof.
              </span>
            </span>
          </label>
        </div>

        {phaseLabel ? (
          <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/5 p-4">
            <p className="text-sm font-semibold text-cyan-100">{phaseLabel}</p>
            {phase === "submitted" ? (
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                SonoSig recorded the submitted transaction. Confirmation and failures are tracked on Transactions.
              </p>
            ) : null}
          </div>
        ) : null}

        {hash ? (
          <a
            className="mt-4 block break-all rounded-md border border-white/10 bg-black/35 px-3 py-3 font-mono text-xs text-cyan-100 transition hover:border-cyan-300/40"
            href={`https://etherscan.io/tx/${hash}`}
            rel="noreferrer"
            target="_blank"
          >
            {hash}
          </a>
        ) : null}

        {status ? (
          <p className="mt-5 text-sm leading-6 text-zinc-300">{status}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPosting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canContinue}
            onClick={onContinue}
            type="button"
          >
            {isPosting ? "Posting..." : isSelectedFlowComplete ? "Done" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
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

async function registerPacStacClaim(proof: ProofPayload) {
  const response = await fetch("/api/pacstac/sonosig/claims", {
    body: JSON.stringify({ proof }),
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

  return responseBody as PacStacRegistration;
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
  upsertPacStacRegistrationTransaction({
    claimId: registration.claimId,
    createdAt: registration.createdAt,
    idempotent: registration.idempotent,
    namespace: registration.namespace,
    proofAudioHash: proof.audio_hash,
    registrationStatus: registration.status,
    wallet: registration.wallet ?? proof.wallet,
  });
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

function getPostingStatusLabel(shouldPostPacStac: boolean, shouldPostEns: boolean) {
  if (shouldPostPacStac && shouldPostEns) {
    return "Registering with PacStac and ENS";
  }

  if (shouldPostEns) {
    return "Registering with ENS";
  }

  return "Registering with PacStac";
}

function buildPacStacWalletPointer(wallet: string | undefined) {
  if (!wallet || !isAddress(wallet)) {
    throw new Error("A valid EVM wallet address is required for the PacStac ENS collection pointer.");
  }

  return `pacstac:wallet:${wallet.toLowerCase()}`;
}

function downloadRegistrationInfo(
  proof: ProofPayload,
  registration: {
    ensName: string;
    ensTransactionHash: Hash | null;
    pacstacRegistration: PacStacRegistration | null;
    postedToEns: boolean;
    postedToPacStac: boolean;
  },
) {
  const body = {
    generatedAt: new Date().toISOString(),
    proof,
    registration,
  };
  const blob = new Blob([JSON.stringify(body, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName =
    proof.sourceFileName?.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-") ||
    "sonosig-proof";

  link.download = `${safeName}-registration.json`;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function storeSubmittedEnsTransaction({
  claimId,
  ensName,
  hash,
  proof,
}: {
  claimId?: string;
  ensName: string;
  hash: Hash;
  proof: ProofPayload;
}) {
  const now = new Date().toISOString();

  upsertWeb3Transaction({
    chainId: mainnet.id,
    claimId,
    createdAt: now,
    ensName,
    hash,
    id: createWeb3TransactionId(hash),
    network: "Ethereum mainnet",
    proofAudioHash: proof.audio_hash,
    status: "submitted",
    title: "ENS text record update",
    type: "ens-text-record",
    updatedAt: now,
    wallet: proof.wallet,
  });
}

async function monitorSubmittedEnsTransaction(
  client: MainnetReceiptClient,
  hash: Hash,
) {
  const transactionId = createWeb3TransactionId(hash);

  try {
    const receipt = await waitForMainnetReceipt(client, hash);

    if (receipt.status === "success") {
      updateWeb3Transaction(transactionId, { status: "confirmed" });
      trackEvent("create_post_ens_confirmed");
      return;
    }

    updateWeb3Transaction(transactionId, {
      error: "The ENS transaction was mined but reverted.",
      status: "failed",
    });
    trackEvent("create_post_ens_failed", { reason: "reverted" });
  } catch (error) {
    updateWeb3Transaction(transactionId, {
      error:
        error instanceof Error
          ? error.message
          : "Unable to confirm the ENS transaction.",
      status: "submitted",
    });
    trackEvent("create_post_ens_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
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

async function waitForMainnetReceipt(client: MainnetReceiptClient, hash: Hash) {
  const watchedReceipt = client
    .waitForTransactionReceipt({ hash })
    .catch(() => null);
  const polledReceipt = pollMainnetReceipt(client, hash);

  return await Promise.race([watchedReceipt, polledReceipt]).then(
    async (receipt) => receipt ?? polledReceipt,
  );
}

async function pollMainnetReceipt(client: MainnetReceiptClient, hash: Hash) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 300_000) {
    try {
      return await withTimeout(client.getTransactionReceipt({ hash }), 10_000);
    } catch {
      await delay(4_000);
    }
  }

  throw new Error(
    "SonoSig could not confirm the transaction receipt. Check Etherscan for the final status.",
  );
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Timed out waiting for the Ethereum RPC response."));
    }, milliseconds);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        window.clearTimeout(timer);
      });
  });
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function formatPostError(error: unknown) {
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
    : "Unable to post this proof.";
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

  return "Unable to post this proof.";
}

function truncateEnd(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
