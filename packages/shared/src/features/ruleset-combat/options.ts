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
import { rulesetAverageDamage } from "./dice.js";
import {
  currentRulesetActor,
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatStanding,
} from "./encounter.js";
import {
  rulesetAreaCells,
  rulesetCellCover,
  rulesetCellDistance,
  rulesetLineOfSight,
  rulesetOpportunityAttack,
  rulesetPositionOf,
  rulesetReachableCells,
} from "./grid.js";
import type {
  RulesetCombatAction,
  RulesetCombatCell,
  RulesetCombatOption,
  RulesetCombatRollMode,
  RulesetCombatant,
  RulesetEncounterState,
  RulesetReactionMoment,
  RulesetWindowTrigger,
} from "./types.js";

/** The budget a standard action spends: the first one the economy declares, which is the main one. */
export function rulesetStandardBudget(combat: RulesetCombat): string {
  return combat.economy.budgets[0]!.id;
}

/** The standard action one option id names. An ability that lets its holder buy one with another
 *  budget writes that budget after an `@`, which no standard action's own name may hold. */
export function rulesetStandardName(optionId: string): string {
  const name = optionId.startsWith("standard:") ? optionId.slice("standard:".length) : optionId;
  const at = name.indexOf("@");
  return at < 0 ? name : name.slice(0, at);
}

/** Whether this action would be taken out of strikes already in hand rather than out of a budget. */
export function rulesetFreeStrike(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  return action.strikes !== undefined && (actor.strikesLeft ?? 0) > 0;
}

/** Whether taking this action itself would do anything at all. An entry that only says which
 *  standard actions its holder may buy with another budget is a PERMISSION, not something to take:
 *  what it grants is on the menu as `standard:<id>@<budget>`, and the entry itself is not. */
function actionDoesSomething(action: RulesetCombatAction): boolean {
  if (!action.standard) return true;
  return !!(
    action.damage ||
    action.heal ||
    action.temporary ||
    action.applies?.length ||
    action.gives ||
    action.sequence ||
    action.concentration
  );
}

/**
 * The standard actions an ability lets its holder buy with a budget other than the main one, priced
 * by the ability that grants them. The granting ability's own price is paid when one is taken, so a
 * grant nobody can pay for is not offered at all.
 */
function grantedStandardOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  const declared = new Set<string>(combat.standard ?? []);
  const options: RulesetCombatOption[] = [];
  const seen = new Set<string>();
  for (const action of actor.actions) {
    const granted = action.standard;
    if (!granted || (actor.budgets[granted.budget] ?? 0) < 1) continue;
    if (!rulesetActionAvailable(actor, action)) continue;
    const paid = planRulesetCombatCost(definition, actor, action);
    if (!paid) continue;
    for (const name of granted.actions) {
      if (!declared.has(name)) continue;
      const id = `standard:${name}@${granted.budget}`;
      if (seen.has(id)) continue;
      seen.add(id);
      options.push({
        id,
        kind: "standard",
        label: name,
        budget: granted.budget,
        targets: name === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
        ...(paid.cost.length > 0 ? { cost: paid.cost } : {}),
      });
    }
  }
  return options;
}

/** The ability behind a `standard:<id>@<budget>` option, when one of the actor's own granted it.
 *  Null for an ordinary standard action, which no ability had to allow. */
export function rulesetGrantedStandard(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  optionId: string,
): { action: RulesetCombatAction; name: string; budget: string } | null {
  if (!optionId.startsWith("standard:")) return null;
  const at = optionId.indexOf("@");
  if (at < 0) return null;
  const name = optionId.slice("standard:".length, at);
  const budget = optionId.slice(at + 1);
  // The SAME ability the menu offered it under: one that has run out of uses, is waiting on its
  // dice, or cannot pay its own price is not on the menu, so it must not be what resolution picks
  // either, or a character with two permissions could take one through the other's exhausted half.
  const action = actor.actions.find(
    (entry) =>
      entry.standard?.budget === budget &&
      entry.standard.actions.includes(name) &&
      rulesetActionAvailable(actor, entry) &&
      !!planRulesetCombatCost(definition, actor, entry),
  );
  return action ? { action, name, budget } : null;
}

/** The one thing a fight with no board answers about distance: nothing at all. */
function positioned(state: RulesetEncounterState): boolean {
  return !!state.board?.grid;
}

