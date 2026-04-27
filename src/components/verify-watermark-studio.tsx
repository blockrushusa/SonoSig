"use client";

import { useState } from "react";
import { verifyMessage } from "viem";
import {
  buildSiweMessage,
  createWatermarkedAudioFingerprint,
  getChainName,
  readPayloadFromAudio,
  type ProofPayload,
} from "@/lib/audio-watermark";

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

export function VerifyWatermarkStudio() {
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [status, setStatus] = useState("Select a watermarked audio file.");
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleVerify(file: File) {
    setVerification(null);
    setIsVerifying(true);
    setStatus("Reading watermark locally...");

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const payload = readPayloadFromAudio(bytes);
      const audioFingerprint = await createWatermarkedAudioFingerprint(bytes);

      if (audioFingerprint !== payload.audioFingerprint) {
        setVerification({
          status: "invalid",
          reason: "Watermark found, but the audio fingerprint does not match.",
          payload,
        });
        setStatus("Audio fingerprint failed.");
        return;
      }

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
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
        Verify
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
        Verify a file.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
        Select a watermarked WAV or AIFF and verify the embedded wallet
        signature and audio fingerprint locally in the browser.
      </p>

      <div className="mt-8 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-zinc-200">
            Watermarked audio file
          </span>
          <input
            accept="audio/wav,audio/aiff,.wav,.aif,.aiff"
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
              ? "Valid watermark"
              : "Invalid watermark"}
          </p>
          {verification.status === "invalid" ? (
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {verification.reason}
            </p>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm text-zinc-300">
              <div>
                <dt className="text-zinc-500">Wallet</dt>
                <dd className="break-all">{verification.payload.address}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Issued</dt>
                <dd>{verification.payload.issuedAt}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Chain</dt>
                <dd>
                  {verification.payload.chain ??
                    getChainName(verification.payload.chainId)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Chain ID</dt>
                <dd>{verification.payload.chainId}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Verified by</dt>
                <dd>{verification.payload.verifiedBy ?? "SonoSig.com"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Audio fingerprint</dt>
                <dd className="break-all font-mono">
                  {verification.payload.audioFingerprint}
                </dd>
              </div>
            </dl>
          )}
        </div>
      ) : null}
    </section>
  );
}
