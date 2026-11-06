import { roomHostIdentity } from "../multiplayer/generation-policy.js";
// Saving a change to Game Mode's inventory.
//
// The stacks live in the chat's metadata, the journal beside them, and the detailed inventory on a
// game-state row. Every change (the inventory screen, the Game Master's tags, a fight spending an
// item) goes through `commitGameInventoryChange`, which works the change out once and writes all
// three inside one metadata-queue slot and one transaction, so they can never disagree.
import {
  followGameInventoryDetails,
  normalizeCharacterLookupName,
  forgetGameInventoryTelling,
  applyGameInventoryOps,
  gameFightItems,
  revealGameInventoryFake,
  rulesetCardItems,
  rulesetFakesTheSheetShows,
  rulesetItemSources,
  readRulesetLive,
  gameFightUseEffect,
  gameInventoryChargeStack,
  gameInventoryFightSpendStack,
  gameInventoryItemsOwnNamed,
  gameInventoryForTelling,
  normalizeGameInventoryStacks,
  passRulesetItemTime,
  rulesetItemVanishedLine,
  rulesetItemRechargeLine,
  readGameInventoryTurn,
  readRulesetInventedItems,
  rulesetItemBook,
  gameWorldKitFromMetadata,
  worldKitItems,
  rulesetLayerOptionKey,
  rulesetLiveWornOff,
  rulesetItemTouchHarm,
  gameInventoryWearMet,
  gameInventoryWearNeeds,
  type RulesetLayerOptions,
  type CombatItemEffect,
  type GameInventoryFightLine,
  type GameInventoryJournalEntry,
  type GameInventoryStack,
  type InventoryItem,
  type PlayerStats,
  type RulesetCatalogEntry,
  type RulesetItemBook,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { loadRulesetCatalogEntries } from "./ruleset-catalog.service.js";
import { loadRulesetRegistry, resolveGameRuleset, type ResolvedGameRuleset } from "./ruleset-registry.service.js";
import { loadGameRulesetSheetContext, sheetCommandCards } from "./ruleset-sheet-turn.service.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { resolveChatUserIdentity } from "../chat-user-identity.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { createGameStateStorage, parseStoredRulesetLive } from "../storage/game-state.storage.js";
import { resolveVisibleGameStateAnchor } from "../../routes/generate/generate-route-utils.js";
import { addEventEntry, addInventoryEntry, createJournal, type Journal } from "./journal.service.js";
import { rollDieSecurely } from "./dice-rng.js";

/** What a change works out from the stacks it is given. The same stacks and nothing else leave
 *  everything as it was. */
export interface GameInventoryChange<T> {
  stacks: GameInventoryStack[];
  journal: readonly GameInventoryJournalEntry[];
  /** Journal events beside the inventory entries (starting gear taken), saved in the same write. */
  events?: ReadonlyArray<{ title: string; content: string }>;
  /** Other metadata that belongs with this change, saved in the same write (a turn's record). */
  metadata?: Record<string, unknown>;
  value: T;
}

/** Which game-state row carries the detailed inventory for this change. */
export type GameInventoryRowTarget =
  /** The row the player sees: the last assistant message's active swipe, else the newest row. */
  | { kind: "visible" }
  /** None yet: the caller follows it later with `followGameInventoryOnRow`, once the row it belongs
   *  to exists (a turn whose reply is not saved yet). */
  | { kind: "none" }
  /** One message's swipe, cloned from `baseSnapshot` when it has no row yet (a turn just saved). */
  | {
      kind: "message";
      messageId: string;
      swipeIndex: number;
      baseSnapshot?: Awaited<ReturnType<ReturnType<typeof createGameStateStorage>["getLatest"]>>;
    };

export interface GameInventoryCommitted<T> {
  stacks: GameInventoryStack[];
  /** What the change found out (a fake its holder's sheet shows for what it is), as lines to show. */
  foundOut?: string[];
  /** The game state's stats after the change, when a row with a detailed inventory was written. */
  playerStats?: PlayerStats;
  value: T;
}

/** A chat's metadata as an object, or an empty one when it is missing or will not parse. */
export function readMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parsePlayerStats(raw: unknown): PlayerStats | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PlayerStats) : null;
  } catch {
    return null;
  }
}

