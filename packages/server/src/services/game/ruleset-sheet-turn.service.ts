import { isDeepStrictEqual } from "node:util";
import { roomHostIdentity } from "../multiplayer/generation-policy.js";
// ──────────────────────────────────────────────
// Game: one turn of a ruleset game's live sheet state
// ──────────────────────────────────────────────
// The Game Master records what happens to a character sheet with `[sheet: ...]` commands. The
// Engine owns the arithmetic: every command is checked against the live state the turn started
// with, applied or refused, and written back into the saved reply with its outcome. The live state
// itself rides the game-state snapshot of the message and swipe, so a swipe or a regenerated turn
// starts from the state before it and can never spend twice.
import { RULESET_SHEET_DEAD_MARK } from "./gm-prompts.js";
import {
  applySheetCommandTags,
  RULESET_PARTY_KEY,
  rulesetSheetDead,
  rulesetSheetHealth,
  rulesetSheetSpendables,
  rulesetHealthWords,
  rulesetPartyDefinition,
  createSheetCommandTagRegex,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  parseSheetCommandTagBody,
  renderRulesetSheetBlock,
  rulesetCatalogIdsForBuild,
  readRulesetSheetEnvelope,
  rulesetSheetStamp,
  rulesetSheetEnvelopeSchema,
  storedRulesetSheetsSchema,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetLiveStates,
  type SheetCommandCard,
  type SheetCommandOutcome,
  type RulesetMaterialTaken,
  rulesetCardItems,
  normalizeGameInventoryStacks,
  rulesetReadsItems,
  type GameInventoryStack,
  type RulesetItemBook,
  readRulesetPartySheet,
  readRulesetBuilderState,
  rulesetEntryNamed,
  rulesetPrepareCatalogIds,
  applyGameInventoryTags,
  createInventoryTagRegex,
  parseInventoryTagBody,
  type GameInventoryParty,
  gameInventoryStackLabel,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import {
  createChatsStorage,
  withChatMetadataPatchQueue,
  withMessageExtraPatchQueue,
} from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { gamePartySheetRevision } from "./game-party-sheet.service.js";
import { rollDieSecurely } from "./dice-rng.js";
import { gameClockMinutes } from "./time.service.js";
import { buildPartyNpcId, isPartyNpcId } from "../generation/game-party-utils.js";
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
  advancementRefusal?: "save-failed";
  partyBuild?: RulesetSheetBuild | null;
  /** The cards of those taken out of the party, whom a command to the whole party passes by. */
  away?: string[];
  /** Whether an item the reply uses heals whoever uses it, by the name the reply gives it: the
   *  Engine's own heal for that use stands in for a restore of their health beside it. */
  itemHealsUser?: (item: string) => boolean;
  /** The game's clock as the turn began, in minutes: a rest of a kind with none of it passed since the
   *  last is refused. Absent where the game keeps none. */
  clock?: number;
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
    const envelope = readRulesetSheetEnvelope(definition, card.rulesetSheet);
    if (!envelope) {
      logger.warn("[game/sheet] The ruleset sheet for %s is unreadable; its live state is left alone", name);
      return [];
    }
    // The builder's picks say what a `prepare` may add to the sheet.
    const builder = readRulesetBuilderState(card.rulesetSheet);
    return [{ name, build: envelope.build, ...(Object.keys(builder).length > 0 ? { builder } : {}) }];
  });
}

/** One prompt block per party card, showing the sheet as it stands at the start of this turn, with
 *  the items each one holds when the ruleset reads them (`itemStat`). */
