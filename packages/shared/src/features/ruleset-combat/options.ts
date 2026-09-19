// The legal menu. Everything that acts in a ruleset fight - a player, an opponent's own choices, a
// forecast - picks an id from here, so legality is decided in exactly one place and a client never
// computes it.

import type { RulesetCombat, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import {
  applyRulesetSheetOp,
  planRulesetUse,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "../rulesets/live-state.js";
import { currentRulesetActor, rulesetCombatant, rulesetCombatEffects, rulesetCombatStanding } from "./encounter.js";
import type {
  RulesetCombatAction,
  RulesetCombatant,
  RulesetCombatOption,
  RulesetCombatRollMode,
  RulesetEncounterState,
} from "./types.js";

/** The budget a standard action spends: the first one the economy declares, which is the main one. */
export function rulesetStandardBudget(combat: RulesetCombat): string {
  return combat.economy.budgets[0]!.id;
}

export interface RulesetCombatCost {
  steps: Array<{ op: RulesetSheetOp; label: string }>;
  /** The live state the price leaves behind, or null when there was nothing on a sheet to pay. */
  live: RulesetLiveState | null;
  cost: Array<{ pool: string; label: string; amount: number }>;
}

/**
 * What an ability costs this member right now, or null when they cannot pay it. The price itself is
 * the sheet's own `use` command (`planRulesetUse`), applied to a working copy: the menu therefore
 * offers exactly what the sheet would accept, and nothing is spent by asking.
 *
 * `payWith` is the upcast, under the `use` command's own rule: one price, paid out of another pool
 * of the same family.
 */
export function planRulesetCombatCost(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
  payWith?: string,
): RulesetCombatCost | null {
  const free: RulesetCombatCost = { steps: [], live: null, cost: [] };
  // An opponent's actions cost nothing off a sheet: their block is the only bookkeeping there is.
  if (!combatant.sheet) return payWith ? null : free;
  const { build, catalogs } = combatant.sheet;
  if (!action.use) return payWith ? null : free;
  const plan = planRulesetUse(definition, build, combatant.sheet.live, catalogs, {
    op: "use",
    name: action.use.name,
    ...(payWith ? { pool: payWith } : {}),
  });
  if (!plan.ok) return null;
  let live = combatant.sheet.live;
  const cost: RulesetCombatCost["cost"] = [];
  for (const step of plan.steps) {
    const result = applyRulesetSheetOp(definition, build, live, step.op);
    if (!result.ok) return null;
    live = result.live;
    if (step.op.op === "spend") cost.push({ pool: step.op.pool, label: step.label, amount: step.op.amount });
  }
  return { steps: plan.steps, live, cost };
}

/** The pools of one family, in the order the ruleset declared them. The order is the ladder a
 *  higher payment climbs, which is what makes "one step up" a number. */
export function rulesetPoolFamily(definition: RulesetDefinition, group: string | undefined): string[] {
  if (!group) return [];
  return definition.sheet.live.pools.filter((pool) => pool.group === group).map((pool) => pool.id);
}

/** How many steps up the family a payment is, or 0 when it is not a climb at all. */
export function rulesetCostSteps(definition: RulesetDefinition, action: RulesetCombatAction, payWith: string): number {
  const family = rulesetPoolFamily(definition, action.use?.group);
  const from = family.indexOf(action.use?.pool ?? "");
  const to = family.indexOf(payWith);
  return from >= 0 && to > from ? to - from : 0;
}

// ── Forecasts ──

/** How much of the dice a sum leaves above a number, computed exactly for the dice a fight rolls
 *  and skipped for a handful too large to count, so a forecast never costs a turn its time. */
function chanceAtLeast(count: number, sides: number, need: number): number | null {
  if (count * sides > 400) return null;
  if (need <= count) return 1;
  if (need > count * sides) return 0;
  let distribution = [1];
  for (let die = 0; die < count; die++) {
    const next = new Array<number>(distribution.length + sides).fill(0);
    for (let sum = 0; sum < distribution.length; sum++) {
      const share = distribution[sum]!;
      if (share === 0) continue;
      for (let facing = 1; facing <= sides; facing++) next[sum + facing] = next[sum + facing]! + share / sides;
    }
    distribution = next;
  }
  return distribution.slice(need).reduce((total, share) => total + share, 0);
}

/** The share of attack rolls that would land. Exact, because the extreme faces of a single die can
 *  decide a roll on their own and a forecast that ignored them would disagree with the resolution. */
export function rulesetHitChance(
  combat: RulesetCombat,
  toHit: number,
  defense: number,
  mode: RulesetCombatRollMode = "normal",
): number | null {
  const { dice, naturals } = combat.attackRoll;
  let single: number | null = null;
  if (dice.count === 1) {
    let hits = 0;
    for (let facing = 1; facing <= dice.sides; facing++) {
      if (facing === dice.sides && naturals.max !== "none") hits += 1;
      else if (facing === 1 && naturals.min === "miss") continue;
      else if (facing + toHit >= defense) hits += 1;
    }
    single = hits / dice.sides;
  } else {
    single = chanceAtLeast(dice.count, dice.sides, defense - toHit);
  }
  if (single === null) return null;
  // Two independent sets, one of them kept: the good one lands unless both would miss.
  if (mode === "advantage") return 1 - (1 - single) ** 2;
  if (mode === "disadvantage") return single ** 2;
  return single;
}

/** The average of a damage or healing roll. Never a future die: the expected amount, as it stands. */
export function rulesetAverageAmount(amount: { count: number; sides: number; flat: number }): number {
  return amount.count * ((amount.sides + 1) / 2) + amount.flat;
}

// ── The menu ──

/** Whether the actor's own conditions stop them doing anything at all. */
function blocked(definition: RulesetDefinition, combat: RulesetCombat, actor: RulesetCombatant): boolean {
  return rulesetCombatEffects(definition, combat, actor).has("cannot-act");
}

function firstTarget(state: RulesetEncounterState, actor: RulesetCombatant, action: RulesetCombatAction) {
  return state.combatants.find((combatant) => {
    if (combatant.defeated) return false;
    if (action.targets.side === "self") return combatant.id === actor.id;
    if (action.targets.side === "ally") return combatant.side === actor.side;
    if (action.targets.side === "enemy") return combatant.side !== actor.side;
    return true;
  });
}

function optionFrom(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatOption | null {
  if ((actor.budgets[action.budget] ?? 0) < 1) return null;
  const paid = planRulesetCombatCost(definition, actor, action);
  if (!paid) return null;
  const option: RulesetCombatOption = {
    id: action.id,
    kind: action.kind,
    label: action.label,
    budget: action.budget,
    targets: action.targets,
  };
  if (paid.cost.length > 0) option.cost = paid.cost;
  // Which higher pools of the same family could pay instead, so the menu offers the upcast rather
  // than a player discovering it.
  const family = rulesetPoolFamily(definition, action.use?.group);
  const from = family.indexOf(action.use?.pool ?? "");
  if (from >= 0) {
    const payWith = family
      .slice(from + 1)
      .filter((pool) => planRulesetCombatCost(definition, actor, action, pool) !== null);
    if (payWith.length > 0) option.payWith = payWith;
  }
  const forecast: NonNullable<RulesetCombatOption["forecast"]> = {};
  const target = firstTarget(state, actor, action);
  if (action.toHit !== undefined && target) {
    const chance = rulesetHitChance(
      combat,
      action.toHit,
      target.defense,
      rulesetAttackMode(definition, combat, actor, target),
    );
    if (chance !== null) forecast.hitChance = Math.round(chance * 1000) / 1000;
  }
  const amount = action.damage ?? action.heal;
  if (amount) forecast.averageDamage = Math.round(rulesetAverageAmount(amount) * 100) / 100;
  if (forecast.hitChance !== undefined || forecast.averageDamage !== undefined) option.forecast = forecast;
  return option;
}

/** How this attack is rolled: the actor's own conditions and their target's, the help an ally gave
 *  and a dodging target, with advantage and disadvantage cancelling each other out. A ruleset that
 *  does not roll twice at all keeps its single roll whatever the fiction says. */
export function rulesetAttackMode(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): RulesetCombatRollMode {
  if (!combat.attackRoll.advantage) return "normal";
  const own = rulesetCombatEffects(definition, combat, actor);
  const theirs = rulesetCombatEffects(definition, combat, target);
  const advantage = own.has("own-attacks-advantage") || theirs.has("attacks-against-advantage") || !!actor.flags.helped;
  const disadvantage =
    own.has("own-attacks-disadvantage") || theirs.has("attacks-against-disadvantage") || !!target.flags.dodging;
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/**
 * Everything the actor whose turn it is may legally do. An actor who is down, held by a condition
 * or simply not the one on turn is offered nothing but the end of their turn, and an ability whose
 * price the sheet would refuse is left out rather than offered and then refused.
 */
export function rulesetCombatOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  if (!combat || !actor || currentRulesetActor(state)?.id !== actorId) return [];
  const endTurn: RulesetCombatOption = {
    id: "end-turn",
    kind: "end-turn",
    label: "End turn",
    targets: { side: "self", count: 0 },
  };
  if (!rulesetCombatStanding(actor) || blocked(definition, combat, actor)) return [endTurn];

  const options: RulesetCombatOption[] = [];
  for (const action of actor.actions) {
    const option = optionFrom(definition, combat, state, actor, action);
    if (option) options.push(option);
  }
  const budget = rulesetStandardBudget(combat);
  for (const action of combat.standard ?? []) {
    if ((actor.budgets[budget] ?? 0) < 1) break;
    options.push({
      id: `standard:${action}`,
      kind: "standard",
      label: action,
      budget,
      // Help is the one that reaches somebody else; the rest are the actor's own stance.
      targets: action === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
    });
  }
  options.push(endTurn);
  return options;
}