/** How many cells one aim scan may look at: the area of the largest board a saved fight may hold. */
const RULESET_AIM_SCAN_CEILING = 64 * 64;

/** The two ids a positioned fight adds to the menu beside the actor's own actions. Written with a
 *  colon, which no sheet id or stat block action id may hold, so a creature that really has an
 *  action called "move" or "stand" can never be mistaken for walking. The same trick the standard
 *  actions use (`standard:dodge`). */
export const RULESET_MOVE_OPTION = "move:walk";
export const RULESET_STAND_OPTION = "move:stand";

/** What one option may be pointed at, in cells. `sight` is whether something solid between the two
 *  of them stops it. Null when this fight measures nothing. */
export interface RulesetOptionReach {
  /** The furthest it may be pointed at all. */
  max: number;
  /** The distance beyond which a ruleset that declared `ranged` makes it harder. */
  normal: number;
  /** Whether it is a shot rather than a swing, which is what the ranged rules read. */
  shot: boolean;
  /** How far it still SWINGS, for something that both swings and is thrown: inside this it is a
   *  swing whatever `shot` says, and the ranged rules do not read it. Zero for a pure shot. */
  swing: number;
}

/** The actor's own action behind an option id, when the option is one of theirs. */
function actionOf(actor: RulesetCombatant, optionId: string): RulesetCombatAction | undefined {
  return actor.actions.find((entry) => entry.id === optionId);
}

/**
 * How far this option reaches, in cells.
 *
 * An action that says nothing reaches the next cell, which is the smallest step a board has: the
 * generic actions that touch somebody else read the same way. An action that carries rather than
 * swings reaches its long distance when the ruleset gave it one, and the ordinary distance is what
 * `combat.ranged` measures "too far" against.
 */
export function rulesetOptionReach(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
): RulesetOptionReach | null {
  if (!positioned(state)) return null;
  const actor = rulesetCombatant(state, actorId);
  if (!actor) return null;
  const action = actionOf(actor, optionId);
  if (!action) return { max: 1, normal: 1, shot: false, swing: 1 };
  if (action.area) {
    // An area is aimed at a cell rather than at anybody. With a distance of its own it may be sent
    // that far off. With none, a BURST is centred on the actor, because a ball of fire with no range
    // goes off where it is set down, while a cone or a line is aimed within its own size, because
    // there the cell only says which way it points.
    const carried = action.range?.long ?? action.range?.normal;
    const max = carried ?? (action.area.shape === "burst" ? 0 : action.area.size);
    // Only a shape with a distance of its own is SHOT: one that comes off the actor, a breath or a
    // burst set down where they stand, is not made harder by a foe at their elbow.
    return { max, normal: action.range?.normal ?? max, shot: !!action.range, swing: 0 };
  }
  if (action.range) {
    // Something that carries a reach AS WELL is a thrown weapon: a swing in hand, a shot beyond.
    const swing = action.reach !== undefined ? Math.max(1, action.reach) : 0;
    return {
      max: Math.max(action.range.long ?? action.range.normal, swing),
      normal: action.range.normal,
      shot: true,
      swing,
    };
  }
  const reach = Math.max(1, action.reach ?? 1);
  return { max: reach, normal: reach, shot: false, swing: reach };
}

/** Why this combatant cannot be pointed at from where the actor stands, or null when they can.
 *  Anything more than one cell away needs an unbroken line: this slice has no shooting round
 *  corners and no reaching over a wall. */
export function rulesetTargetRefusal(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  targetId: string,
): "out-of-reach" | "no-line-of-sight" | null {
  const reach = rulesetOptionReach(state, actorId, optionId);
  if (!reach) return null;
  const from = rulesetPositionOf(rulesetCombatant(state, actorId));
  const to = rulesetPositionOf(rulesetCombatant(state, targetId));
  const grid = state.board?.grid;
  if (!from || !to || !grid) return null;
  if (actorId === targetId) return null;
  const away = rulesetCellDistance(from, to);
  if (away > reach.max) return "out-of-reach";
  if (away > 1 && !rulesetLineOfSight(grid, from, to)) return "no-line-of-sight";
  return null;
}

/** Whether an area option may be aimed at this cell: on the board, within the distance it carries,
 *  and with nothing solid in the way. Aiming at an empty patch of ground is perfectly legal and
 *  simply catches nobody. */
