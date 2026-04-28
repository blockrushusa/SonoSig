import type { Hex } from "viem";

const MAGIC = "SONOSIG1";
const HEADER_BYTES = MAGIC.length + 4;
const PROTOCOL = "audio-proof-v1";

export const STATEMENT =
  "Create a Sonosig wallet-linked proof payload for this local audio file.";
export const VERIFIED_BY = "SonoSig.com";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  11155111: "Sepolia",
};

type PcmAudio = {
  pcm: Int16Array;
  channels: number;
  sampleRate: number;
};

export type OutputFormat = "wav" | "aiff" | "m4a" | "ogg";

export const OUTPUT_FORMATS: Array<{
  value: OutputFormat;
  label: string;
  mimeType: string;
}> = [
  { value: "wav", label: "WAV", mimeType: "audio/wav" },
  { value: "aiff", label: "AIFF", mimeType: "audio/aiff" },
  { value: "m4a", label: "M4A", mimeType: "audio/mp4" },
  { value: "ogg", label: "OGG", mimeType: "audio/ogg" },
];

export type ProofPayload = {
  v: 1;
  protocol: typeof PROTOCOL;
  ens: string;
  wallet: `0x${string}`;
  audio_fingerprint: string;
  audio_hash: string;
  manifest: string;
  issued_at: string;
  chain_id: number;
  signature_type: "SIWE";
  address: `0x${string}`;
  chainId: number;
  domain: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  statement: string;
  audioFingerprint: string;
  chain?: string;
  verifiedBy?: string;
  song?: {
    album?: string;
    albumArtist?: string;
    artist?: string;
    bpm?: string;
    comment?: string;
    composer?: string;
    copyright?: string;
    discNumber?: string;
    genre?: string;
    isrc?: string;
    key?: string;
    notes?: string;
    publisher?: string;
    releaseDate?: string;
    title?: string;
    trackNumber?: string;
    year?: string;
  };
  signature: Hex;
};

export function createSiweFields(address: `0x${string}`, chainId: number) {
  const issuedAt = new Date().toISOString();

  return {
    protocol: PROTOCOL as typeof PROTOCOL,
    wallet: address,
    address,
    chain_id: chainId,
    chainId,
    domain: window.location.host,
    uri: window.location.origin,
    nonce: createNonce(),
    issued_at: issuedAt,
    issuedAt,
    statement: STATEMENT,
    signature_type: "SIWE" as const,
    chain: getChainName(chainId),
    verifiedBy: VERIFIED_BY,
  };
}

export function buildSiweMessage({
  address,
  wallet,
  chainId,
  chain_id,
  domain,
  ens,
  manifest,
  issuedAt,
  issued_at,
  nonce,
  statement,
  audio_hash,
  audio_fingerprint,
  audioFingerprint,
  uri,
  chain,
  signature_type,
  song,
  verifiedBy,
}: Omit<ProofPayload, "v" | "signature">) {
  const signingAddress = wallet ?? address;
  const signingChainId = chain_id ?? chainId;
  const signingIssuedAt = issued_at ?? issuedAt;
  const signingAudioFingerprint = audio_fingerprint ?? audioFingerprint;
  const chainLine = chain ? `\nChain: ${chain}` : "";
  const ensLine = ens ? `\nENS: ${ens}` : "";
  const manifestLine = manifest ? `\nManifest: ${manifest}` : "";
  const songLine = song
    ? `\nSong: ${[
        song.title,
        song.artist,
        song.album,
        song.albumArtist,
        song.composer,
        song.genre,
        song.releaseDate,
        song.year,
        song.trackNumber,
        song.discNumber,
        song.isrc,
        song.bpm,
        song.key,
        song.publisher,
        song.copyright,
        song.notes,
      ]
        .filter(Boolean)
        .join(" | ")}`
    : "";
  const verifiedByLine = verifiedBy ? `\nVerified By: ${verifiedBy}` : "";

  return `${domain} wants you to sign in with your Ethereum account:
${signingAddress}

${statement}${chainLine}${ensLine}${songLine}${manifestLine}${verifiedByLine}

URI: ${uri}
Version: 1
Chain ID: ${signingChainId}
Protocol: ${PROTOCOL}
Wallet: ${signingAddress}
Audio Fingerprint: ${signingAudioFingerprint}
Audio Hash: ${audio_hash}
Purpose: ${statement}
Signature Type: ${signature_type}
Nonce: ${nonce}
Issued At: ${signingIssuedAt}`;
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

export async function encodeWatermarkedPcmWithProgress(
  audioBuffer: AudioBuffer,
  payloadBytes: Uint8Array,
  onProgress: (progress: number) => void,
) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frames = audioBuffer.length;
  const pcm = new Int16Array(frames * channels);
  let bitIndex = 0;
  const totalBits = payloadBytes.length * 8;
  const chunkSize = Math.max(512, Math.floor(frames / 80));

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

    if (frame % chunkSize === 0) {
      onProgress(frame / frames);
      await nextFrame();
    }
  }

  onProgress(1);

  return { pcm, channels, sampleRate };
}

