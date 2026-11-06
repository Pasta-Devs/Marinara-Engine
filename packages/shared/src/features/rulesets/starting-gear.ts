// Starting gear (Capability API 1.78): what a ruleset lets a character take into their bag at the
// start, never on its own. Resolving a choice is shared by the server, which adds what it resolves to,
// and the client, which shows it: one reading of the gear, so what the player saw is what is added.
//
// Nothing here trusts a selection. A pick must be one of its line's own list and one of the ruleset's
// catalog items the game offers (never a coin, an invented item or one a layer hides); every choice
// needs one of its options.

import type {
  RulesetBuilderStep,
  RulesetDefinition,
  RulesetSheetBuild,
  RulesetStartingGear,
  RulesetStartingGearLine,
} from "../../schemas/ruleset.schema.js";
import {
  gameInventoryBagKey,
  gameInventoryCoinRef,
  type GameInventoryStack,
} from "../../utils/game-inventory-stacks.js";
import { rulesetLayeredCurrencies, type RulesetLayerOptions } from "./layers.js";
import type { RulesetItemBook } from "./item-book.js";
import { parseDiceNotation } from "../../utils/dice-notation.js";
import { resolveRulesetValueRef } from "./sheet-math.js";

/** What the player chose: the gear, an option for each of its choices, and an item for each line
 *  that lists several. A pick is keyed `"<line>"` for one of the gear's own lines and
 *  `"<choice>.<line>"` for one of the chosen option's. */
export interface RulesetStartingGearSelection {
  gear: string;
  choices: number[];
  picks: Record<string, string>;
}

/** One thing the gear adds: one of the ruleset's items, coins (as their coin's item), or a plain item
 *  by name; `equip` where it is put on as it is taken. */
export interface RulesetStartingGearAdd {
  item?: string;
  name: string;
  count: number;
  equip?: true;
  /** Coins still to be rolled ("3d6 x 10"), where nothing rolled them yet: a preview counts 0. */
  rolled?: string;
}

/** What a coin line's amount is read from when the gear is taken (1.157): the holder's sheet and the
 *  dice. Without a roller a rolled line is shown as its dice and counts nothing. */
export interface RulesetStartingGearAmounts {
  build?: RulesetSheetBuild;
  rollDie?: (sides: number) => number;
}

/** How many coins a line gives: its count, or what its dice or the sheet say times `times`. Null for
 *  a line read off a sheet nobody has. */
export function rulesetStartingGearCoinCount(
  definition: RulesetDefinition,
  line: RulesetStartingGearLine,
  amounts?: RulesetStartingGearAmounts,
): { count: number; rolled?: string } | null {
  const times = line.times ?? 1;
  if (line.countFrom) {
    if (!amounts?.build) return null;
    return {
      count: Math.max(0, Math.floor(resolveRulesetValueRef(definition, amounts.build, line.countFrom))) * times,
    };
  }
  if (line.roll) {
    const dice = parseDiceNotation(line.roll);
    const text = times > 1 ? `${line.roll} x ${times}` : line.roll;
    if (!dice) return null;
    if (!amounts?.rollDie) return { count: 0, rolled: text };
    let total = dice.modifier;
    for (let n = 0; n < dice.count; n++) total += amounts.rollDie(dice.sides);
    return { count: Math.max(0, total) * times };
  }
  return { count: line.count };
}

export type RulesetStartingGearRefusal = "unknown-gear" | "does-not-fit" | "choice" | "pick" | "unknown-item" | "empty";

export type RulesetStartingGearResolution =
  | {
      ok: true;
      gear: RulesetStartingGear;
      adds: RulesetStartingGearAdd[];
      /** What the game's layers took out of the ruleset, which the gear then does without. */
      dropped: string[];
    }
  | { ok: false; reason: RulesetStartingGearRefusal; detail: string };

/** The ruleset's starting gear, in the order it lists them. */
export function rulesetStartingGear(definition: RulesetDefinition): readonly RulesetStartingGear[] {
  return definition.items?.startingGear ?? [];
}

/** The gear a bag has taken, by gear id. Read by the bag's own key only, so a bag named after an
 *  object's built-in ("constructor") reads as having taken nothing. */
