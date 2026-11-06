// How much a fight may hold for the party that meets it (Capability API 1.803): each threat tier's
// `worth`, a budget per member by level and difficulty step, and how a crowd of opponents counts. The
// Game Master is told the budget, and the Engine brings invented opponents down a rung at a time while
// a fight is over it. A creature of a bestiary, or one that comes back, is counted and never changed.
import { GAME_DIFFICULTIES, type GameDifficulty } from "../combat-conditions.js";
import type {
  RulesetCatalogEntriesById,
  RulesetCatalogEntry,
  RulesetDefinition,
} from "../../schemas/ruleset.schema.js";
import { findRulesetCreature, rulesetSaidCreatureType } from "./creatures.js";

type Budget = NonNullable<NonNullable<NonNullable<RulesetDefinition["combat"]>["threat"]>["budget"]>;

/** A party member's level as the budget reads it: the sum of its `level` fields on the sheet. */
export function rulesetBudgetLevel(budget: Budget, fields: Record<string, unknown> | undefined) {
  return budget.level.reduce((sum, field) => {
    const value = Number(fields?.[field]);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
}

export interface RulesetEncounterBudget {
  /** The step this game's difficulty plays at, and what the party may meet at it. */
  step: { id: string; label: string };
  worth: number;
  /** What a fight with a boss in it may be worth: the next step up, or this one at the top. */
  bossWorth: number;
  /** That step, which a fight with a boss is said to be weighed at (cloud re-test 2026-10-25: "Moderate
   *  budget of 4400", 4400 being High). */
  bossStep: { id: string; label: string };
  members: number;
  levels: number[];
}

/** What a fight may be worth for a party of these levels at this game difficulty. Null when the
 *  ruleset has no budget, or nobody in the party has a level to read. */
export function rulesetEncounterBudget(
  definition: RulesetDefinition,
  levels: readonly number[],
  difficulty: GameDifficulty,
): RulesetEncounterBudget | null {
  const budget = definition.combat?.threat?.budget;
  const counted = levels.filter((level) => level > 0);
  if (!budget || counted.length === 0) return null;
  const said = budget.forGame?.[difficulty];
  const at = said
    ? budget.steps.findIndex((step) => step.id === said)
    : Math.min(GAME_DIFFICULTIES.indexOf(difficulty), budget.steps.length - 1);
  const index = at < 0 ? 0 : at;
  const row = (level: number) =>
    budget.byLevel.reduce((best, one) => (one.level <= level ? one : best), budget.byLevel[0]!);
  const sum = (step: number) => counted.reduce((total, level) => total + (row(level).worth[step] ?? 0), 0);
  return {
    step: { id: budget.steps[index]!.id, label: budget.steps[index]!.label },
    worth: sum(index),
    bossWorth: sum(Math.min(index + 1, budget.steps.length - 1)),
    bossStep: {
      id: budget.steps[Math.min(index + 1, budget.steps.length - 1)]!.id,
      label: budget.steps[Math.min(index + 1, budget.steps.length - 1)]!.label,
    },
    members: counted.length,
    levels: counted,
  };
}

/** How many times its opponents' worth a fight counts for: the `crowd` row its number of opponents
 *  reaches, a row up for a party smaller than `smallParty` and a row down for one larger than
 *  `largeParty`. 1 with no `crowd`. */
export function rulesetCrowdTimes(definition: RulesetDefinition, opponents: number, members: number) {
  const budget = definition.combat?.threat?.budget;
  const crowd = budget?.crowd;
  if (!crowd || opponents <= 0) return 1;
  let index = -1;
  crowd.forEach((row, at) => {
    if (row.from <= opponents) index = at;
  });
  if (index < 0) return 1;
  if (budget.smallParty !== undefined && members < budget.smallParty) index = Math.min(crowd.length - 1, index + 1);
  if (budget.largeParty !== undefined && members > budget.largeParty) index = Math.max(0, index - 1);
  return crowd[index]!.times;
}

/** What opponents of these tiers are worth together, crowd counted. A tier this ruleset does not have,
 *  or one with no `worth`, counts nothing. `times`, by place, counts one for more than its tier: an
 *  invented boss's legendary points. */
export function rulesetFightWorth(
  definition: RulesetDefinition,
  tiers: ReadonlyArray<string | undefined>,
  members: number,
  times?: ReadonlyArray<number | undefined>,
) {
  const scale = definition.combat?.threat?.tiers ?? [];
  const base = tiers.reduce(
    (sum, id, index) => sum + (scale.find((tier) => tier.id === id)?.worth ?? 0) * (times?.[index] ?? 1),
    0,
  );
  return Math.round(base * rulesetCrowdTimes(definition, tiers.length, members));
}

/**
 * The tiers a fight's opponents are brought to so the fight is worth no more than `allowed`: the one
 * that may move and is worth the most goes a rung down, and again, until it fits or none can move.
 * One `kept` (a bestiary creature, one that comes back) is counted and never moved; nothing goes
 * below the lowest rung. The tiers come back as they were when the fight already fits.
 */
export function rulesetBudgetedTiers(
  definition: RulesetDefinition,
  foes: ReadonlyArray<{ tier: string | undefined; kept: boolean; times?: number }>,
  allowed: number,
  members: number,
): { tiers: Array<string | undefined>; worth: { before: number; after: number } } {
  const scale = definition.combat?.threat?.tiers ?? [];
  const tiers = foes.map((foe) => foe.tier);
  const times = foes.map((foe) => foe.times);
  const before = rulesetFightWorth(definition, tiers, members, times);
  let after = before;
  const rung = (id: string | undefined) => scale.findIndex((tier) => tier.id === id);
  while (after > allowed) {
    let pick = -1;
    foes.forEach((foe, index) => {
      const at = rung(tiers[index]);
      if (foe.kept || at <= 0) return;
      if (
        pick < 0 ||
        (scale[at]!.worth ?? 0) * (foe.times ?? 1) > (scale[rung(tiers[pick])]!.worth ?? 0) * (foes[pick]!.times ?? 1)
      )
        pick = index;
    });
    if (pick < 0) break;
    tiers[pick] = scale[rung(tiers[pick]) - 1]!.id;
    after = rulesetFightWorth(definition, tiers, members, times);
  }
  return { tiers, worth: { before, after } };
}

/**
 * A bestiary creature far beyond the party, the fight it is in worth more than the party's budget with
 * it alone, gives way to lesser creatures of its own kind that fit (Alyssa 2026-10-26: a CR 21 lich for
 * a level 4 party sends its servants, and it stays out of the fight for the story to keep). The ones
 * that fit best are the most worth together, at most four of one kind; nothing of its kind that fits,
 * and it comes as it is. Each one swapped is said, for the Game Master. `kept` (one that comes back) is
 * never swapped.
 */
export function rulesetBudgetStandIns<
  T extends { id: string; name: string; creature?: string; tier?: string; boss?: unknown; creatureType?: string },
>(
  definition: RulesetDefinition,
  bestiary: RulesetCatalogEntriesById,
  enemies: readonly T[],
  budget: RulesetEncounterBudget,
  kept: ReadonlySet<string> = new Set(),
): {
  enemies: Array<T | (Omit<T, "creature" | "tier" | "boss"> & { creature: string; boss?: T["boss"] })>;
  lines: string[];
} {
  const scale = definition.combat?.threat?.tiers ?? [];
  const worthOf = (id: string | undefined) => scale.find((tier) => tier.id === id)?.worth ?? 0;
  const found = enemies.map((enemy) =>
    enemy.creature
      ? (findRulesetCreature(bestiary, enemy.creature) ?? findRulesetCreature(bestiary, enemy.name))
      : findRulesetCreature(bestiary, enemy.name),
  );
  const tierOf = (index: number) => found[index]?.entry.creature?.tier ?? enemies[index]!.tier;
  const lines: string[] = [];
  const out: Array<T | (Omit<T, "creature" | "tier" | "boss"> & { creature: string; boss?: T["boss"] })> = [];
  // The tier of each one out so far, so each group is weighed beside what already came in its place.
  const outTiers: Array<string | undefined> = [];
  const handled = new Set<number>();
  // How many of each stand-in's name have come, so a second group of one kind never repeats a name.
  const named = new Map<string, number>();
  const keepAs = (index: number) => {
    out.push(enemies[index]!);
    outTiers.push(tierOf(index));
  };
  enemies.forEach((enemy, index) => {
    if (handled.has(index)) return;
    const own = found[index];
    const creature = own?.entry.creature;
    if (!own || !creature || kept.has(enemy.id)) {
      handled.add(index);
      keepAs(index);
      return;
    }
    // Every one of the same kind is one group, swapped once (laptop handoff 2026-10-30: three Knights
    // each swapped on their own, beside the other two as they were, made six Battle Priests).
    const group = enemies.flatMap((other, at) =>
      at >= index && !handled.has(at) && !kept.has(other.id) && found[at]?.entry === own.entry ? [at] : [],
    );
    for (const at of group) handled.add(at);
    const others = [...outTiers, ...enemies.flatMap((_, at) => (handled.has(at) || at <= index ? [] : [tierOf(at)]))];
    // A boss fight, this one the boss or another, is held to the boss budget (cloud re-test SB1).
    const bossed = enemies.some((one) => !!one.boss);
    const allowed = bossed ? budget.bossWorth : budget.worth;
    const step = (bossed ? budget.bossStep : budget.step).label;
    const alone = rulesetFightWorth(definition, [...others, ...group.map(() => creature.tier)], budget.members);
    if (alone <= Math.max(allowed, budget.bossWorth)) {
      for (const at of group) keepAs(at);
      return;
    }
    // Nearest kin first: the words its name shares with the other's, the rarer in the bestiary the
    // nearer (cloud re-test 2026-10-26: a Young Red Dragon's place went to a Young Black Dragon, not a
    // red wyrmling), then the most worth that fits.
    const words = (label: string) =>
      new Set(
        label
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean),
      );
    const seen = new Map<string, number>();
    for (const entries of Object.values(bestiary))
      for (const entry of entries)
        if (entry.creature) for (const word of words(entry.label)) seen.set(word, (seen.get(word) ?? 0) + 1);
    const ownWords = words(own.entry.label);
    // Of the kind its writer said it is, where the creature only stands in for it (laptop 2026-10-26).
    const kind = rulesetSaidCreatureType(definition, enemy.creatureType) ?? creature.type;
    const nearness = (label: string) =>
      [...words(label)].reduce((sum, word) => sum + (ownWords.has(word) ? 1 / (seen.get(word) ?? 1) : 0), 0);
    let best: { catalogId: string; entry: RulesetCatalogEntry; count: number; worth: number; near: number } | undefined;
    for (const [catalogId, entries] of Object.entries(bestiary))
      for (const entry of entries) {
        const kin = entry.creature;
        if (!kin || entry === own.entry || worthOf(kin.tier) <= 0) continue;
        if (kind === undefined || kin.type !== kind) continue;
        for (let count = 4; count >= 1; count--) {
          const worth = rulesetFightWorth(
            definition,
            [...others, ...Array.from({ length: count }, () => kin.tier)],
            budget.members,
          );
          if (worth > allowed) continue;
          const total = count * worthOf(kin.tier);
          const near = nearness(entry.label);
          const bestTotal = best ? best.count * worthOf(best.entry.creature!.tier) : 0;
          if (
            !best ||
            near > best.near ||
            (near === best.near && (total > bestTotal || (total === bestTotal && entry.label < best.entry.label)))
          )
            best = { catalogId, entry, count, worth, near };
          break;
        }
      }
    if (!best) {
      for (const at of group) keepAs(at);
      return;
    }
    const lead = group.map((at) => enemies[at]!).find((one) => !!one.boss) ?? enemy;
    const { creature: _creature, tier: _tier, boss: _boss, ...rest } = lead;
    // What its writer gave the one it stands in for is that one's, not the stand-in's (laptop handoff
    // 2026-10-30: two Battle Priests came in for Knights and were saved with the Knights' Greatsword and
    // Heavy Crossbow): its skills, its stat block, its strikes, its points and what it carried.
    const unit = { ...rest };
    for (const key of ["skills", "proposed", "attacks", "points", "adjust", "spellSlots", "carrying"])
      delete (unit as Record<string, unknown>)[key];
    const label = best.entry.label;
    for (let at = 0; at < best.count; at++) {
      const n = (named.get(label) ?? 0) + 1;
      named.set(label, n);
      out.push({
        ...unit,
        // Each takes the id of one it stands in for while there are, then the lead's numbered.
        id: at < group.length ? enemies[group[at]!]!.id : `${lead.id}-${at + 1}`,
        name: best.count === 1 && n === 1 ? label : `${label} ${n}`,
        creature: `${best.catalogId}/${best.entry.id}`,
        // The first that comes in a boss's place is the fight's boss in its stead (cloud re-test SB2),
        // with the boss's own mark: nobody else carries one at all, not even a false one (laptop v3b
        // 2026-10-26: `boss: false` broke the saved fight).
        ...(at === 0 && lead.boss ? { boss: lead.boss } : {}),
      });
      outTiers.push(best.entry.creature!.tier);
    }
    const many = (count: number, what: string) => (count === 1 ? what : `${count} ${what}`);
    lines.push(
      `${many(group.length, own.entry.label)} ${group.length === 1 ? "is" : "are"} far beyond this party (worth ${alone}, against its ${step} budget of ${allowed}), so lesser ones of ${group.length === 1 ? "its" : "their"} kind come instead: ${many(best.count, label)}. ${group.length === 1 ? `${enemy.name} stays` : `${group.map((at) => enemies[at]!.name).join(", ")} stay`} out of this fight, for the story to keep.`,
    );
  });
  return { enemies: out, lines };
}
