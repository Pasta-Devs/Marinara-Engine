/**
 * The arithmetic of a `dice-pool` fight: pools thrown and counted in successes, damage dice, soak,
 * the wound penalty on a pool, and the exact chances a forecast reads.
 *
 * A `dice-pool` fight reads the sheet the way the ruleset's own `dice-pool` checks do: every number a
 * roll ADDS is a number of dice, and every number it MEETS is a count of successes. So a to-hit number
 * is the pool an attack throws, a defense is how many successes it needs (never fewer than one), a
 * save's number is its pool and its difficulty the successes it needs, and a condition's flat modifier
 * is dice added or taken away.
 */
import type { RulesetCombat, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { readRulesetWoundPenalty } from "../rulesets/live-state.js";
import { rollDicePoolCheck } from "../rulesets/sheet-math.js";
import type { RulesetCombatant, RulesetCombatRoller, RulesetCombatRollMode } from "./types.js";

/** Whether this fight throws pools. */
export function rulesetCombatIsPool(combat: RulesetCombat): boolean {
  return combat.kind === "dice-pool";
}

/** Whether this fight may roll twice and keep one, whichever kind it is. */
export function rulesetCombatAdvantage(combat: RulesetCombat): boolean {
  return combat.attackRoll?.advantage ?? combat.pool?.advantage ?? false;
}

/** One pool thrown: every face that fell (both throws, when there were two), the net successes of the
 *  throw that was kept, whether that throw botched, and what the dice were thrown against. */
export interface RulesetCombatPoolThrow {
  rolls: number[];
  successes: number;
  botch: boolean;
  target: number;
  /** How many dice the kept throw was, after the ruleset's own floor and ceiling. */
  dice: number;
}

/** A pool's worth, for keeping the better or the worse of two throws: a botch is worse than any
 *  throw that did not botch, however few successes that one had. */
function worth(thrown: { successes: number; botch: boolean }): number {
  return thrown.botch ? -1 : thrown.successes;
}

/**
 * Throw `dice` dice of the ruleset's own pool, through the same roller its checks use, so the pool's
 * floor and ceiling, its target, and what its faces double, explode, cancel and botch on are the
 * ruleset's. Twice with one kept when the roll leans.
 */
export function throwRulesetCombatPool(
  definition: RulesetDefinition,
  roll: RulesetCombatRoller,
  dice: number,
  mode: RulesetCombatRollMode = "normal",
  /** A per-die target of this throw's own (a weapon's), held to what the ruleset allows. */
  threshold?: number,
): RulesetCombatPoolThrow {
  const once = () => {
    const result = rollDicePoolCheck(
      definition,
      { modifier: dice, required: 1, isSave: false, ...(threshold !== undefined ? { threshold } : {}) },
      roll,
    );
    return { rolls: result.rolls, successes: result.total, botch: result.criticalFailure, target: result.threshold };
  };
  // The dice the pool is, before anything explodes: the ruleset's own floor and ceiling applied.
  const count = thrownCount(definition, dice);
  const first = once();
  if (mode === "normal") return { ...first, dice: count };
  const second = once();
  const keepSecond = mode === "advantage" ? worth(second) > worth(first) : worth(second) < worth(first);
  const kept = keepSecond ? second : first;
  return { ...kept, rolls: [...first.rolls, ...second.rolls], dice: count };
}

/** The die a `dice-pool` ruleset throws. */
export function rulesetPoolDie(definition: RulesetDefinition): number {
  return definition.resolution.kind === "dice-pool" ? definition.resolution.die.sides : 10;
}

/** The per-die target damage and soak are thrown against: the fight's own, or the ruleset's default. */
export function rulesetDamageTarget(definition: RulesetDefinition, combat: RulesetCombat): number {
  if (combat.pool?.damageTarget !== undefined) return combat.pool.damageTarget;
  return definition.resolution.kind === "dice-pool" ? definition.resolution.target.default : 2;
}

/** The most dice one pool may be, from the ruleset's own `pool.max`. */
function poolCeiling(definition: RulesetDefinition): number {
  return definition.resolution.kind === "dice-pool" ? definition.resolution.pool.max : 0;
}

/** Damage or soak dice: each die at or above the target is one success and nothing else, no face
 *  doubles, explodes, cancels or botches. Never more dice than the ruleset lets a pool be. */
export function throwRulesetDamageDice(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  roll: RulesetCombatRoller,
  dice: number,
): { rolls: number[]; successes: number; target: number } {
  const sides = rulesetPoolDie(definition);
  const target = rulesetDamageTarget(definition, combat);
  const count = Math.max(0, Math.min(poolCeiling(definition), Math.floor(dice)));
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(roll(sides));
  return { rolls, successes: rolls.filter((face) => face >= target).length, target };
}

/** What this combatant soaks of one kind of harm: its kind's own number, else its number for all. */
export function rulesetSoakOf(combatant: RulesetCombatant, kind: string | undefined): number {
  const soak = combatant.soak;
  if (!soak) return 0;
  if (kind !== undefined && soak.byKind?.[kind] !== undefined) return soak.byKind[kind]!;
  return soak.all ?? 0;
}

/** The wound penalty on the pools a combatant throws to act, as dice: the track the ruleset names in
 *  `resolution.penaltyFrom`, read off their sheet as it stands now. 0 for somebody with no sheet. */
export function rulesetCombatPenalty(definition: RulesetDefinition, combatant: RulesetCombatant): number {
  const track = definition.resolution.penaltyFrom;
  if (!track || !combatant.sheet) return 0;
  return readRulesetWoundPenalty(definition, combatant.sheet.build, combatant.sheet.live, track);
}

// ── Chances ──

/** Each face of this ruleset's die: its net worth (-1 for a cancelling face, 0, 1, or 2 for a doubled
 *  one; a face may both succeed and cancel, which nets to 0) and whether it throws another die. */
function dieFaces(definition: RulesetDefinition, threshold?: number): Array<{ value: number; explodes: boolean }> {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-pool") return [{ value: 0, explodes: false }];
  // A throw's own target counts where the ruleset lets the target move, held inside it, as the roll
  // holds it.
  const { target } = resolution;
  const counts =
    threshold !== undefined && target.min < target.max
      ? Math.min(target.max, Math.max(target.min, Math.trunc(threshold)))
      : target.default;
  const faces: Array<{ value: number; explodes: boolean }> = [];
  for (let face = 1; face <= resolution.die.sides; face++) {
    let value = 0;
    // A doubling or exploding rule with no `from` fires only when a check asks for it, which a fight
    // never does, so it counts for nothing here, exactly as the roll counts it.
    const doubleFrom = resolution.double?.from;
    const explodeFrom = resolution.explode?.from;
    if (face >= counts) value = doubleFrom !== undefined && face >= doubleFrom ? 2 : 1;
    if (resolution.cancel && face <= resolution.cancel.upTo) value -= 1;
    faces.push({ value, explodes: explodeFrom !== undefined && face >= explodeFrom });
  }
  return faces;
}

/** How deep a forecast follows explosions: three dice down is past anything a percent could show. */
const EXPLODE_DEPTH = 3;

/** One die's net worth with its explosions folded in, as chances by value. */
function oneDie(definition: RulesetDefinition, threshold?: number): Map<number, number> {
  const faces = dieFaces(definition, threshold);
  const share = 1 / faces.length;
  const at = (depth: number): Map<number, number> => {
    const out = new Map<number, number>();
    const add = (value: number, chance: number) => out.set(value, (out.get(value) ?? 0) + chance);
    const deeper = depth < EXPLODE_DEPTH && faces.some((face) => face.explodes) ? at(depth + 1) : null;
    for (const face of faces) {
      if (face.explodes && deeper) for (const [value, chance] of deeper) add(face.value + value, chance * share);
      else add(face.value, share);
    }
    return out;
  };
  return at(0);
}

/** The number of dice a pool really throws: the ruleset's own floor and ceiling, as the roll does. */
function thrownCount(definition: RulesetDefinition, dice: number): number {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-pool") return 0;
  return Math.max(resolution.pool.min, Math.min(resolution.pool.max, Math.floor(dice)));
}

/** How likely each count of net successes is for ONE throw of `dice` dice, indexed by successes. */
function distributionOnce(definition: RulesetDefinition, dice: number, threshold?: number): number[] {
  const die = oneDie(definition, threshold);
  let total = new Map<number, number>([[0, 1]]);
  for (let i = 0; i < thrownCount(definition, dice); i++) {
    const next = new Map<number, number>();
    for (const [sum, chance] of total) {
      for (const [value, face] of die) next.set(sum + value, (next.get(sum + value) ?? 0) + chance * face);
    }
    total = next;
  }
  const out: number[] = [];
  for (const [sum, chance] of total) {
    const at = Math.max(0, sum);
    out[at] = (out[at] ?? 0) + chance;
  }
  for (let i = 0; i < out.length; i++) out[i] ??= 0;
  return out;
}

/** How likely each count of net successes is for a pool, thrown once or twice with the better or
 *  the worse kept, as [successes, chance] pairs. What a contest's forecast compares two sides with. */
export function rulesetPoolDistribution(
  definition: RulesetDefinition,
  dice: number,
  mode: RulesetCombatRollMode = "normal",
): Array<[number, number]> {
  const once = distributionOnce(definition, dice);
  if (mode === "normal") return once.map((chance, successes) => [successes, chance]);
  // The better of two is at most k when both are; the worse of two is at least k when both are.
  const below: number[] = [];
  let running = 0;
  for (const chance of once) below.push((running += chance));
  return once.map((_, successes) => {
    const atMost = below[successes]!;
    const atMostBefore = successes > 0 ? below[successes - 1]! : 0;
    const chance = mode === "advantage" ? atMost ** 2 - atMostBefore ** 2 : (1 - atMostBefore) ** 2 - (1 - atMost) ** 2;
    return [successes, chance];
  });
}

/** The chance ONE throw of `dice` dice reaches `needed` net successes: its distribution summed from
 *  `needed` up. A botch has no success, so it never reaches the one a hit needs. */
function chanceOnce(definition: RulesetDefinition, dice: number, needed: number, threshold?: number): number {
  let reached = 0;
  distributionOnce(definition, dice, threshold).forEach((chance, successes) => {
    if (successes >= needed) reached += chance;
  });
  return Math.min(1, Math.max(0, reached));
}

/** The chance a pool of `dice` dice reaches `needed` successes, rolled once or twice with one kept. */
export function rulesetPoolChance(
  definition: RulesetDefinition,
  dice: number,
  needed: number,
  mode: RulesetCombatRollMode = "normal",
  /** A per-die target of the throw's own, as `throwRulesetCombatPool` takes one. */
  threshold?: number,
): number {
  const once = chanceOnce(definition, dice, Math.max(1, needed), threshold);
  if (mode === "advantage") return 1 - (1 - once) ** 2;
  if (mode === "disadvantage") return once ** 2;
  return once;
}

/** How many successes a pool of `dice` dice is worth on average, net of what cancels. */
export function rulesetPoolAverage(definition: RulesetDefinition, dice: number): number {
  let perDie = 0;
  for (const [value, chance] of oneDie(definition)) perDie += value * chance;
  return Math.max(0, thrownCount(definition, dice) * perDie);
}

/** How many successes damage or soak dice are worth on average: each die reaches the target or not. */
export function rulesetDamageAverage(definition: RulesetDefinition, combat: RulesetCombat, dice: number): number {
  const sides = rulesetPoolDie(definition);
  const target = rulesetDamageTarget(definition, combat);
  const perDie = Math.max(0, sides - target + 1) / sides;
  return Math.max(0, Math.min(poolCeiling(definition), dice)) * perDie;
}
