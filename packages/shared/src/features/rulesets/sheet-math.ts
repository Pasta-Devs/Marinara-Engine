// Pure arithmetic over a ruleset definition and a stored character sheet. Shared so the server's
// check resolver, the GM prompt and the client's sheet editor all compute the same numbers.
//
// Nothing here throws. A sheet is read TOLERANTLY against the ruleset's current schema: a missing
// value takes the declared default, an unknown key is ignored, and a value that is not a finite
// number reads as its default. Definitions are assumed validated (`parseRulesetDefinition`), but a
// dangling reference still reads as 0 instead of failing a turn.

import {
  RULESET_POOL_MAX_DICE,
  rulesetSheetEnvelopeSchema,
  type RulesetDefinition,
  type RulesetDifficultyLadderStep,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
  type RulesetValueRef,
} from "../../schemas/ruleset.schema.js";

type StepTable = ReadonlyArray<readonly [number, number]>;
type Rounding = "down" | "up" | "nearest";

export function lookupStepTable(table: StepTable, input: number): number {
  let value = table[0]?.[1] ?? 0;
  for (const [threshold, entry] of table) {
    if (input < threshold) break;
    value = entry;
  }
  return value;
}

export function roundRulesetNumber(value: number, mode: Rounding): number {
  if (mode === "up") return Math.ceil(value);
  if (mode === "nearest") return Math.round(value);
  return Math.floor(value);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A complete, blank starting build: every ability, field and tier at its declared default. */
export function defaultRulesetSheetBuild(definition: RulesetDefinition): RulesetSheetBuild {
  const fields: RulesetSheetBuild["fields"] = {};
  for (const field of definition.sheet.fields) {
    if (field.default !== undefined) fields[field.id] = field.default;
    else if (field.type === "number") fields[field.id] = Math.min(Math.max(0, field.min), field.max);
    else if (field.type === "boolean") fields[field.id] = false;
    else if (field.type === "enum") fields[field.id] = field.values[0]!;
    else fields[field.id] = "";
  }
  return {
    abilities: Object.fromEntries(definition.sheet.abilities.map((ability) => [ability.id, ability.default])),
    skills: {},
    saves: {},
    bonuses: {},
    fields,
    lists: {},
  };
}

export function createRulesetSheetEnvelope(
  definition: RulesetDefinition,
  build: RulesetSheetBuild = defaultRulesetSheetBuild(definition),
): RulesetSheetEnvelope {
  return { v: definition.sheet.version, build };
}

/** The copy a new game takes of a starting build: the stored sheet when it reads as one, else a
 *  blank default, so every party member has a sheet from the first turn. Always a deep copy — a
 *  game edits its own sheet and nothing in a game writes back to the library. */
export function copyRulesetSheetForGame(definition: RulesetDefinition, stored: unknown): RulesetSheetEnvelope {
  const parsed = rulesetSheetEnvelopeSchema.safeParse(stored);
  if (!parsed.success) return createRulesetSheetEnvelope(definition);
  return { v: definition.sheet.version, build: structuredClone(parsed.data.build) };
}

export interface EvaluatedRulesetSheet {
  abilityScores: Record<string, number>;
  abilityMods: Record<string, number>;
  proficiencyBonus: number;
  /** Proficiency tier id per skill and per save, defaulted to the ruleset's first tier. */
  skillTiers: Record<string, string>;
  saveTiers: Record<string, string>;
  skillMods: Record<string, number>;
  saveMods: Record<string, number>;
  derived: Record<string, number>;
  /** Number fields as read (default applied), which value references resolve against. */
  numbers: Record<string, number>;
}

export function rulesetAbilityModifier(definition: RulesetDefinition, score: number): number {
  const op = definition.resolution.abilityModifier;
  if (op.op === "identity") return score;
  if (op.op === "stepTable") return lookupStepTable(op.table, score);
  return Math.floor((score - 10) / 2);
}

/** The tables one value reference reads. Handed in rather than closed over, so the same resolution
 *  serves the evaluation below — where `derived` is still filling up, top to bottom — and a caller
 *  resolving a reference against a finished sheet. */
interface RulesetValueRefTables {
  abilityScores: Record<string, number>;
  abilityMods: Record<string, number>;
  numbers: Record<string, number>;
  derived: Record<string, number>;
  skillMod: (id: string) => number;
  saveMod: (id: string) => number;
}

function resolveValueRef(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RulesetValueRef,
  tables: RulesetValueRefTables,
): number {
  if (ref.const !== undefined) return ref.const;
  if (ref.field !== undefined) return tables.numbers[ref.field] ?? 0;
  if (ref.derived !== undefined) return tables.derived[ref.derived] ?? 0;
  if (ref.abilityScore !== undefined) return tables.abilityScores[ref.abilityScore] ?? 0;
  if (ref.abilityMod !== undefined) return tables.abilityMods[ref.abilityMod] ?? 0;
  if (ref.abilityModFromField !== undefined) {
    // An unset choice reads as the field's declared default, like every other field. So does a
    // stored choice the ruleset no longer offers, which is also what the sheet editor shows.
    const field = definition.sheet.fields.find((entry) => entry.id === ref.abilityModFromField);
    const stored = build.fields?.[ref.abilityModFromField];
    const offered = typeof stored === "string" && field?.type === "enum" && field.values.includes(stored);
    const chosen = offered ? stored : field?.default;
    return typeof chosen === "string" ? (tables.abilityMods[chosen] ?? 0) : 0;
  }
  if (ref.skillMod !== undefined) return tables.skillMod(ref.skillMod);
  if (ref.saveMod !== undefined) return tables.saveMod(ref.saveMod);
  return 0;
}

/** Every number the sheet yields, computed once, top to bottom. */
export function evaluateRulesetSheet(definition: RulesetDefinition, build: RulesetSheetBuild): EvaluatedRulesetSheet {
  const { sheet, resolution } = definition;
  const abilityScores: Record<string, number> = {};
  const abilityMods: Record<string, number> = {};
  for (const ability of sheet.abilities) {
    const score = finite(build.abilities?.[ability.id]) ?? ability.default;
    abilityScores[ability.id] = score;
    abilityMods[ability.id] = rulesetAbilityModifier(definition, score);
  }

  const numbers: Record<string, number> = {};
  for (const field of sheet.fields) {
    if (field.type !== "number") continue;
    numbers[field.id] =
      finite(build.fields?.[field.id]) ?? field.default ?? Math.min(Math.max(0, field.min), field.max);
  }

  const derived: Record<string, number> = {};
  const skillMods: Record<string, number> = {};
  const saveMods: Record<string, number> = {};
  const tierById = new Map(resolution.proficiencyTiers.map((tier) => [tier.id, tier]));
  const firstTier = resolution.proficiencyTiers[0]!;

  // Validation guarantees the value feeding the proficiency bonus never reads a skill or save
  // modifier, so resolving it lazily, the first time a modifier is asked for, cannot recurse.
  let proficiencyBonus: number | null = null;
  const readProficiencyBonus = (): number => {
    if (proficiencyBonus === null) {
      proficiencyBonus = 0; // a malformed definition that does recurse reads 0 instead of overflowing
      proficiencyBonus = resolution.proficiency ? resolveRef(resolution.proficiency.bonus) : 0;
    }
    return proficiencyBonus;
  };
  const trainedModifier = (
    entry: { id: string; ability?: string },
    tiers: Record<string, string> | undefined,
  ): number => {
    const tier = tierById.get(tiers?.[entry.id] ?? "") ?? firstTier;
    const trained = roundRulesetNumber(tier.multiplier * readProficiencyBonus(), tier.round) + tier.flat;
    return (entry.ability ? (abilityMods[entry.ability] ?? 0) : 0) + trained + (finite(build.bonuses?.[entry.id]) ?? 0);
  };
  function resolveRef(ref: RulesetValueRef): number {
    return resolveValueRef(definition, build, ref, {
      abilityScores,
      abilityMods,
      numbers,
      derived,
      skillMod: (id) => {
        const skill = sheet.skills.find((entry) => entry.id === id);
        return skill ? trainedModifier(skill, build.skills) : 0;
      },
      saveMod: (id) => {
        const save = sheet.saves.find((entry) => entry.id === id);
        return save ? trainedModifier(save, build.saves) : 0;
      },
    });
  }

  for (const entry of sheet.derived) {
    if (entry.op === "sum") derived[entry.id] = entry.of.reduce((total, ref) => total + resolveRef(ref), 0);
    else if (entry.op === "stepTable") derived[entry.id] = lookupStepTable(entry.table, resolveRef(entry.from));
    else if (entry.op === "scale") {
      derived[entry.id] = roundRulesetNumber(resolveRef(entry.of) * entry.multiplier, entry.round);
    } else if (entry.op === "min") derived[entry.id] = Math.min(...entry.of.map(resolveRef));
    else derived[entry.id] = Math.max(...entry.of.map(resolveRef));
  }

  const skillTiers: Record<string, string> = {};
  const saveTiers: Record<string, string> = {};
  for (const skill of sheet.skills) {
    skillTiers[skill.id] = tierById.has(build.skills?.[skill.id] ?? "") ? build.skills[skill.id]! : firstTier.id;
    skillMods[skill.id] = trainedModifier(skill, build.skills);
  }
  for (const save of sheet.saves) {
    saveTiers[save.id] = tierById.has(build.saves?.[save.id] ?? "") ? build.saves[save.id]! : firstTier.id;
    saveMods[save.id] = trainedModifier(save, build.saves);
  }

  return {
    abilityScores,
    abilityMods,
    proficiencyBonus: readProficiencyBonus(),
    skillTiers,
    saveTiers,
    skillMods,
    saveMods,
    derived,
    numbers,
  };
}

/** One value reference resolved against a sheet, for a reader outside the evaluation — a live
 *  pool's maximum is the only one today. Takes an evaluation when the caller already has one, so
 *  resolving a party's worth of pool maximums evaluates each sheet once. */
export function resolveRulesetValueRef(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RulesetValueRef,
  evaluated: EvaluatedRulesetSheet = evaluateRulesetSheet(definition, build),
): number {
  return resolveValueRef(definition, build, ref, {
    abilityScores: evaluated.abilityScores,
    abilityMods: evaluated.abilityMods,
    numbers: evaluated.numbers,
    derived: evaluated.derived,
    skillMod: (id) => evaluated.skillMods[id] ?? 0,
    saveMod: (id) => evaluated.saveMods[id] ?? 0,
  });
}

/** Whether a field, derived value, list or pool is hidden by its `hideWhen`. */
export function isRulesetItemHidden(
  item: { hideWhen?: { field: string; equals: string | number | boolean } },
  build: RulesetSheetBuild,
  definition: RulesetDefinition,
): boolean {
  if (!item.hideWhen) return false;
  const field = definition.sheet.fields.find((entry) => entry.id === item.hideWhen!.field);
  const value = build.fields?.[item.hideWhen.field] ?? field?.default;
  return value === item.hideWhen.equals;
}

// ── Checks ──

/** A skill or save also carries the ability it normally rolls with, and the one a `with=` asked
 *  for instead, so the modifier can swap the first for the second without re-reading the sheet. */
interface RulesetTrainedCheckTarget {
  type: "skill" | "save";
  id: string;
  label: string;
  /** The entry's own ability, when it names one. */
  ability?: string;
  /** The ability the request named instead. Only ever an ability this sheet declares. */
  withAbility?: string;
}

/** A raw ability check. `withAbility` is the second ability a pool ruleset with
 *  `pool.abilityPlusAbility` adds to it, and is never set anywhere else. */
interface RulesetAbilityCheckTarget {
  type: "ability";
  id: string;
  label: string;
  withAbility?: string;
}

export type RulesetCheckTarget = RulesetTrainedCheckTarget | RulesetAbilityCheckTarget;

function normalizeCheckName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The spellings one sheet entry answers to: its id, its label and its short form. */
function checkNames(entry: { id: string; label: string; short?: string }): string[] {
  return [
    normalizeCheckName(entry.id),
    normalizeCheckName(entry.label),
    entry.short ? normalizeCheckName(entry.short) : "",
  ].filter(Boolean);
}

/** The ability a name means in this ruleset, or null. Used for `with=`, which is a bare ability
 *  name rather than a check request. */
function matchAbilityId(definition: RulesetDefinition, requested: string): string | null {
  const name = normalizeCheckName(requested);
  if (!name) return null;
  const base = name.replace(/\s(?:ability check|check|saving throw|save)$/, "").trim();
  const ability = definition.sheet.abilities.find(
    (entry) => checkNames(entry).includes(name) || checkNames(entry).includes(base),
  );
  return ability?.id ?? null;
}

/** What a requested check name means in this ruleset: a skill, a save, or a raw ability check.
 *  Matches ids and labels, with "check", "save" and "saving throw" suffixes understood, so
 *  "Dexterity save", "dex_save" and "DEX saving throw" are one request. Null when the ruleset has
 *  no such thing; the caller then rolls unmodified dice rather than guessing an ability.
 *
 *  `withAbility` is the tag's `with=`: roll this skill or save with another ability than its own.
 *  A name no ability answers to is IGNORED rather than refused, so the entry keeps its own
 *  ability; the resolver notices the unset `withAbility` and says so in the log. On a raw ability
 *  check it names a SECOND ability to add, and only where a pool ruleset declares
 *  `pool.abilityPlusAbility`; anywhere else it means nothing there, because the check already
 *  names the ability it rolls. */
export function matchRulesetCheckTarget(
  definition: RulesetDefinition,
  requested: string,
  withAbility?: string,
): RulesetCheckTarget | null {
  const { sheet } = definition;
  const name = normalizeCheckName(requested);
  if (!name) return null;
  const saveWord = /\s(?:saving throw|save)$/.test(name);
  const base = name.replace(/\s(?:ability check|check|saving throw|save)$/, "").trim();
  const names = checkNames;
  const override = withAbility ? matchAbilityId(definition, withAbility) : null;
  const trained = (type: "skill" | "save", entry: { id: string; label: string; ability?: string }) => ({
    type,
    id: entry.id,
    label: entry.label,
    ...(entry.ability ? { ability: entry.ability } : {}),
    ...(override ? { withAbility: override } : {}),
  });

  const save = sheet.saves.find((entry) => names(entry).includes(name));
  if (save) return trained("save", save);
  if (saveWord) {
    // "<ability> save": the save that rolls with that ability, when exactly one does.
    const ability = sheet.abilities.find((entry) => names(entry).includes(base));
    const forAbility = ability ? sheet.saves.filter((entry) => entry.ability === ability.id) : [];
    if (forAbility.length === 1) return trained("save", forAbility[0]!);
    const byBase = sheet.saves.find((entry) => names(entry).includes(base));
    if (byBase) return trained("save", byBase);
    return null;
  }
  const skill = sheet.skills.find((entry) => names(entry).includes(name) || names(entry).includes(base));
  if (skill) return trained("skill", skill);
  const ability = sheet.abilities.find((entry) => names(entry).includes(base));
  if (!ability) return null;
  const resolution = definition.resolution;
  const pairs = resolution.kind === "dice-pool" && resolution.pool.abilityPlusAbility === true;
  return {
    type: "ability",
    id: ability.id,
    label: ability.label,
    ...(pairs && override ? { withAbility: override } : {}),
  };
}

export function rulesetCheckModifier(evaluated: EvaluatedRulesetSheet, target: RulesetCheckTarget | null): number {
  if (!target) return 0;
  if (target.type === "ability") {
    // Two abilities rolled together are simply both of them.
    const second = target.withAbility ? (evaluated.abilityMods[target.withAbility] ?? 0) : 0;
    return (evaluated.abilityMods[target.id] ?? 0) + second;
  }
  const own = target.type === "skill" ? evaluated.skillMods[target.id] : evaluated.saveMods[target.id];
  const base = own ?? 0;
  if (!target.withAbility) return base;
  // `with=`: the entry's own ability modifier steps aside for the named one. The training tier and
  // the sheet's own free bonus are untouched, which is what makes this one number, not a new check.
  const replaced = target.ability ? (evaluated.abilityMods[target.ability] ?? 0) : 0;
  return base - replaced + (evaluated.abilityMods[target.withAbility] ?? 0);
}

/** The abilities a check rolls with: a skill or save's own, or the one `with=` swapped in; an ability
 *  check's own, and the second one where a pool adds two together. */
function rollingAbilities(target: RulesetCheckTarget | null): string[] {
  if (!target) return [];
  if (target.type === "ability") return target.withAbility ? [target.id, target.withAbility] : [target.id];
  const ability = target.withAbility ?? target.ability;
  return ability ? [ability] : [];
}

/** What `resolution.adjust` adds to or takes off this check: every entry that applies to all checks,
 *  and every one limited to abilities the check rolls with. Whole numbers, rounded toward zero, so a
 *  half never turns into a die. A check the ruleset cannot name still takes the unlimited ones, the
 *  way it still takes a wound penalty. */
export function rulesetCheckAdjust(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  target: RulesetCheckTarget | null,
): number {
  const entries = definition.resolution.adjust ?? [];
  if (entries.length === 0) return 0;
  const rolling = rollingAbilities(target);
  let total = 0;
  for (const entry of entries) {
    if (entry.abilities && !entry.abilities.some((id) => rolling.includes(id))) continue;
    total += resolveRulesetValueRef(definition, build, entry.value, evaluated);
  }
  return Math.trunc(total);
}

/** One check number, spelled the way its kind means it: a modifier added to the dice, or how many
 *  dice there are. Everywhere a check value is shown to a player or written into a prompt. */
export function formatRulesetCheckValue(definition: RulesetDefinition, value: number): string {
  if (definition.resolution.kind === "dice-pool") return `${value} ${value === 1 ? "die" : "dice"}`;
  return value >= 0 ? `+${value}` : `${value}`;
}

export interface RulesetCheckRoll {
  /** Every die thrown, in order: one set normally, two sets under advantage or disadvantage. */
  rolls: number[];
  /** Sum of the set that was kept. */
  usedRoll: number;
  total: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
  rollMode: "advantage" | "disadvantage" | "normal";
  /** Notation for the dice actually thrown. */
  dice: string;
}

/** A check that threw nothing at all: the shape every "no roll happened" answer takes, so no path
 *  ever has to invent a die to have something to return. Built fresh each time, because a caller
 *  spreads it into a result it then owns. */
function noRoll(): RulesetCheckRoll {
  return {
    rolls: [],
    usedRoll: 0,
    total: 0,
    success: false,
    criticalSuccess: false,
    criticalFailure: false,
    rollMode: "normal",
    dice: "",
  };
}

/** Roll a `dice-sum` check. Advantage and disadvantage cancel, and are ignored entirely when the
 *  ruleset does not allow them. `preRolled` stands in for the dice when the player rolled first;
 *  it is honoured only for a single-die ruleset and only within the die's faces.
 *
 *  A ruleset of another kind has no dice to sum, so it comes back as a failure with no roll rather
 *  than borrowing a die this system does not have. Callers dispatch on `resolution.kind`. */
export function rollDiceSumCheck(
  definition: RulesetDefinition,
  input: {
    modifier: number;
    dc: number;
    isSave: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
    preRolled?: number;
  },
  rollDie: (sides: number) => number,
): RulesetCheckRoll {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-sum") return noRoll();
  const { dice, naturals, advantage: allowsAdvantage } = resolution;
  const single = dice.count === 1;
  const preRolled =
    single && Number.isInteger(input.preRolled) && input.preRolled! >= 1 && input.preRolled! <= dice.sides
      ? input.preRolled!
      : null;
  const useAdvantage = preRolled === null && allowsAdvantage && !!input.advantage && !input.disadvantage;
  const useDisadvantage = preRolled === null && allowsAdvantage && !!input.disadvantage && !input.advantage;

  const rollSet = () => Array.from({ length: dice.count }, () => rollDie(dice.sides));
  const sum = (set: number[]) => set.reduce((total, value) => total + value, 0);
  const first = preRolled === null ? rollSet() : [preRolled];
  const second = useAdvantage || useDisadvantage ? rollSet() : null;
  const usedRoll = second
    ? useAdvantage
      ? Math.max(sum(first), sum(second))
      : Math.min(sum(first), sum(second))
    : sum(first);
  const rolls = second ? [...first, ...second] : first;

  const policy = input.isSave ? naturals.save : naturals.check;
  const criticalSuccess = single && usedRoll === dice.sides && (policy === "both" || policy === "max-only");
  const criticalFailure = single && usedRoll === 1 && (policy === "both" || policy === "min-only");
  const total = usedRoll + input.modifier;

  return {
    rolls,
    usedRoll,
    total,
    success: criticalSuccess ? true : criticalFailure ? false : total >= input.dc,
    criticalSuccess,
    criticalFailure,
    rollMode: useAdvantage ? "advantage" : useDisadvantage ? "disadvantage" : "normal",
    dice: `${rolls.length}d${dice.sides}`,
  };
}

export interface RulesetPoolRoll extends RulesetCheckRoll {
  /** The per-die target the successes were counted with, so a reader can mark the dice that
   *  counted. It is the ruleset's default unless the request moved it inside the declared range. */
  threshold: number;
  /** The situational dice the roll actually added or took: the request's `bonus=` clamped into the
   *  ruleset's range, and 0 where the ruleset declares none. A record is written from this, never
   *  from what the tag asked for. */
  bonusDice: number;
  /** Successes a purchase added after the dice were counted, and 0 where nothing was bought. They
   *  are in `total` already; this is what lets a record say how many of them nobody rolled. */
  autoSuccesses: number;
  /** How many dice a bought re-throw actually replaced, so a record can say the pool was re-thrown
   *  rather than leaving a reader to wonder why the faces beat the odds. */
  rerolled: number;
  /** The faces this roll exploded and doubled from, after the ruleset's limits, or undefined where
   *  the rule was not in play. A reader compares them with the file's own `from` to say whether the
   *  check moved them. */
  explodeFrom?: number;
  doubleFrom?: number;
  /** Something went wrong on the side of a roll that did not botch outright: `botch.rule` is
   *  `halfOrMore` and low faces showed on half the dice or more, but a die still succeeded. */
  complication: boolean;
}

/** The hard ceiling on how many dice ONE check may throw again, whatever a ruleset asks for. An
 *  Engine bound rather than an author's choice: an `until` re-throw is a loop, and a loop inside a
 *  turn needs an end that does not depend on the file. */
export const RULESET_POOL_MAX_REROLLS = 100;

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Roll a `dice-pool` check: throw the sheet's own number of dice and count the ones that reach
 *  the target. `total` and `usedRoll` are both the NET successes, so a reader that knows nothing
 *  about pools still shows the number the outcome turned on.
 *
 *  Never throws, and never rolls a die this ruleset did not declare. `threshold` and `bonusDice`
 *  are the Game Master's two per-check freedoms and are clamped into what the ruleset allows
 *  rather than refused, because a check the model asked for slightly wrong is still a check.
 *  A ruleset of another kind comes back as a failure with no roll. */
export function rollDicePoolCheck(
  definition: RulesetDefinition,
  input: {
    /** The sheet's number for this check, which here is how many dice to throw. */
    modifier: number;
    /** How many successes the check needs. */
    required: number;
    /** Taken so the two rollers answer the same question. No pool rule reads it today. */
    isSave: boolean;
    /** `threshold=`, honoured only where the ruleset lets the target move. */
    threshold?: number;
    /** `bonus=`, honoured only where the ruleset declares situational dice. */
    bonusDice?: number;
    /** `explode=` and `double=`, honoured only where the ruleset gives that rule a `min`. */
    explode?: number;
    double?: number;
    /** What a purchase bought for this one check, already validated and paid for by the caller:
     *  dice thrown on top of the pool, successes added after the dice are counted, a per-die target
     *  for this one roll, and a re-throw of the low faces. The roller never decides whether a spend
     *  was allowed; it only applies what it is handed. */
    bought?: {
      dice?: number;
      successes?: number;
      threshold?: number;
      reroll?: { upTo: number; mode: "once" | "until" };
      explode?: number;
      double?: number;
    };
  },
  rollDie: (sides: number) => number,
): RulesetPoolRoll {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-pool") {
    return { ...noRoll(), threshold: 0, bonusDice: 0, autoSuccesses: 0, rerolled: 0, complication: false };
  }
  const { die, pool, target, double, explode, cancel, botch, exceptional, situationalDice } = resolution;

  // A bought threshold is the entry's own and outranks the Game Master's `threshold=`, because the
  // player paid for it. Both are clamped into what the ruleset allows, and a ruleset whose target
  // cannot move ignores both.
  const asked = Number.isFinite(input.bought?.threshold) ? input.bought!.threshold! : input.threshold;
  const threshold =
    target.min < target.max && Number.isFinite(asked) ? clampInteger(asked!, target.min, target.max) : target.default;
  const bonusDice =
    situationalDice && Number.isFinite(input.bonusDice)
      ? clampInteger(input.bonusDice!, situationalDice.min, situationalDice.max)
      : 0;
  // The face each moving rule fires on for this one roll: what an entry bought, else what the Game
  // Master asked for, pulled into the range the ruleset gives it, and the file's own `from` when
  // nobody asked or the ruleset lets no check move it. Undefined is a rule that does not fire.
  const faceFor = (rule: typeof explode, bought: number | undefined, asked: number | undefined) => {
    if (!rule) return undefined;
    const wanted = Number.isFinite(bought) ? bought : asked;
    return rule.min !== undefined && Number.isFinite(wanted) ? clampInteger(wanted!, rule.min, die.sides) : rule.from;
  };
  const explodeFrom = faceFor(explode, input.bought?.explode, input.explode);
  const doubleFrom = faceFor(double, input.bought?.double, input.double);

  // Bought dice go in with the sheet's own and the situational ones, so the pool's declared range
  // is the one ceiling: buying dice can never throw more than the ruleset allows a pool to be.
  const boughtDice = Math.max(0, Math.floor(input.bought?.dice ?? 0));
  const count = clampInteger(
    (Number.isFinite(input.modifier) ? input.modifier : 0) + bonusDice + boughtDice,
    pool.min,
    pool.max,
  );
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(die.sides));

  // A re-throw of the low faces, bought by the character and applied BEFORE anything else reads the
  // pool, so a rerolled die can still explode, still count and still cancel. `once` replaces each
  // qualifying die one time and the new face stands whatever it is; `until` keeps going, bounded by
  // an Engine ceiling on the whole pool so a ruleset whose `upTo` is near the top face cannot roll
  // for the rest of the turn.
  let rerolled = 0;
  const reroll = input.bought?.reroll;
  if (reroll && reroll.upTo >= 1 && reroll.upTo < die.sides) {
    for (let i = 0; i < rolls.length && rerolled < RULESET_POOL_MAX_REROLLS; i++) {
      if (rolls[i]! > reroll.upTo) continue;
      rolls[i] = rollDie(die.sides);
      rerolled += 1;
      if (reroll.mode !== "until") continue;
      while (rolls[i]! <= reroll.upTo && rerolled < RULESET_POOL_MAX_REROLLS) {
        rolls[i] = rollDie(die.sides);
        rerolled += 1;
      }
    }
  }

  // The dice first thrown, re-throws included and explosions not yet added: what "half the dice" of a
  // botch is counted over.
  const thrown = rolls.slice();
  if (explodeFrom !== undefined) {
    // Chained, by walking the array as it grows: a die added at the end is itself examined. The
    // extra dice are capped so a low `from` on a big pool cannot roll for the rest of the turn.
    const cap = Math.min(pool.max, RULESET_POOL_MAX_DICE);
    let extra = 0;
    for (let i = 0; i < rolls.length && extra < cap; i++) {
      if (rolls[i]! >= explodeFrom) {
        rolls.push(rollDie(die.sides));
        extra += 1;
      }
    }
  }

  let successes = 0;
  let cancelled = 0;
  for (const roll of rolls) {
    if (roll >= threshold) successes += doubleFrom !== undefined && roll >= doubleFrom ? 2 : 1;
    if (cancel && roll <= cancel.upTo) cancelled += 1;
  }
  // Bought successes are added after the dice are counted and after cancelling, because they were
  // never rolled: a die that cancels a success cannot cancel one nobody threw.
  const autoSuccesses = Math.max(0, Math.floor(input.bought?.successes ?? 0));
  const total = Math.max(0, successes - cancelled) + autoSuccesses;
  // A botch is "nothing worked AND something went wrong", read BEFORE cancelling: a pool whose one
  // success was cancelled away failed, it did not botch. A bought success is not a die that worked,
  // so it does not take a botch away either; it is added to a total that is already 0.
  //
  // `halfOrMore` reads it the other way round: low faces on at least half the dice first thrown are
  // the thing going wrong, and it is a critical failure only when no die succeeded as well. On a
  // roll a die DID succeed on, the result stands as it is and the roll says it went wrong on the side.
  const lowOnHalf =
    botch?.rule === "halfOrMore" &&
    thrown.length > 0 &&
    thrown.filter((roll) => roll <= botch.upTo).length >= Math.ceil(thrown.length / 2);
  const criticalFailure = !botch
    ? false
    : botch.rule === "halfOrMore"
      ? lowOnHalf && successes === 0
      : successes === 0 && rolls.some((roll) => roll <= botch.upTo);
  const complication = lowOnHalf && !criticalFailure;
  const success = !criticalFailure && total >= input.required;
  return {
    rolls,
    usedRoll: total,
    total,
    success,
    criticalSuccess: success && !!exceptional && total >= exceptional.successes,
    criticalFailure,
    rollMode: "normal",
    dice: `${rolls.length}d${die.sides}`,
    threshold,
    bonusDice,
    autoSuccesses,
    rerolled,
    ...(explodeFrom !== undefined ? { explodeFrom } : {}),
    ...(doubleFrom !== undefined ? { doubleFrom } : {}),
    complication,
  };
}

