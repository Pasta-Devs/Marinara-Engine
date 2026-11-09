// ──────────────────────────────────────────────
// Roleplay rulesets: a Roleplay chat that plays by a Game Mode ruleset
//
// A Game Mode game pins its ruleset once, at setup, and gives every party card its own copy of the
// character's library sheet. A Roleplay chat has no setup, so this pins it from Chat Settings
// instead and builds the same `gameCharacterCards` from the chat's persona and characters: one card
// each, holding this chat's copy of their library sheet for the ruleset (or a blank build where
// they have none). From there the Engine's sheet, check and clock machinery reads the chat exactly
// as it reads a game, because that machinery keys off `gameRuleset` and the cards, not the mode.
//
// Pinning the ruleset a chat already plays keeps every card it has and only adds the members that
// are missing one, so it doubles as "give the new arrival a sheet". Pinning another ruleset starts
// the cards over, since a sheet built for one ruleset means nothing to another. Unpinning keeps the
// cards, so pinning the same ruleset again picks up where the chat left off.
// ──────────────────────────────────────────────
import {
  copyRulesetSheetForGame,
  isCommunityRulesetId,
  normalizeCharacterLookupName,
  rulesetLayerSelectionIssues,
  type GameCharacterCard,
  type RulesetDefinition,
  type RulesetRef,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { getCustomAgentImportPolicy } from "../agents/custom-agent-import-policy.service.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { readMetadata } from "./game-inventory.service.js";
import { createRulesetRef, loadRulesetRegistry } from "./ruleset-registry.service.js";

export type RoleplayRulesetOutcome =
  | { ok: true; gameRuleset: RulesetRef | null; cards: number; added: number }
  | { ok: false; status: 400 | 404 | 409; error: string; code: string };

/** One member of the chat, by name, with their library sheet for the ruleset if they have one. */
interface RoleplaySheetSource {
  name: string;
  stored: unknown;
}

function readJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** The chat's members who can carry a sheet: its persona first, because the persona is the player
 *  (their card leads the sheets), then its characters. The persona wins a name it shares with one. */
async function loadRoleplaySheetSources(
  db: DB,
  chat: { characterIds: unknown; personaId: string | null },
  rulesetId: string,
): Promise<RoleplaySheetSource[]> {
  const characters = createCharactersStorage(db);
  const byName = new Map<string, RoleplaySheetSource>();
  const ids = readJson(chat.characterIds);
  for (const id of Array.isArray(ids) ? ids : []) {
    if (typeof id !== "string" || id.startsWith("npc:")) continue;
    const row = await characters.getById(id);
    if (!row) continue;
    const data = readJson(row.data) as { name?: unknown; extensions?: { rulesetSheets?: Record<string, unknown> } };
    if (typeof data?.name !== "string" || !data.name.trim()) continue;
    byName.set(normalizeCharacterLookupName(data.name), {
      name: data.name,
      stored: data.extensions?.rulesetSheets?.[rulesetId],
    });
  }
  let player: RoleplaySheetSource | undefined;
  if (chat.personaId) {
    const persona = await characters.getPersona(chat.personaId);
    if (persona?.name?.trim()) {
      const stats = readJson(persona.personaStats) as { rulesetSheets?: Record<string, unknown> } | null;
      player = { name: persona.name, stored: stats?.rulesetSheets?.[rulesetId] };
      byName.delete(normalizeCharacterLookupName(persona.name));
    }
  }
  return player ? [player, ...byName.values()] : [...byName.values()];
}

/** A card that only carries a ruleset sheet: Roleplay has no Game Master setup to fill the rest. */
function sheetOnlyCard(definition: RulesetDefinition, source: RoleplaySheetSource): GameCharacterCard {
  return {
    name: source.name,
    shortDescription: "",
    class: "",
    abilities: [],
    strengths: [],
    weaknesses: [],
    extra: {},
    rulesetSheet: copyRulesetSheetForGame(definition, source.stored),
  };
}

/** Pin `rulesetId` to a Roleplay chat (or unpin it, with null) and build its sheet cards. */
export async function pinRoleplayRuleset(
  db: DB,
  input: { chatId: string; rulesetId: string | null; options?: Record<string, string | number | boolean> },
): Promise<RoleplayRulesetOutcome> {
  const chats = createChatsStorage(db);
  const chat = await chats.getById(input.chatId);
  if (!chat) return { ok: false, status: 404, error: "Chat not found", code: "chat_not_found" };
  if (chat.mode !== "roleplay") {
    return {
      ok: false,
      status: 409,
      error: "Only a Roleplay chat pins a ruleset here; a game chooses its ruleset at setup.",
      code: "not_roleplay",
    };
  }

  if (input.rulesetId === null) {
    await chats.patchMetadata(input.chatId, () => ({ gameRuleset: null }));
    return { ok: true, gameRuleset: null, cards: 0, added: 0 };
  }

  // The same rule a new game follows: with imports off, an imported ruleset cannot be newly pinned.
  if (isCommunityRulesetId(input.rulesetId) && !(await getCustomAgentImportPolicy(db)).enabled) {
    return {
      ok: false,
      status: 400,
      error: "Imported rulesets are turned off in Settings, so a chat cannot start on one.",
      code: "ruleset_imports_disabled",
    };
  }
  const registered = (await loadRulesetRegistry(db)).get(input.rulesetId);
  if (!registered) {
    return {
      ok: false,
      status: 400,
      error: `The ruleset "${input.rulesetId}" is not installed.`,
      code: "ruleset_not_installed",
    };
  }
  const options = input.options ?? {};
  const [layerIssue] = rulesetLayerSelectionIssues(registered.definition, options);
  if (layerIssue) return { ok: false, status: 400, error: layerIssue.message, code: layerIssue.code };

  const definition = registered.definition;
  const sources = await loadRoleplaySheetSources(
    db,
    { characterIds: chat.characterIds, personaId: chat.personaId ?? null },
    definition.id,
  );

  let pinned: RulesetRef | null = null;
  let cardCount = 0;
  let added = 0;
  await chats.patchMetadata(input.chatId, (current) => {
    const previous = readMetadata(current).gameRuleset as RulesetRef | null | undefined;
    const sameRuleset = previous?.id === definition.id && previous?.packageId === registered.packageId;
    // Re-pinning keeps the chat's layers and moves it onto the newest version installed, which is how a
    // ruleset edited in the builder reaches the chats that play it. A Roleplay chat has no setup to
    // protect, and its sheets are read tolerantly against the newer version.
    pinned =
      sameRuleset && previous
        ? { ...previous, version: Math.max(previous.version, definition.version) }
        : { ...createRulesetRef(registered), options };
    const kept =
      sameRuleset && Array.isArray(current.gameCharacterCards)
        ? (current.gameCharacterCards as GameCharacterCard[])
        : [];
    const carded = new Set(kept.map((card) => normalizeCharacterLookupName(card.name ?? "")));
    const fresh = sources
      .filter((source) => !carded.has(normalizeCharacterLookupName(source.name)))
      .map((source) => sheetOnlyCard(definition, source));
    added = fresh.length;
    cardCount = kept.length + fresh.length;
    return { gameRuleset: pinned, gameCharacterCards: [...kept, ...fresh] };
  });
  logger.info(
    "[roleplay/ruleset] Chat %s plays by %s v%d with %d sheet cards (%d new)",
    input.chatId,
    definition.id,
    definition.version,
    cardCount,
    added,
  );
  return { ok: true, gameRuleset: pinned, cards: cardCount, added };
}
