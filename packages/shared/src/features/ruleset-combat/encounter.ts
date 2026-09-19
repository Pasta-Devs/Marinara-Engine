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
  type RulesetDefinition,
  type RulesetSheetBuild,
  type RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import {
  applyRulesetSheetOp,
  readRulesetLive,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "../rulesets/live-state.js";
import { rulesetCatalogEntriesByRef } from "../rulesets/scaled-rows.js";
import {
  evaluateRulesetSheet,
  lookupStepTable,
  resolveRulesetValueRef,
  rulesetCheckModifier,
  type EvaluatedRulesetSheet,
} from "../rulesets/sheet-math.js";
import { deriveSubSeed, mulberry32 } from "../tactical-combat/rng.js";
import type {
  RulesetCombatAction,
  RulesetCombatAmount,
  RulesetCombatant,
  RulesetCombatantInput,
  RulesetCombatEvent,
  RulesetCombatRoller,
  RulesetEncounterState,
} from "./types.js";

/** The seeded roller a server uses: the tactical engine's own stream, one die per tick, so a fight
 *  replays from its seed and the choices that were made. A caller that has its own dice (a test
 *  with a written sequence) passes those instead. */
export function rulesetCombatRoller(seed: number, cursor: number): RulesetCombatRoller {
  let tick = cursor;
  return (sides) => Math.floor(mulberry32(deriveSubSeed(seed, tick++))() * sides) + 1;
}

/** A face this die actually has. A roller that hands back something else is a caller's bug, and it
 *  costs that one die rather than the fight. */
function face(value: number, sides: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(sides, Math.max(1, Math.floor(value)));
}

/** Throw `count` dice, in order. */
export function rollRulesetDice(roll: RulesetCombatRoller, count: number, sides: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < Math.max(0, Math.min(100, Math.floor(count))); i++) rolls.push(face(roll(sides), sides));
  return rolls;
}

