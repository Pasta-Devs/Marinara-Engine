// ──────────────────────────────────────────────
// Pixelize: deterministic post-processing for AI-generated pixel art (#5096)
// ──────────────────────────────────────────────
// Image models asked for pixel art return approximately pixel art: anti-aliased
// edges, off-grid pixels, soft alpha, drifting palettes. This converts that
// probabilistic output into an asset that can sit beside authored pixel art:
// nearest-kernel downscale to the target cell size, palette quantization
// against a caller-supplied ramp, a binary alpha threshold, and a seam score
// for tileability. Everything is deterministic — same input, same bytes out —
// so results are cacheable and diffable.
import { getSharp } from "./sharp-runtime.js";

/** Hard input bounds: pixelization holds several full-resolution RGBA buffers,
 *  which on a phone is the known OOM pressure class. Reject before allocating. */
export const PIXELIZE_MAX_INPUT_DIMENSION = 4096;
export const PIXELIZE_MAX_INPUT_PIXELS = 4096 * 4096;
export const PIXELIZE_MAX_OUTPUT_DIMENSION = 512;
export const PIXELIZE_MAX_PALETTE_ENTRIES = 256;

export interface PixelizeOptions {
  /** Target output width in pixels (the "cell" size of the final asset). */
  targetWidth: number;
  /** Target output height; defaults to preserving the input aspect ratio. */
  targetHeight?: number;
  /** Palette ramp as #rrggbb entries; omitted → colors are kept, only snapped
   *  to the binary-alpha grid. */
  palette?: string[];
  /** Alpha below this becomes fully transparent, at or above fully opaque. */
  alphaThreshold?: number;
}

export interface PixelizeReport {
  width: number;
  height: number;
  paletteSize: number | null;
  /** Fraction [0..1] of edge pixels that match their wrap-around neighbour. */
  seamScoreX: number;
  seamScoreY: number;
  /** True when both seam scores clear the tileability bar. */
  tileable: boolean;
}

export interface PixelizeResult {
  png: Buffer;
  report: PixelizeReport;
}

const TILEABLE_SEAM_THRESHOLD = 0.9;

export class PixelizeInputError extends Error {}

/** libvips reports failures as plain Error messages (no codes). A memory/disk
 *  resource failure while decoding — e.g. running out of memory expanding a large
 *  but valid input to a raw RGBA buffer, the known phone/Termux pressure class — is
 *  the SERVER's fault, not a malformed request, so it must keep its 500/503 mapping
 *  rather than be reported to the caller as an invalid image (400). */
export function isResourceSharpFailure(message: string): boolean {
  return /allocat|out of memory|\benomem\b|no space left|unable to write/iu.test(message);
}

/** Run a sharp decode step, converting an *invalid-input* failure into a typed
 *  client error. A base64 string can pass route validation yet still hold invalid
 *  or truncated image data; sharp then throws from metadata()/toBuffer(), which
 *  would otherwise surface as a bare HTTP 500 instead of the route's 400. Resource
 *  failures (out of memory, disk full) and our own PixelizeInputError are rethrown
 *  unchanged so they keep their 500/503 (or 400) mapping. */
async function decodeWithSharp<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    if (error instanceof PixelizeInputError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (isResourceSharpFailure(message)) throw error;
    throw new PixelizeInputError(`Input is not a decodable image: ${message}`);
  }
}

function parsePaletteEntry(entry: string, index: number): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/iu.exec(entry.trim());
  if (!match) throw new PixelizeInputError(`Palette entry ${index} must be a #rrggbb color`);
  const hex = match[1]!;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** Channel-difference distance; deterministic and cheap. Perceptual weighting
 *  is deliberately avoided — determinism and simplicity beat nuance here. */
function nearestPaletteIndex(r: number, g: number, b: number, palette: Array<[number, number, number]>): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i]!;
    const distance = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** Fraction of opposing-edge pixel pairs that agree exactly (post-quantization,
 *  exact agreement is meaningful). */
function seamScore(data: Uint8Array, width: number, height: number, axis: "x" | "y"): number {
  let matches = 0;
  const total = axis === "x" ? height : width;
  for (let i = 0; i < total; i++) {
    const a = axis === "x" ? (i * width + 0) * 4 : (0 * width + i) * 4;
    const b = axis === "x" ? (i * width + (width - 1)) * 4 : ((height - 1) * width + i) * 4;
    if (
      data[a] === data[b] &&
      data[a + 1] === data[b + 1] &&
      data[a + 2] === data[b + 2] &&
      data[a + 3] === data[b + 3]
    ) {
      matches++;
    }
  }
  return total === 0 ? 0 : matches / total;
}

