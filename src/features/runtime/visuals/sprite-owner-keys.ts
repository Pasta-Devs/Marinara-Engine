export type SpriteOwnerKind = "character" | "persona";

const CHARACTER_OWNER_PREFIX = "character:";
const PERSONA_OWNER_PREFIX = "persona:";

export function makeSpriteOwnerKey(kind: SpriteOwnerKind, id: string): string {
  return `${kind}:${id}`;
}

export function getSpriteOwnerKind(key: string): SpriteOwnerKind {
  return key.startsWith(PERSONA_OWNER_PREFIX) ? "persona" : "character";
}

export function getSpriteOwnerId(key: string): string {
  if (key.startsWith(PERSONA_OWNER_PREFIX)) return key.slice(PERSONA_OWNER_PREFIX.length);
  if (key.startsWith(CHARACTER_OWNER_PREFIX)) return key.slice(CHARACTER_OWNER_PREFIX.length);
  return key;
}

export function getCharacterIdFromSpriteOwnerKey(key: string): string | null {
  return getSpriteOwnerKind(key) === "character" ? getSpriteOwnerId(key) : null;
}

export function getSpriteOwnerKeysForCharacterId(characterId: string): string[] {
  return [characterId, `${CHARACTER_OWNER_PREFIX}${characterId}`];
}
