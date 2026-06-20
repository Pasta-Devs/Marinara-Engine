// ──────────────────────────────────────────────
// Game asset URL helpers
// ──────────────────────────────────────────────

export const GAME_ASSET_FILE_URL_PREFIX = "/api/game-assets/file/";

export function encodeGameAssetPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function gameAssetFileUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  return `${GAME_ASSET_FILE_URL_PREFIX}${encodeGameAssetPath(path)}`;
}

export async function resolveGameAssetFileUrl(path: string | null | undefined): Promise<string | null> {
  return gameAssetFileUrl(path);
}
