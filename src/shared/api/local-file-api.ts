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
const pendingAvatarThumbnailResolutions = new Map<string, Promise<string | null>>();
let activeAvatarThumbnailResolutions = 0;
const queuedAvatarThumbnailResolutions: Array<() => void> = [];
const MAX_ACTIVE_AVATAR_THUMBNAIL_RESOLUTIONS = 2;

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

type RemoteManagedAssetKind =
  | "avatar"
  | "avatar-thumbnail"
  | "background"
  | "font"
  | "gallery"
  | "game"
  | "lorebook"
  | "sprite";

function remoteManagedAsset(
  kind: RemoteManagedAssetKind,
  path: string | null | undefined,
  query?: string,
): RemoteManagedAsset | null {
  const target = remoteRuntimeTarget();
  if (!target || !path?.trim()) return null;
  const encodedPath = path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map(encodeURIComponent)
    .join("/");
  const querySuffix = query ? `?${query}` : "";
  return encodedPath ? { url: `${target.baseUrl}/api/assets/${kind}/${encodedPath}${querySuffix}`, target } : null;
}

function remoteManagedAssetUrl(
  kind: RemoteManagedAssetKind,
  path: string | null | undefined,
  query?: string,
): string | null {
  const asset = remoteManagedAsset(kind, path, query);
  if (!asset || asset.target.authorization) return null;
  return asset.url;
}

async function remoteManagedAssetResolvableUrl(
  kind: RemoteManagedAssetKind,
  path: string | null | undefined,
  query?: string,
): Promise<string | null> {
  const asset = remoteManagedAsset(kind, path, query);
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

function managedAvatarPathFromAbsolutePath(path: string | null | undefined): string | null {
  const value = path?.trim();
  if (!value) return null;
  const normalized = value.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const marker = "/avatars/";
  const markerIndex = lower.lastIndexOf(marker);
  const relative =
    markerIndex >= 0
      ? normalized.slice(markerIndex + marker.length)
      : lower.startsWith("avatars/")
        ? normalized.slice("avatars/".length)
        : null;
  if (!relative) return null;
  const segments = relative
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || segment.includes(":"))) {
    return null;
  }
  const collection = segments[0];
  if (!collection || !["characters", "personas", "character-groups", "persona-groups", "npc"].includes(collection)) {
    return null;
  }
  return segments.join("/");
}

function avatarRemoteManagedPath(
  filename: string | null | undefined,
  absolutePath: string | null | undefined,
): string | null {
  return managedAvatarPathFromAbsolutePath(absolutePath) ?? filename?.trim() ?? filenameFromPath(absolutePath);
}

function pathExtension(value: string | null | undefined): string | null {
  const filename = filenameFromPath(value);
  const extension = filename?.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== filename?.toLowerCase() ? extension : null;
}

function inlineImageDataUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(trimmed)) return trimmed;
  const wrapped = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/(data:image\/(?:png|jpe?g|webp|gif);base64,.*)$/i);
  return wrapped?.[1] ?? null;
}

function inlineAvatarThumbnailRemotePath(path: string | null | undefined, size: number): string | null {
  const filename = path
    ?.replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop();
  if (!filename || !/^[a-f0-9]{64}\.thumb\.png$/i.test(filename)) return null;
  return `${size}/inline/${filename}`;
}