export function readPayloadFromAudio(bytes: Uint8Array): ProofPayload {
  try {
    return readPayloadFromPcm(readPcm16Audio(bytes).pcm);
  } catch (error) {
    const taggedPayload = readPayloadFromTaggedBytes(bytes);

    if (taggedPayload) {
      return taggedPayload;
    }

    throw error;
  }
}

export async function createAudioFingerprint(audioBuffer: AudioBuffer) {
  return hashPcmFingerprint(audioBufferToPcmAudio(audioBuffer));
}

export async function createAudioProofHashes(audioBuffer: AudioBuffer) {
  const audio_hash = await createAudioFingerprint(audioBuffer);
  return {
    audio_fingerprint: createFingerprintId(audio_hash),
    audio_hash,
  };
}

export async function createWatermarkedAudioFingerprint(bytes: Uint8Array) {
  const audio = readPcm16Audio(bytes);
  readPayloadFromPcm(audio.pcm);
  return hashPcmFingerprint(audio);
}

export async function createWatermarkedAudioProofHashes(bytes: Uint8Array) {
  const audio_hash = await createWatermarkedAudioFingerprint(bytes);
  return {
    audio_fingerprint: createFingerprintId(audio_hash),
    audio_hash,
  };
}

export async function writeAudioFile(
  audio: { pcm: Int16Array; channels: number; sampleRate: number },
  format: OutputFormat,
  payloadBytes: Uint8Array,
  onProgress?: (progress: number) => void,
) {
  if (format === "aiff") {
    const outputBytes = writeAiff(audio.pcm, audio.channels, audio.sampleRate);
    onProgress?.(1);
    return new Blob([toArrayBuffer(outputBytes)], {
      type: getOutputFormat(format).mimeType,
    });
  }

  if (format === "m4a") {
    const m4aBlob = await writeM4a(
      audio.pcm,
      audio.channels,
      audio.sampleRate,
      onProgress,
    );
    return new Blob([m4aBlob, toArrayBuffer(payloadBytes)], {
      type: getOutputFormat(format).mimeType,
    });
  }

  if (format === "ogg") {
    const oggBlob = await writeOgg(
      audio.pcm,
      audio.channels,
      audio.sampleRate,
      onProgress,
    );
    return new Blob([oggBlob, toArrayBuffer(payloadBytes)], {
      type: getOutputFormat(format).mimeType,
    });
  }

  const outputBytes = writeWav(audio.pcm, audio.channels, audio.sampleRate);
  onProgress?.(1);
  return new Blob([toArrayBuffer(outputBytes)], {
    type: getOutputFormat(format).mimeType,
  });
}

export function getOutputFormat(format: OutputFormat) {
  return OUTPUT_FORMATS.find((item) => item.value === format) ?? OUTPUT_FORMATS[0];
}

export function inferOutputFormat(file: File | null): OutputFormat {
  const extension = file?.name.split(".").pop()?.toLowerCase();

  if (extension === "aif" || extension === "aiff") {
    return "aiff";
  }

  if (extension === "m4a") {
    return "m4a";
  }

  if (extension === "oga" || extension === "ogg" || extension === "opus") {
    return "ogg";
  }

  return "wav";
}

