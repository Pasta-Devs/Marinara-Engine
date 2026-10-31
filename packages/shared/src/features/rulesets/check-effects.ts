// ──────────────────────────────────────────────
// Game Mode rulesets: what changes a check outside a fight
//
// A character's active conditions, the levels their tracks have reached, and what their items do while
// worn or while only carried, read for one check or save. Each says it in the condition vocabulary:
// advantage or disadvantage, numbers added or taken, saves failed without a roll, narrowed to some
// skills or saves. The check resolver rolls what comes out of here; a fight reads its own conditions.
// ──────────────────────────────────────────────
import type {
  RulesetConditionImmunityFrom,
  RulesetCatalogEntriesById,
  RulesetCheckFloor,
  RulesetContextualCheck,
  RulesetContextualCost,
  RulesetCombatCondition,
  RulesetConditionJumps,
  RulesetCreatureHideEntry,
  RulesetDefinition,
  RulesetItemUse,
  RulesetKeptOn,
  RulesetSheetBuild,
  RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import { parseRulesetCombatDice } from "../ruleset-combat/dice.js";
import { evaluateRulesetSheetLive, readRulesetLive, rulesetEntryNamed } from "./live-state.js";
import {
  resolveRulesetValueRef,
  rulesetHeldItemDoes,
  rulesetCheckAdjust,
  rulesetCheckModifier,
  type EvaluatedRulesetSheet,
  type RulesetCheckTarget,
  type RulesetSheetItem,
} from "./sheet-math.js";

type RulesetEffectModifier = NonNullable<RulesetCombatCondition["modifiers"]>[number];

/** What a save is rolled against (1.134). Missing context matches no narrowed modifier. */
export interface RulesetSaveAgainst {
  conditions?: readonly string[];
  damage?: readonly string[];
  magic?: boolean;
  /** What the creature the save is against is (1.185): its type and tags. */
  from?: { type?: string; tags: readonly string[] };
  /** What the action the save is against is known by (1.191): its id, its name and its shared
   *  recharge group. */
  action?: readonly string[];
  /** The catalog the entry it is against came from, or the one an item's use casts from (1.265). */
  catalog?: string;
  /** Aimed at the saver alone, not an area (1.523). */
  alone?: boolean;
  /** What its save says it is (1.652): a gas. */
  qualities?: readonly string[];
  /** The declared filters of the entry it is against (1.787), for a rescue's `against.where`. */
  filters?: Record<string, unknown>;
}

/** Any one match is enough; the save's own name is checked separately. */
export function rulesetSaveAgainstMatches(
  against: RulesetEffectModifier["against"],
  source?: RulesetSaveAgainst,
): boolean {
  if (!against) return true;
  if (!source) return false;
  // Named actions narrow everything else it says (1.191): one of them, and then the rest as usual.
  if (against.actions) {
    const known = (source.action ?? []).map((name) => name.trim().toLowerCase());
    if (!against.actions.some((name) => known.includes(name.trim().toLowerCase()))) return false;
  }
  // As do the catalogs it is cast from (1.265): a spell, and then whoever cast it.
  if (against.casts && !(source.catalog !== undefined && against.casts.includes(source.catalog))) return false;
  // And aimed at its holder alone (1.523): a Ring of Spell Turning.
  if (against.alone && !source.alone) return false;
  if (
    (against.actions || against.casts || against.alone) &&
    !against.conditions &&
    !against.damage &&
    !against.magic &&
    !against.from &&
    !against.qualities
  ) {
    return true;
  }
  return !!(
    against.conditions?.some((condition) => source.conditions?.includes(condition)) ||
    against.damage?.some((type) =>
      source.damage?.some((one) => one.trim().toLowerCase() === type.trim().toLowerCase()),
    ) ||
    (against.magic && source.magic) ||
    against.qualities?.some((quality) => source.qualities?.includes(quality)) ||
    (against.from &&
      source.from &&
      ((source.from.type !== undefined && !!against.from.types?.includes(source.from.type)) ||
        source.from.tags.some((tag) => !!against.from?.tags?.includes(tag))))
  );
}

/** One thing that changes this character's checks: an active condition, a level their track has
 *  reached, or one item's worn or carried effect. `name` is what a record calls it. */
export interface RulesetCheckSource {
  name: string;
  effects?: readonly string[];
  modifiers?: readonly RulesetEffectModifier[];
  failsSaves?: readonly string[];
  saves?: readonly string[];
  skills?: readonly string[];
  /** What this source keeps off its holder in a fight (Capability API 1.132). A check reads none. */
  resist?: readonly RulesetCreatureHideEntry[];
  vulnerable?: readonly string[];
  immune?: readonly RulesetCreatureHideEntry[];
  conditionImmunities?: readonly string[];
  /** How far it lets its holder sense with each of the fight's senses (Capability API 1.180). */
  senses?: Readonly<Record<string, number | { add: number }>>;
  /** The light it sheds for its holder (Capability API 1.294). */
  light?: Readonly<{ bright: number; dim: number }>;
  /** How near it gives away whoever moves unseen (Capability API 1.319). */
  alerts?: number;
  /** Attacks at others near its holder are made at its holder instead (Capability API 1.658). */
  drawsAim?: Readonly<{ within: number; blow?: "melee" | "ranged"; weapon?: true }>;
  /** A fall does its holder no harm (Capability API 1.477 on an item; a condition's since 1.124). */
  fallsSafely?: true | Readonly<{ upTo: number; unless?: readonly string[] }>;
  /** Conditions on its holder it holds off, not ends (Capability API 1.477 on an item). */
  suppresses?: readonly string[];
  /** Hard going costs no more than plain ground (Capability API 1.489 on an item). */
  ignoresHardGround?: true;
  /** How much further its holder jumps (Capability API 1.513 on an item). */
  jumps?: Readonly<RulesetConditionJumps>;
  /** The conditions it keeps on its holder in a fight (Capability API 1.513 on an item). */
  keepsOn?: readonly string[];
  /** Conditions kept off by who or what would put them on (Capability API 1.486 on an item). */
  conditionImmunitiesFrom?: readonly RulesetConditionImmunityFrom[];
  /** What entries of these catalogs put on its holder does not lower their speed (Capability API 1.486). */
  speedKeptFrom?: Readonly<{ catalogs: readonly string[] }>;
  /** Conditions its holder may slip free of for some of their walk (Capability API 1.486). */
  slipsFree?: Readonly<{ conditions: readonly string[]; cost: number; unlessCatalogs?: readonly string[] }>;
  /** Held off while its holder has any of these, conditions or effects (Capability API 1.417). */
  notWhile?: readonly string[];
  /** A floor under its holder's checks (Capability API 1.418). */
  checkFloor?: RulesetCheckFloor;
}

/**
 * Everything that changes this character's checks outside a fight. A condition counts while it is
 * active on the sheet (a gate on who applied it has nobody to measure outside a fight, so it counts),
 * a level while the track or derived value it reads has reached it, an item's `worn` effect while it
 * is worn and its `carried` one while it is only carried, and a worn item's requirement's `otherwise`
 * while the wearer falls short of it. One item applies each of these once, however many stacks of it
 * there are. Derived values and requirements are read off the sheet worked out with the same live
 * state and items.
 */
export function rulesetCheckSources(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored?: unknown,
  items?: readonly RulesetSheetItem[],
): RulesetCheckSource[] {
  const sources: RulesetCheckSource[] = [];
  const combat = definition.combat;
  let evaluated: EvaluatedRulesetSheet | undefined;
  const sheet = () => (evaluated ??= evaluateRulesetSheetLive(definition, build, stored, items));
  if (combat?.conditions?.length || combat?.levels?.length) {
    const live = readRulesetLive(definition, build, stored);
    const active = new Map(live.conditions.filter((entry) => entry.active).map((entry) => [entry.id, entry.label]));
    for (const entry of combat.conditions ?? []) {
      const label = active.get(entry.condition);
      if (label !== undefined) sources.push({ ...entry, name: label });
    }
    // Levels of one value that each add the same weapon dice on a critical are one line, their dice
    // summed (ship readiness 2026-10-25: Brutal Critical read four "one more weapon die" lines).
    const folded = new Map<string, RulesetCheckSource>();
    for (const level of combat.levels ?? []) {
      const value =
        level.derived !== undefined
          ? (sheet().derived[level.derived] ?? 0)
          : (live.tracks.find((track) => track.id === level.track)?.value ?? 0);
      if (value < level.at) continue;
      const label =
        level.derived !== undefined
          ? (definition.sheet.derived.find((entry) => entry.id === level.derived)?.label ?? level.derived)
          : (definition.sheet.live.tracks.find((track) => track.id === level.track)?.label ?? level.track!);
      const { at: _at, ...rest } = level;
      const only = level.modifiers?.length === 1 ? level.modifiers[0]! : undefined;
      const plain = Object.entries(rest).every(
        ([key, one]) =>
          ["derived", "track", "modifiers"].includes(key) || (key === "effects" && Array.isArray(one) && !one.length),
      );
      if (only?.criticalDice && plain) {
        const { criticalDice, label: _said, ...kind } = only;
        const key = JSON.stringify([level.derived, level.track, kind]);
        const had = folded.get(key);
        const dice = (had?.modifiers?.[0]?.criticalDice ?? 0) + criticalDice;
        const source = { ...rest, name: label, modifiers: [{ ...kind, criticalDice: dice }] } as RulesetCheckSource;
        if (!had) sources.push(source);
        else sources[sources.indexOf(had)] = source;
        folded.set(key, source);
        continue;
      }
      // Levels that each add a plain number to the same rolls are one term, summed (laptop 0706 Party
      // B: "Back from the dead (penalty)" read as three -1s on one death save).
      const flats =
        plain &&
        !!level.modifiers?.length &&
        level.modifiers.every(
          (one) => typeof one.flat === "number" && Object.keys(one).every((key) => key === "to" || key === "flat"),
        );
      if (flats) {
        const key = JSON.stringify([level.derived, level.track, "flat", level.modifiers!.map((one) => one.to)]);
        const had = folded.get(key);
        const source = {
          ...rest,
          name: label,
          modifiers: level.modifiers!.map((one, index) => ({
            ...one,
            flat: (had?.modifiers?.[index]?.flat ?? 0) + one.flat!,
          })),
        } as RulesetCheckSource;
        if (!had) sources.push(source);
        else sources[sources.indexOf(had)] = source;
        folded.set(key, source);
        continue;
      }
      sources.push({ ...level, name: `${label} ${level.at}` });
    }
  }
  const all = [
    ...sources,
    ...rulesetItemSources(definition, build, items, sheet),
    ...rulesetSheetHideSources(definition, build),
  ];
  // Held off while its holder has something it names (1.417), as in a fight.
  if (!all.some((source) => source.notWhile)) return all;
  const live = readRulesetLive(definition, build, stored);
  const has = new Set<string>([
    ...live.conditions.filter((entry) => entry.active).map((entry) => entry.id),
    ...all.flatMap((source) => source.effects ?? []),
  ]);
  return all.filter((source) => !source.notWhile?.some((one) => has.has(one)));
}

/** A sheet row's typed hides (Capability API 1.132), read afresh so removing the row removes them.
 *  Unknown damage words and condition ids are ignored; a ruleset with no damage types allows words. */
export function rulesetSheetHideSources(definition: RulesetDefinition, build: RulesetSheetBuild): RulesetCheckSource[] {
  const sources: RulesetCheckSource[] = [];
  const types = definition.combat?.damageTypes?.map((type) => type.trim().toLowerCase());
  const conditions = definition.sheet.live.conditions.map((entry) => entry.id.toLowerCase());
  for (const source of definition.combat?.sheetHides ?? []) {
    const list = definition.sheet.lists.find((entry) => entry.id === source.list);
    const column = list?.columns.find((entry) => entry.id === source.column);
    for (const row of build.lists[source.list] ?? []) {
      const value = row[source.column] ?? column?.default;
      if (typeof value !== "string") continue;
      const hide: RulesetCheckSource = { name: list?.label ?? source.list };
      for (const word of value.split(",")) {
        // "fire except magical silvered": words, so a long run of spaces costs no regex backtracking.
        const words = word.trim().toLowerCase().split(/\s+/);
        const cuts = words.flatMap((one, at) => (one === "except" && at > 0 && at < words.length - 1 ? [at] : []));
        const cut = cuts[0] ?? words.length;
        const type = words.slice(0, cut).join(" ");
        const except = words.slice(cut + 1).filter((_, at) => !cuts.includes(at + cut + 1));
        if (!type) continue;
        if (source.kind === "conditionImmunities") {
          if (!conditions.includes(type) || except.length) continue;
          hide.conditionImmunities = [...(hide.conditionImmunities ?? []), type];
        } else {
          if (types && !types.includes(type)) continue;
          if (source.kind === "vulnerable") {
            if (!except.length) hide.vulnerable = [...(hide.vulnerable ?? []), type];
          } else {
            const entry = except.length ? { type, except } : type;
            hide[source.kind] = [...(hide[source.kind] ?? []), entry];
          }
        }
      }
      sources.push(hide);
    }
  }
  return sources;
}

/**
 * What a character's items do, each named for the stack: a worn item's `worn` effect and any other
 * item's `carried` one, and a worn item's requirement's `otherwise` while the wearer falls short of it.
 * One item applies each of these once, however many stacks of it there are. `sheet` is the sheet
 * worked out with the same live state and items, read only for a requirement. A check outside a fight
 * and a fight both read items through this.
 */
export function rulesetItemSources(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  items: readonly RulesetSheetItem[] | undefined,
  sheet: () => EvaluatedRulesetSheet,
): RulesetCheckSource[] {
  const sources: RulesetCheckSource[] = [];
  const seen = new Set<unknown>();
  // What an effect keeps on (1.513), and a line with a `when` only while it reads above zero (1.653).
  const asSource = (
    effect: Omit<RulesetCheckSource, "keepsOn" | "name"> & { keepsOn?: readonly RulesetKeptOn[] },
    name: string,
  ): RulesetCheckSource => {
    const { keepsOn: lines, ...rest } = effect;
    const keepsOn = lines?.flatMap((kept) =>
      typeof kept === "string"
        ? [kept]
        : resolveRulesetValueRef(definition, build, kept.when, sheet()) > 0
          ? [kept.condition]
          : [],
    );
    return { ...rest, name, ...(keepsOn ? { keepsOn } : {}) };
  };
  for (const held of items ?? []) {
    const name = held.name ?? held.item.category;
    // A fake does what it truly does (1.79), under the name it is shown by.
    const does = rulesetHeldItemDoes(held);
    const effect = held.worn ? does.worn : does.carried;
    // Worn by the mount its holder rides (1.717): nothing of it on them.
    if (effect && !seen.has(effect) && !effect.wornBy) {
      seen.add(effect);
      sources.push(asSource(effect, name));
    }
    // What the wearer falls short of, while it is worn.
    if (!held.worn || !does.requires || seen.has(does.requires)) continue;
    seen.add(does.requires);
    for (const requirement of does.requires) {
      if (resolveRulesetValueRef(definition, build, requirement.value, sheet()) >= requirement.atLeast) continue;
      sources.push(asSource(requirement.otherwise, name));
    }
  }
  return sources;
}

/** What those sources do to one check or save, by the name of whatever does each part. */
export interface RulesetCheckEffects {
  /** Numbers added or taken, flat or in dice, not yet rolled. */
  modifiers: Array<{ from: string; modifier: RulesetEffectModifier }>;
  /** What leans the roll one way: effects and modifiers' modes. */
  advantage: string[];
  disadvantage: string[];
  /** A save these make fail without a roll. Empty for a check. */
  fails: string[];
  /** Floors under a check (Capability API 1.418), each from a source, its `total` not yet read off
   *  the sheet and its `proficient` not yet weighed. Left out where there are none. */
  floors?: Array<{ from: string; floor: RulesetCheckFloor }>;
}

/** Whether a skill trained to this tier adds its holder's whole proficiency (1.418): a tier above
 *  the first whose multiplier is at least 1. Half proficiency is not "your proficiency bonus". */
export function rulesetTierAddsProficiency(definition: RulesetDefinition, tier: string | undefined): boolean {
  const tiers = definition.resolution.proficiencyTiers;
  if (tier === undefined || tier === tiers[0]?.id) return false;
  const found = tiers.find((one) => one.id === tier);
  return !!found && found.multiplier >= 1;
}

/**
 * What changes this check or save. A check reads the check effects and the modifiers to checks, a save
 * the save effects, the modifiers to saves and the saves failed. Something narrowed to some skills
 * changes only a check on one of them (a modifier's own `skills` first, else its source's), and
 * something narrowed to some saves only those saves; a check the ruleset cannot name reads only what
 * is narrowed to nothing.
 */
export function rulesetCheckEffects(
  sources: readonly RulesetCheckSource[],
  target: RulesetCheckTarget | null,
  /** Whether the roller adds their whole proficiency to this check's skill (1.429), for a change
   *  narrowed to such checks: Natural Explorer. */
  trained = false,
  /** What the save is made against, where the Engine knows (1.364): a modifier narrowed with `against`
   *  applies outside a fight too when it matches. */
  against?: RulesetSaveAgainst,
): RulesetCheckEffects {
  const found: RulesetCheckEffects = { modifiers: [], advantage: [], disadvantage: [], fails: [] };
  const lean = (side: "advantage" | "disadvantage", from: string) => {
    if (!found[side].includes(from)) found[side].push(from);
  };
  const save = target?.type === "save" ? target.id : undefined;
  const skill = target?.type === "skill" ? target.id : undefined;
  // The ability a check is made with (1.188): a raw ability check's own, or a skill's as it is rolled.
  const ability =
    target?.type === "ability"
      ? target.id
      : target?.type === "skill"
        ? (target.withAbility ?? target.ability)
        : undefined;
  const about = (narrowed: readonly string[] | undefined, id: string | undefined) =>
    !narrowed || (id !== undefined && narrowed.includes(id));
  for (const source of sources) {
    const effects = source.effects ?? [];
    if (save !== undefined) {
      if (source.failsSaves?.includes(save) && !found.fails.includes(source.name)) found.fails.push(source.name);
      if (about(source.saves, save)) {
        if (effects.includes("own-saves-advantage")) lean("advantage", source.name);
        if (effects.includes("own-saves-disadvantage")) lean("disadvantage", source.name);
      }
    } else if (about(source.skills, skill)) {
      if (effects.includes("own-checks-advantage")) lean("advantage", source.name);
      if (effects.includes("own-checks-disadvantage")) lean("disadvantage", source.name);
    }
    // A floor under a check (1.418), narrowed by its own abilities and skills.
    const floor = source.checkFloor;
    if (floor && save === undefined && about(floor.skills, skill) && about(floor.abilities, ability))
      (found.floors ??= []).push({ from: source.name, floor });
    for (const modifier of source.modifiers ?? []) {
      const applies =
        save !== undefined
          ? modifier.to === "saves" && about(modifier.saves ?? source.saves, save)
          : modifier.to === "checks" &&
            about(modifier.skills ?? source.skills, skill) &&
            about(modifier.abilities, ability) &&
            // Only a check made for one of its purposes (1.752): climbing or swimming.
            about(modifier.for, target?.purpose);
      if (!applies || !rulesetSaveAgainstMatches(modifier.against, against)) continue;
      if (modifier.proficient && (skill === undefined || !trained)) continue;
      if (modifier.mode) lean(modifier.mode, source.name);
      if (modifier.flat !== undefined || modifier.dice !== undefined || modifier.add !== undefined) {
        found.modifiers.push({ from: source.name, modifier });
      }
    }
  }
  return found;
}

/** How a check is thrown once its sources and the Game Master's `mode=` are counted together: any
 *  advantage and any disadvantage cancel out, whatever the number of each. */
export function rulesetCheckRollMode(
  asked: { advantage?: boolean; disadvantage?: boolean },
  effects: Pick<RulesetCheckEffects, "advantage" | "disadvantage">,
): "normal" | "advantage" | "disadvantage" {
  const advantage = !!asked.advantage || effects.advantage.length > 0;
  const disadvantage = !!asked.disadvantage || effects.disadvantage.length > 0;
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/** The modifiers rolled: each one's flat part and its dice, with the dice thrown. */
export function rollRulesetCheckModifiers(
  modifiers: RulesetCheckEffects["modifiers"],
  rollDie: (sides: number) => number,
  /** A value off the roller's sheet (1.429), for a change that adds one; without it, such adds
   *  nothing. */
  read?: (ref: RulesetValueRef) => number | undefined,
): { total: number; rolls: number[] } {
  let total = 0;
  const rolls: number[] = [];
  for (const { modifier } of modifiers) {
    total += modifier.flat ?? 0;
    if (modifier.add && read) total += (modifier.minus ? -1 : 1) * Math.trunc(read(modifier.add) ?? 0);
    const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
    if (!dice) continue;
    let rolled = dice.flat;
    for (let i = 0; i < dice.count; i++) {
      const face = rollDie(dice.sides);
      rolls.push(face);
      rolled += face;
    }
    total += modifier.minus ? -rolled : rolled;
  }
  return { total, rolls };
}

/** The check a use's `gate` asks of the one using it, as their sheet makes it. */
export interface RulesetItemGateCheck {
  /** The skill or ability rolled; null for a value off the sheet, which reads only what applies to
   *  every check. */
  target: RulesetCheckTarget | null;
  /** The sheet's number for it with what `resolution.adjust` adds: a modifier, or a pool's dice. */
  modifier: number;
  difficulty: number;
}

/**
 * What a use's `gate` asks of one user: nothing when the value it names under `unless` is high
 * enough, and otherwise its check, read off their sheet worked out with their live state and items.
 * `difficulty` is the gate's own, already read off the item where it names a stat.
 */
export function rulesetItemGateCheck(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  gate: NonNullable<RulesetItemUse["gate"]>,
  difficulty: number,
): RulesetItemGateCheck | null {
  const { check, unless } = gate;
  if (unless && resolveRulesetValueRef(definition, build, unless.value, evaluated) >= unless.atLeast) return null;
  const skill = "skill" in check ? definition.sheet.skills.find((entry) => entry.id === check.skill) : undefined;
  const ability =
    "ability" in check ? definition.sheet.abilities.find((entry) => entry.id === check.ability) : undefined;
  const target: RulesetCheckTarget | null = skill
    ? { type: "skill", id: skill.id, label: skill.label, ...(skill.ability ? { ability: skill.ability } : {}) }
    : ability
      ? { type: "ability", id: ability.id, label: ability.label }
      : null;
  const base =
    "value" in check
      ? resolveRulesetValueRef(definition, build, check.value, evaluated)
      : rulesetCheckModifier(evaluated, target);
  return {
    target,
    modifier: Math.trunc(base) + rulesetCheckAdjust(definition, build, evaluated, target),
    difficulty,
  };
}

/** One thing the Game Master applied to a roll by name with `apply=` (Capability API 1.156): a row
 *  of a list that declares `contextual`, or a catalog entry with `mechanics.contextual` the character
 *  has. Only what applies to this check is here: a row for another skill is left out. */
export interface RulesetContextualItem {
  name: string;
  source: RulesetCheckSource;
  check?: RulesetContextualCheck;
  cost?: RulesetContextualCost;
}

// Curly and straight apostrophes and quotes read alike, so "Rook’s Gambit" is "Rook's Gambit".
const plainText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
const sameText = (a: string, b: string) => plainText(a) === plainText(b);

/** What each name the Game Master applied means on this character's sheet, for this one check. A
 *  name no row or entry answers to, one two rows answer to, and one that does not apply to this check
 *  are left out, so ownership alone never changes a roll. At most four names are read. */
export function rulesetContextualItems(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  names: readonly string[],
  target: RulesetCheckTarget | null,
): RulesetContextualItem[] {
  const items: RulesetContextualItem[] = [];
  const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 4);
  const abilityNamed = (cell: string, id: string | undefined) => {
    const ability = id === undefined ? undefined : definition.sheet.abilities.find((each) => each.id === id);
    return (
      !!ability &&
      (sameText(cell, ability.id) ||
        sameText(cell, ability.label) ||
        (!!ability.short && sameText(cell, ability.short)))
    );
  };
  const skillMatches = (cell: unknown, abilities: boolean) => {
    if (typeof cell !== "string" || cell.trim() === "") return true;
    if (!target) return false;
    // An ability named in the cell (1.213): any check rolled with it, its own ability or `with=`'s.
    if (abilities) {
      const rolledWith =
        target.type === "ability" ? [target.id, target.withAbility] : [target.withAbility ?? target.ability];
      if (rolledWith.some((id) => abilityNamed(cell, id))) return true;
    }
    if (target.type === "ability") return false;
    return sameText(cell, target.id) || sameText(cell, target.label);
  };
  for (const name of wanted) {
    const rows: { list: (typeof definition.sheet.lists)[number]; row: Record<string, unknown> }[] = [];
    for (const list of definition.sheet.lists) {
      if (!list.contextual) continue;
      for (const row of build.lists?.[list.id] ?? []) {
        const cell = row?.[list.contextual.name];
        if (typeof cell === "string" && sameText(cell, name)) rows.push({ list, row: row as Record<string, unknown> });
      }
    }
    let item: RulesetContextualItem | null = null;
    if (rows.length === 1) {
      const { list, row } = rows[0]!;
      const contextual = list.contextual!;
      const to = contextual.to ?? "checks";
      if (target?.type === (to === "saves" ? "save" : "skill") || (to === "checks" && target?.type === "ability")) {
        const skill = contextual.skill !== undefined ? row[contextual.skill] : undefined;
        if (skillMatches(skill, !!contextual.abilities)) {
          const bonus = contextual.bonus !== undefined ? row[contextual.bonus] : undefined;
          const dice = contextual.dice !== undefined ? row[contextual.dice] : undefined;
          const modifier = {
            to,
            ...(typeof bonus === "number" && Number.isFinite(bonus) && bonus !== 0 ? { flat: Math.trunc(bonus) } : {}),
            ...(typeof dice === "string" && parseRulesetCombatDice(dice) ? { dice } : {}),
          } as RulesetEffectModifier;
          const changes = "flat" in modifier || "dice" in modifier;
          if (changes || contextual.check)
            item = {
              name: String(row[contextual.name]).trim(),
              source: { name: String(row[contextual.name]).trim(), ...(changes ? { modifiers: [modifier] } : {}) },
              ...(contextual.check ? { check: contextual.check } : {}),
              ...(contextual.cost ? { cost: contextual.cost } : {}),
            };
        }
      }
    } else if (rows.length === 0) {
      const found = rulesetEntryNamed(definition, build, catalogs, name);
      const contextual = found.ok ? found.entry.mechanics?.contextual : undefined;
      if (found.ok && contextual) {
        const source: RulesetCheckSource = {
          name: found.entry.label,
          ...(contextual.effects ? { effects: contextual.effects } : {}),
          ...(contextual.modifiers ? { modifiers: contextual.modifiers } : {}),
          ...(contextual.skills ? { skills: contextual.skills } : {}),
          ...(contextual.saves ? { saves: contextual.saves } : {}),
        };
        // Trained in the skill rolled (1.429), for a change only to those: Natural Explorer.
        const trained = target?.type === "skill" && rulesetTierAddsProficiency(definition, build.skills?.[target.id]);
        const effects = rulesetCheckEffects([source], target, trained);
        const leans = effects.modifiers.length + effects.advantage.length + effects.disadvantage.length > 0;
        // A pool effect is narrowed as a condition is: to the skills or saves it names, else any check.
        const narrowedOut =
          target?.type === "save"
            ? !!contextual.skills || (!!contextual.saves && !contextual.saves.includes(target.id))
            : !!contextual.saves ||
              (!!contextual.skills && (target?.type !== "skill" || !contextual.skills.includes(target.id)));
        const check = contextual.check && !narrowedOut ? contextual.check : undefined;
        if (leans || check)
          item = {
            name: found.entry.label,
            source,
            ...(check ? { check } : {}),
            ...(contextual.cost ? { cost: contextual.cost } : {}),
          };
      }
    }
    if (item && !items.some((each) => sameText(each.name, item!.name))) items.push(item);
  }
  return items;
}

/** The pool check effects of the items applied, together: dice and successes add up, and a face rule
 *  takes the lowest face any of them names. */
export function rulesetContextualCheck(items: readonly RulesetContextualItem[]): RulesetContextualCheck | undefined {
  const checks = items.flatMap((item) => (item.check ? [item.check] : []));
  if (!checks.length) return undefined;
  const sum = (key: "dice" | "successes") => checks.reduce((total, check) => total + (check[key] ?? 0), 0);
  const low = (key: "double" | "explode") => {
    const faces = checks.flatMap((check) => (check[key] !== undefined ? [check[key]!] : []));
    return faces.length ? Math.min(...faces) : undefined;
  };
  const out: RulesetContextualCheck = {};
  if (sum("dice")) out.dice = sum("dice");
  if (sum("successes")) out.successes = sum("successes");
  if (low("double") !== undefined) out.double = low("double");
  if (low("explode") !== undefined) out.explode = low("explode");
  if (checks.some((check) => check.cancel === false)) out.cancel = false;
  if (checks.some((check) => check.best)) out.best = true;
  return out;
}

/** Item tags as words: each by the ruleset's label for it (its id read as words without one),
 *  lowercased, joined with "or". */
export function rulesetTagWords(definition: RulesetDefinition | undefined, tags: readonly string[]): string {
  const words = tags.map((id) =>
    (definition?.items?.tags?.find((tag) => tag.id === id)?.label ?? id.replace(/_/g, " ")).toLowerCase(),
  );
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words.at(-1)}` : (words[0] ?? "");
}

/** Typed defenses, in the same words on the sheet, battle status and Game Master prompt (1.132). */
export function rulesetHideLines(
  definition: RulesetDefinition,
  sources: readonly Pick<RulesetCheckSource, "resist" | "vulnerable" | "immune" | "conditionImmunities">[],
  text: (key: string, values: Record<string, string>) => string = (key, values) => {
    if (key === "game.ruleset.hides.except") return `${values.type} (not from ${values.tags})`;
    const labels: Record<string, string> = {
      resist: "Resists",
      vulnerable: "Vulnerable to",
      immune: "Immune to",
      conditionImmunities: "Condition immunities",
    };
    return `${labels[key.split(".").at(-1)!]}: ${values.names}`;
  },
): string[] {
  return (["resist", "vulnerable", "immune", "conditionImmunities"] as const).flatMap((kind) => {
    const names = sources.flatMap((source) =>
      (source[kind] ?? []).map((entry) => {
        // The tags a blow is let through by, by the ruleset's own words for them (ship readiness
        // 2026-10-25: "fire except magic_weapon silvered").
        if (typeof entry !== "string")
          return text("game.ruleset.hides.except", {
            type: entry.type,
            tags: rulesetTagWords(definition, entry.except),
          });
        return kind === "conditionImmunities"
          ? (definition.sheet.live.conditions.find((condition) => condition.id === entry)?.label ?? entry)
          : entry;
      }),
    );
    return names.length ? [text(`game.ruleset.hides.${kind}`, { names: [...new Set(names)].join(", ") })] : [];
  });
}