/**
 * The items a game's ruleset lists, for a change that needs them: which names are its items, how
 * many one stack holds, what each weighs and wears, what every character carries and binds (read off
 * their sheet), and what the Game Master is shown about each. Undefined for a game with no ruleset,
 * one this install cannot honour, or one without an `items` block. `who` is whose change it is: the
 * player's typed-in items follow the ruleset's `freeform` and cannot part with a bound cursed item,
 * and the Game Master's untyped ones follow `native`. A catalog that cannot be read is logged and left
 * out.
 *
 * The player's sheet is the card named for who the chat plays as (`playerName`, read off the chat's
 * identity when it is not given, as a turn reads it), or the first card when no card has that name,
 * as a check falls back to it. The inventory screen reads it the same way.
 */
/** The layers a game turned on, as the ruleset's layer options: what its item book and market read
 *  their coins and items by. */
export function gameRulesetLayerOptions(resolved: Extract<ResolvedGameRuleset, { status: "ok" }>): RulesetLayerOptions {
  return Object.fromEntries(resolved.layers.map((layer) => [rulesetLayerOptionKey(layer.id), true]));
}

export async function loadGameInventoryItemBook(
  db: DB,
  source:
    | { chatId: string }
    | { metadata: Record<string, unknown>; resolved?: ResolvedGameRuleset | null; playerName?: string | null },
  who: "player" | "game-master",
): Promise<RulesetItemBook | undefined> {
  let metadata: Record<string, unknown>;
  let playerName: string | null | undefined;
  let chat: Awaited<ReturnType<ReturnType<typeof createChatsStorage>["getById"]>> = null;
  if ("chatId" in source) {
    chat = await createChatsStorage(db).getById(source.chatId);
    if (!chat) return undefined;
    metadata = readMetadata(chat.metadata);
  } else {
    metadata = source.metadata;
    playerName = source.playerName;
  }
  if (metadata.gameRuleset == null) {
    // A game with no ruleset buys, pays and earns in its setting kit's money (worldgen W6b), the rest of
    // its items staying the plain ones it always had.
    const kitItems = worldKitItems(gameWorldKitFromMetadata(metadata));
    return kitItems
      ? rulesetItemBook(kitItems.definition, kitItems.entries, { plain: "allow", actor: who })
      : undefined;
  }
  const resolved =
    ("resolved" in source ? source.resolved : null) ?? resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  if (resolved.status !== "ok" || !resolved.definition.items) return undefined;
  const { definition, packageId } = resolved;
  const entries: Record<string, RulesetCatalogEntry[]> = {};
  // ponytail: read on every change that needs it, like a turn's `use` catalogs. An asset catalog is
  // re-read and re-checked each time; a cache keyed by the asset's hash is the upgrade path if an
  // inventory with a large file ever feels slow.
  for (const catalog of definition.catalogs ?? []) {
    if (catalog.holds !== "items") continue;
    try {
      const read = await loadRulesetCatalogEntries(packageId, definition, catalog);
      if (read.ok) entries[catalog.id] = read.entries;
      else
        logger.warn(
          "[game/inventory] Item catalog %s of %s could not be read: %s",
          catalog.id,
          definition.id,
          read.issues.slice(0, 3).join("; "),
        );
    } catch (error) {
      logger.warn(error, "[game/inventory] Could not read item catalog %s of %s", catalog.id, definition.id);
    }
  }
  const cards = sheetCommandCards(
    definition,
    Array.isArray(metadata.gameCharacterCards) ? (metadata.gameCharacterCards as Array<Record<string, unknown>>) : [],
  );
  // Who the player is, as a turn reads it (the chat's own identity), when the ruleset needs a sheet.
  if (playerName === undefined && chat && (definition.items?.carry || definition.items?.binding)) {
    const identity =
      roomHostIdentity() ??
      (await resolveChatUserIdentity(createCharactersStorage(db), {
        personaId: chat.personaId,
        personaCharacterId: chat.personaCharacterId,
        mode: chat.mode,
      }));
    playerName = identity?.name ?? null;
  }
  playerName = roomHostIdentity()?.name ?? playerName;
  const playerKey = playerName ? normalizeCharacterLookupName(playerName) : "";
  const player =
    (playerKey ? cards.find((card) => normalizeCharacterLookupName(card.name) === playerKey) : undefined) ?? cards[0];
  return rulesetItemBook(definition, entries, {
    layerOptions: gameRulesetLayerOptions(resolved),
    // The player's typed-in items follow the ruleset's `freeform`; the Game Master's untyped ones follow
    // `native`, which leaves it the ruleset's items and the ones it invents.
    plain: (who === "player" ? definition.items?.freeform === "refuse" : definition.items?.native === false)
      ? "refuse"
      : "allow",
    actor: who,
    // The items the Game Master has invented in this game, which every change reads like the
    // ruleset's own.
    invented: readRulesetInventedItems(definition, metadata.gameInventedItems),
    sheets: {
      ...(player ? { player: player.build } : {}),
      // Every card by its name, the player's too: a bag is found by its holder's name, and the first
      // card read for the player may also be a companion's own.
      members: cards,
    },
  });
}

