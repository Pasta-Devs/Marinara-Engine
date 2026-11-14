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

/** A smaller copy for the model to look at: PNG when it has transparency (so cleared backgrounds show), else JPEG. */
export async function lookCopy(buffer: Buffer): Promise<LookImage | null> {
  try {
    const sharp = await getSharp();
    const image = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();
    const meta = await image.metadata();
    const resized = image.resize(LOOK_MAX_SIDE, LOOK_MAX_SIDE, { fit: "inside", withoutEnlargement: true });
    if (meta.hasAlpha) {
      return { data: (await resized.png().toBuffer()).toString("base64"), mimeType: "image/png" };
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