export function renderGameRulesetSheetBlocks(
  definition: RulesetDefinition,
  cards: unknown,
  live: RulesetLiveStates | null | undefined,
  catalogs: RulesetCatalogEntriesById = {},
  items?: { book: Pick<RulesetItemBook, "itemOf">; stacks: readonly GameInventoryStack[]; playerName?: string | null },
  partySheet?: unknown,
  /** Who the chat plays as: their card is the player's own, else the first card is. */
  playerName?: string | null,
  /** Cards whose member left the party (see `gameRulesetCardsAway`): never the player's stand-in. */
  away: readonly string[] = [],
): string[] {
  const party = Array.isArray(cards) ? (cards as Array<Record<string, unknown>>) : [];
  const built = sheetCommandCards(definition, party);
  const itemsOf =
    items && rulesetReadsItems(definition)
      ? rulesetCardItems(
          items.book,
          items.stacks,
          built.map((card) => card.name),
          items.playerName,
        )
      : undefined;
  // The stored sheets, whose builder picks say which items a character can reach (1.215).
  const envelopes = new Map(
    party
      .filter((card) => typeof card.name === "string")
      .map((card) => [normalizeCharacterLookupName((card.name as string).trim()), card.rulesetSheet]),
  );
  const blocks = built.map((card) => {
    const stored = live?.[normalizeCharacterLookupName(card.name)];
    const block = renderRulesetSheetBlock(
      definition,
      { ...card, envelope: envelopes.get(normalizeCharacterLookupName(card.name)) },
      stored,
      catalogs,
      itemsOf?.(card.name),
    );
    // Said where it is read, so a potion or a rest is not spent on them in the story (laptop pass 6
    // 2026-10-26: a Potion of Healing poured into a dead hero was used up, and the rest asked for with
    // it never came).
    return rulesetSheetDead(definition, card.build, stored, itemsOf?.(card.name))
      ? `${block}${RULESET_SHEET_DEAD_MARK}; only what raises the dead brings them back. Say so in the story, and do not spend an item on them.`
      : block;
  });
  // The player's own character dead (Alyssa 2026-10-26): while somebody of the party lives, the player
  // plays one of them and the Game Master offers a way back; with everybody dead, the player may go
  // back to a checkpoint, or the story says what follows.
  const dead = (card: SheetCommandCard) =>
    rulesetSheetDead(definition, card.build, live?.[normalizeCharacterLookupName(card.name)], itemsOf?.(card.name));
  const named = playerName ? normalizeCharacterLookupName(playerName) : null;
  // With no character of their own the player directs the whole party, so nobody is their own and only
  // the whole party dead is said (laptop 2026-10-26: "no character of their own" beside "THE PLAYER'S
  // OWN CHARACTER, Rook Hallow, IS DEAD").
  const own = named !== null ? built.find((card) => normalizeCharacterLookupName(card.name) === named) : undefined;
  const lead = named !== null ? (own ?? built[0]) : built.find((card) => dead(card));
  if (lead && dead(lead)) {
    const gone = new Set(away.map((name) => normalizeCharacterLookupName(name)));
    const standIn = built.find(
      (card) => card !== lead && !dead(card) && !gone.has(normalizeCharacterLookupName(card.name)),
    );
    if (named !== null || !standIn)
      blocks.push(
        standIn
          ? `THE PLAYER'S OWN CHARACTER, ${lead.name}, IS DEAD. Until ${lead.name} lives again, the player plays ${standIn.name}: write ${standIn.name} as the one the player speaks and acts as, and the rest of the party as before. Offer a way to bring ${lead.name} back that the story can reach: a Revivify while it can still work, a temple's Raise Dead, or a quest for one. Once ${lead.name} is raised, the player plays them again.`
          : "EVERYONE IN THE PARTY IS DEAD. The player may go back to a checkpoint. If the story goes on instead, it is the story's to say what follows (taken by the foe, found and saved, woken somewhere), told as it would happen; nobody is raised without a cause the story gives.",
      );
  }
  const worn = rulesetPartyWornLine(
    definition,
    built
      .filter((card) => !dead(card) && !away.some((name) => sameCharacter(name, card.name)))
      .map((card) => ({ name: card.name, build: card.build, live: live?.[normalizeCharacterLookupName(card.name)] })),
  );
  if (worn) blocks.push(worn);
  const partyDefinition = rulesetPartyDefinition(definition);
  const envelope = readRulesetPartySheet(
    definition,
    partySheet,
    built.map((card) => card.build),
  );
  if (partyDefinition && envelope)
    blocks.push(
      renderRulesetSheetBlock(
        partyDefinition,
        { name: definition.party!.label, build: envelope.build },
        live?.[RULESET_PARTY_KEY],
      ),
    );
  return blocks;
}

const sameCharacter = (a: string, b: string) => normalizeCharacterLookupName(a) === normalizeCharacterLookupName(b);

/**
 * The party's state said as a whole once it has spent itself (Alyssa 2026-10-26): someone at a quarter
 * of their health or less, a third or less of someone's slots or energy left, or the party at half its
 * health. The encounter budget weighs a fight by the rules, never by what the party has left, so a
 * worn party walking into one is the Game Master's to warn in the story, the way a table's would ("Are
 * you sure?"), leaving the choice to the player. Null while the party is fresh enough.
 */
