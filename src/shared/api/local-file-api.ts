import { convertFileSrc } from "@tauri-apps/api/core";
import { invokeTauri } from "./tauri-client";
import { remoteRuntimeTarget } from "./remote-runtime";

export const USER_BACKGROUND_URL_PREFIX = "marinara-background:";
export const GAME_ASSET_URL_PREFIX = "marinara-game-asset:";
const LOREBOOK_IMAGE_URL_PREFIX = "marinara-lorebook-image:";

type PathResponse = { path?: string | null };

function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function isAbsoluteFilesystemPath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\") || value.startsWith("/");
}

function canConvertFileSrc(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__?.convertFileSrc
  );
}

function encodeLocalAssetPath(path: string): string {
  return encodeURIComponent(path.replace(/\\/g, "/"));
}

export function decodeLocalAssetPath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function userBackgroundUrl(filename: string): string {
  return `${USER_BACKGROUND_URL_PREFIX}${encodeLocalAssetPath(filename)}`;
}

export function gameAssetUrl(path: string): string {
  return `${GAME_ASSET_URL_PREFIX}${encodeLocalAssetPath(path)}`;
}

function filePathToAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("asset:") || path.startsWith("http://asset.localhost")) return path;
  if (hasScheme(path) && !isAbsoluteFilesystemPath(path)) return path;
  if (!canConvertFileSrc()) return path;
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

function remoteManagedAssetUrl(
  kind: "avatar" | "background" | "font" | "game" | "lorebook",
  path: string | null | undefined,
): string | null {
  const target = remoteRuntimeTarget();
  if (!target || !path?.trim()) return null;
  const encodedPath = path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map(encodeURIComponent)
    .join("/");
  return encodedPath ? `${target.baseUrl}/api/assets/${kind}/${encodedPath}` : null;
}

function filenameFromPath(path: string | null | undefined): string | null {
  const value = path?.trim();
  if (!value) return null;
  const filename = value.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.trim();
  return filename && filename !== "." && filename !== ".." ? filename : null;
}

export function gameAssetFileUrlFromPath(path: string, absolutePath?: string | null): string {
  const remoteUrl = remoteManagedAssetUrl("game", path);
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : gameAssetUrl(path);
}

export function backgroundFileUrlFromPath(filename: string, absolutePath?: string | null): string {
  const remoteUrl = remoteManagedAssetUrl("background", filename);
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : userBackgroundUrl(filename);
}

export function fontFileUrlFromPath(filename: string, absolutePath?: string | null): string {
  const remoteUrl = remoteManagedAssetUrl("font", filename);
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : "";
}

export function avatarFileUrlFromPath(
  filename: string | null | undefined,
  absolutePath?: string | null,
): string | null {
  const remoteUrl = remoteManagedAssetUrl("avatar", filename?.trim() || filenameFromPath(absolutePath));
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : null;
}

export async function resolveGameAssetFileUrl(path: string): Promise<string> {
  const remoteUrl = remoteManagedAssetUrl("game", path);
  if (remoteUrl) return remoteUrl;
  const response = await invokeTauri<PathResponse>("game_assets_file_path", { path });
  return filePathToAssetUrl(response.path ?? "");
}

async function resolveBackgroundFileUrl(filename: string): Promise<string> {
  const remoteUrl = remoteManagedAssetUrl("background", filename);
  if (remoteUrl) return remoteUrl;
  const response = await invokeTauri<PathResponse>("background_file_path", { filename });
  return filePathToAssetUrl(response.path ?? "");
}

async function resolveLorebookImageFileUrl(filename: string): Promise<string> {
  const remoteUrl = remoteManagedAssetUrl("lorebook", filename);
  if (remoteUrl) return remoteUrl;
  const response = await invokeTauri<PathResponse>("lorebook_image_file_path", { filename });
  return filePathToAssetUrl(response.path ?? "");
}

export async function resolveManagedLocalAssetUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith(USER_BACKGROUND_URL_PREFIX)) {
    return resolveBackgroundFileUrl(decodeLocalAssetPath(url.slice(USER_BACKGROUND_URL_PREFIX.length)));
  }
  if (url.startsWith(GAME_ASSET_URL_PREFIX)) {
    return resolveGameAssetFileUrl(decodeLocalAssetPath(url.slice(GAME_ASSET_URL_PREFIX.length)));
  }
  if (url.startsWith(LOREBOOK_IMAGE_URL_PREFIX)) {
    return resolveLorebookImageFileUrl(decodeLocalAssetPath(url.slice(LOREBOOK_IMAGE_URL_PREFIX.length)));
  }
  return filePathToAssetUrl(url);
}
