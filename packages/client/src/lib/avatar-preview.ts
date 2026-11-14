import { AVATAR_CARD_PREVIEW_WIDTH, BACKGROUND_THUMBNAIL_WIDTH } from "@marinara-engine/shared";

const AVATAR_FILE_PREFIX = "/api/avatars/file/";

/**
 * A downscaled copy of an uploaded avatar for places that show it small: "card" for Library
 * cards, "icon" for list rows and pickers. Character cards are often multi-MB PNGs, and a
 * Library page full of them kept a phone or tablet busy downloading for seconds, holding up
 * the request that opens the character. Other sources (data URLs, remote links) pass through.
 */
export function avatarPreviewSrc<T extends string | null | undefined>(src: T, size: "card" | "icon"): T {
  if (!src || !src.startsWith(AVATAR_FILE_PREFIX) || /[?&]w=/.test(src)) return src;
  const width = size === "card" ? AVATAR_CARD_PREVIEW_WIDTH : BACKGROUND_THUMBNAIL_WIDTH;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}` as T;
}
