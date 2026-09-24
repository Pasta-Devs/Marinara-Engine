// A Game Master's invented opponent, written as a SHEET, held to its tier.
//
// A plain invention is held by its numbers before the fight is built (`clampRulesetStatBlock`). A
// sheet has no numbers until it is built: its defense, to-hit, save difficulties and damage are
// whatever the ruleset's own formulas make of it. So it is held in three steps, each the smallest
// thing that works for any ruleset:
//
//   1. `readProposedRulesetSheet`: a model's sheet is read the way a character's is, leniently.
//      Anything the ruleset does not have is dropped by name, a value is fitted to its field or
//      column, and a row named after a catalog entry becomes that entry, so "Fireball" is Fireball.
//   2. `holdRulesetSheetHealth`: health goes into the tier's band through the one field the
//      ruleset's health is read off, which is a sheet edit, so every reader agrees on it.
//   3. `holdRulesetCombatant`: once the fight is built, defense, to-hit, save difficulties and the
//      best round are held on the combatant itself, which is where those numbers live for the whole
//      fight. The damage a bigger payment buys counts toward the best round.
//
// Every change comes back as a plain sentence, exactly as the plain clamp's do.

import {
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatThreatTier,
  type RulesetDefinition,
  type RulesetField,
  type RulesetList,
  type RulesetListColumn,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { readRulesetLive } from "../rulesets/live-state.js";
import { resolveRulesetValueRef } from "../rulesets/sheet-math.js";
import { heaviestRider, RULESET_CLAMP_HEADROOM, smallerDie } from "./creatures.js";
import { rulesetAverageAmount, rulesetAverageDamage } from "./dice.js";
import { rulesetCostSteps, rulesetPoolFamily } from "./options.js";
import type { RulesetCombatAction, RulesetCombatAmount, RulesetCombatant } from "./types.js";

type SheetScalar = string | number | boolean;

/** How many names one sentence lists before it says "and N more". */
const NAMES_SHOWN = 4;

function listed(names: readonly string[]): string {
  const shown = names.slice(0, NAMES_SHOWN).map((name) => `"${name}"`);
  const more = names.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

const sameName = (left: unknown, right: unknown) =>
  typeof left === "string" && typeof right === "string" && left.trim().toLowerCase() === right.trim().toLowerCase();

/** A value fitted to a field or a column: a number into its range, one of its values, text to its
 *  length. Undefined when there is nothing of the right kind to keep. */
function fitted(spec: RulesetField | RulesetListColumn, value: unknown): SheetScalar | undefined {
  switch (spec.type) {
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      const whole = spec.integer ? Math.round(value) : value;
      return Math.min(spec.max, Math.max(spec.min, whole));
    }
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "enum":
      return spec.values.find((candidate) => sameName(candidate, value));
    case "dice":
      return typeof value === "string" && value.length <= 40 ? value : undefined;
    default:
      return typeof value === "string" ? value.slice(0, spec.maxLength) : undefined;
  }
}

/** The column a row is known by: the first text column, which is its name in every list a ruleset
 *  writes. A list with none has no name to match a catalog entry by. */
function nameColumnOf(list: RulesetList): RulesetListColumn | undefined {
  return list.columns.find((column) => column.type === "text");
}

/** The catalog entry a proposed row is: the one its mark names, or the one its name matches, out of
 *  the catalogs that feed this list and were loaded for the fight. */
function entryFor(
  definition: RulesetDefinition,
  list: RulesetList,
  row: Record<string, unknown>,
  catalogs: RulesetCatalogEntriesById,
): { catalogId: string; entry: RulesetCatalogEntry } | null {
  const feeding = (definition.catalogs ?? []).filter((catalog) => catalog.feeds?.includes(list.id));
  const mark = row[RULESET_CATALOG_ROW_KEY];
  if (typeof mark === "string") {
    const slash = mark.indexOf("/");
    const catalogId = mark.slice(0, slash);
    const entry = feeding.some((catalog) => catalog.id === catalogId)
      ? catalogs[catalogId]?.find((candidate) => candidate.id === mark.slice(slash + 1))
      : undefined;
    if (entry) return { catalogId, entry };
  }
  const nameColumn = nameColumnOf(list);
  const name = nameColumn ? row[nameColumn.id] : undefined;
  if (typeof name !== "string") return null;
  for (const catalog of feeding) {
    const entry = catalogs[catalog.id]?.find((candidate) => {
      const own = candidate.rows?.find((entryRow) => entryRow.list === list.id);
      return !!own && (sameName(candidate.label, name) || sameName(own.values[nameColumn!.id], name));
    });
    if (entry) return { catalogId: catalog.id, entry };
  }
  return null;
}

/**
 * A Game Master's sheet, read leniently against the ruleset: every id kept is one the ruleset
 * declares and every value one its field or column can hold, and a row named after a catalog entry
 * becomes that entry's row with the Game Master's own values on top. `catalogs` are the ones loaded
 * for the fight; a row whose catalog was not loaded simply stays the row it was written as.
 */
export function readProposedRulesetSheet(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const declared = definition.sheet;
  const adjusted: string[] = [];
  const unknown: string[] = [];
  const sheet: RulesetSheetBuild = { abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: {}, lists: {} };

  for (const [id, value] of Object.entries(proposed.abilities ?? {})) {
    const ability = declared.abilities.find((candidate) => candidate.id === id);
    if (!ability) {
      unknown.push(id);
      continue;
    }
    const kept = Math.min(ability.max, Math.max(ability.min, Math.round(value)));
    if (kept !== value) adjusted.push(`${ability.label} ${value} was set to ${kept}.`);
    sheet.abilities[id] = kept;
  }

  const tierIds = definition.resolution.proficiencyTiers.map((tier) => tier.id);
  for (const key of ["skills", "saves"] as const) {
    const ids = new Set(declared[key].map((entry) => entry.id));
    const offered = new Set((key === "skills" ? declared.skillTiers : declared.saveTiers) ?? tierIds);
    for (const [id, tier] of Object.entries(proposed[key] ?? {})) {
      if (!ids.has(id)) {
        unknown.push(id);
        continue;
      }
      const kept = [...offered].find((candidate) => sameName(candidate, tier));
      if (!kept) {
        adjusted.push(`"${tier}" is not offered for ${id}, so it was left at the ruleset's default.`);
        continue;
      }
      sheet[key][id] = kept;
    }
  }

  const skillOrSave = new Set([...declared.skills, ...declared.saves].map((entry) => entry.id));
  const { min, max } = declared.bonusRange;
  for (const [id, value] of Object.entries(proposed.bonuses ?? {})) {
    if (!skillOrSave.has(id)) {
      unknown.push(id);
      continue;
    }
    const kept = Math.min(max, Math.max(min, Math.round(value)));
    if (kept !== value) adjusted.push(`The bonus on ${id} was set to ${kept}.`);
    sheet.bonuses[id] = kept;
  }

  for (const [id, value] of Object.entries(proposed.fields ?? {})) {
    const field = declared.fields.find((candidate) => candidate.id === id);
    if (!field) {
      unknown.push(id);
      continue;
    }
    const kept = fitted(field, value);
    if (kept === undefined) {
      adjusted.push(`${field.label} could not hold ${JSON.stringify(value)}, so it was left at the ruleset's default.`);
      continue;
    }
    if (kept !== value) adjusted.push(`${field.label} ${JSON.stringify(value)} was set to ${JSON.stringify(kept)}.`);
    sheet.fields[id] = kept;
  }

  const nothing: string[] = [];
  for (const [listId, rows] of Object.entries(proposed.lists ?? {})) {
    const list = declared.lists.find((candidate) => candidate.id === listId);
    if (!list) {
      unknown.push(listId);
      continue;
    }
    const fedByACatalog = (definition.catalogs ?? []).some((catalog) => catalog.feeds?.includes(list.id));
    const kept: Array<Record<string, SheetScalar>> = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row !== "object") continue;
      const own: Record<string, SheetScalar> = {};
      for (const column of list.columns) {
        const value = fitted(column, (row as Record<string, unknown>)[column.id]);
        if (value !== undefined) own[column.id] = value;
      }
      const found = entryFor(definition, list, row as Record<string, unknown>, catalogs);
      const entryValues = found?.entry.rows?.find((entryRow) => entryRow.list === list.id)?.values ?? {};
      const nameColumn = nameColumnOf(list);
      // The Game Master's own values on top of the entry's, except its name, which is the entry's:
      // "ember lance" is Ember Lance, and the sheet's `use` command knows it by that name.
      const built: Record<string, SheetScalar> = found
        ? {
            ...entryValues,
            ...own,
            ...(nameColumn && entryValues[nameColumn.id] !== undefined
              ? { [nameColumn.id]: entryValues[nameColumn.id]! }
              : {}),
            [RULESET_CATALOG_ROW_KEY]: `${found.catalogId}/${found.entry.id}`,
          }
        : own;
      if (list.columns.some((column) => column.required && built[column.id] === undefined)) continue;
      if (!found && fedByACatalog) {
        const name = nameColumn ? built[nameColumn.id] : undefined;
        if (typeof name === "string") nothing.push(name);
      }
      kept.push(built);
    }
    if (kept.length > list.maxItems) {
      adjusted.push(`Only the first ${list.maxItems} rows of ${list.label} were kept.`);
      kept.length = list.maxItems;
    }
    if (kept.length > 0) sheet.lists[listId] = kept;
  }

  if (unknown.length > 0) {
    adjusted.push(`${listed(unknown)} ${unknown.length === 1 ? "is" : "are"} not on this ruleset's sheet, so dropped.`);
  }
  if (nothing.length > 0) {
    adjusted.push(
      `${listed(nothing)} ${nothing.length === 1 ? "is" : "are"} in no catalog of this ruleset, so ${nothing.length === 1 ? "it does" : "they do"} nothing in a fight.`,
    );
  }
  return { sheet, adjusted };
}

