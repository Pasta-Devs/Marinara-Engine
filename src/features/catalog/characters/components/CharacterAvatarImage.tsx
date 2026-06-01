import type { AvatarCropValue } from "../../../../shared/lib/utils";
import { avatarFileUrlFromPath, resolveAvatarFileUrl } from "../../../../shared/api/local-file-api";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../shared/lib/utils";
import { getCharacterAvatarLoadingMode } from "../lib/character-avatar-loading";
import { useEffect, useState } from "react";

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

export function CharacterAvatarImage({
  src,
  avatarFilePath,
  avatarFilename,
  alt,
  crop,
  className,
}: {
  src?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  alt: string;
  crop?: unknown;
  className?: string;
}) {
  const initialSrc = avatarFileUrlFromPath(avatarFilename, avatarFilePath) ?? src ?? null;
  const [asyncSrc, setAsyncSrc] = useState<string | null>(initialSrc);

  useEffect(() => {
    let cancelled = false;
    setAsyncSrc(initialSrc);
    resolveAvatarFileUrl(avatarFilename, avatarFilePath)
      .then((url) => {
        if (!cancelled) setAsyncSrc(url ?? src ?? null);
      })
      .catch(() => {
        if (!cancelled) setAsyncSrc(src ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarFilename, avatarFilePath, initialSrc, src]);

  const resolvedSrc = asyncSrc ?? initialSrc;
  if (!resolvedSrc) return null;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={getCharacterAvatarLoadingMode(resolvedSrc)}
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
      style={getAvatarCropStyle(resolveAvatarCrop(crop))}
    />
  );
}
