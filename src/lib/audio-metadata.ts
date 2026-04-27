import type { ProofPayload } from "@/lib/audio-watermark";

export type AudioMetadata = NonNullable<ProofPayload["song"]>;

const ID3_TEXT_FRAMES: Record<string, keyof AudioMetadata> = {
  TALB: "album",
  TBPM: "bpm",
  TCOM: "composer",
  TCON: "genre",
  TCOP: "copyright",
  TDRC: "releaseDate",
  TKEY: "key",
  TIT2: "title",
  TPE1: "artist",
  TPE2: "albumArtist",
  TPOS: "discNumber",
  TPUB: "publisher",
  TRCK: "trackNumber",
  TSRC: "isrc",
};

const MP4_TEXT_ATOMS: Record<string, keyof AudioMetadata> = {
  "\xa9ART": "artist",
  "\xa9alb": "album",
  "\xa9cmt": "notes",
  "\xa9cpy": "copyright",
  "\xa9day": "releaseDate",
  "\xa9gen": "genre",
  "\xa9nam": "title",
  "\xa9wrt": "composer",
  aART: "albumArtist",
  cprt: "copyright",
};

const WAV_INFO_CHUNKS: Record<string, keyof AudioMetadata> = {
  IART: "artist",
  ICMT: "notes",
  ICOP: "copyright",
  ICRD: "releaseDate",
  IGNR: "genre",
  IKEY: "key",
  INAM: "title",
  IPRD: "album",
  ISBJ: "notes",
  ISRC: "isrc",
  IWRI: "composer",
};

export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  return cleanMetadata({
    ...readId3v2Metadata(bytes),
    ...readWavInfoMetadata(bytes),
    ...readMp4Metadata(bytes),
  });
}

function readId3v2Metadata(bytes: Uint8Array): AudioMetadata {
  if (readAscii(bytes, 0, 3) !== "ID3") {
    return {};
  }

  const version = bytes[3];
  const tagSize = readSynchsafeUint32(bytes, 6);
  const tagEnd = Math.min(bytes.length, 10 + tagSize);
  const metadata: AudioMetadata = {};
  let offset = 10;

  while (offset + 10 <= tagEnd) {
    const frameId = readAscii(bytes, offset, 4);

    if (!/^[A-Z0-9]{4}$/.test(frameId)) {
      break;
    }

    const frameSize =
      version === 4
        ? readSynchsafeUint32(bytes, offset + 4)
        : readUint32(bytes, offset + 4, false);
    const frameStart = offset + 10;
    const frameEnd = Math.min(frameStart + frameSize, tagEnd);

    if (frameSize <= 0 || frameEnd > tagEnd) {
      break;
    }

    const frame = bytes.slice(frameStart, frameEnd);
    const key = ID3_TEXT_FRAMES[frameId];

    if (key) {
      metadata[key] = decodeId3Text(frame);
    } else if (frameId === "COMM") {
      const comment = decodeId3Comment(frame);

      if (comment) {
        metadata.notes = comment;
      }
    }

    offset = frameEnd;
  }

  return normalizeDerivedFields(metadata);
}

function readWavInfoMetadata(bytes: Uint8Array): AudioMetadata {
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    return {};
  }

  const metadata: AudioMetadata = {};
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = readUint32(bytes, offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = Math.min(chunkStart + chunkSize, bytes.length);

    if (chunkId === "LIST" && readAscii(bytes, chunkStart, 4) === "INFO") {
      readWavInfoList(bytes.slice(chunkStart + 4, chunkEnd), metadata);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  return normalizeDerivedFields(metadata);
}

function readWavInfoList(bytes: Uint8Array, metadata: AudioMetadata) {
  let offset = 0;

  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    const size = readUint32(bytes, offset + 4, true);
    const valueStart = offset + 8;
    const valueEnd = Math.min(valueStart + size, bytes.length);
    const key = WAV_INFO_CHUNKS[id];

    if (key) {
      metadata[key] = decodeLatin1(bytes.slice(valueStart, valueEnd));
    }

    offset = valueEnd + (size % 2);
  }
}

function readMp4Metadata(bytes: Uint8Array): AudioMetadata {
  if (!isMp4(bytes)) {
    return {};
  }

  const metadata: AudioMetadata = {};

  walkMp4Boxes(bytes, 0, bytes.length, (type, start, end) => {
    if (type === "ilst") {
      readIlst(bytes, start, end, metadata);
      return false;
    }

    return true;
  });

  return normalizeDerivedFields(metadata);
}

