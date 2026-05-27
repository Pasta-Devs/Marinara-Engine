import type { AvatarCropValue } from "../../../../shared/lib/utils";
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
  alt,
  crop,
  className,
}: {
  src: string;
  alt: string;
  crop?: unknown;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={getCharacterAvatarLoadingMode(src)}
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
      style={getAvatarCropStyle(resolveAvatarCrop(crop))}
    />
  );
}
