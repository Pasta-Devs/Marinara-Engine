// Every file an Experience file brings in (Capability API 1.373) is checked to be what its name says and
// stripped of anything that is not the picture, the sound or the data itself. Pictures pass the same
// signature check character cards do (isAllowedImageBuffer), and then lose their text, EXIF, XMP, ICC
// and comment chunks and anything after their end. Music loses its tags (ID3, APE, RIFF INFO, Ogg
// comments and cover art). Data must be JSON. What is stored is only what plays or draws.
import { ExperienceFileError, experienceFileType } from "@marinara-engine/shared";
import { extname } from "node:path";
import { isAllowedImageBuffer } from "../../utils/security.js";

const IMAGE_EXTENSIONS: Record<string, string> = {
  ".png": "png",
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".gif": "gif",
  ".webp": "webp",
};

/** The file as it is stored: checked to be what its name says, its metadata removed. */
export function sanitizeExperienceAsset(path: string, data: Buffer): Buffer {
  const extension = extname(path).toLowerCase();
  const refuse = (what: string): never => {
    throw new ExperienceFileError(`${path} is not ${what}`);
  };
  try {
    switch (experienceFileType(path)) {
      case "image": {
        const expected = IMAGE_EXTENSIONS[extension];
        const detected = isAllowedImageBuffer(data);
        if (!expected || detected?.ext !== expected) return refuse(`a ${extension.slice(1).toUpperCase()} picture`);
        if (expected === "png") return stripPng(data);
        if (expected === "jpg") return stripJpeg(data);
        if (expected === "gif") return stripGif(data);
        return stripWebp(data);
      }
      case "audio":
        if (extension === ".ogg") return stripOgg(data);
        if (extension === ".mp3") return stripMp3(data);
        if (extension === ".wav") return stripWav(data);
        return refuse("a music file");
      case "data": {
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data);
        JSON.parse(text);
        return data;
      }
      default:
        return refuse("a picture, music or data file");
    }
  } catch (error) {
    if (error instanceof ExperienceFileError) throw error;
    if (error instanceof MalformedAsset) return refuse(`a well-formed ${describe(extension)}: ${error.message}`);
    if (error instanceof SyntaxError || error instanceof TypeError) return refuse("valid JSON");
    throw error;
  }
}

class MalformedAsset extends Error {}
const malformed = (message: string): never => {
  throw new MalformedAsset(message);
};

function describe(extension: string) {
  if (extension === ".ogg" || extension === ".mp3" || extension === ".wav")
    return `${extension.slice(1).toUpperCase()} sound`;
  return `${extension.slice(1).toUpperCase()} picture`;
}

const ascii = (data: Buffer, start: number, length: number) => data.toString("latin1", start, start + length);

// ── PNG: keep the chunks that draw the picture, in order, and nothing after IEND ──

const PNG_KEPT = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "cHRM",
  "gAMA",
  "sRGB",
  "sBIT",
  "bKGD",
  "pHYs",
  "cICP",
  "acTL",
  "fcTL",
  "fdAT",
]);

