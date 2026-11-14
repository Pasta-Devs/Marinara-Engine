// Pictures Professor Mari asked to look at. Her tools return text, so `mari images` puts the pictures here and
// writes a short marker in its output; the pi runtime swaps the marker for the pictures themselves, which reach the
// model like pictures the user attached. Without this she picked "the best" of several versions blind.
import { randomUUID } from "node:crypto";
import { getSharp } from "../image/sharp-runtime.js";

export type LookImage = { data: string; mimeType: string };

/** Big enough to judge composition, colour and edges; small enough that a few cost little. */
const LOOK_MAX_SIDE = 1024;
const MAX_PICTURES_PER_LOOK = 4;
const KEEP_MS = 10 * 60 * 1000;
const MARKER = /\[mari-look:([0-9a-f-]{36})\]/giu;

const stash = new Map<string, { images: LookImage[]; at: number }>();

function prune(now: number) {
  for (const [id, entry] of stash) if (now - entry.at > KEEP_MS) stash.delete(id);
}

/** Small pictures (stickers, weather sprites) are enlarged to this so their colours and outlines can be judged. */
const LOOK_MIN_SIDE = 384;
/** See-through parts are shown on mid grey: on white or black, white art and pastel outlines vanish. */
const SEE_THROUGH = { r: 128, g: 128, b: 128 };

/**
 * A copy for the model to look at, at most 1024 px and at least 384 px on the longest side. A picture with
 * transparency is laid on mid grey (cleared backgrounds then show as grey) and sent as PNG; anything else as JPEG.
 * Before, a 48 px snowflake reached the model at 48 px and its pink outline looked white.
 */
export async function lookCopy(buffer: Buffer): Promise<LookImage | null> {
  try {
    const sharp = await getSharp();
    const image = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();
    const meta = await image.metadata();
    const longest = Math.max(Number(meta.width ?? 0), Number(meta.height ?? 0));
    const resized =
      longest > 0 && longest < LOOK_MIN_SIDE
        ? image.resize(LOOK_MIN_SIDE, LOOK_MIN_SIDE, {
            fit: "inside",
            kernel: longest <= 96 ? "nearest" : "lanczos3",
          })
        : image.resize(LOOK_MAX_SIDE, LOOK_MAX_SIDE, { fit: "inside", withoutEnlargement: true });
    if (meta.hasAlpha) {
      return {
        data: (await resized.flatten({ background: SEE_THROUGH }).png().toBuffer()).toString("base64"),
        mimeType: "image/png",
      };
    }
    return { data: (await resized.jpeg({ quality: 82 }).toBuffer()).toString("base64"), mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}

/** Keeps the pictures for the next tool result and returns the marker to put in the command's output. */
export function stashLookImages(images: Array<LookImage | null>): string | null {
  const kept = images.filter((image): image is LookImage => !!image).slice(0, MAX_PICTURES_PER_LOOK);
  if (kept.length === 0) return null;
  const now = Date.now();
  prune(now);
  const id = randomUUID();
  stash.set(id, { images: kept, at: now });
  return `[mari-look:${id}]`;
}

/** Takes the pictures a tool output points at (each only once) and returns the output without the markers. */
export function takeLookImages(text: string): { text: string; images: LookImage[] } {
  const images: LookImage[] = [];
  const cleaned = text.replace(MARKER, (_match, id: string) => {
    const entry = stash.get(id.toLowerCase());
    if (entry) {
      stash.delete(id.toLowerCase());
      images.push(...entry.images);
    }
    return "";
  });
  return { text: images.length > 0 || cleaned !== text ? cleaned : text, images };
}