export async function pixelizeImage(input: Buffer, options: PixelizeOptions): Promise<PixelizeResult> {
  if (
    !Number.isInteger(options.targetWidth) ||
    options.targetWidth < 1 ||
    options.targetWidth > PIXELIZE_MAX_OUTPUT_DIMENSION
  ) {
    throw new PixelizeInputError(`targetWidth must be an integer between 1 and ${PIXELIZE_MAX_OUTPUT_DIMENSION}`);
  }
  if (
    options.targetHeight !== undefined &&
    (!Number.isInteger(options.targetHeight) ||
      options.targetHeight < 1 ||
      options.targetHeight > PIXELIZE_MAX_OUTPUT_DIMENSION)
  ) {
    throw new PixelizeInputError(`targetHeight must be an integer between 1 and ${PIXELIZE_MAX_OUTPUT_DIMENSION}`);
  }
  const alphaThreshold = options.alphaThreshold ?? 128;
  if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) {
    throw new PixelizeInputError("alphaThreshold must be an integer between 0 and 255");
  }
  if (options.palette && options.palette.length > PIXELIZE_MAX_PALETTE_ENTRIES) {
    throw new PixelizeInputError(`palette must have at most ${PIXELIZE_MAX_PALETTE_ENTRIES} entries`);
  }
  const palette = options.palette?.length ? options.palette.map(parsePaletteEntry) : null;

  const sharp = await getSharp();
  // Header-only read to enforce input bounds BEFORE any pixel allocation.
  const metadata = await decodeWithSharp<{ width?: number; height?: number }>(() => sharp(input).metadata());
  const inputWidth = metadata.width ?? 0;
  const inputHeight = metadata.height ?? 0;
  if (!inputWidth || !inputHeight) throw new PixelizeInputError("Input image has no readable dimensions");
  if (
    inputWidth > PIXELIZE_MAX_INPUT_DIMENSION ||
    inputHeight > PIXELIZE_MAX_INPUT_DIMENSION ||
    inputWidth * inputHeight > PIXELIZE_MAX_INPUT_PIXELS
  ) {
    throw new PixelizeInputError(
      `Input exceeds the ${PIXELIZE_MAX_INPUT_DIMENSION}px / ${PIXELIZE_MAX_INPUT_PIXELS}px² pixelize bound`,
    );
  }

  const targetWidth = options.targetWidth;
  const targetHeight = options.targetHeight ?? Math.max(1, Math.round((inputHeight / inputWidth) * targetWidth));
  // An explicit targetHeight is bounds-checked above; a height DERIVED from the input
  // aspect ratio (targetWidth only) can still exceed the output bound for a very tall
  // input (a valid 129x4096 at targetWidth 512 derives ~16257px), so reject it before
  // sharp allocates the oversized RGBA buffer below.
  if (targetHeight > PIXELIZE_MAX_OUTPUT_DIMENSION) {
    throw new PixelizeInputError(
      `The output height derived from the input aspect ratio (${targetHeight}px) exceeds the ${PIXELIZE_MAX_OUTPUT_DIMENSION}px pixelize output bound; pass an explicit targetHeight to downscale further`,
    );
  }

  const { data, info } = await decodeWithSharp<{ data: Buffer; info: { width: number; height: number } }>(() =>
    sharp(input)
      .resize(targetWidth, targetHeight, { kernel: "nearest", fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  );
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  for (let i = 0; i < pixels.length; i += 4) {
    // Binary alpha first: fully-transparent pixels are normalized to a single
    // representation so identical shapes hash identically.
    if (pixels[i + 3]! < alphaThreshold) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
      continue;
    }
    pixels[i + 3] = 255;
    if (palette) {
      const index = nearestPaletteIndex(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, palette);
      const [r, g, b] = palette[index]!;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }
  }

  const scoreX = seamScore(pixels, info.width, info.height, "x");
  const scoreY = seamScore(pixels, info.width, info.height, "y");

  const png = await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    // Deterministic RGBA encode. `palette` must stay off (and no `effort`/
    // `quality`, which implicitly enable it): indexed encoding rewrites the RGB
    // under fully-transparent pixels to an arbitrary shared palette entry.
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();

  return {
    png,
    report: {
      width: info.width,
      height: info.height,
      paletteSize: palette ? palette.length : null,
      seamScoreX: scoreX,
      seamScoreY: scoreY,
      tileable: scoreX >= TILEABLE_SEAM_THRESHOLD && scoreY >= TILEABLE_SEAM_THRESHOLD,
    },
  };
}