export function createOutputName(fileName: string, format: OutputFormat) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "audio"}-sonosig.${format}`;
}

function readPayloadFromPcm(pcm: Int16Array) {
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

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function readPcm16Audio(bytes: Uint8Array): PcmAudio {
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

function readPayloadFromTaggedBytes(bytes: Uint8Array) {
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

    const payload = JSON.parse(
      new TextDecoder().decode(bytes.slice(payloadStart, payloadEnd)),
    );

    if (isProofPayload(payload)) {
      return payload;
    }
  }

  return null;
}

function readWavPcm16(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    throw new Error("Verification currently expects a WAV file.");
  }

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
    pcm: new Int16Array(
      bytes.buffer.slice(
        bytes.byteOffset + dataOffset,
        bytes.byteOffset + dataOffset + dataLength,
      ),
    ),
    channels,
    sampleRate,
  };
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

  return { pcm, channels, sampleRate };
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

async function writeM4a(
  pcm: Int16Array,
  channels: number,
  sampleRate: number,
  onProgress?: (progress: number) => void,
) {
  const mimeType = getSupportedM4aMimeType();

  if (!mimeType) {
    throw new Error("This browser does not support local M4A export.");
  }

  return writeMediaRecorderAudio(
    pcm,
    channels,
    sampleRate,
    mimeType,
    "M4A",
    onProgress,
  );
}

async function writeOgg(
  pcm: Int16Array,
  channels: number,
  sampleRate: number,
  onProgress?: (progress: number) => void,
) {
  const mimeType = getSupportedOggMimeType();

  if (!mimeType) {
    throw new Error("This browser does not support local OGG export.");
  }

  return writeMediaRecorderAudio(
    pcm,
    channels,
    sampleRate,
    mimeType,
    "OGG",
    onProgress,
  );
}

async function writeMediaRecorderAudio(
  pcm: Int16Array,
  channels: number,
  sampleRate: number,
  mimeType: string,
  formatLabel: string,
  onProgress?: (progress: number) => void,
) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass({ sampleRate });
  const audioBuffer = audioContext.createBuffer(
    channels,
    pcm.length / channels,
    sampleRate,
  );

  for (let channel = 0; channel < channels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let frame = 0; frame < audioBuffer.length; frame += 1) {
      channelData[frame] = pcm[frame * channels + channel] / 32768;
    }
  }

  const destination = audioContext.createMediaStreamDestination();
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(destination);

  const recorder = new MediaRecorder(destination.stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.addEventListener("error", () => {
      reject(new Error(`${formatLabel} export failed.`));
    });
  });

  recorder.start();
  source.start();
  const durationMs = (audioBuffer.length / sampleRate) * 1000;
  const startedAt = performance.now();
  const progressTimer = window.setInterval(() => {
    const elapsed = performance.now() - startedAt;
    onProgress?.(Math.min(0.98, elapsed / durationMs));
  }, 100);

  await new Promise<void>((resolve) => {
    source.addEventListener("ended", () => {
      resolve();
    });
  });

  window.clearInterval(progressTimer);
  onProgress?.(0.99);

  if (recorder.state !== "inactive") {
    recorder.stop();
  }

  const blob = await stopped;
  onProgress?.(1);
  await audioContext.close();

  return blob;
}

function floatToInt16(sample: number) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
}

function audioBufferToPcmAudio(audioBuffer: AudioBuffer): PcmAudio {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frames = audioBuffer.length;
  const pcm = new Int16Array(frames * channels);

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      pcm[frame * channels + channel] = floatToInt16(
        audioBuffer.getChannelData(channel)[frame] ?? 0,
      );
    }
  }

  return { pcm, channels, sampleRate };
}

async function hashPcmFingerprint(audio: PcmAudio) {
  const header = new Uint8Array(8);
  const headerView = new DataView(header.buffer);
  headerView.setUint16(0, audio.channels, true);
  headerView.setUint32(2, audio.sampleRate, true);
  const pcmBytes = new Uint8Array(audio.pcm.length * 2);
  const pcmView = new DataView(pcmBytes.buffer);

  for (let index = 0; index < audio.pcm.length; index += 1) {
    pcmView.setInt16(index * 2, audio.pcm[index] & ~1, true);
  }

  const bytes = new Uint8Array(header.byteLength + pcmBytes.byteLength);
  bytes.set(header, 0);
  bytes.set(pcmBytes, header.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `sha256:${hash}`;
}

function createFingerprintId(audioHash: string) {
  return `fp_${audioHash.replace(/^sha256:/, "").slice(0, 12)}`;
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function readExtended80(bytes: Uint8Array, offset: number) {
  const exponent = ((bytes[offset] & 0x7f) << 8) | bytes[offset + 1];

  if (exponent === 0) {
    return 0;
  }

  let mantissa = BigInt(0);

  for (let index = 0; index < 8; index += 1) {
    mantissa = (mantissa << BigInt(8)) | BigInt(bytes[offset + 2 + index]);
  }

  const fraction = Number(mantissa) / 2 ** 63;
  return Math.round(fraction * 2 ** (exponent - 16383));
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
    payload.protocol === PROTOCOL &&
    typeof payload.ens === "string" &&
    typeof payload.wallet === "string" &&
    payload.wallet.startsWith("0x") &&
    typeof payload.audio_fingerprint === "string" &&
    payload.audio_fingerprint.startsWith("fp_") &&
    typeof payload.audio_hash === "string" &&
    payload.audio_hash.startsWith("sha256:") &&
    typeof payload.manifest === "string" &&
    typeof payload.issued_at === "string" &&
    typeof payload.chain_id === "number" &&
    payload.signature_type === "SIWE" &&
    typeof payload.address === "string" &&
    payload.address.startsWith("0x") &&
    typeof payload.chainId === "number" &&
    typeof payload.domain === "string" &&
    typeof payload.uri === "string" &&
    typeof payload.nonce === "string" &&
    typeof payload.issuedAt === "string" &&
    typeof payload.statement === "string" &&
    typeof payload.audioFingerprint === "string" &&
    (typeof payload.chain === "undefined" || typeof payload.chain === "string") &&
    (typeof payload.verifiedBy === "undefined" ||
      typeof payload.verifiedBy === "string") &&
    (typeof payload.song === "undefined" ||
      (typeof payload.song === "object" && payload.song !== null)) &&
    typeof payload.signature === "string" &&
    payload.signature.startsWith("0x")
  );
}

export function getChainName(chainId: number) {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

function getSupportedM4aMimeType() {
  const mimeTypes = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function getSupportedOggMimeType() {
  const mimeTypes = [
    "audio/ogg;codecs=opus",
    "audio/ogg;codecs=vorbis",
    "audio/ogg",
  ];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
