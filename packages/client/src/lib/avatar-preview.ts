import {
  AVATAR_CARD_PREVIEW_WIDTH,
  AVATAR_ROW_PREVIEW_WIDTH,
  BACKGROUND_THUMBNAIL_WIDTH,
} from "@marinara-engine/shared";

const AVATAR_FILE_PREFIX = "/api/avatars/file/";

/**
 * A downscaled copy of an uploaded avatar for places that show it small: "card" for Library
 * cards, "icon" for medium pictures (Home's character spotlight), "row" for list rows, pickers and
 * the persona button. Character cards are often multi-MB PNGs, and a Library page full of them
 * kept a phone or tablet busy downloading for seconds, holding up the request that opens the
 * character; 40 chat rows at 320 px kept an iPad decoding pictures on every sidebar open (Nov 14).
 * Other sources (data URLs, remote links) pass through.
 */
export function avatarPreviewSrc<T extends string | null | undefined>(src: T, size: "card" | "icon" | "row"): T {
  if (!src || !src.startsWith(AVATAR_FILE_PREFIX) || /[?&]w=/.test(src)) return src;
  const width =
    size === "card"
      ? AVATAR_CARD_PREVIEW_WIDTH
      : size === "row"
        ? AVATAR_ROW_PREVIEW_WIDTH
        : BACKGROUND_THUMBNAIL_WIDTH;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}` as T;
}
