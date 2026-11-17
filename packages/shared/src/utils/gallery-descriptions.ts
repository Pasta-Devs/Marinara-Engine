// ──────────────────────────────────────────────
// Gallery picture descriptions: a short note on what a picture shows, written by
// hand or by the Image reading model. Every gallery keeps one per picture.
// Custom emojis and stickers use it to pick and explain them in Conversation.
// ──────────────────────────────────────────────

/** Longest description a picture keeps. */
export const GALLERY_DESCRIPTION_MAX_LENGTH = 500;

/** The galleries a description can be written in. */
export type GalleryDescriptionScope = "chat" | "character" | "persona" | "global" | "emoji" | "sticker";

export const GALLERY_DESCRIPTION_SCOPES: readonly GalleryDescriptionScope[] = [
  "chat",
  "character",
  "persona",
  "global",
  "emoji",
  "sticker",
];

/** Most pictures one "Describe with AI" request handles; the app sends bigger selections in parts. */
export const GALLERY_DESCRIBE_BATCH_MAX = 8;

export function isGalleryDescriptionScope(value: unknown): value is GalleryDescriptionScope {
  return typeof value === "string" && (GALLERY_DESCRIPTION_SCOPES as readonly string[]).includes(value);
}

/** A description, cleaned: control characters and runs of spaces collapsed, capped. Empty text means none. */
export function normalizeGalleryDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) return null;
  if (text.length <= GALLERY_DESCRIPTION_MAX_LENGTH) return text;
  return `${text.slice(0, GALLERY_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`;
}

/** A description shortened for a prompt line, cut at a word where it can be. */
export function shortGalleryDescription(value: string | null | undefined, maxLength = 100): string {
  const text = normalizeGalleryDescription(value) ?? "";
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > maxLength * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