function hashCacheInput(value: string | null | undefined): string {
  const input = value ?? "";
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length}:${(hash >>> 0).toString(16)}`;
}

function avatarThumbnailResolutionCacheKey(
  filename: string | null | undefined,
  absolutePath: string | null | undefined,
  size: number,
  sourceUrl: string | null,
): string {
  const target = remoteRuntimeTarget();
  return [
    target ? `${target.baseUrl}\0${target.authorization ?? ""}` : "embedded",
    filename?.trim() ?? "",
    absolutePath?.trim() ?? "",
    String(size),
    hashCacheInput(sourceUrl),
  ].join("\0");
}

function scheduleAvatarThumbnailResolution<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeAvatarThumbnailResolutions += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeAvatarThumbnailResolutions -= 1;
          queuedAvatarThumbnailResolutions.shift()?.();
        });
    };
    if (activeAvatarThumbnailResolutions < MAX_ACTIVE_AVATAR_THUMBNAIL_RESOLUTIONS) {
      run();
      return;
    }
    queuedAvatarThumbnailResolutions.push(run);
  });
}

export function canGenerateAvatarThumbnail(
  filename: string | null | undefined,
  absolutePath?: string | null,
  sourceUrl?: string | null,
): boolean {
  const extension = pathExtension(filename) ?? pathExtension(absolutePath);
  return (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "webp" ||
    extension === "gif" ||
    !!inlineImageDataUrl(sourceUrl)
  );
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
  const remoteUrl = remoteManagedAssetUrl("avatar", avatarRemoteManagedPath(filename, absolutePath));
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : null;
}

function galleryRemoteManagedPath(
  filename: string | null | undefined,
  absolutePath: string | null | undefined,
): string | null {
  return filename?.trim() || filenameFromPath(absolutePath);
}

export function avatarThumbnailFileUrlFromPath(
  filename: string | null | undefined,
  absolutePath?: string | null,
  size = 128,
  sourceUrl?: string | null,
): string | null {
  const path = avatarRemoteManagedPath(filename, absolutePath);
  const remoteUrl = remoteManagedAssetUrl("avatar-thumbnail", path ? `${size}/${path}` : null);
  if (!remoteUrl && inlineImageDataUrl(sourceUrl)) return null;
  return remoteUrl;
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
  const remoteUrl = await remoteManagedAssetResolvableUrl("avatar", avatarRemoteManagedPath(filename, absolutePath));
  if (remoteUrl) return remoteUrl;
  return absolutePath ? filePathToAssetUrl(absolutePath) : null;
}

export async function resolveGalleryFileUrl(
  filename: string | null | undefined,
  absolutePath?: string | null,
): Promise<string | null> {
  const remoteUrl = await remoteManagedAssetResolvableUrl("gallery", galleryRemoteManagedPath(filename, absolutePath));
  if (remoteUrl) return remoteUrl;
  return absolutePath && isAbsoluteFilesystemPath(absolutePath) ? filePathToAssetUrl(absolutePath) : null;
}

function spriteRemoteManagedPath(
  ownerType: string | null | undefined,
  ownerId: string | null | undefined,
  filename: string | null | undefined,
): string | null {
  const normalizedOwnerType = ownerType === "persona" ? "persona" : "character";
  const normalizedOwnerId = ownerId?.trim();
  const normalizedFilename = filename?.trim();
  if (!normalizedOwnerId || !normalizedFilename) return null;
  return `${normalizedOwnerType}/${normalizedOwnerId}/${normalizedFilename}`;
}

function cacheBustQuery(cacheKey: string | number | null | undefined): string | undefined {
  const value = String(cacheKey ?? "").trim();
  return value ? `v=${encodeURIComponent(value)}` : undefined;
}

function appendCacheBust(url: string, cacheKey: string | number | null | undefined): string {
  const query = cacheBustQuery(cacheKey);
  if (!query || url.startsWith("blob:")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

export async function resolveSpriteFileUrl(
  ownerType: string | null | undefined,
  ownerId: string | null | undefined,
  filename: string | null | undefined,
  absolutePath?: string | null,
  cacheKey?: string | number | null,
): Promise<string | null> {
  const remoteUrl = await remoteManagedAssetResolvableUrl(
    "sprite",
    spriteRemoteManagedPath(ownerType, ownerId, filename),
    cacheBustQuery(cacheKey),
  );
  if (remoteUrl) return remoteUrl;
  return absolutePath && isAbsoluteFilesystemPath(absolutePath)
    ? appendCacheBust(filePathToAssetUrl(absolutePath), cacheKey)
    : null;
}

export async function resolveAvatarThumbnailFileUrl(
  filename: string | null | undefined,
  absolutePath?: string | null,
  size = 128,
  sourceUrl?: string | null,
): Promise<string | null> {
  const normalizedSourceUrl = inlineImageDataUrl(sourceUrl);
  const cacheKey = avatarThumbnailResolutionCacheKey(filename, absolutePath, size, normalizedSourceUrl);
  const pending = pendingAvatarThumbnailResolutions.get(cacheKey);
  if (pending) return pending;
  const promise = scheduleAvatarThumbnailResolution(async () => {
    const remotePath = avatarRemoteManagedPath(filename, absolutePath);
    const remoteUrl = await remoteManagedAssetResolvableUrl(
      "avatar-thumbnail",
      remotePath ? `${size}/${remotePath}` : null,
    );
    if (remoteUrl) return remoteUrl;
    if (!filename && !absolutePath && !normalizedSourceUrl) return null;
    const response = await invokeTauri<PathResponse>("avatar_thumbnail_file_path", {
      filename,
      absolutePath,
      sourceUrl: normalizedSourceUrl,
      size,
    });
    if (normalizedSourceUrl) {
      const inlineRemoteUrl = await remoteManagedAssetResolvableUrl(
        "avatar-thumbnail",
        inlineAvatarThumbnailRemotePath(response.path, size),
      );
      if (inlineRemoteUrl) return inlineRemoteUrl;
    }
    return filePathToAssetUrl(response.path ?? "");
  });
  pendingAvatarThumbnailResolutions.set(cacheKey, promise);
  promise.finally(() => {
    if (pendingAvatarThumbnailResolutions.get(cacheKey) === promise) {
      pendingAvatarThumbnailResolutions.delete(cacheKey);
    }
  }).catch(() => {});
  return promise;
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