export function rulesetPartyWornLine(
  definition: RulesetDefinition,
  members: ReadonlyArray<{ name: string; build: RulesetSheetBuild; live: unknown }>,
): string | null {
  const word = rulesetHealthWords(definition)[0] ?? "health";
  let value = 0;
  let max = 0;
  let low = false;
  const said: string[] = [];
  for (const member of members) {
    const health = rulesetSheetHealth(definition, member.build, member.live);
    if (!health || health.max <= 0) continue;
    value += health.value;
    max += health.max;
    if (health.value * 4 <= health.max) low = true;
    const parts = [`${health.value}/${health.max} ${word}`];
    const spend = rulesetSheetSpendables(definition, member.build, member.live);
    if (spend.slots) {
      parts.push(`${spend.slots.value} of ${spend.slots.max} slots left`);
      if (spend.slots.value * 3 <= spend.slots.max) low = true;
    }
    if (spend.energy) {
      parts.push(`${spend.energy.value}/${spend.energy.max} ${spend.energy.label}`);
      if (spend.energy.value * 3 <= spend.energy.max) low = true;
    }
    said.push(`${member.name} ${parts.join(", ")}`);
  }
  if (max === 0 || (!low && value * 2 > max)) return null;
  return `THE PARTY IS WORN DOWN: ${said.join("; ")}. If they head into a fight like this, warn them in the story first, the way a table's Game Master warns a reckless party ("Are you sure?"): a companion's doubt, the odds plainly seen, what their wounds tell them. Then let the player choose. Do not offer a rest or a retreat as a choice, and do not hold the story back.`;
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
  regenerateMessageId?: string | null,
  /** The reply whose sheet commands the context is for, with the party its inventory tags name: what
   *  it puts on or takes off counts on the sheets its commands read (an Amulet of Health put on, then
   *  a heal to the new maximum, in one reply). */
  reply?: { content: string; party: GameInventoryParty },
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
  const turnMeta = await rulesetAdvancementTurnStart(db, chatId, meta, regenerateMessageId);
  const cards = Array.isArray(turnMeta.gameCharacterCards)
    ? (turnMeta.gameCharacterCards as Array<Record<string, unknown>>)
    : [];
  const setupConfig = meta.gameSetupConfig as { personaId?: string | null } | null | undefined;
  const personaId = chat.personaId || setupConfig?.personaId || null;
  const persona = roomHostIdentity() ?? (personaId ? await createCharactersStorage(db).getPersona(personaId) : null);
  const playerName = persona?.name?.trim() || null;
  const built = sheetCommandCards(pinned.definition, cards);
  const clock = gameClockMinutes(meta.gameTime);
  const away = await cardsAwayFromParty(db, chatId, meta, built, playerName);
  // What each one carries, where the ruleset reads items (1.337): a rest's dice read Pell's Teapot.
  const stacks = normalizeGameInventoryStacks(meta.gameInventory);
  // And which items the reply uses heal their user, so the sheet commands do not heal them again.
  const usesItems = !!reply && replyUsesItem(reply.content);
  let itemHealsUser: ((item: string) => boolean) | undefined;
  const readsItems = rulesetReadsItems(pinned.definition) && stacks.some((stack) => stack.item);
  if (readsItems || usesItems) {
    // Imported here: the inventory service reads this module's cards.
    const { loadGameInventoryItemBook } = await import("./game-inventory.service.js");
    const book = await loadGameInventoryItemBook(db, { metadata: meta, resolved: pinned, playerName }, "game-master");
    if (book && usesItems) itemHealsUser = (item) => rulesetItemHealsUser(book, stacks, item);
    if (book && readsItems) {
      const worn = reply ? replyWearTags(reply.content) : "";
      const wearing = worn ? applyGameInventoryTags(worn, stacks, reply!.party, undefined, book).stacks : stacks;
      const itemsOf = rulesetCardItems(
        book,
        wearing,
        built.map((card) => card.name),
        playerName,
      );
      for (const card of built) card.items = itemsOf(card.name);
    }
  }
  return {
    definition: pinned.definition,
    packageId: pinned.packageId,
    cards: built,
    partyBuild:
      readRulesetPartySheet(
        pinned.definition,
        turnMeta.gamePartySheet,
        built.map((card) => card.build),
      )?.build ?? null,
    playerName,
    ...(away.length ? { away } : {}),
    ...(itemHealsUser ? { itemHealsUser } : {}),
    ...(clock !== undefined ? { clock } : {}),
  };
}

/** Whether a reply uses one of the items carried (`[inventory: action="use"]`). */
function replyUsesItem(content: string): boolean {
  if (!content.includes("[")) return false;
  return [...content.matchAll(createInventoryTagRegex())].some(
    (match) => parseInventoryTagBody(match[1] ?? "")?.action === "use",
  );
}

/** Whether the item a use names heals whoever uses it outside a fight, as `useRulesetItemOutsideFight`
 *  heals them: its first use a heal not aimed at the other side. Named as the ruleset names it, or as
 *  a stack the party carries is called. */