/** The number field the ruleset's health pool is read off: its maximum IS the field, or is a sum with
 *  exactly one field in it. Anything else is a formula the Engine does not try to invert. */
function healthField(definition: RulesetDefinition, poolId: string): Extract<RulesetField, { type: "number" }> | null {
  const pool = definition.sheet.live.pools.find((candidate) => candidate.id === poolId);
  let fieldId = pool?.max.field;
  if (!fieldId && pool?.max.derived) {
    const derived = definition.sheet.derived.find((candidate) => candidate.id === pool.max.derived);
    const fields = derived?.op === "sum" ? derived.of.filter((ref) => ref.field !== undefined) : [];
    if (fields.length === 1) fieldId = fields[0]!.field;
  }
  const field = definition.sheet.fields.find((candidate) => candidate.id === fieldId);
  return field?.type === "number" ? field : null;
}

/**
 * Health into the tier's band, through the one field the ruleset's health is read off, so the sheet
 * itself says the new number and nothing downstream has to know it was held. A wound track's length
 * is the ruleset's own and is never changed; a formula with no single field in it is left as written,
 * and says so.
 */
export function holdRulesetSheetHealth(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  tier: RulesetCombatThreatTier,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const health = definition.combat?.health;
  if (!health || !("pool" in health)) return { sheet: proposed, adjusted: [] };
  const maxOf = (build: RulesetSheetBuild) =>
    readRulesetLive(definition, build, {}).pools.find((pool) => pool.key === health.pool)?.max ?? 0;
  const before = maxOf(proposed);
  const [low, high] = tier.health;
  if (before >= low && before <= high) return { sheet: proposed, adjusted: [] };
  const field = healthField(definition, health.pool);
  if (!field) {
    return {
      sheet: proposed,
      adjusted: [
        `Health ${before} is outside the ${low} to ${high} of ${tier.label}, and it is not read off one field of the sheet, so it was left as written.`,
      ],
    };
  }
  const target = Math.min(high, Math.max(low, before));
  const sheet = structuredClone(proposed);
  const current = resolveRulesetValueRef(definition, sheet, { field: field.id });
  const moved = current + (target - before);
  sheet.fields[field.id] = Math.min(field.max, Math.max(field.min, field.integer ? Math.round(moved) : moved));
  const after = maxOf(sheet);
  return {
    sheet,
    adjusted: [
      after >= low && after <= high
        ? `Health ${before} was pulled into the ${low} to ${high} of ${tier.label} through its ${field.label}, and is now ${after}.`
        : `Health ${before} was moved toward the ${low} to ${high} of ${tier.label} as far as its ${field.label} goes, and is now ${after}.`,
    ],
  };
}

