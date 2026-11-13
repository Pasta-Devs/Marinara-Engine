// ──────────────────────────────────────────────
// A picture for a theme's package, made on the server (Professor Mari's `mari images assign
// --target theme-image`). Same rules the theme editor and import apply in the browser
// (client lib/theme-images.ts shrinkThemeImage and the decode cap in the security audit):
// raster only, at most 8192 px a side and 40 megapixels, saved as WebP no larger than 2560 px on
// the longest side, lossless when small so pixel art and 9-slice frames stay crisp.
// ──────────────────────────────────────────────
import { isAllowedImageBuffer } from "../../utils/security.js";
import { getSharp } from "./sharp-runtime.js";

export const THEME_IMAGE_MAX_SIDE = 2560;
export const THEME_IMAGE_DECODE_MAX_SIDE = 8192;
export const THEME_IMAGE_DECODE_MAX_PIXELS = 40_000_000;
const SMALL_PIXELS = 512 * 512;

/** A theme picture name as the schema allows it, always ending in .webp (the picture is saved as WebP). */
export function themeImageName(raw: string): string {
  const base = raw
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^[^a-z0-9]+/i, "")
    .slice(0, 59);
  if (!base) throw new Error("Theme picture name needs letters or digits, e.g. --name night-sky.webp");
  return `${base}.webp`;
}

export type ThemePackageImage = { src: string; bytes: number; width: number; height: number; animated: boolean };

export async function themePackageImage(buffer: Buffer): Promise<ThemePackageImage> {
  const info = isAllowedImageBuffer(buffer);
  if (!info) throw new Error("Theme pictures must be PNG, JPEG, WebP, GIF or AVIF.");
  const sharp = await getSharp();
  const meta = await sharp(buffer, { animated: true, limitInputPixels: THEME_IMAGE_DECODE_MAX_PIXELS }).metadata();
  const width = Number(meta.width ?? 0);
  const frameHeight = Number(meta.pageHeight ?? meta.height ?? 0);
  if (!width || !frameHeight) throw new Error("The picture could not be read.");
  if (width > THEME_IMAGE_DECODE_MAX_SIDE || frameHeight > THEME_IMAGE_DECODE_MAX_SIDE) {
    throw new Error(`Theme pictures can be at most ${THEME_IMAGE_DECODE_MAX_SIDE} px on a side.`);
  }
  if (width * frameHeight > THEME_IMAGE_DECODE_MAX_PIXELS) {
    throw new Error("Theme pictures can be at most 40 megapixels.");
  }
  const animated = Number(meta.pages ?? 1) > 1;
  const small = width * frameHeight <= SMALL_PIXELS;
  const out: Buffer = await sharp(buffer, { animated, limitInputPixels: THEME_IMAGE_DECODE_MAX_PIXELS })
    .resize({
      width: THEME_IMAGE_MAX_SIDE,
      height: THEME_IMAGE_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp(small ? { lossless: true } : { quality: 86 })
    .toBuffer();
  const outMeta = await sharp(out, { animated }).metadata();
  return {
    src: `data:image/webp;base64,${out.toString("base64")}`,
    bytes: out.length,
    width: Number(outMeta.width ?? width),
    height: Number(outMeta.pageHeight ?? outMeta.height ?? frameHeight),
    animated,
  };
}