function rulesetItemHealsUser(
  book: Pick<RulesetItemBook, "itemOf" | "itemNamed">,
  stacks: readonly GameInventoryStack[],
  name: string,
): boolean {
  const wanted = normalizeCharacterLookupName(name);
  const carried = stacks.find(
    (stack) =>
      !!stack.item &&
      [stack.name, gameInventoryStackLabel(stack)].some((called) => normalizeCharacterLookupName(called) === wanted),
  );
  const item = (carried?.item ? book.itemOf(carried.item) : book.itemNamed(name))?.entry.item;
  const use = item?.use;
  return use?.kind === "heal" && use.targets !== "enemy" && use.amount !== undefined;
}

/** The cards whose member was taken out of the party: a card stays when its member leaves, and a
 *  command to the whole party must not reach them (laptop pass 6, 2026-10-26: a party long rest
 *  rested two removed companions). Nobody is counted away unless every member of the stored party
 *  list could be named, so a list the Engine cannot read in full never drops anyone. */
/** The cards of a game's party whose member left it, as its sheet context counts them. */
export async function gameRulesetCardsAway(
  db: DB,
  chatId: string,
  definition: RulesetDefinition,
  meta: Record<string, unknown>,
  playerName: string | null,
): Promise<string[]> {
  const cards = Array.isArray(meta.gameCharacterCards)
    ? (meta.gameCharacterCards as Array<Record<string, unknown>>)
    : [];
  return cardsAwayFromParty(db, chatId, meta, sheetCommandCards(definition, cards), playerName);
}

async function cardsAwayFromParty(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  cards: SheetCommandCard[],
  playerName: string | null,
): Promise<string[]> {
  const present = await gamePartyRoster(db, chatId, meta, playerName);
  if (!present) return [];
  return cards.filter((card) => !present.has(normalizeCharacterLookupName(card.name))).map((card) => card.name);
}

/**
 * Who is in a game's party now, by normalized name, with the id each is known by (a library
 * character's own id, a party NPC's `npc:` id; the player's own character by `playerId` when given).
 * Null when the game keeps no party list, or one of its members cannot be named: then nobody can be
 * told apart as having left it.
 */
export async function gamePartyRoster(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  playerName: string | null,
  playerId?: string | null,
): Promise<Map<string, string> | null> {
  if (!Array.isArray(meta.gamePartyCharacterIds)) return null;
  const ids = (meta.gamePartyCharacterIds as unknown[]).filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  const npcs = Array.isArray(meta.gameNpcs) ? (meta.gameNpcs as Array<{ name?: unknown }>) : [];
  const characters = createCharactersStorage(db);
  const present = new Map<string, string>(
    playerName ? [[normalizeCharacterLookupName(playerName), playerId?.trim() || ""]] : [],
  );
  for (const id of ids) {
    let name: string | null = null;
    if (isPartyNpcId(id)) {
      const npc = npcs.find((one) => typeof one.name === "string" && buildPartyNpcId(one.name) === id);
      name = typeof npc?.name === "string" ? npc.name : null;
    } else {
      try {
        const row = await characters.getById(id, chatId);
        const data = row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : null;
        name = typeof data?.name === "string" ? data.name : null;
      } catch {
        name = null;
      }
    }
    if (!name?.trim()) return null;
    const key = normalizeCharacterLookupName(name);
    if (!present.has(key)) present.set(key, id);
  }
  // A shared room's players' own heroes, played by them or by the Engine for a player who left or was
  // removed: never on the party list, always in the party (laptop room playtest 2026-10-30: a party
  // long rest skipped a removed guest's hero).
  for (const card of Array.isArray(meta.gameCharacterCards) ? (meta.gameCharacterCards as unknown[]) : []) {
    const row = card && typeof card === "object" ? (card as Record<string, unknown>) : {};
    if (typeof row.multiplayerParticipantId !== "string" || typeof row.name !== "string" || !row.name.trim()) continue;
    const key = normalizeCharacterLookupName(row.name);
    if (!present.has(key)) present.set(key, "");
  }
  return present;
}

/** The reply's inventory tags that put something on or take it off, and nothing else, as one text. */
function replyWearTags(content: string): string {
  if (!content.includes("[")) return "";
  const wear = new Set(["equip", "unequip", "bind", "unbind"]);
  return [...content.matchAll(createInventoryTagRegex())]
    .filter((match) => {
      const action = parseInventoryTagBody(match[1] ?? "")?.action;
      return action !== undefined && wear.has(action);
    })
    .map((match) => match[0])
    .join(" ");
}

/** Whether this reply asks to use something out of a catalog. Every other command is answered from
 *  the sheet alone, so a turn without one never touches a catalog file. */