/** The difficulty ladder step a name picks, or null. Matched without case or punctuation, and only
 *  when exactly one step answers to it, so a name two steps share picks neither of them. */
export function rulesetDifficultyStep(
  definition: RulesetDefinition,
  name: string | undefined,
): RulesetDifficultyLadderStep | null {
  const wanted = normalizeCheckName(name ?? "");
  if (!wanted) return null;
  const steps: RulesetDifficultyLadderStep[] = definition.resolution.difficultyLadder;
  const found = steps.filter((step) => normalizeCheckName(step.label) === wanted);
  return found.length === 1 ? found[0]! : null;
}

/** What a step asks for, in its kind's own terms: successes on a pool, a difficulty on a sum. */
export function rulesetDifficultyStepDc(step: RulesetDifficultyLadderStep): number {
  return "successes" in step ? step.successes : step.dc;
}

/** The per-die target of the one pool ladder step that needs exactly `successes`, or undefined: when
 *  no step or several need that many, when the one that does names no target, or on a summed ruleset.
 *  A ladder that prints "Plain work 1 success (target 6)" then means it at the table, and one whose
 *  steps all need one success says nothing about which of them a bare `dc="1"` meant. */
export function rulesetLadderTargetFor(definition: RulesetDefinition, successes: number): number | undefined {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-pool") return undefined;
  const found = resolution.difficultyLadder.filter((step) => step.successes === successes);
  return found.length === 1 ? found[0]!.target : undefined;
}
