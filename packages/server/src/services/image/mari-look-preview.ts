import type { SharpFn } from "../../utils/sharp.js";

// Eight retained looks occupy at most ~2.8 MB as base64, leaving room for history and tools on small gateways.
const PREVIEW_BYTE_LIMIT = 256 * 1024;

/** Model-only JPEG preview. Never writes to the original asset. */
export async function prepareMariLookPreview(sharp: SharpFn, buffer: Buffer, longSide: number) {
  const source = sharp(buffer).rotate();
  const meta = await source.metadata();
  let transparent = false;
  let partial = false;
  if (meta.hasAlpha) {
    const alpha = await source.clone().extractChannel("alpha").raw().toBuffer();
    for (const value of alpha) {
      if (value < 255) transparent = true;
      if (value > 0 && value < 255) partial = true;
      if (transparent && partial) break;
    }
  }

  let edge = longSide;
  let quality = 85;
  let sizeLimited = false;
  for (;;) {
    const { data: pixels, info } = await source
      .clone()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { width: info.width, height: info.height, channels: 4 as const };
    let preview = sharp(pixels, { raw });
    if (transparent) {
      const checks = Buffer.alloc(info.width * info.height * 3);
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const shade = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? 190 : 235;
          const offset = (y * info.width + x) * 3;
          checks.fill(shade, offset, offset + 3);
        }
      }
      preview = sharp(checks, { raw: { ...raw, channels: 3 } }).composite([{ input: pixels, raw }]);
    }
    const data = await preview.jpeg({ quality }).toBuffer();
    if (data.length <= PREVIEW_BYTE_LIMIT) {
      return {
        data,
        original: meta.width && meta.height ? `${meta.width}x${meta.height}` : null,
        sent: `${info.width}x${info.height}`,
        bytes: data.length,
        sizeLimited,
        transparency: {
          present: transparent,
          partial,
          previewBackground: transparent ? "checkerboard" : null,
        },
      };
    }
    sizeLimited = true;
    if (quality > 65) quality = 65;
    else edge = Math.max(1, Math.floor(edge * 0.8));
  }
}
