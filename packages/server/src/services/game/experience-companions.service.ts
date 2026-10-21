// ──────────────────────────────────────────────
// An Experience's companions (Capability API 1.347): people of its worlds the party can take in. One that
// joins plays by their sheet for the game's ruleset, the build for the highest level the party has reached,
// and keeps up with the party as it rises.
// ──────────────────────────────────────────────
import {
  createRulesetSheetEnvelope,
  experienceCompanionBuild,
  experienceCompanionNamed,
  experienceCompanionSheet,
  experiencePeopleIn,
  experienceSheetLevel,
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  type ExperienceCompanionSheet,
  type GameWorld,
  type RulesetDefinition,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { buildPartyNpcId } from "../generation/game-party-utils.js";
import { loadGameWorld } from "./game-world.service.js";
import { readMapPackPeople, type MapPack } from "./map-pack.service.js";
import { loadRulesetRegistry, resolveGameRuleset } from "./ruleset-registry.service.js";

/** The names of the world's people travelling with the party: its tracked people whose party id is in it
 *  (a library character is never one of the world's people). */
export function storyPartyNames(meta: Record<string, unknown>): string[] {
  const ids = new Set(Array.isArray(meta.gamePartyCharacterIds) ? (meta.gamePartyCharacterIds as unknown[]) : []);
  const npcs = Array.isArray(meta.gameNpcs) ? (meta.gameNpcs as Array<{ name?: unknown }>) : [];
  return npcs.flatMap((npc) => (typeof npc.name === "string" && ids.has(buildPartyNpcId(npc.name)) ? [npc.name] : []));
}

/** How many the party is (1.356): the player and every character travelling with it, library
 *  characters and companions alike, but for the companions who never fight (1.360), by party id. */
export function gamePartySize(meta: Record<string, unknown>, noncombatants?: ReadonlySet<string>): number {
  const ids = Array.isArray(meta.gamePartyCharacterIds) ? (meta.gamePartyCharacterIds as unknown[]) : [];
  return 1 + new Set(ids.filter((id): id is string => typeof id === "string" && !noncombatants?.has(id))).size;
}

/** The party ids of the game's Experience companions who never fight (1.360): they travel with the party
 *  but are not counted in its size or put in its fights. */
export async function gameNoncombatants(db: DB, chatId: string, meta: Record<string, unknown>): Promise<Set<string>> {
  const companions = await gameCompanions(db, chatId, meta).catch(() => null);
  if (!companions) return new Set();
  return new Set(
    experiencePeopleIn(companions.world, companions.people)
      .filter(({ entry }) => entry.companion?.noncombatant)
      .map(({ name }) => buildPartyNpcId(name)),
  );
}

export interface GameCompanions {
  people: NonNullable<MapPack["people"]>;
  world: GameWorld;
}

/** A game's Experience companions, when its Experience has any. */
export async function gameCompanions(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
): Promise<GameCompanions | null> {
  const packId = (meta.gameMapPack as { packageId?: unknown } | undefined)?.packageId;
  if (typeof packId !== "string") return null;
  const people = await readMapPackPeople(packId);
  if (!people?.people.some((person) => person.companion)) return null;
  const world = await loadGameWorld(db, chatId, meta);
  return world ? { people, world } : null;
}

/** The companion a name is in this game, with their sheets for its ruleset (if they have one). */
export function gameCompanionNamed(companions: GameCompanions, name: string, definition: RulesetDefinition | null) {
  const found = experienceCompanionNamed(companions.world, companions.people, name);
  if (!found) return null;
  const sheet = definition ? experienceCompanionSheet(found.entry.companion!, definition.id) : undefined;
  return { name: found.name, person: found.entry.person, sheet };
}

/** The highest level among the party's own (its companions left out), as the companion's ruleset counts
 *  it on their sheets. */
export function companionPartyLevel(
  definition: RulesetDefinition,
  cards: Array<Record<string, unknown>>,
  sheet: ExperienceCompanionSheet,
  companionNames: Set<string>,
): number {
  let highest = 0;
  for (const card of cards) {
    const name = typeof card.name === "string" ? normalizeCharacterLookupName(card.name) : "";
    if (!name || companionNames.has(name)) continue;
    const read = readRulesetSheetEnvelope(definition, card.rulesetSheet);
    if (read) highest = Math.max(highest, experienceSheetLevel(read.build, sheet.level));
  }
  return highest;
}

/** The party's level as an Experience counts it (1.371): the highest level any of the party's own has
 *  reached, read off the level fields its companion sheets name for this ruleset. Null when the game's
 *  Experience has no companion sheet for the ruleset to say which fields those are. */
export async function gamePartyLevel(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  definition: RulesetDefinition,
): Promise<number | null> {
  const companions = await gameCompanions(db, chatId, meta);
  if (!companions) return null;
  const sheet = experiencePeopleIn(companions.world, companions.people)
    .map(({ entry }) => (entry.companion ? experienceCompanionSheet(entry.companion, definition.id) : undefined))
    .find((each) => each);
  if (!sheet) return null;
  const cards = Array.isArray(meta.gameCharacterCards)
    ? (meta.gameCharacterCards as Array<Record<string, unknown>>)
    : [];
  return companionPartyLevel(definition, cards, sheet, companionNames(companions));
}

/** A companion's sheet for a party this high: their build for it, read as the ruleset reads a stored one. */
export function companionSheetEnvelope(
  definition: RulesetDefinition,
  sheet: ExperienceCompanionSheet,
  partyLevel: number,
): RulesetSheetEnvelope {
  const chosen = experienceCompanionBuild(sheet, partyLevel);
  return (
    readRulesetSheetEnvelope(definition, { v: sheet.v, build: structuredClone(chosen.build) }) ??
    createRulesetSheetEnvelope(definition)
  );
}

/** The names of every companion this game's world has, as cards are looked up. */
export function companionNames(companions: GameCompanions): Set<string> {
  return new Set(
    experiencePeopleIn(companions.world, companions.people)
      .filter(({ entry }) => entry.companion)
      .map(({ name }) => normalizeCharacterLookupName(name)),
  );
}

/**
 * Brings each companion travelling with the party up to the party's level (1.347): when the party has
 * reached a level the companion has a higher build for, their sheet becomes it. Their live state (health,
 * pools, conditions) is kept apart from the build and stays. A sheet the player has raised past the
 * build is left alone, and nothing ever lowers one.
 */
export async function syncCompanionSheets(db: DB, chatId: string, meta: Record<string, unknown>): Promise<void> {
  if (meta.gameRuleset == null || !Array.isArray(meta.gameCharacterCards)) return;
  const companions = await gameCompanions(db, chatId, meta);
  if (!companions) return;
  const resolved = resolveGameRuleset(meta, await loadRulesetRegistry());
  if (resolved.status !== "ok") return;
  const definition = resolved.definition;
  const names = companionNames(companions);
  const chats = createChatsStorage(db);
  await chats.patchMetadata(chatId, (current) => {
    const cards = Array.isArray(current.gameCharacterCards)
      ? (current.gameCharacterCards as Array<Record<string, unknown>>)
      : [];
    let changed = false;
    const next = cards.map((card) => {
      const name = typeof card.name === "string" ? card.name : "";
      if (!names.has(normalizeCharacterLookupName(name))) return card;
      const sheet = gameCompanionNamed(companions, name, definition)?.sheet;
      if (!sheet) return card;
      const partyLevel = companionPartyLevel(definition, cards, sheet, names);
      const target = experienceCompanionBuild(sheet, partyLevel);
      const read = readRulesetSheetEnvelope(definition, card.rulesetSheet);
      const now = read ? experienceSheetLevel(read.build, sheet.level) : 0;
      if (now >= target.at) return card;
      changed = true;
      logger.info("[game/companions] %s rises to level %d with the party in chat %s", name, target.at, chatId);
      return { ...card, rulesetSheet: companionSheetEnvelope(definition, sheet, partyLevel) };
    });
    return changed ? { gameCharacterCards: next } : {};
  });
}
