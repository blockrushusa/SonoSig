import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { buildSiweMessage, type ProofPayload } from "@/lib/audio-watermark";
import { getAdminApiConfig, type PacStacApiMode } from "@/lib/admin-api-config";
import { getPrivateKeyFromEnv } from "@/lib/admin-wallet-status";

export const runtime = "nodejs";

type PacStacSong = {
  album?: string;
  artist?: string;
  isrc?: string;
  title?: string;
};

type PacStacClaimPayload = {
  v: 1;
  protocol: "audio-proof-v1";
  wallet: `0x${string}`;
  chain_id: number;
  audio_hash: string;
  audio_fingerprint: string;
  issued_at: string;
  nonce: string;
  signature_type: "SIWE";
  signature: `0x${string}`;
  ens?: string;
  manifest?: string;
  song?: PacStacSong;
};

type RegisterClaimBody = {
  proof?: ProofPayload;
};

type PacStacRequestBody = {
  payload: PacStacClaimPayload;
  siweMessage: string;
  source: {
    app: "sonosig";
    origin: string;
  };
};

const PACSTAC_CLAIMS_URL =
  process.env.PACSTAC_SONOSIG_CLAIMS_URL ??
  "https://pacstac.com/api/v1/namespaces/sonosig/claims";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isHexAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isHexSignature(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value);
}

function isSha256(value: unknown) {
  return typeof value === "string" && /^sha256:[a-fA-F0-9]{64}$/.test(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPacStacSong(song: ProofPayload["song"]) {
  if (!song) {
    return undefined;
  }

  const pacstacSong = {
    album: nonEmptyString(song.album),
    artist: nonEmptyString(song.artist),
    isrc: nonEmptyString(song.isrc),
    title: nonEmptyString(song.title),
  };
  const entries = Object.entries(pacstacSong).filter(([, value]) => value);

  return entries.length
    ? (Object.fromEntries(entries) as PacStacSong)
    : undefined;
}

function toPacStacPayload(proof: ProofPayload): PacStacClaimPayload {
  if (proof.v !== 1) {
    throw new Error("Proof version must be 1.");
  }

  if (proof.protocol !== "audio-proof-v1") {
    throw new Error("Proof protocol must be audio-proof-v1.");
  }

  if (proof.signature_type !== "SIWE") {
    throw new Error("Proof signature type must be SIWE.");
  }

  if (!isHexAddress(proof.wallet)) {
    throw new Error("Proof wallet must be a valid EVM address.");
  }

  if (!Number.isInteger(proof.chain_id)) {
    throw new Error("Proof chain_id must be an integer.");
  }

  if (!isSha256(proof.audio_hash)) {
    throw new Error("Proof audio_hash must be sha256:<64 hex chars>.");
  }

  const audioFingerprint = isSha256(proof.audio_fingerprint)
    ? proof.audio_fingerprint
    : isSha256(proof.audioFingerprint)
      ? proof.audioFingerprint
      : proof.audio_hash;

  if (!isSha256(audioFingerprint)) {
    throw new Error("Proof audio_fingerprint must be sha256:<64 hex chars>.");
  }

  if (!nonEmptyString(proof.issued_at)) {
    throw new Error("Proof issued_at is required.");
  }

  if (!nonEmptyString(proof.nonce)) {
    throw new Error("Proof nonce is required.");
  }

  if (!isHexSignature(proof.signature)) {
    throw new Error("Proof signature must be a hex signature.");
  }

  const payload: PacStacClaimPayload = {
    v: 1,
    protocol: proof.protocol,
    wallet: proof.wallet,
    chain_id: proof.chain_id,
    audio_hash: proof.audio_hash,
    audio_fingerprint: audioFingerprint,
    issued_at: proof.issued_at,
    nonce: proof.nonce,
    signature_type: proof.signature_type,
    signature: proof.signature,
  };
  const ens = nonEmptyString(proof.ens);
  const manifest = nonEmptyString(proof.manifest);
  const song = toPacStacSong(proof.song);

  if (ens) {
    payload.ens = ens;
  }

  if (manifest) {
    payload.manifest = manifest;
  }

  if (song) {
    payload.song = song;
  }

  return payload;
}

export async function POST(request: Request) {
  let body: RegisterClaimBody;

  try {
    body = (await request.json()) as RegisterClaimBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.proof) {
    return jsonError("Missing proof.", 400);
  }

  let payload: PacStacClaimPayload;
  let siweMessage: string;

  try {
    payload = toPacStacPayload(body.proof);
    siweMessage = buildSiweMessage(body.proof);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid proof.",
      400,
    );
  }

  const origin = new URL(request.url).origin;
  const requestBody: PacStacRequestBody = {
    payload,
    siweMessage,
    source: {
      app: "sonosig",
      origin,
    },
  };

  let pacstacResponse: Response;

  try {
    const config = await getAdminApiConfig();
    pacstacResponse = await postPacStacClaim(
      config.pacstacApiMode,
      requestBody,
    );
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "PacStac API mode is not configured.",
      500,
    );
  }

  const responseText = await pacstacResponse.text();
  let responseBody: unknown = null;

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = { message: responseText };
    }
  }

  if (!pacstacResponse.ok) {
    return Response.json(
      {
        error: "PacStac claim registration failed.",
        pacstac: responseBody,
      },
      { status: pacstacResponse.status },
    );
  }

  return Response.json(responseBody);
}

async function postPacStacClaim(
  apiMode: PacStacApiMode,
  body: PacStacRequestBody,
) {
  if (apiMode === "x402") {
    return await postPacStacClaimWithX402(body);
  }

  return await postPacStacClaimWithApiKey(body);
}

async function postPacStacClaimWithApiKey(body: PacStacRequestBody) {
  const apiKey = process.env.PACSTAC_API_KEY;

  if (!apiKey) {
    throw new Error("PACSTAC_API_KEY is not configured.");
  }

  return await fetch(PACSTAC_CLAIMS_URL, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function postPacStacClaimWithX402(body: PacStacRequestBody) {
  const privateKey = getPrivateKeyFromEnv("BASE_X402_WALLET_PRIVATE_KEY");

  if (!privateKey) {
    throw new Error("BASE_X402_WALLET_PRIVATE_KEY is not configured.");
  }

  const account = privateKeyToAccount(privateKey);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        client: new ExactEvmScheme(account),
        network: "eip155:8453",
      },
    ],
  });

  return await fetchWithPayment(PACSTAC_CLAIMS_URL, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "X-SonoSig-PacStac-Mode": "x402",
    },
    method: "POST",
  });
}
