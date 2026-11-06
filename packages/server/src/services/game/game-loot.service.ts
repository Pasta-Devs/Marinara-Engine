// What a won fight drops, in every Game Mode game (#6758, #6894).
//
// One rule decides where it comes from. A ruleset that declares loot tables drops its own items: each
// defeated bestiary creature rolls the table it names. Otherwise, while the game's native items are on
// (no ruleset, or one that leaves them on), Game Mode's own tables drop their items, more and rarer on
// a harder game. A ruleset that turns its native items off and declares no tables drops nothing.
//
// Planned before the chat's queue is held, then added inside the caller's transaction, so a fight's
// last step and what it drops are written together, or neither is.

import {
  applyGameInventoryOps,
  gameWorldKitFromMetadata,
  worldLootWords,
  normalizeCharacterLookupName,
  rollRulesetLootTable,
  rulesetCombatRoller,
  type RulesetDefinition,
  type RulesetItemBook,
  type GameInventoryItemRules,
  type GameInventoryJournalEntry,
  type GameInventoryOp,
  type GameInventoryStack,
} from "@marinara-engine/shared";
import { normalizeGameDifficulty } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { rollDieSecurely } from "./dice-rng.js";
import { generateCombatLoot } from "./loot.service.js";
import {
  commitGameInventoryChange,
  gameRulesetTurnsNativeItemsOff,
  loadGameInventoryItemBook,
} from "./game-inventory.service.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { loadGameRulesetSheetContext } from "./ruleset-sheet-turn.service.js";

/** What dropped, as the recap and the journal say it: how many of each went into the bags, and how
 *  many nobody could carry. */
export interface GameLootDrop {
  name: string;
  quantity: number;
  left?: number;
}

/** The adds a win makes, worked out and rolled, and the rules a ruleset's items are placed by. */
export interface GameLootPlan {
  ops: Array<Extract<GameInventoryOp, { op: "add" }>>;
  rules?: GameInventoryItemRules;
}

/**
 * The loot of one won fight. `tables` are the loot tables of the defeated opponents that carry one
 * (a ruleset fight's bestiary creatures); `defeated` is how many opponents fell, which the native tables
 * count by; `difficulty` is the game's; `carried` is what the defeated still had on them (1.795), each by
 * its item reference, which drops as it is. Null when nothing drops.
 */
export async function planGameVictoryLoot(
  db: DB,
  chatId: string,
  fight: {
    tables: readonly string[];
    defeated: number;
    difficulty: string;
    carried?: ReadonlyArray<{ ref: string; name: string; count: number }>;
  },
  roll: (sides: number) => number,
  random: () => number = Math.random,
): Promise<GameLootPlan | null> {
  const context = await loadGameRulesetSheetContext(db, chatId);
  if (context?.definition.items?.lootTables?.length || (context && fight.carried?.length)) {
    const book = await loadGameInventoryItemBook(db, { chatId }, "player");
    if (!book) return null;
    // Into the shared view, the player's own bag asked first: the card named for who the chat plays
    // as, or the first card, is the player's.
    const key = normalizeCharacterLookupName;
    const player =
      (context.playerName ? context.cards.find((card) => key(card.name) === key(context.playerName!)) : undefined) ??
      context.cards[0];
    const among = ["", ...context.cards.filter((card) => card !== player).map((card) => card.name)];
    const counts = new Map<string, { name: string; count: number }>();
    for (const table of fight.tables) {
      for (const drop of rollRulesetLootTable(context.definition, book, table, roll) ?? []) {
        const before = counts.get(drop.item)?.count ?? 0;
        counts.set(drop.item, { name: drop.name, count: before + drop.count });
      }
    }
    for (const had of fight.carried ?? []) {
      const before = counts.get(had.ref)?.count ?? 0;
      counts.set(had.ref, { name: counts.get(had.ref)?.name ?? had.name, count: before + had.count });
    }
    const ops = [...counts].map(([item, drop]) => ({
      op: "add" as const,
      name: drop.name,
      item,
      count: drop.count,
      among,
      log: true,
    }));
    return ops.length > 0 ? { ops, rules: book } : null;
  }
  if (fight.defeated < 1) return null;
  const chat = await createChatsStorage(db).getById(chatId);
  const metadata = readMetadata(chat?.metadata);
  if (await gameRulesetTurnsNativeItemsOff(db, metadata)) return null;
  // In the setting's own words (worldgen W6a): the game's kit, else its genre's starter kit, else words
  // that belong to no setting.
  const setup = metadata.gameSetupConfig as { genre?: unknown } | undefined;
  const loot = worldLootWords(
    gameWorldKitFromMetadata(metadata),
    typeof setup?.genre === "string" ? setup.genre : undefined,
  );
  const ops = generateCombatLoot(fight.defeated, fight.difficulty, random, loot).map((drop) => ({
    op: "add" as const,
    name: drop.item.name,
    count: drop.quantity,
    // Native items weigh nothing, so they go to the player's bag, as every weightless item does.
    holder: "",
    log: true,
  }));
  return ops.length > 0 ? { ops } : null;
}