export function rulesetAimLegal(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  at: RulesetCombatCell,
): boolean {
  const grid = state.board?.grid;
  const actor = rulesetCombatant(state, actorId);
  const action = actor ? actionOf(actor, optionId) : undefined;
  const from = rulesetPositionOf(actor);
  const reach = rulesetOptionReach(state, actorId, optionId);
  if (!grid || !action?.area || !from || !reach) return false;
  if (!Number.isInteger(at.x) || !Number.isInteger(at.y)) return false;
  if (at.x < 0 || at.y < 0 || at.x >= grid.width || at.y >= grid.height) return false;
  return rulesetCellDistance(from, at) <= reach.max && rulesetLineOfSight(grid, from, at);
}

/** Where an area option may be aimed, and who each aim would catch. Empty for anything that is not
 *  an area, and for every fight without a board. */
export function rulesetAimCells(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  /** Stop after this many aims. A forecast only needs to know that ONE exists and whom it catches,
   *  and scanning the rest of the board for it on every menu read is work nobody sees. */
  limit = Infinity,
): Array<{ x: number; y: number; targetIds: string[] }> {
  const grid = state.board?.grid;
  const from = rulesetPositionOf(rulesetCombatant(state, actorId));
  const reach = rulesetOptionReach(state, actorId, optionId);
  if (!grid || !from || !reach) return [];
  const aims: Array<{ x: number; y: number; targetIds: string[] }> = [];
  // Scanned over the BOARD, never over the range: a ruleset may declare a range of ten thousand
  // units, and a loop that long would be a way to stall a server with one catalog entry.
  const box = (around: RulesetCombatCell, radius: number) => ({
    top: Math.max(0, around.y - radius),
    bottom: Math.min(grid.height - 1, around.y + radius),
    left: Math.max(0, around.x - radius),
    right: Math.min(grid.width - 1, around.x + radius),
  });
  // A BALL only ever catches somebody standing within its own radius of where it lands, so the cells
  // worth looking at are the ones around the people on the board, not every cell it could be thrown
  // to: a long throw over a wide board is otherwise thousands of cells, every one of them drawing
  // its whole shape. A cone and a line reach out from the ACTOR, so a cell next to them can catch
  // somebody at the far end, and for those the cells to look at are the ones the aim may be sent to.
  const shape = actionOf(rulesetCombatant(state, actorId)!, optionId)?.area;
  const boxes =
    shape?.shape === "burst"
      ? state.combatants
          // Anybody still in the fight, on their feet or on the ground: a shape that MENDS is set
          // down on the ally who fell, and that cell has to be offered.
          .filter((combatant) => !combatant.defeated && rulesetPositionOf(combatant))
          .map((combatant) => box(rulesetPositionOf(combatant)!, shape.size))
      : [box(from, reach.max)];
  // And a ceiling on the cells looked at, whatever `limit` says: the largest board a save may hold
  // is 64 by 64, so nothing legitimate is cut short, and nothing else can make this loop long.
  let looked = 0;
  const seen = new Set<string>();
  for (const bounds of boxes) {
    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        const key = `${x},${y}`;
        // Two people standing close together share cells, and a cell is both looked at and offered
        // once: a cell seen twice must not spend the ceiling, or a crowd could use it up before the
        // cells further out are ever reached.
        if (seen.has(key)) continue;
        seen.add(key);
        if (++looked > RULESET_AIM_SCAN_CEILING) return aims;
        const at = { x, y };
        if (!rulesetAimLegal(state, actorId, optionId, at)) continue;
        const targetIds = rulesetAreaTargets(state, actorId, optionId, at);
        // A cell the shape would catch nobody from is still somewhere it may be aimed, but it is not
        // worth carrying to a screen or to a picker.
        if (targetIds.length > 0) aims.push({ x, y, targetIds });
        if (aims.length >= limit) return aims;
      }
    }
  }
  return aims;
}

/** Everybody standing in the cells an area aimed at this one would cover. Friend and foe alike,
 *  unless the entry said its own side is left out. */
