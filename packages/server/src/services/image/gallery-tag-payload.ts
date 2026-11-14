// ──────────────────────────────────────────────
// Gallery labels sent by the client: emoji, sticker or background.
// ──────────────────────────────────────────────
import { isGalleryTagKind, normalizeGalleryBackgroundPlaces, type GalleryTagKind } from "@marinara-engine/shared";

const CUSTOM_NAME_RE = /^[a-z0-9_]{1,32}$/;
const CUSTOM_KIND_MAX_DIMENSION = { emoji: 256, sticker: 512 } as const;

export type GalleryTagPatch = {
  customKind: GalleryTagKind | null;
  customName: string | null;
  width?: number;
  height?: number;
};

function isValidDimension(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

/**
 * Check a label request. Emoji and stickers need a `:slug:` name and fit a size limit;
 * a background takes optional place names ("John's bedroom, John's room") and any size.
 */
export function readGalleryTagPayload(
  body: { customKind?: unknown; customName?: unknown; width?: unknown; height?: unknown } | undefined,
  options: { allowBackground: boolean },
): { patch: GalleryTagPatch } | { error: string } {
  const kind = body?.customKind ?? null;
  if (kind === null) return { patch: { customKind: null, customName: null } };
  if (!isGalleryTagKind(kind) || (kind === "background" && !options.allowBackground)) {
    return { error: "Invalid customKind" };
  }
  if (kind === "background") {
    return { patch: { customKind: kind, customName: normalizeGalleryBackgroundPlaces(body?.customName) || null } };
  }
  const name = typeof body?.customName === "string" ? body.customName.trim() : "";
  if (!CUSTOM_NAME_RE.test(name))
    return { error: "customName must use 1-32 lowercase letters, numbers, or underscores" };
  const max = CUSTOM_KIND_MAX_DIMENSION[kind];
  const { width, height } = body ?? {};
  if (width !== undefined && !isValidDimension(width, max))
    return { error: `width must be an integer from 1 to ${max}` };
  if (height !== undefined && !isValidDimension(height, max))
    return { error: `height must be an integer from 1 to ${max}` };
  return {
    patch: {
      customKind: kind,
      customName: name,
      width: typeof width === "number" ? width : undefined,
      height: typeof height === "number" ? height : undefined,
    },
  };
}