function replyUsesCatalogEntry(content: string, definition: RulesetDefinition): boolean {
  if (!content.includes("[")) return false;
  const health = definition.combat?.health;
  const healthPool = health && "pool" in health ? health.pool : undefined;
  const healthLabel = definition.sheet.live.pools.find((pool) => pool.id === healthPool)?.label;
  const plain = (text: string) => text.trim().toLowerCase();
  for (const match of content.matchAll(createSheetCommandTagRegex())) {
    const op = parseSheetCommandTagBody(match[1] ?? "").op;
    // A rest that uses a feature as it ends (1.789) reads that feature's entry too (ship readiness:
    // Arcane Recovery off the Game Master's rest tag gave back nothing).
    // A prepare reads the catalogs its entry may be added from.
    if (op?.op === "use" || op?.op === "prepare" || op?.op === "unprepare" || (op?.op === "rest" && op.use))
      return true;
    // So does a restore of anything but health: a pool only a rest gives back may come back through
    // the feature that gives it back (laptop 2026-10-26: Arcane Recovery's slot, its use unspent).
    if (
      op?.op === "restore" &&
      op.pool &&
      plain(op.pool) !== plain(healthPool ?? "") &&
      plain(op.pool) !== plain(healthLabel ?? "")
    )
      return true;
  }
  return false;
}

/** The catalogs what this reply uses outside a fight reads from, beyond the party's own rows: what
 *  a kept call calls (1.798), and the forms a kept shape takes (1.801), so the one named is checked
 *  against what it may take now. Without them any form at all was taken (cloud probes 2026-10-25: a
 *  5th-level druid's Brown Bear and Giant Eagle). */
export function rulesetTurnCalledCatalogs(catalogs: RulesetCatalogEntriesById, content: string): string[] {
  const used = new Set(
    [...content.matchAll(createSheetCommandTagRegex())].flatMap((match) => {
      const op = parseSheetCommandTagBody(match[1] ?? "").op;
      return op?.op === "use" ? [op.name.trim().toLowerCase()] : [];
    }),
  );
  return Object.values(catalogs).flatMap((entries) =>
    entries.flatMap((entry) => {
      if (!used.has(entry.label.trim().toLowerCase())) return [];
      const mechanics = entry.mechanics;
      return [
        ...(mechanics?.beforeFight && mechanics.calls?.from ? [mechanics.calls.from.catalog] : []),
        ...(mechanics?.forms?.from && mechanics.targets === "self" ? [mechanics.forms.from.catalog] : []),
      ];
    }),
  );
}

/** The catalogs a `prepare` adds an entry from (a class's spell list, and the class it reads), for a
 *  reply that prepares one, or that uses one no sheet holds: its refusal says to prepare it first,
 *  where it could be. */
export function rulesetTurnPrepareCatalogs(
  context: Pick<GameRulesetSheetContext, "definition" | "cards">,
  catalogs: RulesetCatalogEntriesById,
  content: string,
): string[] {
  const ops = [...content.matchAll(createSheetCommandTagRegex())].map(
    (match) => parseSheetCommandTagBody(match[1] ?? "").op,
  );
  const reads =
    ops.some((op) => op?.op === "prepare" || op?.op === "unprepare") ||
    ops.some(
      (op) =>
        op?.op === "use" &&
        !context.cards.some((card) => rulesetEntryNamed(context.definition, card.build, catalogs, op.name).ok),
    );
  return reads ? rulesetPrepareCatalogIds(context.definition) : [];
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
  if (!declared?.length || !(options?.force || replyUsesCatalogEntry(content, context.definition))) return {};
  const wanted = new Set(context.cards.flatMap((card) => rulesetCatalogIdsForBuild(context.definition, card.build)));
  const catalogs: RulesetCatalogEntriesById = {};
  // And the ones the party's calls kept outside a fight call from (1.798), to name the creature.
  for (const pass of [0, 1]) {
    if (pass === 1) {
      const calledFrom = rulesetTurnCalledCatalogs(catalogs, content);
      wanted.clear();
      for (const id of calledFrom) if (!catalogs[id]) wanted.add(id);
      for (const id of rulesetTurnPrepareCatalogs(context, catalogs, content)) if (!catalogs[id]) wanted.add(id);
    }
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
  }
  return catalogs;
}

