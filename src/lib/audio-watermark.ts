import type { Hex } from "viem";

const MAGIC = "SONOSIG1";
const HEADER_BYTES = MAGIC.length + 4;

export const STATEMENT =
  "Create a Sonosig wallet-linked proof payload for this local audio file.";

export type OutputFormat = "wav" | "aiff";

export const OUTPUT_FORMATS: Array<{
  value: OutputFormat;
  label: string;
  mimeType: string;
}> = [
  { value: "wav", label: "WAV", mimeType: "audio/wav" },
  { value: "aiff", label: "AIFF", mimeType: "audio/aiff" },
];

export type ProofPayload = {
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

export function createSiweFields(address: `0x${string}`, chainId: number) {
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

export function buildSiweMessage({
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

export async function decodeAudioFile(file: File) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();

  try {
    return await audioContext.decodeAudioData(await file.arrayBuffer());
  } finally {
    await audioContext.close();
  }
}

export function encodePayload(payload: ProofPayload) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = new Uint8Array(HEADER_BYTES + payloadBytes.length);
  bytes.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(bytes.buffer).setUint32(MAGIC.length, payloadBytes.length, true);
  bytes.set(payloadBytes, HEADER_BYTES);
  return bytes;
}

export function encodeWatermarkedPcm(
  audioBuffer: AudioBuffer,
  payloadBytes: Uint8Array,
) {
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

  return { pcm, channels, sampleRate };
}

export function readPayloadFromAudio(bytes: Uint8Array): ProofPayload {
  const pcm = readPcm16Audio(bytes);
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

export function writeAudioFile(
  audio: { pcm: Int16Array; channels: number; sampleRate: number },
  format: OutputFormat,
) {
  if (format === "aiff") {
    return writeAiff(audio.pcm, audio.channels, audio.sampleRate);
  }

  return writeWav(audio.pcm, audio.channels, audio.sampleRate);
}

export function getOutputFormat(format: OutputFormat) {
  return OUTPUT_FORMATS.find((item) => item.value === format) ?? OUTPUT_FORMATS[0];
}

export function inferOutputFormat(file: File | null): OutputFormat {
  const extension = file?.name.split(".").pop()?.toLowerCase();

  if (extension === "aif" || extension === "aiff") {
    return "aiff";
  }

  return "wav";
}

export function createOutputName(fileName: string, format: OutputFormat) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "audio"}-sonosig.${format}`;
}

function createNonce() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function readPcm16Audio(bytes: Uint8Array) {
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
    return readWavPcm16(bytes);
  }

  if (readAscii(bytes, 0, 4) === "FORM" && readAscii(bytes, 8, 4) === "AIFF") {
    return readAiffPcm16(bytes);
  }

  throw new Error("Verification currently expects a WAV or AIFF file.");
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

function readAiffPcm16(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, false);
    const chunkDataOffset = offset + 8;

    if (chunkId === "COMM") {
      bitsPerSample = view.getUint16(chunkDataOffset + 6, false);
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

  return pcm;
}

function writeAiff(pcm: Int16Array, channels: number, sampleRate: number) {
  const bytesPerSample = 2;
  const dataSize = pcm.length * bytesPerSample;
  const commSize = 18;
  const ssndSize = 8 + dataSize;
  const buffer = new ArrayBuffer(12 + 8 + commSize + 8 + ssndSize);
  const view = new DataView(buffer);
  const output = new Uint8Array(buffer);
  const frameCount = pcm.length / channels;

  writeAscii(output, 0, "FORM");
  view.setUint32(4, buffer.byteLength - 8, false);
  writeAscii(output, 8, "AIFF");
  writeAscii(output, 12, "COMM");
  view.setUint32(16, commSize, false);
  view.setUint16(20, channels, false);
  view.setUint32(22, frameCount, false);
  view.setUint16(26, 16, false);
  writeExtended80(output, 28, sampleRate);
  writeAscii(output, 38, "SSND");
  view.setUint32(42, ssndSize, false);
  view.setUint32(46, 0, false);
  view.setUint32(50, 0, false);

  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(54 + index * bytesPerSample, pcm[index], false);
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

function writeExtended80(bytes: Uint8Array, offset: number, value: number) {
  if (value <= 0) {
    bytes.fill(0, offset, offset + 10);
    return;
  }

  const exponent = Math.floor(Math.log2(value));
  const normalized = value / 2 ** exponent;
  const highMantissa = Math.floor(normalized * 2 ** 31);
  const mantissa = BigInt(highMantissa) << BigInt(32);
  const biasedExponent = exponent + 16383;

  bytes[offset] = (biasedExponent >> 8) & 0x7f;
  bytes[offset + 1] = biasedExponent & 0xff;

  for (let index = 0; index < 8; index += 1) {
    const shift = BigInt((7 - index) * 8);
    bytes[offset + 2 + index] = Number((mantissa >> shift) & BigInt(0xff));
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

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
