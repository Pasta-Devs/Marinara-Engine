// Starting a fight, and the small reads every later step shares.
//
// Everything a combatant can do is resolved ONCE, here: an attack row becomes a to-hit number and a
// damage roll, a catalog-marked ability row becomes what its `mechanics` says it does, and an
// opponent's block is read as it stands. Armour and bonuses do not move mid-fight in this kind, so
// nothing re-reads the build afterwards; health, conditions and resources are the parts that change,
// and those are read through the sheet's own helpers every time they are touched.

import {
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCatalogMechanics,
  type RulesetCombat,
  type RulesetCombatAbilitySource,
  type RulesetCombatAttackSource,
  type RulesetCombatDistanceSource,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import type { TacticalGrid } from "../tactical-combat/types.js";
import {
  applyRulesetSheetOp,
  evaluateRulesetSheetLive,
  readRulesetLive,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "../rulesets/live-state.js";
import { rulesetCatalogEntriesByRef } from "../rulesets/scaled-rows.js";
import {
  lookupStepTable,
  resolveRulesetValueRef,
  rulesetCheckModifier,
  type EvaluatedRulesetSheet,
} from "../rulesets/sheet-math.js";
import { findRulesetCreatureEntry, isRulesetPlainStatBlock, rulesetCreatureBlock } from "./creatures.js";
import { parseRulesetCombatDice, rollRulesetDice, rulesetCombatRoller, sumOf } from "./dice.js";
import { rulesetInCells, rulesetLineOfSight, rulesetPositionOf } from "./grid.js";
import type {
  RulesetCombatAction,
  RulesetCombatAmount,
  RulesetCombatant,
  RulesetCombatantInput,
  RulesetCombatBoard,
  RulesetCombatDamageClause,
  RulesetCombatEvent,
  RulesetCombatRider,
  RulesetCombatRoller,
  RulesetEncounterState,
  RulesetStatBlockAction,
} from "./types.js";

/** The dice of a catalog entry's `amount`, which the schema already holds to `<count>d<sides>`. */
function amountOf(amount: RulesetCatalogMechanics["amount"]): RulesetCombatAmount | null {
  if (!amount) return null;
  const dice = amount.dice ? parseRulesetCombatDice(amount.dice) : null;
  if (!dice && amount.flat === undefined) return null;
  return {
    count: dice?.count ?? 0,
    sides: dice?.sides ?? 0,
    flat: (dice?.flat ?? 0) + (amount.flat ?? 0),
  };
}

// ── Reading a combatant ──

export function rulesetCombatant(state: RulesetEncounterState, id: string): RulesetCombatant | undefined {
  return state.combatants.find((combatant) => combatant.id === id);
}

export function currentRulesetActor(state: RulesetEncounterState): RulesetCombatant | undefined {
  const id = state.order[state.turn];
  return id === undefined ? undefined : rulesetCombatant(state, id);
}

export interface RulesetCombatHealth {
  value: number;
  max: number;
  temp: number;
}

/**
 * Health as it stands. A party member's lives in their sheet, so it is read from there every time
 * rather than copied into the encounter, and a reload mid-fight is exact.
 *
 * A WOUND TRACK is reported as the levels it has LEFT: `value` is how many boxes are still clear
 * and `max` is the track's length. That is deliberate and it is what keeps the rest of the fight
 * written in its own words: "down" is a combatant at zero, and a full track is a combatant with no
 * boxes left, so `dropToZero`, the dying rules, the recap and the screen all keep asking the one
 * question they already ask. A track carries no buffer, so `temp` is always 0 on one.
 */
export function rulesetCombatHealth(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): RulesetCombatHealth {
  // A copy, always: an opponent's health lives in the state, and a caller that read it before a
  // blow has to still be holding what it was before. An opponent without a sheet is written in
  // plain numbers whichever shape the party's health takes; one with a sheet is read below, exactly
  // as a party member is.
  if (!combatant.sheet) return { ...(combatant.health ?? { value: 0, max: 0, temp: 0 }) };
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  const health = combat.health;
  if ("track" in health) {
    const track = live.tracks.find((entry) => entry.id === health.track);
    if (!track?.wound) return { value: 0, max: 0, temp: 0 };
    return { value: track.wound.levels.length - track.wound.marks.length, max: track.wound.levels.length, temp: 0 };
  }
  const pool = live.pools.find((entry) => !entry.listId && entry.key === health.pool);
  return pool ? { value: pool.value, max: pool.max, temp: pool.temp } : { value: 0, max: 0, temp: 0 };
}

/**
 * Which kind of mark this fight's damage is, on a ruleset whose health is a wound track.
 *
 * The mapping is the ruleset's own and nothing here guesses: a type it names lands as the kind it
 * named, and everything else, a blow with no type included, lands as the declared `default`. The
 * match ignores case, exactly as a creature's resistances and the block's own `damageTypes` do.
 *
 * The empty string is returned only for a ruleset whose health is a pool, where nobody asks.
 */
export function rulesetCombatDamageKind(combat: RulesetCombat, damageType: string | undefined): string {
  const kinds = combat.damageKinds;
  if (!kinds) return "";
  const wanted = damageType?.trim().toLowerCase();
  if (!wanted) return kinds.default;
  for (const [type, kind] of Object.entries(kinds.byType ?? {})) {
    if (type.trim().toLowerCase() === wanted) return kind;
  }
  return kinds.default;
}

/** One command through the sheet's own rules. A refusal changes nothing and says so, exactly as it
 *  does for the player's own buttons and the Game Master's commands. */
export function writeRulesetSheet(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  op: RulesetSheetOp,
): boolean {
  if (!combatant.sheet) return false;
  const result = applyRulesetSheetOp(definition, combatant.sheet.build, combatant.sheet.live, op);
  if (!result.ok) return false;
  combatant.sheet.live = result.live;
  return true;
}

/** Every condition on this combatant. A party member's are the sheet's own, so one they walked into
 *  the fight with counts from the first turn and one the fight applied is still there afterwards. */
export function rulesetCombatConditions(definition: RulesetDefinition, combatant: RulesetCombatant): string[] {
  const ids = new Set(combatant.tracked.map((entry) => entry.condition));
  if (combatant.sheet) {
    const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
    for (const condition of live.conditions) if (condition.active) ids.add(condition.id);
  }
  return [...ids];
}

/**
 * Whether whoever put this condition on somebody is still in their sight.
 *
 * A condition nobody applied, one whose source has left the fight, and every fight with no board at
 * all all read as "yes": a fight that measures nothing has no line for anything to break.
 */
function sourceInSight(
  combatant: RulesetCombatant,
  condition: string,
  state: RulesetEncounterState | undefined,
): boolean {
  const sourceId = combatant.tracked.find((entry) => entry.condition === condition)?.source;
  const grid = state?.board?.grid;
  if (!sourceId || !state || !grid) return true;
  const source = rulesetCombatant(state, sourceId);
  const from = rulesetPositionOf(combatant);
  const to = rulesetPositionOf(source);
  if (!source || !from || !to) return true;
  return rulesetLineOfSight(grid, from, to);
}

/**
 * The condition entries that are ON this combatant right now, with their gates read.
 *
 * One place, because everything a condition does reads it: what it stops, what it makes harder, and
 * which saves it is about. `state` is what a gate that measures anything needs; without it a gated
 * condition simply counts, which is what it does in a fight with no board anyway.
 */
export function rulesetActiveConditions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Array<NonNullable<RulesetCombat["conditions"]>[number]> {
  const active = new Set(rulesetCombatConditions(definition, combatant));
  return (combat.conditions ?? []).flatMap((entry) => {
    if (!active.has(entry.condition)) return [];
    const gate = entry.whileSourceInSight;
    if (!gate || sourceInSight(combatant, entry.condition, state)) return [entry];
    // Out of sight: `true` takes the whole condition off, and a list takes off only what it names,
    // so an effect nobody has to see to suffer stays.
    if (gate === true) return [];
    // A list gates the effects it NAMES and nothing else. `failsSaves` and `saves` are not effects
    // and were never named, so the entry stays even when the gate took every effect it had: a
    // fright you fail a save against whether or not you can see it is exactly what the list is for.
    return [{ ...entry, effects: entry.effects.filter((effect) => !gate.includes(effect)) }];
  });
}

/** What those conditions DO, as the closed effect list. */
export function rulesetCombatEffects(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Set<string> {
  const effects = new Set<string>();
  for (const entry of rulesetActiveConditions(definition, combat, combatant, state)) {
    for (const effect of entry.effects) effects.add(effect);
  }
  return effects;
}

/** Whether a condition makes this save fail without rolling. */
export function rulesetCombatFailsSave(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  save: string,
  state?: RulesetEncounterState,
): boolean {
  return rulesetActiveConditions(definition, combat, combatant, state).some(
    (entry) => entry.failsSaves?.includes(save) === true,
  );
}

/** How this combatant's own saves are rolled: the conditions on them, narrowed to the ones that
 *  are about THIS save, with advantage and disadvantage cancelling each other out exactly as they
 *  do on an attack. A ruleset that never rolls twice keeps its single roll. */
export function rulesetSaveMode(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  save: string,
  state?: RulesetEncounterState,
): "normal" | "advantage" | "disadvantage" {
  if (!combat.attackRoll.advantage) return "normal";
  let advantage = false;
  let disadvantage = false;
  for (const entry of rulesetActiveConditions(definition, combat, combatant, state)) {
    if (entry.saves && !entry.saves.includes(save)) continue;
    if (entry.effects.includes("own-saves-advantage")) advantage = true;
    if (entry.effects.includes("own-saves-disadvantage")) disadvantage = true;
  }
  // Dodging is not only about being harder to hit: where the ruleset says so, the saves that are
  // about getting out of the way are rolled with advantage too, for as long as the dodge lasts.
  if (combatant.flags.dodging && combat.standardEffects?.dodge?.saves.includes(save)) advantage = true;
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/** A combatant who can still be acted on and still take a turn. */
export function rulesetCombatStanding(combatant: RulesetCombatant): boolean {
  return !combatant.defeated && !combatant.down;
}

// ── Building what a combatant can do ──

const ABILITY_COLUMN_MISS = 0;

function columnValue(row: Record<string, unknown>, column: string | undefined): unknown {
  if (column === undefined) return undefined;
  return Object.prototype.hasOwnProperty.call(row, column) ? row[column] : undefined;
}

/** An ability modifier named by one cell of the row. A value that is not an ability id adds
 *  nothing, exactly as `abilityModFromField` reads one. */
function abilityFromColumn(evaluated: EvaluatedRulesetSheet, row: Record<string, unknown>, column?: string): number {
  const value = columnValue(row, column);
  return typeof value === "string" ? (evaluated.abilityMods[value] ?? ABILITY_COLUMN_MISS) : ABILITY_COLUMN_MISS;
}

function numberFromColumn(row: Record<string, unknown>, column?: string): number {
  const value = columnValue(row, column);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textFromColumn(row: Record<string, unknown>, column?: string): string | undefined {
  const value = columnValue(row, column);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * One distance of an attack row, in cells: the number in its own column, or the same number on
 * every row. Read only when the fight has a cell size to measure it in.
 *
 * Zero is "this row does not carry that distance", which is what a number column on a sheet reads
 * as when the player left it alone: a sword is not thrown because its range column says 0, and a
 * weapon with no long distance has 0 in that column rather than a second row.
 */
function distanceInCells(
  source: RulesetCombatDistanceSource | undefined,
  row: Record<string, unknown>,
  perCell: number | undefined,
): number | undefined {
  if (!source || perCell === undefined) return undefined;
  const value = "const" in source ? source.const : columnValue(row, source.column);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return rulesetInCells(value, perCell);
}

function attackActions(
  definition: RulesetDefinition,
  source: RulesetCombatAttackSource,
  index: number,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): RulesetCombatAction[] {
  const rows = build.lists?.[source.list];
  if (!Array.isArray(rows)) return [];
  // How many strikes one spend of this list's budget buys, read off the sheet once. A number below
  // one is the one strike every spend has always bought, so a sheet left alone changes nothing.
  const strikes = source.strikes
    ? Math.max(1, Math.trunc(resolveRulesetValueRef(definition, build, source.strikes, evaluated)))
    : undefined;
  const actions: RulesetCombatAction[] = [];
  rows.forEach((raw, rowIndex) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    const name = textFromColumn(row, source.name);
    const dice = parseRulesetCombatDice(columnValue(row, source.damage.dice.column));
    if (!name || !dice) return;
    const proficient = columnValue(row, source.toHit.proficiency?.column) === true;
    const reach = distanceInCells(source.reach, row, perCell);
    const normal = distanceInCells(source.range?.normal, row, perCell);
    const long = distanceInCells(source.range?.long, row, perCell);
    actions.push({
      id: `attack:${index}:${rowIndex}`,
      kind: "attack",
      label: name,
      budget: source.budget,
      targets: { side: "enemy", count: 1 },
      // A row its own column holds to one strike keeps none in hand: a crossbow is one shot a turn
      // however many attacks its wielder has. Said per ROW, because the count is the list's.
      ...(strikes !== undefined && columnValue(row, source.strikesCappedBy?.column) !== true ? { strikes } : {}),
      ...(reach !== undefined ? { reach } : {}),
      // A row whose long distance came out shorter than its ordinary one is the player's row, not
      // the ruleset's rule, so it is read as having nothing beyond the ordinary one.
      ...(normal !== undefined ? { range: { normal, ...(long !== undefined && long > normal ? { long } : {}) } } : {}),
      toHit:
        abilityFromColumn(evaluated, row, source.toHit.ability?.column) +
        (proficient ? evaluated.proficiencyBonus : 0) +
        numberFromColumn(row, source.toHit.bonus?.column),
      damage: {
        count: dice.count,
        sides: dice.sides,
        flat:
          dice.flat +
          abilityFromColumn(evaluated, row, source.damage.ability?.column) +
          numberFromColumn(row, source.damage.bonus?.column),
        ...(textFromColumn(row, source.damage.type?.column)
          ? { type: textFromColumn(row, source.damage.type?.column) }
          : {}),
      },
    });
  });
  return actions;
}

/** The clauses beside a blow's first amount, with each save's difficulty resolved once: the
 *  clause's own number when it named one, and otherwise the number this source rolls saves against.
 *  A clause with neither dice nor a flat part is refused at import, so nothing here is dropped. */
function clausesOf(
  plus: RulesetCatalogMechanics["plus"] | undefined,
  difficulty: number,
): RulesetCombatDamageClause[] | null {
  if (!plus?.length) return null;
  const clauses = plus.flatMap((clause) => {
    const amount = amountOf(clause);
    if (!amount) return [];
    return [
      {
        ...amount,
        ...(clause.type ? { type: clause.type } : {}),
        ...(clause.save
          ? {
              save: {
                save: clause.save.save,
                onSuccess: clause.save.onSuccess,
                difficulty: clause.save.difficulty ?? difficulty,
              },
            }
          : {}),
      },
    ];
  });
  return clauses.length > 0 ? clauses : null;
}

/** Who a catalog entry may be pointed at. What it does decides it when the entry says nothing: a
 *  heal or a buff goes to the actor's own side, anything else to the other one. */
function targetsOf(mechanics: RulesetCatalogMechanics): RulesetCombatAction["targets"] {
  // A `utility` entry is only ever here because it changes what the turn may hold, and what it
  // changes is the holder's own economy: there is nobody to point it at.
  if (mechanics.kind === "utility") return { side: "self", count: 0 };
  const side = mechanics.targets ?? (mechanics.kind === "heal" || mechanics.kind === "buff" ? "ally" : "enemy");
  return { side, count: Math.max(1, mechanics.targetCount ?? 1) };
}

function abilityAction(
  definition: RulesetDefinition,
  source: RulesetCombatAbilitySource,
  sourceIndex: number,
  rowIndex: number,
  name: string,
  entry: RulesetCatalogEntry,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): RulesetCombatAction | null {
  const mechanics = entry.mechanics;
  if (!mechanics) return null;
  // A reaction answers something, and `reaction: true` says only that much. An entry that names no
  // moment is on no menu at all: not a turn's, because it is not taken on a turn, and not a
  // window's, because nothing here knows which window it belongs in.
  if (mechanics.reaction === true) return null;
  // `false` says the same as leaving it out: not a reaction at all.
  const moment = typeof mechanics.reaction === "object" ? mechanics.reaction : undefined;
  // A `utility` entry has nothing to resolve unless it changes what the turn itself may hold: one
  // that hands a budget back, lets its holder buy a standard action with another one, or stops
  // something from happening at all. Calling something off IS what such an entry does.
  const cancels = moment?.cancels === true;
  if (mechanics.kind === "utility" && !mechanics.gives && !mechanics.standard && !cancels) return null;
  const resolve = (ref: RulesetValueRef) => resolveRulesetValueRef(definition, build, ref, evaluated);
  const amount = amountOf(mechanics.amount);
  // A scaling amount grows in DICE: the table says how many to add at each step of what it reads.
  const extra = mechanics.scales
    ? Math.max(0, Math.trunc(lookupStepTable(mechanics.scales.table, resolve(mechanics.scales.from))))
    : 0;
  const scaled = amount ? { ...amount, count: amount.count + (amount.count > 0 ? extra : 0) } : null;
  const heals = mechanics.kind === "heal";
  const sourceDifficulty = source.saveDifficulty ? resolve(source.saveDifficulty) : 0;
  const cost = mechanics.cost?.length === 1 ? mechanics.cost[0]! : undefined;
  const pool = cost ? definition.sheet.live.pools.find((entry2) => entry2.id === cost.pool) : undefined;
  const family = cost ? (pool ? pool.group : cost.pool) : undefined;
  const action: RulesetCombatAction = {
    id: `ability:${sourceIndex}:${rowIndex}`,
    kind: "ability",
    label: name,
    budget: mechanics.budget ?? source.budget,
    targets: targetsOf(mechanics),
    ...(moment
      ? {
          reaction: {
            on: moment.on,
            // The schema defaults it, but a caller handing entries in unparsed does not, and an
            // `undefined` here would not survive the trip through JSON the state has to make.
            at: moment.at ?? "source",
            ...(moment.cancels ? { cancels: true as const } : {}),
          },
        }
      : {}),
    use: {
      name,
      ...(cost ? { pool: cost.pool } : {}),
      // A cost names a live pool, and then the family is that pool's, or it names the family
      // itself. Left out entirely when there is no family: the state is written as JSON, and a key
      // holding nothing would not survive the trip.
      ...(family ? { group: family } : {}),
      ...(mechanics.perCostStep
        ? { perCostStep: amountOf(mechanics.perCostStep) ?? { count: 0, sides: 0, flat: 0 } }
        : {}),
    },
  };
  const plus = clausesOf(mechanics.plus, sourceDifficulty);
  if (scaled && heals) action.heal = scaled;
  else if (scaled) {
    action.damage = {
      ...scaled,
      ...(mechanics.damageType ? { type: mechanics.damageType } : {}),
      ...(plus ? { plus } : {}),
    };
  }
  const temporary = amountOf(mechanics.temporary);
  if (temporary) action.temporary = temporary;
  // An entry that rolls to hit always rolls: a source that names no bonus adds nothing to the dice.
  // Leaving `toHit` unset here would send it down the no-roll path and land it automatically.
  if (mechanics.attackRoll) action.toHit = source.toHit ? resolve(source.toHit) : 0;
  if (mechanics.autoHit) action.autoHit = true;
  if (mechanics.save) {
    action.save = { save: mechanics.save.save, onSuccess: mechanics.save.onSuccess, difficulty: sourceDifficulty };
  }
  if (source.saveDifficulty) action.saveDifficulty = sourceDifficulty;
  if (mechanics.applies?.length) action.applies = mechanics.applies.map((entry2) => ({ ...entry2 }));
  if (mechanics.concentration) action.concentration = true;
  // What the turn's own economy makes of it: free of a budget, handing budgets back, or letting
  // its holder buy a standard action with a budget other than the main one.
  if (mechanics.free) action.free = true;
  if (mechanics.gives?.length) action.gives = mechanics.gives.map((gift) => ({ ...gift }));
  if (mechanics.standard) {
    action.standard = { actions: [...mechanics.standard.actions], budget: mechanics.standard.budget };
  }
  // Distance, in the unit this CATALOG declared, or the combat block's when it declared none. A
  // range of zero is self or touch, and touching somebody else is the next cell: a REACH of one,
  // never a range, so the rules for shooting (a foe beside the shooter, long range) do not read it.
  // A shape keeps its range even at zero, because there the number says how far off it may be aimed.
  if (perCell !== undefined) {
    if (mechanics.range === 0 && !mechanics.area) action.reach = 1;
    else if (mechanics.range !== undefined) action.range = { normal: rulesetInCells(mechanics.range, perCell) };
    if (mechanics.area) {
      action.area = {
        shape: mechanics.area.shape,
        size: rulesetInCells(mechanics.area.size, perCell),
        ...(mechanics.friendlyFire === false ? { friendlyFire: false } : {}),
      };
    }
  }
  return action;
}

/** Whether one cell of a row says yes. A rider reads a column rather than a word, so a ruleset says
 *  "the rows you can do this with" in its own list without the Engine knowing what a weapon is. */
function truthyColumn(row: Record<string, unknown>, column: string): boolean {
  const value = columnValue(row, column);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The attack actions one rider fires on, resolved once when the fight begins.
 *
 * Undefined is "any hit at all", which is what a rider that names neither an attack list nor a
 * column means. Naming either turns into the ids of the rows that qualify, so the resolution never
 * reads a sheet again: the row a rider needs may have been edited by then.
 */
function riderActionIds(
  combat: RulesetCombat,
  build: RulesetSheetBuild,
  rider: NonNullable<RulesetCatalogMechanics["rider"]>,
): string[] | undefined {
  if (!rider.sources && !rider.requires) return undefined;
  const ids: string[] = [];
  (combat.attacks ?? []).forEach((source, index) => {
    if (rider.sources && !rider.sources.includes(source.list)) return;
    const rows = build.lists?.[source.list];
    if (!Array.isArray(rows)) return;
    rows.forEach((raw, rowIndex) => {
      if (!raw || typeof raw !== "object") return;
      if (rider.requires && !truthyColumn(raw as Record<string, unknown>, rider.requires.column)) return;
      ids.push(`attack:${index}:${rowIndex}`);
    });
  });
  return ids;
}

/** The name a row answers to: the column the Game Master sees it under, then the entry's label. */
function rowName(definition: RulesetDefinition, listId: string, row: Record<string, unknown>, fallback: string) {
  const list = definition.sheet.lists.find((entry) => entry.id === listId);
  const column =
    definition.gm.sheetSummary.lists.find((entry) => entry.list === listId)?.nameColumn ??
    list?.pools?.nameColumn ??
    list?.columns.find((entry) => entry.type === "text")?.id;
  return textFromColumn(row, column) ?? fallback;
}

/** One rider a catalog entry carries, with its dice grown by the sheet exactly as an amount's are
 *  and the rows it fires on already worked out. */
function riderFrom(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  id: string,
  label: string,
  mechanics: RulesetCatalogMechanics,
): RulesetCombatRider | null {
  const declared = mechanics.rider;
  const amount = declared ? amountOf(declared.amount) : null;
  if (!declared || !amount) return null;
  const extra = mechanics.scales
    ? Math.max(
        0,
        Math.trunc(
          lookupStepTable(
            mechanics.scales.table,
            resolveRulesetValueRef(definition, build, mechanics.scales.from, evaluated),
          ),
        ),
      )
    : 0;
  const actions = riderActionIds(combat, build, declared);
  return {
    id,
    label,
    on: declared.on,
    ...(actions ? { actions } : {}),
    ...(declared.when?.length ? { when: [...declared.when] } : {}),
    oncePer: declared.oncePer,
    amount: { ...amount, count: amount.count + (amount.count > 0 ? extra : 0) },
    ...(declared.type ? { type: declared.type } : {}),
  };
}

function abilityActions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  source: RulesetCombatAbilitySource,
  index: number,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): { actions: RulesetCombatAction[]; riders: RulesetCombatRider[] } {
  const rows = build.lists?.[source.list];
  if (!Array.isArray(rows)) return { actions: [], riders: [] };
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  /** A catalog states what its own `range` and `area.size` numbers mean; one that does not is read
   *  in the combat block's own unit. */
  const perCellOf = (ref: string) => {
    if (perCell === undefined) return undefined;
    const catalogId = ref.slice(0, ref.indexOf("/"));
    return definition.catalogs?.find((catalog) => catalog.id === catalogId)?.units?.distance?.perCell ?? perCell;
  };
  const actions: RulesetCombatAction[] = [];
  const riders: RulesetCombatRider[] = [];
  const seen = new Set<string>();
  rows.forEach((raw, rowIndex) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    const ref = columnValue(row, RULESET_CATALOG_ROW_KEY);
    // A hand-typed row says nothing in numbers, so there is nothing to resolve.
    if (typeof ref !== "string" || seen.has(ref)) return;
    const always = source.alwaysWhen && columnValue(row, source.alwaysWhen.column) === source.alwaysWhen.equals;
    if (!always && source.onlyWhen && columnValue(row, source.onlyWhen) !== true) return;
    const entry = byRef.get(ref);
    if (!entry) return;
    const name = rowName(definition, source.list, row, entry.label);
    // A rider is passive: it never becomes an action, and it is carried by whoever holds the row.
    if (entry.mechanics?.kind === "rider") {
      const rider = riderFrom(
        definition,
        combat,
        build,
        evaluated,
        `rider:${index}:${rowIndex}`,
        name,
        entry.mechanics,
      );
      if (!rider) return;
      seen.add(ref);
      riders.push(rider);
      return;
    }
    const action = abilityAction(definition, source, index, rowIndex, name, entry, build, evaluated, perCellOf(ref));
    if (!action) return;
    seen.add(ref);
    actions.push(action);
  });
  return { actions, riders };
}

/** Only the entries this member's own rows point at, so the state stays small enough to persist
 *  while `use` still knows what every ability costs. */
function narrowCatalogs(build: RulesetSheetBuild, catalogs: RulesetCatalogEntriesById): RulesetCatalogEntriesById {
  const refs = new Set<string>();
  for (const rows of Object.values(build.lists ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const ref =
        row && typeof row === "object"
          ? columnValue(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY)
          : undefined;
      if (typeof ref === "string") refs.add(ref);
    }
  }
  const narrowed: Record<string, RulesetCatalogEntry[]> = {};
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    const kept = entries.filter((entry) => refs.has(`${catalogId}/${entry.id}`));
    if (kept.length > 0) narrowed[catalogId] = kept;
  }
  return narrowed;
}

function blockActions(block: RulesetStatBlockLike, perCell: number | undefined): RulesetCombatAction[] {
  const idOf = (index: number) => block.actions[index]?.id ?? `block:${index}`;
  const indexById = new Map(block.actions.map((action, index) => [action.id ?? `block:${index}`, index]));
  /** A block writes its distances in the ruleset's own unit, and a plain number is the ordinary
   *  distance with nothing beyond it. A range of zero is no range at all, as it is on an attack row:
   *  the action is a swing at its reach, never a shot. */
  const rangeOf = (range: RulesetStatBlockAction["range"]) => {
    if (range === undefined || perCell === undefined) return undefined;
    const written = typeof range === "number" ? range : range.normal;
    if (written <= 0) return undefined;
    const normal = rulesetInCells(written, perCell);
    const long =
      typeof range === "number" || range.long === undefined ? undefined : rulesetInCells(range.long, perCell);
    return { normal, ...(long !== undefined && long > normal ? { long } : {}) };
  };
  return block.actions.map((action, index) => ({
    id: idOf(index),
    kind: "block" as const,
    label: action.name,
    budget: action.budget,
    // A sequence may be pointed at as many targets as all of its parts together, so a caller can
    // send each strike somewhere else. Fewer is legal too: every part takes the ones it was given.
    targets: {
      side: "enemy" as const,
      count: action.sequence
        ? Math.max(
            1,
            action.sequence.reduce((total, step) => {
              const named = block.actions[indexById.get(step.action) ?? -1];
              return total + (named ? Math.max(1, named.targetCount ?? 1) * step.times : 0);
            }, 0),
          )
        : Math.max(1, action.targetCount ?? 1),
    },
    ...(action.toHit !== undefined ? { toHit: action.toHit } : {}),
    ...(action.autoHit ? { autoHit: true } : {}),
    ...(action.damage
      ? {
          damage: {
            ...action.damage,
            ...(action.damage.plus ? { plus: action.damage.plus.map((clause) => ({ ...clause })) } : {}),
          },
        }
      : {}),
    ...(action.save ? { save: { ...action.save } } : {}),
    ...(action.saveDifficulty !== undefined ? { saveDifficulty: action.saveDifficulty } : {}),
    ...(action.applies?.length ? { applies: action.applies.map((entry) => ({ ...entry })) } : {}),
    ...(action.uses ? { uses: { ...action.uses } } : {}),
    ...(action.recharge ? { recharge: { dice: { ...action.recharge.dice }, from: action.recharge.from } } : {}),
    ...(action.sequence
      ? {
          sequence: action.sequence.flatMap((step) =>
            indexById.has(step.action) ? [{ actionId: step.action, times: step.times }] : [],
          ),
        }
      : {}),
    ...(action.signature ? { signature: { cost: action.signature.cost } } : {}),
    // A reach written as 0 is no reach, exactly as a weapon column reading 0 is: without it a
    // creature that only shoots would be read as swinging, and could strike a passer-by.
    ...(perCell !== undefined && action.reach !== undefined && action.reach > 0
      ? { reach: rulesetInCells(action.reach, perCell) }
      : {}),
    ...(rangeOf(action.range) ? { range: rangeOf(action.range)! } : {}),
    ...(perCell !== undefined && action.area
      ? {
          area: {
            shape: action.area.shape,
            size: rulesetInCells(action.area.size, perCell),
            ...(action.area.friendlyFire === false ? { friendlyFire: false } : {}),
          },
        }
      : {}),
  }));
}

/**
 * A combatant built from a sheet: every number it fights with read off the ruleset's own
 * declarations. A party member is one, and so is an opponent whose creature carries a sheet, which
 * is why this is one function rather than two that could drift apart.
 */
function sheetCombatant(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  input: {
    id: string;
    name: string;
    side: RulesetCombatant["side"];
    initiativeRoll: number[];
    build: RulesetSheetBuild;
    live: RulesetLiveState;
    catalogs: RulesetCatalogEntriesById;
    perCell: number | undefined;
  },
): RulesetCombatant {
  const { build, perCell } = input;
  // Against the fighter's live state as the fight found it, so a value that reads a track or a pool
  // (a speed an injury slows) is the one this fight uses.
  const evaluated = evaluateRulesetSheetLive(definition, build, input.live);
  const catalogs = narrowCatalogs(build, input.catalogs);
  const modifier = combat.initiative.modifier
    ? resolveRulesetValueRef(definition, build, combat.initiative.modifier, evaluated)
    : 0;
  const saves: Record<string, number> = {};
  for (const save of definition.sheet.saves) {
    saves[save.id] = rulesetCheckModifier(evaluated, {
      type: "save",
      id: save.id,
      label: save.label,
      ...(save.ability ? { ability: save.ability } : {}),
    });
  }
  const abilities = (combat.abilities ?? []).map((source, index) =>
    abilityActions(definition, combat, source, index, build, catalogs, evaluated, perCell),
  );
  const actions = [
    ...(combat.attacks ?? []).flatMap((source, index) =>
      attackActions(definition, source, index, build, evaluated, perCell),
    ),
    ...abilities.flatMap((entry) => entry.actions),
  ];
  const riders = abilities.flatMap((entry) => entry.riders);
  return {
    id: input.id,
    name: input.name,
    side: input.side,
    initiativeRoll: input.initiativeRoll,
    initiativeModifier: modifier,
    initiative: sumOf(input.initiativeRoll) + modifier,
    budgets: fullBudgets(combat),
    actions,
    uses: startingUses(actions),
    spent: [],
    ...(riders.length > 0 ? { riders } : {}),
    tracked: [],
    concentrating: null,
    flags: {},
    down: false,
    dying: false,
    stable: false,
    defeated: false,
    defense: Math.round(resolveRulesetValueRef(definition, build, combat.defense, evaluated)),
    saves,
    speed: combat.economy.movement ? resolveRulesetValueRef(definition, build, combat.economy.movement, evaluated) : 0,
    sheet: { build, live: input.live, catalogs },
  };
}

/** What an action still has left of itself, before anything is spent on it. */
function startingUses(actions: readonly RulesetCombatAction[]): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const action of actions) if (action.uses) uses[action.id] = action.uses.count;
  return uses;
}

type RulesetStatBlockLike = NonNullable<RulesetCombatant["block"]>;

/** Full budgets, as a fresh turn and a fresh round hand them out. */
export function refreshRulesetBudgets(combat: RulesetCombat, budgets: Record<string, number>, per: "turn" | "round") {
  for (const budget of combat.economy.budgets) {
    if (budget.per === per) budgets[budget.id] = budget.count;
  }
}

function fullBudgets(combat: RulesetCombat): Record<string, number> {
  const budgets: Record<string, number> = {};
  for (const budget of combat.economy.budgets) budgets[budget.id] = budget.count;
  return budgets;
}

/**
 * How far this combatant may walk in one turn, in CELLS: their own speed in the ruleset's own unit,
 * divided by what a cell is worth and rounded DOWN, and never less than one while they can move at
 * all. A condition that stops them moving makes it nothing.
 *
 * Rounded down rather than up, because a turn's movement is a budget a player spends: rounding it
 * up would quietly hand every fast thing an extra cell it was never given.
 */
export function rulesetMovementAllowance(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): number {
  const perCell = combat.distance?.perCell;
  if (perCell === undefined || !(perCell > 0)) return 0;
  if (rulesetCombatEffects(definition, combat, combatant, state).has("speed-zero")) return 0;
  const speed = combatant.speed;
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.max(1, Math.floor(speed / perCell));
}

/** The allowance back to full at the start of the holder's own turn. */
export function refreshRulesetMovement(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): void {
  if (combatant.movement === undefined) return;
  const allowance = rulesetMovementAllowance(definition, combat, combatant, state);
  combatant.movement = allowance;
  combatant.movementLeft = allowance;
}

// ── Starting the fight ──

export interface RulesetEncounterInput {
  definition: RulesetDefinition;
  seed: number;
  combatants: RulesetCombatantInput[];
  /** The bestiary catalogs an opponent given as `{ creature: ... }` is looked up in. Fetching them
   *  is the caller's job, exactly as it is for a party member's own catalogs. */
  bestiary?: RulesetCatalogEntriesById;
  /** A caller with its own dice. The seeded roller is used when none is given. */
  roller?: RulesetCombatRoller;
  /**
   * The board this fight stands on, and where everybody starts. The grid is the tactical engine's
   * own, generated by the caller: a fight never makes one of its own.
   *
   * A fight is positioned only when the ruleset says what a cell is worth (`combat.distance`) AND
   * every combatant in it has a cell. Anything less and the board is left out entirely, so a fight
   * is never half on a grid.
   */
  board?: { grid: TacticalGrid; placements: Record<string, { x: number; y: number }>; battlefield?: unknown };
}

/**
 * A fight, ready for its first turn. Initiative is rolled once, here, as the kind says: a tie goes
 * to the higher modifier, and then to the order the combatants were handed in, so the same input
 * and the same seed always produce the same order.
 *
 * A ruleset with no `combat` block cannot resolve a fight, so it comes back as an encounter with
 * nobody in it rather than throwing: the caller reads the outcome and falls back to what it did
 * before.
 */
export function createRulesetEncounter(input: RulesetEncounterInput): RulesetEncounterState {
  const { definition, seed } = input;
  const combat = definition.combat;
  const state: RulesetEncounterState = {
    v: 1,
    ruleset: { id: definition.id, version: definition.version },
    seed,
    cursor: 0,
    round: 1,
    turn: 0,
    order: [],
    combatants: [],
    opening: [],
  };
  if (!combat) return state;

  let rolls = 0;
  const roller = input.roller ?? rulesetCombatRoller(seed, 0);
  const roll: RulesetCombatRoller = (sides) => {
    rolls += 1;
    return roller(sides);
  };
  // What every distance in this fight is measured in. Undefined is a ruleset that gives no size to
  // a cell, and then nothing about distance is read at all: the fight is exactly what it was before.
  const perCell = combat.distance?.perCell;

  const refused: RulesetCombatEvent[] = [];
  for (const entry of input.combatants) {
    if (entry.side === "enemy") {
      // A bestiary reference that names nothing is left out of the fight rather than walked in with
      // no numbers, and the opening says so.
      const block =
        "block" in entry
          ? entry.block
          : rulesetCreatureBlock(definition, findRulesetCreatureEntry(input.bestiary ?? {}, entry.creature));
      if (!block) {
        refused.push({ type: "refused", actorId: entry.id, reason: "unknown-creature" });
        continue;
      }
      const initiativeRoll = rollRulesetDice(roll, combat.initiative.dice.count, combat.initiative.dice.sides);
      if (block.sheet) {
        // Described in the ruleset's own terms, so built exactly as a party member is: its health,
        // defense, saves, speed, initiative and the abilities on its lists all come from what the
        // ruleset declares. The sheet exists for this fight only and is written back nowhere. What
        // the block adds on top (its own actions, points, riders and the damage it shrugs off)
        // is kept beside it.
        const combatant = sheetCombatant(definition, combat, {
          id: entry.id,
          name: entry.name,
          side: "enemy",
          initiativeRoll,
          build: block.sheet,
          live: {},
          catalogs: input.bestiary ?? {},
          perCell,
        });
        combatant.actions = [...combatant.actions, ...blockActions(block, perCell)];
        combatant.uses = startingUses(combatant.actions);
        if (block.signaturePoints !== undefined) {
          combatant.signature = { points: block.signaturePoints, max: block.signaturePoints };
        }
        if (block.riders?.length) {
          combatant.riders = [...(combatant.riders ?? []), ...block.riders.map((rider) => ({ ...rider }))];
        }
        combatant.block = block;
        // A sheet that gives it no health at all is a creature that could never be hurt or ever
        // stand: left out, and the opening says why, rather than walked in as something unkillable.
        const health = rulesetCombatHealth(definition, combat, combatant);
        if (health.max <= 0) {
          refused.push({ type: "refused", actorId: entry.id, reason: "no-health" });
          continue;
        }
        state.combatants.push(combatant);
        continue;
      }
      // A block that is neither: no sheet, and missing a number it cannot fight without. A schema
      // keeps every shipped creature out of here; this keeps a hand-built one out too.
      if (!isRulesetPlainStatBlock(block)) {
        refused.push({ type: "refused", actorId: entry.id, reason: "unknown-creature" });
        continue;
      }
      // Dice health is thrown once, here, so the same seed always builds the same opponent.
      const health = block.healthDice
        ? sumOf(rollRulesetDice(roll, block.healthDice.count, block.healthDice.sides)) + block.healthDice.flat
        : block.health;
      const max = Math.max(1, health);
      const actions = blockActions(block, perCell);
      state.combatants.push({
        id: entry.id,
        name: entry.name,
        side: "enemy",
        initiativeRoll,
        initiativeModifier: block.initiativeModifier,
        initiative: sumOf(initiativeRoll) + block.initiativeModifier,
        budgets: fullBudgets(combat),
        actions,
        uses: startingUses(actions),
        spent: [],
        ...(block.signaturePoints !== undefined
          ? { signature: { points: block.signaturePoints, max: block.signaturePoints } }
          : {}),
        ...(block.riders?.length ? { riders: block.riders.map((rider) => ({ ...rider })) } : {}),
        tracked: [],
        concentrating: null,
        flags: {},
        down: false,
        dying: false,
        stable: false,
        defeated: false,
        defense: block.defense,
        saves: { ...(block.saves ?? {}) },
        speed: block.speed ?? 0,
        block,
        health: { value: max, max, temp: 0 },
      });
      continue;
    }
    const initiativeRoll = rollRulesetDice(roll, combat.initiative.dice.count, combat.initiative.dice.sides);
    const combatant = sheetCombatant(definition, combat, {
      id: entry.id,
      name: entry.name,
      side: "party",
      initiativeRoll,
      build: entry.build,
      live: readStoredLive(entry.live),
      catalogs: entry.catalogs ?? {},
      perCell,
    });
    // A member who walked in at zero is already down, which is the honest reading of their sheet.
    const health = rulesetCombatHealth(definition, combat, combatant);
    if (health.value <= 0 && health.max > 0) {
      combatant.down = true;
      combatant.dying = !!combat.dying;
      if (combat.dying?.condition) {
        writeRulesetSheet(definition, combatant, { op: "condition", condition: combat.dying.condition, active: true });
      }
    }
    state.combatants.push(combatant);
  }

  placeRulesetCombatants(definition, combat, state, input.board);

  const position = new Map(state.combatants.map((combatant, index) => [combatant.id, index]));
  state.order = [...state.combatants]
    .sort(
      (a, b) =>
        b.initiative - a.initiative ||
        b.initiativeModifier - a.initiativeModifier ||
        (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
    )
    .map((combatant) => combatant.id);
  state.cursor = rolls;
  state.opening = [
    ...refused,
    {
      type: "initiative",
      entries: state.order.flatMap((id) => {
        const combatant = rulesetCombatant(state, id);
        return combatant
          ? [
              {
                actorId: id,
                roll: combatant.initiativeRoll,
                modifier: combatant.initiativeModifier,
                total: combatant.initiative,
              },
            ]
          : [];
      }),
    },
    { type: "round", round: 1 },
    ...(state.order[0] ? ([{ type: "turn", actorId: state.order[0], round: 1 }] as RulesetCombatEvent[]) : []),
  ];
  return state;
}

/**
 * Everybody onto the board, or nobody at all.
 *
 * A fight is positioned only when the ruleset says what a cell is worth and every single combatant
 * has a cell inside the grid. One missing placement leaves the whole fight where it was, because a
 * fight where one combatant has no position is one where nothing about distance can be answered.
 */
function placeRulesetCombatants(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  board: RulesetEncounterInput["board"],
): void {
  if (!board || !combat.distance) return;
  const { grid } = board;
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height)) return;
  const placed: Array<{ combatant: RulesetCombatant; at: { x: number; y: number } }> = [];
  for (const combatant of state.combatants) {
    const at = board.placements[combatant.id];
    if (
      !at ||
      !Number.isInteger(at.x) ||
      !Number.isInteger(at.y) ||
      at.x < 0 ||
      at.y < 0 ||
      at.x >= grid.width ||
      at.y >= grid.height
    ) {
      return;
    }
    placed.push({ combatant, at });
  }
  for (const { combatant, at } of placed) {
    combatant.x = at.x;
    combatant.y = at.y;
    const allowance = rulesetMovementAllowance(definition, combat, combatant);
    combatant.movement = allowance;
    combatant.movementLeft = allowance;
  }
  state.board = {
    grid,
    ...(board.battlefield ? { battlefield: board.battlefield as RulesetCombatBoard["battlefield"] } : {}),
  };
}

/** The stored live blob as the encounter keeps it. `applyRulesetSheetOp` already reads a stored
 *  blob tolerantly, so an empty object is a member with nothing spent. */
function readStoredLive(stored: unknown): RulesetLiveState {
  return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as RulesetLiveState) : {};
}
