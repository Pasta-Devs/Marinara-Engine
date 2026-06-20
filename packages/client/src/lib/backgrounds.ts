// ──────────────────────────────────────────────
// Chat background URL <-> metadata helpers
// ──────────────────────────────────────────────

import { GAME_ASSET_FILE_URL_PREFIX, gameAssetFileUrl } from "./game-asset-urls";

const USER_BACKGROUND_URL_PREFIX = "/api/backgrounds/file/";
const GAME_ASSET_BACKGROUND_META_PREFIX = "gameAsset:";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function chatBackgroundMetadataToUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const background = value.trim();
  if (!background) return null;

  if (background.startsWith(USER_BACKGROUND_URL_PREFIX) || background.startsWith(GAME_ASSET_FILE_URL_PREFIX)) {
    return background;
  }
  if (/^(https?:|data:|blob:)/i.test(background) || background.startsWith("/")) {
    return background;
  }

  if (background.startsWith(GAME_ASSET_BACKGROUND_META_PREFIX)) {
    const assetPath = background.slice(GAME_ASSET_BACKGROUND_META_PREFIX.length).replace(/^\/+/, "");
    return gameAssetFileUrl(assetPath);
  }

  return `${USER_BACKGROUND_URL_PREFIX}${encodeURIComponent(background)}`;
}

export function chatBackgroundUrlToMetadata(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith(USER_BACKGROUND_URL_PREFIX)) {
    return safeDecode(url.slice(USER_BACKGROUND_URL_PREFIX.length));
  }

  if (url.startsWith(GAME_ASSET_FILE_URL_PREFIX)) {
    const assetPath = safeDecode(url.slice(GAME_ASSET_FILE_URL_PREFIX.length)).replace(/^\/+/, "");
    return assetPath ? `${GAME_ASSET_BACKGROUND_META_PREFIX}${assetPath}` : null;
  }

  return url;
}

export function isManagedChatBackgroundUrl(url: string | null): boolean {
  return !!url && (url.startsWith(USER_BACKGROUND_URL_PREFIX) || url.startsWith(GAME_ASSET_FILE_URL_PREFIX));
}
