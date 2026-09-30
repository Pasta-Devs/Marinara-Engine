// Using one of a ruleset's items outside a fight: the Use button and the Game Master's
// `[inventory: action="use"]`.
//
// What the item's `use` does to its user lands on their sheet, with the Engine's dice: health given
// back, temporary points, a pool restored and the conditions it puts on. What it does to somebody
// else is left to the story, since outside a fight nobody else has a place on the board to be hit
// in: the item is still used, and the words say what it does. Either way it takes one off its stack
// or spends its charges, through the same write a fight uses.

import type { GameInventoryJournalEntry } from "../../utils/game-inventory-ops.js";
import { gameInventoryBagKey, type GameInventoryStack } from "../../utils/game-inventory-stacks.js";
import type { RulesetDefinition, RulesetSheetBuild } from "../../schemas/ruleset.schema.js";
import { applyRulesetFightItemChanges } from "../ruleset-combat/ammo.js";
import { parseRulesetCombatDice } from "../ruleset-combat/dice.js";
import { rulesetPoolMaxSuccesses } from "../../schemas/ruleset.schema.js";
import {
  rollRulesetCheckModifiers,
  rulesetCheckEffects,
  rulesetCheckRollMode,
  rulesetCheckSources,
  rulesetItemGateCheck,
} from "./check-effects.js";
import type { RulesetItemBookEntry } from "./item-book.js";
import { rulesetItemFacts, rulesetItemGateDifficulty, rulesetItemUseDoes, rulesetSheetItems } from "./item-book.js";
import {
  applyRulesetSheetOp,
  evaluateRulesetSheetLive,
  readRulesetWoundPenalty,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "./live-state.js";
import { rollDicePoolCheck, rollDiceSumCheck } from "./sheet-math.js";

/** Why an item could not be used. */
export type RulesetItemUseRefusal =
  /** No stack of that id in the bag. */
  | "no-stack"
  /** The stack is a plain item, or one of an item the ruleset no longer has. */
  | "not-ruleset-item"
  /** The item has no `use`. */
  | "no-use"
  /** It takes a slot or binds, and is not worn (and bound). */
  | "not-worn"
  /** None of its charges are left, or not as many as one use spends. */
  | "none-left";

/** One thing a use did to its user's sheet. */
export interface RulesetItemUsePart {
  kind: "heal" | "temporary" | "restore" | "condition";
  /** What was rolled and added up, for everything but a condition. */
  amount?: number;
  rolls?: number[];
  /** The pool's or the condition's label. */
  label?: string;
  /** The sheet's own words for where it now stands ("Grit 6/11"). */
  now?: string;
}

export interface RulesetItemUseSaid {
  user: string;
  item: string;
  parts: RulesetItemUsePart[];
  /** What it does to somebody else, which the Engine leaves to the story. */
  aimed?: string;
  /** What is left of it: how many in the stack, or its charges. */
  left: { count: number } | { charges: number; max: number };
  /** It spent its last charge and its `breaksOn` die said it breaks: the face rolled. */
  broke?: number;
  /** Its gate, when its user rolled one: what was rolled, the total (a pool's successes) against the
   *  difficulty, and whether it passed. Failed, nothing it does happened. */
  gate?: { check: string; total: number; difficulty: number; success: boolean; rolls: number[] };
}

export type RulesetItemUseOutcome =
  | {
      ok: true;
      stacks: GameInventoryStack[];
      journal: GameInventoryJournalEntry[];
      live: RulesetLiveState;
      said: RulesetItemUseSaid;
    }
  | { ok: false; reason: RulesetItemUseRefusal };

/**
 * Use the item on one stack, for whoever carries it. `live` is that character's stored live state and
 * `build` their sheet; `roll` throws one die of the given sides. Nothing is changed on a refusal.
 */
export function useRulesetItemOutsideFight(input: {
  definition: RulesetDefinition;
  itemOf: (ref: string) => RulesetItemBookEntry | undefined;
  stacks: readonly GameInventoryStack[];
  stackId: string;
  user: { name: string; build: RulesetSheetBuild; live: unknown };
  roll: (sides: number) => number;
}): RulesetItemUseOutcome {
  const { definition, stacks, user, roll } = input;
  const stack = stacks.find((each) => each.id === input.stackId);
  if (!stack) return { ok: false, reason: "no-stack" };
  const entry = stack.item ? input.itemOf(stack.item) : undefined;
  const item = entry?.entry.item;
  if (!stack.item || !item) return { ok: false, reason: "not-ruleset-item" };
  const use = item.use;
  if (!use) return { ok: false, reason: "no-use" };
  // Used while worn where it takes a slot or binds, as a fight uses it; worn means bound too there.
  const takesSlots = Object.values(item.slots ?? {}).some((count) => count > 0);
  if ((takesSlots && !stack.equipped) || (item.binds && !stack.bound)) return { ok: false, reason: "not-worn" };
  const facts = rulesetItemFacts(definition, item).use;
  const max = facts?.charges?.max;
  if (use.charges !== undefined) {
    if (max === undefined) return { ok: false, reason: "none-left" };
    const now = Math.min(max, stack.charges ?? max);
    if (now < use.charges) return { ok: false, reason: "none-left" };
  }

  // Its gate first, as a fight rolls it once the item is spent: failed, the item is spent below and
  // nothing it does happens. A difficulty read off a stat the item does not give is a use the Engine
  // cannot make, as a fight leaves it off the menu.
  let gate: RulesetItemUseSaid["gate"];
  if (use.gate) {
    const difficulty = rulesetItemGateDifficulty(item, use.gate);
    if (difficulty === undefined) return { ok: false, reason: "no-use" };
    const held = rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder);
    const evaluated = evaluateRulesetSheetLive(definition, user.build, user.live, held);
    const ask = rulesetItemGateCheck(definition, user.build, evaluated, use.gate, difficulty);
    if (ask) gate = { check: facts?.gate?.check ?? "", ...rollGateOutsideFight(definition, user, held, ask, roll) };
  }
  const works = gate?.success !== false;

  // What it does to its user: a heal or a buff not aimed at the other side. Anything else is for
  // somebody else, and outside a fight that is the story's to tell.
  const onUser = works && (use.kind === "heal" || use.kind === "buff") && use.targets !== "enemy";
  let live = user.live;
  const parts: RulesetItemUsePart[] = [];
  const write = (op: RulesetSheetOp): string | undefined => {
    const result = applyRulesetSheetOp(definition, user.build, live, op);
    if (!result.ok) return undefined;
    live = result.live;
    return result.now;
  };
  const rolled = (amount: { dice?: string; flat?: number } | undefined) => {
    if (!amount) return null;
    const dice = amount.dice ? parseRulesetCombatDice(amount.dice) : null;
    if (!dice && amount.flat === undefined) return null;
    const rolls = Array.from({ length: dice?.count ?? 0 }, () => roll(dice!.sides));
    return {
      rolls,
      total: Math.max(0, rolls.reduce((sum, face) => sum + face, 0) + (dice?.flat ?? 0) + (amount.flat ?? 0)),
    };
  };
  if (onUser) {
    const health = definition.combat?.health ?? definition.battle?.health;
    // A pool's own words are only its numbers, so they are said with its name ("Grit 6/11").
    const named = (pool: string, now: string | undefined) =>
      now === undefined
        ? undefined
        : `${definition.sheet.live.pools.find((entry) => entry.id === pool)?.label ?? pool} ${now}`;
    const heal = use.kind === "heal" ? rolled(use.amount) : null;
    if (heal && health) {
      // A wound track clears one mark, as a heal in a fight does; a pool takes the amount.
      const now =
        "track" in health
          ? heal.total > 0
            ? write({ op: "damage", track: health.track, kind: "", amount: -1 })
            : undefined
          : heal.total > 0
            ? named(health.pool, write({ op: "restore", pool: health.pool, amount: heal.total }))
            : undefined;
      // Only what landed is said: a heal of nothing, or one the sheet refused, says nothing.
      if (now !== undefined) parts.push({ kind: "heal", amount: heal.total, rolls: heal.rolls, now });
    }
    const temporary = rolled(use.temporary);
    if (temporary && health && "pool" in health) {
      const now =
        temporary.total > 0
          ? named(health.pool, write({ op: "temp", pool: health.pool, amount: temporary.total }))
          : undefined;
      // A pool with no temporary buffer takes none.
      if (now !== undefined) parts.push({ kind: "temporary", amount: temporary.total, rolls: temporary.rolls, now });
    }
    const restore = use.restore ? rolled(use.restore.amount) : null;
    if (restore && use.restore) {
      const now =
        restore.total > 0 ? write({ op: "restore", pool: use.restore.pool, amount: restore.total }) : undefined;
      if (now !== undefined) {
        parts.push({
          kind: "restore",
          amount: restore.total,
          rolls: restore.rolls,
          label: facts?.restore?.pool ?? use.restore.pool,
          now,
        });
      }
    }
    for (const applies of use.applies ?? []) {
      if (!write({ op: "condition", condition: applies.condition, active: true })) continue;
      const label =
        definition.sheet.live.conditions.find((condition) => condition.id === applies.condition)?.label ??
        applies.condition;
      parts.push({ kind: "condition", label });
    }
  }

  // Spent the way a fight spends it, on the stack by its id.
  const charges =
    use.charges !== undefined && max !== undefined ? Math.min(max, stack.charges ?? max) - use.charges : undefined;
  // The last charge spent: an item that may break rolls for it, as it would in a fight.
  const breaks = charges === 0 ? item.charges?.breaksOn : undefined;
  const face = breaks ? roll(breaks.die) : undefined;
  const broke = breaks && face !== undefined && face <= breaks.atMost ? face : undefined;
  const spent = applyRulesetFightItemChanges(stacks, [
    {
      stack: { id: stack.id, ref: stack.item, ...(stack.holder ? { holder: stack.holder } : {}) },
      name: stack.name,
      taken: use.consumes || broke !== undefined ? 1 : 0,
      ...(charges !== undefined ? { charges } : {}),
      ...(broke !== undefined ? { broke: true as const } : {}),
    },
  ]);
  if (!spent) return { ok: false, reason: "no-stack" };
  // Charges spent write no journal line of their own, so the use is said as one.
  const journal =
    spent.journal.length > 0 ? spent.journal : [{ item: stack.name, action: "used" as const, quantity: 1 }];
  const aimed = works && !onUser && facts ? rulesetItemUseDoes(facts).join(", ") : undefined;
  return {
    ok: true,
    stacks: spent.stacks,
    journal,
    live: live as RulesetLiveState,
    said: {
      user: user.name,
      item: entry.name,
      parts,
      ...(aimed ? { aimed } : {}),
      ...(broke !== undefined ? { broke } : {}),
      ...(gate ? { gate } : {}),
      left:
        charges !== undefined && max !== undefined
          ? { charges, max }
          : { count: use.consumes ? stack.quantity - 1 : stack.quantity },
    },
  };
}

