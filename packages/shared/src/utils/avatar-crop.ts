// ──────────────────────────────────────────────
// Avatar Crop Normalization
// ──────────────────────────────────────────────
import type { AvatarCrop } from "../types/avatar-crop.js";

/** Tolerant normalization for persisted avatar crops. Accepts either the
 *  current source-rectangle shape (`srcX/srcY/srcWidth/srcHeight`) or the legacy
 *  zoom+offset shape (`zoom/offsetX/offsetY` with optional `fullImage`), stored
 *  either as a plain object or as a JSON-encoded string (the persona row
 *  format). Malformed or out-of-bounds values return `null` — never throw — so
 *  callers fall back to the uncropped render.
 *
 *  Current-shape geometry must be finite with positive dimensions and stay
 *  inside the normalized source bounds (non-negative origin, extent within
 *  `1.001` to absorb float rounding); legacy shapes need finite zoom/offset
 *  with positive zoom. */
export function normalizeAvatarCrop(value: unknown): AvatarCrop | null {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    if (!parsed.trim()) return null;
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const crop = parsed as Record<string, unknown>;
  const finite = (entry: unknown): entry is number => typeof entry === "number" && Number.isFinite(entry);
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(crop, key);
  const hasLegacyFields = ["zoom", "offsetX", "offsetY", "fullImage"].some(hasOwn);
  const hasSourceRectFields = ["srcX", "srcY", "srcWidth", "srcHeight"].some(hasOwn);

  if (
    !hasLegacyFields &&
    finite(crop.srcX) &&
    finite(crop.srcY) &&
    finite(crop.srcWidth) &&
    finite(crop.srcHeight) &&
    crop.srcWidth > 0 &&
    crop.srcHeight > 0 &&
    crop.srcX >= 0 &&
    crop.srcY >= 0 &&
    crop.srcX + crop.srcWidth <= 1.001 &&
    crop.srcY + crop.srcHeight <= 1.001
  ) {
    return { srcX: crop.srcX, srcY: crop.srcY, srcWidth: crop.srcWidth, srcHeight: crop.srcHeight };
  }
  if (
    !hasSourceRectFields &&
    finite(crop.zoom) &&
    finite(crop.offsetX) &&
    finite(crop.offsetY) &&
    crop.zoom > 0 &&
    (crop.fullImage === undefined || typeof crop.fullImage === "boolean")
  ) {
    return {
      zoom: crop.zoom,
      offsetX: crop.offsetX,
      offsetY: crop.offsetY,
      ...(crop.fullImage === true ? { fullImage: true } : {}),
    };
  }
  return null;
}
