import type { SpriteOwnerType } from "../../../shared/api/image-generation-api";

export const spriteKeys = {
  list: (spriteOwnerId: string, ownerType: SpriteOwnerType = "character") =>
    ["sprites", ownerType, spriteOwnerId] as const,
  capabilities: () => ["sprites", "capabilities"] as const,
};