/** A gate rolled as a check is outside a fight: the ruleset's own dice with the sheet's number, the
 *  user's wound penalty and what their conditions and items do to that check, and the lean they give
 *  it. A pool's difficulty is the successes it needs, never fewer than one nor more than it can count. */
function rollGateOutsideFight(
  definition: RulesetDefinition,
  user: { build: RulesetSheetBuild; live: unknown },
  held: ReturnType<typeof rulesetSheetItems>,
  ask: NonNullable<ReturnType<typeof rulesetItemGateCheck>>,
  roll: (sides: number) => number,
): Omit<NonNullable<RulesetItemUseSaid["gate"]>, "check"> {
  const resolution = definition.resolution;
  const effects = rulesetCheckEffects(rulesetCheckSources(definition, user.build, user.live, held), ask.target);
  const penalty = resolution.penaltyFrom
    ? readRulesetWoundPenalty(definition, user.build, user.live, resolution.penaltyFrom)
    : 0;
  const modifier = ask.modifier + penalty + rollRulesetCheckModifiers(effects.modifiers, roll).total;
  if (resolution.kind === "dice-pool") {
    const required = Math.min(rulesetPoolMaxSuccesses(resolution), Math.max(1, ask.difficulty));
    const rolled = rollDicePoolCheck(definition, { modifier, required, isSave: false }, roll);
    return { total: rolled.total, difficulty: required, success: rolled.success, rolls: rolled.rolls };
  }
  const mode = rulesetCheckRollMode({}, effects);
  const rolled = rollDiceSumCheck(
    definition,
    {
      modifier,
      dc: ask.difficulty,
      isSave: false,
      advantage: mode === "advantage",
      disadvantage: mode === "disadvantage",
    },
    roll,
  );
  return { total: rolled.total, difficulty: ask.difficulty, success: rolled.success, rolls: rolled.rolls };
}

