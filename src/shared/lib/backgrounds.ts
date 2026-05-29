// ──────────────────────────────────────────────
// Chat background URL <-> metadata helpers
// ──────────────────────────────────────────────

import {
  GAME_ASSET_URL_PREFIX,
  USER_BACKGROUND_URL_PREFIX,
  decodeLocalAssetPath,
  gameAssetUrl,
  userBackgroundUrl,
} from "../api/local-file-api";

const GAME_ASSET_BACKGROUND_META_PREFIX = "gameAsset:";

export function chatBackgroundMetadataToUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const background = value.trim();
  if (!background) return null;

  if (background.startsWith(USER_BACKGROUND_URL_PREFIX) || background.startsWith(GAME_ASSET_URL_PREFIX)) {
    return background;
  }
  if (/^(https?:|data:|blob:)/i.test(background) || background.startsWith("/")) {
    return background;
  }

  if (background.startsWith(GAME_ASSET_BACKGROUND_META_PREFIX)) {
    const assetPath = background.slice(GAME_ASSET_BACKGROUND_META_PREFIX.length).replace(/^\/+/, "");
    return assetPath ? gameAssetUrl(assetPath) : null;
  }

  return userBackgroundUrl(background);
}

export function chatBackgroundUrlToMetadata(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith(USER_BACKGROUND_URL_PREFIX)) {
    return decodeLocalAssetPath(url.slice(USER_BACKGROUND_URL_PREFIX.length));
  }

  if (url.startsWith(GAME_ASSET_URL_PREFIX)) {
    const assetPath = decodeLocalAssetPath(url.slice(GAME_ASSET_URL_PREFIX.length)).replace(/^\/+/, "");
    return assetPath ? `${GAME_ASSET_BACKGROUND_META_PREFIX}${assetPath}` : null;
  }

  return url;
}
