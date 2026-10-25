// What the in-game ruleset sheet shows beside its editor: the summary, pool group headings and the
// level the character card's header shows.
import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  rulesetIsAttack,
  isRulesetItemHidden,
  readRulesetLive,
  resolveRulesetAbilityValues,
  type EvaluatedRulesetSheet,
  type RulesetCombatAmount,
  type RulesetCombatDamage,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
  type RulesetSheetItem,
} from "@marinara-engine/shared";

import type { TFunction } from "i18next";

/** The summary's fields and derived values the sheet shows for this build: what it hides (a spell save
 *  for someone who casts nothing) the summary hides too, as the Game Master's own summary does. */
export function rulesetSheetSummaryShown(definition: RulesetDefinition, build: RulesetSheetBuild) {
  const summary = definition.gm.sheetSummary;
  return {
    fields: definition.sheet.fields.filter(
      (field) => summary.fields.includes(field.id) && !isRulesetItemHidden(field, build, definition),
    ),
    derived: definition.sheet.derived.filter(
      (entry) => summary.derived.includes(entry.id) && !isRulesetItemHidden(entry, build, definition),
    ),
  };
}

/** A pool group's heading: the ruleset names a group only by its id ("hit_dice"), so the id is read as
 *  words ("Hit dice"). */
export function rulesetPoolGroupLabel(id: string): string {
  const words = id.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : id;
}

/** The character's level by the ruleset's sheet, for the card's header: its derived value named
 *  `level`, or else its number field named `level`, while the sheet shows it; null when the ruleset has
 *  neither, so the header shows no level rather than a stale one the game card kept. */
export function rulesetSheetLevel(
  definition: RulesetDefinition,
  envelope: RulesetSheetEnvelope | undefined,
  live: RulesetLiveState | undefined,
  items: ReadonlyArray<RulesetSheetItem> | undefined,
): number | null {
  const build = envelope?.build ?? defaultRulesetSheetBuild(definition);
  const derived = definition.sheet.derived.find((entry) => entry.id === "level");
  // A ruleset may keep the level as a number typed on the sheet rather than worked out.
  const field = derived
    ? undefined
    : definition.sheet.fields.find((entry) => entry.id === "level" && entry.type === "number");
  const level = derived ?? field;
  if (!level || isRulesetItemHidden(level, build, definition)) return null;
  const resolved = readRulesetLive(definition, build, live);
  const evaluated = evaluateRulesetSheet(definition, build, items ? { ...resolved, items } : resolved);
  const value = derived ? evaluated.derived.level : evaluated.numbers.level;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The class-specific numbers beside a spell row. Older lists keep their existing presentation. */
export function rulesetRowSpellcastingText(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  list: string,
  row: Record<string, unknown>,
  evaluated: EvaluatedRulesetSheet,
  t: TFunction,
): string {
  return (definition.combat?.abilities ?? [])
    .filter((source) => source.list === list && source.byColumn)
    .flatMap((source) => {
      const values = resolveRulesetAbilityValues(definition, build, source, row, evaluated);
      return [
        ...(values.toHitRef
          ? [
              t("ui.rulesets.sheet.spellAttack", {
                value: values.toHit >= 0 ? `+${values.toHit}` : String(values.toHit),
              }),
            ]
          : []),
        ...(values.saveDifficulty !== undefined
          ? [t("ui.rulesets.sheet.spellSave", { value: values.saveDifficulty })]
          : []),
      ];
    })
    .join(" · ");
}

/** One attack the sheet lists, as a fight would offer it: its name, what it adds to hit and the
 *  damage it deals, in dice ("1d8+3 slashing"). */
export interface RulesetSheetAttack {
  id: string;
  label: string;
  toHit?: number;
  damage?: string;
}

function amountText(amount: RulesetCombatAmount): string {
  const dice = amount.count > 0 && amount.sides > 0 ? `${amount.count}d${amount.sides}` : "";
  if (!dice) return String(amount.flat);
  if (!amount.flat) return dice;
  return amount.flat > 0 ? `${dice}+${amount.flat}` : `${dice}${amount.flat}`;
}

function damageText(damage: RulesetCombatDamage): string {
  return [damage, ...(damage.plus ?? [])]
    .map((part) => [amountText(part), part.type].filter(Boolean).join(" "))
    .join(" + ");
}

/** The attacks a fight would offer this character, read the way a fight reads them: the same
 *  sheet, live state and held items set into a fight of one, so the sheet never works out a to-hit
 *  of its own that could disagree with the fight's. Empty for a ruleset with no fights, and for a
 *  sheet a fight could not be started from. */
export function rulesetSheetAttacks(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  live: RulesetLiveState | undefined,
  items: ReadonlyArray<RulesetSheetItem> | undefined,
): RulesetSheetAttack[] {
  if (!definition.combat) return [];
  try {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [{ id: "sheet", name: "sheet", side: "party", build, live, ...(items ? { items } : {}) }],
    });
    const seen = new Set<string>();
    return (state.combatants[0]?.actions ?? []).flatMap((action) => {
      if (!rulesetIsAttack(action) || action.kind !== "attack" || seen.has(action.label)) return [];
      seen.add(action.label);
      return [
        {
          id: action.id,
          label: action.label,
          ...(typeof action.toHit === "number" && !action.autoHit ? { toHit: action.toHit } : {}),
          ...(action.damage ? { damage: damageText(action.damage) } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}
