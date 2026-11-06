// The player's Use button on one of a ruleset's items, outside a fight. What the item does to its
// user lands on their sheet with the Engine's dice, the item is spent, and both are written together:
// the bag in the chat's metadata and the sheet on the game-state row the player sees, inside the
// chat's metadata queue and one transaction, so a use either changes both or changes neither.
import {
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  normalizeGameInventoryStacks,
  rechargeRulesetItems,
  rollRulesetItemGate,
  rulesetCombatRoller,
  rulesetItemUseLine,
  rulesetSheetItems,
  revealGameInventoryFake,
  useRulesetItemOutsideFight,
  type RulesetItemRecharge,
  type GameInventoryItemUser,
  type GameInventoryStack,
  type RulesetItemBook,
  type RulesetItemUseOutcome,
  type RulesetItemUseRefusal,
  type RulesetItemUseSaid,
  type RulesetLiveStates,
  applyRulesetRestRecoveries,
  rulesetRestRecoveries,
  type RulesetRestRecovery,
  type RulesetUseRecover,
  setGameInventoryStackQuantity,
  type RulesetMaterialTaken,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { resolveVisibleGameStateAnchor } from "../../routes/generate/generate-route-utils.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { createGameStateStorage, parseStoredRulesetLive } from "../storage/game-state.storage.js";
import { rollDieSecurely } from "./dice-rng.js";
import { applyGameInventoryChangeHeld, loadGameInventoryItemBook, readMetadata } from "./game-inventory.service.js";
import {
  loadGameRulesetSheetContext,
  loadTurnRulesetCatalogs,
  type GameRulesetSheetContext,
} from "./ruleset-sheet-turn.service.js";

export type GameItemUseResult =
  | {
      ok: true;
      inventory: GameInventoryStack[];
      rulesetLive: RulesetLiveStates;
      said: RulesetItemUseSaid;
      /** What happened, in one line for the Game Master. */
      line: string;
      /** A fake used was shown for what it truly is first (1.79): its true name. */
      revealed?: string;
      playerStats?: unknown;
    }
  | {
      ok: false;
      status: 404 | 409;
      error: string;
      reason?: RulesetItemUseRefusal | "no-ruleset" | "no-state";
      /** For `slots-full` (1.808): what holds the slots the item needs to be drawn, by name. */
      heldBy?: string[];
    };

/** The card a character plays with, and the bag they carry: the player's own for the player's card
 *  (the one named for who the chat plays as, or the first card), and their own otherwise. */
function cardAndBag(
  context: GameRulesetSheetContext,
  name: string,
): { card: GameRulesetSheetContext["cards"][number]; holder: string | undefined } | null {
  const key = normalizeCharacterLookupName(name);
  const card = context.cards.find((each) => normalizeCharacterLookupName(each.name) === key);
  if (!card) return null;
  const player =
    (context.playerName
      ? context.cards.find(
          (each) => normalizeCharacterLookupName(each.name) === normalizeCharacterLookupName(context.playerName!),
        )
      : undefined) ?? context.cards[0];
  return { card, holder: card === player ? undefined : card.name };
}

/**
 * What the Game Master's rests bring back to the items each resting character carries, on the stacks a
 * turn works from. Dice come from `seed` (kept apart from the uses' own), so the answer worked out
 * before the reply is saved and the one saved agree.
 */
export function gameInventoryRestRecharge(
  context: GameRulesetSheetContext,
  itemOf: RulesetItemBook["itemOf"],
  rests: ReadonlyArray<{ who: string; rest: string }>,
  seed: number,
): (stacks: GameInventoryStack[]) => GameInventoryStack[] {
  return (stacks) => {
    const roll = rulesetCombatRoller(seed, 10_000);
    let current = stacks;
    for (const { who, rest } of rests) {
      const found = cardAndBag(context, who);
      if (!found) continue;
      current = rechargeRulesetItems({
        definition: context.definition,
        itemOf,
        stacks: current,
        holder: found.holder,
        rest,
        roll,
      }).stacks;
    }
    return current;
  };
}

/** The priced materials a turn's casts used up (1.790), taken off the stacks they came out of. */
export function gameInventoryMaterialsTaken(
  materials: ReadonlyArray<RulesetMaterialTaken>,
): (stacks: GameInventoryStack[]) => GameInventoryStack[] {
  return (stacks) => {
    let current = stacks;
    for (const one of materials.flatMap((material) => material.stacks)) {
      const stack = current.find((each) => each.id === one.id);
      if (stack) current = setGameInventoryStackQuantity(current, one.id, Math.max(0, stack.quantity - one.count));
    }
    return current;
  };
}

/** Uses the item on one stack for whoever carries it: the party member the stack names, or the player.
 *  `live` is every character's live state, and the one who used it comes back changed. */
function useForCarrier(
  context: GameRulesetSheetContext,
  itemOf: RulesetItemBook["itemOf"],
  stacks: readonly GameInventoryStack[],
  stackId: string,
  live: RulesetLiveStates,
  roll: (sides: number) => number,
  /** One of its further uses (1.267, 1.519), by its place in `moreUses` from 1. */
  more?: number,
  /** How long what it makes lasts (1.760), by its place in `makesItems.lasts` from 1. */
  lasts?: number,
): { outcome: RulesetItemUseOutcome; live: RulesetLiveStates; revealed?: string } {
  const stack = stacks.find((each) => each.id === stackId);
  const holder = stack?.holder;
  const named = (name: string) =>
    context.cards.find((each) => normalizeCharacterLookupName(each.name) === normalizeCharacterLookupName(name));
  // The player's own bag is the player's sheet: the card named for who the chat plays as, or the first
  // card when none is, as the inventory and checks read it.
  const card = holder
    ? named(holder)
    : ((context.playerName ? named(context.playerName) : undefined) ?? context.cards[0]);
  const name = holder ?? card?.name ?? context.playerName ?? "The player";
  const key = normalizeCharacterLookupName(name);
  // A fake used is shown for what it truly is first (1.79), and what it truly does is what happens.
  const revealed = stack?.truly ? (itemOf(stack.truly)?.name ?? stack.truly) : undefined;
  const working = stack?.truly ? revealGameInventoryFake([...stacks], stackId, { itemOf }) : [...stacks];
  const outcome = useRulesetItemOutsideFight({
    definition: context.definition,
    itemOf,
    stacks: working,
    stackId,
    user: { name, build: card?.build ?? defaultRulesetSheetBuild(context.definition), live: live[key] },
    roll,
    ...(more !== undefined ? { more } : {}),
    ...(lasts !== undefined ? { lasts } : {}),
  });
  if (!outcome.ok && revealed) {
    // What it truly does is nothing the rules work out: it is still found out, and the Game Master
    // tells what it did.
    return {
      outcome: {
        ok: true,
        stacks: working,
        journal: [],
        live: live[key] ?? {},
        said: {
          user: name,
          item: revealed,
          parts: [],
          aimed: `it was really ${revealed}, not what it seemed; what it does is for the Game Master to tell`,
          left: { count: stack!.quantity },
        },
      },
      live,
      revealed,
    };
  }
  if (!outcome.ok) return { outcome, live };
  const next: RulesetLiveStates = { ...live };
  // A character back at their defaults drops out of the store, as the in-game sheet leaves them.
  if (outcome.live && Object.keys(outcome.live).length > 0) next[key] = outcome.live;
  else delete next[key];
  return { outcome, live: next, ...(revealed ? { revealed } : {}) };
}

/**
 * What the Game Master's `[inventory: action="use"]` uses items with, on a working copy of the party's
 * live sheets that starts from `baseLive`. Dice come from `seed`, so a reply's answers are worked out
 * twice (before and after it is saved) with the same rolls.
 */
export function gameInventoryItemUser(
  context: GameRulesetSheetContext,
  itemOf: RulesetItemBook["itemOf"],
  baseLive: RulesetLiveStates,
  seed: number,
): { useItem: GameInventoryItemUser; live: () => RulesetLiveStates; used: () => boolean } {
  let live = baseLive;
  let used = false;
  const roll = rulesetCombatRoller(seed, 0);
  return {
    useItem: (stacks, stackId) => {
      const done = useForCarrier(context, itemOf, stacks, stackId, live, roll);
      if (!done.outcome.ok) return { ok: false, reason: done.outcome.reason };
      live = done.live;
      used = true;
      return {
        ok: true,
        stacks: done.outcome.stacks,
        journal: done.outcome.journal,
        line: rulesetItemUseLine(done.outcome.said),
        ...(done.revealed ? { revealed: done.revealed } : {}),
      };
    },
    live: () => live,
    used: () => used,
  };
}

/**
 * The check one of the ruleset's items asks before it works (`gate`), rolled as a party member uses it
 * in one of the Engine's own Classic or Tactical fights (#6909), which roll none of the ruleset's own
 * dice: for the card of that member's name, with the sheet as the player sees it and the worn items in
 * that member's bag, as the Use button rolls it. Only the player's own unit falls back on the player's
 * card; anybody else without a card rolls on a blank sheet, as a ruleset fight builds them. Null when the
 * item asks no check, or its `unless` holds; otherwise whether it passed, and the fight log's line.
 */
export async function rollGameFightItemGate(
  db: DB,
  chatId: string,
  who: string,
  item: string,
  roll: (sides: number) => number = rollDieSecurely,
): Promise<{ success: boolean; line: string } | null> {
  const context = await loadGameRulesetSheetContext(db, chatId);
  const book = context ? await loadGameInventoryItemBook(db, { chatId }, "player") : undefined;
  const read = book?.itemOf(item);
  if (!context || !book || !read?.entry.item?.use?.gate) return null;
  const named = (name: string) =>
    context.cards.find((each) => normalizeCharacterLookupName(each.name) === normalizeCharacterLookupName(name));
  const player = (context.playerName ? named(context.playerName) : undefined) ?? context.cards[0];
  const own = named(who);
  const isPlayer = own
    ? own === player
    : !!context.playerName && normalizeCharacterLookupName(who) === normalizeCharacterLookupName(context.playerName);
  const card = own ?? (isPlayer ? player : undefined);
  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  const metadata = readMetadata(chat?.metadata);
  const visibleAnchor = resolveVisibleGameStateAnchor(await chats.listMessages(chatId));
  const row = await createGameStateStorage(db).getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
  const live = (parseStoredRulesetLive(row?.rulesetLive) ?? {})[normalizeCharacterLookupName(card?.name ?? who)];
  const gate = rollRulesetItemGate({
    definition: context.definition,
    itemOf: book.itemOf,
    stacks: normalizeGameInventoryStacks(metadata.gameInventory),
    holder: isPlayer ? undefined : (card?.name ?? who),
    item: read.entry.item,
    user: { build: card?.build ?? defaultRulesetSheetBuild(context.definition), live },
    roll,
  });
  if (!gate) return null;
  return {
    success: gate.success,
    line: `${who} rolls ${gate.check} to use ${read.name}: ${gate.total} against ${gate.difficulty}, ${
      gate.success ? "passed" : "failed, and it is used up for nothing"
    }.`,
  };
}

/** A use refused inside the transaction, so nothing it touched is written. */
class ItemUseRefused extends Error {
  constructor(
    readonly reason: RulesetItemUseRefusal | "no-state",
    readonly heldBy?: string[],
  ) {
    super(reason);
  }
}

export async function useGameRulesetItem(
  db: DB,
  chatId: string,
  stackId: string,
  roll: (sides: number) => number = rollDieSecurely,
  /** One of its further uses (1.267, 1.519), by its place in `moreUses` from 1. */
  more?: number,
  /** How long what it makes lasts (1.760), by its place in `makesItems.lasts` from 1. */
  lasts?: number,
): Promise<GameItemUseResult> {
  // Read before the chat's queue is held, as every other inventory change reads them.
  const context = await loadGameRulesetSheetContext(db, chatId);
  const book = context ? await loadGameInventoryItemBook(db, { chatId }, "player") : undefined;
  if (!context || !book)
    return { ok: false, status: 409, error: "This game has no ruleset items", reason: "no-ruleset" };
  let outcome: Extract<ReturnType<typeof useRulesetItemOutsideFight>, { ok: true }> | null = null;
  let revealed: string | undefined;
  let rulesetLive: RulesetLiveStates = {};
  let committed: Awaited<ReturnType<typeof applyGameInventoryChangeHeld<null>>> = null;
  try {
    await withChatMetadataPatchQueue(chatId, () =>
      db.transaction(async () => {
        const states = createGameStateStorage(db);
        const visibleAnchor = resolveVisibleGameStateAnchor(await createChatsStorage(db).listMessages(chatId));
        const row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
        // A game with no state yet uses it on a fresh sheet, and the row is made as it is written.
        const stored: RulesetLiveStates = parseStoredRulesetLive(row?.rulesetLive) ?? {};
        let next: RulesetLiveStates = stored;
        committed = await applyGameInventoryChangeHeld(db, chatId, (stacks) => {
          const done = useForCarrier(context, book.itemOf, stacks, stackId, stored, roll, more, lasts);
          if (!done.outcome.ok) throw new ItemUseRefused(done.outcome.reason, done.outcome.heldBy);
          outcome = done.outcome;
          revealed = done.revealed;
          next = done.live;
          return { stacks: done.outcome.stacks, journal: done.outcome.journal, value: null };
        });
        if (!committed || !outcome) throw new ItemUseRefused("no-stack");
        const written = await writeGameRulesetLive(db, chatId, visibleAnchor, next);
        if (!written) throw new ItemUseRefused("no-state");
        rulesetLive = parseStoredRulesetLive(written.rulesetLive) ?? {};
      }),
    );
  } catch (error) {
    if (!(error instanceof ItemUseRefused)) throw error;
    if (error.reason === "no-stack") return { ok: false, status: 404, error: "No such stack", reason: "no-stack" };
    // Drawn as it is used (1.808), with its slots held by what is not put away for it.
    if (error.reason === "slots-full")
      return {
        ok: false,
        status: 409,
        error: error.heldBy?.length
          ? `The item could not be drawn: its slots are held by ${error.heldBy.join(", ")}`
          : "The item could not be drawn: its user has too few of the slots it takes",
        reason: error.reason,
        heldBy: error.heldBy ?? [],
      };
    return { ok: false, status: 409, error: `The item could not be used (${error.reason})`, reason: error.reason };
  }
  const used = outcome as Extract<ReturnType<typeof useRulesetItemOutsideFight>, { ok: true }> | null;
  const done = committed as Awaited<ReturnType<typeof applyGameInventoryChangeHeld<null>>>;
  if (!used || !done) return { ok: false, status: 404, error: "Chat not found", reason: "no-stack" };
  return {
    ok: true,
    inventory: done.stacks,
    rulesetLive,
    said: used.said,
    line: rulesetItemUseLine(used.said),
    ...(revealed ? { revealed } : {}),
    ...(done.playerStats ? { playerStats: done.playerStats } : {}),
  };
}

export type GameRestResult =
  | {
      ok: true;
      rulesetLive: RulesetLiveStates;
      /** The rest's own words for the sheet ("Grit 11/11"), and what came back to the items carried. */
      now: string;
      recharged: RulesetItemRecharge[];
      inventory?: GameInventoryStack[];
      playerStats?: unknown;
    }
  | { ok: false; status: 404 | 409; error: string; reason?: string };

/**
 * The sheet's Rest button: the rest on one character's sheet, and the charges it brings back to the items
 * they carry, written together inside the chat's metadata queue and one transaction.
 */
export async function restGameRulesetCharacter(
  db: DB,
  chatId: string,
  character: string,
  rest: string,
  roll: (sides: number) => number = rollDieSecurely,
  /** The dice spent to heal first, by pool: the hit dice a Short rest asks for. */
  diceFrom?: Record<string, number>,
  /** The features the player chose to use as it ends (1.789), with what each gives back. */
  recover?: ReadonlyArray<{ name: string; recover: RulesetUseRecover[] }>,
): Promise<GameRestResult> {
  const context = await loadGameRulesetSheetContext(db, chatId);
  if (!context) return { ok: false, status: 409, error: "This game has no ruleset", reason: "no-ruleset" };
  const found = cardAndBag(context, character);
  if (!found) return { ok: false, status: 404, error: "No such character", reason: "unknown-character" };
  const catalogs = recover?.length ? await loadTurnRulesetCatalogs(context, "", { force: true }) : {};
  const book = await loadGameInventoryItemBook(db, { chatId }, "player");
  const key = normalizeCharacterLookupName(found.card.name);
  let result: GameRestResult | null = null;
  try {
    await withChatMetadataPatchQueue(chatId, () =>
      db.transaction(async () => {
        const states = createGameStateStorage(db);
        const visibleAnchor = resolveVisibleGameStateAnchor(await createChatsStorage(db).listMessages(chatId));
        const row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
        // A game that has no state yet rests from a fresh sheet, and the row is made as it is written.
        const stored: RulesetLiveStates = parseStoredRulesetLive(row?.rulesetLive) ?? {};
        // What they carry counts, as on their sheet: an Amulet of Health's hit points are healed to.
        const chat = await createChatsStorage(db).getById(chatId);
        const held = book
          ? rulesetSheetItems(
              { itemOf: book.itemOf },
              normalizeGameInventoryStacks(readMetadata(chat?.metadata).gameInventory),
              found.holder,
            )
          : undefined;
        const rested = applyRulesetSheetOp(
          context.definition,
          found.card.build,
          stored[key],
          { op: "rest", rest, ...(diceFrom ? { diceFrom } : {}) },
          roll,
          held,
        );
        if (!rested.ok) throw new RestRefused(rested.reason);
        // What the player chose to use as it ends (1.789): Arcane Recovery's slots, after the rest.
        if (recover?.length) {
          const used = applyRulesetRestRecoveries(
            context.definition,
            found.card.build,
            rested.live,
            catalogs,
            rest,
            recover,
            roll,
            held,
          );
          if (!used.ok) throw new RestRefused(used.reason);
          rested.live = (used.live ?? {}) as typeof rested.live;
          rested.now = [rested.now, ...used.now].join("; ");
        }
        let recharged: RulesetItemRecharge[] = [];
        const committed = book
          ? await applyGameInventoryChangeHeld(db, chatId, (stacks) => {
              const outcome = rechargeRulesetItems({
                definition: context.definition,
                itemOf: book.itemOf,
                stacks,
                holder: found.holder,
                rest,
                roll,
              });
              recharged = outcome.recharged;
              return {
                stacks: recharged.length > 0 || outcome.reset ? outcome.stacks : stacks,
                journal: [],
                value: null,
              };
            })
          : null;
        const next: RulesetLiveStates = { ...stored };
        if (Object.keys(rested.live).length > 0) next[key] = rested.live;
        else delete next[key];
        const written = await writeGameRulesetLive(db, chatId, visibleAnchor, next);
        if (!written) throw new ItemUseRefused("no-state");
        result = {
          ok: true,
          rulesetLive: parseStoredRulesetLive(written.rulesetLive) ?? {},
          now: rested.now,
          recharged,
          ...(committed ? { inventory: committed.stacks } : {}),
          ...(committed?.playerStats ? { playerStats: committed.playerStats } : {}),
        };
      }),
    );
  } catch (error) {
    if (error instanceof RestRefused)
      return { ok: false, status: 409, error: `The rest could not be taken (${error.reason})`, reason: error.reason };
    if (error instanceof ItemUseRefused)
      return { ok: false, status: 409, error: "This game has no state yet", reason: error.reason };
    throw error;
  }
  return result ?? { ok: false, status: 404, error: "Chat not found", reason: "no-chat" };
}

/**
 * Writes the game's live sheets onto the row the player sees. A game with no state yet (its sheets
 * used before the first turn) gets one, made from the visible message or, with none, as a first row.
 */
async function writeGameRulesetLive(
  db: DB,
  chatId: string,
  visibleAnchor: ReturnType<typeof resolveVisibleGameStateAnchor>,
  rulesetLive: RulesetLiveStates,
) {
  const states = createGameStateStorage(db);
  const written =
    (visibleAnchor
      ? await states.updateByMessage(visibleAnchor.messageId, visibleAnchor.swipeIndex, chatId, { rulesetLive })
      : null) ?? (await states.updateLatest(chatId, { rulesetLive }));
  if (written) return written;
  await states.create({
    chatId,
    messageId: "",
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    worldCustomFields: [],
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: null,
    hiddenTrackerFields: null,
    rulesetLive,
  });
  return states.getLatest(chatId);
}

/**
 * One character's live sheet set from the in-game sheet, merged into the others on the server: the
 * way a sheet edit is saved while the screen has no state to patch (before the game's first turn).
 */
export async function setGameRulesetLive(
  db: DB,
  chatId: string,
  character: string,
  live: RulesetLiveStates[string] | null,
): Promise<{ ok: true; rulesetLive: RulesetLiveStates } | { ok: false; status: 404 | 409; error: string }> {
  const context = await loadGameRulesetSheetContext(db, chatId);
  if (!context) return { ok: false, status: 409, error: "This game has no ruleset" };
  const found = cardAndBag(context, character);
  if (!found) return { ok: false, status: 404, error: "No such character" };
  const key = normalizeCharacterLookupName(found.card.name);
  let result: RulesetLiveStates | null = null;
  await withChatMetadataPatchQueue(chatId, () =>
    db.transaction(async () => {
      const states = createGameStateStorage(db);
      const visibleAnchor = resolveVisibleGameStateAnchor(await createChatsStorage(db).listMessages(chatId));
      const row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
      const next: RulesetLiveStates = { ...(parseStoredRulesetLive(row?.rulesetLive) ?? {}) };
      if (live && Object.keys(live).length > 0) next[key] = live;
      else delete next[key];
      const written = await writeGameRulesetLive(db, chatId, visibleAnchor, next);
      result = written ? (parseStoredRulesetLive(written.rulesetLive) ?? {}) : null;
    }),
  );
  return result ? { ok: true, rulesetLive: result } : { ok: false, status: 404, error: "Chat not found" };
}

/** A rest the sheet refused, so nothing it touched is written. */
class RestRefused extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/** The features a rest offers this character to use as it ends (1.789), read off their sheet as it
 *  stands: what the rest dialog lists, each with what it would give back by itself. */
export async function gameRulesetRestOffers(
  db: DB,
  chatId: string,
  character: string,
  rest: string,
): Promise<{ ok: true; offers: RulesetRestRecovery[] } | { ok: false; status: 404 | 409; error: string }> {
  const context = await loadGameRulesetSheetContext(db, chatId);
  if (!context) return { ok: false, status: 409, error: "This game has no ruleset" };
  const found = cardAndBag(context, character);
  if (!found) return { ok: false, status: 404, error: "No such character" };
  // Only a rest some feature names is worth reading catalogs for.
  if (!context.definition.rests.some((one) => one.id === rest)) return { ok: true, offers: [] };
  const catalogs = await loadTurnRulesetCatalogs(context, "", { force: true });
  const visibleAnchor = resolveVisibleGameStateAnchor(await createChatsStorage(db).listMessages(chatId));
  const row = await createGameStateStorage(db).getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
  const stored: RulesetLiveStates = parseStoredRulesetLive(row?.rulesetLive) ?? {};
  const key = normalizeCharacterLookupName(found.card.name);
  return {
    ok: true,
    offers: rulesetRestRecoveries(context.definition, found.card.build, stored[key], catalogs, rest),
  };
}