export function rulesetStartingGearTakenBy(
  taken: Readonly<Record<string, readonly string[]>>,
  bagKey: string,
): readonly string[] {
  return Object.hasOwn(taken, bagKey) ? (taken[bagKey] ?? []) : [];
}

/** The kind a gear is taken once of: its group, or the gear alone. A gear's id and another's group
 *  never stand for the same kind. */
export function rulesetStartingGearKind(definition: RulesetDefinition, gearId: string): string {
  const gear = rulesetStartingGear(definition).find((entry) => entry.id === gearId);
  return gear?.group !== undefined ? `group:${gear.group}` : `gear:${gearId}`;
}

/** What a coin line pays in this game: its own coin, or, where a layer takes that coin out, the same
 *  worth in the largest coin of its family left that pays it exactly, as a price is. Null where a
 *  layer takes out the whole family (or the ruleset has no such coin). */
export function rulesetStartingGearCoins(
  definition: RulesetDefinition,
  line: Pick<RulesetStartingGearLine, "coins" | "count">,
  layerOptions?: RulesetLayerOptions | null,
): { unit: string; label: string; count: number } | null {
  const family = (definition.items?.currencies ?? []).find((each) => each.units.some((unit) => unit.id === line.coins));
  const named = family?.units.find((unit) => unit.id === line.coins);
  const kept = family && rulesetLayeredCurrencies(definition, layerOptions).find((each) => each.id === family.id);
  if (!named || !kept) return null;
  // The family's smallest coin, worth 1, is always left, so some coin pays the worth exactly.
  const unit = kept.units.some((each) => each.id === named.id)
    ? named
    : [...kept.units].sort((a, b) => b.value - a.value).find((each) => (line.count * named.value) % each.value === 0)!;
  const count = (line.count * named.value) / unit.value;
  return { unit: unit.id, label: count === 1 && unit.one ? unit.one : unit.label, count };
}

/** Whether a character's sheet is what the gear is for. Gear that names nobody fits nobody in
 *  particular; it is offered all the same, as every gear is. */
export function rulesetStartingGearFits(
  definition: RulesetDefinition,
  gear: RulesetStartingGear,
  build: RulesetSheetBuild | undefined,
): boolean {
  if (!gear.fits || !build) return false;
  return resolveRulesetValueRef(definition, build, gear.fits.value) >= gear.fits.atLeast;
}

/** A strict builder step holds gear to the sheet in legal-only mode (1.109). Gear without `fits`
 *  belongs to everyone. No live state is read, as when the inventory ranks fitting gear first. */
export function rulesetBuilderStartingGearOptions(
  definition: RulesetDefinition,
  step: Extract<RulesetBuilderStep, { kind: "startingGear" }>,
  build: RulesetSheetBuild | undefined,
  freeEdit = false,
): readonly RulesetStartingGear[] {
  const gear = rulesetStartingGear(definition);
  return step.strict && !freeEdit
    ? gear.filter((each) => !each.fits || rulesetStartingGearFits(definition, each, build))
    : gear;
}

/** The builder's mode is local to the client, not part of a saved sheet or an inventory request. */
export interface RulesetStartingGearBuilderContext {
  step: Extract<RulesetBuilderStep, { kind: "startingGear" }>;
  build: RulesetSheetBuild | undefined;
  freeEdit?: boolean;
}

/** Whether a choice's option is offered to this sheet (1.661): one with no `offeredWhen`, or whose
 *  `offeredWhen` reads above zero. Every option is offered where there is no sheet to read. */
export function rulesetStartingGearOptionOffered(
  definition: RulesetDefinition,
  option: RulesetStartingGear["choices"][number]["options"][number],
  build: RulesetSheetBuild | undefined,
): boolean {
  return !option.offeredWhen || !build || resolveRulesetValueRef(definition, build, option.offeredWhen) > 0;
}

/** The lines a selection takes, each with the key a pick names it by. An option not offered to the
 *  sheet is refused (1.661), and a choice none of whose options is offered takes nothing. */