/** The pools this combatant could pay out of right now, by id, for pricing a bigger payment. */
function poolValues(definition: RulesetDefinition, combatant: RulesetCombatant): Map<string, number> {
  const sheet = combatant.sheet;
  if (!sheet) return new Map();
  return new Map(readRulesetLive(definition, sheet.build, sheet.live).pools.map((pool) => [pool.key, pool.value]));
}

/** How many rungs the biggest payment it can afford climbs, for an action that grows when paid for
 *  out of a bigger pool. */
function stepsAffordable(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  pools: Map<string, number>,
): number {
  if (!action.use?.perCostStep) return 0;
  let steps = 0;
  for (const pool of rulesetPoolFamily(definition, action.use.group)) {
    if ((pools.get(pool) ?? 0) >= 1) steps = Math.max(steps, rulesetCostSteps(definition, action, pool));
  }
  return steps;
}

interface SheetRound {
  average: number;
  action: RulesetCombatAction | null;
  steps: number;
}

/** The heaviest round one spend buys against one target: every strike it buys, the biggest payment
 *  it can afford, and the heaviest rider counted once on top, exactly as the plain clamp counts. */
function bestSheetRound(definition: RulesetDefinition, combatant: RulesetCombatant): SheetRound {
  const pools = poolValues(definition, combatant);
  const byId = new Map(combatant.actions.map((action) => [action.id, action]));
  const rider = heaviestRider(combatant.riders);
  const carried = rider ? Math.max(0, rulesetAverageAmount(rider.amount)) : 0;
  const once = (action: RulesetCombatAction | undefined) => {
    if (!action?.damage) return 0;
    const steps = stepsAffordable(definition, action, pools);
    const grown = steps > 0 ? steps * rulesetAverageAmount(action.use!.perCostStep!) : 0;
    return Math.max(0, rulesetAverageDamage(action.damage) + grown);
  };
  let best: SheetRound = { average: 0, action: null, steps: 0 };
  for (const action of combatant.actions) {
    const average = action.sequence
      ? action.sequence.reduce((total, step) => total + step.times * once(byId.get(step.actionId)), 0)
      : once(action) * Math.max(1, action.strikes ?? 1);
    const round = average > 0 ? average + carried : 0;
    if (round > best.average) best = { average: round, action, steps: stepsAffordable(definition, action, pools) };
  }
  return best;
}