/**
 * Whether a game's ruleset turns Game Mode's own items off (`items.native: false`). Then a fight asks
 * no model what the items do and offers none: they have no fight effect until the ruleset says what
 * they do. A game whose ruleset cannot be read keeps Game Mode's own.
 */
/**
 * The items one of the Engine's own fights (Classic or Tactical) offers in this game, and what each
 * does (#6905): the ruleset's items by their `use`, the rest by `guessed`, and none of the rest where
 * the ruleset turns Game Mode's own items off. A game without ruleset items (`ruleset` false) offers
 * every item as guessed, as it always has, and its routes check nothing more than they did.
 */
export async function loadGameFightItems(
  db: DB,
  metadata: Record<string, unknown>,
  guessed: readonly CombatItemEffect[],
): Promise<{ lines: GameInventoryFightLine[]; effects: CombatItemEffect[]; ruleset: boolean }> {
  const stacks = normalizeGameInventoryStacks(metadata.gameInventory);
  const resolved = metadata.gameRuleset == null ? null : resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  const native = resolved?.status !== "ok" || resolved.definition.items?.native !== false;
  const book =
    resolved?.status === "ok" ? await loadGameInventoryItemBook(db, { metadata, resolved }, "player") : undefined;
  return { ...gameFightItems(stacks, book, native, guessed), ruleset: book !== undefined };
}

/**
 * What a fight's next uses of its lines do in this game, for a use that comes out of a fake (1.79):
 * `effectOf(name, effect, nth)` is what the `nth` use from now (0 for the next) of the line spent by
 * `name` does, where the line otherwise does `effect`. Null when the party holds no fake, so every use
 * does what its line says.
 */
export async function loadGameFightUseEffects(
  db: DB,
  metadata: Record<string, unknown>,
): Promise<{ effectOf: (name: string, effect: CombatItemEffect, nth?: number) => CombatItemEffect } | null> {
  const stacks = normalizeGameInventoryStacks(metadata.gameInventory);
  if (!stacks.some((stack) => stack.truly)) return null;
  const book = await loadGameInventoryItemBook(db, { metadata }, "player");
  if (!book) return null;
  return {
    // One that holds charges spends them from the stack a charge takes them from: the `nth` use from now
    // is read after the uses before it spent theirs (a stack run dry passes to the next).
    effectOf: (name, effect, nth = 0) => {
      if (!effect.charges)
        return gameFightUseEffect(effect, gameInventoryFightSpendStack(stacks, name, book, nth), book);
      const before =
        nth > 0 ? applyGameInventoryOps(stacks, [{ op: "charge", name, count: nth }], undefined, book).stacks : stacks;
      return gameFightUseEffect(
        effect,
        gameInventoryChargeStack(before, gameInventoryItemsOwnNamed(before, name), book),
        book,
      );
    },
  };
}

export async function gameRulesetTurnsNativeItemsOff(db: DB, metadata: Record<string, unknown>): Promise<boolean> {
  if (metadata.gameRuleset == null) return false;
  const resolved = resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  return resolved.status === "ok" && resolved.definition.items?.native === false;
}

