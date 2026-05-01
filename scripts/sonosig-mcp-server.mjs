#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
} from "viem";
import { namehash, normalize } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { scanWebsite } from "./sonosig-website-scanner.mjs";

const MAGIC = "SONOSIG1";
const HEADER_BYTES = MAGIC.length + 4;
const PROTOCOL = "audio-proof-v1";
const VERIFIED_BY = "SonoSig.com";
const SONOSIG_ENS_RECORD_KEY = "com.sonosig";
const DEFAULT_PACSTAC_CLAIMS_URL =
  "https://pacstac.com/api/v1/namespaces/sonosig/claims";
const DEFAULT_ENS_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/ensdomains/ens";

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
];

await loadLocalEnv();

const server = new McpServer({
  name: "sonosig",
  version: "0.1.0",
});

server.registerTool(
  "sonosig_encode_file",
  {
    description:
      "Embed an already-signed SonoSig proof payload into an audio file by appending a SONOSIG1 proof block. This does not sign wallet messages.",
    inputSchema: {
      inputPath: z.string().describe("Path to the source audio file."),
      outputPath: z
        .string()
        .optional()
        .describe("Path to write the encoded file. Defaults to *-sonosig.ext."),
      proof: z
        .unknown()
        .optional()
        .describe("Signed SonoSig proof payload object."),
      proofPath: z
        .string()
        .optional()
        .describe("Path to a JSON file containing the signed proof payload."),
    },
  },
  async ({ inputPath, outputPath, proof, proofPath }) => {
    const payload = await loadProof({ proof, proofPath });
    const inputBytes = await readFile(inputPath);
    const proofBytes = encodeProofPayload(payload);
    const targetPath = outputPath ?? createOutputPath(inputPath);
    const outputBytes = Buffer.concat([inputBytes, Buffer.from(proofBytes)]);

    await writeFile(targetPath, outputBytes);

    return jsonToolResult({
      outputPath: targetPath,
      proofBytes: proofBytes.length,
      sourceBytes: inputBytes.length,
      totalBytes: outputBytes.length,
    });
  },
);

server.registerTool(
  "sonosig_verify_file",
  {
    description:
      "Read and validate an embedded SonoSig proof from a watermarked audio file. WAV/AIFF files also get an audio hash comparison.",
    inputSchema: {
      inputPath: z.string().describe("Path to a SonoSig encoded audio file."),
    },
  },
  async ({ inputPath }) => {
    const bytes = new Uint8Array(await readFile(inputPath));
    const proof = readProofFromAudio(bytes);
    const hashes = await tryCreateWatermarkedAudioProofHashes(bytes);

    return jsonToolResult({
      audioHashStatus:
        hashes.audio_hash && proof.audio_hash === hashes.audio_hash
          ? "verified"
          : hashes.audio_hash
            ? "changed_after_encoding"
            : "not_checked",
      computed: hashes,
      proof,
    });
  },
);

server.registerTool(
  "sonosig_submit_pacstac",
  {
    description:
      "Register a signed SonoSig proof with PacStac using PACSTAC_API_KEY from the MCP server environment.",
    inputSchema: {
      inputPath: z
        .string()
        .optional()
        .describe("Optional encoded audio file path to read the proof from."),
      origin: z
        .string()
        .optional()
        .describe("Origin to report to PacStac. Defaults to https://sonosig.com."),
      proof: z.unknown().optional().describe("Signed SonoSig proof payload."),
      proofPath: z
        .string()
        .optional()
        .describe("Path to a JSON file containing the signed proof payload."),
    },
  },
  async ({ inputPath, origin, proof, proofPath }) => {
    const payload = inputPath
      ? readProofFromAudio(new Uint8Array(await readFile(inputPath)))
      : await loadProof({ proof, proofPath });
    const response = await submitPacStacClaim(payload, origin);

    return jsonToolResult(response);
  },
);

