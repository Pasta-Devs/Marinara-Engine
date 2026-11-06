/**
 * The arithmetic of a `symbol-pool` fight (Capability API 1.382): the ruleset's own symbol dice
 * thrown for an attack, a save or a check, the exact spread of symbols a forecast reads, and the
 * spends the symbols left over buy.
 *
 * A `symbol-pool` fight reads the sheet the way the ruleset's own symbol checks do: a to-hit number is
 * the thrower's dice (some of them upgraded), a defense or a save's difficulty is the dice thrown
 * against them, and a condition's flat modifier is boost dice when it helps and setback dice when it
 * hinders. Net successes land the blow and add to its harm; whatever else is left is spent from the
 * ruleset's own `combat.symbols.spends`, picked by the Engine for whichever side spends that symbol,
 * so no fight waits on the Game Master to say what an advantage bought.
 */
import type { RulesetCombat, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { rollSymbolPoolCheck } from "../rulesets/sheet-math.js";
import type { RulesetCombatRoller, RulesetCombatRollMode, RulesetSymbolSpendChoice } from "./types.js";

/** Whether this fight throws the ruleset's symbol dice. */
export function rulesetCombatIsSymbol(combat: RulesetCombat): boolean {
  return combat.kind === "symbol-pool";
}

/** One thing a leftover symbol buys, as the ruleset declares it. */
export type RulesetSymbolSpend = NonNullable<NonNullable<RulesetCombat["symbols"]>["spends"]>[number];

/** What one symbol throw is made of before the dice are held to the ruleset's own limits. */
export interface RulesetSymbolThrowInput {
  /** The thrower's own dice: a to-hit number, a save's or a check's. */
  dice: number;
  /** How many of them are upgraded. */
  upgrades?: number;
  /** The dice thrown against them. */
  difficulty?: number;
  /** What conditions add: boost dice when above none, setback dice when below. */
  bonus?: number;
  boost?: number;
  setback?: number;
  /** A roll that leans one way throws one more boost or setback die. */
  mode?: RulesetCombatRollMode;
}

/** The dice one throw really is, held to the ruleset's limits as its own checks hold them. */
export interface RulesetSymbolDice {
  dice: number;
  upgrades: number;
  difficulty: number;
  boost: number;
  setback: number;
}

/** One symbol throw: the faces that fell, the symbols left after cancelling, the net successes, and
 *  the dice that went in. Shaped as a pool's throw is, so the fight can carry either. */
export interface RulesetSymbolThrow extends RulesetSymbolDice {
  rolls: number[];
  successes: number;
  botch: false;
  target: 0;
  symbols: Record<string, number>;
}

function clamp(value: number | undefined, max: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}

/** The dice a throw is made of: what conditions add split into boost and setback, a leaning roll one
 *  more of either, and everything held to the ruleset's own ceilings. */
export function rulesetSymbolDice(definition: RulesetDefinition, input: RulesetSymbolThrowInput): RulesetSymbolDice {
  const resolution = definition.resolution;
  if (resolution.kind !== "symbol-pool") return { dice: 0, upgrades: 0, difficulty: 0, boost: 0, setback: 0 };
  const dice = clamp(input.dice, resolution.pool.max);
  // A pool that adds its two numbers up has no upgraded dice of its own to say.
  const upgrades = resolution.pool.build === "sum" || !resolution.pool.upgrade ? 0 : clamp(input.upgrades, dice);
  const bonus = input.bonus !== undefined && Number.isFinite(input.bonus) ? Math.round(input.bonus) : 0;
  const boost = resolution.boost
    ? clamp((input.boost ?? 0) + Math.max(0, bonus) + (input.mode === "advantage" ? 1 : 0), resolution.boost.max)
    : 0;
  const setback = resolution.setback
    ? clamp(
        (input.setback ?? 0) + Math.max(0, -bonus) + (input.mode === "disadvantage" ? 1 : 0),
        resolution.setback.max,
      )
    : 0;
  return { dice, upgrades, difficulty: clamp(input.difficulty, resolution.difficulty.max), boost, setback };
}

/** Throw the ruleset's symbol dice through the same roller its checks use. */
export function throwRulesetSymbolPool(
  definition: RulesetDefinition,
  roll: RulesetCombatRoller,
  input: RulesetSymbolThrowInput,
): RulesetSymbolThrow {
  const dice = rulesetSymbolDice(definition, input);
  const thrown = rollSymbolPoolCheck(
    definition,
    {
      ability: dice.dice,
      rank: dice.upgrades,
      difficulty: dice.difficulty,
      bonusDice: dice.boost,
      setback: dice.setback,
      isSave: false,
    },
    roll,
  );
  return {
    ...dice,
    rolls: thrown.rolls,
    successes: Math.max(0, thrown.total),
    botch: false,
    target: 0,
    symbols: { ...thrown.symbols },
  };
}

/** The net successes a hit, a save or a check needs. */
export function rulesetSymbolNeeded(definition: RulesetDefinition): number {
  return definition.resolution.kind === "symbol-pool" ? definition.resolution.success.needed : 1;
}

/** The symbol whose net count is the successes. */
export function rulesetSymbolSuccess(definition: RulesetDefinition): string | undefined {
  return definition.resolution.kind === "symbol-pool" ? definition.resolution.success.symbol : undefined;
}

// ── The spread of symbols ──

/** One way a throw may come out: the symbols left after cancelling, and how likely it is. */
export interface RulesetSymbolOutcome {
  symbols: Record<string, number>;
  chance: number;
}

const outcomeMemo = new WeakMap<RulesetDefinition, Map<string, RulesetSymbolOutcome[]>>();

/** Every way a throw of these dice may come out, exactly, with what cancels already cancelled. Each
 *  cancelling pair is one signed count and every other symbol its own count, so the spread stays as
 *  small as the ruleset's dice let it be. Remembered per ruleset, since a forecast asks again and
 *  again about the same few throws. */
export function rulesetSymbolOutcomes(definition: RulesetDefinition, dice: RulesetSymbolDice): RulesetSymbolOutcome[] {
  const resolution = definition.resolution;
  if (resolution.kind !== "symbol-pool") return [];
  const key = `${dice.dice}/${dice.upgrades}/${dice.difficulty}/${dice.boost}/${dice.setback}`;
  let memo = outcomeMemo.get(definition);
  if (!memo) outcomeMemo.set(definition, (memo = new Map()));
  const known = memo.get(key);
  if (known) return known;

  // The counts kept: one per cancelling pair (positive is the first symbol's side), one per symbol
  // in no pair.
  const symbols = resolution.symbols.map((symbol) => symbol.id);
  const partner = new Map<string, string>();
  for (const symbol of resolution.symbols) {
    if (!symbol.cancels) continue;
    partner.set(symbol.id, symbol.cancels);
    partner.set(symbol.cancels, symbol.id);
  }
  const axes: Array<{ first: string; second?: string }> = [];
  const axisOf = new Map<string, { axis: number; sign: 1 | -1 }>();
  for (const id of symbols) {
    if (axisOf.has(id)) continue;
    const other = partner.get(id);
    axisOf.set(id, { axis: axes.length, sign: 1 });
    if (other !== undefined) axisOf.set(other, { axis: axes.length, sign: -1 });
    axes.push(other !== undefined ? { first: id, second: other } : { first: id });
  }
  const countsAs = new Map(resolution.symbols.flatMap((symbol) => (symbol.counts ? [[symbol.id, symbol.counts]] : [])));
  const faceDelta = (face: readonly string[]): number[] => {
    const delta = new Array<number>(axes.length).fill(0);
    const credit = (id: string) => {
      const at = axisOf.get(id);
      if (at) delta[at.axis]! += at.sign;
    };
    for (const id of face) {
      credit(id);
      const also = countsAs.get(id);
      if (also !== undefined) credit(also);
    }
    return delta;
  };
  const dieById = new Map(resolution.dice.map((die) => [die.id, die]));
  const { pool, difficulty, boost, setback } = resolution;
  const thrown = [
    ...Array<string>(dice.upgrades).fill(pool.upgrade ?? pool.die),
    ...Array<string>(dice.dice - dice.upgrades).fill(pool.die),
    ...Array<string>(dice.boost).fill(boost?.die ?? ""),
    ...Array<string>(dice.difficulty).fill(difficulty.die),
    ...Array<string>(dice.setback).fill(setback?.die ?? ""),
  ];
  let spread = new Map<string, { counts: number[]; chance: number }>([
    [axes.map(() => 0).join(","), { counts: axes.map(() => 0), chance: 1 }],
  ]);
  for (const id of thrown) {
    const die = dieById.get(id);
    if (!die) continue;
    const share = 1 / die.faces.length;
    const deltas = die.faces.map(faceDelta);
    const next = new Map<string, { counts: number[]; chance: number }>();
    for (const { counts, chance } of spread.values()) {
      for (const delta of deltas) {
        const sum = counts.map((value, index) => value + delta[index]!);
        const at = sum.join(",");
        const entry = next.get(at);
        if (entry) entry.chance += chance * share;
        else next.set(at, { counts: sum, chance: chance * share });
      }
    }
    spread = next;
  }
  const outcomes = [...spread.values()].map(({ counts, chance }) => {
    const left: Record<string, number> = {};
    counts.forEach((value, index) => {
      const axis = axes[index]!;
      if (value > 0) left[axis.first] = value;
      else if (value < 0 && axis.second !== undefined) left[axis.second] = -value;
    });
    return { symbols: left, chance };
  });
  memo.set(key, outcomes);
  return outcomes;
}

/** The chance a throw of these dice reaches the successes a hit needs. */
export function rulesetSymbolChance(definition: RulesetDefinition, dice: RulesetSymbolDice): number {
  const success = rulesetSymbolSuccess(definition);
  if (success === undefined) return 0;
  const needed = rulesetSymbolNeeded(definition);
  return rulesetSymbolOutcomes(definition, dice).reduce(
    (sum, outcome) => sum + ((outcome.symbols[success] ?? 0) >= needed ? outcome.chance : 0),
    0,
  );
}

/** The spread of net successes, as [successes, chance] pairs: what a contest compares two sides by. */
export function rulesetSymbolSuccessDistribution(
  definition: RulesetDefinition,
  dice: RulesetSymbolDice,
): Array<[number, number]> {
  const success = rulesetSymbolSuccess(definition);
  const totals = new Map<number, number>();
  for (const outcome of rulesetSymbolOutcomes(definition, dice)) {
    const at = success === undefined ? 0 : (outcome.symbols[success] ?? 0);
    totals.set(at, (totals.get(at) ?? 0) + outcome.chance);
  }
  return [...totals];
}

// ── Spends ──

/** Whether a spend lands on the side that chose it. */
function onOwnSide(on: string, by: RulesetSymbolSpend["by"]): boolean {
  return on.startsWith(by);
}

/** What a spend is worth to the side that chooses it, in points of harm: the ruleset's own `worth`
 *  where it gives one, else what its effects add up to. A condition is worth two, a die on the next
 *  roll a little over half, and a track a half a step, raised on the other side or lowered on its
 *  own (strain taken off, stress put on a foe). Below none for whatever lands against the chooser. */
export function rulesetSymbolSpendWorth(spend: RulesetSymbolSpend): number {
  if (spend.worth !== undefined) return spend.worth;
  const sign = (on: string) => (onOwnSide(on, spend.by) ? -1 : 1);
  let worth = spend.damage ?? 0;
  if (spend.critical) worth += 1;
  if (spend.condition) worth += 2 * sign(spend.condition.on);
  if (spend.track) worth += 0.5 * spend.track.by * sign(spend.track.on);
  if (spend.boost) worth -= 0.6 * spend.boost.dice * sign(spend.boost.on);
  if (spend.setback) worth += 0.6 * spend.setback.dice * sign(spend.setback.on);
  return worth;
}

/** One spend bought, and how many times. */
export interface RulesetSymbolSpendPick {
  spend: RulesetSymbolSpend;
  times: number;
}

/** What one throw's spends can still do (1.382): how many more copies of a spend would land, given
 *  what has already been bought on this throw, and the record of buying them. The fight and its
 *  forecast hold one per throw, so what is priced is what lands. */
export interface RulesetSymbolSpendBudget {
  copies(spend: RulesetSymbolSpend): number;
  take(spend: RulesetSymbolSpend, times: number): void;
}

/** A budget with no limits but each spend's own `max`. */
export const RULESET_SYMBOL_SPEND_UNLIMITED: RulesetSymbolSpendBudget = {
  copies: (spend) => spend.max,
  take: () => {},
};

/** The most worth one symbol's `capacity` buys from `spends`, each at most `copies` times: a bounded
 *  knapsack, one item per copy. Ties keep the symbols for the story. */
function fillRulesetSymbolSpends(
  spends: readonly RulesetSymbolSpend[],
  capacity: number,
  copies: (spend: RulesetSymbolSpend) => number,
): Map<RulesetSymbolSpend, number> {
  const items = spends.flatMap((spend) => Array.from({ length: Math.max(0, copies(spend)) }, () => spend));
  const best = Array.from({ length: Math.max(0, capacity) + 1 }, () => ({ worth: 0, used: 0, items: [] as number[] }));
  items.forEach((item, index) => {
    const worth = rulesetSymbolSpendWorth(item);
    for (let room = capacity; room >= item.cost; room--) {
      const from = best[room - item.cost]!;
      const worthNow = from.worth + worth;
      const usedNow = from.used + item.cost;
      const here = best[room]!;
      if (worthNow > here.worth + 1e-9 || (Math.abs(worthNow - here.worth) <= 1e-9 && usedNow < here.used)) {
        best[room] = { worth: worthNow, used: usedNow, items: [...from.items, index] };
      }
    }
  });
  const chosen = best.reduce((top, one) =>
    one.worth > top.worth + 1e-9 || (Math.abs(one.worth - top.worth) <= 1e-9 && one.used < top.used) ? one : top,
  );
  const times = new Map<RulesetSymbolSpend, number>();
  for (const index of chosen.items) times.set(items[index]!, (times.get(items[index]!) ?? 0) + 1);
  return times;
}

/** The spends one side buys with the symbols a roll left, the most worth for what it has: each
 *  symbol is its own budget, so each is filled on its own, and a spend worth nothing is never bought.
 *  Ties keep the symbols for the story. What lands is asked of `budget` as each is bought, so two
 *  spends reaching for one holder's room never both get it, and nothing is bought that would not land. */
export function pickRulesetSymbolSpends(
  combat: RulesetCombat,
  symbols: Readonly<Record<string, number>>,
  hit: boolean,
  by: RulesetSymbolSpend["by"],
  budget: RulesetSymbolSpendBudget = RULESET_SYMBOL_SPEND_UNLIMITED,
): RulesetSymbolSpendPick[] {
  const spends = (combat.symbols?.spends ?? []).filter(
    (spend) =>
      spend.by === by &&
      budget.copies(spend) > 0 &&
      (symbols[spend.symbol] ?? 0) >= spend.cost &&
      (hit ? spend.when !== "miss" : spend.when !== "hit") &&
      rulesetSymbolSpendWorth(spend) > 0,
  );
  const bought = new Map<RulesetSymbolSpend, number>();
  for (const symbol of new Set(spends.map((spend) => spend.symbol))) {
    let left = symbols[symbol] ?? 0;
    // Filled again from what is left after each round of taking, so two spends reaching for one
    // holder's room never both count: the worthier is taken first, and the symbols the other would
    // have used go to the best of what still lands.
    for (;;) {
      const chosen = fillRulesetSymbolSpends(
        spends.filter((spend) => spend.symbol === symbol),
        left,
        (spend) => Math.min(spend.max - (bought.get(spend) ?? 0), budget.copies(spend)),
      );
      if (chosen.size === 0) break;
      const byWorth = [...chosen.keys()].sort(
        (a, b) => rulesetSymbolSpendWorth(b) - rulesetSymbolSpendWorth(a) || spends.indexOf(a) - spends.indexOf(b),
      );
      let whole = true;
      let took = false;
      for (const spend of byWorth) {
        const wanted = chosen.get(spend)!;
        const count = Math.min(wanted, budget.copies(spend));
        if (count < wanted) whole = false;
        if (count <= 0) continue;
        budget.take(spend, count);
        bought.set(spend, (bought.get(spend) ?? 0) + count);
        left -= count * spend.cost;
        took = true;
      }
      if (whole || !took) break;
    }
  }
  const picks: RulesetSymbolSpendPick[] = [...bought].map(([spend, times]) => ({ spend, times }));
  return picks.sort(
    (a, b) => (combat.symbols?.spends ?? []).indexOf(a.spend) - (combat.symbols?.spends ?? []).indexOf(b.spend),
  );
}

/** What a side still holds of a throw's symbols once its own `chosen` spends are paid for. */
export function rulesetSymbolsLeft(
  symbols: Readonly<Record<string, number>>,
  chosen: readonly RulesetSymbolSpendPick[],
): Record<string, number> {
  const left: Record<string, number> = { ...symbols };
  for (const { spend, times } of chosen) left[spend.symbol] = (left[spend.symbol] ?? 0) - spend.cost * times;
  return left;
}

/** The spends somebody choosing for themselves (1.382) is held to: what they named, in the order
 *  they named it, each bought only as often as the symbols pay for it, its `max` allows and `budget`
 *  says it lands. Taken from `budget` as it goes, exactly as the Engine's own pick is. */
export function rulesetChosenSymbolSpends(
  combat: RulesetCombat,
  symbols: Readonly<Record<string, number>>,
  hit: boolean,
  by: RulesetSymbolSpend["by"],
  chosen: readonly RulesetSymbolSpendChoice[],
  budget: RulesetSymbolSpendBudget = RULESET_SYMBOL_SPEND_UNLIMITED,
): RulesetSymbolSpendPick[] {
  const left: Record<string, number> = { ...symbols };
  const bought = new Map<RulesetSymbolSpend, number>();
  for (const choice of chosen) {
    const spend = (combat.symbols?.spends ?? []).find((one) => one.id === choice.spend && one.by === by);
    if (!spend || (hit ? spend.when === "miss" : spend.when === "hit")) continue;
    const count = Math.min(
      Math.floor(choice.times),
      spend.max - (bought.get(spend) ?? 0),
      budget.copies(spend),
      Math.floor((left[spend.symbol] ?? 0) / spend.cost),
    );
    if (count <= 0) continue;
    budget.take(spend, count);
    bought.set(spend, (bought.get(spend) ?? 0) + count);
    left[spend.symbol] = (left[spend.symbol] ?? 0) - count * spend.cost;
  }
  return [...bought].map(([spend, times]) => ({ spend, times }));
}

/** The spends a side choosing for itself may buy one more of (1.382), after `chosen`: its own, for
 *  this outcome, paid for by what is left, under its `max`, and landing by `budget` as it stands once
 *  `chosen` has been taken from it. A spend worth nothing to the Engine may still be chosen. */
export function rulesetSymbolSpendChoices(
  combat: RulesetCombat,
  symbols: Readonly<Record<string, number>>,
  hit: boolean,
  by: RulesetSymbolSpend["by"],
  chosen: readonly RulesetSymbolSpendPick[],
  budget: RulesetSymbolSpendBudget = RULESET_SYMBOL_SPEND_UNLIMITED,
): RulesetSymbolSpend[] {
  const left = rulesetSymbolsLeft(symbols, chosen);
  const times = (spend: RulesetSymbolSpend) => chosen.find((pick) => pick.spend === spend)?.times ?? 0;
  return (combat.symbols?.spends ?? []).filter(
    (spend) =>
      spend.by === by &&
      (hit ? spend.when !== "miss" : spend.when !== "hit") &&
      (left[spend.symbol] ?? 0) >= spend.cost &&
      times(spend) < spend.max &&
      budget.copies(spend) > 0,
  );
}

/** The harm a hit's net successes add, as the ruleset counts them. */
export function rulesetSymbolSuccessHarm(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  successes: number,
): number {
  const damage = combat.symbols?.damage;
  if (!damage) return 0;
  const counted = damage.counts === "beyond" ? successes - rulesetSymbolNeeded(definition) : successes;
  return Math.max(0, counted) * damage.perSuccess;
}

/** What an attack is expected to do, exactly over every way its throw may come out: the chance it
 *  lands, the harm a hit does on average (its own average, what its successes and spends add, less
 *  soak, never below none), and what a hit is worth to the attacker with what either side's spends
 *  buy folded in, as harm. `worth` times the chance is the whole attack's worth, misses included. */
export function rulesetSymbolAttackForecast(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  dice: RulesetSymbolDice,
  /** The blow's own harm on a hit, on average. */
  base: number,
  soak: number,
  /** A fresh budget for each way the throw may come out: what this fight's spends can do. */
  budgetFor: () => RulesetSymbolSpendBudget = () => RULESET_SYMBOL_SPEND_UNLIMITED,
): { hitChance: number; averageDamage: number; worth: number } {
  const success = rulesetSymbolSuccess(definition);
  const needed = rulesetSymbolNeeded(definition);
  let hitChance = 0;
  let harm = 0;
  let worth = 0;
  for (const outcome of rulesetSymbolOutcomes(definition, dice)) {
    const successes = success === undefined ? 0 : (outcome.symbols[success] ?? 0);
    const hit = successes >= needed;
    // One budget for the throw, the attacker buying first, as the fight does.
    const budget = budgetFor();
    const mine = pickRulesetSymbolSpends(combat, outcome.symbols, hit, "attacker", budget);
    const theirs = pickRulesetSymbolSpends(combat, outcome.symbols, hit, "target", budget);
    const added = mine.reduce((sum, pick) => sum + (pick.spend.damage ?? 0) * pick.times, 0);
    const dealt = hit ? Math.max(0, base + rulesetSymbolSuccessHarm(definition, combat, successes) + added - soak) : 0;
    const other =
      mine.reduce(
        (sum, pick) => sum + (rulesetSymbolSpendWorth(pick.spend) - (pick.spend.damage ?? 0)) * pick.times,
        0,
      ) - theirs.reduce((sum, pick) => sum + rulesetSymbolSpendWorth(pick.spend) * pick.times, 0);
    if (hit) {
      hitChance += outcome.chance;
      harm += dealt * outcome.chance;
    }
    worth += (dealt + other) * outcome.chance;
  }
  return {
    hitChance,
    averageDamage: hitChance > 0 ? harm / hitChance : Math.max(0, base - soak),
    worth: hitChance > 0 ? worth / hitChance : 0,
  };
}