function selectedLines(
  definition: RulesetDefinition,
  gear: RulesetStartingGear,
  choices: readonly number[],
  build: RulesetSheetBuild | undefined,
): { lines: Array<{ key: string; line: RulesetStartingGearLine }> } | { refused: string } {
  if (choices.length !== gear.choices.length) return { refused: `"${gear.label}" asks ${gear.choices.length} choices` };
  const lines = gear.lines.map((line, index) => ({ key: String(index), line }));
  for (const [choiceIndex, choice] of gear.choices.entries()) {
    if (!choice.options.some((one) => rulesetStartingGearOptionOffered(definition, one, build))) continue;
    const optionIndex = choices[choiceIndex]!;
    const option = Number.isInteger(optionIndex) ? choice.options[optionIndex] : undefined;
    if (!option) return { refused: `Choose one of "${choice.label}"` };
    if (!rulesetStartingGearOptionOffered(definition, option, build)) {
      return { refused: `"${option.label}" is not offered to this sheet` };
    }
    option.lines.forEach((line, lineIndex) => lines.push({ key: `${choiceIndex}.${lineIndex}`, line }));
  }
  return { lines };
}

/**
 * A selection as the things it adds, merged by item so two picks of the same weapon are one add of
 * two. A fixed item a layer takes out of the game, a list all of whose items it takes out, and coins
 * of a family it takes out are left out and named in `dropped`; coins of a single coin it takes out
 * are paid at the same worth in another (`rulesetStartingGearCoins`). Refused: an unknown gear, a
 * choice without an option, a pick that is not one of its list or not one of the game's items, an
 * item the ruleset does not have, and gear of which nothing is left to add.
 */
export function resolveRulesetStartingGear(
  definition: RulesetDefinition,
  book: RulesetItemBook,
  selection: RulesetStartingGearSelection,
  layerOptions?: RulesetLayerOptions | null,
  builder?: RulesetStartingGearBuilderContext,
  amounts?: RulesetStartingGearAmounts,
): RulesetStartingGearResolution {
  const gear = rulesetStartingGear(definition).find((entry) => entry.id === selection.gear);
  if (!gear) return { ok: false, reason: "unknown-gear", detail: `No starting gear "${selection.gear}"` };
  if (
    builder &&
    !rulesetBuilderStartingGearOptions(definition, builder.step, builder.build, builder.freeEdit).some(
      (each) => each.id === gear.id,
    )
  ) {
    return { ok: false, reason: "does-not-fit", detail: `Starting gear "${gear.label}" does not fit this sheet` };
  }
  const selected = selectedLines(definition, gear, selection.choices, builder?.build ?? amounts?.build);
  if ("refused" in selected) return { ok: false, reason: "choice", detail: selected.refused };

  // The game's own catalog items: what a layer hides is not among them, and nor is a coin, an item the
  // Game Master invented or a service, which is never carried.
  const offered = new Map(book.entries.filter((entry) => !entry.service).map((entry) => [entry.item, entry]));
  const adds = new Map<string, RulesetStartingGearAdd>();
  const dropped: string[] = [];
  const add = (key: string, next: RulesetStartingGearAdd) => {
    const before = adds.get(key);
    if (before) before.count += next.count;
    else adds.set(key, { ...next });
    if (next.equip) adds.get(key)!.equip = true;
  };
  for (const { key, line } of selected.lines) {
    if (line.oneOf) {
      if (!line.oneOf.some((ref) => offered.has(ref))) {
        const known = line.oneOf.map((ref) => book.itemOf(ref));
        if (known.some((entry) => !entry)) {
          return { ok: false, reason: "unknown-item", detail: `An item of line ${key} is not in this ruleset` };
        }
        dropped.push(known.map((entry) => entry!.name).join(" or "));
        continue;
      }
      const picked = selection.picks[key];
      const entry = picked !== undefined && line.oneOf.includes(picked) ? offered.get(picked) : undefined;
      if (!entry) return { ok: false, reason: "pick", detail: `Pick one of the list for line ${key}` };
      add(entry.item, {
        item: entry.item,
        name: entry.name,
        count: line.count,
        ...(line.equip ? { equip: true } : {}),
      });
    } else if (line.item) {
      const entry = offered.get(line.item);
      if (!entry) {
        const known = book.itemOf(line.item);
        if (!known) return { ok: false, reason: "unknown-item", detail: `No item "${line.item}" in this ruleset` };
        dropped.push(known.name);
        continue;
      }
      add(entry.item, {
        item: entry.item,
        name: entry.name,
        count: line.count,
        ...(line.equip ? { equip: true } : {}),
      });
    } else if (line.coins) {
      const amount = rulesetStartingGearCoinCount(definition, line, {
        build: amounts?.build ?? builder?.build,
        rollDie: amounts?.rollDie,
      });
      if (!amount) return { ok: false, reason: "choice", detail: `Line ${key} reads a sheet this bag has not got` };
      // Nothing to give, as a sheet reading 0 says: left out rather than an empty purse.
      if (amount.count === 0 && !amount.rolled) continue;
      const paid = rulesetStartingGearCoins(
        definition,
        { coins: line.coins, count: Math.max(1, amount.count) },
        layerOptions,
      );
      if (!paid) {
        const named = definition.items?.currencies
          ?.flatMap((family) => family.units)
          .find((unit) => unit.id === line.coins);
        dropped.push(named?.label ?? line.coins);
        continue;
      }
      const item = gameInventoryCoinRef(paid.unit);
      if (amount.rolled) add(`${item}:${key}`, { item, name: paid.label, count: 0, rolled: amount.rolled });
      else add(item, { item, name: paid.label, count: paid.count });
    } else if (line.name) {
      add(`name:${line.name.toLowerCase()}`, { name: line.name, count: line.count });
    }
  }
  if (adds.size === 0) return { ok: false, reason: "empty", detail: `Nothing of "${gear.label}" is in this game` };
  return { ok: true, gear, adds: [...adds.values()], dropped };
}

