// The game card a library character joins a game's party with, wherever they join it from.

import { copyRulesetSheetForGame, normalizeCharacterLookupName } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { loadRulesetRegistry, resolveGameRuleset } from "./ruleset-registry.service.js";

/** The card a character joins with when nothing more is written for them: their own description,
 *  appearance and backstory. */
export function buildFallbackGameCharacterCard(characterData: Record<string, any>, characterName: string) {
  const description =
    typeof characterData.description === "string" && characterData.description.trim()
      ? characterData.description.trim()
      : typeof characterData.personality === "string" && characterData.personality.trim()
        ? characterData.personality.trim()
        : `${characterName} joins the party.`;
  const appearance =
    typeof characterData.extensions?.appearance === "string" && characterData.extensions.appearance.trim()
      ? characterData.extensions.appearance.trim()
      : typeof characterData.appearance === "string" && characterData.appearance.trim()
        ? characterData.appearance.trim()
        : "";
  const backstory =
    typeof characterData.extensions?.backstory === "string" && characterData.extensions.backstory.trim()
      ? characterData.extensions.backstory.trim()
      : typeof characterData.backstory === "string" && characterData.backstory.trim()
        ? characterData.backstory.trim()
        : "";

  return {
    name: characterName,
    shortDescription: description,
    class: "Companion",
    abilities: [],
    strengths: [],
    weaknesses: [],
    extra: Object.fromEntries(
      [
        ["appearance", appearance],
        ["backstory", backstory],
      ].filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  };
}

/**
 * Game cards for library characters added to a game on a ruleset outside the Game Master's own
 * recruiting (the Characters panel, Chat Settings' party), each with a copy of their card's sheet
 * for the ruleset, as recruiting gives them (laptop playtest 2026-10-24: they joined on a blank
 * level-1 sheet). One who already has a card, a game not set up yet, and a game with no ruleset are
 * left as they are. Returns whether any card was added.
 */
export async function addGamePartyCards(db: DB, chatId: string, characterIds: readonly string[]): Promise<boolean> {
  if (characterIds.length === 0) return false;
  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  if (!chat || chat.mode !== "game") return false;
  let meta: Record<string, unknown>;
  try {
    meta = (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {})) as Record<
      string,
      unknown
    >;
  } catch {
    return false;
  }
  if (meta.gameRuleset == null || !Array.isArray(meta.gameCharacterCards)) return false;
  const pinned = resolveGameRuleset(meta, await loadRulesetRegistry());
  if (pinned.status !== "ok") return false;
  const characters = createCharactersStorage(db);
  const joining: Array<Record<string, unknown>> = [];
  for (const id of characterIds) {
    const row = await characters.getById(id);
    if (!row) continue;
    let data: Record<string, any>;
    try {
      data = (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as Record<string, any>;
    } catch {
      continue;
    }
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    if (!name) continue;
    joining.push({
      ...buildFallbackGameCharacterCard(data, name),
      rulesetSheet: copyRulesetSheetForGame(pinned.definition, data.extensions?.rulesetSheets?.[pinned.definition.id]),
    });
  }
  if (joining.length === 0) return false;
  let added = false;
  await chats.patchMetadata(chatId, (current) => {
    const cards = Array.isArray(current.gameCharacterCards)
      ? (current.gameCharacterCards as Array<Record<string, unknown>>)
      : [];
    const held = new Set(
      cards.flatMap((card) => (typeof card.name === "string" ? [normalizeCharacterLookupName(card.name)] : [])),
    );
    const fresh = joining.filter((card) => !held.has(normalizeCharacterLookupName(card.name as string)));
    added = fresh.length > 0;
    return added ? { gameCharacterCards: [...cards, ...fresh] } : {};
  });
  return added;
}

/**
 * The game's party list (`gamePartyCharacterIds`) as members join or leave a game from the
 * Characters panel or Chat Settings: added ones join it and removed ones leave it, so the Game
 * Master's prompt and a fight read the party the chat holds before the next session's start
 * reconciles it (laptop playtest 2026-10-24: six in the chat, four in the party). The party's NPCs
 * stay, and a game with no list yet is left to build one as it always has.
 */
export async function syncGamePartyIds(
  db: DB,
  chatId: string,
  added: readonly string[],
  removed: readonly string[],
): Promise<boolean> {
  if (added.length === 0 && removed.length === 0) return false;
  let changed = false;
  await createChatsStorage(db).patchMetadata(chatId, (current) => {
    if (!Array.isArray(current.gamePartyCharacterIds)) return {};
    const ids = (current.gamePartyCharacterIds as unknown[]).filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );
    const gone = new Set(removed);
    const next = [...new Set([...ids.filter((id) => !gone.has(id)), ...added])];
    changed = next.length !== ids.length || next.some((id, index) => id !== ids[index]);
    return changed ? { gamePartyCharacterIds: next } : {};
  });
  return changed;
}
