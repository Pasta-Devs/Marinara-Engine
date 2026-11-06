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
  resolveRulesetValueRef,
  type EvaluatedRulesetSheet,
  type RulesetCatalogEntriesById,
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
  const resolved = readRulesetLive(definition, build, live, items);
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
  /** The catalogs its rows came from, so what its features do to its attacks counts. */
  catalogs?: RulesetCatalogEntriesById,
): RulesetSheetAttack[] {
  if (!definition.combat) return [];
  try {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [
        {
          id: "sheet",
          name: "sheet",
          side: "party",
          build,
          live,
          ...(items ? { items } : {}),
          ...(catalogs ? { catalogs } : {}),
        },
      ],
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

/** A list's rows as the sheet shows them: its own, then the rows every sheet's fight has as well
 *  (`combat.attacks` `always`, 1.244) where it has none of the same name, so 5e's Unarmed Strike is
 *  on the sheet a fight reads it from (laptop class builds 2026-10-24). */
export function rulesetListRowsShown(definition: RulesetDefinition, listId: string, rows: unknown): unknown {
  const own = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
  const nameOf = (row: Record<string, unknown>, column: string) =>
    typeof row?.[column] === "string" ? (row[column] as string).trim().toLowerCase() : "";
  const always = (definition.combat?.attacks ?? []).flatMap((source) => {
    if (source.list !== listId || !source.always?.length) return [];
    const names = new Set(own.map((row) => nameOf(row, source.name)).filter(Boolean));
    return source.always.filter((row) => {
      const name = nameOf(row, source.name);
      return !!name && !names.has(name);
    });
  });
  return always.length > 0 ? [...own, ...always] : rows;
}

/** The level each pool that has one pays at (1.116, 1.171), by pool id, where it is above 0: a
 *  warlock's pact slots, "level 3". */
export function rulesetPoolLevels(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated?: EvaluatedRulesetSheet,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pool of definition.sheet.live.pools) {
    if (!pool.level) continue;
    const level = Math.trunc(resolveRulesetValueRef(definition, build, pool.level, evaluated));
    if (level > 0) out[pool.id] = level;
  }
  return out;
}
