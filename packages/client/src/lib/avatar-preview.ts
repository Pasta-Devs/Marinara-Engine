import { BACKGROUND_THUMBNAIL_WIDTH } from "@marinara-engine/shared";

const AVATAR_FILE_PREFIX = "/api/avatars/file/";

/**
 * A downscaled copy of an uploaded avatar for places that show it small (list rows, pickers,
 * the persona switcher). Character cards are often multi-MB PNGs, and a list full of them kept a
 * phone or tablet busy downloading for seconds, holding up the request that opens the character.
 * Other sources (data URLs, remote links) pass through.
 */
export function avatarPreviewSrc<T extends string | null | undefined>(src: T): T {
  if (!src || !src.startsWith(AVATAR_FILE_PREFIX) || /[?&]w=/.test(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}w=${BACKGROUND_THUMBNAIL_WIDTH}` as T;
}
