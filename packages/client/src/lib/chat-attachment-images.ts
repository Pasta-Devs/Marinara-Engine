const IMAGE_COMPRESSION_EDGE = 1536;
const IMAGE_COMPRESSION_SOURCE_BYTES = 1.5 * 1024 * 1024;
const IMAGE_COMPRESSION_TARGET_BYTES = 4 * 1024 * 1024;
const MAX_DECODED_IMAGE_EDGE = 16_384;
const MAX_DECODED_IMAGE_PIXELS = 40_000_000;

const COMPRESSION_ATTEMPTS = [
  { edge: IMAGE_COMPRESSION_EDGE, quality: 0.82 },
  { edge: 1280, quality: 0.76 },
  { edge: 1024, quality: 0.68 },
];

export interface PreparedImageAttachment {
  type: string;
  data: string;
  name: string;
  resized: boolean;
}

type ImageDimensions = { width: number; height: number };

function uint16Be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function uint24Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

/** EXIF orientations 5-8 rotate the displayed image by 90 degrees, swapping its width and height. */
const TRANSPOSING_EXIF_ORIENTATIONS = new Set([5, 6, 7, 8]);

/**
 * Read the `Orientation` tag from an APP1 Exif segment. `segmentOffset` points at the segment
 * length field; returns null when the segment is not Exif or the tag is absent or malformed.
 */
function readExifOrientation(bytes: Uint8Array, segmentOffset: number, segmentLength: number): number | null {
  const segmentEnd = segmentOffset + segmentLength;
  const exifHeader = segmentOffset + 2;
  if (
    exifHeader + 6 > segmentEnd ||
    bytes[exifHeader] !== 0x45 ||
    bytes[exifHeader + 1] !== 0x78 ||
    bytes[exifHeader + 2] !== 0x69 ||
    bytes[exifHeader + 3] !== 0x66 ||
    bytes[exifHeader + 4] !== 0x00 ||
    bytes[exifHeader + 5] !== 0x00
  ) {
    return null;
  }
  const tiff = exifHeader + 6;
  if (tiff + 8 > segmentEnd) return null;
  const littleEndian = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  if (!littleEndian && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(tiff + 2, littleEndian) !== 0x002a) return null;
  const ifdOffset = view.getUint32(tiff + 4, littleEndian);
  const ifd = tiff + ifdOffset;
  if (ifdOffset < 8 || ifd + 2 > segmentEnd) return null;
  const entryCount = view.getUint16(ifd, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > segmentEnd) return null;
    if (view.getUint16(entry, littleEndian) !== 0x0112) continue;
    if (view.getUint16(entry + 2, littleEndian) !== 3 || view.getUint32(entry + 4, littleEndian) !== 1) return null;
    const orientation = view.getUint16(entry + 8, littleEndian);
    return orientation >= 1 && orientation <= 8 ? orientation : null;
  }
  return null;
}

/**
 * Read the encoded JPEG frame size as the browser will decode it: `createImageBitmap` applies the
 * EXIF orientation, so a transposing orientation swaps the width and height stored in the frame
 * header. Feeding the raw header size into `resizeWidth`/`resizeHeight` would otherwise squash a
 * rotated phone photo into the opposite aspect ratio.
 */
function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let orientation: number | null = null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) break;
    const segmentLength = uint16Be(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (marker === 0xe1 && orientation === null) {
      orientation = readExifOrientation(bytes, offset, segmentLength);
    }
    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      const height = uint16Be(bytes, offset + 3);
      const width = uint16Be(bytes, offset + 5);
      return orientation !== null && TRANSPOSING_EXIF_ORIENTATIONS.has(orientation)
        ? { width: height, height: width }
        : { width, height };
    }
    offset += segmentLength;
  }
  return null;
}

export function readEncodedImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes[6]! | (bytes[7]! << 8), height: bytes[8]! | (bytes[9]! << 8) };
  }
  if (
    bytes.length >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (chunk === "VP8X") {
      return { width: uint24Le(bytes, 24) + 1, height: uint24Le(bytes, 27) + 1 };
    }
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff, height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return readJpegDimensions(bytes);
}

function assertSafeImageDimensions({ width, height }: ImageDimensions): void {
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_DECODED_IMAGE_EDGE ||
    height > MAX_DECODED_IMAGE_EDGE ||
    width * height > MAX_DECODED_IMAGE_PIXELS
  ) {
    throw new Error("Decoded image dimensions exceed the safe attachment limit");
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

function replaceExtension(name: string, extension: string): string {
  const trimmed = name.trim() || `image.${extension}`;
  return trimmed.includes(".") ? trimmed.replace(/\.[^.]+$/, `.${extension}`) : `${trimmed}.${extension}`;
}

function fitWithinEdge(width: number, height: number, edge: number): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= edge) return { width, height };
  const scale = edge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createCanvasSurface(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, quality });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to compress image attachment"));
        }
      },
      type,
      quality,
    );
  });
}

async function renderBitmapAsJpeg(bitmap: ImageBitmap, edge: number, quality: number): Promise<Blob> {
  const size = fitWithinEdge(bitmap.width, bitmap.height, edge);
  const canvas = createCanvasSurface(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to prepare image attachment");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return canvasToBlob(canvas, "image/jpeg", quality);
}

export async function prepareImageAttachment(blob: Blob, displayName = "image"): Promise<PreparedImageAttachment> {
  const originalType = blob.type.toLowerCase();
  const shouldAlwaysConvert = originalType === "image/gif";
  let bitmap: ImageBitmap | null = null;

  try {
    const encodedDimensions = readEncodedImageDimensions(new Uint8Array(await blob.arrayBuffer()));
    if (encodedDimensions) assertSafeImageDimensions(encodedDimensions);
    const decodeSize = encodedDimensions
      ? fitWithinEdge(encodedDimensions.width, encodedDimensions.height, IMAGE_COMPRESSION_EDGE)
      : null;
    const shouldResizeWhileDecoding =
      !!decodeSize &&
      !!encodedDimensions &&
      (decodeSize.width !== encodedDimensions.width || decodeSize.height !== encodedDimensions.height);
    if (shouldResizeWhileDecoding && decodeSize) {
      bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
        resizeWidth: decodeSize.width,
        resizeHeight: decodeSize.height,
        resizeQuality: "high",
      });
    } else {
      bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    }
    assertSafeImageDimensions(bitmap);
    const shouldCompress =
      shouldAlwaysConvert ||
      blob.size > IMAGE_COMPRESSION_SOURCE_BYTES ||
      shouldResizeWhileDecoding ||
      bitmap.width > IMAGE_COMPRESSION_EDGE ||
      bitmap.height > IMAGE_COMPRESSION_EDGE;

    if (!shouldCompress) {
      return {
        type: blob.type || "image/png",
        data: await readBlobAsDataUrl(blob),
        name: displayName,
        resized: false,
      };
    }

    let compressed: Blob | null = null;
    for (const attempt of COMPRESSION_ATTEMPTS) {
      compressed = await renderBitmapAsJpeg(bitmap, attempt.edge, attempt.quality);
      if (compressed.size <= IMAGE_COMPRESSION_TARGET_BYTES) break;
    }

    if (!compressed || compressed.size > IMAGE_COMPRESSION_TARGET_BYTES) {
      throw new Error("Image attachment remains too large after compression");
    }

    return {
      type: "image/jpeg",
      data: await readBlobAsDataUrl(compressed),
      name: replaceExtension(displayName, "jpg"),
      resized: true,
    };
  } finally {
    bitmap?.close();
  }
}