export interface GameRulesetSheetTurn {
  builds: Record<string, RulesetSheetBuild>;
  baseBuilds: Record<string, RulesetSheetBuild>;
  content: string;
  live: RulesetLiveStates;
  outcomes: SheetCommandOutcome[];
  /** Each rest a character took this turn, by card name. */
  rests: Array<{ who: string; rest: string }>;
  /** The priced materials this turn's casts used up (1.790), out of the stacks they came from. */
  materials: RulesetMaterialTaken[];
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
    const partyBuild =
      context.partyBuild === undefined ? readRulesetPartySheet(context.definition, null)?.build : context.partyBuild;
    const applied = applySheetCommandTags(content, {
      ...context,
      partyBuild,
      live: baseLive ?? {},
      catalogs,
      // A rest that brings on what a condition does with it (1.260) rolls real dice.
      roll: rollDieSecurely,
    });
    for (const outcome of applied.outcomes) {
      if (!outcome.ok) logger.warn("[game/sheet] Refused for %s: %s (%s)", outcome.who, outcome.reason, outcome.tag);
    }
    return {
      content: applied.content,
      live: applied.live,
      outcomes: applied.outcomes,
      rests: applied.rests,
      materials: applied.materials,
      builds: applied.builds,
      baseBuilds: Object.fromEntries([
        ...context.cards.map((card) => [normalizeCharacterLookupName(card.name), card.build]).reverse(),
        ...(partyBuild ? [[RULESET_PARTY_KEY, partyBuild]] : []),
      ]),
    };
  } catch (error) {
    logger.error(error, "[game/sheet] Could not apply sheet commands; the reply is saved as written");
    return { content, live: baseLive ?? {}, outcomes: [], rests: [], materials: [], builds: {}, baseBuilds: {} };
  }
}

// Adapt the shared sheet to the existing advancement history without storing a fake character.
const PARTY_CARD = Symbol("party sheet");
function advancementCardName(card: Record<string, unknown>): string {
  return Reflect.get(card, PARTY_CARD) ? RULESET_PARTY_KEY : normalizeCharacterLookupName(String(card.name));
}
function advancementCards(metadata: Record<string, unknown>): Record<string, unknown>[] {
  const cards = Array.isArray(metadata.gameCharacterCards) ? metadata.gameCharacterCards : [];
  return [
    ...cards,
    ...(Object.hasOwn(metadata, "gamePartySheet")
      ? [{ name: RULESET_PARTY_KEY, rulesetSheet: metadata.gamePartySheet, [PARTY_CARD]: true }]
      : []),
  ];
}
function advancementMetadata(cards: unknown, current: Record<string, unknown>): Record<string, unknown> {
  const entries = cards as Record<string, unknown>[];
  const party = entries.find((card) => Reflect.get(card, PARTY_CARD));
  const sheet = party ? (party.rulesetSheet ?? null) : undefined;
  // A shared sheet the story changed is a new revision, so a player's draft opened before it is
  // refused rather than saved over it (1.163).
  const changed = party && JSON.stringify(sheet) !== JSON.stringify(current.gamePartySheet ?? null);
  return {
    gameCharacterCards: entries.filter((card) => !Reflect.get(card, PARTY_CARD)),
    ...(party ? { gamePartySheet: sheet } : {}),
    ...(changed ? { gamePartySheetRevision: gamePartySheetRevision(current) + 1 } : {}),
  };
}

interface AdvancementChange {
  name: string;
  before: RulesetSheetEnvelope | null;
  after: RulesetSheetEnvelope | null;
}

/** Imported messages can carry receipts too; only bounded, readable envelopes are replayed. */
function advancementChanges(raw: unknown): AdvancementChange[] {
  if (!Array.isArray(raw) || raw.length > 1600) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry.name !== "string" || entry.name.length > 100) return [];
    const before = entry.before === null ? null : rulesetSheetEnvelopeSchema.safeParse(entry.before);
    const after = entry.after === null ? null : rulesetSheetEnvelopeSchema.safeParse(entry.after);
    if ((before && !before.success) || (after && !after.success)) return [];
    if (
      !storedRulesetSheetsSchema.safeParse({
        ...(after?.success ? { receipt: after.data } : {}),
        ...(before?.success ? { before: before.data } : {}),
      }).success
    )
      return [];
    return [
      { name: entry.name, before: before?.success ? before.data : null, after: after?.success ? after.data : null },
    ];
  });
}