export function rulesetAreaTargets(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  at: RulesetCombatCell,
): string[] {
  const grid = state.board?.grid;
  const actor = rulesetCombatant(state, actorId);
  const action = actor ? actionOf(actor, optionId) : undefined;
  const from = rulesetPositionOf(actor);
  if (!grid || !actor || !action?.area || !from) return [];
  const covered = new Set(
    rulesetAreaCells(action.area.shape, action.area.size, from, at, grid).map((cell) => `${cell.x},${cell.y}`),
  );
  return state.combatants
    .filter((combatant) => {
      if (combatant.defeated) return false;
      if (action.area?.friendlyFire === false && combatant.side === actor.side) return false;
      // Something that MENDS lands only on whom its author pointed it at. A blast catches everybody
      // in its cells because fire does not ask; a healing word that also closed the enemy's wounds
      // would be the rules being read by a machine rather than by a table.
      if (action.heal) {
        const sameSide = combatant.side === actor.side;
        if (action.targets.side === "self" && combatant.id !== actor.id) return false;
        if (action.targets.side === "ally" && !sameSide) return false;
        if (action.targets.side === "enemy" && sameSide) return false;
      }
      const cell = rulesetPositionOf(combatant);
      return !!cell && covered.has(`${cell.x},${cell.y}`);
    })
    .map((combatant) => combatant.id);
}

/**
 * What an attack against this combatant is rolled against: their own defense, plus what the ground
 * they stand on is worth when the ruleset says cover adds anything.
 *
 * One answer, so a forecast and the roll that follows it can never disagree about the number.
 */
export function rulesetDefenseAgainst(
  combat: RulesetCombat,
  state: RulesetEncounterState,
  target: RulesetCombatant,
): { defense: number; cover: number } {
  const grid = state.board?.grid;
  const at = rulesetPositionOf(target);
  const bonus = combat.cover?.bonus ?? 0;
  if (!grid || !at || bonus <= 0 || rulesetCellCover(grid, at) <= 0) return { defense: target.defense, cover: 0 };
  return { defense: target.defense + bonus, cover: bonus };
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

// ── The menu ──

/** Whether the actor's own conditions stop them doing anything at all. */
function blocked(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  return rulesetCombatEffects(definition, combat, actor, state).has("cannot-act");
}

/** Whoever this combatant may not point anything at: the source of a condition on them that says
 *  so. A charm keeps a character from turning on whoever charmed them, in the ruleset's own words. */
export function rulesetForbiddenTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): Set<string> {
  const combat = definition.combat;
  const forbidden = new Set<string>();
  if (!combat) return forbidden;
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    if (!entry.effects.includes("cannot-target-source")) continue;
    const source = actor.tracked.find((tracked) => tracked.condition === entry.condition)?.source;
    if (source) forbidden.add(source);
  }
  return forbidden;
}

/**
 * Who this option may legally be pointed at RIGHT NOW, in the order the combatants were handed in.
 *
 * One place decides it: the resolver checks a choice against this list, and a caller that draws a
 * menu sends the same list on, so a client never works out legality of its own.
 *
 * A combatant who is down can still be healed and can still be hit while they are down. Only one
 * the fight is over for is off the table.
 */
export function rulesetOptionTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  option: { id: string; targets: RulesetCombatAction["targets"] },
): string[] {
  const actor = rulesetCombatant(state, actorId);
  if (!actor || option.targets.count <= 0) return [];
  // An area is aimed at a CELL, so nobody is named: which combatants it catches follows from where
  // it lands, and `rulesetAreaTargets` is the one place that answers it.
  if (positioned(state) && actionOf(actor, option.id)?.area) return [];
  const forbidden = rulesetForbiddenTargets(definition, state, actor);
  return (
    state.combatants
      .filter((combatant) => {
        if (combatant.defeated) return false;
        // Whoever put a condition on this actor that says they may not be pointed at.
        if (forbidden.has(combatant.id)) return false;
        // Helping yourself is not help.
        // Read the NAME rather than the id: the same standard action is also offered bought with
        // another budget, as `standard:help@bonus`, and nobody helps themselves whichever they took.
        if (rulesetStandardName(option.id) === "help" && combatant.id === actor.id) return false;
        if (option.targets.side === "self") return combatant.id === actor.id;
        if (option.targets.side === "ally") return combatant.side === actor.side;
        if (option.targets.side === "enemy") return combatant.side !== actor.side;
        return true;
      })
      // And then how far away they are, which is nothing at all in a fight without a board.
      .filter((combatant) => rulesetTargetRefusal(state, actor.id, option.id, combatant.id) === null)
      .map((combatant) => combatant.id)
  );
}

function firstTarget(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
) {
  const id = rulesetOptionTargets(definition, state, actor.id, { id: action.id, targets: action.targets })[0];
  return id === undefined ? undefined : rulesetCombatant(state, id);
}

