// A ruleset's loot tables, rolled: what a won fight's creatures and the Game Master's `[loot:]` drop.
//
// Only the items a layer leaves in can drop: a table naming one a layer took out drops nothing on that
// pick, as a filter that finds none does.

import type { RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { GAME_INVENTORY_MAX_QUANTITY } from "../../utils/game-inventory-stacks.js";
import { parseRulesetCombatDice } from "../ruleset-combat/dice.js";
import type { RulesetItemBook, RulesetItemBookEntry } from "./item-book.js";

/** One item a table dropped, by its ref and label, with how many. */
export interface RulesetLootDrop {
  item: string;
  name: string;
  count: number;
}

/** A number written down, or dice rolled; never less than none. A market day's limits roll the same
 *  way (#6934). */
export function rulesetRolledAmount(value: number | string, roll: (sides: number) => number): number {
  if (typeof value === "number") return value;
  const dice = parseRulesetCombatDice(value);
  if (!dice) return 0;
  let total = dice.flat;
  for (let i = 0; i < dice.count; i++) total += roll(dice.sides);
  return Math.max(0, total);
}

/**
 * Roll one of the ruleset's loot tables: `rolls` picks, each a line drawn by weight, and each line's
 * `count` of its item (or of one of the items its filter finds, picked evenly). Picks of one item are
 * added together. Null when the ruleset has no such table. `roll` throws one die of the given sides.
 */
export function rollRulesetLootTable(
  definition: RulesetDefinition,
  book: Pick<RulesetItemBook, "entries" | "coins">,
  tableId: string,
  roll: (sides: number) => number,
): RulesetLootDrop[] | null {
  const table = definition.items?.lootTables?.find((each) => each.id === tableId);
  if (!table) return null;
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  const drops = new Map<string, RulesetLootDrop>();
  const picks = rulesetRolledAmount(table.rolls, roll);
  for (let pick = 0; pick < picks; pick++) {
    let face = roll(total);
    const line = table.entries.find((entry) => (face -= entry.weight) <= 0) ?? table.entries.at(-1)!;
    let found: RulesetItemBookEntry | undefined;
    if (line.item) found = book.entries.find((entry) => entry.item === line.item);
    // A coin a layer took out is no longer in the book, and drops nothing.
    else if (line.coins) found = book.coins.find((coin) => coin.entry.id === line.coins);
    else {
      const { rarity, category, tag } = line.filter!;
      const matching = book.entries.filter((entry) => {
        const item = entry.entry.item;
        return (
          !!item &&
          (rarity === undefined || item.rarity === rarity) &&
          (category === undefined || item.category === category) &&
          (tag === undefined || !!item.tags?.includes(tag))
        );
      });
      if (matching.length > 0) found = matching[roll(matching.length) - 1];
    }
    const count = rulesetRolledAmount(line.count, roll);
    if (!found || count < 1) continue;
    const before = drops.get(found.item)?.count ?? 0;
    drops.set(found.item, {
      item: found.item,
      name: found.name,
      count: Math.min(GAME_INVENTORY_MAX_QUANTITY, before + count),
    });
  }
  return [...drops.values()];
}

/**
 * What a creature has on it as a fight begins (1.795): each line of its `inventory` rolled for once,
 * `chance` in a hundred, then its `count` of its item or its loot table's picks. Picks of one item
 * are added together; an item a layer took out is not had.
 */
export function rollRulesetCreatureInventory(
  definition: RulesetDefinition,
  book: Pick<RulesetItemBook, "entries" | "coins">,
  lines: ReadonlyArray<{ item?: string; table?: string; chance?: number; count?: number | string }>,
  roll: (sides: number) => number,
): RulesetLootDrop[] {
  const had = new Map<string, RulesetLootDrop>();
  const add = (drop: RulesetLootDrop) => {
    const before = had.get(drop.item)?.count ?? 0;
    had.set(drop.item, { ...drop, count: Math.min(GAME_INVENTORY_MAX_QUANTITY, before + drop.count) });
  };
  for (const line of lines) {
    if (roll(100) > (line.chance ?? 100)) continue;
    const count = rulesetRolledAmount(line.count ?? 1, roll);
    if (line.table) {
      // The table rolled `count` times over.
      for (let time = 0; time < count; time++)
        for (const drop of rollRulesetLootTable(definition, book, line.table, roll) ?? []) add(drop);
      continue;
    }
    const found = line.item ? book.entries.find((entry) => entry.item === line.item) : undefined;
    if (found && count >= 1) add({ item: found.item, name: found.name, count });
  }
  return [...had.values()];
}