/** Undo only values still matching the receipt, preserving subsequent edits to other values. */
export function replayRulesetAdvancementCards(cards: unknown, raw: unknown, undo: boolean): unknown {
  const changes = advancementChanges(raw);
  if (!Array.isArray(cards) || changes.length === 0) return cards;
  const next = cards.map((card) => ({ ...card }));
  for (const change of undo ? changes.reverse() : changes) {
    const card = next.find((entry) => typeof entry.name === "string" && advancementCardName(entry) === change.name);
    if (!card) continue;
    const expected = undo ? change.after : change.before;
    const sheet = undo ? change.before : change.after;
    if (JSON.stringify(card.rulesetSheet ?? null) === JSON.stringify(expected)) {
      if (sheet === null) delete card.rulesetSheet;
      else card.rulesetSheet = structuredClone(sheet);
      continue;
    }
    const current = rulesetSheetEnvelopeSchema.safeParse(card.rulesetSheet);
    if (!current.success) continue;
    for (const group of ["fields", "abilities", "skills", "saves"] as const) {
      const from = expected?.build[group] ?? {};
      const to = sheet?.build[group] ?? {};
      const values = current.data.build[group] as Record<string, string | number | boolean>;
      for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
        if (from[id] === to[id] || values[id] !== from[id]) continue;
        if (to[id] === undefined) delete values[id];
        else values[id] = to[id];
      }
    }
    card.rulesetSheet = current.data;
  }
  return next;
}

type AdvancementMessage = { id: string; extra: unknown };

/** Each reply carries its ending sheets, like the live-state snapshot. The initial envelopes are
 *  undo history in the same chat metadata; the cards remain the only editable build store. */
function advancementProjection(
  baseline: unknown,
  messages: AdvancementMessage[],
): Map<string, RulesetSheetEnvelope | null> {
  const state = new Map(advancementChanges(baseline).map((entry) => [entry.name, entry.after]));
  for (const message of messages) {
    for (const entry of advancementChanges(parseMetadata(message.extra).rulesetAdvancement))
      state.set(entry.name, entry.after);
  }
  return state;
}

function projectAdvancementCards(
  metadata: Record<string, unknown>,
  from: AdvancementMessage[],
  to: AdvancementMessage[],
): unknown {
  const before = advancementProjection(metadata.gameRulesetAdvancementBase, from);
  const after = advancementProjection(metadata.gameRulesetAdvancementBase, to);
  const changes = [...before].map(([name, expected]) => ({ name, after: expected, before: after.get(name) ?? null }));
  return replayRulesetAdvancementCards(advancementCards(metadata), changes, true);
}

/** A regenerated prompt and its commands see the snapshot before that message. No write. */
export async function rulesetAdvancementTurnStart(
  db: DB,
  chatId: string,
  metadata: Record<string, unknown>,
  messageId?: string | null,
): Promise<Record<string, unknown>> {
  if (!messageId || !metadata.gameRulesetAdvancementBase) return metadata;
  const messages = await createChatsStorage(db).listMessages(chatId);
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0) return metadata;
  return {
    ...metadata,
    ...advancementMetadata(projectAdvancementCards(metadata, messages, messages.slice(0, index)), metadata),
  };
}

/** Called with the metadata and message queues held. Selecting or removing an older telling must
 *  leave a later snapshot in force, just as it does for live sheet state. */
export async function reconcileGameRulesetAdvancement(
  db: DB,
  owner: { id: string; chatId: string },
  undo: boolean,
  excluded: ReadonlySet<string> = new Set(),
): Promise<void> {
  const chats = createChatsStorage(db);
  const all = (await chats.listMessages(owner.chatId)).filter((message) => !excluded.has(message.id));
  const without = all.filter((message) => message.id !== owner.id);
  await chats.patchMetadata(
    owner.chatId,
    (metadata) => ({
      ...advancementMetadata(projectAdvancementCards(metadata, undo ? all : without, undo ? without : all), metadata),
    }),
    { metadataQueueHeld: true },
  );
}