server.registerTool(
  "sonosig_prepare_ens_record",
  {
    description:
      "Build the compact ENS text record SonoSig uses: com.sonosig = {v, latest}.",
    inputSchema: {
      claimId: z
        .string()
        .optional()
        .describe("PacStac claim ID, e.g. sonosig:sha256:<hash>."),
      inputPath: z
        .string()
        .optional()
        .describe("Optional encoded audio file path to read a stored claim ID from."),
      proof: z.unknown().optional().describe("Optional proof payload."),
      proofPath: z
        .string()
        .optional()
        .describe("Optional proof JSON path."),
    },
  },
  async ({ claimId, inputPath, proof, proofPath }) => {
    const latest = await resolveClaimId({ claimId, inputPath, proof, proofPath });

    return jsonToolResult({
      key: SONOSIG_ENS_RECORD_KEY,
      value: JSON.stringify({ v: 1, latest }),
    });
  },
);

server.registerTool(
  "sonosig_submit_ens",
  {
    description:
      "Write the SonoSig ENS text record. Requires EVM_MULTI_CHAIN_RPC_URL or ETHEREUM_RPC_URL plus SONOSIG_ENS_PRIVATE_KEY or BASE_X402_WALLET_PRIVATE_KEY in the MCP server environment, and confirm=true.",
    inputSchema: {
      claimId: z
        .string()
        .optional()
        .describe("PacStac claim ID, e.g. sonosig:sha256:<hash>."),
      confirm: z
        .boolean()
        .describe("Must be true to send an onchain ENS transaction."),
      ensName: z.string().describe("ENS name to update."),
      inputPath: z
        .string()
        .optional()
        .describe("Optional encoded audio file path to read a stored claim ID from."),
      proof: z.unknown().optional().describe("Optional proof payload."),
      proofPath: z
        .string()
        .optional()
        .describe("Optional proof JSON path."),
    },
  },
  async ({ claimId, confirm, ensName, inputPath, proof, proofPath }) => {
    if (!confirm) {
      throw new Error("confirm=true is required before sending an ENS transaction.");
    }

    const latest = await resolveClaimId({ claimId, inputPath, proof, proofPath });
    const value = JSON.stringify({ v: 1, latest });
    const result = await submitEnsRecord({ ensName, value });

    return jsonToolResult({
      ...result,
      key: SONOSIG_ENS_RECORD_KEY,
      value,
    });
  },
);

server.registerTool(
  "sonosig_scan_website",
  {
    description:
      "Scan a public website for audio files and report which files contain SonoSig proofs. Supports crawl limits, robots.txt, optional headless discovery, PacStac/ENS enrichment, and JSON/Markdown summaries.",
    inputSchema: {
      allowPrivateHosts: z
        .boolean()
        .optional()
        .describe("Allow localhost/private IP scan targets. Defaults to false."),
      allowedDomains: z
        .array(z.string())
        .optional()
        .describe("Additional domains allowed for page crawling."),
      followExternalPageLinks: z
        .boolean()
        .optional()
        .describe("Allow crawling page links on allowedDomains."),
      headless: z
        .boolean()
        .optional()
        .describe("Try Playwright-based JS discovery when Playwright is installed."),
      includeExternalAudio: z
        .boolean()
        .optional()
        .describe("Allow CDN/external audio discovered from allowed pages."),
      keepDownloads: z
        .boolean()
        .optional()
        .describe("Keep temporary audio downloads after the scan."),
      maxAudioBytes: z
        .number()
        .optional()
        .describe("Maximum audio download size in bytes."),
      maxDepth: z.number().optional().describe("Maximum crawl depth."),
      maxPages: z.number().optional().describe("Maximum pages to scan."),
      rateLimitMs: z.number().optional().describe("Delay between page requests."),
      respectRobots: z
        .boolean()
        .optional()
        .describe("Respect robots.txt. Defaults to true."),
      scanScope: z
        .enum(["auto", "page", "site"])
        .optional()
        .describe(
          "auto scans root URLs as sites and specific page URLs as a single page. Use page or site to force behavior.",
        ),
      url: z.string().describe("Root website URL to scan."),
    },
  },
  async (input) => {
    const report = await scanWebsite(input);

    return jsonToolResult({
      advancedDiscovery: report.advancedDiscovery,
      errors: report.errors,
      markdown: report.markdown,
      results: report.results,
      rootUrl: report.rootUrl,
      scanId: report.scanId,
      summary: report.summary,
    });
  },
);

