import type { PresentCharacter } from "@marinara-engine/shared";
import { visibleText } from "./tracker-display";

export function getCharacterPortraitFallback(character: PresentCharacter) {
  const emoji = character.emoji?.trim();
  if (emoji && emoji !== "?") return emoji;
  const initial = visibleText(character.name, "C").slice(0, 1).toUpperCase();
  return initial === "?" ? "C" : initial;
}

export function getCharacterFeatureKey(character: PresentCharacter, index: number) {
  const stableId = character.characterId || character.name || `character-${index}`;
  return stableId;
}

/**
 * Resolve which live tracked character a UI edit/remove/avatar action targets.
 *
 * Present-character `characterId`s are produced by the LLM character-tracker
 * agent and are not guaranteed unique — the agent prompt allows "ID or name",
 * so several present characters can share (or omit) an id. Resolving the target
 * with a plain `findIndex` by id therefore collapses every action onto the
 * first character that shares that id. Follow the same rule the other tracker
 * list mutations use (`findUniqueNamedIndex`): trust the id only when it
 * uniquely identifies one character, otherwise fall back to the rendered index
 * the UI already passed in.
 */
export function resolveCharacterTargetIndex(
  liveCharacters: PresentCharacter[],
  targetCharacterId: string | null | undefined,
  fallbackIndex: number,
): number {
  if (targetCharacterId) {
    let matchIndex = -1;
    let matchCount = 0;
    for (let index = 0; index < liveCharacters.length; index++) {
      if (liveCharacters[index]?.characterId === targetCharacterId) {
        matchIndex = index;
        if (++matchCount > 1) break;
      }
    }
    if (matchCount === 1) return matchIndex;
  }
  return fallbackIndex >= 0 && fallbackIndex < liveCharacters.length ? fallbackIndex : -1;
}