/** The plan added to the stacks, for `applyGameInventoryChangeHeld`: what went in and what was left. */
export function addGameLoot(
  stacks: GameInventoryStack[],
  plan: GameLootPlan,
): { stacks: GameInventoryStack[]; journal: GameInventoryJournalEntry[]; dropped: GameLootDrop[] } {
  const outcome = applyGameInventoryOps(stacks, plan.ops, undefined, plan.rules);
  const dropped = plan.ops.flatMap((op, index): GameLootDrop[] => {
    const result = outcome.results[index];
    const added = result?.ok ? (result.count ?? 0) : 0;
    const left = result?.ok ? (result.left ?? 0) : op.count;
    if (added + left === 0) return [];
    return [{ name: op.name, quantity: added, ...(left > 0 ? { left } : {}) }];
  });
  return { stacks: outcome.stacks, journal: outcome.journal, dropped };
}

/**
 * The Game Master's `[loot:]`, rolled with dice from `seed`, so a reply's answers are worked out twice
 * (before and after it is saved) with the same drops. Undefined when the ruleset has no loot tables,
 * and a loot tag is then refused.
 */
export function gameLootTagRoller(
  definition: RulesetDefinition | undefined,
  book: RulesetItemBook | undefined,
  seed: number,
): ((table: string) => ReturnType<typeof rollRulesetLootTable>) | undefined {
  if (!definition?.items?.lootTables?.length || !book) return undefined;
  // Kept apart from the dice a use and a rest roll with the same seed.
  const roll = rulesetCombatRoller(seed, 20_000);
  return (table) => rollRulesetLootTable(definition, book, table, roll);
}

/** How many fights the chat remembers having dropped loot for, so a win reported twice drops once. */
const LOOTED_FIGHTS_KEPT = 20;

/**
 * The loot of a won fight the director did not run (Classic or Tactical, played on the screen alone),
 * known by the message that started it: dropped once, however often the win is reported. Such a fight
 * has no bestiary creatures, so only the native tables drop anything.
 */
export async function lootGameFight(
  db: DB,
  chatId: string,
  fight: string,
  defeated: number,
  roll: (sides: number) => number = rollDieSecurely,
  random: () => number = Math.random,
): Promise<{ loot: GameLootDrop[]; inventory: GameInventoryStack[]; playerStats?: unknown } | null> {
  const chat = await createChatsStorage(db).getById(chatId);
  if (!chat) return null;
  const setup = readMetadata(chat.metadata).gameSetupConfig as Record<string, unknown> | undefined;
  const plan = await planGameVictoryLoot(
    db,
    chatId,
    { tables: [], defeated, difficulty: normalizeGameDifficulty(setup?.difficulty) },
    roll,
    random,
  );
  const committed = await commitGameInventoryChange(db, chatId, (stacks, metadata) => {
    const looted = Array.isArray(metadata.gameLootedFights)
      ? metadata.gameLootedFights.filter((each): each is string => typeof each === "string")
      : [];
    if (looted.includes(fight)) return { stacks, journal: [], value: [] as GameLootDrop[] };
    const added = plan ? addGameLoot(stacks, plan) : { stacks, journal: [], dropped: [] };
    return {
      stacks: added.stacks,
      journal: added.journal,
      value: added.dropped,
      metadata: { gameLootedFights: [...looted, fight].slice(-LOOTED_FIGHTS_KEPT) },
    };
  });
  if (!committed) return null;
  return {
    loot: committed.value,
    inventory: committed.stacks,
    ...(committed.playerStats ? { playerStats: committed.playerStats } : {}),
  };
}

function readMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}