/** One amount a step down: fewer dice, then less flat, then a smaller die. False when there is
 *  nothing left to take without taking it to nothing. */
function shave(amount: RulesetCombatAmount): boolean {
  const rolls = amount.count > 0 && amount.sides > 0;
  if (amount.count > 1 && amount.sides > 0) amount.count -= 1;
  else if (amount.flat > (rolls ? 0 : 1)) amount.flat -= 1;
  else if (rolls && amount.sides > 2) amount.sides = smallerDie(amount.sides);
  else return false;
  return true;
}

/**
 * Defense, to-hit, save difficulties and the best round of a BUILT opponent held to its tier, on the
 * combatant itself: those numbers are resolved once when a fight begins and read from there, so
 * this is the one place they have to change. Health is not here; `holdRulesetSheetHealth` set it on
 * the sheet before the fight was built.
 */
export function holdRulesetCombatant(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  tier: RulesetCombatThreatTier,
): string[] {
  const adjusted: string[] = [];
  const defenseCap = tier.defense + RULESET_CLAMP_HEADROOM;
  if (combatant.defense > defenseCap) {
    adjusted.push(`Defense ${combatant.defense} was lowered to ${defenseCap}.`);
    combatant.defense = defenseCap;
  }
  const toHitCap = tier.toHit + RULESET_CLAMP_HEADROOM;
  const difficultyCap = tier.saveDifficulty + RULESET_CLAMP_HEADROOM;
  for (const action of combatant.actions) {
    if (action.toHit !== undefined && action.toHit > toHitCap) {
      adjusted.push(`"${action.label}" now hits at ${toHitCap} instead of ${action.toHit}.`);
      action.toHit = toHitCap;
    }
    const saves = [
      ...(action.save ? [action.save] : []),
      ...(action.damage?.plus ?? []).flatMap((clause) => (clause.save ? [clause.save] : [])),
    ];
    let lowered = saves.some((save) => save.difficulty > difficultyCap);
    for (const save of saves) save.difficulty = Math.min(save.difficulty, difficultyCap);
    if (action.saveDifficulty !== undefined && action.saveDifficulty > difficultyCap) {
      action.saveDifficulty = difficultyCap;
      lowered = true;
    }
    if (lowered) adjusted.push(`The save against "${action.label}" was lowered to ${difficultyCap}.`);
  }

  // Damage last, in the plain clamp's order, with one step in front of it: what a bigger payment
  // buys says least about the creature, so it gives way first, then the dice, the flat part, a
  // strike, and only then the size of the die.
  const cap = tier.damagePerRound[1];
  const byId = new Map(combatant.actions.map((action) => [action.id, action]));
  let scaled = false;
  let growth = false;
  for (let guard = 0; guard < 500; guard++) {
    const round = bestSheetRound(definition, combatant);
    if (round.average <= cap || !round.action) break;
    const action = round.action;
    const parts = action.sequence
      ? action.sequence.flatMap((step) => {
          const part = byId.get(step.actionId);
          return part ? [part] : [];
        })
      : [action];
    const grown = parts.find((part) => part.use?.perCostStep && round.steps > 0);
    if (grown?.use?.perCostStep) {
      if (!shave(grown.use.perCostStep)) delete grown.use.perCostStep;
      growth = true;
      scaled = true;
      continue;
    }
    const amounts = parts
      .flatMap((part) => (part.damage ? [part.damage, ...(part.damage.plus ?? [])] : []))
      .sort((left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left));
    const heaviest = amounts[0];
    if (heaviest && heaviest.count > 1 && heaviest.sides > 0) heaviest.count -= 1;
    else if (heaviest && heaviest.flat > (heaviest.count > 0 && heaviest.sides > 0 ? 0 : 1)) heaviest.flat -= 1;
    else if (!action.sequence && (action.strikes ?? 1) > 1) action.strikes = (action.strikes ?? 1) - 1;
    else if (!heaviest || !shave(heaviest)) break;
    scaled = true;
  }
  if (growth) adjusted.push("What a bigger payment buys was scaled down to fit the tier.");
  if (scaled) {
    const left = Math.round(bestSheetRound(definition, combatant).average * 100) / 100;
    adjusted.push(
      left <= cap
        ? `The damage was scaled down until the best round averages ${left}, inside the ${tier.damagePerRound[0]} to ${cap} of ${tier.label}.`
        : `The damage was scaled down as far as it goes, and the best round still averages ${left} against the ${cap} of ${tier.label}.`,
    );
  }
  return adjusted;
}