function stripPng(data: Buffer): Buffer {
  const parts: Buffer[] = [data.subarray(0, 8)];
  let at = 8;
  let first = true;
  for (;;) {
    if (at + 12 > data.length) malformed("it stops before its end");
    const length = data.readUInt32BE(at);
    const type = ascii(data, at + 4, 4);
    const end = at + 12 + length;
    if (length > 0x7fffffff || end > data.length) malformed(`its ${type} chunk runs past the file`);
    if (first && type !== "IHDR") malformed("it does not start with IHDR");
    first = false;
    if (PNG_KEPT.has(type)) parts.push(data.subarray(at, end));
    at = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

// ── JPEG: drop APPn (but JFIF and Adobe) and comments, and anything after EOI ──

function stripJpeg(data: Buffer): Buffer {
  const parts: Buffer[] = [data.subarray(0, 2)];
  let at = 2;
  for (;;) {
    if (at + 2 > data.length) malformed("it stops before its end");
    if (data[at] !== 0xff) malformed("a segment does not start with a marker");
    const marker = data[at + 1]!;
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0xd9) {
      parts.push(data.subarray(at, at + 2));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(data.subarray(at, at + 2));
      at += 2;
      continue;
    }
    if (at + 4 > data.length) malformed("it stops before its end");
    const end = at + 2 + data.readUInt16BE(at + 2);
    if (end > data.length || end < at + 4) malformed("a segment runs past the file");
    const app = marker >= 0xe0 && marker <= 0xef;
    const keep =
      !(app || marker === 0xfe) ||
      (marker === 0xe0 && ascii(data, at + 4, 5) === "JFIF\0") ||
      (marker === 0xee && ascii(data, at + 4, 5) === "Adobe");
    if (keep) parts.push(data.subarray(at, end));
    at = end;
    if (marker === 0xda) {
      // Entropy-coded data runs to the next marker that is not a stuffed byte or a restart.
      let scan = at;
      while (scan + 1 < data.length) {
        if (data[scan] === 0xff) {
          const next = data[scan + 1]!;
          if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) break;
        }
        scan += 1;
      }
      if (scan + 1 >= data.length) malformed("its image data stops before its end");
      parts.push(data.subarray(at, scan));
      at = scan;
    }
  }
  return Buffer.concat(parts);
}

// ── GIF: keep frames, frame timing and the loop count; drop comments, text and other extensions ──

function stripGif(data: Buffer): Buffer {
  if (data.length < 13) malformed("it stops before its end");
  let at = 13;
  const flags = data[10]!;
  if (flags & 0x80) at += 3 * (1 << ((flags & 0x07) + 1));
  const parts: Buffer[] = [data.subarray(0, at)];
  const subBlocksEnd = (start: number) => {
    let scan = start;
    for (;;) {
      if (scan >= data.length) malformed("it stops before its end");
      const size = data[scan]!;
      scan += 1 + size;
      if (size === 0) return scan;
    }
  };
  for (;;) {
    if (at >= data.length) malformed("it stops before its end");
    const block = data[at]!;
    if (block === 0x3b) {
      parts.push(data.subarray(at, at + 1));
      break;
    }
    if (block === 0x2c) {
      if (at + 10 > data.length) malformed("it stops before its end");
      const local = data[at + 9]!;
      let start = at + 10;
      if (local & 0x80) start += 3 * (1 << ((local & 0x07) + 1));
      const end = subBlocksEnd(start + 1);
      parts.push(data.subarray(at, end));
      at = end;
      continue;
    }
    if (block !== 0x21) malformed("it holds a block GIF does not have");
    const label = data[at + 1];
    const end = subBlocksEnd(at + 2);
    const loop =
      label === 0xff &&
      data[at + 2] === 11 &&
      (ascii(data, at + 3, 11) === "NETSCAPE2.0" || ascii(data, at + 3, 11) === "ANIMEXTS1.0");
    if (label === 0xf9 || loop) parts.push(data.subarray(at, end));
    at = end;
  }
  return Buffer.concat(parts);
}

// ── RIFF (WebP, WAV): keep the chunks that draw or play, rewrite the size ──