/**
 * Work a change out on the stacks as saved and write everything it touches. `change` runs with the
 * chat's metadata queue held, so nothing else can move the stacks between the read and the write;
 * it may throw to refuse the whole change. Null when the chat does not exist.
 */
/**
 * Game time passing on the chat's clock (Capability API 1.556): the items whose charges or uses come
 * back after a wait count it, and get them back once they have waited it all. Logged, never thrown:
 * the clock moved either way.
 */
export async function passGameInventoryTime(db: DB, chatId: string, minutes: number): Promise<void> {
  if (!(minutes > 0)) return;
  try {
    const chat = await createChatsStorage(db).getById(chatId);
    if (!chat) return;
    const metadata = readMetadata(chat.metadata);
    if (metadata.gameRuleset == null) return;
    // Only items that wait for something to come back, or that vanish (1.760), count it.
    if (
      !normalizeGameInventoryStacks(metadata.gameInventory).some(
        (stack) => (stack.item && stack.quantity === 1) || stack.vanishesIn,
      )
    )
      return;
    const resolved = resolveGameRuleset(metadata, await loadRulesetRegistry(db));
    if (resolved.status !== "ok") return;
    const book = await loadGameInventoryItemBook(db, { metadata, resolved }, "player");
    if (!book) return;
    await commitGameInventoryChange(db, chatId, (current) => {
      const passed = passRulesetItemTime({
        definition: resolved.definition,
        itemOf: book.itemOf,
        stacks: current,
        minutes,
        roll: rollDieSecurely,
      });
      const events = [
        ...(passed.recharged.length > 0
          ? [{ title: "Items recharged", content: rulesetItemRechargeLine(passed.recharged) }]
          : []),
        // What was made to last only so long (1.760): Creation's.
        ...(passed.vanished.length > 0
          ? [{ title: "Items vanished", content: rulesetItemVanishedLine(passed.vanished) }]
          : []),
      ];
      return {
        stacks: passed.changed ? passed.stacks : current,
        journal: passed.vanished.map((one) => ({ item: one.name, action: "removed" as const, quantity: one.count })),
        ...(events.length > 0 ? { events } : {}),
        value: null,
      };
    });
  } catch (error) {
    logger.warn(error, "[game/inventory] Could not pass game time over the items in chat %s", chatId);
  }
}

export async function commitGameInventoryChange<T>(
  db: DB,
  chatId: string,
  change: (stacks: GameInventoryStack[], metadata: Record<string, unknown>) => GameInventoryChange<T>,
  target: GameInventoryRowTarget = { kind: "visible" },
): Promise<GameInventoryCommitted<T> | null> {
  return withChatMetadataPatchQueue(chatId, () =>
    db.transaction(() => applyGameInventoryChangeHeld(db, chatId, change, target)),
  );
}

/**
 * `commitGameInventoryChange` for a caller that already holds the chat's metadata queue and runs
 * inside a transaction of its own (a fight saving its turn), so both commit or neither does.
 */
