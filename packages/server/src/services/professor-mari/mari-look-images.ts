// Copies of pictures for Professor Mari to look at. `mari images look`, generate, edit and adjust return them on the
// command result's `images` (data URLs, #9342); her runtime attaches them to her next request, like pictures the user
// attached. Without this she picked "the best" of several versions blind.
import { getSharp } from "../image/sharp-runtime.js";

export type LookImage = {
  data: string;
  mimeType: string;
  /** The picture's own size and the size the model gets, as "WxH" (null when unknown). */
  original: string | null;
  sent: string;
};

/** Big enough to judge composition, colour and edges; small enough that a few cost little. */
const LOOK_MAX_SIDE = 1024;

/** Small pictures (stickers, weather sprites) are enlarged to this so their colours and outlines can be judged. */
const LOOK_MIN_SIDE = 384;
/** See-through parts are shown on mid grey: on white or black, white art and pastel outlines vanish. */
const SEE_THROUGH = { r: 128, g: 128, b: 128 };

/**
 * A copy for the model to look at, at most 1024 px and at least 384 px on the longest side. A picture with
 * transparency is laid on mid grey (cleared backgrounds then show as grey) and sent as PNG; anything else as JPEG.
 * Before, a 48 px snowflake reached the model at 48 px and its pink outline looked white.
 */
export async function lookCopy(buffer: Buffer, maxSide = LOOK_MAX_SIDE): Promise<LookImage | null> {
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
        : image.resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
    const original = meta.width && meta.height ? `${meta.width}x${meta.height}` : null;
    const { data, info } = await (
      meta.hasAlpha ? resized.flatten({ background: SEE_THROUGH }).png() : resized.jpeg({ quality: 82 })
    ).toBuffer({ resolveWithObject: true });
    return {
      data: data.toString("base64"),
      mimeType: meta.hasAlpha ? "image/png" : "image/jpeg",
      original,
      sent: `${info.width}x${info.height}`,
    };
  } catch {
    return null;
  }
}

/** Data URLs for a command result's `images`, skipping pictures that couldn't be read. */
export function lookDataUrls(copies: Array<LookImage | null>): string[] {
  return copies.filter((copy): copy is LookImage => !!copy).map((copy) => `data:${copy.mimeType};base64,${copy.data}`);
}