/** An area names nobody, so a forecast reads the first combatant any legal aim would catch. Without
 *  it a shape that only ever lands on cells would promise no chance to hit at all. */
function firstAreaTarget(state: RulesetEncounterState, actor: RulesetCombatant, action: RulesetCombatAction) {
  if (!action.area || !positioned(state)) return undefined;
  const id = rulesetAimCells(state, actor.id, action.id, 1)[0]?.targetIds[0];
  return id === undefined ? undefined : rulesetCombatant(state, id);
}

/** Whether the actor's own bookkeeping still allows this action: a use it has not run out of, and
 *  a recharge that has come back. Both belong to a stat block; a sheet-backed ability is priced by
 *  the sheet instead. */
export function rulesetActionAvailable(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  if (action.uses && (actor.uses[action.id] ?? 0) < 1) return false;
  return !actor.spent.includes(action.id);
}

/** Whether a part of a sequence can happen at all: a real action of this block, not a sequence
 *  itself, not one that is bought with points, and not one that is used up or waiting for its dice.
 *  The menu, the forecast and the resolution all ask this one question. */
export function rulesetSequencePartAvailable(
  actor: RulesetCombatant,
  part: RulesetCombatAction | undefined,
): part is RulesetCombatAction {
  return !!part && !part.sequence && !part.signature && rulesetActionAvailable(actor, part);
}

/** A sequence with no part left that can happen would be paid for and do nothing. */
export function rulesetSequenceCanHappen(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  if (!action.sequence) return true;
  return action.sequence.some((step) =>
    rulesetSequencePartAvailable(
      actor,
      actor.actions.find((entry) => entry.id === step.actionId),
    ),
  );
}

/** What an action is expected to do. A sequence forecasts the SUM of its parts and no single chance
 *  to hit, because each part rolls its own against whoever it was pointed at. */