/** What happened, in one line for the Game Master: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." */
export function rulesetItemUseLine(said: RulesetItemUseSaid): string {
  const parts = said.parts.map((part) => {
    const now = part.now ? ` (${part.now})` : "";
    if (part.kind === "heal") return `heals ${part.amount}${now}`;
    if (part.kind === "temporary") return `${part.amount} temporary points${now}`;
    if (part.kind === "restore") return `restores ${part.amount} ${part.label}${now}`;
    return `${part.label}`;
  });
  const gate = said.gate
    ? `${said.gate.check} check ${said.gate.total} against ${said.gate.difficulty}, ${said.gate.success ? "passed" : "failed"}; `
    : "";
  const does =
    said.gate?.success === false
      ? "it is used up for nothing"
      : said.aimed
        ? `aimed at somebody else, so nothing was applied: ${said.aimed}`
        : parts.length > 0
          ? parts.join(", ")
          : "nothing changed";
  const left =
    said.broke !== undefined
      ? `Its last charge spent, it breaks (a ${said.broke} on its die).`
      : "charges" in said.left
        ? `${said.left.charges} of ${said.left.max} charges left.`
        : said.left.count > 0
          ? `${said.left.count} left.`
          : "None left.";
  return `${said.user} uses ${said.item}: ${gate}${does}. ${left}`;
}

