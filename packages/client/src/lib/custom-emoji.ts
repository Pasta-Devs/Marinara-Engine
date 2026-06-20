// ──────────────────────────────────────────────
// Custom emoji / sticker tagging — shared model + client-side validation
// ──────────────────────────────────────────────

export type CustomKind = "emoji" | "sticker";

/** Patch sent when tagging, renaming, switching kind, or clearing a tag. */
export type CustomTagPatch = {
  customKind: CustomKind | null;
  customName: string | null;
  width?: number;
  height?: number;
};

export type CustomKindValidation = { ok: true } | { ok: false; reason: string };

/** Max pixel dimension (applies to BOTH width and height) per kind. */
const CUSTOM_KIND_MAX_DIMENSION: Record<CustomKind, number> = {
  emoji: 256,
  sticker: 512,
};

const CUSTOM_NAME_MAX_LENGTH = 32;

/** Normalize a raw name into a `:slug:`-safe token. Returns "" if nothing usable. */
export function slugifyCustomName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CUSTOM_NAME_MAX_LENGTH);
}

/** Reject an image whose width or height exceeds the kind's max dimension. */
export function validateDimensionsForKind(width: number, height: number, kind: CustomKind): CustomKindValidation {
  const max = CUSTOM_KIND_MAX_DIMENSION[kind];
  if (width <= max && height <= max) return { ok: true };
  const label = kind === "emoji" ? "an emoji" : "a sticker";
  let reason = `Too large for ${label} — max ${max}×${max}px (this image is ${width}×${height}).`;
  if (
    kind === "emoji" &&
    width <= CUSTOM_KIND_MAX_DIMENSION.sticker &&
    height <= CUSTOM_KIND_MAX_DIMENSION.sticker
  ) {
    reason += " It fits as a sticker, though.";
  }
  return { ok: false, reason };
}

/** Read an image's natural pixel dimensions by loading it. */
export function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
