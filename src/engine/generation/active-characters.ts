import { parseRecord, readString, stringArray, type JsonRecord } from "./runtime-records";

/** Character IDs muted for this chat. They remain attached to the chat, but are excluded from generation. */
export function inactiveCharacterIds(chat: JsonRecord): Set<string> {
  return new Set(
    stringArray(parseRecord(chat.metadata).inactiveCharacterIds)
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function activeCharacterIds(chat: JsonRecord): string[] {
  const inactiveIds = inactiveCharacterIds(chat);
  return stringArray(chat.characterIds).filter((id) => !inactiveIds.has(id));
}

export function assertRequestedCharacterIsActive(chat: JsonRecord, characterId: unknown): void {
  const requestedId = readString(characterId).trim();
  if (!requestedId) return;
  const allCharacterIds = stringArray(chat.characterIds);
  if (!allCharacterIds.includes(requestedId)) return;
  if (inactiveCharacterIds(chat).has(requestedId)) {
    throw new Error("This character is inactive in this group chat. Mark them active before generating a reply.");
  }
}

export function assertChatHasActiveCharacters(chat: JsonRecord): void {
  const allCharacterIds = stringArray(chat.characterIds);
  if (allCharacterIds.length > 0 && activeCharacterIds(chat).length === 0) {
    throw new Error("At least one character must be active before generating a reply.");
  }
}
