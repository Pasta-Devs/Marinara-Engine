import { readFile } from "fs/promises";
import { logger } from "../lib/logger.js";

export interface ImageDimensions {
  width: number;
  height: number;
}

// sharp can fail to load on Android/Termux because it has no native Android
// prebuild. Use lightweight header parsing as a fallback for common formats.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharpFn = any;
let cachedSharp: SharpFn | null = null;
let sharpLoadFailed = false;
let sharpLoadPromise: Promise<SharpFn | null> | null = null;

async function getSharp(): Promise<SharpFn | null> {
  if (cachedSharp) return cachedSharp;
  if (sharpLoadFailed) return null;
  if (sharpLoadPromise) return sharpLoadPromise;

  sharpLoadPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - optional native dep, may not load on some platforms
      const mod = await import("sharp");
      cachedSharp = (mod.default ?? mod) as SharpFn;
      return cachedSharp;
    } catch (error) {
      sharpLoadFailed = true;
      logger.debug(error, "[image-metadata] sharp unavailable; falling back to header parsing");
      return null;
    } finally {
      sharpLoadPromise = null;
    }
  })();

  return sharpLoadPromise;
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset]! | (buffer[offset + 1]! << 8) | (buffer[offset + 2]! << 16);
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readGifDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 10) return null;
  const header = buffer.subarray(0, 6).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && length >= 7) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + size > buffer.length) return null;

    if (type === "VP8X" && size >= 10) {
      const width = readUInt24LE(buffer, dataOffset + 4) + 1;
      const height = readUInt24LE(buffer, dataOffset + 7) + 1;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (type === "VP8 " && size >= 10) {
      const width = buffer.readUInt16LE(dataOffset + 6) & 0x3fff;
      const height = buffer.readUInt16LE(dataOffset + 8) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (type === "VP8L" && size >= 5 && buffer[dataOffset] === 0x2f) {
      const b0 = buffer[dataOffset + 1]!;
      const b1 = buffer[dataOffset + 2]!;
      const b2 = buffer[dataOffset + 3]!;
      const b3 = buffer[dataOffset + 4]!;
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset = dataOffset + size + (size % 2);
  }

  return null;
}

// Walks the ISO-BMFF boxes that start at `start` and end before `end`, returning [type, dataStart, boxEnd] tuples.
function listIsoBoxes(buffer: Buffer, start: number, end: number): Array<[string, number, number]> {
  const boxes: Array<[string, number, number]> = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(end - offset)) break;
      size = Number(large);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push([type, offset + headerSize, offset + size]);
    offset += size;
  }
  return boxes;
}

function readAvifDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 16 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return null;
  const topLevel = listIsoBoxes(buffer, 0, buffer.length);
  const ftyp = topLevel[0];
  if (!ftyp || ftyp[0] !== "ftyp") return null;
  const brands = buffer.subarray(ftyp[1], ftyp[2]).toString("ascii");
  if (!brands.includes("avif") && !brands.includes("avis")) return null;
  // meta (full box) > iprp > ipco > ispe. Grid images carry one ispe per tile plus one for the
  // full canvas, so keep the largest.
  const meta = topLevel.find(([type]) => type === "meta");
  if (!meta) return null;
  const iprp = listIsoBoxes(buffer, meta[1] + 4, meta[2]).find(([type]) => type === "iprp");
  if (!iprp) return null;
  const ipco = listIsoBoxes(buffer, iprp[1], iprp[2]).find(([type]) => type === "ipco");
  if (!ipco) return null;
  let best: ImageDimensions | null = null;
  for (const [type, dataStart, boxEnd] of listIsoBoxes(buffer, ipco[1], ipco[2])) {
    if (type !== "ispe" || dataStart + 12 > boxEnd) continue;
    const width = buffer.readUInt32BE(dataStart + 4);
    const height = buffer.readUInt32BE(dataStart + 8);
    if (width > 0 && height > 0 && (!best || width * height > best.width * best.height)) best = { width, height };
  }
  return best;
}

export function readImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions | null {
  return (
    readPngDimensions(buffer) ??
    readGifDimensions(buffer) ??
    readJpegDimensions(buffer) ??
    readWebpDimensions(buffer) ??
    readAvifDimensions(buffer)
  );
}

export async function readImageDimensionsFromFile(filePath: string): Promise<ImageDimensions> {
  const sharp = await getSharp();
  if (sharp) {
    try {
      const metadata = await sharp(filePath, { limitInputPixels: false }).metadata();
      if (metadata.width && metadata.height) return { width: metadata.width, height: metadata.height };
    } catch (error) {
      logger.debug(error, "[image-metadata] sharp could not read image metadata for %s", filePath);
    }
  }

  const dimensions = readImageDimensionsFromBuffer(await readFile(filePath));
  if (dimensions) return dimensions;
  throw new Error("Could not read image dimensions from uploaded file.");
}