function forecastFor(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatOption["forecast"] | undefined {
  const forecast: NonNullable<RulesetCombatOption["forecast"]> = {};
  if (action.sequence) {
    const byId = new Map(actor.actions.map((entry) => [entry.id, entry]));
    // A part that has no use left, or is waiting for its dice, will not happen, so it is not
    // promised either. Counted strike by strike, the way the sequence will resolve: a part with one
    // use left that is named twice lands once, and a part that recharges lands once and is spent.
    const usesLeft = new Map<string, number>();
    const spent = new Set<string>();
    const total = action.sequence.reduce((sum, step) => {
      const part = byId.get(step.actionId);
      if (!rulesetSequencePartAvailable(actor, part) || spent.has(part.id)) return sum;
      let strikes = step.times;
      if (part.uses) {
        const uses = usesLeft.get(part.id) ?? actor.uses[part.id] ?? 0;
        strikes = Math.min(strikes, uses);
        usesLeft.set(part.id, uses - strikes);
      }
      if (part.recharge && strikes > 0) {
        strikes = 1;
        spent.add(part.id);
      }
      return sum + (part.damage ? strikes * rulesetAverageDamage(part.damage) : 0);
    }, 0);
    if (total > 0) forecast.averageDamage = Math.round(total * 100) / 100;
    return forecast.averageDamage === undefined ? undefined : forecast;
  }
  const target = firstTarget(definition, state, actor, action) ?? firstAreaTarget(state, actor, action);
  if (action.toHit !== undefined && target) {
    // The same number the roll will be made against: the target's own defense plus whatever the
    // ground they stand on is worth, and the same roll mode the distance between them asks for.
    const chance = rulesetHitChance(
      combat,
      action.toHit,
      rulesetDefenseAgainst(combat, state, target).defense,
      rulesetAttackMode(definition, combat, actor, target, { state, optionId: action.id }),
    );
    if (chance !== null) forecast.hitChance = Math.round(chance * 1000) / 1000;
  }
  // The whole blow, clauses and all. A clause with a save of its own is counted in full: a forecast
  // says what a blow would do, not what a die nobody has thrown might take off it.
  const amount = action.damage ?? action.heal;
  if (amount) forecast.averageDamage = Math.round(rulesetAverageDamage(amount) * 100) / 100;
  return forecast.hitChance !== undefined || forecast.averageDamage !== undefined ? forecast : undefined;
}

function optionFrom(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  /** The window is asking, so a reaction whose moment this is belongs on the list after all. */
  atItsMoment = false,
): RulesetCombatOption | null {
  // A signature action is bought with points at the end of somebody else's turn, so it is never on
  // the actor's own menu. `rulesetSignatureOptions` is where it is offered.
  if (action.signature) return null;
  // A reaction waits for its moment, which is never a turn. `rulesetWindowOptions` is where the
  // moment offers it.
  if (action.reaction && !atItsMoment) return null;
  // A sequence whose parts are all gone, or all spent, would spend a budget and do nothing.
  if (!rulesetSequenceCanHappen(actor, action)) return null;
  if (!actionDoesSomething(action)) return null;
  // Free of the economy, or paid for out of strikes a spend already bought. Either way no budget is
  // asked for, and the option says so by carrying none.
  const free = action.free === true || rulesetFreeStrike(actor, action);
  if (!free && (actor.budgets[action.budget] ?? 0) < 1) return null;
  if (!rulesetActionAvailable(actor, action)) return null;
  const paid = planRulesetCombatCost(definition, actor, action);
  if (!paid) return null;
  const option: RulesetCombatOption = {
    id: action.id,
    kind: action.kind,
    label: action.label,
    ...(free ? {} : { budget: action.budget }),
    targets: action.targets,
    ...(rulesetFreeStrike(actor, action) ? { strikes: actor.strikesLeft } : {}),
    ...(action.heal ? { heals: true } : {}),
  };
  if (paid.cost.length > 0) option.cost = paid.cost;
  if (action.uses) option.left = actor.uses[action.id] ?? 0;
  // A shape, in cells, so a screen can draw the template before the choice is made and a picker can
  // weigh it. Only in a positioned fight: without a board an area is still resolved by target ids.
  if (action.area && positioned(state)) {
    const reach = rulesetOptionReach(state, actor.id, action.id);
    option.area = { shape: action.area.shape, size: action.area.size, range: reach?.max ?? action.area.size };
  }
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
  const forecast = forecastFor(definition, combat, state, actor, action);
  if (forecast) option.forecast = forecast;
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
  /** Where the two of them stand, which is what the distance rules read. Left out by a fight with
   *  no board, and then none of them says anything. */
  where?: { state: RulesetEncounterState; optionId: string },
): RulesetCombatRollMode {
  if (!combat.attackRoll.advantage) return "normal";
  const own = rulesetCombatEffects(definition, combat, actor, where?.state);
  const theirs = rulesetCombatEffects(definition, combat, target, where?.state);
  const distance = where ? distanceModes(combat, where.state, where.optionId, actor, target, theirs) : null;
  const advantage =
    own.has("own-attacks-advantage") ||
    theirs.has("attacks-against-advantage") ||
    !!actor.flags.helped ||
    !!distance?.advantage;
  const disadvantage =
    own.has("own-attacks-disadvantage") ||
    theirs.has("attacks-against-disadvantage") ||
    !!target.flags.dodging ||
    !!distance?.disadvantage;
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/** Whether the actor is next to somebody on the other side, which is what a ruleset that says
 *  shooting beside a foe is harder measures. */
function foeAdjacent(state: RulesetEncounterState, actor: RulesetCombatant, at: RulesetCombatCell): boolean {
  return state.combatants.some((combatant) => {
    if (combatant.side === actor.side || !rulesetCombatStanding(combatant)) return false;
    const cell = rulesetPositionOf(combatant);
    return !!cell && rulesetCellDistance(at, cell) <= 1;
  });
}

/** What the distance between these two says about the roll: the ruleset's own ranged rules, and the
 *  three condition effects that only mean something once somebody has a position. */
function distanceModes(
  combat: RulesetCombat,
  state: RulesetEncounterState,
  optionId: string,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  theirs: ReadonlySet<string>,
): { advantage: boolean; disadvantage: boolean } | null {
  const from = rulesetPositionOf(actor);
  const to = rulesetPositionOf(target);
  if (!positioned(state) || !from || !to) return null;
  const away = rulesetCellDistance(from, to);
  const adjacent = away <= 1;
  const reach = rulesetOptionReach(state, actor.id, optionId);
  const ranged = combat.ranged;
  // A thrown weapon used in hand is a swing, so neither ranged rule reads it there.
  const thrown = !!reach?.shot && away > (reach?.swing ?? 0);
  const tooFar = !!ranged && ranged.long === "disadvantage" && thrown && away > reach!.normal;
  const crowded = !!ranged && ranged.adjacentFoe === "disadvantage" && thrown && foeAdjacent(state, actor, from);
  return {
    advantage: adjacent && theirs.has("attacks-against-adjacent-advantage"),
    disadvantage: tooFar || crowded || (!adjacent && theirs.has("attacks-against-far-disadvantage")),
  };
}

/** Whether a hit on this target from where the actor stands is a critical whatever the dice said:
 *  the third distance condition effect. */
export function rulesetCriticalFromAdjacent(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): boolean {
  const from = rulesetPositionOf(actor);
  const to = rulesetPositionOf(target);
  if (!positioned(state) || !from || !to || rulesetCellDistance(from, to) > 1) return false;
  return rulesetCombatEffects(definition, combat, target, state).has("attacks-from-adjacent-critical");
}

/** What getting back up costs, in cells: half the whole allowance, rounded up, so half of one is
 *  still the whole of it rather than nothing. */
export function rulesetStandCost(combatant: RulesetCombatant): number {
  return Math.max(1, Math.ceil((combatant.movement ?? 0) / 2));
}

/** Which of the actor's conditions is the one holding them down. */
export function rulesetProneCondition(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
): string | null {
  const active = new Set(rulesetCombatConditions(definition, actor));
  const entry = (combat.conditions ?? []).find(
    (candidate) => active.has(candidate.condition) && candidate.effects.includes("half-move-to-stand"),
  );
  return entry?.condition ?? null;
}

/**
 * Walking, and getting back up. A fight with no board has neither.
 *
 * Getting up comes FIRST: while a condition holds somebody down, half their allowance is what it
 * costs to clear it, and nothing else about movement is offered until they have.
 */
function movementOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  if (!positioned(state) || !rulesetPositionOf(actor)) return [];
  // A condition that pins somebody takes their movement away the moment it lands, not at the start
  // of their next turn.
  if (rulesetCombatEffects(definition, combat, actor, state).has("speed-zero")) return [];
  const left = Math.max(0, Math.floor(actor.movementLeft ?? 0));
  const prone = rulesetProneCondition(definition, combat, actor);
  if (prone) {
    const cost = rulesetStandCost(actor);
    if (left < cost) return [];
    return [
      {
        id: RULESET_STAND_OPTION,
        kind: "move",
        label: "Stand up",
        targets: { side: "self", count: 0 },
        movementCost: cost,
      },
    ];
  }
  if (left < 1) return [];
  const cells = rulesetReachableCells(definition, state, actor.id);
  if (cells.length === 0) return [];
  return [{ id: RULESET_MOVE_OPTION, kind: "move", label: "Move", targets: { side: "self", count: 0 }, cells }];
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
  if (!rulesetCombatStanding(actor) || blocked(definition, combat, state, actor)) return [endTurn];

  const options: RulesetCombatOption[] = [];
  options.push(...movementOptions(definition, combat, state, actor));
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
  options.push(...grantedStandardOptions(definition, combat, actor));
  options.push(endTurn);
  return options;
}

/**
 * What this combatant could buy with its own points RIGHT NOW. A signature action is spent at the
 * end of somebody else's turn, so the actor whose turn it is has none to offer, and the points are
 * given back at the start of its own turn.
 *
 * This slice stores the points, prices the options and spends them when one is chosen. The WINDOW
 * that asks a creature to pick one, between one turn and the next, is a later slice; until then a
 * caller with its own reason to open one already has everything it needs here.
 */
export function rulesetSignatureOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  const points = actor?.signature?.points;
  if (!combat || !actor || points === undefined) return [];
  if (currentRulesetActor(state)?.id === actorId) return [];
  if (!rulesetCombatStanding(actor) || blocked(definition, combat, state, actor)) return [];
  const options: RulesetCombatOption[] = [];
  for (const action of actor.actions) {
    if (!action.signature || action.signature.cost > points) continue;
    if (!rulesetActionAvailable(actor, action) || !rulesetSequenceCanHappen(actor, action)) continue;
    const option: RulesetCombatOption = {
      id: action.id,
      kind: action.kind,
      label: action.label,
      targets: action.targets,
      ...(action.heal ? { heals: true } : {}),
      signature: { cost: action.signature.cost, points },
    };
    if (action.uses) option.left = actor.uses[action.id] ?? 0;
    const forecast = forecastFor(definition, combat, state, actor, action);
    if (forecast) option.forecast = forecast;
    options.push(option);
  }
  return options;
}

