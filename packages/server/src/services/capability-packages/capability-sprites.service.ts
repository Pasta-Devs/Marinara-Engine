import type { CapabilitySpriteHost } from "@marinara-engine/shared";
import { listCharacterSpriteRecords, readCharacterSprite, resolveCharacterSprite } from "../sprites/sprite-reuse.js";

/** Capability API 1.834: a package reads saved sprites and the artwork rule, never the sprite folders themselves. */
export function createCapabilitySpriteHost(): CapabilitySpriteHost {
  const owner = (ownerId: unknown): string => {
    if (typeof ownerId !== "string" || !ownerId.trim()) throw new Error("[capability] sprites: ownerId is required");
    return ownerId;
  };
  return Object.freeze({
    async list(ownerId: string) {
      return listCharacterSpriteRecords(owner(ownerId));
    },
    async resolve(ownerId: string, request: Parameters<CapabilitySpriteHost["resolve"]>[1]) {
      if (!request || (request.kind !== "expression" && request.kind !== "full-body")) {
        throw new Error('[capability] sprites.resolve: kind must be "expression" or "full-body"');
      }
      return resolveCharacterSprite(owner(ownerId), request);
    },
    async read(ownerId: string, handle: string) {
      if (typeof handle !== "string" || !handle) return null;
      return readCharacterSprite(owner(ownerId), handle);
    },
  });
}