/**
 * What of the gear a bag still takes, given what it already holds (laptop 2026-10-26: the Game Master
 * handed out a shield, a quarterstaff and a shortbow before the party had taken its kits, so a druid
 * who then took the Druid kit carried two of each). A thing worn (one of the ruleset's items with
 * slots) is taken only as far as the bag does not already hold that item: the count the gear gives,
 * less what the bag holds of it. Everything else (coins, torches, rations, plain items) is taken as it
 * is. `held` names what was left out, whole or in part. A caller taking the gear again on purpose
 * takes all of it and does not ask.
 */
export function rulesetStartingGearUnheld(
  adds: readonly RulesetStartingGearAdd[],
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  book: Pick<RulesetItemBook, "itemOf">,
): { adds: RulesetStartingGearAdd[]; held: string[] } {
  const bagKey = gameInventoryBagKey(holder);
  const held: string[] = [];
  const out: RulesetStartingGearAdd[] = [];
  for (const add of adds) {
    const worn = !!add.item && Object.values(book.itemOf(add.item)?.slots ?? {}).some((count) => count > 0);
    const has = worn
      ? stacks
          .filter((stack) => stack.item === add.item && gameInventoryBagKey(stack.holder) === bagKey)
          .reduce((total, stack) => total + stack.quantity, 0)
      : 0;
    if (has > 0) held.push(add.name);
    const count = add.count - has;
    if (count > 0) out.push(has > 0 ? { ...add, count } : add);
  }
  return { adds: out, held };
}

/**
 * What of the gear just added is put on: for a line that puts on several ("Two shortswords"), one of
 * them at a time, each into slots still free, so a dual-wielder starts with a blade in each hand and
 * whatever finds no slot stays carried (laptop 2026-10-26: two shortswords were one stack, one held).
 * `ids` is the stack each add went into, in the same order, or none where it went nowhere.
 */
export function rulesetStartingGearEquips(
  adds: readonly RulesetStartingGearAdd[],
  ids: ReadonlyArray<string | undefined>,
): Array<{ op: "equip"; id: string }> {
  return adds.flatMap((add, index) => {
    const id = ids[index];
    // A stack of several gives one of itself to each equip, and the last is put on where it lies.
    return add.equip && id ? Array.from({ length: Math.min(add.count, 16) }, () => ({ op: "equip" as const, id })) : [];
  });
}