/** Letting a window go by. Not an action and not on any turn's menu: the one id a window always
 *  takes, so passing is a choice the fight records rather than a timeout. */
export const RULESET_PASS_OPTION = "pass";

/**
 * The menu of the one combatant a window is asking. Everybody else gets nothing, because a window
 * asks one at a time: the answer spends a budget or points, and two answers at once would spend
 * them against a fight that had already moved.
 *
 * Passing is always legal and is not listed here: it is `RULESET_PASS_OPTION`, which needs no
 * legality of its own.
 */
export function rulesetWindowOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const window = state.window;
  if (!combat || !window || window.waiting[0] !== actorId) return [];
  // Points, not a budget, and priced and checked where every other signature option is.
  if (window.kind === "signature") return rulesetSignatureOptions(definition, state, actorId);

  const actor = rulesetCombatant(state, actorId);
  if (!actor) return [];

  if (window.trigger.kind === "leaves-reach") {
    const opportunity = combat.opportunity;
    // Re-read rather than trusted from when the window opened: an answer before this one may have
    // taken this combatant out, held them still or spent the very budget this would pay with.
    if (!rulesetCombatStanding(actor)) return [];
    const effects = rulesetCombatEffects(definition, combat, actor, state);
    if (effects.has("cannot-act") || effects.has("cannot-react")) return [];
    if (!opportunity || (actor.budgets[opportunity.budget] ?? 0) < 1) return [];
    const mover = rulesetCombatant(state, window.trigger.moverId);
    if (!mover || !rulesetCombatStanding(mover)) return [];
    const strike = rulesetOpportunityAttack(actor);
    if (!strike) return [];
    return [
      {
        id: strike.id,
        kind: strike.kind,
        label: strike.label,
        // Nobody to pick: the strike lands on whoever is walking away, and offering a target would
        // be offering a choice the fight then ignores.
        targets: { side: "self", count: 0 },
        budget: opportunity.budget,
      },
    ];
  }

  // A moment the Engine noticed, and everything this one holds that waits for exactly it.
  const moment = rulesetWindowMoment(window.trigger);
  if (!moment) return [];
  const source = "sourceId" in window.trigger ? window.trigger.sourceId : "";
  return rulesetReactionsAt(definition, combat, state, actor, moment, source).map((action) => {
    const option = optionFrom(definition, combat, state, actor, action, true)!;
    // Nobody to pick unless the entry says its holder picks: it is aimed back at whoever caused
    // the moment, or, for something its holder does to themselves, at its holder.
    return rulesetReactionPointsAtSource(action) ? { ...option, targets: { side: "self", count: 0 } } : option;
  });
}

