import type { AvatarCrop } from "@marinara-engine/shared";

export function resolveNoodleAvatarCropAfterProfileUpdate(input: {
  currentAvatarUrl: string | null;
  nextAvatarUrl: string | null | undefined;
  currentCrop: AvatarCrop | null;
  sourceAvatarUrl?: string | null;
  sourceCrop?: AvatarCrop | null;
}): AvatarCrop | null | undefined {
  if (input.nextAvatarUrl === undefined) {
    if (input.currentCrop) return undefined;
    return input.currentAvatarUrl && input.currentAvatarUrl === input.sourceAvatarUrl
      ? input.sourceCrop ?? undefined
      : undefined;
  }
  if (input.nextAvatarUrl !== input.currentAvatarUrl) return null;
  if (input.currentCrop) return input.currentCrop;
  return input.nextAvatarUrl && input.nextAvatarUrl === input.sourceAvatarUrl ? (input.sourceCrop ?? null) : null;
}
