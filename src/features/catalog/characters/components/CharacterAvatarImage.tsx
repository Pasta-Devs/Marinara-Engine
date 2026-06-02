import type { AvatarCropValue } from "../../../../shared/lib/utils";
import {
  avatarFileUrlFromPath,
  avatarThumbnailFileUrlFromPath,
  canGenerateAvatarThumbnail,
  resolveAvatarFileUrl,
  resolveAvatarThumbnailFileUrl,
} from "../../../../shared/api/local-file-api";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../shared/lib/utils";
import { getCharacterAvatarLoadingMode } from "../lib/character-avatar-loading";
import { useEffect, useRef, useState } from "react";

function resolveAvatarCrop(crop: unknown): AvatarCropValue | null {
  if (!crop) return null;
  if (typeof crop === "string") return parseAvatarCropJson(crop);
  if (typeof crop !== "object") return null;
  try {
    return parseAvatarCropJson(JSON.stringify(crop));
  } catch {
    return null;
  }
}

function isLikelyFilesystemPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return (
    /^[a-z]:\//i.test(normalized) ||
    normalized.startsWith("//") ||
    /^\/(Users|home|var|data|tmp|opt|private)\//i.test(normalized)
  );
}

function waitForImageResolveSlot(element: HTMLElement, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  const waitForViewport = new Promise<void>((resolve) => {
    if (typeof IntersectionObserver !== "function") {
      resolve();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          resolve();
        }
      },
      { rootMargin: "240px" },
    );
    signal.addEventListener(
      "abort",
      () => {
        observer.disconnect();
        resolve();
      },
      { once: true },
    );
    observer.observe(element);
  });

  return waitForViewport.then(
    () =>
      new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        const idleWindow = window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
          cancelIdleCallback?: (handle: number) => void;
        };
        const requestIdle = idleWindow.requestIdleCallback;
        let handle: number | null = null;
        const finish = () => {
          if (handle !== null && typeof idleWindow.cancelIdleCallback === "function") {
            idleWindow.cancelIdleCallback(handle);
          } else if (handle !== null) {
            window.clearTimeout(handle);
          }
          resolve();
        };
        signal.addEventListener("abort", finish, { once: true });
        if (typeof requestIdle === "function") {
          handle = requestIdle(finish, { timeout: 600 });
          return;
        }
        handle = window.setTimeout(finish, 80);
      }),
  );
}

export function CharacterAvatarImage({
  src,
  avatarFilePath,
  avatarFilename,
  alt,
  crop,
  className,
  thumbnailSize,
}: {
  src?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  alt: string;
  crop?: unknown;
  className?: string;
  thumbnailSize?: 64 | 96 | 128 | 256;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const effectiveThumbnailSize =
    thumbnailSize && canGenerateAvatarThumbnail(avatarFilename, avatarFilePath, src) ? thumbnailSize : undefined;
  const managedInitialSrc = effectiveThumbnailSize
    ? avatarThumbnailFileUrlFromPath(avatarFilename, avatarFilePath, effectiveThumbnailSize, src)
    : avatarFileUrlFromPath(avatarFilename, avatarFilePath);
  const hasManagedAvatarInput = Boolean(avatarFilename || avatarFilePath);
  const hasResolvableAvatarInput = hasManagedAvatarInput || Boolean(effectiveThumbnailSize && src);
  const initialSrc = managedInitialSrc ?? src ?? null;
  const [asyncSrc, setAsyncSrc] = useState<string | null>(initialSrc);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    setAsyncSrc(initialSrc);
    if (!hasResolvableAvatarInput || (!effectiveThumbnailSize && managedInitialSrc && !isLikelyFilesystemPath(managedInitialSrc))) {
      return () => {
        cancelled = true;
        abort.abort();
      };
    }
    const resolveUrl = async () => {
      if (effectiveThumbnailSize && imageRef.current) {
        await waitForImageResolveSlot(imageRef.current, abort.signal);
      }
      if (cancelled) return null;
      return effectiveThumbnailSize
        ? resolveAvatarThumbnailFileUrl(avatarFilename, avatarFilePath, effectiveThumbnailSize, src)
        : resolveAvatarFileUrl(avatarFilename, avatarFilePath);
    };
    resolveUrl()
      .then((url) => {
        if (!cancelled) setAsyncSrc(url ?? src ?? null);
      })
      .catch(() => {
        if (!cancelled) setAsyncSrc(src ?? null);
      });
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [avatarFilename, avatarFilePath, effectiveThumbnailSize, hasResolvableAvatarInput, initialSrc, managedInitialSrc, src]);

  const resolvedSrc = asyncSrc ?? initialSrc;
  if (!resolvedSrc) return null;

  return (
    <img
      ref={imageRef}
      src={resolvedSrc}
      alt={alt}
      loading={getCharacterAvatarLoadingMode(resolvedSrc)}
      decoding="async"
      fetchPriority={effectiveThumbnailSize ? "low" : undefined}
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
      style={getAvatarCropStyle(resolveAvatarCrop(crop))}
    />
  );
}