export async function applyGameInventoryChangeHeld<T>(
  db: DB,
  chatId: string,
  change: (stacks: GameInventoryStack[], metadata: Record<string, unknown>) => GameInventoryChange<T>,
  target: GameInventoryRowTarget = { kind: "visible" },
): Promise<GameInventoryCommitted<T> | null> {
  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  if (!chat) return null;
  const metadata = readMetadata(chat.metadata);
  const before = normalizeGameInventoryStacks(metadata.gameInventory);
  const changed = change(before, metadata);
  // A worn or carried fake that the sheet shows for what it is, is found out with the change that
  // made it so (1.79, the user's ruling). Never at the cost of the change itself.
  let found: Awaited<ReturnType<typeof revealFakesTheSheetShows>> = null;
  if (changed.stacks !== before) {
    try {
      found = await revealFakesTheSheetShows(db, chatId, metadata, changed.stacks);
    } catch (error) {
      logger.warn(error, "[game/inventory] Could not tell whether a fake shows on a sheet in chat %s", chatId);
    }
  }
  let outcome = found ? withFoundOut(changed, found) : changed;
  if (outcome.stacks === before && outcome.journal.length === 0 && !outcome.events?.length && !outcome.metadata) {
    return { stacks: before, value: outcome.value };
  }
  // What an item deals whoever it comes into the hands of (1.701), said in the same write and taken
  // off their sheet once it is saved. Never at the cost of the change itself.
  let touched: Awaited<ReturnType<typeof harmWhoTouched>> = null;
  if (outcome.stacks !== before) {
    try {
      touched = await harmWhoTouched(db, chatId, metadata, before, outcome.stacks);
    } catch (error) {
      logger.warn(error, "[game/inventory] Could not work out what an item dealt whoever took it in chat %s", chatId);
    }
  }
  if (touched) outcome = { ...outcome, events: [...(outcome.events ?? []), ...touched.events] };

  await chats.patchMetadata(
    chatId,
    (current) => {
      const patch: Record<string, unknown> = { ...outcome.metadata };
      if (outcome.stacks !== before) patch.gameInventory = outcome.stacks;
      if (outcome.journal.length > 0 || outcome.events?.length) {
        let journal = (current.gameJournal as Journal | undefined) ?? createJournal();
        for (const entry of outcome.journal) {
          journal = addInventoryEntry(journal, entry.item, entry.action, entry.quantity);
        }
        for (const event of outcome.events ?? []) journal = addEventEntry(journal, event.title, event.content);
        patch.gameJournal = journal;
      }
      return patch;
    },
    { metadataQueueHeld: true },
  );
  if (touched) {
    try {
      await touched.write();
    } catch (error) {
      logger.warn(error, "[game/inventory] Could not take what an item dealt off a sheet in chat %s", chatId);
    }
  }
  // What only a worn item kept on (1.664) comes off with the change that took the item off. Never at
  // the cost of the change itself.
  if (outcome.stacks !== before) {
    try {
      await endWhatWornItemsKept(db, chatId, metadata, outcome.stacks);
    } catch (error) {
      logger.warn(error, "[game/inventory] Could not end what a worn item kept on in chat %s", chatId);
    }
  }
  const foundOut = found ? { foundOut: found.events.map((event) => event.content) } : {};
  if (outcome.stacks === before || target.kind === "none") {
    return { stacks: outcome.stacks, value: outcome.value, ...foundOut };
  }
  const playerStats = await followOnRow(db, chatId, before, outcome.stacks, target);
  return { stacks: outcome.stacks, ...(playerStats ? { playerStats } : {}), value: outcome.value, ...foundOut };
}

/**
 * The conditions an item's use kept on only while that item is worn (1.664, Armor of Invulnerability),
 * taken off every sheet whose item is no longer worn, or no longer there, on the row the sheet shows.
 */
async function endWhatWornItemsKept(
  db: DB,
  chatId: string,
  metadata: Record<string, unknown>,
  stacks: readonly GameInventoryStack[],
): Promise<void> {
  if (metadata.gameRuleset == null) return;
  const states = createGameStateStorage(db);
  const visibleAnchor = resolveVisibleGameStateAnchor(await createChatsStorage(db).listMessages(chatId));
  const row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
  const stored = parseStoredRulesetLive(row?.rulesetLive);
  if (!row || !stored) return;
  const kept = Object.values(stored).some(
    (live) => live && typeof live === "object" && Object.keys((live as { wornFrom?: object }).wornFrom ?? {}).length,
  );
  if (!kept) return;
  const resolved = resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  if (resolved.status !== "ok") return;
  const book = await loadGameInventoryItemBook(db, { metadata, resolved }, "player");
  if (!book) return;
  const worn = new Set(
    stacks.flatMap((stack) => {
      // Read off the catalog item, so one drawn as it is used (1.808) counts only while it is on.
      const item = stack.item ? book.itemOf(stack.item)?.entry.item : undefined;
      return item && gameInventoryWearMet(stack, gameInventoryWearNeeds(item)) ? [stack.id] : [];
    }),
  );
  let changed = false;
  const next = Object.fromEntries(
    Object.entries(stored).map(([name, live]) => {
      const before = Object.keys((live as { wornFrom?: object } | null)?.wornFrom ?? {}).length;
      const after = rulesetLiveWornOff(live, worn);
      if (Object.keys(after.live.wornFrom ?? {}).length === before) return [name, live];
      changed = true;
      return [name, after.live];
    }),
  );
  if (changed) await states.updateByMessage(row.messageId, row.swipeIndex, chatId, { rulesetLive: next });
}

