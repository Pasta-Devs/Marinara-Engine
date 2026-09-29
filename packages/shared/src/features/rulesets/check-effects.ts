// ──────────────────────────────────────────────
// Game Mode rulesets: what changes a check outside a fight
//
// A character's active conditions, the levels their tracks have reached, and what their items do while
// worn or while only carried, read for one check or save. Each says it in the condition vocabulary:
// advantage or disadvantage, numbers added or taken, saves failed without a roll, narrowed to some
// skills or saves. The check resolver rolls what comes out of here; a fight reads its own conditions.
// ──────────────────────────────────────────────
import type { RulesetCombatCondition, RulesetDefinition, RulesetSheetBuild } from "../../schemas/ruleset.schema.js";
import { parseRulesetCombatDice } from "../ruleset-combat/dice.js";
import { evaluateRulesetSheetLive, readRulesetLive } from "./live-state.js";
import {
  resolveRulesetValueRef,
  type EvaluatedRulesetSheet,
  type RulesetCheckTarget,
  type RulesetSheetItem,
} from "./sheet-math.js";

type RulesetEffectModifier = NonNullable<RulesetCombatCondition["modifiers"]>[number];

/** One thing that changes this character's checks: an active condition, a level their track has
 *  reached, or one item's worn or carried effect. `name` is what a record calls it. */
export interface RulesetCheckSource {
  name: string;
  effects?: readonly string[];
  modifiers?: readonly RulesetEffectModifier[];
  failsSaves?: readonly string[];
  saves?: readonly string[];
  skills?: readonly string[];
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
      sources.push({ ...level, name: `${label} ${level.at}` });
    }
  }
  const seen = new Set<unknown>();
  for (const held of items ?? []) {
    const name = held.name ?? held.item.category;
    const effect = held.worn ? held.item.worn : held.item.carried;
    if (effect && !seen.has(effect)) {
      seen.add(effect);
      sources.push({ ...effect, name });
    }
    // What the wearer falls short of, while it is worn.
    if (!held.worn || !held.item.requires || seen.has(held.item.requires)) continue;
    seen.add(held.item.requires);
    for (const requirement of held.item.requires) {
      if (resolveRulesetValueRef(definition, build, requirement.value, sheet()) >= requirement.atLeast) continue;
      sources.push({ ...requirement.otherwise, name });
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
): RulesetCheckEffects {
  const found: RulesetCheckEffects = { modifiers: [], advantage: [], disadvantage: [], fails: [] };
  const lean = (side: "advantage" | "disadvantage", from: string) => {
    if (!found[side].includes(from)) found[side].push(from);
  };
  const save = target?.type === "save" ? target.id : undefined;
  const skill = target?.type === "skill" ? target.id : undefined;
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
    for (const modifier of source.modifiers ?? []) {
      const applies =
        save !== undefined
          ? modifier.to === "saves" && about(modifier.saves ?? source.saves, save)
          : modifier.to === "checks" && about(modifier.skills ?? source.skills, skill);
      if (!applies) continue;
      if (modifier.mode) lean(modifier.mode, source.name);
      if (modifier.flat !== undefined || modifier.dice !== undefined) {
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
): { total: number; rolls: number[] } {
  let total = 0;
  const rolls: number[] = [];
  for (const { modifier } of modifiers) {
    total += modifier.flat ?? 0;
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
