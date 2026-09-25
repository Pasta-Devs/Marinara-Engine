// ──────────────────────────────────────────────
// Game: one turn of a ruleset game's live sheet state
// ──────────────────────────────────────────────
// The Game Master records what happens to a character sheet with `[sheet: ...]` commands. The
// Engine owns the arithmetic: every command is checked against the live state the turn started
// with, applied or refused, and written back into the saved reply with its outcome. The live state
// itself rides the game-state snapshot of the message and swipe, so a swipe or a regenerated turn
// starts from the state before it and can never spend twice.
import {
  applySheetCommandTags,
  createSheetCommandTagRegex,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  parseSheetCommandTagBody,
  renderRulesetSheetBlock,
  rulesetCatalogIdsForBuild,
  rulesetSheetEnvelopeSchema,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetLiveStates,
  type SheetCommandCard,
  type SheetCommandOutcome,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { loadRulesetCatalogEntries } from "./ruleset-catalog.service.js";
import { loadRulesetRegistry, resolveGameRuleset, type ResolvedGameRuleset } from "./ruleset-registry.service.js";

export interface GameRulesetSheetContext {
  definition: RulesetDefinition;
  /** The package that supplied the ruleset, or null for an imported one. A catalog asset can only
   *  be read from a package, so the `use` command needs to know which. */
  packageId: string | null;
  cards: SheetCommandCard[];
  /** The player's card name, which a command that names nobody applies to. */
  playerName: string | null;
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Every party card with the build its live state is measured against. A card with NO sheet gets
 *  the ruleset's blank build, the same one setup would have copied for it. A card that HOLDS a sheet
 *  this version cannot read is left out: its maximums are unknown, so a command against a guessed
 *  build would store wrong values that the in-game sheet (which shows a notice for such a card)
 *  would not even display. Commands that name it are refused as naming nobody. */
export function sheetCommandCards(
  definition: RulesetDefinition,
  cards: ReadonlyArray<Record<string, unknown>>,
): SheetCommandCard[] {
  const blank = defaultRulesetSheetBuild(definition);
  return cards.flatMap((card) => {
    const name = typeof card.name === "string" ? card.name.trim() : "";
    if (!name) return [];
    if (card.rulesetSheet == null) return [{ name, build: blank }];
    const envelope = rulesetSheetEnvelopeSchema.safeParse(card.rulesetSheet);
    if (!envelope.success) {
      logger.warn("[game/sheet] The ruleset sheet for %s is unreadable; its live state is left alone", name);
      return [];
    }
    return [{ name, build: envelope.data.build }];
  });
}

/** One prompt block per party card, showing the sheet as it stands at the start of this turn. */
export function renderGameRulesetSheetBlocks(
  definition: RulesetDefinition,
  cards: unknown,
  live: RulesetLiveStates | null | undefined,
  catalogs: RulesetCatalogEntriesById = {},
): string[] {
  const party = Array.isArray(cards) ? (cards as Array<Record<string, unknown>>) : [];
  return sheetCommandCards(definition, party).map((card) =>
    renderRulesetSheetBlock(definition, card, live?.[normalizeCharacterLookupName(card.name)], catalogs),
  );
}

/** The ruleset, the party's builds and the player's name for one game. Null when the game has no
 *  ruleset, or pins one this install cannot honour: then no command is applied and none is lost,
 *  because the tags stay in the saved reply exactly as the Game Master wrote them. */
export async function loadGameRulesetSheetContext(
  db: DB,
  chatId: string,
  /** The resolution the turn's prompt was rendered with. Passing it keeps one turn on one ruleset:
   *  a package updated mid-turn must not have its commands checked against a definition the Game
   *  Master was never shown. Omitted, the pin is resolved here. */
  resolved?: ResolvedGameRuleset | null,
): Promise<GameRulesetSheetContext | null> {
  const chat = await createChatsStorage(db).getById(chatId);
  if (!chat) return null;
  const meta = parseMetadata(chat.metadata);
  if (meta.gameRuleset == null) return null;
  const pinned = resolved ?? resolveGameRuleset(meta, await loadRulesetRegistry());
  if (pinned.status !== "ok") {
    logger.warn("[game/sheet] Chat %s pins a ruleset that is not available; sheet commands were not applied", chatId);
    return null;
  }
  const cards = Array.isArray(meta.gameCharacterCards)
    ? (meta.gameCharacterCards as Array<Record<string, unknown>>)
    : [];
  const setupConfig = meta.gameSetupConfig as { personaId?: string | null } | null | undefined;
  const personaId = chat.personaId || setupConfig?.personaId || null;
  const persona = personaId ? await createCharactersStorage(db).getPersona(personaId) : null;
  return {
    definition: pinned.definition,
    packageId: pinned.packageId,
    cards: sheetCommandCards(pinned.definition, cards),
    playerName: persona?.name?.trim() || null,
  };
}

/** Whether this reply asks to use something out of a catalog. Every other command is answered from
 *  the sheet alone, so a turn without one never touches a catalog file. */
function replyUsesCatalogEntry(content: string): boolean {
  if (!content.includes("[")) return false;
  for (const match of content.matchAll(createSheetCommandTagRegex())) {
    if (parseSheetCommandTagBody(match[1] ?? "").op?.op === "use") return true;
  }
  return false;
}

/** The catalog entries this reply's `use` commands need: nothing at all unless the reply carries
 *  one, and then only the catalogs the party's own rows point at. A catalog that cannot be read is
 *  logged and left out, and the command is refused as naming something the Engine does not know,
 *  which is the honest answer: it cannot tell what the ability would have cost. */
export async function loadTurnRulesetCatalogs(
  context: GameRulesetSheetContext,
  content: string,
  /** `force` skips the "does this reply use one" gate, for a caller that has already decided it
   *  needs them: a check tag's `use=` is a different tag in a different place, and the gate below
   *  only knows about `[sheet:]` commands. */
  options?: { force?: boolean },
): Promise<RulesetCatalogEntriesById> {
  const declared = context.definition.catalogs;
  if (!declared?.length || !(options?.force || replyUsesCatalogEntry(content))) return {};
  const wanted = new Set(context.cards.flatMap((card) => rulesetCatalogIdsForBuild(context.definition, card.build)));
  const catalogs: RulesetCatalogEntriesById = {};
  for (const catalog of declared) {
    if (!wanted.has(catalog.id)) continue;
    try {
      const read = await loadRulesetCatalogEntries(context.packageId, context.definition, catalog);
      if (read.ok) catalogs[catalog.id] = read.entries;
      else {
        logger.warn(
          "[game/sheet] Catalog %s of %s could not be read for this turn: %s",
          catalog.id,
          context.definition.id,
          read.issues.slice(0, 3).join("; "),
        );
      }
    } catch (error) {
      // A turn is never lost to a catalog file.
      logger.warn(error, "[game/sheet] Could not read catalog %s of %s", catalog.id, context.definition.id);
    }
  }
  return catalogs;
}

export interface GameRulesetSheetTurn {
  content: string;
  live: RulesetLiveStates;
  outcomes: SheetCommandOutcome[];
}

/** Apply a reply's sheet commands on top of the live state the turn started with. Never throws:
 *  a turn is never lost to its bookkeeping. */
export function applyGameRulesetSheetTurn(
  context: GameRulesetSheetContext,
  content: string,
  baseLive: RulesetLiveStates | null | undefined,
  /** What `loadTurnRulesetCatalogs` found, for the `use` command. Absent, every `use` is refused. */
  catalogs?: RulesetCatalogEntriesById,
): GameRulesetSheetTurn {
  try {
    const applied = applySheetCommandTags(content, { ...context, live: baseLive ?? {}, catalogs });
    for (const outcome of applied.outcomes) {
      if (!outcome.ok) logger.warn("[game/sheet] Refused for %s: %s (%s)", outcome.who, outcome.reason, outcome.tag);
    }
    return { content: applied.content, live: applied.live, outcomes: applied.outcomes };
  } catch (error) {
    logger.error(error, "[game/sheet] Could not apply sheet commands; the reply is saved as written");
    return { content, live: baseLive ?? {}, outcomes: [] };
  }
}