function stripRiff(data: Buffer, form: string, kept: Set<string>, onKept?: (type: string, chunk: Buffer) => Buffer) {
  if (data.length < 12 || ascii(data, 0, 4) !== "RIFF" || ascii(data, 8, 4) !== form)
    malformed(`it is not RIFF ${form}`);
  const end = 8 + data.readUInt32LE(4);
  if (end > data.length) malformed("it stops before its end");
  const parts: Buffer[] = [];
  let at = 12;
  while (at < end) {
    if (at + 8 > end) malformed("a chunk runs past the file");
    const type = ascii(data, at, 4);
    const next = at + 8 + data.readUInt32LE(at + 4);
    const padded = next + (next % 2);
    if (next > end) malformed(`its ${type.trim()} chunk runs past the file`);
    if (kept.has(type)) {
      const chunk = Buffer.from(data.subarray(at, Math.min(padded, end)));
      parts.push(onKept ? onKept(type, chunk) : chunk);
    }
    at = padded;
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write(form, 8, "latin1");
  return Buffer.concat([header, body]);
}

const WEBP_KEPT = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF"]);

function stripWebp(data: Buffer): Buffer {
  return stripRiff(data, "WEBP", WEBP_KEPT, (type, chunk) => {
    // VP8X says which chunks follow; ICC (0x20), EXIF (0x08) and XMP (0x04) no longer do.
    if (type === "VP8X" && chunk.length > 8) chunk[8] = chunk[8]! & ~(0x20 | 0x08 | 0x04);
    return chunk;
  });
}

function stripWav(data: Buffer): Buffer {
  const stripped = stripRiff(data, "WAVE", new Set(["fmt ", "data", "fact"]));
  if (!stripped.includes("fmt ", 12, "latin1") || !stripped.includes("data", 12, "latin1")) {
    malformed("it has no fmt or data chunk");
  }
  return stripped;
}

// ── MP3: drop ID3v2 tags in front, ID3v1 and APE tags behind; what is left starts with a frame ──

function stripMp3(data: Buffer): Buffer {
  let start = 0;
  while (start + 10 <= data.length && ascii(data, start, 3) === "ID3") {
    const size =
      ((data[start + 6]! & 0x7f) << 21) |
      ((data[start + 7]! & 0x7f) << 14) |
      ((data[start + 8]! & 0x7f) << 7) |
      (data[start + 9]! & 0x7f);
    start += 10 + size + (data[start + 5]! & 0x10 ? 10 : 0);
  }
  let end = data.length;
  for (let changed = true; changed;) {
    changed = false;
    if (end - start >= 128 && ascii(data, end - 128, 3) === "TAG") {
      end -= 128;
      changed = true;
    }
    if (end - start >= 32 && ascii(data, end - 32, 8) === "APETAGEX") {
      const size = data.readUInt32LE(end - 20);
      const header = data.readUInt32LE(end - 12) & 0x80000000 ? 32 : 0;
      end -= size + header;
      if (end < start) malformed("its APE tag runs past the file");
      changed = true;
    }
    if (end - start >= 10 && ascii(data, end - 10, 3) === "3DI") {
      const size =
        ((data[end - 4]! & 0x7f) << 21) |
        ((data[end - 3]! & 0x7f) << 14) |
        ((data[end - 2]! & 0x7f) << 7) |
        (data[end - 1]! & 0x7f);
      end -= 20 + size;
      if (end < start) malformed("its ID3 tag runs past the file");
      changed = true;
    }
  }
  // Some encoders leave zero padding between the tag and the first frame.
  while (start < end && data[start] === 0) start += 1;
  if (start + 4 > end || data[start] !== 0xff || (data[start + 1]! & 0xe0) !== 0xe0) {
    malformed("it does not start with an MPEG audio frame");
  }
  return data.subarray(start, end);
}

// ── Ogg: Vorbis or Opus streams only; their comment packet is blanked in place, pages re-checksummed ──

const OGG_CRC = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index << 24;
    for (let bit = 0; bit < 8; bit += 1) value = value & 0x80000000 ? (value << 1) ^ 0x04c11db7 : value << 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function oggCrc(page: Buffer) {
  let crc = 0;
  for (let index = 0; index < page.length; index += 1) {
    const byte = index >= 22 && index < 26 ? 0 : page[index]!;
    crc = ((crc << 8) ^ OGG_CRC[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
  }
  return crc;
}

function stripOgg(input: Buffer): Buffer {
  const data = Buffer.from(input);
  type Stream = { codec: "vorbis" | "opus" | null; packet: number; bytes: number[]; touched: Set<number> };
  const streams = new Map<number, Stream>();
  const pages: Array<{ start: number; end: number }> = [];
  let at = 0;
  while (at < data.length) {
    if (at + 27 > data.length || ascii(data, at, 4) !== "OggS" || data[at + 4] !== 0)
      malformed("a page does not start with OggS");
    const segments = data[at + 26]!;
    const tableEnd = at + 27 + segments;
    if (tableEnd > data.length) malformed("a page runs past the file");
    let end = tableEnd;
    for (let index = 0; index < segments; index += 1) end += data[at + 27 + index]!;
    if (end > data.length) malformed("a page runs past the file");
    const page = data.subarray(at, end);
    if (page.readUInt32LE(22) !== oggCrc(page)) malformed("a page's checksum is wrong");
    const pageIndex = pages.push({ start: at, end }) - 1;
    const serial = data.readUInt32LE(at + 14);
    let stream = streams.get(serial);
    if (!stream) {
      if (!(data[at + 5]! & 0x02)) malformed("a stream starts without its first page");
      stream = { codec: null, packet: 0, bytes: [], touched: new Set() };
      streams.set(serial, stream);
    }
    let cursor = tableEnd;
    for (let index = 0; index < segments; index += 1) {
      const size = data[at + 27 + index]!;
      if (stream.packet <= 1) {
        for (let offset = 0; offset < size; offset += 1) stream.bytes.push(cursor + offset);
        if (stream.packet === 1) stream.touched.add(pageIndex);
      }
      cursor += size;
      if (size < 255) {
        if (stream.packet === 0) {
          const head = Buffer.from(stream.bytes.slice(0, 8).map((position) => data[position]!));
          if (ascii(head, 0, 7) === "\x01vorbis") stream.codec = "vorbis";
          else if (ascii(head, 0, 8) === "OpusHead") stream.codec = "opus";
          else malformed("it holds a stream that is not Vorbis or Opus");
        } else if (stream.packet === 1) {
          blankOggComments(data, stream.bytes, stream.codec!);
        }
        if (stream.packet <= 1) stream.bytes = [];
        stream.packet += 1;
      }
    }
    at = end;
  }
  if (streams.size === 0) malformed("it holds no stream");
  for (const stream of streams.values()) {
    if (stream.packet < 2) malformed("a stream stops before its comment header");
    for (const pageIndex of stream.touched) {
      const page = data.subarray(pages[pageIndex]!.start, pages[pageIndex]!.end);
      page.writeUInt32LE(oggCrc(page), 22);
    }
  }
  return data;
}

/** Overwrites a Vorbis or Opus comment packet's vendor string and comments, keeping every length. */
function blankOggComments(data: Buffer, positions: number[], codec: "vorbis" | "opus") {
  const packet = Buffer.from(positions.map((position) => data[position]!));
  const magic = codec === "vorbis" ? "\x03vorbis" : "OpusTags";
  if (ascii(packet, 0, magic.length) !== magic) malformed("its comment header is missing");
  let at = magic.length;
  const field = () => {
    if (at + 4 > packet.length) malformed("its comment header runs past its end");
    const length = packet.readUInt32LE(at);
    at += 4;
    if (at + length > packet.length) malformed("its comment header runs past its end");
    const start = at;
    at += length;
    return { start, length };
  };
  const vendor = field();
  packet.fill(0x20, vendor.start, vendor.start + vendor.length);
  if (at + 4 > packet.length) malformed("its comment header runs past its end");
  const count = packet.readUInt32LE(at);
  at += 4;
  for (let index = 0; index < count; index += 1) {
    const comment = field();
    if (comment.length >= 2) {
      packet.write("X=", comment.start, "latin1");
      packet.fill(0x5f, comment.start + 2, comment.start + comment.length);
    } else {
      packet.fill(0x5f, comment.start, comment.start + comment.length);
    }
  }
  // Vorbis ends on its framing bit; whatever Opus carries after its comments becomes zero padding.
  if (codec === "vorbis") {
    if (at >= packet.length || !(packet[at]! & 1)) malformed("its comment header has no framing bit");
    packet.fill(0, at + 1);
  } else {
    packet.fill(0, at);
  }
  positions.forEach((position, index) => {
    data[position] = packet[index]!;
  });
}
