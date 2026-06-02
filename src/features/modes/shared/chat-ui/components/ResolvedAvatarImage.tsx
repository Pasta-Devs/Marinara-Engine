import { forwardRef, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  avatarFileUrlFromPath,
  avatarThumbnailFileUrlFromPath,
  canGenerateAvatarThumbnail,
  resolveAvatarFileUrl,
  resolveAvatarThumbnailFileUrl,
} from "../../../../../shared/api/local-file-api";

const RESOLVED_AVATAR_SRC_CACHE_LIMIT = 128;
const resolvedAvatarSrcCache = new Map<string, string>();

function readCachedResolvedAvatarSrc(key: string): string | null {
  return resolvedAvatarSrcCache.get(key) ?? null;
}

function rememberResolvedAvatarSrc(key: string, src: string | null): void {
  resolvedAvatarSrcCache.delete(key);
  if (!src) return;
  resolvedAvatarSrcCache.set(key, src);
  while (resolvedAvatarSrcCache.size > RESOLVED_AVATAR_SRC_CACHE_LIMIT) {
    const oldestKey = resolvedAvatarSrcCache.keys().next().value;
    if (!oldestKey) break;
    resolvedAvatarSrcCache.delete(oldestKey);
  }
}

function hasText(value: string | null | undefined): boolean {
  return !!value?.trim();
}

function isLikelyFilesystemPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return (
    /^[a-z]:\//i.test(normalized) ||
    normalized.startsWith("//") ||
    /^\/(Users|home|var|data|tmp|opt|private)\//i.test(normalized)
  );
}

export const ResolvedAvatarImage = forwardRef<
  HTMLImageElement,
  {
    src?: string | null;
    avatarFilePath?: string | null;
    avatarFilename?: string | null;
    alt: string;
    loading?: "eager" | "lazy";
    decoding?: "sync" | "async" | "auto";
    draggable?: boolean;
    "aria-hidden"?: boolean | "true" | "false";
    className?: string;
    style?: CSSProperties;
    thumbnailSize?: 64 | 96 | 128 | 256;
    onResolvedSrc?: (src: string | null) => void;
  }
>(function ResolvedAvatarImage(
  {
    src,
    avatarFilePath,
    avatarFilename,
    alt,
    loading = "lazy",
    decoding = "async",
    draggable,
    "aria-hidden": ariaHidden,
    className,
    style,
    thumbnailSize,
    onResolvedSrc,
  },
  ref,
) {
  const hasManagedAvatar = hasText(avatarFilename) || hasText(avatarFilePath);
  const effectiveThumbnailSize =
    thumbnailSize && canGenerateAvatarThumbnail(avatarFilename, avatarFilePath, src) ? thumbnailSize : undefined;
  const hasResolvableAvatar = hasManagedAvatar || Boolean(effectiveThumbnailSize);
  const fallbackSrc = useMemo(() => {
    if (!src) return null;
    return hasManagedAvatar && isLikelyFilesystemPath(src) ? null : src;
  }, [hasManagedAvatar, src]);
  const immediateSrc = useMemo(() => {
    if (!hasManagedAvatar) return fallbackSrc;
    const syncUrl = effectiveThumbnailSize
      ? avatarThumbnailFileUrlFromPath(avatarFilename, avatarFilePath, effectiveThumbnailSize, src)
      : avatarFileUrlFromPath(avatarFilename, avatarFilePath);
    if (!syncUrl || isLikelyFilesystemPath(syncUrl)) return fallbackSrc;
    return syncUrl;
  }, [avatarFilePath, avatarFilename, effectiveThumbnailSize, fallbackSrc, hasManagedAvatar, src]);
  const resolutionKey = JSON.stringify([
    src ?? "",
    avatarFilename ?? "",
    avatarFilePath ?? "",
    effectiveThumbnailSize ?? "",
  ]);
  const cachedResolvedSrc = hasResolvableAvatar ? readCachedResolvedAvatarSrc(resolutionKey) : null;
  const [resolvedState, setResolvedState] = useState<{ key: string; src: string | null }>({
    key: resolutionKey,
    src: cachedResolvedSrc ?? immediateSrc,
  });

  useEffect(() => {
    let cancelled = false;
    if (!hasResolvableAvatar) {
      setResolvedState({ key: resolutionKey, src: fallbackSrc });
      if (!effectiveThumbnailSize) onResolvedSrc?.(fallbackSrc);
      return () => {
        cancelled = true;
      };
    }

    const cachedSrc = readCachedResolvedAvatarSrc(resolutionKey);
    const nextInitialSrc = cachedSrc ?? immediateSrc;
    setResolvedState({ key: resolutionKey, src: nextInitialSrc });
    if (nextInitialSrc && !effectiveThumbnailSize) onResolvedSrc?.(nextInitialSrc);
    const resolveSrc = effectiveThumbnailSize
      ? resolveAvatarThumbnailFileUrl(avatarFilename, avatarFilePath, effectiveThumbnailSize, src)
      : resolveAvatarFileUrl(avatarFilename, avatarFilePath);
    resolveSrc
      .then((url) => {
        if (cancelled) return;
        const next = url ?? fallbackSrc;
        rememberResolvedAvatarSrc(resolutionKey, next);
        setResolvedState({ key: resolutionKey, src: next });
        if (!effectiveThumbnailSize) onResolvedSrc?.(next);
      })
      .catch(() => {
        if (cancelled) return;
        rememberResolvedAvatarSrc(resolutionKey, null);
        setResolvedState({ key: resolutionKey, src: fallbackSrc });
        if (!effectiveThumbnailSize) onResolvedSrc?.(fallbackSrc);
      });

    return () => {
      cancelled = true;
    };
  }, [
    avatarFilePath,
    avatarFilename,
    effectiveThumbnailSize,
    fallbackSrc,
    hasResolvableAvatar,
    immediateSrc,
    onResolvedSrc,
    resolutionKey,
    src,
  ]);

  const imageSrc =
    resolvedState.key === resolutionKey
      ? (resolvedState.src ?? cachedResolvedSrc ?? immediateSrc)
      : (cachedResolvedSrc ?? immediateSrc);
  if (!imageSrc) return null;

  return (
    <img
      ref={ref}
      src={imageSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      draggable={draggable}
      aria-hidden={ariaHidden}
      className={className}
      style={style}
    />
  );
});
