import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import {
  avatarFileUrlFromPath,
  avatarThumbnailFileUrlFromPath,
  canGenerateAvatarThumbnail,
  resolveAvatarFileUrl,
  resolveAvatarThumbnailFileUrl,
} from "../../../../shared/api/local-file-api";
import type { AvatarCropValue } from "../../../../shared/lib/utils";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../shared/lib/utils";

export type PersonaAvatarImageSource = {
  name?: string | null;
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  avatarCrop?: unknown;
};

function isLikelyFilesystemPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return (
    /^[a-z]:\//i.test(normalized) ||
    normalized.startsWith("//") ||
    /^\/(Users|home|var|data|tmp|opt|private)\//i.test(normalized)
  );
}

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

export function PersonaAvatarImage({
  persona,
  alt,
  className,
  draggable = false,
  style,
  thumbnailSize = 128,
}: {
  persona: PersonaAvatarImageSource;
  alt?: string;
  className?: string;
  draggable?: boolean;
  style?: CSSProperties;
  thumbnailSize?: 64 | 96 | 128 | 256;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const effectiveThumbnailSize =
    thumbnailSize && canGenerateAvatarThumbnail(persona.avatarFilename, persona.avatarFilePath, persona.avatarPath)
      ? thumbnailSize
      : undefined;
  const managedInitialSrc = effectiveThumbnailSize
    ? avatarThumbnailFileUrlFromPath(
        persona.avatarFilename,
        persona.avatarFilePath,
        effectiveThumbnailSize,
        persona.avatarPath,
      )
    : avatarFileUrlFromPath(persona.avatarFilename, persona.avatarFilePath);
  const hasManagedAvatarInput = Boolean(persona.avatarFilename || persona.avatarFilePath);
  const hasResolvableAvatarInput = hasManagedAvatarInput || Boolean(effectiveThumbnailSize && persona.avatarPath);
  const initialSrc = managedInitialSrc ?? persona.avatarPath ?? null;
  const [asyncSrc, setAsyncSrc] = useState<string | null>(initialSrc);

  useEffect(() => {
    let cancelled = false;
    setAsyncSrc(initialSrc);
    if (
      !hasResolvableAvatarInput ||
      (!effectiveThumbnailSize && managedInitialSrc && !isLikelyFilesystemPath(managedInitialSrc))
    ) {
      return () => {
        cancelled = true;
      };
    }
    const resolveUrl = effectiveThumbnailSize
      ? resolveAvatarThumbnailFileUrl(
          persona.avatarFilename,
          persona.avatarFilePath,
          effectiveThumbnailSize,
          persona.avatarPath,
        )
      : resolveAvatarFileUrl(persona.avatarFilename, persona.avatarFilePath);
    resolveUrl
      .then((url) => {
        if (!cancelled) setAsyncSrc(url ?? persona.avatarPath ?? null);
      })
      .catch(() => {
        if (!cancelled) setAsyncSrc(persona.avatarPath ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveThumbnailSize,
    hasResolvableAvatarInput,
    initialSrc,
    managedInitialSrc,
    persona.avatarFilePath,
    persona.avatarFilename,
    persona.avatarPath,
  ]);

  const resolvedSrc = asyncSrc ?? initialSrc;
  if (!resolvedSrc) return null;

  return (
    <img
      ref={imageRef}
      src={resolvedSrc}
      alt={alt ?? persona.name ?? ""}
      loading="lazy"
      decoding="async"
      fetchPriority={effectiveThumbnailSize ? "low" : undefined}
      draggable={draggable}
      className={cn("h-full w-full object-cover", className)}
      style={{ ...getAvatarCropStyle(resolveAvatarCrop(persona.avatarCrop)), ...style }}
    />
  );
}
