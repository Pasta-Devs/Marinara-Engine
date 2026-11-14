// ──────────────────────────────────────────────
// Gallery picture labels: custom emoji, custom sticker, or chat background.
//
// Emoji and stickers carry a `:slug:` name. A background carries the places it
// shows instead, as free text ("John's bedroom, John's room"); it may be empty.
// ──────────────────────────────────────────────

export type GalleryTagKind = "emoji" | "sticker" | "background";

export const GALLERY_TAG_KINDS: readonly GalleryTagKind[] = ["emoji", "sticker", "background"];

/** Longest place-name text a background label keeps. */
export const GALLERY_BACKGROUND_PLACES_MAX_LENGTH = 240;

export function isGalleryTagKind(value: unknown): value is GalleryTagKind {
  return typeof value === "string" && (GALLERY_TAG_KINDS as readonly string[]).includes(value);
}

/** A background label's place names, cleaned: one line, no control characters, capped. */
export function normalizeGalleryBackgroundPlaces(value: unknown): string {
  if (typeof value !== "string") return "";
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, GALLERY_BACKGROUND_PLACES_MAX_LENGTH)
      .trim()
  );
}

/** The places a background label names, one per comma or semicolon. */
export function galleryBackgroundPlaceList(value: unknown): string[] {
  return Array.from(
    new Set(
      normalizeGalleryBackgroundPlaces(value)
        .split(/[,;]/u)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );
}