function readIlst(
  bytes: Uint8Array,
  start: number,
  end: number,
  metadata: AudioMetadata,
) {
  let offset = start;

  while (offset + 8 <= end) {
    const box = readBox(bytes, offset, end);

    if (!box) {
      break;
    }

    const atom = box.type;
    const data = findChildBox(bytes, box.start, box.end, "data");

    if (data) {
      if (atom === "trkn") {
        metadata.trackNumber = readMp4Pair(bytes, data.start, data.end);
      } else if (atom === "disk") {
        metadata.discNumber = readMp4Pair(bytes, data.start, data.end);
      } else if (atom === "tmpo") {
        metadata.bpm = readMp4Integer(bytes, data.start, data.end);
      } else {
        const key = MP4_TEXT_ATOMS[atom];

        if (key) {
          metadata[key] = decodeUtf8(bytes.slice(data.start + 8, data.end));
        }
      }
    }

    offset = box.end + (box.size % 2);
  }
}

function walkMp4Boxes(
  bytes: Uint8Array,
  start: number,
  end: number,
  visitor: (type: string, start: number, end: number) => boolean,
) {
  let offset = start;

  while (offset + 8 <= end) {
    const box = readBox(bytes, offset, end);

    if (!box) {
      break;
    }

    const shouldDescend = visitor(box.type, box.start, box.end);

    if (
      shouldDescend &&
      ["moov", "udta", "trak", "mdia", "minf", "stbl"].includes(box.type)
    ) {
      walkMp4Boxes(bytes, box.start, box.end, visitor);
    } else if (shouldDescend && box.type === "meta" && box.start + 4 <= box.end) {
      walkMp4Boxes(bytes, box.start + 4, box.end, visitor);
    }

    offset = box.end + (box.size % 2);
  }
}

function findChildBox(
  bytes: Uint8Array,
  start: number,
  end: number,
  type: string,
) {
  let offset = start;

  while (offset + 8 <= end) {
    const box = readBox(bytes, offset, end);

    if (!box) {
      return null;
    }

    if (box.type === type) {
      return box;
    }

    offset = box.end + (box.size % 2);
  }

  return null;
}

function readBox(bytes: Uint8Array, offset: number, limit: number) {
  const size = readUint32(bytes, offset, false);
  const type = readAscii(bytes, offset + 4, 4);

  if (size < 8 || offset + size > limit) {
    return null;
  }

  return {
    end: offset + size,
    size,
    start: offset + 8,
    type,
  };
}

function readMp4Pair(bytes: Uint8Array, start: number, end: number) {
  if (start + 14 > end) {
    return "";
  }

  const current = readUint16(bytes, start + 10, false);
  const total = readUint16(bytes, start + 12, false);

  return total ? `${current}/${total}` : String(current);
}

function readMp4Integer(bytes: Uint8Array, start: number, end: number) {
  if (end - start >= 10) {
    return String(readUint16(bytes, end - 2, false));
  }

  return "";
}

function decodeId3Text(bytes: Uint8Array) {
  if (!bytes.length) {
    return "";
  }

  return decodeEncodedText(bytes[0], bytes.slice(1));
}

function decodeId3Comment(bytes: Uint8Array) {
  if (bytes.length < 4) {
    return "";
  }

  const encoding = bytes[0];
  const body = bytes.slice(4);
  const separator = encoding === 1 || encoding === 2 ? findDoubleNull(body) : body.indexOf(0);
  const textStart =
    separator < 0 ? 0 : separator + (encoding === 1 || encoding === 2 ? 2 : 1);

  return decodeEncodedText(encoding, body.slice(textStart));
}

function decodeEncodedText(encoding: number, bytes: Uint8Array) {
  if (encoding === 1) {
    return new TextDecoder("utf-16").decode(trimNulls(bytes));
  }

  if (encoding === 2) {
    return new TextDecoder("utf-16be").decode(trimNulls(bytes));
  }

  if (encoding === 3) {
    return decodeUtf8(bytes);
  }

  return decodeLatin1(bytes);
}

function normalizeDerivedFields(metadata: AudioMetadata) {
  if (metadata.releaseDate && !metadata.year) {
    metadata.year = metadata.releaseDate.slice(0, 4);
  }

  return metadata;
}

function cleanMetadata(metadata: AudioMetadata) {
  return Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key, value?.trim()])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as AudioMetadata;
}

function isMp4(bytes: Uint8Array) {
  return readAscii(bytes, 4, 4) === "ftyp";
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return decodeLatin1(bytes.slice(offset, offset + length));
}

function readSynchsafeUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(
    offset,
    littleEndian,
  );
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint16(
    offset,
    littleEndian,
  );
}

function decodeLatin1(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(trimNulls(bytes)).trim();
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(trimNulls(bytes)).trim();
}

function trimNulls(bytes: Uint8Array) {
  let end = bytes.length;

  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1;
  }

  return bytes.slice(0, end);
}

function findDoubleNull(bytes: Uint8Array) {
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    if (bytes[index] === 0 && bytes[index + 1] === 0) {
      return index;
    }
  }

  return -1;
}
