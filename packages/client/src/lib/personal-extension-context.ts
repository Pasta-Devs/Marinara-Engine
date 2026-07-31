import type { PersonalExtensionContextSnapshot } from "@marinara-engine/shared";

export const PERSONAL_EXTENSION_CONTEXT_MAX_ID_LENGTH = 256;
export const PERSONAL_EXTENSION_CONTEXT_MAX_CHARACTER_IDS = 256;

function normalizeContextId(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > PERSONAL_EXTENSION_CONTEXT_MAX_ID_LENGTH
  ) {
    return null;
  }
  return value;
}

export function createPersonalExtensionContextSnapshot(
  chatIdValue: unknown,
  characterIdValues: unknown,
  personaIdValue?: unknown,
): PersonalExtensionContextSnapshot {
  const chatId = normalizeContextId(chatIdValue);
  const personaId = chatId ? normalizeContextId(personaIdValue) : null;
  const characterIds: string[] = [];
  if (chatId && Array.isArray(characterIdValues)) {
    const seen = new Set<string>();
    for (const value of characterIdValues) {
      const id = normalizeContextId(value);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      characterIds.push(id);
      if (characterIds.length >= PERSONAL_EXTENSION_CONTEXT_MAX_CHARACTER_IDS) break;
    }
  }
  Object.freeze(characterIds);
  return Object.freeze({
    chatId,
    characterId: characterIds.length === 1 ? (characterIds[0] ?? null) : null,
    characterIds,
    personaId,
    characters: Object.freeze([]),
    persona: null,
  });
}

export function personalExtensionContextKey(context: PersonalExtensionContextSnapshot): string {
  return JSON.stringify([context.chatId, context.personaId, ...context.characterIds]);
}