/**
 * What an item deals whoever it comes into the hands of (Capability API 1.701): every stack that is new,
 * changed hands, or grew, of an item with `touchHarms`, rolled for whoever now carries it on the row the
 * sheet shows. The journal's lines, and the write that takes it off their sheets.
 */
async function harmWhoTouched(
  db: DB,
  chatId: string,
  metadata: Record<string, unknown>,
  before: readonly GameInventoryStack[],
  after: readonly GameInventoryStack[],
): Promise<{ events: Array<{ title: string; content: string }>; write: () => Promise<void> } | null> {
  if (metadata.gameRuleset == null) return null;
  const was = new Map(before.map((stack) => [stack.id, stack]));
  const taken = after.filter((stack) => {
    const had = was.get(stack.id);
    return !had || (had.holder ?? "") !== (stack.holder ?? "") || stack.quantity > had.quantity;
  });
  if (!taken.length) return null;
  const resolved = resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  if (resolved.status !== "ok") return null;
  const book = await loadGameInventoryItemBook(db, { metadata, resolved }, "player");
  if (!book) return null;
  // What it truly is touches them (1.79): a fake of a talisman is no talisman.
  const harming = taken.flatMap((stack) => {
    const ref = stack.truly ?? stack.item;
    const found = ref ? book.itemOf(ref) : undefined;
    return found?.entry.item?.touchHarms?.length ? [{ stack, item: found.entry.item, name: found.name }] : [];
  });
  if (!harming.length) return null;
  const context = await loadGameRulesetSheetContext(db, chatId, resolved);
  if (!context) return null;
  const states = createGameStateStorage(db);
  const visibleAnchor = resolveVisibleGameStateAnchor(await createChatsStorage(db).listMessages(chatId));
  const row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
  if (!row) return null;
  let stored = parseStoredRulesetLive(row.rulesetLive) ?? {};
  const events: Array<{ title: string; content: string }> = [];
  const named = (name: string) =>
    context.cards.find((each) => normalizeCharacterLookupName(each.name) === normalizeCharacterLookupName(name));
  for (const { stack, item, name } of harming) {
    // The player's own bag is the player's sheet, as an item's use reads it.
    const card = stack.holder
      ? named(stack.holder)
      : ((context.playerName ? named(context.playerName) : undefined) ?? context.cards[0]);
    if (!card) continue;
    const key = normalizeCharacterLookupName(card.name);
    const harm = rulesetItemTouchHarm({
      definition: resolved.definition,
      item,
      user: { build: card.build, live: stored[key] },
      roll: rollDieSecurely,
    });
    if (!harm) continue;
    stored = { ...stored, [key]: harm.live };
    events.push({
      title: `${name} harms ${card.name}`,
      content: `${card.name} took ${harm.amount}${harm.type ? ` ${harm.type}` : ""} damage taking up ${name}${harm.now ? ` (${harm.now})` : ""}.`,
    });
  }
  if (!events.length) return null;
  return {
    events,
    write: async () => {
      await states.updateByMessage(row.messageId, row.swipeIndex, chatId, { rulesetLive: stored });
    },
  };
}

/** A change with what it found out: the revealed stacks, the journal's lines, and a telling's record (a
 *  Game Master's turn) that remembers the revealed stacks too, so a swipe still finds its turn. */
