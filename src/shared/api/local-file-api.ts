import { convertFileSrc } from "@tauri-apps/api/core";
import { invokeTauri } from "./tauri-client";
import { remoteHeaders, remoteRuntimeTarget, type RuntimeTarget } from "./remote-runtime";

export const USER_BACKGROUND_URL_PREFIX = "marinara-background:";
export const GAME_ASSET_URL_PREFIX = "marinara-game-asset:";
const LOREBOOK_IMAGE_URL_PREFIX = "marinara-lorebook-image:";

type PathResponse = { path?: string | null };
type RemoteManagedAsset = {
  url: string;
  target: RuntimeTarget;
};

type RemoteAssetObjectUrlEntry = {
  promise: Promise<string>;
  objectUrl?: string;
};

const remoteAssetObjectUrls = new Map<string, RemoteAssetObjectUrlEntry>();

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

type RemoteManagedAssetKind = "avatar" | "background" | "font" | "game" | "lorebook";

function remoteManagedAsset(kind: RemoteManagedAssetKind, path: string | null | undefined): RemoteManagedAsset | null {
  const target = remoteRuntimeTarget();
  if (!target || !path?.trim()) return null;
  const encodedPath = path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map(encodeURIComponent)
    .join("/");
  return encodedPath ? { url: `${target.baseUrl}/api/assets/${kind}/${encodedPath}`, target } : null;
}

function remoteManagedAssetUrl(kind: RemoteManagedAssetKind, path: string | null | undefined): string | null {
  const asset = remoteManagedAsset(kind, path);
  if (!asset || asset.target.authorization) return null;
  return asset.url;
}

async function remoteManagedAssetResolvableUrl(
  kind: RemoteManagedAssetKind,
  path: string | null | undefined,
): Promise<string | null> {
  const asset = remoteManagedAsset(kind, path);
  if (!asset) return null;
  if (!asset.target.authorization) return asset.url;
  return fetchRemoteManagedAssetBlobUrl(asset);
}

async function fetchRemoteManagedAssetBlobUrl(asset: RemoteManagedAsset): Promise<string> {
  const cacheKey = remoteManagedAssetCacheKey(asset);
  const cached = remoteAssetObjectUrls.get(cacheKey);
  if (cached) return cached.promise;

  const entry: RemoteAssetObjectUrlEntry = { promise: Promise.resolve("") };
  entry.promise = (async () => {
    const response = await fetch(asset.url, {
      method: "GET",
      headers: remoteHeaders(asset.target),
    });
    if (!response.ok) {
      throw new Error(`Remote managed asset returned ${response.status}`);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    entry.objectUrl = objectUrl;
    return objectUrl;
  })();

  remoteAssetObjectUrls.set(cacheKey, entry);
  entry.promise.catch(() => {
    if (remoteAssetObjectUrls.get(cacheKey) === entry) {
      remoteAssetObjectUrls.delete(cacheKey);
    }
  });
  return entry.promise;
}

function remoteManagedAssetCacheKey(asset: RemoteManagedAsset): string {
  return `${asset.target.baseUrl}\0${asset.target.authorization ?? ""}\0${asset.url}`;
}

function revokeRemoteAssetObjectUrl(entry: RemoteAssetObjectUrlEntry): void {
  if (entry.objectUrl && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(entry.objectUrl);
  }
}

function deleteRemoteAssetObjectUrl(cacheKey: string): void {
  const entry = remoteAssetObjectUrls.get(cacheKey);
  if (!entry) return;
  remoteAssetObjectUrls.delete(cacheKey);
  if (entry.objectUrl) {
    revokeRemoteAssetObjectUrl(entry);
    return;
  }
  entry.promise
    .then((objectUrl) => {
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectUrl);
      }
    })
    .catch(() => {});
}

export function invalidateRemoteManagedAssetObjectUrls(kind?: RemoteManagedAssetKind, path?: string | null): void {
  if (kind && path) {
    const asset = remoteManagedAsset(kind, path);
    if (asset) deleteRemoteAssetObjectUrl(remoteManagedAssetCacheKey(asset));
    return;
  }
  if (kind) {
    const routeMarker = `/api/assets/${kind}/`;
    for (const cacheKey of [...remoteAssetObjectUrls.keys()]) {
      if (cacheKey.includes(routeMarker)) {
        deleteRemoteAssetObjectUrl(cacheKey);
      }
    }
    return;
  }

  for (const cacheKey of [...remoteAssetObjectUrls.keys()]) {
    deleteRemoteAssetObjectUrl(cacheKey);
  }
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

export function avatarFileUrlFromPath(
  filename: string | null | undefined,
  absolutePath?: string | null,
): string | null {
  const remoteUrl = remoteManagedAssetUrl("avatar", filename?.trim() || filenameFromPath(absolutePath));
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : null;
}

export async function resolveGameAssetFileUrl(path: string): Promise<string> {
  const remoteUrl = await remoteManagedAssetResolvableUrl("game", path);
  if (remoteUrl) return remoteUrl;
  const response = await invokeTauri<PathResponse>("game_assets_file_path", { path });
  return filePathToAssetUrl(response.path ?? "");
}

export async function resolveBackgroundFileUrl(filename: string): Promise<string> {
  const remoteUrl = await remoteManagedAssetResolvableUrl("background", filename);
  if (remoteUrl) return remoteUrl;
  const response = await invokeTauri<PathResponse>("background_file_path", { filename });
  return filePathToAssetUrl(response.path ?? "");
}

export async function resolveFontFileUrl(filename: string, absolutePath?: string | null): Promise<string> {
  const remoteUrl = await remoteManagedAssetResolvableUrl("font", filename);
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : "";
}

export async function resolveAvatarFileUrl(
  filename: string | null | undefined,
  absolutePath?: string | null,
): Promise<string | null> {
  const remoteUrl = await remoteManagedAssetResolvableUrl("avatar", filename?.trim() || filenameFromPath(absolutePath));
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : null;
}

async function resolveLorebookImageFileUrl(filename: string): Promise<string> {
  const remoteUrl = await remoteManagedAssetResolvableUrl("lorebook", filename);
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
