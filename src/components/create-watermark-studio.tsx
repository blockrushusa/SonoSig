"use client";

import { useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  OUTPUT_FORMATS,
  buildSiweMessage,
  createOutputName,
  createSiweFields,
  decodeAudioFile,
  encodePayload,
  encodeWatermarkedPcm,
  getOutputFormat,
  inferOutputFormat,
  writeAudioFile,
  type OutputFormat,
} from "@/lib/audio-watermark";

type EncodedAudio = {
  url: string;
  fileName: string;
  format: OutputFormat;
};

export function CreateWatermarkStudio() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("wav");
  const [encodedAudio, setEncodedAudio] = useState<EncodedAudio | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [status, setStatus] = useState("Connect a wallet and choose an audio file.");
  const [isEncoding, setIsEncoding] = useState(false);
  const outputUrlRef = useRef<string | null>(null);

  const canEncode = Boolean(isConnected && address && chainId && sourceFile);

  async function handleEncode() {
    if (!sourceFile || !address || !chainId) {
      setStatus("Connect a wallet and select an audio file first.");
      return;
    }

    setIsEncoding(true);
    setStatus("Preparing SIWE message...");

    try {
      const siweFields = createSiweFields(address, chainId);
      const message = buildSiweMessage(siweFields);
      const signature = await signMessageAsync({ message });
      const payload = {
        v: 1,
        ...siweFields,
        signature,
      } as const;

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
      const watermarked = encodeWatermarkedPcm(audioBuffer, payloadBytes);
      const outputBytes = writeAudioFile(watermarked, outputFormat);
      const blob = new Blob([outputBytes], {
        type: getOutputFormat(outputFormat).mimeType,
      });
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
      setIsEncoding(false);
    }
  }

  return (
    <div>
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Create
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Link an audio file to your wallet.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
              Sign a SIWE message, embed the proof payload into a local audio
              file, and export a watermarked file in the browser.
            </p>
          </div>
          <button
            className="w-fit rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
            onClick={() => setIsHelpOpen(true)}
            type="button"
          >
            Help
          </button>
        </div>

        <div className="mt-8 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-200">
              Local audio file
            </span>
            <input
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

          <label className="grid max-w-xs gap-2">
            <span className="text-sm font-medium text-zinc-200">
              Download format
            </span>
            <select
              className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
              onChange={(event) => {
                setOutputFormat(event.target.value as OutputFormat);
                setEncodedAudio(null);
              }}
              value={outputFormat}
            >
              {OUTPUT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
            <span className="text-xs leading-5 text-zinc-500">
              Defaults to the uploaded file format when it is WAV or AIFF. Lossy
              formats are not exported yet.
            </span>
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
                Download {getOutputFormat(encodedAudio.format).label}
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
                  Client-side only
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
