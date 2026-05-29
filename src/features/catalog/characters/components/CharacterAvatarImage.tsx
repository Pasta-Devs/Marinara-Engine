import type { AvatarCropValue } from "../../../../shared/lib/utils";
import { avatarFileUrlFromPath } from "../../../../shared/api/local-file-api";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../shared/lib/utils";
import { getCharacterAvatarLoadingMode } from "../lib/character-avatar-loading";

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
  const resolvedSrc = avatarFileUrlFromPath(avatarFilename, avatarFilePath) ?? src;
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