async function loadProof({ proof, proofPath }) {
  if (proof) {
    return validateProofPayload(proof);
  }

  if (proofPath) {
    return validateProofPayload(JSON.parse(await readFile(proofPath, "utf8")));
  }

  throw new Error("Provide proof or proofPath.");
}

function validateProofPayload(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Proof payload must be an object.");
  }

  const proof = value;
  const requiredStrings = [
    "protocol",
    "wallet",
    "audio_fingerprint",
    "audio_hash",
    "issued_at",
    "nonce",
    "signature_type",
    "address",
    "domain",
    "uri",
    "issuedAt",
    "statement",
    "audioFingerprint",
    "signature",
  ];

  for (const key of requiredStrings) {
    if (typeof proof[key] !== "string") {
      throw new Error(`Proof payload is missing string field ${key}.`);
    }
  }

  if (proof.v !== 1 || proof.protocol !== PROTOCOL) {
    throw new Error("Proof payload must be SonoSig audio-proof-v1.");
  }

  if (!isAddress(proof.wallet) || !isAddress(proof.address)) {
    throw new Error("Proof wallet/address must be valid EVM addresses.");
  }

  if (!isSha256(proof.audio_hash)) {
    throw new Error("Proof audio_hash must be sha256:<64 hex chars>.");
  }

  if (!isSha256(proof.audio_fingerprint)) {
    throw new Error("Proof audio_fingerprint must be sha256:<64 hex chars>.");
  }

  if (!Number.isInteger(proof.chain_id) || !Number.isInteger(proof.chainId)) {
    throw new Error("Proof chain_id and chainId must be integers.");
  }

  return proof;
}

function encodeProofPayload(payload) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = new Uint8Array(HEADER_BYTES + payloadBytes.length);
  bytes.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(bytes.buffer).setUint32(MAGIC.length, payloadBytes.length, true);
  bytes.set(payloadBytes, HEADER_BYTES);
  return bytes;
}

function readProofFromAudio(bytes) {
  try {
    return readProofFromPcm(readPcm16Audio(bytes).pcm);
  } catch (error) {
    const taggedPayload = readProofFromTaggedBytes(bytes);

    if (taggedPayload) {
      return taggedPayload;
    }

    throw error;
  }
}

function readProofFromPcm(pcm) {
  const header = readBytesFromPcm(pcm, HEADER_BYTES);
  const magic = new TextDecoder().decode(header.slice(0, MAGIC.length));

  if (magic !== MAGIC) {
    throw new Error("No SonoSig watermark header found.");
  }

  const payloadLength = new DataView(
    header.buffer,
    header.byteOffset,
  ).getUint32(MAGIC.length, true);

  if (payloadLength <= 0 || payloadLength > 16_384) {
    throw new Error("Invalid SonoSig payload length.");
  }

  const payloadBytes = readBytesFromPcm(pcm, HEADER_BYTES + payloadLength).slice(
    HEADER_BYTES,
  );

  return validateProofPayload(JSON.parse(new TextDecoder().decode(payloadBytes)));
}