export function sumOf(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `2d6`, `1d8+3` or a plain number, as a sheet's dice column happens to hold it. A dice column is
 *  free text, so anything else reads as no dice at all rather than failing a turn. */
export function parseRulesetCombatDice(text: unknown): RulesetCombatAmount | null {
  // A dice column is short by its own schema; anything longer is not dice, and saying so first
  // keeps every pattern below on a string of bounded length.
  if (typeof text !== "string" || text.length > 40) return null;
  // Spaces are allowed around the parts ("2d6 + 3") and nowhere inside a number ("1 2d6" is not
  // twelve dice), so the parts are split on the letter and the sign rather than matched with a
  // pattern full of optional whitespace.
  const trimmed = text.trim();
  const split = /^([^dD]*)[dD]([^+-]*)([+-].*)?$/.exec(trimmed);
  const whole = (part: string | undefined, max: number) => {
    const digits = (part ?? "").trim();
    return /^\d+$/.test(digits) && digits.length <= max ? Number(digits) : null;
  };
  const count = split ? whole(split[1], 3) : null;
  const sides = split ? whole(split[2], 4) : null;
  const bonus = split?.[3] ? whole(split[3].slice(1), 4) : 0;
  if (!split || count === null || sides === null || bonus === null) {
    const flat = Number(trimmed);
    return trimmed !== "" && Number.isFinite(flat) && flat !== 0
      ? { count: 0, sides: 0, flat: Math.trunc(flat) }
      : null;
  }
  return { count, sides, flat: split[3]?.startsWith("-") ? -bonus : bonus };
}

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

/** Health as it stands. A party member's lives in their sheet, so it is read from there every time
 *  rather than copied into the encounter, and a reload mid-fight is exact. */
export function rulesetCombatHealth(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): RulesetCombatHealth {
  // A copy, always: an opponent's health lives in the state, and a caller that read it before a
  // blow has to still be holding what it was before.
  if (!combatant.sheet) return { ...(combatant.health ?? { value: 0, max: 0, temp: 0 }) };
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  const pool = live.pools.find((entry) => !entry.listId && entry.key === combat.health.pool);
  return pool ? { value: pool.value, max: pool.max, temp: pool.temp } : { value: 0, max: 0, temp: 0 };
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

/** What those conditions DO, as the closed effect list. */
export function rulesetCombatEffects(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): Set<string> {
  const effects = new Set<string>();
  const active = new Set(rulesetCombatConditions(definition, combatant));
  for (const entry of combat.conditions ?? []) {
    if (!active.has(entry.condition)) continue;
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
): boolean {
  const active = new Set(rulesetCombatConditions(definition, combatant));
  return (combat.conditions ?? []).some(
    (entry) => active.has(entry.condition) && entry.failsSaves?.includes(save) === true,
  );
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

function attackActions(
  source: RulesetCombatAttackSource,
  index: number,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
): RulesetCombatAction[] {
  const rows = build.lists?.[source.list];
  if (!Array.isArray(rows)) return [];
  const actions: RulesetCombatAction[] = [];
  rows.forEach((raw, rowIndex) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    const name = textFromColumn(row, source.name);
    const dice = parseRulesetCombatDice(columnValue(row, source.damage.dice.column));
    if (!name || !dice) return;
    const proficient = columnValue(row, source.toHit.proficiency?.column) === true;
    actions.push({
      id: `attack:${index}:${rowIndex}`,
      kind: "attack",
      label: name,
      budget: source.budget,
      targets: { side: "enemy", count: 1 },
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

/** Who a catalog entry may be pointed at. What it does decides it when the entry says nothing: a
 *  heal or a buff goes to the actor's own side, anything else to the other one. */
function targetsOf(mechanics: RulesetCatalogMechanics): RulesetCombatAction["targets"] {
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
): RulesetCombatAction | null {
  const mechanics = entry.mechanics;
  // A reaction is a timing window a later slice owns, and a `utility` entry has nothing to resolve.
  if (!mechanics || mechanics.kind === "utility" || mechanics.reaction) return null;
  const resolve = (ref: RulesetValueRef) => resolveRulesetValueRef(definition, build, ref, evaluated);
  const amount = amountOf(mechanics.amount);
  // A scaling amount grows in DICE: the table says how many to add at each step of what it reads.
  const extra = mechanics.scales
    ? Math.max(0, Math.trunc(lookupStepTable(mechanics.scales.table, resolve(mechanics.scales.from))))
    : 0;
  const scaled = amount ? { ...amount, count: amount.count + (amount.count > 0 ? extra : 0) } : null;
  const heals = mechanics.kind === "heal";
  const cost = mechanics.cost?.length === 1 ? mechanics.cost[0]! : undefined;
  const pool = cost ? definition.sheet.live.pools.find((entry2) => entry2.id === cost.pool) : undefined;
  const family = cost ? (pool ? pool.group : cost.pool) : undefined;
  const action: RulesetCombatAction = {
    id: `ability:${sourceIndex}:${rowIndex}`,
    kind: "ability",
    label: name,
    budget: mechanics.budget ?? source.budget,
    targets: targetsOf(mechanics),
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
  if (scaled && heals) action.heal = scaled;
  else if (scaled) action.damage = { ...scaled, ...(mechanics.damageType ? { type: mechanics.damageType } : {}) };
  const temporary = amountOf(mechanics.temporary);
  if (temporary) action.temporary = temporary;
  // An entry that rolls to hit always rolls: a source that names no bonus adds nothing to the dice.
  // Leaving `toHit` unset here would send it down the no-roll path and land it automatically.
  if (mechanics.attackRoll) action.toHit = source.toHit ? resolve(source.toHit) : 0;
  if (mechanics.autoHit) action.autoHit = true;
  if (mechanics.save) {
    action.save = {
      save: mechanics.save.save,
      onSuccess: mechanics.save.onSuccess,
      difficulty: source.saveDifficulty ? resolve(source.saveDifficulty) : 0,
    };
  }
  if (source.saveDifficulty) action.saveDifficulty = resolve(source.saveDifficulty);
  if (mechanics.applies?.length) action.applies = mechanics.applies.map((entry2) => ({ ...entry2 }));
  if (mechanics.concentration) action.concentration = true;
  return action;
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

function abilityActions(
  definition: RulesetDefinition,
  source: RulesetCombatAbilitySource,
  index: number,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  evaluated: EvaluatedRulesetSheet,
): RulesetCombatAction[] {
  const rows = build.lists?.[source.list];
  if (!Array.isArray(rows)) return [];
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const actions: RulesetCombatAction[] = [];
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
    const action = abilityAction(
      definition,
      source,
      index,
      rowIndex,
      rowName(definition, source.list, row, entry.label),
      entry,
      build,
      evaluated,
    );
    if (!action) return;
    seen.add(ref);
    actions.push(action);
  });
  return actions;
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

function blockActions(block: RulesetStatBlockLike): RulesetCombatAction[] {
  return block.actions.map((action, index) => ({
    id: action.id ?? `block:${index}`,
    kind: "block" as const,
    label: action.name,
    budget: action.budget,
    targets: { side: "enemy" as const, count: Math.max(1, action.targetCount ?? 1) },
    ...(action.toHit !== undefined ? { toHit: action.toHit } : {}),
    ...(action.autoHit ? { autoHit: true } : {}),
    ...(action.damage ? { damage: { ...action.damage } } : {}),
    ...(action.save ? { save: { ...action.save } } : {}),
    ...(action.saveDifficulty !== undefined ? { saveDifficulty: action.saveDifficulty } : {}),
    ...(action.applies?.length ? { applies: action.applies.map((entry) => ({ ...entry })) } : {}),
  }));
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

// ── Starting the fight ──

export interface RulesetEncounterInput {
  definition: RulesetDefinition;
  seed: number;
  combatants: RulesetCombatantInput[];
  /** A caller with its own dice. The seeded roller is used when none is given. */
  roller?: RulesetCombatRoller;
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

  for (const entry of input.combatants) {
    const initiativeRoll = rollRulesetDice(roll, combat.initiative.dice.count, combat.initiative.dice.sides);
    if (entry.side === "enemy") {
      const block = entry.block;
      state.combatants.push({
        id: entry.id,
        name: entry.name,
        side: "enemy",
        initiativeRoll,
        initiativeModifier: block.initiativeModifier,
        initiative: sumOf(initiativeRoll) + block.initiativeModifier,
        budgets: fullBudgets(combat),
        actions: blockActions(block),
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
        health: { value: block.health, max: block.health, temp: 0 },
      });
      continue;
    }
    const build = entry.build;
    const evaluated = evaluateRulesetSheet(definition, build);
    const catalogs = narrowCatalogs(build, entry.catalogs ?? {});
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
    const actions = [
      ...(combat.attacks ?? []).flatMap((source, index) => attackActions(source, index, build, evaluated)),
      ...(combat.abilities ?? []).flatMap((source, index) =>
        abilityActions(definition, source, index, build, catalogs, evaluated),
      ),
    ];
    const combatant: RulesetCombatant = {
      id: entry.id,
      name: entry.name,
      side: "party",
      initiativeRoll,
      initiativeModifier: modifier,
      initiative: sumOf(initiativeRoll) + modifier,
      budgets: fullBudgets(combat),
      actions,
      tracked: [],
      concentrating: null,
      flags: {},
      down: false,
      dying: false,
      stable: false,
      defeated: false,
      defense: Math.round(resolveRulesetValueRef(definition, build, combat.defense, evaluated)),
      saves,
      speed: combat.economy.movement
        ? resolveRulesetValueRef(definition, build, combat.economy.movement, evaluated)
        : 0,
      sheet: { build, live: readStoredLive(entry.live), catalogs },
    };
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

/** The stored live blob as the encounter keeps it. `applyRulesetSheetOp` already reads a stored
 *  blob tolerantly, so an empty object is a member with nothing spent. */
function readStoredLive(stored: unknown): RulesetLiveState {
  return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as RulesetLiveState) : {};
}
