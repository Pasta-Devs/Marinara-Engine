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

// ── Sticker and emoji sheets (gallery "Create with AI") ──

/** Most stickers or emoji one generated sheet holds; more cells get too small to read. */
export const GALLERY_STICKER_SHEET_MAX_COUNT = 16;

/** The grid a sticker or emoji sheet of `count` cells is drawn in: square-ish, never more cells than needed rows. */
export function gallerySheetGrid(count: number): { cols: number; rows: number } {
  const safe = Math.max(1, Math.min(GALLERY_STICKER_SHEET_MAX_COUNT, Math.floor(count) || 1));
  const cols = Math.ceil(Math.sqrt(safe));
  return { cols, rows: Math.ceil(safe / cols) };
}

/** Sticker or emoji names typed as a comma or line list: trimmed, deduped, capped. */
export function parseGallerySheetNames(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/u) : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    // eslint-disable-next-line no-control-regex
    const name = raw
      .replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 40);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= GALLERY_STICKER_SHEET_MAX_COUNT) break;
  }
  return names;
}