/** Saves builds through the same metadata patch as the sheet editor, with the swipe's snapshot. */
export async function saveGameRulesetAdvancement(
  db: DB,
  chatId: string,
  messageId: string,
  swipeIndex: number,
  definition: RulesetDefinition,
  turn: Pick<GameRulesetSheetTurn, "builds" | "baseBuilds">,
): Promise<void> {
  const { builds, baseBuilds } = turn;
  // A prepare edits the build on a ruleset with neither advancement nor a party sheet.
  if (!definition.sheet.advancement && !definition.party && Object.keys(builds).length === 0) return;
  const chats = createChatsStorage(db);
  await withChatMetadataPatchQueue(chatId, () =>
    withMessageExtraPatchQueue(messageId, () =>
      db.transaction(async () => {
        const message = await chats.getMessage(messageId);
        if (!message || message.chatId !== chatId || message.activeSwipeIndex !== swipeIndex)
          throw new Error("Advancement reply is no longer active");
        const messages = await chats.listMessages(chatId);
        const index = messages.findIndex((entry) => entry.id === messageId);
        const existing = advancementChanges(parseMetadata(message.extra).rulesetAdvancement);
        let snapshots: AdvancementChange[] = [];
        await chats.patchMetadata(
          chatId,
          (metadata) => {
            if (definition.party) metadata = { ...metadata, gamePartySheet: metadata.gamePartySheet ?? null };
            const cards = advancementCards(metadata);
            const hasSnapshots = messages.some(
              (entry) => advancementChanges(parseMetadata(entry.extra).rulesetAdvancement).length > 0,
            );
            const baseline = hasSnapshots ? advancementChanges(metadata.gameRulesetAdvancementBase) : [];
            const known = new Set(baseline.map((entry) => entry.name));
            for (const card of cards) {
              if (typeof card.name !== "string") continue;
              const name = advancementCardName(card);
              if (known.has(name)) continue;
              const read = card.rulesetSheet == null ? null : rulesetSheetEnvelopeSchema.safeParse(card.rulesetSheet);
              if (read && !read.success) continue;
              const before = read?.success ? read.data : null;
              baseline.push({ name, before, after: before });
              known.add(name);
            }
            const recorded = { ...metadata, gameRulesetAdvancementBase: baseline };
            // A continuation builds on its own snapshot; a new swipe starts before its message.
            const startCards = projectAdvancementCards(
              recorded,
              messages,
              messages.slice(0, index + (existing.length ? 1 : 0)),
            ) as Record<string, unknown>[];
            const seen = new Set<string>();
            snapshots = startCards.flatMap((card) => {
              if (typeof card.name !== "string") return [];
              const key = advancementCardName(card);
              if (seen.has(key)) return [];
              const parsed = card.rulesetSheet == null ? null : rulesetSheetEnvelopeSchema.safeParse(card.rulesetSheet);
              if (parsed && !parsed.success) {
                if (builds[key]) throw new Error("Advancement sheet is unreadable");
                return [];
              }
              seen.add(key);
              const previous = parsed?.success ? parsed.data : null;
              let after = previous;
              const build = builds[key];
              const sheetDefinition = key === RULESET_PARTY_KEY ? rulesetPartyDefinition(definition) : definition;
              if (build) {
                if (!sheetDefinition) throw new Error("Party sheet no longer exists");
                const migrated = previous ? readRulesetSheetEnvelope(sheetDefinition, previous) : null;
                if (previous && !migrated) throw new Error("Advancement sheet is unreadable");
                const current = structuredClone(migrated?.build ?? defaultRulesetSheetBuild(sheetDefinition));
                const base = baseBuilds[key];
                if (!base) throw new Error("Advancement has no starting build");
                for (const group of ["fields", "abilities", "skills", "saves"] as const) {
                  for (const [id, value] of Object.entries(build[group])) {
                    if (value === base[group][id]) continue;
                    if (current[group][id] !== base[group][id])
                      throw new Error(`Advancement conflicts with an edited ${group}.${id}`);
                    (current[group] as Record<string, string | number | boolean>)[id] = value;
                  }
                }
                // A list a prepare changed (its prepared marks, a row it added), whole.
                for (const [id, rows] of Object.entries(build.lists)) {
                  if (isDeepStrictEqual(rows, base.lists[id])) continue;
                  if (!isDeepStrictEqual(current.lists[id], base.lists[id]))
                    throw new Error(`Advancement conflicts with an edited lists.${id}`);
                  current.lists[id] = rows;
                }
                after = rulesetSheetEnvelopeSchema.parse({
                  ...migrated,
                  v: rulesetSheetStamp(definition, previous),
                  build: current,
                });
                storedRulesetSheetsSchema.parse({ [definition.id]: after });
              }
              return [{ name: key, before: previous, after }];
            });
            if (Object.keys(builds).some((key) => !seen.has(key))) throw new Error("Advancement card no longer exists");
            const beforeMessages = messages.map((entry) =>
              entry.id === messageId
                ? {
                    ...entry,
                    extra: {
                      rulesetAdvancement: snapshots.map((snapshot) => ({ ...snapshot, after: snapshot.before })),
                    },
                  }
                : entry,
            );
            const nextMessages = messages.map((entry) =>
              entry.id === messageId ? { ...entry, extra: { rulesetAdvancement: snapshots } } : entry,
            );
            return {
              gameRulesetAdvancementBase: baseline,
              ...advancementMetadata(projectAdvancementCards(recorded, beforeMessages, nextMessages), metadata),
            };
          },
          { metadataQueueHeld: true },
        );
        await chats.updateMessageExtraForSwipe(messageId, swipeIndex, { rulesetAdvancement: snapshots }, undefined, {
          messageQueueHeld: true,
        });
      }),
    ),
  );
}