function readBytesFromPcm(pcm, byteCount) {
  const bytes = new Uint8Array(byteCount);

  if (byteCount * 8 > pcm.length) {
    throw new Error("Audio file is too short to contain a SonoSig payload.");
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

function readProofFromTaggedBytes(bytes) {
  for (let offset = bytes.length - HEADER_BYTES; offset >= 0; offset -= 1) {
    if (readAscii(bytes, offset, MAGIC.length) !== MAGIC) {
      continue;
    }

    const payloadLength = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset,
    ).getUint32(MAGIC.length, true);
    const payloadStart = offset + HEADER_BYTES;
    const payloadEnd = payloadStart + payloadLength;

    if (payloadLength <= 0 || payloadLength > 16_384 || payloadEnd > bytes.length) {
      continue;
    }

    try {
      return validateProofPayload(
        JSON.parse(new TextDecoder().decode(bytes.slice(payloadStart, payloadEnd))),
      );
    } catch {
      continue;
    }
  }

  return null;
}

async function submitPacStacClaim(proof, origin = "https://sonosig.com") {
  const apiKey = process.env.PACSTAC_API_KEY;

  if (!apiKey) {
    throw new Error("PACSTAC_API_KEY is not configured.");
  }

  const payload = toPacStacPayload(proof);
  const siweMessage = buildSiweMessage(proof);
  const claimsUrl =
    process.env.PACSTAC_SONOSIG_CLAIMS_URL ?? DEFAULT_PACSTAC_CLAIMS_URL;
  const response = await fetch(claimsUrl, {
    body: JSON.stringify({
      payload,
      siweMessage,
      source: {
        app: "sonosig-mcp",
        origin,
      },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const responseText = await response.text();
  const body = responseText ? safeJsonParse(responseText) : null;

  if (!response.ok) {
    throw new Error(
      `PacStac claim registration failed (${response.status}): ${JSON.stringify(
        body,
      )}`,
    );
  }

  return body;
}

function toPacStacPayload(proof) {
  const payload = {
    v: 1,
    protocol: proof.protocol,
    wallet: proof.wallet,
    chain_id: proof.chain_id,
    audio_hash: proof.audio_hash,
    audio_fingerprint: isSha256(proof.audio_fingerprint)
      ? proof.audio_fingerprint
      : proof.audio_hash,
    issued_at: proof.issued_at,
    nonce: proof.nonce,
    signature_type: proof.signature_type,
    signature: proof.signature,
  };
  const ens = stringOrEmpty(proof.ens);
  const manifest = stringOrEmpty(proof.manifest);
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

function toPacStacSong(song) {
  if (!song || typeof song !== "object") {
    return undefined;
  }

  const result = {
    album: stringOrEmpty(song.album),
    artist: stringOrEmpty(song.artist),
    isrc: stringOrEmpty(song.isrc),
    title: stringOrEmpty(song.title),
  };
  const entries = Object.entries(result).filter(([, value]) => value);

  return entries.length ? Object.fromEntries(entries) : undefined;
}

async function submitEnsRecord({ ensName, value }) {
  const privateKey =
    process.env.SONOSIG_ENS_PRIVATE_KEY ??
    process.env.BASE_X402_WALLET_PRIVATE_KEY;
  const expectedPublicKey = process.env.BASE_X402_WALLET_PUBLIC_KEY;
  const rpcUrl =
    process.env.EVM_MULTI_CHAIN_RPC_URL ?? process.env.ETHEREUM_RPC_URL;

  if (!privateKey) {
    throw new Error(
      "SONOSIG_ENS_PRIVATE_KEY or BASE_X402_WALLET_PRIVATE_KEY is not configured.",
    );
  }

  if (!rpcUrl) {
    throw new Error(
      "EVM_MULTI_CHAIN_RPC_URL or ETHEREUM_RPC_URL is not configured.",
    );
  }

  const normalizedName = normalize(ensName);
  const resolver = await getEnsResolver(normalizedName);

  if (!resolver) {
    throw new Error("This ENS name has no resolver configured.");
  }

  const account = privateKeyToAccount(privateKey);

  if (
    expectedPublicKey &&
    expectedPublicKey.toLowerCase() !== account.address.toLowerCase()
  ) {
    throw new Error(
      "BASE_X402_WALLET_PUBLIC_KEY does not match the configured private key.",
    );
  }

  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });
  const hash = await walletClient.writeContract({
    abi: ENS_TEXT_ABI,
    address: resolver,
    args: [namehash(normalizedName), SONOSIG_ENS_RECORD_KEY, value],
    functionName: "setText",
  });
  let receipt = null;

  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } catch {
    // Returning the transaction hash is still useful if receipt polling fails.
  }

  return {
    ensName: normalizedName,
    hash,
    receiptStatus: receipt?.status ?? "submitted",
    resolver,
  };
}

async function getEnsResolver(name) {
  const query = `
    query SonoSigEnsResolver($name: String!) {
      domains(first: 1, where: { name: $name }) {
        resolver {
          address
        }
      }
    }
  `;
  const response = await fetch(
    process.env.ENS_SUBGRAPH_URL ?? DEFAULT_ENS_SUBGRAPH_URL,
    {
      body: JSON.stringify({ query, variables: { name } }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`ENS resolver lookup failed (${response.status}).`);
  }

  const result = await response.json();
  const resolver = result?.data?.domains?.[0]?.resolver?.address;

  return resolver && isAddress(resolver) ? resolver : null;
}

async function resolveClaimId({ claimId, inputPath, proof, proofPath }) {
  if (claimId) {
    return claimId;
  }

  const payload = inputPath
    ? readProofFromAudio(new Uint8Array(await readFile(inputPath)))
    : await loadProof({ proof, proofPath });

  if (typeof payload.pacstacClaimId === "string") {
    return payload.pacstacClaimId;
  }

  throw new Error(
    "Provide claimId. SonoSig proofs do not contain a PacStac claim ID by default.",
  );
}

async function tryCreateWatermarkedAudioProofHashes(bytes) {
  try {
    const audio = readPcm16Audio(bytes);
    readProofFromPcm(audio.pcm);
    const audio_hash = await hashPcmFingerprint(audio);

    return {
      audio_fingerprint: audio_hash,
      audio_hash,
    };
  } catch {
    return {};
  }
}

function readPcm16Audio(bytes) {
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
    return readWavPcm16(bytes);
  }

  if (readAscii(bytes, 0, 4) === "FORM" && readAscii(bytes, 8, 4) === "AIFF") {
    return readAiffPcm16(bytes);
  }

  throw new Error("Verification currently expects a WAV or AIFF file.");
}

function readWavPcm16(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let audioFormat = 0;
  let bitsPerSample = 0;
  let channels = 0;
  let sampleRate = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
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

  return {
    channels,
    pcm: new Int16Array(
      bytes.buffer.slice(
        bytes.byteOffset + dataOffset,
        bytes.byteOffset + dataOffset + dataLength,
      ),
    ),
    sampleRate,
  };
}

function readAiffPcm16(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, false);
    const chunkDataOffset = offset + 8;

    if (chunkId === "COMM") {
      channels = view.getUint16(chunkDataOffset, false);
      bitsPerSample = view.getUint16(chunkDataOffset + 6, false);
      sampleRate = readExtended80(bytes, chunkDataOffset + 8);
    }

    if (chunkId === "SSND") {
      const soundOffset = view.getUint32(chunkDataOffset, false);
      dataOffset = chunkDataOffset + 8 + soundOffset;
      dataLength = chunkSize - 8 - soundOffset;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (bitsPerSample !== 16 || !dataOffset) {
    throw new Error("Verification currently expects 16-bit PCM AIFF audio.");
  }

  const pcm = new Int16Array(dataLength / 2);

  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = view.getInt16(dataOffset + index * 2, false);
  }

  return { channels, pcm, sampleRate };
}

function audioBufferToBytes(audio) {
  const buffer = new ArrayBuffer(audio.pcm.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < audio.pcm.length; index += 1) {
    view.setInt16(index * 2, audio.pcm[index], true);
  }

  return new Uint8Array(buffer);
}

async function hashPcmFingerprint(audio) {
  const hash = createHash("sha256");
  const header = Buffer.alloc(8);

  header.writeUInt32LE(audio.sampleRate, 0);
  header.writeUInt16LE(audio.channels, 4);
  header.writeUInt16LE(16, 6);
  hash.update(header);
  hash.update(audioBufferToBytes(audio));

  return `sha256:${hash.digest("hex")}`;
}

function buildSiweMessage(proof) {
  const signingAddress = proof.wallet ?? proof.address;
  const signingChainId = proof.chain_id ?? proof.chainId;
  const signingIssuedAt = proof.issued_at ?? proof.issuedAt;
  const signingAudioFingerprint =
    proof.audio_fingerprint ?? proof.audioFingerprint;
  const chainLine = proof.chain ? `\nChain: ${proof.chain}` : "";
  const ensLine = proof.ens ? `\nENS: ${proof.ens}` : "";
  const manifestLine = proof.manifest ? `\nManifest: ${proof.manifest}` : "";
  const songLine = proof.song
    ? `\nSong: ${[
        proof.song.title,
        proof.song.artist,
        proof.song.album,
        proof.song.albumArtist,
        proof.song.composer,
        proof.song.genre,
        proof.song.releaseDate,
        proof.song.year,
        proof.song.trackNumber,
        proof.song.discNumber,
        proof.song.isrc,
        proof.song.bpm,
        proof.song.key,
        proof.song.publisher,
        proof.song.copyright,
        proof.song.notes,
      ]
        .filter(Boolean)
        .join(" | ")}`
    : "";
  const verifiedByLine = proof.verifiedBy
    ? `\nVerified By: ${proof.verifiedBy}`
    : `\nVerified By: ${VERIFIED_BY}`;

  return `${proof.domain} wants you to sign in with your Ethereum account:
${signingAddress}

${proof.statement}${chainLine}${ensLine}${songLine}${manifestLine}${verifiedByLine}

URI: ${proof.uri}
Version: 1
Chain ID: ${signingChainId}
Protocol: ${PROTOCOL}
Wallet: ${signingAddress}
Audio Fingerprint: ${signingAudioFingerprint}
Audio Hash: ${proof.audio_hash}
Purpose: ${proof.statement}
Signature Type: ${proof.signature_type}
Nonce: ${proof.nonce}
Issued At: ${signingIssuedAt}`;
}

function createOutputPath(inputPath) {
  return inputPath.replace(/(\.[^./\\]+)?$/, (extension) => {
    return `-sonosig${extension || ".audio"}`;
  });
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[a-fA-F0-9]{64}$/.test(value);
}

function jsonToolResult(value) {
  return {
    content: [{ text: JSON.stringify(value, null, 2), type: "text" }],
    structuredContent: value,
  };
}

function readAscii(bytes, offset, length) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

function readExtended80(bytes, offset) {
  const sign = bytes[offset] & 0x80 ? -1 : 1;
  const exponent = (((bytes[offset] & 0x7f) << 8) | bytes[offset + 1]) - 16383;
  let mantissa = 0;

  for (let index = 0; index < 8; index += 1) {
    mantissa = mantissa * 256 + bytes[offset + 2 + index];
  }

  return Math.round(sign * mantissa * 2 ** (exponent - 63));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { message: value };
  }
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadLocalEnv() {
  for (const path of [".env.local", ".evm.local", ".env"]) {
    if (!existsSync(path)) {
      continue;
    }

    const text = await readFile(path, "utf8");

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());

      if (!key || process.env[key]) {
        continue;
      }

      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("SonoSig MCP server running on stdio");