export function withFoundOut<T>(
  changed: GameInventoryChange<T>,
  found: { stacks: GameInventoryStack[]; events: Array<{ title: string; content: string }> },
): GameInventoryChange<T> {
  const turn = changed.metadata?.gameInventoryTurn as { swipes?: Record<string, GameInventoryStack[]> } | undefined;
  const metadata =
    turn?.swipes && changed.metadata
      ? {
          ...changed.metadata,
          gameInventoryTurn: {
            ...turn,
            swipes: Object.fromEntries(
              Object.entries(turn.swipes).map(([index, stacks]) => [
                index,
                stacks === changed.stacks ? found.stacks : stacks,
              ]),
            ),
          },
        }
      : changed.metadata;
  return {
    ...changed,
    stacks: found.stacks,
    events: [...(changed.events ?? []), ...found.events],
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * The fakes a character wears or carries that their sheet shows for what they truly are (a number on
 * the sheet, or what a check adds, differs from the item they pass for): each found out, as a reveal
 * finds it, with a journal line saying what it was. Null when there is none (a game with no ruleset,
 * no fake held, or nothing the sheet tells apart).
 */
async function revealFakesTheSheetShows(
  db: DB,
  chatId: string,
  metadata: Record<string, unknown>,
  stacks: GameInventoryStack[],
): Promise<{ stacks: GameInventoryStack[]; events: Array<{ title: string; content: string }> } | null> {
  if (!stacks.some((stack) => stack.truly) || metadata.gameRuleset == null) return null;
  const resolved = resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  if (resolved.status !== "ok") return null;
  const book = await loadGameInventoryItemBook(db, { metadata, resolved }, "player");
  const context = await loadGameRulesetSheetContext(db, chatId, resolved);
  if (!book || !context) return null;
  const { definition } = resolved;
  const itemsOf = rulesetCardItems(
    book,
    stacks,
    context.cards.map((card) => card.name),
    context.playerName,
  );
  // Only a card with a sheet of its own: a sheet nobody has is not one anybody reads a fake off.
  const sheeted = new Set(
    (Array.isArray(metadata.gameCharacterCards) ? (metadata.gameCharacterCards as Array<Record<string, unknown>>) : [])
      .filter((card) => card.rulesetSheet != null && typeof card.name === "string")
      .map((card) => normalizeCharacterLookupName(card.name as string)),
  );
  // As the sheet stands in play: its live state, which a requirement or a stat may read.
  const latest = await createGameStateStorage(db).getLatest(chatId);
  const liveByName =
    latest?.rulesetLive && typeof latest.rulesetLive === "object"
      ? (latest.rulesetLive as Record<string, unknown>)
      : {};
  let next = stacks;
  const events: Array<{ title: string; content: string }> = [];
  for (const card of context.cards) {
    if (!sheeted.has(normalizeCharacterLookupName(card.name))) continue;
    const held = itemsOf(card.name);
    if (!held.some((each) => each.truly)) continue;
    const live = readRulesetLive(definition, card.build, liveByName[normalizeCharacterLookupName(card.name)] as never);
    for (const index of rulesetFakesTheSheetShows(
      definition,
      card.build,
      held,
      // What a check reads of them: a fight's own parts (resistances, immunities) are not a check's.
      (items, sheet) =>
        rulesetItemSources(definition, card.build, items, sheet)
          .map(
            ({
              resist: _resist,
              vulnerable: _vulnerable,
              immune: _immune,
              conditionImmunities: _conditions,
              ...check
            }) => check,
          )
          // A source with nothing left a check reads is no source to a check.
          .filter((check) => Object.keys(check).some((key) => key !== "name" && key !== "$comment")),
      live,
    )) {
      const fake = held[index]!;
      if (!fake.stack || !fake.truly) continue;
      next = revealGameInventoryFake(next, fake.stack.id, book);
      const shown = fake.name ?? fake.stack.ref;
      // The player's own bag is theirs, whoever's card reads it.
      const whose = fake.stack.holder === undefined ? "Your" : `${card.name}'s`;
      events.push({ title: `${shown} found out`, content: `${whose} ${shown} was really ${fake.truly.name}.` });
    }
  }
  return events.length ? { stacks: next, events } : null;
}

/** The detailed inventory on one row, moved by the difference between two stack lists. Returns the
 *  stats written, or null when that row keeps no detailed inventory. Runs inside the caller's
 *  transaction. */
async function followOnRow(
  db: DB,
  chatId: string,
  before: readonly GameInventoryStack[],
  after: readonly GameInventoryStack[],
  target: Exclude<GameInventoryRowTarget, { kind: "none" }>,
): Promise<PlayerStats | null> {
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);
  let row: Awaited<ReturnType<typeof states.getLatest>> = null;
  // Where the detailed inventory is read from: the row the stacks were at `before`. For a telling
  // just saved that is the row it started from (`baseSnapshot`), not whatever its own row was
  // cloned from, since another telling of the same turn may have left that one.
  let source: Awaited<ReturnType<typeof states.getLatest>> = null;
  if (target.kind === "message") {
    row = await states.getByChatAndMessage(chatId, target.messageId, target.swipeIndex);
    source = target.baseSnapshot ?? row;
  } else {
    // The row the in-game sheet shows, found the way the sheet and a fight find it.
    const visibleAnchor = resolveVisibleGameStateAnchor(await chats.listMessages(chatId));
    row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
    source = row;
  }
  const sourceStats = parsePlayerStats(source?.playerStats);
  if (!source || !sourceStats || !Array.isArray(sourceStats.inventory)) return null;
  const inventory = followGameInventoryDetails(sourceStats.inventory as InventoryItem[], before, after);
  const stats = parsePlayerStats(row?.playerStats) ?? sourceStats;
  if (row && inventory === sourceStats.inventory && JSON.stringify(stats.inventory) === JSON.stringify(inventory)) {
    return null;
  }
  const playerStats = { ...stats, inventory };
  if (target.kind === "message") {
    await states.updateByMessage(target.messageId, target.swipeIndex, chatId, { playerStats }, undefined, {
      baseSnapshot: target.baseSnapshot ?? null,
    });
  } else if (row) {
    await states.updateByMessage(row.messageId, row.swipeIndex, chatId, { playerStats });
  }
  return playerStats;
}

/**
 * The detailed inventory on a turn's own row, once that row can exist: what a turn's tags did to the
 * stacks (saved before the reply by `commitGameInventoryChange` with `{ kind: "none" }`) laid onto the
 * row the reply was saved with.
 */
export async function followGameInventoryOnRow(
  db: DB,
  chatId: string,
  before: readonly GameInventoryStack[],
  after: readonly GameInventoryStack[],
  target: Extract<GameInventoryRowTarget, { kind: "message" }>,
): Promise<PlayerStats | null> {
  return db.transaction(() => followOnRow(db, chatId, before, after, target));
}

/**
 * The player switched `messageId` from the telling at `from` to the one at `to`: the stacks become
 * what `to` left, when they are still exactly what `from` left (see `gameInventoryForTelling`). Each
 * telling's own game-state row already carries its detailed inventory, so only the stacks move.
 * Returns the stacks now shown, or null when nothing changed.
 */
export async function switchGameInventoryTelling(
  db: DB,
  chatId: string,
  messageId: string,
  from: number,
  to: number,
): Promise<GameInventoryStack[] | null> {
  const committed = await commitGameInventoryChange(
    db,
    chatId,
    (stacks, metadata) => ({
      stacks:
        gameInventoryForTelling(readGameInventoryTurn(metadata.gameInventoryTurn), stacks, messageId, from, to) ??
        stacks,
      journal: [],
      value: stacks,
    }),
    { kind: "none" },
  );
  return committed && committed.stacks !== committed.value ? committed.stacks : null;
}

/**
 * The telling at `removed` of `messageId` was deleted, and the message now shows the one at `shown`,
 * counted after the deletion. The record's later tellings move down one, as the swipes did. When the
 * deleted telling was the one shown, the stacks become what the telling now shown left, exactly as
 * switching to it would.
 */
export async function removeGameInventoryTelling(
  db: DB,
  chatId: string,
  messageId: string,
  removed: number,
  wasShown: boolean,
  shown: number,
): Promise<void> {
  await commitGameInventoryChange(
    db,
    chatId,
    (stacks, metadata) => {
      const turn = readGameInventoryTurn(metadata.gameInventoryTurn);
      if (turn?.messageId !== messageId) return { stacks, journal: [], value: null };
      // The telling now shown, counted before the deletion.
      const moved = wasShown
        ? gameInventoryForTelling(turn, stacks, messageId, removed, shown >= removed ? shown + 1 : shown)
        : null;
      return {
        stacks: moved ?? stacks,
        journal: [],
        metadata: { gameInventoryTurn: forgetGameInventoryTelling(turn, messageId, removed) },
        value: null,
      };
    },
    { kind: "none" },
  );
}