/** What a rest gave back to one item. */
export interface RulesetItemRecharge {
  item: string;
  now: number;
  max: number;
}

/**
 * The charges a rest brings back to the items one character carries: each item in their bag whose
 * `charges.recharge` names that rest regains all of them (`"max"`) or an amount rolled with `roll`,
 * never past its most. A full item is left alone, and a count back at its most is dropped from the
 * stack, which reads as full. `holder` is the bag's, absent for the player's own.
 */
export function rechargeRulesetItems(input: {
  definition: RulesetDefinition;
  itemOf: (ref: string) => RulesetItemBookEntry | undefined;
  stacks: readonly GameInventoryStack[];
  holder: string | undefined;
  rest: string;
  roll: (sides: number) => number;
}): { stacks: GameInventoryStack[]; recharged: RulesetItemRecharge[] } {
  const bag = gameInventoryBagKey(input.holder);
  const recharged: RulesetItemRecharge[] = [];
  const stacks = input.stacks.map((stack) => {
    if (!stack.item || gameInventoryBagKey(stack.holder) !== bag) return stack;
    const entry = input.itemOf(stack.item);
    const item = entry?.entry.item;
    const recharge = item?.charges?.recharge;
    if (!item || !recharge?.rests.includes(input.rest)) return stack;
    const max = rulesetItemFacts(input.definition, item).use?.charges?.max;
    if (max === undefined) return stack;
    const before = Math.min(max, stack.charges ?? max);
    if (before >= max) return stack;
    let gained = max;
    if (recharge.amount !== "max") {
      const dice = recharge.amount.dice ? parseRulesetCombatDice(recharge.amount.dice) : null;
      const rolls = Array.from({ length: dice?.count ?? 0 }, () => input.roll(dice!.sides));
      gained = rolls.reduce((sum, face) => sum + face, 0) + (dice?.flat ?? 0) + (recharge.amount.flat ?? 0);
    }
    const now = Math.max(before, Math.min(max, before + gained));
    if (now === before) return stack;
    recharged.push({ item: entry!.name, now, max });
    const { charges: _charges, ...rest } = stack;
    return now >= max ? rest : { ...rest, charges: now };
  });
  return { stacks: recharged.length > 0 ? stacks : [...input.stacks], recharged };
}

/** What a rest gave back, in words for the Game Master: "Dawn bell regains its charges (3 of 3)". */
export function rulesetItemRechargeLine(recharged: readonly RulesetItemRecharge[]): string {
  return recharged.map((entry) => `${entry.item} regains charges (${entry.now} of ${entry.max})`).join(", ");
}
