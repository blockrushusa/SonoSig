"use client";

import { useMemo, useRef, useState } from "react";
import { verifyMessage, type Hex } from "viem";
import { useAccount, useSignMessage } from "wagmi";

const MAGIC = "SONOSIG1";
const HEADER_BYTES = MAGIC.length + 4;
const STATEMENT =
  "Create a Sonosig wallet-linked proof payload for this local audio file.";

type ProofPayload = {
  v: 1;
  address: `0x${string}`;
  chainId: number;
  domain: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  statement: string;
  signature: Hex;
};

type EncodedAudio = {
  blob: Blob;
  url: string;
  fileName: string;
  payload: ProofPayload;
};

type VerificationResult =
  | {
      status: "valid";
      payload: ProofPayload;
    }
  | {
      status: "invalid";
      reason: string;
      payload?: ProofPayload;
    };

export function CreateWatermarkStudio() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [encodedAudio, setEncodedAudio] = useState<EncodedAudio | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [status, setStatus] = useState("Connect a wallet and choose an audio file.");
  const [isEncoding, setIsEncoding] = useState(false);
  const outputUrlRef = useRef<string | null>(null);

  const canEncode = Boolean(isConnected && address && chainId && sourceFile);

  const privacyItems = useMemo(
    () => [
      "Audio files are decoded in this browser only.",
      "No waveform, stem, metadata, payload, or output file is uploaded.",
      "The exported file is generated locally as a downloadable WAV.",
    ],
    [],
  );

  async function handleEncode() {
    if (!sourceFile || !address || !chainId) {
      setStatus("Connect a wallet and select an audio file first.");
      return;
    }

    setIsEncoding(true);
    setVerification(null);
    setStatus("Preparing SIWE message...");

    try {
      const siweFields = createSiweFields(address, chainId);
      const message = buildSiweMessage(siweFields);
      const signature = await signMessageAsync({ message });
      const payload: ProofPayload = {
        v: 1,
        ...siweFields,
        signature,
      };

      setStatus("Decoding audio locally...");
      const audioBuffer = await decodeAudioFile(sourceFile);
      const payloadBytes = encodePayload(payload);
      const requiredSamples = payloadBytes.length * 8;
      const availableSamples = audioBuffer.length * audioBuffer.numberOfChannels;

      if (requiredSamples > availableSamples) {
        throw new Error(
          "The proof payload is too large for this audio file. Use a longer track.",
        );
      }

      setStatus("Embedding proof payload...");
      const wavBytes = encodeWatermarkedWav(audioBuffer, payloadBytes);
      const blob = new Blob([wavBytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      if (outputUrlRef.current) {
        URL.revokeObjectURL(outputUrlRef.current);
      }

      outputUrlRef.current = url;
      setEncodedAudio({
        blob,
        url,
        fileName: createOutputName(sourceFile.name),
        payload,
      });
      setStatus("Watermarked audio is ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Encoding failed.");
    } finally {
      setIsEncoding(false);
    }
  }

  async function handleVerify(file: File) {
    setVerification(null);
    setStatus("Reading watermark locally...");

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const payload = readPayloadFromWav(bytes);
      const isValid = await verifyMessage({
        address: payload.address,
        message: buildSiweMessage(payload),
        signature: payload.signature,
      });

      if (!isValid) {
        setVerification({
          status: "invalid",
          reason: "Watermark found, but the SIWE signature is invalid.",
          payload,
        });
        setStatus("Watermark signature failed.");
        return;
      }

      setVerification({ status: "valid", payload });
      setStatus("Watermark verified.");
    } catch (error) {
      setVerification({
        status: "invalid",
        reason:
          error instanceof Error ? error.message : "Unable to verify watermark.",
      });
      setStatus("No valid watermark found.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
          Create
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
          Link an audio file to your wallet.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
          Sign a SIWE message, embed the proof payload into a local audio file,
          export a watermarked WAV, and verify it in the browser.
        </p>

        <div className="mt-8 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-200">
              Local audio file
            </span>
            <input
              accept="audio/*"
              className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
              onChange={(event) => {
                setSourceFile(event.target.files?.[0] ?? null);
                setEncodedAudio(null);
                setVerification(null);
              }}
              type="file"
            />
          </label>

          <button
            className="w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEncode || isEncoding || isPending}
            onClick={handleEncode}
            type="button"
          >
            {isEncoding || isPending ? "Encoding..." : "Sign and Encode"}
          </button>

          <p className="text-sm leading-6 text-zinc-400">{status}</p>
        </div>

        {encodedAudio ? (
          <div className="mt-8 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-5">
            <h2 className="text-lg font-semibold text-white">
              Watermarked file
            </h2>
            <audio className="mt-4 w-full" controls src={encodedAudio.url} />
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
                download={encodedAudio.fileName}
                href={encodedAudio.url}
              >
                Download WAV
              </a>
              <button
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={() => void verifyEncodedAudio(encodedAudio, handleVerify)}
                type="button"
              >
                Verify Output
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="grid gap-6">
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">Client-side only</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-300">
            {privacyItems.map((item) => (
              <li className="flex gap-3" key={item}>
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">Verify a file</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Select a watermarked WAV and verify the embedded wallet signature.
          </p>
          <input
            accept="audio/wav,.wav"
            className="mt-4 w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleVerify(file);
              }
            }}
            type="file"
          />

          {verification ? (
            <div className="mt-5 rounded-md border border-white/10 bg-zinc-950 p-4">
              <p
                className={
                  verification.status === "valid"
                    ? "font-semibold text-cyan-200"
                    : "font-semibold text-red-300"
                }
              >
                {verification.status === "valid"
                  ? "Valid watermark"
                  : "Invalid watermark"}
              </p>
              {verification.status === "invalid" ? (
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {verification.reason}
                </p>
              ) : (
                <dl className="mt-3 grid gap-2 text-sm text-zinc-300">
                  <div>
                    <dt className="text-zinc-500">Wallet</dt>
                    <dd className="break-all">{verification.payload.address}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Issued</dt>
                    <dd>{verification.payload.issuedAt}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Chain ID</dt>
                    <dd>{verification.payload.chainId}</dd>
                  </div>
                </dl>
              )}
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

async function verifyEncodedAudio(
  encodedAudio: EncodedAudio,
  verify: (file: File) => Promise<void>,
) {
  await verify(
    new File([encodedAudio.blob], encodedAudio.fileName, { type: "audio/wav" }),
  );
}

function createSiweFields(address: `0x${string}`, chainId: number) {
  return {
    address,
    chainId,
    domain: window.location.host,
    uri: window.location.origin,
    nonce: createNonce(),
    issuedAt: new Date().toISOString(),
    statement: STATEMENT,
  };
}

function buildSiweMessage({
  address,
  chainId,
  domain,
  issuedAt,
  nonce,
  statement,
  uri,
}: Omit<ProofPayload, "v" | "signature">) {
  return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

function createNonce() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function decodeAudioFile(file: File) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();

  try {
    return await audioContext.decodeAudioData(await file.arrayBuffer());
  } finally {
    await audioContext.close();
  }
}

function encodePayload(payload: ProofPayload) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = new Uint8Array(HEADER_BYTES + payloadBytes.length);
  bytes.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(bytes.buffer).setUint32(MAGIC.length, payloadBytes.length, true);
  bytes.set(payloadBytes, HEADER_BYTES);
  return bytes;
}

function encodeWatermarkedWav(audioBuffer: AudioBuffer, payloadBytes: Uint8Array) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frames = audioBuffer.length;
  const pcm = new Int16Array(frames * channels);
  let bitIndex = 0;
  const totalBits = payloadBytes.length * 8;

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = audioBuffer.getChannelData(channel)[frame] ?? 0;
      let intSample = floatToInt16(sample);

      if (bitIndex < totalBits) {
        const bit = (payloadBytes[Math.floor(bitIndex / 8)] >> (bitIndex % 8)) & 1;
        intSample = (intSample & ~1) | bit;
        bitIndex += 1;
      }

      pcm[frame * channels + channel] = intSample;
    }
  }

  return writeWav(pcm, channels, sampleRate);
}

function readPayloadFromWav(bytes: Uint8Array): ProofPayload {
  const pcm = readWavPcm16(bytes);
  const header = readBytesFromPcm(pcm, HEADER_BYTES);
  const magic = new TextDecoder().decode(header.slice(0, MAGIC.length));

  if (magic !== MAGIC) {
    throw new Error("No Sonosig watermark header found.");
  }

  const payloadLength = new DataView(header.buffer, header.byteOffset).getUint32(
    MAGIC.length,
    true,
  );

  if (payloadLength <= 0 || payloadLength > 16_384) {
    throw new Error("Invalid Sonosig payload length.");
  }

  const payloadBytes = readBytesFromPcm(pcm, HEADER_BYTES + payloadLength).slice(
    HEADER_BYTES,
  );
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));

  if (!isProofPayload(payload)) {
    throw new Error("Invalid Sonosig proof payload.");
  }

  return payload;
}

function readBytesFromPcm(pcm: Int16Array, byteCount: number) {
  const bytes = new Uint8Array(byteCount);

  if (byteCount * 8 > pcm.length) {
    throw new Error("Audio file is too short to contain a Sonosig payload.");
  }

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    let value = 0;

    for (let bit = 0; bit < 8; bit += 1) {
      value |= (pcm[byteIndex * 8 + bit] & 1) << bit;
    }

    bytes[byteIndex] = value;
  }

  return bytes;
}

function readWavPcm16(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    throw new Error("Verification currently expects a WAV file.");
  }

  let offset = 12;
  let audioFormat = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkDataOffset, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    }

    if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataLength = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || !dataOffset) {
    throw new Error("Verification currently expects 16-bit PCM WAV audio.");
  }

  return new Int16Array(
    bytes.buffer.slice(
      bytes.byteOffset + dataOffset,
      bytes.byteOffset + dataOffset + dataLength,
    ),
  );
}

function writeWav(pcm: Int16Array, channels: number, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const output = new Uint8Array(buffer);

  writeAscii(output, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(output, 8, "WAVE");
  writeAscii(output, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(output, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(44 + index * bytesPerSample, pcm[index], true);
  }

  return output;
}

function floatToInt16(sample: number) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function isProofPayload(value: unknown): value is ProofPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<ProofPayload>;

  return (
    payload.v === 1 &&
    typeof payload.address === "string" &&
    payload.address.startsWith("0x") &&
    typeof payload.chainId === "number" &&
    typeof payload.domain === "string" &&
    typeof payload.uri === "string" &&
    typeof payload.nonce === "string" &&
    typeof payload.issuedAt === "string" &&
    typeof payload.statement === "string" &&
    typeof payload.signature === "string" &&
    payload.signature.startsWith("0x")
  );
}

function createOutputName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "audio"}-sonosig.wav`;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
