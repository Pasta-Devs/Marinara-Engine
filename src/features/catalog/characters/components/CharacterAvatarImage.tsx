import type { AvatarCrop } from "../../../../shared/lib/utils";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../shared/lib/utils";

function isAvatarCrop(value: unknown): value is AvatarCrop {
  return (
    !!value &&
    typeof value === "object" &&
    Number.isFinite((value as AvatarCrop).srcX) &&
    Number.isFinite((value as AvatarCrop).srcY) &&
    Number.isFinite((value as AvatarCrop).srcWidth) &&
    Number.isFinite((value as AvatarCrop).srcHeight) &&
    (value as AvatarCrop).srcWidth > 0 &&
    (value as AvatarCrop).srcHeight > 0 &&
    (value as AvatarCrop).srcX >= 0 &&
    (value as AvatarCrop).srcY >= 0 &&
    (value as AvatarCrop).srcX + (value as AvatarCrop).srcWidth <= 1.001 &&
    (value as AvatarCrop).srcY + (value as AvatarCrop).srcHeight <= 1.001
  );
}

function resolveAvatarCrop(crop: unknown): AvatarCrop | null {
  if (!crop) return null;
  if (typeof crop === "string") return parseAvatarCropJson(crop);
  return isAvatarCrop(crop) ? crop : null;
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
      loading="lazy"
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
      style={getAvatarCropStyle(resolveAvatarCrop(crop))}
    />
  );
}