/** Whether what is taken at a moment is aimed back at whoever caused it. False for one its holder
 *  picks targets for, and for one they do to themselves. */
export function rulesetReactionPointsAtSource(action: RulesetCombatAction): boolean {
  return !!action.reaction && action.reaction.at !== "chosen" && action.targets.side !== "self";
}

/** Which moment a window is, for the reactions that wait for one. A walk and the turn between two
 *  actors are windows of their own kind and wait for nothing. */
export function rulesetWindowMoment(trigger: RulesetWindowTrigger): RulesetReactionMoment | null {
  return trigger.kind === "aimed" || trigger.kind === "harmed" ? trigger.kind : null;
}

/**
 * Everything this combatant holds that waits for exactly this moment and could be taken right now.
 *
 * Read BEFORE a window opens, to decide whether there is anybody worth asking, and again while it
 * is open, to build the menu. One reading either way, so a window is never opened for a menu that
 * turns out to be empty.
 */
export function rulesetReactionsAt(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  moment: RulesetReactionMoment,
  /** Whoever caused the moment. One aimed back at them needs them still to BE a target: an answer
   *  before this one may have taken them out, and nothing is offered that the rules would refuse. */
  sourceId: string,
): RulesetCombatAction[] {
  if (!rulesetCombatStanding(actor)) return [];
  const effects = rulesetCombatEffects(definition, combat, actor, state);
  if (effects.has("cannot-act") || effects.has("cannot-react")) return [];
  return actor.actions.filter((action) => {
    if (action.reaction?.on !== moment) return false;
    if (optionFrom(definition, combat, state, actor, action, true) === null) return false;
    if (!rulesetReactionPointsAtSource(action)) return true;
    return rulesetOptionTargets(definition, state, actor.id, action).includes(sourceId);
  });
}
