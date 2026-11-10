// Live state of a ruleset character sheet: the part of a sheet that changes during play, on top of
// the static build the sheet editor writes.
//
// It is stored SPARSE and read TOLERANTLY. Only a value somebody changed is stored; everything else
// reads as its declared default, so a pool that starts full follows its maximum when a level-up
// raises it, and junk in the stored blob costs that one entry rather than the whole sheet. Writes
// normalise the other way: a value back at its default drops out of the store again, so it starts
// following the maximum once more.
//
// Nothing here is system-specific. Every pool, track, text field, condition and rest comes from the
// definition, so a 2d6 game whose only pool is an empty-start "stress" track works exactly as well
// as a d20 game with spell slots.

import { z } from "zod";
import {
  RULESET_CONDITIONS_MAX,
  RULESET_CATALOG_ROW_KEY,
  RULESET_STANDS_FOR_ROW_KEY,
  rulesetSheetBuildSchema,
  storedRulesetSheetsSchema,
  RULESET_WOUND_EXTRA_PER_ROW,
  RULESET_WOUND_LEVELS_MAX,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCatalogMechanics,
  type RulesetDefinition,
  type RulesetList,
  type RulesetLiveTrack,
  type RulesetSheetBuild,
  type RulesetTrackKind,
  type RulesetTrackLevel,
  type RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import { withoutTrailingKind } from "../../utils/trailing-kind.js";
import { rulesetCatalogEntriesByRef } from "./scaled-rows.js";
import { rulesetContentMemo, rulesetPlanMemo } from "./plan-memo.js";
import { parseRulesetCombatDice } from "../ruleset-combat/dice.js";
import {
  evaluateRulesetSheet,
  defaultRulesetSheetBuild,
  isRulesetItemHidden,
  lookupStepTable,
  resolveRulesetValueRef,
  roundRulesetNumber,
  rulesetCheckModifier,
  rulesetSheetMigrationSteps,
  rulesetFieldMax,
  type RulesetSheetItem,
  type EvaluatedRulesetSheet,
} from "./sheet-math.js";

export interface RulesetLivePoolValue {
  value: number;
  temp?: number;
  /** Points lost that only a rest gives back (Capability API 1.193): a sword of wounding's. A
   *  restore never lifts the pool past its maximum less these; any rest clears them. */
  sealed?: number;
  /** The part of `sealed` no rest gives back (Capability API 1.203), only something that unseals:
   *  a clay golem's Slam. */
  lasting?: number;
  /** How many it holds past its maximum (Capability API 1.252): Font of Magic's spell slots. A rest
   *  that sets the pool back to its maximum takes them away. */
  above?: number;
}

/** What one WOUND TRACK carries in play. The definition holds `kinds`; this holds MARKS, which are
 *  those kinds sitting on the track. The two words never swap, in code, comments or docs. */
export interface RulesetLiveWounds {
  /** Kind ids, sorted most severe first. `marks[i]` sits on the track's level `i`. */
  marks: string[];
  /** Marks that could not land because the track was full at its worst kind. Persisted, because a
   *  reload that forgot them would quietly undo harm somebody already took. */
  overflow?: number;
}

export interface RulesetLiveState {
  pools?: Record<string, RulesetLivePoolValue>;
  tracks?: Record<string, number>;
  /** Wound tracks only, keyed by track id. A plain track's number stays in `tracks`. */
  wounds?: Record<string, RulesetLiveWounds>;
  text?: Record<string, string>;
  conditions?: string[];
  /** Live states away from their default, keyed by state id: the value they are at. */
  states?: Record<string, string>;
  /** What each condition's rests took off health's maximum for good (1.261), keyed by condition
   *  id, for one that gives it back when it is cured (`restoredWhenCured`). */
  lowered?: Record<string, number>;
  /** What each condition raises health's maximum by while it is held (1.473), keyed by condition
   *  id: 5e's Aid. Dropped once the condition is. */
  raised?: Record<string, number>;
  /** Abilities raised for good (1.516), by ability id: onto the score, and onto its most. */
  abilities?: Record<string, { score: number; max: number }>;
  /** Whom an entry used once a creature until a rest went to (1.304), by name, keyed `rest|action`:
   *  that rest clears its lists. */
  usedOn?: Record<string, string[]>;
  /** Days of game time counted since each spent row whose recharge takes days was spent (1.445),
   *  keyed by pool. */
  waited?: Record<string, number>;
  /** Saves made as days pass (1.526), keyed by the condition they end: which save, against what,
   *  how many days apart, and the days counted toward the next. Feeblemind's, every 30 days. */
  daySaves?: Record<string, RulesetLiveDaySave>;
  /** Days left of each condition that lasts so many (1.663), keyed by condition: Quivering Palm's. */
  dayClocks?: Record<string, number>;
  /** How many days each day its holder rests counts as, against `dayClocks` (1.756): Wish's stress's 2. */
  dayRests?: Record<string, number>;
  /** The inventory stack whose item keeps each condition on while it is worn (1.664), keyed by
   *  condition: Armor of Invulnerability's. */
  wornFrom?: Record<string, string>;
  /** The one entry or creature action each condition wards its holder off (1.758), keyed by
   *  condition, as it was picked: Wish's. */
  wardsOff?: Record<string, string>;
  /** What each entry used outside a fight called and keeps (1.798), keyed by the entry's name: the
   *  creature it called, as it was named ("" for its only one). It joins every fight its caller is
   *  in until it is dismissed or killed: Find Familiar's familiar. */
  called?: Record<string, string>;
  /** The shape an entry used outside a fight put its user in and keeps them in (1.801): the entry's
   *  name, the form's, and the form's own health once a fight has taken some. They start every fight
   *  in it until it ends: a druid's Wild Shape. */
  shaped?: RulesetLiveShaped;
  /** Down at no health and stable, by the ruleset's dying rule: stabilised in a fight, or in the story
   *  by its dying successes. The next fight starts them stable rather than dying again (cheap-GM
   *  playtest 2026-10-26: a hero stabilised in the story rolled death saves again in the next fight).
   *  Read only while their health is at none. */
  stable?: true;
  /** When each rest was last taken, by rest id (laptop playtest 2026-10-26: two long rests written in
   *  back-to-back turns both gave everything back). A second of one kind is refused in that reply and
   *  the next, and with no time passed on the game's clock since. */
  rested?: Record<string, RulesetLiveRested>;
}

/** A rest as it was last taken: the game clock's minute then, where the game keeps one, and `fresh`
 *  while it was taken in the reply that left this state. */
export interface RulesetLiveRested {
  at?: number;
  fresh?: true;
}

/** A shape kept on a sheet from a use outside a fight (1.801). */
export interface RulesetLiveShaped {
  entry: string;
  as: string;
  health?: number;
  /** The form's whole health as its first fight rolled it, kept so the next does not roll it again. */
  max?: number;
}

/** A save a held condition is made against as days pass (Capability API 1.526). */
export interface RulesetLiveDaySave {
  save: string;
  difficulty: number;
  every: number;
  waited?: number;
  /** The saves it takes to end it (1.750), and how many have been made: Pale tincture's seven. */
  successes?: number;
  made?: number;
  /** Dealt to health on each failed save (1.750), its damage kept off healing while it holds when
   *  `keeps`. */
  harm?: { dice?: string; flat?: number; type?: string };
  keeps?: true;
}

/** Live state of every card, keyed by normalized name, plus RULESET_PARTY_KEY for the shared sheet. */
export type RulesetLiveStates = Record<string, RulesetLiveState>;

/** A stored live blob is refused above this many serialized bytes, like a stored sheet is. */
export const RULESET_LIVE_MAX_BYTES = 64 * 1024;

/** Bounds for the PATCH boundary. They are deliberately far above any ruleset the format allows
 *  (60 declared pools plus a list's rows), so only a hostile or corrupt blob meets them. */
const MAX_LIVE_CHARACTERS = 64;
const MAX_LIVE_POOLS = 600;
const MAX_LIVE_KEY_LENGTH = 200;
const MAX_LIVE_TRACKS = 30;
const MAX_LIVE_TEXTS = 12;
const MAX_LIVE_TEXT_LENGTH = 500;
// As many as a sheet may declare (320 since Capability API 1.269, 160 from 1.188).
const MAX_LIVE_CONDITIONS = RULESET_CONDITIONS_MAX;
const MAX_LIVE_CONDITION_LENGTH = 80;
const MAX_LIVE_STATES = 30;
const MAX_LIVE_STATE_VALUE_LENGTH = 80;
const MAX_LIVE_USED_ON = 40;
const MAX_LIVE_USED_ON_NAMES = 60;
const liveUsedOnNames = z.array(z.string().max(MAX_LIVE_KEY_LENGTH)).max(MAX_LIVE_USED_ON_NAMES);
/** Every stored number is an integer in this range, so no arithmetic here can reach an unsafe one. */
const MAX_LIVE_NUMBER = 1_000_000;
/** What one command may move at once. A bigger number is a typo or a model inventing damage. */
const MAX_OP_AMOUNT = 100_000;

const liveNumber = z.number().int().min(-MAX_LIVE_NUMBER).max(MAX_LIVE_NUMBER);
// Built once: reading a stored live state runs for every combatant on every read.
const liveTextValue = z.string().max(MAX_LIVE_TEXT_LENGTH);
const liveStateValue = z.string().max(MAX_LIVE_STATE_VALUE_LENGTH);

export const rulesetLivePoolValueSchema = z
  .object({
    value: liveNumber,
    temp: liveNumber.min(0).optional(),
    sealed: liveNumber.min(0).optional(),
    lasting: liveNumber.min(0).optional(),
    /** How many it holds past its maximum (1.252): spell slots Font of Magic made, which go when a
     *  rest sets the pool back to its maximum. */
    above: liveNumber.min(0).optional(),
  })
  .strict();

/** A track holds at most one mark per level, and the format caps how long one character's track may
 *  come to, so a longer list is a corrupt or hostile blob rather than a sheet. Kind ids are sheet
 *  ids, so they are short; an indexed track stores "" for an empty box between marked ones. */
export const rulesetLiveWoundsSchema = z
  .object({
    marks: z.array(z.string().max(MAX_LIVE_KEY_LENGTH)).max(RULESET_WOUND_LEVELS_MAX),
    overflow: liveNumber.min(0).optional(),
  })
  .strict();

function boundedRecord<T extends z.ZodTypeAny>(values: T, maxEntries: number, what: string) {
  return z.record(z.string(), values).superRefine((record, ctx) => {
    const keys = Object.keys(record);
    if (keys.length > maxEntries) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `At most ${maxEntries} ${what} can be stored` });
    }
    for (const key of keys) {
      if (key.length > MAX_LIVE_KEY_LENGTH) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Key is too long" });
      }
    }
  });
}

const liveAbilityRaiseSchema = z
  .object({ score: z.number().int().min(0).max(1000), max: z.number().int().min(0).max(1000) })
  .strict();

const liveDayClock = z.number().int().min(1).max(3650);
const liveDayRest = z.number().int().min(2).max(7);
const liveStackId = z.string().min(1).max(MAX_LIVE_KEY_LENGTH);
/** The creature a kept call called (1.798), by name: "" for an entry that calls only one. */
const liveCalledValue = z.string().max(MAX_LIVE_KEY_LENGTH);
const MAX_LIVE_CALLED = 20;
const liveRestedSchema = z
  .object({ at: z.number().int().min(0).max(1_000_000_000).optional(), fresh: z.literal(true).optional() })
  .strict();
/** As many as a ruleset may declare. */
const MAX_LIVE_RESTED = 12;
const liveShapedSchema = z
  .object({
    entry: z.string().min(1).max(MAX_LIVE_KEY_LENGTH),
    as: z.string().min(1).max(MAX_LIVE_KEY_LENGTH),
    health: z.number().int().min(0).max(MAX_LIVE_NUMBER).optional(),
    max: z.number().int().min(1).max(MAX_LIVE_NUMBER).optional(),
  })
  .strict();

const liveDaySaveSchema = z
  .object({
    save: z.string().min(1).max(MAX_LIVE_KEY_LENGTH),
    difficulty: z.number().int().min(-100).max(1000),
    every: z.number().int().min(1).max(3650),
    waited: z.number().int().min(0).max(3650).optional(),
    successes: z.number().int().min(1).max(10).optional(),
    made: z.number().int().min(0).max(10).optional(),
    harm: z
      .object({
        dice: z.string().min(1).max(40).optional(),
        flat: z.number().int().min(0).max(1000).optional(),
        type: z.string().min(1).max(40).optional(),
      })
      .strict()
      .optional(),
    keeps: z.literal(true).optional(),
  })
  .strict();

/** One character's live state. Unknown top-level keys are stripped rather than refused: a newer
 *  Engine's key must not make the whole game's state unwritable on an older one. */
export const rulesetLiveStateSchema = z
  .object({
    pools: boundedRecord(rulesetLivePoolValueSchema, MAX_LIVE_POOLS, "pools").optional(),
    tracks: boundedRecord(liveNumber, MAX_LIVE_TRACKS, "tracks").optional(),
    wounds: boundedRecord(rulesetLiveWoundsSchema, MAX_LIVE_TRACKS, "wound tracks").optional(),
    text: boundedRecord(liveTextValue, MAX_LIVE_TEXTS, "text fields").optional(),
    conditions: z.array(z.string().max(MAX_LIVE_CONDITION_LENGTH)).max(MAX_LIVE_CONDITIONS).optional(),
    states: boundedRecord(liveStateValue, MAX_LIVE_STATES, "states").optional(),
    lowered: boundedRecord(liveNumber, MAX_LIVE_CONDITIONS, "lowered maximums").optional(),
    raised: boundedRecord(liveNumber.min(0), MAX_LIVE_CONDITIONS, "raised maximums").optional(),
    /** Abilities raised for good, by ability id (1.516): onto the score, and onto its most. */
    abilities: boundedRecord(liveAbilityRaiseSchema, MAX_LIVE_CONDITIONS, "raised abilities").optional(),
    usedOn: boundedRecord(liveUsedOnNames, MAX_LIVE_USED_ON, "used-on lists").optional(),
    waited: boundedRecord(liveNumber, MAX_LIVE_POOLS, "days waited").optional(),
    daySaves: boundedRecord(liveDaySaveSchema, MAX_LIVE_CONDITIONS, "saves made as days pass").optional(),
    dayClocks: boundedRecord(liveDayClock, MAX_LIVE_CONDITIONS, "days conditions last").optional(),
    dayRests: boundedRecord(liveDayRest, MAX_LIVE_CONDITIONS, "days resting counts as").optional(),
    wornFrom: boundedRecord(liveStackId, MAX_LIVE_CONDITIONS, "conditions worn items keep on").optional(),
    wardsOff: boundedRecord(liveStackId, MAX_LIVE_CONDITIONS, "what conditions ward off").optional(),
    called: boundedRecord(liveCalledValue, MAX_LIVE_CALLED, "kept calls").optional(),
    shaped: liveShapedSchema.optional(),
    stable: z.literal(true).optional(),
    rested: boundedRecord(liveRestedSchema, MAX_LIVE_RESTED, "rests taken").optional(),
  })
  .strip();

function liveStateBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** The whole game's live state, as a PATCH route receives it. */
export const rulesetLiveStatesSchema = boundedRecord(
  rulesetLiveStateSchema,
  MAX_LIVE_CHARACTERS,
  "characters",
).superRefine((states, ctx) => {
  // Measured on what would be STORED, so the strip above cannot be worked around with padding.
  const bytes = liveStateBytes(states);
  if (bytes > RULESET_LIVE_MAX_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Live sheet state is ${bytes} bytes, over the ${RULESET_LIVE_MAX_BYTES}-byte limit`,
    });
  }
});

// ── What a sheet's live pools are ──

export interface RulesetLivePoolSpec {
  key: string;
  label: string;
  max: number;
  allowTemp: boolean;
  group?: string;
  start: "full" | "empty";
  /** Where the pool starts when its `startFrom` reads it off the sheet (1.158), else `start` decides. */
  startAt?: number;
  recharge?: string;
  listId?: string;
  /** Counted up rather than spent (1.801): its row's `tallyColumn` is set, and it reads as how many
   *  times it has been used, `max - value`. */
  tally?: true;
}

/** A sheet id can never contain ":", so a list row's pool key can never collide with a declared one. */
const LIST_POOL_SEPARATOR = ":";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function own<T>(record: Record<string, T> | undefined, key: string): T | undefined {
  return record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/** Every pool this sheet currently has: the declared ones a `hideWhen` does not hide and whose
 *  maximum is above zero, then one pool per row of every list that declares `pools`. A row is keyed
 *  by its name, so renaming a row starts its pool over — that is the format's own rule. */
export function listRulesetLivePools(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  /** The items the character holds, whose stats a maximum may read: an Amulet of Health's
   *  Constitution in the hit point maximum. A maximum never reads the live state itself (refused at
   *  import), so nothing else of it is needed. */
  items?: ReadonlyArray<RulesetSheetItem>,
): RulesetLivePoolSpec[] {
  const evaluated = items?.length
    ? evaluateRulesetSheet(definition, build, { pools: [], tracks: [], items })
    : evaluateRulesetSheet(definition, build);
  const pools: RulesetLivePoolSpec[] = [];
  const seen = new Set<string>();

  for (const pool of definition.sheet.live.pools) {
    if (isRulesetItemHidden(pool, build, definition)) continue;
    const max = Math.min(MAX_LIVE_NUMBER, Math.floor(resolveRulesetValueRef(definition, build, pool.max, evaluated)));
    // A pool with no maximum is not a resource the character has; a caster's 9th-level slots at 0
    // must read as "you have no such thing", never as "you have none left".
    if (!(max > 0)) continue;
    seen.add(pool.id);
    pools.push({
      key: pool.id,
      label: pool.label,
      max,
      allowTemp: pool.allowTemp,
      start: pool.start,
      ...(pool.startFrom
        ? {
            startAt: clamp(
              Math.floor(resolveRulesetValueRef(definition, build, pool.startFrom, evaluated)) || 0,
              0,
              max,
            ),
          }
        : {}),
      ...(pool.group ? { group: pool.group } : {}),
    });
  }

  for (const list of definition.sheet.lists) {
    // A hidden list is not on the sheet, so neither are its rows' pools.
    if (!list.pools || isRulesetItemHidden(list, build, definition)) continue;
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const { nameColumn, maxColumn, rechargeColumn, tallyColumn } = list.pools;
    for (const row of rows) {
      if (pools.length >= MAX_LIVE_POOLS) break;
      if (!row || typeof row !== "object") continue;
      const rawName = own(row as Record<string, unknown>, nameColumn);
      const name = typeof rawName === "string" ? rawName.trim() : "";
      const rawMax = own(row as Record<string, unknown>, maxColumn);
      const max = typeof rawMax === "number" && Number.isFinite(rawMax) ? Math.floor(rawMax) : 0;
      if (!name || !(max > 0)) continue;
      const key = `${list.id}${LIST_POOL_SEPARATOR}${name.toLowerCase()}`;
      // Two rows under one name are one pool; the first row wins, as the key already decided.
      if (seen.has(key)) continue;
      seen.add(key);
      const recharge = rechargeColumn ? own(row as Record<string, unknown>, rechargeColumn) : undefined;
      const tally = tallyColumn ? own(row as Record<string, unknown>, tallyColumn) : undefined;
      pools.push({
        key,
        label: name,
        max: Math.min(MAX_LIVE_NUMBER, max),
        allowTemp: false,
        start: "full",
        listId: list.id,
        ...(typeof recharge === "string" && recharge ? { recharge } : {}),
        ...(tally === true || (typeof tally === "number" && tally > 0) ? { tally: true as const } : {}),
      });
    }
  }
  return pools;
}

// ── Reading stored state ──

/** A wound track as it stands. Present on a resolved track only when the definition gave it
 *  `levels` or `boxes`; a plain track has none of this and behaves exactly as it always has. */
export interface ResolvedRulesetWounds {
  /** This character's levels: the named ones with any a list adds, or the numbered boxes. */
  levels: readonly RulesetTrackLevel[];
  kinds: readonly RulesetTrackKind[];
  /** `marks[i]` sits on `levels[i]`. Most severe first on a sequential track; on an indexed one each
   *  mark stays on its box and an empty box between marked ones is "". */
  marks: string[];
  /** How many boxes are marked, which on an indexed track is not how long `marks` is. */
  filled: number;
  /** The worst marked level, or -1 when the track is clear. */
  lowest: number;
  /** Marks that could not land at all, because the track was full at its worst kind. */
  overflow: number;
  /** The penalty in force: on named levels the one on the LOWEST marked level, never a sum (0 when
   *  unmarked); on boxes, the track's table read at the boxes filled or remaining. */
  penalty: number;
  /** Boxes rather than named levels, so a level's label is only its number. */
  numbered: boolean;
  /** A mark lands on the box a command names and the marks never move. */
  indexed: boolean;
  /** A mark with no box free is refused rather than upgrading the lightest one. */
  refusesWhenFull: boolean;
}

export interface ResolvedRulesetLive {
  pools: Array<RulesetLivePoolSpec & { value: number; temp: number; sealed: number; lasting: number }>;
  tracks: Array<{
    id: string;
    label: string;
    min: number;
    max: number;
    value: number;
    /** Where a plain track starts (its `default`, or `startFrom` read off the sheet). */
    start?: number;
    wound?: ResolvedRulesetWounds;
  }>;
  text: Array<{ id: string; label: string; maxLength: number; value: string }>;
  conditions: Array<{ id: string; label: string; active: boolean }>;
  /** Every state the sheet shows, at its value: what is stored when the state still offers it, else
   *  its default. A state the sheet hides is left out. */
  states: Array<{
    id: string;
    label: string;
    values: string[];
    valueLabels?: Record<string, string>;
    value: string;
    /** The value's display text. */
    valueLabel: string;
  }>;
  /** Abilities raised for good (1.516), by ability id. */
  abilityRaises?: Readonly<Record<string, { score: number; max: number }>>;
}

// ── Wound tracks ──
//
// The rules, written down here because a vague implementation produces the wrong track:
//
// - A SEQUENTIAL track (the default) holds its marks SORTED, MOST SEVERE FIRST. A track of 7 levels
//   holds at most 7 marks. A mark is PLACED IN SEVERITY ORDER among the marks already there, never
//   appended: it takes the highest level its severity earns and pushes lighter marks down.
// - An INDEXED track puts a mark on the box the command names, or the next free one above it, and
//   never moves a mark once it is down. With no such box free the whole command is refused.
// - The PENALTY IN FORCE on named levels is the one on the LOWEST MARKED LEVEL, not the sum of the
//   marked ones, and no marks means no penalty. On boxes it is the track's table read at the number
//   of boxes filled or remaining, whatever that number is.
// - An `amount` is a number of marks of one kind, APPLIED ONE AT A TIME, so a track that fills
//   partway through is handled by the same rule as one that was already full.
// - Marking a FULL track UPGRADES ITS LOWEST-SEVERITY MARK by one step instead of adding a mark.
//   The incoming kind is not what it upgrades to: one step up the declared ladder is. A mark that
//   would upgrade past the highest severity is kept at the highest, and the one that could not land
//   is counted as an OVERFLOW, which is persisted. A track that says `onFull: "refuse"` refuses the
//   whole command instead, and an indexed track always does.
// - HEALING is the same op with a negative amount, clearing the LIGHTEST marks first (on an indexed
//   track, the highest box among equally light ones). Naming a kind clears only marks of that kind.
//   Overflow clears before marks do, either way.
// - A track may be shorter for this character than the marks stored on it (a row that added levels
//   was deleted). The marks that no longer fit are overflow, not forgotten: harm is not undone by
//   editing the sheet.

/** Whether this track is a wound track rather than a bounded integer. */
export function isRulesetWoundTrack(track: RulesetLiveTrack): boolean {
  return (!!track.levels || !!track.boxes) && !!track.kinds;
}

/** The declared kinds, sorted least severe first, which is the ladder an upgrade climbs. */
function kindLadder(track: RulesetLiveTrack): RulesetTrackKind[] {
  return [...(track.kinds ?? [])].sort((a, b) => a.severity - b.severity);
}

/**
 * The levels this character's wound track has. Named levels come with any a list adds: each row of
 * `extra` inserts its count of levels after the last level whose penalty is as good, named after
 * that level when the penalty is the same and by the penalty otherwise. Boxes are as many as the
 * track's own `max` works out to, numbered, each carrying the penalty the table gives when it is the
 * last box marked. Never longer than RULESET_WOUND_LEVELS_MAX.
 */
function woundLevels(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  track: RulesetLiveTrack,
  maxOf: (track: RulesetLiveTrack) => number,
): RulesetTrackLevel[] {
  if (track.boxes) {
    const count = clamp(maxOf(track), 0, RULESET_WOUND_LEVELS_MAX);
    const { by, table } = track.boxes.penalty;
    return Array.from({ length: count }, (_, index) => ({
      label: String(index + 1),
      penalty: lookupStepTable(table, by === "filled" ? index + 1 : count - index - 1),
    }));
  }
  const levels = [...(track.levels ?? [])];
  const extra = track.extra;
  const list = extra ? definition.sheet.lists.find((entry) => entry.id === extra.list) : undefined;
  const rows = extra ? build.lists?.[extra.list] : undefined;
  if (extra && list && Array.isArray(rows) && !isRulesetItemHidden(list, build, definition)) {
    const columnDefault = (id: string) => {
      const column = list.columns.find((entry) => entry.id === id);
      return column?.type === "number" ? (column.default ?? 0) : 0;
    };
    const cell = (row: unknown, id: string) => {
      const value = row && typeof row === "object" ? own(row as Record<string, unknown>, id) : undefined;
      return typeof value === "number" && Number.isFinite(value) ? value : columnDefault(id);
    };
    for (const row of rows) {
      const count = clamp(Math.floor(cell(row, extra.countColumn)), 0, RULESET_WOUND_EXTRA_PER_ROW);
      const penalty = clamp(Math.round(cell(row, extra.penaltyColumn)), -1000, 0);
      let after = -1;
      levels.forEach((level, index) => {
        if (level.penalty >= penalty) after = index;
      });
      const beside = levels[after];
      const label = beside && beside.penalty === penalty ? beside.label : String(penalty);
      levels.splice(after + 1, 0, ...Array.from({ length: count }, () => ({ label, penalty })));
      // A level past the cap can never move back under it, so the rest of the rows change nothing.
      if (levels.length >= RULESET_WOUND_LEVELS_MAX) break;
    }
  }
  return levels.slice(0, RULESET_WOUND_LEVELS_MAX);
}

/** A working wound track: the marks as severities, so every rule below is plain number work. On a
 *  sequential track `marks` is dense and sorted most severe first; on an indexed one it has a slot
 *  per box, null where the box is clear. */
interface WoundWork {
  ladder: RulesetTrackKind[];
  length: number;
  indexed: boolean;
  refuse: boolean;
  marks: Array<number | null>;
  overflow: number;
}

function woundWork(
  track: RulesetLiveTrack,
  levels: readonly RulesetTrackLevel[],
  stored: RulesetLiveWounds | undefined,
): WoundWork {
  const ladder = kindLadder(track);
  const severityOf = new Map(ladder.map((kind) => [kind.id, kind.severity]));
  const length = levels.length;
  const indexed = track.fill === "indexed";
  let overflow = Math.max(0, Math.floor(stored?.overflow ?? 0));
  // A mark of a kind the ruleset no longer declares cannot sit anywhere on the ladder, so it is
  // dropped on the way in. Sorting here is what makes a hand-edited blob read as the rules say.
  const read = (stored?.marks ?? []).map((id) => severityOf.get(id) ?? null);
  let marks: Array<number | null>;
  if (indexed) {
    marks = Array.from({ length }, (_, index) => read[index] ?? null);
    overflow += read.slice(length).filter((mark) => mark !== null).length;
  } else {
    const dense = read.filter((mark): mark is number => mark !== null).sort((a, b) => b - a);
    marks = dense.slice(0, length);
    overflow += dense.length - marks.length;
  }
  return { ladder, length, indexed, refuse: indexed || track.onFull === "refuse", marks, overflow };
}

function filledOf(work: WoundWork): number {
  return work.marks.filter((mark) => mark !== null).length;
}

/** Put one mark of `severity` where its severity earns it, pushing lighter marks down. */
function placeMark(work: WoundWork, severity: number): void {
  const at = work.marks.findIndex((mark) => mark !== null && mark < severity);
  if (at === -1) work.marks.push(severity);
  else work.marks.splice(at, 0, severity);
}

/** One mark of one kind on a sequential track that upgrades, by the rules above. */
function markOnce(work: WoundWork, severity: number): void {
  if (work.marks.length < work.length) return placeMark(work, severity);
  // Full. The marks are sorted most severe first, so the last one is the lowest severity there is.
  const lowest = work.marks[work.marks.length - 1]!;
  const next = work.ladder.find((kind) => kind.severity > lowest);
  if (!next) {
    work.overflow += 1;
    return;
  }
  work.marks.pop();
  placeMark(work, next.severity);
}

/** Clear one mark: overflow first, then the lightest (of `severity` alone when one is named), the
 *  highest box among equals. False when there was nothing left to clear. */
function healOnce(work: WoundWork, severity: number | undefined): boolean {
  if (work.overflow > 0) {
    work.overflow -= 1;
    return true;
  }
  let at = -1;
  work.marks.forEach((mark, index) => {
    if (mark === null || (severity !== undefined && mark !== severity)) return;
    if (at === -1 || mark <= work.marks[at]!) at = index;
  });
  if (at === -1) return false;
  if (work.indexed) work.marks[at] = null;
  else work.marks.splice(at, 1);
  return true;
}

/** Apply `amount` marks of one kind, or `-amount` healing, one at a time. False when a track that
 *  refuses has no box for every mark, and then nothing was changed. */
function applyWoundAmount(
  work: WoundWork,
  severity: number,
  amount: number,
  options: { box?: number; healSeverity?: number } = {},
): boolean {
  if (amount < 0) {
    for (let i = 0; i < -amount; i++) if (!healOnce(work, options.healSeverity)) break;
    return true;
  }
  if (work.indexed) {
    // Every box is found before any is marked, so a command that cannot land whole lands not at all.
    const from = Math.max(0, (options.box ?? 1) - 1);
    const planned: number[] = [];
    for (let i = 0; i < amount; i++) {
      let at = -1;
      for (let box = from; box < work.length; box++) {
        if (work.marks[box] === null && !planned.includes(box)) {
          at = box;
          break;
        }
      }
      if (at === -1) return false;
      planned.push(at);
    }
    for (const box of planned) work.marks[box] = severity;
    return true;
  }
  if (work.refuse) {
    if (work.length - work.marks.length < amount) return false;
    for (let i = 0; i < amount; i++) placeMark(work, severity);
    return true;
  }
  const top = work.ladder[work.ladder.length - 1]?.severity;
  for (let i = 0; i < amount; i++) {
    // Once the track is full at its worst kind, nothing can land any more and every remaining mark
    // is one more overflow. Counted in one step because the answer cannot change again.
    if (work.marks.length === work.length && work.marks[work.marks.length - 1] === top) {
      work.overflow += amount - i;
      return true;
    }
    markOnce(work, severity);
  }
  return true;
}

/** The stored shape again, with the kinds put back on the severities. An indexed track keeps its
 *  empty boxes as "" so each mark stays where it landed; trailing ones are left off. */
function woundState(work: WoundWork): RulesetLiveWounds {
  const idOf = new Map(work.ladder.map((kind) => [kind.severity, kind.id]));
  const marks = work.marks.map((severity) => (severity === null ? "" : (idOf.get(severity) ?? "")));
  if (!work.indexed) marks.splice(0, marks.length, ...marks.filter(Boolean));
  while (marks.length > 0 && marks[marks.length - 1] === "") marks.pop();
  return {
    marks,
    ...(work.overflow > 0 ? { overflow: Math.min(MAX_LIVE_NUMBER, work.overflow) } : {}),
  };
}

function resolveWounds(
  track: RulesetLiveTrack,
  levels: readonly RulesetTrackLevel[],
  stored: RulesetLiveWounds | undefined,
): ResolvedRulesetWounds {
  const work = woundWork(track, levels, stored);
  const marks = woundState(work).marks;
  const filled = filledOf(work);
  let lowest = -1;
  work.marks.forEach((mark, index) => {
    if (mark !== null) lowest = index;
  });
  const boxes = track.boxes?.penalty;
  return {
    levels,
    kinds: track.kinds ?? [],
    marks,
    filled,
    lowest,
    overflow: work.overflow,
    penalty: boxes
      ? lookupStepTable(boxes.table, boxes.by === "filled" ? filled : levels.length - filled)
      : lowest >= 0
        ? (levels[lowest]?.penalty ?? 0)
        : 0,
    numbered: !!track.boxes,
    indexed: work.indexed,
    refusesWhenFull: work.refuse,
  };
}

/**
 * The penalty in force on one named wound track, read from a stored live blob and the character's
 * own build: a track's length may be the sheet's own number, and a list may add levels to it.
 *
 * 0 for a track that does not exist or is not a wound track, so a caller never has to ask which of
 * those it was before it can roll.
 */
export function readRulesetWoundPenalty(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  trackId: string,
): number {
  const track = definition.sheet.live.tracks.find((entry) => entry.id === trackId);
  if (!track || !isRulesetWoundTrack(track)) return 0;
  return readRulesetLive(definition, build, stored).tracks.find((entry) => entry.id === trackId)?.wound?.penalty ?? 0;
}

function keepValid<T>(value: unknown, schema: z.ZodType<T>, maxEntries: number): Record<string, T> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries: Array<[string, T]> = [];
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entries.length >= maxEntries || key.length > MAX_LIVE_KEY_LENGTH) continue;
    const parsed = schema.safeParse(entry);
    if (parsed.success) entries.push([key, parsed.data]);
  }
  // `Object.fromEntries` defines each key, so a stored `__proto__` stays an ordinary key instead of
  // becoming the copy's prototype.
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Everything usable in a stored blob, as a fresh object: every key that still validates on its
 *  own, whether or not the definition still declares it. A pool the sheet hides today may be back
 *  tomorrow, and dropping its value here would silently refill it. */
function readStoredLiveState(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
): RulesetLiveState {
  return migrateLiveState(definition, build, readStoredLiveStateAsIs(stored));
}

/**
 * A stored live state as the current layout reads it (`routeLive`, Capability API 1.77). Live state
 * has no version of its own, so every step runs on every read, and each is safe to: the old key
 * always goes, and its value moves only while the new key is not there yet. A writer reads through
 * here too, so the first write stores the new layout; a value written since (a spent die, a rest
 * that left the new key at its default and so absent) is never overwritten by the old one, because
 * the old one is gone by then.
 *
 * The value goes to the one of the step's cases the (already migrated) sheet shows: a pool with a
 * maximum above 0, a track the sheet does not hide. None or several, and it goes to `else`.
 */
function migrateLiveState(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetLiveState,
): RulesetLiveState {
  const steps = rulesetSheetMigrationSteps(definition).flatMap((step) => ("routeLive" in step ? [step] : []));
  if (steps.length === 0) return state;
  const own = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);
  const trackOf = (id: string) => definition.sheet.live.tracks.find((entry) => entry.id === id);
  let shownPools: Set<string> | null = null;
  for (const step of steps) {
    // A wound track keeps marks and a plain one a number, so a track's value goes where the targets
    // keep theirs (the import holds the targets to one shape). A source of the other shape has nowhere
    // to go, and is dropped all the same.
    const wound = step.routeLive === "track" && isRulesetWoundTrackId(trackOf(step.else));
    if (step.routeLive === "track") {
      const other = wound ? state.tracks : state.wounds;
      if (other && own(other, step.from)) delete other[step.from];
    }
    const bag = (step.routeLive === "pool" ? state.pools : wound ? state.wounds : state.tracks) as
      Record<string, unknown> | undefined;
    if (!bag || !own(bag, step.from)) continue;
    const value = bag[step.from];
    delete bag[step.from];
    let shown: string[];
    if (step.routeLive === "pool") {
      // Only a pool the sheet has (a maximum above 0) is listed at all.
      shownPools ??= new Set(listRulesetLivePools(definition, build).map((spec) => spec.key));
      shown = step.cases.filter((id) => shownPools!.has(id));
    } else {
      shown = step.cases.filter((id) => {
        const track = trackOf(id);
        return !!track && !isRulesetItemHidden(track, build, definition);
      });
    }
    const target = shown.length === 1 ? shown[0]! : step.else;
    if (!own(bag, target)) bag[target] = value;
  }
  return state;
}

function isRulesetWoundTrackId(track: RulesetLiveTrack | undefined): boolean {
  return !!track && isRulesetWoundTrack(track);
}

function readStoredLiveStateAsIs(stored: unknown): RulesetLiveState {
  const source =
    stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const state: RulesetLiveState = {};
  const pools = keepValid(source.pools, rulesetLivePoolValueSchema, MAX_LIVE_POOLS);
  if (pools) state.pools = pools;
  const tracks = keepValid(source.tracks, liveNumber, MAX_LIVE_TRACKS);
  if (tracks) state.tracks = tracks;
  const wounds = keepValid(source.wounds, rulesetLiveWoundsSchema, MAX_LIVE_TRACKS);
  if (wounds) state.wounds = wounds;
  const text = keepValid(source.text, liveTextValue, MAX_LIVE_TEXTS);
  if (text) state.text = text;
  if (Array.isArray(source.conditions)) {
    const conditions = [
      ...new Set(
        source.conditions.filter(
          (entry): entry is string => typeof entry === "string" && entry.length <= MAX_LIVE_CONDITION_LENGTH,
        ),
      ),
    ].slice(0, MAX_LIVE_CONDITIONS);
    if (conditions.length > 0) state.conditions = conditions;
  }
  const states = keepValid(source.states, liveStateValue, MAX_LIVE_STATES);
  if (states) state.states = states;
  const lowered = keepValid(source.lowered, liveNumber, MAX_LIVE_CONDITIONS);
  if (lowered) state.lowered = lowered;
  const raised = keepValid(source.raised, liveNumber.min(0), MAX_LIVE_CONDITIONS);
  if (raised) state.raised = raised;
  const abilities = keepValid(source.abilities, liveAbilityRaiseSchema, MAX_LIVE_CONDITIONS);
  if (abilities) state.abilities = abilities;
  const usedOn = keepValid(source.usedOn, liveUsedOnNames, MAX_LIVE_USED_ON);
  if (usedOn) state.usedOn = usedOn;
  const waited = keepValid(source.waited, liveNumber, MAX_LIVE_POOLS);
  if (waited) state.waited = waited;
  const daySaves = keepValid(source.daySaves, liveDaySaveSchema, MAX_LIVE_CONDITIONS);
  if (daySaves) state.daySaves = daySaves;
  const dayClocks = keepValid(source.dayClocks, liveDayClock, MAX_LIVE_CONDITIONS);
  if (dayClocks) state.dayClocks = dayClocks;
  const dayRests = keepValid(source.dayRests, liveDayRest, MAX_LIVE_CONDITIONS);
  if (dayRests) state.dayRests = dayRests;
  const wornFrom = keepValid(source.wornFrom, liveStackId, MAX_LIVE_CONDITIONS);
  if (wornFrom) state.wornFrom = wornFrom;
  const wardsOff = keepValid(source.wardsOff, liveStackId, MAX_LIVE_CONDITIONS);
  if (wardsOff) state.wardsOff = wardsOff;
  const called = keepValid(source.called, liveCalledValue, MAX_LIVE_CALLED);
  if (called) state.called = called;
  const shaped = liveShapedSchema.safeParse(source.shaped);
  if (shaped.success) state.shaped = shaped.data;
  if (source.stable === true) state.stable = true;
  const rested = keepValid(source.rested, liveRestedSchema, MAX_LIVE_RESTED);
  if (rested) state.rested = rested;
  return state;
}

/** Drop what is back at its default, so the stored blob stays sparse and an empty one is absent. */
function normalizeLiveState(state: RulesetLiveState): RulesetLiveState {
  const normalized: RulesetLiveState = {};
  if (state.pools && Object.keys(state.pools).length > 0) normalized.pools = state.pools;
  if (state.tracks && Object.keys(state.tracks).length > 0) normalized.tracks = state.tracks;
  if (state.wounds && Object.keys(state.wounds).length > 0) normalized.wounds = state.wounds;
  if (state.text && Object.keys(state.text).length > 0) normalized.text = state.text;
  if (state.conditions && state.conditions.length > 0) normalized.conditions = state.conditions;
  if (state.states && Object.keys(state.states).length > 0) normalized.states = state.states;
  if (state.lowered && Object.keys(state.lowered).length > 0) normalized.lowered = state.lowered;
  // A raise lasts while its condition does (1.473).
  const held = new Set(state.conditions ?? []);
  const raised = Object.entries(state.raised ?? {}).filter(([condition, amount]) => held.has(condition) && amount > 0);
  if (raised.length > 0) normalized.raised = Object.fromEntries(raised);
  // Raised for good (1.516): kept through every other change to the sheet.
  if (state.abilities && Object.keys(state.abilities).length > 0) normalized.abilities = state.abilities;
  if (state.usedOn && Object.keys(state.usedOn).length > 0) normalized.usedOn = state.usedOn;
  if (state.waited && Object.keys(state.waited).length > 0) normalized.waited = state.waited;
  // A save made as days pass (1.526) lasts while what it ends does.
  const daySaves = Object.entries(state.daySaves ?? {}).filter(([condition]) => held.has(condition));
  if (daySaves.length > 0) normalized.daySaves = Object.fromEntries(daySaves);
  // So do the days a condition lasts (1.663).
  const dayClocks = Object.entries(state.dayClocks ?? {}).filter(([condition]) => held.has(condition));
  if (dayClocks.length > 0) normalized.dayClocks = Object.fromEntries(dayClocks);
  // And what resting counts against them (1.756).
  const dayRests = Object.entries(state.dayRests ?? {}).filter(
    ([condition]) => held.has(condition) && state.dayClocks?.[condition] !== undefined,
  );
  if (dayRests.length > 0) normalized.dayRests = Object.fromEntries(dayRests);
  // And the item that keeps one on (1.664).
  const wornFrom = Object.entries(state.wornFrom ?? {}).filter(([condition]) => held.has(condition));
  if (wornFrom.length > 0) normalized.wornFrom = Object.fromEntries(wornFrom);
  // And what one wards off (1.758).
  const wardsOff = Object.entries(state.wardsOff ?? {}).filter(([condition]) => held.has(condition));
  if (wardsOff.length > 0) normalized.wardsOff = Object.fromEntries(wardsOff);
  // What a kept call called (1.798) stays until it is dismissed or killed.
  if (state.called && Object.keys(state.called).length > 0) normalized.called = state.called;
  // And a kept shape (1.801) until it ends.
  if (state.shaped) normalized.shaped = state.shaped;
  // Stable at no health, until health or a blow says otherwise.
  if (state.stable) normalized.stable = true;
  // When each rest was last taken, through every other change.
  if (state.rested && Object.keys(state.rested).length > 0) normalized.rested = state.rested;
  return normalized;
}

function resolveLive(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetLiveState,
  /** What the character holds, for the pools' maximums. */
  items?: ReadonlyArray<RulesetSheetItem>,
): ResolvedRulesetLive {
  const active = new Set(state.conditions ?? []);
  // Health's maximum raised by what its conditions raise it by (1.473): Aid.
  const health = definition.combat?.health;
  const healthKey = health && "pool" in health ? health.pool : undefined;
  const raisedBy = Object.entries(state.raised ?? {}).reduce(
    (total, [condition, amount]) => total + (active.has(condition) ? Math.max(0, amount) : 0),
    0,
  );
  // Worked out once, and only when a track's maximum is a value the sheet works out.
  let evaluated: ReturnType<typeof evaluateRulesetSheet> | null = null;
  const trackMax = (track: RulesetDefinition["sheet"]["live"]["tracks"][number]): number => {
    if (typeof track.max === "number") return track.max;
    evaluated ??= evaluateRulesetSheet(definition, build);
    const worked = Math.floor(resolveRulesetValueRef(definition, build, track.max, evaluated));
    // A maximum below the floor is a track with nowhere to go, not one that runs backwards.
    return Math.max(track.min, Math.min(MAX_LIVE_NUMBER, worked));
  };
  return {
    pools: listRulesetLivePools(definition, build, items).map((listed) => {
      const spec =
        raisedBy > 0 && listed.key === healthKey
          ? { ...listed, max: Math.min(MAX_LIVE_NUMBER, listed.max + raisedBy) }
          : listed;
      const entry = own(state.pools, spec.key);
      const fallback = spec.startAt ?? (spec.start === "full" ? spec.max : 0);
      return {
        ...spec,
        // What it holds past its maximum (1.252) counts on top, wherever the stored value stands.
        value: Math.min(MAX_LIVE_NUMBER, clamp(entry?.value ?? fallback, 0, spec.max) + Math.max(0, entry?.above ?? 0)),
        // A pool that carries no buffer can never show one, however the blob got written.
        temp: spec.allowTemp ? Math.max(0, entry?.temp ?? 0) : 0,
        sealed: clamp(entry?.sealed ?? 0, 0, spec.max),
        lasting: clamp(entry?.lasting ?? 0, 0, clamp(entry?.sealed ?? 0, 0, spec.max)),
      };
    }),
    // A track a field takes off the sheet is not on it, exactly as a hidden pool is not.
    tracks: definition.sheet.live.tracks.flatMap((track): ResolvedRulesetLive["tracks"] => {
      if (isRulesetItemHidden(track, build, definition)) return [];
      // A wound track's number is how many marks are on it, and its length is its levels. Its own
      // `min` and `max` are held to 0 and `levels.length` at import, so they agree by construction.
      if (isRulesetWoundTrack(track)) {
        const levels = woundLevels(definition, build, track, trackMax);
        const wound = resolveWounds(track, levels, own(state.wounds, track.id));
        return [
          {
            id: track.id,
            label: track.label,
            min: 0,
            max: wound.levels.length,
            value: wound.filled,
            wound,
          },
        ];
      }
      const max = trackMax(track);
      evaluated ??= track.startFrom ? evaluateRulesetSheet(definition, build) : null;
      const fallback = clamp(
        track.startFrom
          ? Math.floor(resolveRulesetValueRef(definition, build, track.startFrom, evaluated!)) || 0
          : (track.default ?? track.min),
        track.min,
        max,
      );
      return [
        {
          id: track.id,
          label: track.label,
          min: track.min,
          max,
          value: clamp(own(state.tracks, track.id) ?? fallback, track.min, max),
          start: fallback,
        },
      ];
    }),
    text: definition.sheet.live.text.map((entry) => ({
      id: entry.id,
      label: entry.label,
      maxLength: entry.maxLength,
      value: (own(state.text, entry.id) ?? "").slice(0, entry.maxLength),
    })),
    // A condition the definition no longer declares is not shown; its id stays stored in case it
    // comes back, exactly like a hidden pool's value.
    conditions: definition.sheet.live.conditions.map((condition) => ({
      id: condition.id,
      label: condition.label,
      active: active.has(condition.id),
    })),
    // A stored value the state no longer offers reads as its default, as an enum field's does; it
    // stays stored, like a hidden pool's value, in case the value comes back.
    states: definition.sheet.live.states.flatMap((entry) => {
      if (isRulesetItemHidden(entry, build, definition)) return [];
      const stored = own(state.states, entry.id);
      const value = stored !== undefined && entry.values.includes(stored) ? stored : rulesetStateDefault(entry);
      return [
        {
          id: entry.id,
          label: entry.label,
          values: entry.values,
          ...(entry.valueLabels ? { valueLabels: entry.valueLabels } : {}),
          value,
          valueLabel: own(entry.valueLabels, value) ?? value,
        },
      ];
    }),
    ...(state.abilities && Object.keys(state.abilities).length ? { abilityRaises: { ...state.abilities } } : {}),
  };
}

/** A live state with abilities raised for good (1.516): `by` onto each score, `max` onto its most. */
export function raiseRulesetLiveAbilities(
  stored: unknown,
  raises: Readonly<Record<string, { by: number; max?: number }>>,
): RulesetLiveState {
  const state = readStoredLiveStateAsIs(stored);
  const abilities = { ...(state.abilities ?? {}) };
  for (const [id, raise] of Object.entries(raises)) {
    const now = abilities[id] ?? { score: 0, max: 0 };
    abilities[id] = { score: Math.min(1000, now.score + raise.by), max: Math.min(1000, now.max + (raise.max ?? 0)) };
  }
  return { ...state, abilities };
}

/** A live state with a save its holder makes against `condition` as days pass (1.526), counted from
 *  nothing: written as a fight that put it on is over. */
export function rulesetLiveWithDaySave(
  stored: unknown,
  condition: string,
  save: Omit<RulesetLiveDaySave, "waited" | "made">,
): RulesetLiveState {
  const state = readStoredLiveStateAsIs(stored);
  return { ...state, daySaves: { ...state.daySaves, [condition]: { ...save } } };
}

/** A live state with `condition` lasting `days` more (1.663), counted down as days pass: written as
 *  a fight that put it on is over. With `restingCounts` (1.756), each day its holder rests counts as
 *  that many. */
export function rulesetLiveWithDayClock(
  stored: unknown,
  condition: string,
  days: number,
  restingCounts?: number,
): RulesetLiveState {
  const state = readStoredLiveStateAsIs(stored);
  const { [condition]: _was, ...dayRests } = state.dayRests ?? {};
  if (restingCounts !== undefined && restingCounts >= 2) dayRests[condition] = Math.min(7, Math.trunc(restingCounts));
  const next: RulesetLiveState = {
    ...state,
    dayClocks: { ...state.dayClocks, [condition]: Math.max(1, Math.min(3650, Math.trunc(days))) },
  };
  if (Object.keys(dayRests).length > 0) next.dayRests = dayRests;
  else delete next.dayRests;
  return next;
}

/** A live state with `condition` warding its holder off one entry or creature action (1.758),
 *  written as a fight that put it on is over. */
export function rulesetLiveWithWardsOff(stored: unknown, condition: string, pick: string): RulesetLiveState {
  const state = readStoredLiveStateAsIs(stored);
  return { ...state, wardsOff: { ...state.wardsOff, [condition]: pick } };
}

/** A live state with `condition` kept on only while the item on inventory stack `stackId` is worn
 *  (1.664). */
export function rulesetLiveWithWornFrom(stored: unknown, condition: string, stackId: string): RulesetLiveState {
  const state = readStoredLiveStateAsIs(stored);
  return { ...state, wornFrom: { ...state.wornFrom, [condition]: stackId } };
}

/** A live state without what only a worn item kept on (1.664) once that item is not worn: `worn` is
 *  the inventory stacks worn now. Says which conditions came off; the state as it was when none did. */
export function rulesetLiveWornOff(
  stored: unknown,
  worn: ReadonlySet<string>,
): { live: RulesetLiveState; off: string[] } {
  const state = readStoredLiveStateAsIs(stored);
  const off = Object.entries(state.wornFrom ?? {}).flatMap(([condition, stackId]) =>
    worn.has(stackId) ? [] : [condition],
  );
  if (off.length === 0) return { live: state, off };
  const { wornFrom: _wornFrom, ...rest } = state;
  const wornFrom = { ...state.wornFrom };
  for (const condition of off) delete wornFrom[condition];
  return {
    live: {
      ...rest,
      conditions: (state.conditions ?? []).filter((id) => !off.includes(id)),
      ...(Object.keys(wornFrom).length > 0 ? { wornFrom } : {}),
    },
    off: off.filter((condition) => (state.conditions ?? []).includes(condition)),
  };
}

/** Whether a sheet meets what an item asks of whoever binds or uses it (1.667), or the ruleset's
 *  `items.needsWaivedBy` waives it: read off what the sheet is without its items. */
export function rulesetItemNeedsMet(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  needs: ReadonlyArray<{ value: RulesetValueRef; atLeast?: number; atMost?: number }> | undefined,
  any?: boolean,
): boolean {
  if (!needs?.length) return true;
  const read = (ref: RulesetValueRef) => resolveRulesetValueRef(definition, build, ref, evaluated);
  const waiver = definition.items?.needsWaivedBy;
  if (waiver && read(waiver) > 0) return true;
  // Every one, or any one where the item says so (1.691).
  const met = (need: (typeof needs)[number]) => {
    const value = read(need.value);
    return (need.atLeast === undefined || value >= need.atLeast) && (need.atMost === undefined || value <= need.atMost);
  };
  return any ? needs.some(met) : needs.every(met);
}

/** The items as worn as they are: one bound whose `binds.needs` the sheet does not meet (1.667)
 *  reads as not worn. The same list when every one meets them. */
export function rulesetItemsMeetingNeeds<T extends RulesetSheetItem>(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  items: ReadonlyArray<T>,
): ReadonlyArray<T> {
  if (!items.some((held) => held.worn && (held.item.binds?.needs || held.item.statsIf || held.truly?.item.statsIf)))
    return items;
  const evaluated = evaluateRulesetSheetLive(definition, build, stored);
  // What a worn item adds to its stats while its wearer meets a line's needs (1.700).
  const withStats = (item: RulesetSheetItem["item"]): RulesetSheetItem["item"] => {
    const met = (item.statsIf ?? []).filter((line) =>
      rulesetItemNeedsMet(definition, build, evaluated, line.needs, line.needsAny),
    );
    if (!met.length) return item;
    const stats = { ...(item.stats ?? {}) };
    for (const line of met)
      for (const [id, more] of Object.entries(line.add)) {
        const had = stats[id];
        stats[id] = (typeof had === "number" ? had : 0) + more;
      }
    return { ...item, stats };
  };
  return items.map((held) => {
    if (!held.worn) return held;
    if (
      held.item.binds?.needs &&
      !rulesetItemNeedsMet(definition, build, evaluated, held.item.binds.needs, held.item.binds.needsAny)
    )
      return { ...held, worn: false };
    if (!held.item.statsIf && !held.truly?.item.statsIf) return held;
    return {
      ...held,
      item: withStats(held.item),
      ...(held.truly ? { truly: { ...held.truly, item: withStats(held.truly.item) } } : {}),
    };
  });
}

/**
 * A live track read as health (1.383): what it has LEFT out of its length. A wound track's left is
 * its levels still clear; a plain track fills from its floor up to its maximum, so its left is the
 * room still above its value, and a full one is a combatant with nothing left. Neither carries a
 * buffer, so `temp` is always 0.
 */
export function rulesetTrackHealth(track: ResolvedRulesetLive["tracks"][number]): {
  value: number;
  max: number;
  temp: number;
} {
  if (track.wound)
    return { value: track.wound.levels.length - track.wound.filled, max: track.wound.levels.length, temp: 0 };
  return { value: Math.max(0, track.max - track.value), max: Math.max(0, track.max - track.min), temp: 0 };
}

/** The sheet op that moves a health track by `delta` levels LEFT (1.383): fewer left is harm. A
 *  plain track moves by the number, the other way round; a wound track is marked with `kind`, or has
 *  one mark cleared per level given back, which names no kind. */
export function rulesetTrackHealthOp(track: RulesetLiveTrack, delta: number, kind: string): RulesetSheetOp | null {
  const amount = Math.round(Math.abs(delta));
  if (!Number.isFinite(delta) || amount < 1) return null;
  if (!isRulesetWoundTrack(track)) return { op: "track", track: track.id, by: delta < 0 ? amount : -amount };
  return delta < 0
    ? { op: "damage", track: track.id, kind, amount }
    : { op: "damage", track: track.id, kind: "", amount: -amount };
}

/** Where a live state starts, and where a rest's `to: "default"` puts it back. */
export function rulesetStateDefault(state: { values: readonly string[]; default?: string }): string {
  return state.default !== undefined && state.values.includes(state.default) ? state.default : state.values[0]!;
}

/** The sheet's live state as it reads right now. Never throws: junk reads as defaults. */
export function readRulesetLive(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  /** What the character holds, whose stats a pool's maximum may read (an Amulet of Health's
   *  Constitution in hit points). Without them a maximum reads the sheet alone. */
  items?: ReadonlyArray<RulesetSheetItem>,
): ResolvedRulesetLive {
  const held = items?.length ? items : undefined;
  // Once a planning pass (see `withRulesetPlanMemo`).
  return rulesetPlanMemo(["readRulesetLive", definition, build, stored, held], () =>
    rulesetContentMemo(definition, "readRulesetLive", held ? [build, stored, held] : [build, stored], () =>
      resolveLive(definition, build, readStoredLiveState(definition, build, stored), held),
    ),
  );
}

/** Every number the sheet yields, with its live tracks and pools read as they stand in `stored`:
 *  the snapshot a check, a fight or the Game Master's sheet block works from. With nothing stored
 *  (the sheet editor, an import review) they read at their declared defaults, a pool full or empty
 *  as it starts and a track where it starts. The live state's own maximums never read it back
 *  (refused at import), so resolving them first cannot loop. */
export function evaluateRulesetSheetLive(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored?: unknown,
  /** The items the character holds, which an `itemStat` reads; none outside a game. */
  items?: ReadonlyArray<RulesetSheetItem>,
  /** Conditions a fight has on them besides the sheet's own (1.515), for what they do to abilities. */
  conditions?: readonly string[],
): ReturnType<typeof evaluateRulesetSheet> {
  return rulesetPlanMemo(["evaluateRulesetSheetLive", definition, build, stored, items, conditions?.join("|")], () =>
    rulesetContentMemo(definition, "evaluateRulesetSheetLive", [build, stored, items, conditions], () =>
      evaluateSheetLive(definition, build, stored, items, conditions),
    ),
  );
}

function evaluateSheetLive(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored?: unknown,
  items?: ReadonlyArray<RulesetSheetItem>,
  conditions?: readonly string[],
): ReturnType<typeof evaluateRulesetSheet> {
  // What an item asks of its bearer (1.667): bound without it, it reads as not worn.
  items = items ? rulesetItemsMeetingNeeds(definition, build, stored, items) : items;
  // What only a worn item kept on (1.664) is not held once that item is not worn.
  const live = readRulesetLive(
    definition,
    build,
    items
      ? rulesetLiveWornOff(stored, new Set(items.flatMap((held) => (held.worn && held.stack ? [held.stack.id] : []))))
          .live
      : stored,
    items,
  );
  // What the conditions they hold do to their abilities (1.515): the sheet's own, and the fight's.
  const held = new Set([
    ...live.conditions.filter((condition) => condition.active).map((condition) => condition.id),
    ...(conditions ?? []),
  ]);
  const conditionAbilities = held.size
    ? (definition.combat?.conditions ?? []).flatMap((entry) =>
        entry.abilities && held.has(entry.condition) ? [entry.abilities] : [],
      )
    : [];
  // And to their derived values (1.662): Bull's Strength's carrying capacity.
  const conditionDerived = held.size
    ? (definition.combat?.conditions ?? []).flatMap((entry) =>
        entry.derivedChanges && held.has(entry.condition) ? [entry.derivedChanges] : [],
      )
    : [];
  return evaluateRulesetSheet(definition, build, {
    ...live,
    ...(items ? { items } : {}),
    ...(conditionAbilities.length ? { conditionAbilities } : {}),
    ...(conditionDerived.length ? { conditionDerived } : {}),
  });
}

// ── Commands ──

export type RulesetAdvanceOp =
  | { op: "advance"; field: string; to?: string | number; by?: number }
  | { op: "advance"; ability: string; to?: number; by?: number }
  | { op: "advance"; skill: string; tier: string }
  | { op: "advance"; save: string; tier: string };

export type RulesetSheetOp =
  | RulesetAdvanceOp
  /** The four that move one pool. One member rather than four, because `damage` also has a track
   *  shape below and two members under one name could not be told apart by the name alone. */
  | {
      op: "spend" | "restore" | "damage" | "temp";
      pool: string;
      amount: number;
      /** On `damage`: what it takes off the pool comes back only with a rest (1.193). */
      seals?: true;
      /** On `damage` that `seals`: not even a rest gives it back, only something that unseals (1.203). */
      lasting?: true;
      /** On `damage`: dealt by this condition, which keeps it off healing while it holds (1.750),
       *  given back as it ends. */
      keptBy?: string;
      /** On `restore`: what only a rest gives back is given back too (1.201), and then `amount` may
       *  be nothing. */
      unseals?: true;
      /** On `restore`: it may go past the maximum (1.252), and what is past it goes when a rest sets
       *  the pool back to its maximum: Font of Magic's spell slots. */
      overMax?: true;
      /** On `restore` of health: a magical heal (1.261), which a condition keeping off only other
       *  heals lets through. */
      magical?: true;
    }
  /** Marks a WOUND track. `kind` is one the track declares; `amount` is a number of marks of that
   *  one kind, and a NEGATIVE amount heals, clearing marks of that kind (the lightest first when the
   *  kind is not one the track knows). `box` is where the first mark aims on an indexed track: that
   *  box, or the next free one above it. Told apart from the pool shape above by naming a track,
   *  which is what `"track" in op` reads. */
  | { op: "damage"; track: string; kind: string; amount: number; box?: number }
  /** `upTo` (1.364) stops a `by` move there: it never carries the track past it, and never moves one
   *  already beyond it. */
  | { op: "track"; track: string; to?: number; by?: number; upTo?: number }
  | { op: "condition"; condition: string; active: boolean }
  /** Health's maximum raised by `amount` while `condition` is held, and health with it (1.473), in
   *  place of what it raised it by before. */
  | { op: "raise"; condition: string; amount: number }
  /** Sets a live state to one of its values, named by the value or its label. */
  | { op: "state"; state: string; value: string }
  | { op: "note"; field: string; value: string }
  /** `dice` (1.335): spend that many of the rest's dice to heal first, as its `dice` says. `extra` is the
   *  party's best extra die for it (Song of Rest), worked out where the party is known; without it, the
   *  sheet's own. */
  | {
      op: "rest";
      rest: string;
      dice?: number;
      pool?: string;
      extra?: { sides: number; add: number };
      /** How many of each pool's dice to spend first, by pool: a multiclass player's Short rest, which
       *  picks from each of their hit dice. Taken in the rest's own order of pools, before `dice`. */
      diceFrom?: Readonly<Record<string, number>>;
      /** A feature the rest offers to use as it ends (1.789), named on the Game Master's tag: 5e's
       *  Arcane Recovery. `recover` is what it gives back; without it, the highest spent that fit. */
      use?: string;
      recover?: ReadonlyArray<{ pool: string; count: number }>;
    }
  /** Days of game time pass (1.445): a spent row whose recharge takes days counts them, and fills
   *  again once they reach its count. `resting` (1.756): spent resting, so a condition whose days
   *  count more while its holder rests counts them so. */
  | { op: "pass"; days: number; resting?: true }
  /** Uses something the character picked from a catalog, paying everything it costs. Resolved by
   *  `planRulesetUse` before it reaches `applyRulesetSheetOp`, because it needs the catalogs. */
  | {
      op: "use";
      name: string;
      pool?: string;
      recover?: RulesetUseRecover[];
      /** The creature it calls (1.798), by name, for an entry used outside a fight whose call stays. */
      as?: string;
      /** Used as a ritual (1.807): a row its list's `ritual` column ticks pays none of its pools. */
      ritual?: true;
    }
  /** Sends away what an entry used outside a fight called and kept (1.798), by the entry's name or
   *  the creature's: a familiar dismissed or lost. */
  | { op: "dismiss"; name: string }
  /** Ticks an entry's row in its list's prepared mark (`display.mark`, 1.378), or clears it with
   *  `unprepare`: a cleric's spells changed after a long rest. A row the sheet does not hold is added
   *  where the sheet's builder would let it be picked for that list. Resolved by
   *  `applyRulesetPrepare`, because it needs the catalogs. */
  | { op: "prepare" | "unprepare"; name: string };

/** A pool a use gives back (1.410) and how many of it: one of the spell slots Arcane Recovery picks. */
export interface RulesetUseRecover {
  pool: string;
  count: number;
}

export type RulesetSheetRefusal =
  | "unknown-pool"
  | "ambiguous-pool"
  | "insufficient"
  | "bad-amount"
  | `bad-amount: ${string}`
  /** A priced material (1.790) its user does not carry, by what the entry says it is. */
  | `no-material: ${string}`
  | "advancement-disabled"
  | "save-failed"
  | "not-allowed"
  | "unknown-ability"
  | "unknown-skill"
  | "unknown-save"
  | "unknown-tier"
  | "no-temp"
  | "unknown-track"
  /** A track op on a wound track, or a wound op on a plain one. */
  | "wrong-track"
  /** A kind the wound track does not declare. */
  | "unknown-kind"
  /** A track that refuses a mark it has no box for had none free. */
  | "no-box"
  | "unknown-condition"
  /** A live state the sheet does not have (or hides). */
  | "unknown-state"
  /** A value the live state does not offer. */
  | "unknown-value"
  | "unknown-field"
  | "unknown-rest"
  | "unknown-entry"
  | "ambiguous-entry"
  | "bad-pool"
  /** A heal its holder's conditions keep off (1.261): a diseased giant rat's bite. */
  | "cannot-heal"
  /** A pool only a rest gives back, restored by a bare command with no rest that gives it back
   *  (laptop 2026-10-26: a cleric's spell slots back on a short rest that restores none). */
  | "rest-only"
  /** A use as a ritual (1.807) of a row its list's `ritual` column does not tick. */
  | "not-ritual"
  /** A use of an entry the sheet does not hold but could prepare, and how to. */
  | `not-prepared: ${string}`
  /** A prepare past what the sheet's builder lets it hold prepared, and how many that is. */
  | `too-many-prepared: ${string}`
  /** Dying failures written up by hand outside a fight: only a roll or a blow while down marks them
   *  (cheap-GM playtest 2026-10-26). */
  | "dying-saves-rolled"
  /** A rest of a kind taken again in the reply that took it or the next, or with no time passed on
   *  the game's clock since (laptop playtest 2026-10-26: two long rests in back-to-back turns). */
  | "rested-already"
  | "malformed";

export type RulesetSheetOpResult =
  | { ok: true; live: RulesetLiveState; now: string; build?: RulesetSheetBuild }
  | { ok: false; reason: RulesetSheetRefusal };

/** The op names a tag may spell. `heal` is an alias the tag layer folds into `restore`, and `cast`
 *  one it folds into `use`. */
export const RULESET_SHEET_OP_NAMES = Object.freeze([
  "spend",
  "restore",
  "damage",
  "temp",
  "track",
  "condition",
  "state",
  "note",
  "rest",
  "use",
  "pass",
  "advance",
  "dismiss",
  "prepare",
  "unprepare",
] as const);

/** How long a `now` summary may get before the tag layer would cut it anyway. */
const MAX_NOW_LENGTH = 120;

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

type PoolMatch = { pool: ResolvedRulesetLive["pools"][number] } | { refusal: "unknown-pool" | "ambiguous-pool" };

/** What a written pool name means: its key, then a declared pool's id or label, then a list row's
 *  name on its own — which is how a Game Master writes "Ki" without knowing the list it lives in. */
function findPool(pools: ResolvedRulesetLive["pools"], requested: string): PoolMatch {
  const wanted = requested.trim();
  if (!wanted) return { refusal: "unknown-pool" };
  const exact = pools.find((pool) => pool.key === wanted);
  if (exact) return { pool: exact };
  const declared = pools.find((pool) => !pool.listId && (sameName(pool.key, wanted) || sameName(pool.label, wanted)));
  if (declared) return { pool: declared };
  const rows = pools.filter((pool) => pool.listId && (sameName(pool.key, wanted) || sameName(pool.label, wanted)));
  if (rows.length === 1) return { pool: rows[0]! };
  if (rows.length > 1) return { refusal: "ambiguous-pool" };
  // A declared pool only, and only where one alone fits (#8271: a GM's damage tag on
  // pool="hit_points" refused while the widget took it).
  const alike = pools.filter((pool) => !pool.listId && poolLooselyNamed(pool, wanted));
  if (alike.length === 1) return { pool: alike[0]! };
  return { refusal: alike.length > 1 ? "ambiguous-pool" : "unknown-pool" };
}

/** A pool's name written the way a key is ("hit_points" for "Hit Points"), or shortened to its
 *  label's initials ("hp"), for where no pool has the name exactly (#8271). */
function poolLooselyNamed(pool: { key: string; label?: string }, wanted: string): boolean {
  const loose = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
  const initials = (text: string) =>
    loose(text)
      .split(" ")
      .map((word) => word[0] ?? "")
      .join("");
  const looseWanted = loose(wanted);
  return (
    loose(pool.key) === looseWanted ||
    (!!pool.label && (loose(pool.label) === looseWanted || initials(pool.label) === looseWanted)) ||
    poolNamedByLevel(pool, wanted)
  );
}

/** Words a name of a numbered pool carries that say nothing about which family it is in. */
const POOL_LEVEL_WORDS = new Set(["level", "lvl", "lv", "spell", "spells"]);

/** A name read for its one number and its family words: "spell_slots_2" is 2 and "slot". */
function poolLevelName(text: string): { level: number; words: string[]; saysLevel: boolean } | null {
  const tokens = text
    .toLowerCase()
    .replace(/(\d+)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/(\d)(?=[a-z])|([a-z])(?=\d)/g, "$1$2 ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const numbers = tokens.filter((token) => /^\d{1,2}$/.test(token));
  if (numbers.length !== 1) return null;
  return {
    level: Number(numbers[0]),
    words: tokens
      .filter((token) => !/^\d+$/.test(token) && !POOL_LEVEL_WORDS.has(token))
      .map((token) => token.replace(/s$/, "")),
    saysLevel: tokens.some((token) => token === "level" || token === "lvl" || token === "lv"),
  };
}

/**
 * A numbered pool named by its number and a word of its family, however the words around them are
 * written (cheap-GM playtest 2026-10-26: `pool="spell_slots_2"` for the pool "2nd-level slots" was
 * refused, so Invisibility and Pass without Trace cost nothing). A name that only says its level
 * ("level 2") finds it too. Used only where one pool alone fits.
 */
function poolNamedByLevel(pool: { key: string; label?: string }, wanted: string): boolean {
  const asked = poolLevelName(wanted);
  if (!asked) return false;
  return [pool.key, pool.label ?? ""].some((name) => {
    const own = poolLevelName(name);
    if (!own || own.level !== asked.level) return false;
    if (asked.words.length === 0) return asked.saysLevel;
    return asked.words.some((word) => own.words.includes(word));
  });
}

/** The one pool of `pools` a name finds: by its key or label exactly, else loosely where one alone
 *  fits. */
function poolNamed<Pool extends { key: string; label?: string }>(
  pools: readonly Pool[],
  wanted: string,
): Pool | undefined {
  const exact = pools.find((pool) => sameName(pool.key, wanted) || (!!pool.label && sameName(pool.label, wanted)));
  if (exact) return exact;
  const alike = pools.filter((pool) => poolLooselyNamed(pool, wanted));
  return alike.length === 1 ? alike[0] : undefined;
}

function poolNow(pool: { max: number }, value: number, temp: number): string {
  return `${value}/${pool.max}${temp > 0 ? ` +${temp} temp` : ""}`;
}

function isAmount(amount: number, allowZero = false): boolean {
  return Number.isInteger(amount) && amount >= (allowZero ? 0 : 1) && amount <= MAX_OP_AMOUNT;
}

/** Permanent advancement uses the editor's bounds, refusing rather than clamping a request. */
function advanceBuild(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  op: RulesetAdvanceOp,
): RulesetSheetOpResult {
  const allowed = definition.sheet.advancement;
  if (!allowed) return { ok: false, reason: "advancement-disabled" };
  const defaults = defaultRulesetSheetBuild(definition);
  const next = structuredClone(build);
  const find = <T extends { id: string; label: string }>(entries: T[], name: string) =>
    entries.find((entry) => sameName(entry.id, name)) ?? entries.find((entry) => sameName(entry.label, name));
  let now: string;
  if ("skill" in op || "save" in op) {
    const skill = "skill" in op;
    const group = skill ? "skills" : "saves";
    if (!allowed[group]) return { ok: false, reason: "not-allowed" };
    const entry = find(definition.sheet[group], "skill" in op ? op.skill : op.save);
    if (!entry) return { ok: false, reason: skill ? "unknown-skill" : "unknown-save" };
    const tier = find(definition.resolution.proficiencyTiers, op.tier);
    if (!tier) return { ok: false, reason: "unknown-tier" };
    next[group][entry.id] = tier.id;
    now = tier.label;
  } else {
    if ((op.to === undefined) === (op.by === undefined)) return { ok: false, reason: "bad-amount" };
    const field = "field" in op;
    const entry = field ? find(definition.sheet.fields, op.field) : find(definition.sheet.abilities, op.ability);
    if (!entry) return { ok: false, reason: field ? "unknown-field" : "unknown-ability" };
    if (field ? !allowed.fields?.includes(entry.id) : !allowed.abilities) return { ok: false, reason: "not-allowed" };
    const group = field ? "fields" : "abilities";
    if ("type" in entry && (entry.type === "text" || entry.type === "longtext")) {
      if (op.by !== undefined || typeof op.to !== "string") return { ok: false, reason: "bad-amount" };
      if (op.to.length > entry.maxLength)
        return { ok: false, reason: `bad-amount: maximum ${entry.maxLength} characters` };
      next.fields[entry.id] = op.to;
      now = op.to;
    } else {
      if ("type" in entry && entry.type !== "number") return { ok: false, reason: "not-allowed" };
      const number = (value: unknown) =>
        typeof value === "number"
          ? value
          : typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())
            ? Number(value)
            : NaN;
      const storedValue = build[group][entry.id];
      const previous =
        typeof storedValue === "number" && Number.isFinite(storedValue) ? storedValue : defaults[group][entry.id];
      const value = op.by === undefined ? number(op.to) : number(previous) + op.by;
      const integer = !("type" in entry) || entry.integer;
      // Held with the others it is totalled with (1.672): 5e's class levels.
      const most = field
        ? Math.max(Math.min(entry.max, rulesetFieldMax(definition, build, entry.id)), entry.min)
        : entry.max;
      if (!Number.isFinite(value) || value < entry.min || value > most || (integer && !Number.isInteger(value))) {
        return { ok: false, reason: `bad-amount: ${integer ? "integer " : ""}${entry.min} to ${most}` };
      }
      next[group][entry.id] = value;
      now = String(value);
    }
  }
  const parsed = rulesetSheetBuildSchema.safeParse(next);
  if (
    !parsed.success ||
    !storedRulesetSheetsSchema.safeParse({ [definition.id]: { v: definition.sheet.version, build: parsed.data } })
      .success
  )
    return { ok: false, reason: "malformed" };
  return { ok: true, build: parsed.data, live: readStoredLiveState(definition, parsed.data, stored), now };
}

/** Apply one command to one character's live state. Pure: the input blob is never touched, and the
 *  result is a new sparse state. A refusal changes nothing, which is what lets the Game Master's
 *  fiction be corrected rather than silently accepted. */
/** What a pool reads now (`12/32`, with any temporary buffer), as a sheet command's `now` writes it,
 *  or null for a name that is no one pool. A Game Master's command that claims the value the sheet
 *  already holds is one the fight or an earlier command already paid. */
export function rulesetPoolNowText(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  pool: string,
  items?: ReadonlyArray<RulesetSheetItem>,
): string | null {
  const match = findPool(
    resolveLive(definition, build, readStoredLiveState(definition, build, stored), items).pools,
    pool,
  );
  return "refusal" in match ? null : poolNow(match.pool, match.pool.value, match.pool.temp);
}

/** The key of the pool a written name finds on this sheet, as a command finds it ("hit_points" for
 *  "hp"), or null for none. */
export function rulesetPoolKeyNamed(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  pool: string,
  items?: ReadonlyArray<RulesetSheetItem>,
): string | null {
  const match = findPool(
    resolveLive(definition, build, readStoredLiveState(definition, build, stored), items).pools,
    pool,
  );
  return "refusal" in match ? null : match.pool.key;
}

/** The condition held on this sheet that keeps a heal off health (1.261), by its label: any heal
 *  for "cannot-heal", one that is not magical for "cannot-heal-nonmagical". */
function healKeptOffBy(definition: RulesetDefinition, conditions: readonly string[], magical: boolean): string | null {
  for (const entry of definition.combat?.conditions ?? []) {
    if (!conditions.includes(entry.condition)) continue;
    const effects: readonly string[] = entry.effects;
    if (effects.includes("cannot-heal") || (!magical && effects.includes("cannot-heal-nonmagical")))
      return definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
  }
  return null;
}

export function applyRulesetSheetOp(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  op: RulesetSheetOp,
  /** What a rest rolls for a condition that lowers health's maximum (1.260). Without one, each die
   *  counts its average, rounded down over them all. */
  roll?: (sides: number) => number,
  /** The items the character carries, which a rest's dice read for an `itemStat` (1.337). */
  items?: ReadonlyArray<RulesetSheetItem>,
): RulesetSheetOpResult {
  // `use` is turned into plain spends by `planRulesetUse` before it gets here, and `prepare` is
  // applied by `applyRulesetPrepare`: both need the ruleset's catalogs, which this function
  // deliberately does not take.
  if (op.op === "use" || op.op === "prepare" || op.op === "unprepare") return { ok: false, reason: "malformed" };
  if (op.op === "advance") return advanceBuild(definition, build, stored, op);
  const next = readStoredLiveState(definition, build, stored);
  const resolved = resolveLive(definition, build, next, items);

  const setPool = (
    spec: RulesetLivePoolSpec,
    value: number,
    temp: number,
    /** What only a rest gives back (1.193); what is stored already when left out. */
    sealed = own(next.pools, spec.key)?.sealed ?? 0,
    /** What of it no rest gives back (1.203); what is stored already, within `sealed`, when left out. */
    lasting = Math.min(sealed, own(next.pools, spec.key)?.lasting ?? 0),
  ): void => {
    const pools = next.pools ?? {};
    // Back at its default, with no buffer, the entry goes away again: that is what lets an
    // untouched pool follow its maximum when a level-up raises it.
    // Past the maximum is held apart (1.252), so the stored value never reads as more than it may.
    const above = Math.max(0, value - spec.max);
    if (above > 0) value = spec.max;
    if (
      value === (spec.startAt ?? (spec.start === "full" ? spec.max : 0)) &&
      temp === 0 &&
      sealed === 0 &&
      above === 0
    ) {
      delete pools[spec.key];
    } else
      pools[spec.key] = {
        value,
        ...(above > 0 ? { above } : {}),
        ...(temp > 0 ? { temp } : {}),
        ...(sealed > 0 ? { sealed } : {}),
        ...(lasting > 0 ? { lasting: Math.min(lasting, sealed) } : {}),
      };
    next.pools = pools;
  };
  const setTrack = (track: ResolvedRulesetLive["tracks"][number], value: number): void => {
    const tracks = next.tracks ?? {};
    if (
      value === (track.start ?? clamp(definitionTrackDefault(definition, track.id) ?? track.min, track.min, track.max))
    ) {
      delete tracks[track.id];
    } else tracks[track.id] = value;
    next.tracks = tracks;
  };
  const setWounds = (id: string, state: RulesetLiveWounds): void => {
    const wounds = next.wounds ?? {};
    // An unmarked track with nothing overflowed is the default again, so the entry goes away.
    if (state.marks.length === 0 && !state.overflow) delete wounds[id];
    else wounds[id] = state;
    next.wounds = wounds;
  };
  const setState = (entry: ResolvedRulesetLive["states"][number], value: string): void => {
    const states = next.states ?? {};
    // Back at its default, the entry goes away: the stored blob only says where a state was moved.
    const declared = definition.sheet.live.states.find((candidate) => candidate.id === entry.id);
    if (!declared || value === rulesetStateDefault(declared)) delete states[entry.id];
    else states[entry.id] = value;
    next.states = states;
  };
  const setText = (id: string, value: string): void => {
    const text = next.text ?? {};
    if (value) text[id] = value;
    else delete text[id];
    next.text = text;
  };
  /** What a cured condition's rests took off health's maximum for good, given back (1.261). */
  const giveBackLowered = (conditionId: string): string => {
    const amount = own(next.lowered, conditionId) ?? 0;
    if (!next.lowered || amount <= 0) return "";
    delete next.lowered[conditionId];
    const rule = definition.combat?.health;
    const pool = rule && "pool" in rule ? resolved.pools.find((entry) => entry.key === rule.pool) : undefined;
    if (!pool) return "";
    const stored = own(next.pools, pool.key);
    const sealed = stored?.sealed ?? 0;
    const back = Math.min(amount, sealed);
    if (back <= 0) return "";
    setPool(
      pool,
      stored?.value ?? pool.value,
      stored?.temp ?? pool.temp,
      sealed - back,
      Math.max(0, (stored?.lasting ?? 0) - back),
    );
    return `, ${pool.label}'s maximum back up by ${back}`;
  };
  /** Damage a condition deals its holder's health as days pass (1.750), and what of it the condition
   *  keeps off healing while it holds. Says how much it took. */
  const dayHarm = (condition: string, harm: { dice?: string; flat?: number; type?: string }, keeps: boolean) => {
    const rule = definition.combat?.health;
    const pool = rule && "pool" in rule ? resolved.pools.find((entry) => entry.key === rule.pool) : undefined;
    if (!pool) return 0;
    const dice = harm.dice ? parseRulesetCombatDice(harm.dice) : null;
    let amount = harm.flat ?? 0;
    if (dice) {
      if (roll) for (let index = 0; index < dice.count; index += 1) amount += roll(dice.sides);
      else amount += Math.floor((dice.count * (dice.sides + 1)) / 2);
      amount += dice.flat;
    }
    if (amount <= 0) return 0;
    const stored = own(next.pools, pool.key);
    const value = stored?.value ?? pool.value;
    const temp = stored?.temp ?? 0;
    const sealedBefore = stored?.sealed ?? 0;
    const fromTemp = Math.min(temp, amount);
    const after = Math.max(0, value - (amount - fromTemp));
    const sealed = keeps ? Math.min(pool.max, sealedBefore + (value - after)) : sealedBefore;
    const lasting = keeps ? Math.min(sealed, (stored?.lasting ?? 0) + (value - after)) : (stored?.lasting ?? 0);
    setPool(pool, after, temp - fromTemp, sealed, lasting);
    if (sealed > sealedBefore)
      next.lowered = { ...next.lowered, [condition]: (own(next.lowered, condition) ?? 0) + sealed - sealedBefore };
    return amount;
  };
  /** What a condition deals as it ends this way as days pass (1.245, 1.751), its save for half rolled
   *  off the sheet: Midnight tears at midnight. Spared by holding what its `unless` names. Says what
   *  happened as ", …". */
  const endHarm = (condition: string, how: "expired" | "save"): string => {
    const ending = definition.combat?.conditions?.find((one) => one.condition === condition)?.onEnd;
    const harm = ending?.harm;
    if (!harm || (ending.when && !ending.when.includes(how))) return "";
    if (harm.unless?.holding?.some((id) => (next.conditions ?? []).includes(id))) return "";
    const health = definition.combat?.health;
    const pool = health && "pool" in health ? resolved.pools.find((entry) => entry.key === health.pool) : undefined;
    if (!pool) return "";
    let half = false;
    let saidSave = "";
    if (harm.save) {
      const save = definition.sheet.saves.find((one) => one.id === harm.save!.save);
      const modifier = save
        ? rulesetCheckModifier(evaluateRulesetSheetLive(definition, build, next, items), {
            type: "save",
            id: save.id,
            label: save.label,
            ...(save.ability ? { ability: save.ability } : {}),
          })
        : 0;
      const { dice } = definition.resolution as { dice: { count: number; sides: number } };
      let total = modifier;
      if (roll) for (let index = 0; index < dice.count; index += 1) total += roll(dice.sides);
      else total += Math.floor((dice.count * (dice.sides + 1)) / 2);
      half = total >= harm.save.difficulty;
      saidSave = `, ${save?.label ?? harm.save.save} ${total} against ${harm.save.difficulty}${half ? " for half" : ""}`;
    }
    const dice = harm.dice ? parseRulesetCombatDice(harm.dice) : null;
    let rolled = harm.flat ?? 0;
    if (dice) {
      if (roll) for (let index = 0; index < dice.count; index += 1) rolled += roll(dice.sides);
      else rolled += Math.floor((dice.count * (dice.sides + 1)) / 2);
      rolled += dice.flat;
    }
    const amount = half ? Math.floor(rolled / 2) : rolled;
    const took = amount > 0 ? dayHarm(condition, { flat: amount }, false) : 0;
    const now = own(next.pools, pool.key)?.value ?? pool.value;
    return `${saidSave}, took ${took}${harm.type ? ` ${harm.type}` : ""} (${pool.label} ${now}/${pool.max})`;
  };
  const done = (now: string): RulesetSheetOpResult => ({
    ok: true,
    live: normalizeLiveState(next),
    now: now.slice(0, MAX_NOW_LENGTH),
  });

  // Marking a wound track. Its own shape of the damage op, told apart by naming a track rather
  // than a pool, so one verb still means "this hurt" whichever shape the ruleset's health takes.
  if (op.op === "damage" && "track" in op) {
    const resolvedTrack = resolved.tracks.find(
      (entry) => sameName(entry.id, op.track) || sameName(entry.label, op.track),
    );
    if (!resolvedTrack) return { ok: false, reason: "unknown-track" };
    const declared = definition.sheet.live.tracks.find((entry) => entry.id === resolvedTrack.id);
    if (!declared || !resolvedTrack.wound) return { ok: false, reason: "wrong-track" };
    // Never floored at zero and never refused for being too big: overflow is what carries the rest.
    if (!Number.isInteger(op.amount) || op.amount === 0 || Math.abs(op.amount) > MAX_OP_AMOUNT) {
      return { ok: false, reason: "bad-amount" };
    }
    const kind = resolvedTrack.wound.kinds.find(
      (entry) => sameName(entry.id, op.kind) || sameName(entry.label, op.kind),
    );
    // Healing names a kind to clear only that kind; a name the track does not know heals lightest
    // first, as healing always has.
    if (!kind && op.amount > 0) return { ok: false, reason: "unknown-kind" };
    if (op.box !== undefined && (!Number.isInteger(op.box) || op.box < 1 || op.box > RULESET_WOUND_LEVELS_MAX)) {
      return { ok: false, reason: "bad-amount" };
    }

    const levels = resolvedTrack.wound.levels;
    const work = woundWork(declared, levels, own(next.wounds, resolvedTrack.id));
    const before = work.overflow;
    const landed = applyWoundAmount(work, kind?.severity ?? 0, op.amount, {
      ...(op.box !== undefined ? { box: op.box } : {}),
      ...(op.amount < 0 && kind ? { healSeverity: kind.severity } : {}),
    });
    if (!landed) return { ok: false, reason: "no-box" };
    const state = woundState(work);
    setWounds(resolvedTrack.id, state);
    const wound = resolveWounds(declared, levels, state);
    const level = wound.lowest >= 0 && !wound.numbered ? wound.levels[wound.lowest]?.label : undefined;
    // The overflow is SAID when it grew, because a blow that could not land is still a blow and a
    // silent one would read as nothing having happened.
    const spilled = work.overflow > before ? ` +${work.overflow - before} over` : "";
    return done(`${resolvedTrack.label} ${wound.filled}/${wound.levels.length}${level ? ` ${level}` : ""}${spilled}`);
  }

  if (op.op === "spend" || op.op === "restore" || op.op === "damage" || op.op === "temp") {
    const match = findPool(resolved.pools, op.pool);
    if ("refusal" in match) return { ok: false, reason: match.refusal };
    const pool = match.pool;
    if (!isAmount(op.amount, op.op === "temp" || (op.op === "restore" && op.unseals === true))) {
      return { ok: false, reason: "bad-amount" };
    }

    if (op.op === "temp") {
      if (!pool.allowTemp) return { ok: false, reason: "no-temp" };
      const temp = Math.min(op.amount, MAX_LIVE_NUMBER);
      setPool(pool, pool.value, temp);
      return done(poolNow(pool, pool.value, temp));
    }
    if (op.op === "spend") {
      // Refused rather than floored: "you are out" is a fact the narration has to hear.
      if (pool.value < op.amount) return { ok: false, reason: "insufficient" };
      const value = pool.value - op.amount;
      setPool(pool, value, pool.temp);
      return done(poolNow(pool, value, pool.temp));
    }
    if (op.op === "restore") {
      const health = definition.combat?.health;
      if (
        op.amount > 0 &&
        health &&
        "pool" in health &&
        pool.key === health.pool &&
        healKeptOffBy(definition, next.conditions ?? [], op.magical === true)
      ) {
        return { ok: false, reason: "cannot-heal" };
      }
      // Never past what only a rest gives back (1.193), and never down for it either, unless it is
      // given back too (1.201).
      const sealed = op.unseals ? 0 : pool.sealed;
      const value = op.overMax
        ? Math.min(MAX_LIVE_NUMBER, pool.value + op.amount)
        : Math.min(Math.max(pool.value, pool.max - sealed), pool.value + op.amount);
      setPool(pool, value, pool.temp, sealed, op.unseals ? 0 : pool.lasting);
      return done(poolNow(pool, value, pool.temp));
    }
    // Damage drains the temporary buffer first and then the pool, and is never refused for being
    // bigger than what is left: a killing blow is still a killing blow.
    const fromTemp = Math.min(pool.temp, op.amount);
    const temp = pool.temp - fromTemp;
    const value = Math.max(0, pool.value - (op.amount - fromTemp));
    // What it took off the pool itself, not the buffer, comes back only with a rest (1.193).
    const kept = op.keptBy !== undefined;
    const sealed = op.seals || kept ? Math.min(pool.max, pool.sealed + (pool.value - value)) : pool.sealed;
    const lasting =
      (op.seals && op.lasting) || kept ? Math.min(sealed, pool.lasting + (pool.value - value)) : pool.lasting;
    setPool(pool, value, temp, sealed, lasting);
    // Kept off healing by the condition that dealt it (1.750), and given back as it ends.
    if (kept && sealed > pool.sealed)
      next.lowered = { ...next.lowered, [op.keptBy!]: (own(next.lowered, op.keptBy!) ?? 0) + sealed - pool.sealed };
    return done(poolNow(pool, value, temp));
  }

  if (op.op === "track") {
    const track = resolved.tracks.find((entry) => sameName(entry.id, op.track) || sameName(entry.label, op.track));
    if (!track) return { ok: false, reason: "unknown-track" };
    // A wound track is marked with kinds, not set to a number, so a bare number could not say what
    // the new marks are. Told apart here rather than guessed at with the lightest kind.
    if (track.wound) return { ok: false, reason: "wrong-track" };
    if ((op.to === undefined) === (op.by === undefined)) return { ok: false, reason: "malformed" };
    const moved = op.to ?? track.value + op.by!;
    if (!Number.isInteger(op.to ?? op.by) || Math.abs(op.to ?? op.by!) > MAX_LIVE_NUMBER) {
      return { ok: false, reason: "bad-amount" };
    }
    if (op.upTo !== undefined && (!Number.isInteger(op.upTo) || Math.abs(op.upTo) > MAX_LIVE_NUMBER)) {
      return { ok: false, reason: "bad-amount" };
    }
    const stopped =
      op.upTo === undefined || op.by === undefined
        ? moved
        : op.by >= 0
          ? Math.max(track.value, Math.min(moved, op.upTo))
          : Math.min(track.value, Math.max(moved, op.upTo));
    const value = clamp(stopped, track.min, track.max);
    setTrack(track, value);
    return done(`${track.label} ${value}`);
  }

  if (op.op === "condition") {
    const condition = resolved.conditions.find(
      (entry) => sameName(entry.id, op.condition) || sameName(entry.label, op.condition),
    );
    if (!condition) return { ok: false, reason: "unknown-condition" };
    const active = new Set(next.conditions ?? []);
    const was = active.has(condition.id);
    if (op.active) active.add(condition.id);
    else active.delete(condition.id);
    next.conditions = [...active].slice(0, MAX_LIVE_CONDITIONS);
    const restored = !op.active && was ? giveBackLowered(condition.id) : "";
    // A shape's condition taken off ends the shape it held them in (1.801), as `dismiss` does, so
    // the next fight does not start them in a form the story already ended.
    const ended =
      !op.active &&
      next.shaped &&
      definition.combat?.conditions?.some((entry) => entry.shape && entry.condition === condition.id)
        ? next.shaped.as
        : undefined;
    if (ended) delete next.shaped;
    return done(`${condition.label} ${op.active ? "on" : "off"}${restored}${ended ? `, ${ended} shape ended` : ""}`);
  }

  if (op.op === "raise") {
    const condition = resolved.conditions.find(
      (entry) => sameName(entry.id, op.condition) || sameName(entry.label, op.condition),
    );
    if (!condition) return { ok: false, reason: "unknown-condition" };
    if (!isAmount(op.amount, false)) return { ok: false, reason: "bad-amount" };
    const rule = definition.combat?.health;
    const pool = rule && "pool" in rule ? resolved.pools.find((entry) => entry.key === rule.pool) : undefined;
    if (!pool) return { ok: false, reason: "unknown-pool" };
    const held = (next.conditions ?? []).includes(condition.id);
    const before = held ? Math.max(0, own(next.raised, condition.id) ?? 0) : 0;
    const max = Math.max(0, pool.max - before + op.amount);
    next.raised = { ...next.raised, [condition.id]: op.amount };
    const value = Math.min(max, Math.max(0, pool.value - before) + op.amount);
    setPool({ ...pool, max }, value, pool.temp);
    return done(`${pool.label} ${value}/${max} (${condition.label} +${op.amount})`);
  }

  if (op.op === "state") {
    const entry = resolved.states.find((state) => sameName(state.id, op.state) || sameName(state.label, op.state));
    if (!entry) return { ok: false, reason: "unknown-state" };
    const value = entry.values.find(
      (candidate) => sameName(candidate, op.value) || sameName(entry.valueLabels?.[candidate] ?? candidate, op.value),
    );
    if (value === undefined) return { ok: false, reason: "unknown-value" };
    setState(entry, value);
    return done(`${entry.label} ${own(entry.valueLabels, value) ?? value}`);
  }

  // What a kept call called (1.798), sent away by the entry's name or the creature's; or a kept
  // shape (1.801) ended, by the entry's name or the form's.
  if (op.op === "dismiss") {
    const wanted = typeof op.name === "string" ? op.name.trim() : "";
    const shape = next.shaped;
    if (wanted && shape && (sameName(shape.entry, wanted) || sameName(shape.as, wanted))) {
      delete next.shaped;
      // And what held them in it: a condition that is a shape, as a fight ends it (cloud probes
      // 2026-10-25: Wild Shape stayed on the sheet after it was dismissed).
      const shapes = new Set(
        (definition.combat?.conditions ?? []).flatMap((entry) => (entry.shape ? [entry.condition] : [])),
      );
      if (next.conditions?.some((id) => shapes.has(id)))
        next.conditions = next.conditions.filter((id) => !shapes.has(id));
      return done(`${shape.as} shape ended`);
    }
    const key = Object.keys(next.called ?? {}).find(
      (entry) => sameName(entry, wanted) || (!!next.called![entry] && sameName(next.called![entry]!, wanted)),
    );
    if (!wanted || key === undefined) return { ok: false, reason: "unknown-entry" };
    const creature = next.called![key];
    delete next.called![key];
    return done(`${creature || key} dismissed`);
  }

  if (op.op === "note") {
    const field = resolved.text.find((entry) => sameName(entry.id, op.field) || sameName(entry.label, op.field));
    if (!field) return { ok: false, reason: "unknown-field" };
    const value = typeof op.value === "string" ? op.value.slice(0, field.maxLength) : "";
    setText(field.id, value);
    return done(value ? `${field.label}: ${value}` : `${field.label} cleared`);
  }

  // Days of game time (1.445): what recharges after so many days counts them.
  if (op.op === "pass") {
    if (!Number.isInteger(op.days) || op.days < 1 || op.days > 3650) return { ok: false, reason: "bad-amount" };
    const back: string[] = [];
    for (const pool of resolved.pools) {
      const list = pool.listId ? definition.sheet.lists.find((entry) => entry.id === pool.listId) : undefined;
      const needs = pool.recharge !== undefined ? own(list?.pools?.rechargeDays, pool.recharge) : undefined;
      if (needs === undefined) continue;
      const waited = next.waited ?? {};
      if (pool.value >= pool.max) {
        delete waited[pool.key];
        next.waited = waited;
        continue;
      }
      const counted = (own(waited, pool.key) ?? 0) + op.days;
      if (counted >= needs) {
        setPool(pool, pool.max, pool.temp);
        delete waited[pool.key];
        back.push(`${pool.label} ${pool.max}/${pool.max}`);
      } else waited[pool.key] = counted;
      next.waited = waited;
    }
    // A condition saved against as days pass (1.526): once each so many, until the first success.
    const held = new Set(next.conditions ?? []);
    const daySaves = { ...next.daySaves };
    for (const [condition, owed] of Object.entries(daySaves)) {
      if (!held.has(condition)) {
        delete daySaves[condition];
        continue;
      }
      let counted = (owed.waited ?? 0) + op.days;
      const label = definition.sheet.live.conditions.find((one) => one.id === condition)?.label ?? condition;
      const save = definition.sheet.saves.find((one) => one.id === owed.save);
      const modifier = save
        ? rulesetCheckModifier(evaluateRulesetSheetLive(definition, build, next, items), {
            type: "save",
            id: save.id,
            label: save.label,
            ...(save.ability ? { ability: save.ability } : {}),
          })
        : 0;
      const { dice } = definition.resolution as { dice: { count: number; sides: number } };
      // So many made to end it (1.750), counted across the days: Pale tincture's seven.
      const needs = owed.successes ?? 1;
      let made = owed.made ?? 0;
      let ended = false;
      const rolled: Array<{ total: number; success: boolean }> = [];
      let took = 0;
      while (counted >= owed.every && !ended) {
        counted -= owed.every;
        let total = modifier;
        if (roll) for (let index = 0; index < dice.count; index += 1) total += roll(dice.sides);
        else total += Math.floor((dice.count * (dice.sides + 1)) / 2);
        const success = total >= owed.difficulty;
        if (success) made += 1;
        ended = made >= needs;
        rolled.push({ total, success });
        // What a failed day's save deals (1.750), kept off healing while it holds when it `keeps`.
        if (!success && owed.harm) took += dayHarm(condition, owed.harm, owed.keeps === true);
      }
      const named = `${label}: ${save?.label ?? owed.save}`;
      const health = definition.combat?.health;
      const pool = health && "pool" in health ? resolved.pools.find((entry) => entry.key === health.pool) : undefined;
      const hurt =
        took > 0 && pool
          ? `, took ${took}${owed.harm?.type ? ` ${owed.harm.type}` : ""} (${pool.label} ${own(next.pools, pool.key)?.value ?? pool.value}/${pool.max})`
          : "";
      const tally = needs > 1 && !ended ? ` (${made} of ${needs})` : "";
      if (rolled.length === 1) {
        const [one] = rolled;
        back.push(
          `${named} ${one!.total} against ${owed.difficulty}, ${ended ? "ended" : one!.success ? "made" : "failed"}${tally}${hurt}`,
        );
      } else if (rolled.length > 1) {
        // Many days at once, counted rather than each told.
        const wins = rolled.filter((one) => one.success).length;
        back.push(
          `${named} against ${owed.difficulty}, ${wins} made and ${rolled.length - wins} failed${ended ? ", ended" : tally}${hurt}`,
        );
      }
      if (ended) {
        next.conditions = (next.conditions ?? []).filter((id) => id !== condition);
        delete daySaves[condition];
        const restored = giveBackLowered(condition);
        if (restored) back.push(restored.slice(2));
        // What it leaves as a save ends it (1.751).
        const left = endHarm(condition, "save");
        if (left) back.push(`${label} ends${left}`);
      } else daySaves[condition] = { ...owed, waited: counted, ...(made > 0 ? { made } : {}) };
    }
    next.daySaves = daySaves;
    // A condition that lasts so many days (1.663) comes off once they have passed.
    const dayClocks = { ...next.dayClocks };
    const dayRests = { ...next.dayRests };
    for (const [condition, left] of Object.entries(dayClocks)) {
      if (!(next.conditions ?? []).includes(condition)) {
        delete dayClocks[condition];
        delete dayRests[condition];
        continue;
      }
      // Days spent resting count more where it says so (1.756): Wish's stress, two a day.
      const counted = op.resting && dayRests[condition] ? op.days * dayRests[condition] : op.days;
      if (left > counted) {
        dayClocks[condition] = left - counted;
        continue;
      }
      delete dayClocks[condition];
      delete dayRests[condition];
      next.conditions = (next.conditions ?? []).filter((id) => id !== condition);
      const label = definition.sheet.live.conditions.find((one) => one.id === condition)?.label ?? condition;
      back.push(`${label} ended${giveBackLowered(condition)}${endHarm(condition, "expired")}`);
    }
    next.dayClocks = dayClocks;
    if (Object.keys(dayRests).length > 0) next.dayRests = dayRests;
    else delete next.dayRests;
    const days = `${op.days} ${op.days === 1 ? "day passes" : "days pass"}${op.resting ? " resting" : ""}`;
    return done(back.length ? `${days}: ${back.join(", ")}` : days);
  }

  // Every other command was answered above, so what is left is a rest. Said rather than fallen
  // into, because `damage` now has two shapes and only one of them reaches this far.
  if (op.op !== "rest") return { ok: false, reason: "malformed" };
  const rest = definition.rests.find((entry) => sameName(entry.id, op.rest) || sameName(entry.label, op.rest));
  if (!rest) return { ok: false, reason: "unknown-rest" };
  // No benefit from it while the sheet holds a condition that bars it (1.722): a rakshasa's curse.
  const heldNow = new Set(next.conditions ?? []);
  const barred = (definition.combat?.conditions ?? []).find(
    (entry) =>
      entry.blocksRests &&
      heldNow.has(entry.condition) &&
      (entry.blocksRests === "all" || entry.blocksRests.includes(rest.id)),
  );
  if (barred) {
    const label =
      definition.sheet.live.conditions.find((one) => one.id === barred.condition)?.label ?? barred.condition;
    return done(`${rest.label}: no benefit while ${label}`);
  }
  // Dice picked pool by pool, each spent as `dice` would spend it, then the rest itself. The party's
  // extra die comes once, with the first pool that pays.
  const picked = rulesetRestDiceEntries(rest.dice).flatMap((entry) => {
    const count = op.diceFrom?.[entry.pool] ?? 0;
    return count > 0 ? [{ pool: entry.pool, count }] : [];
  });
  if (op.diceFrom && Object.values(op.diceFrom).some((count) => !Number.isInteger(count) || count < 0))
    return { ok: false, reason: "bad-amount" };
  if (picked.length > 0) {
    if (!rest.dice || picked.some((one) => !isAmount(one.count))) return { ok: false, reason: "bad-amount" };
    let current: unknown = stored;
    const said: string[] = [];
    for (const [index, one] of picked.entries()) {
      const spent = rulesetSpendRestDice(
        definition,
        build,
        current,
        rest.id,
        rest.dice,
        one.count,
        one.pool,
        index === 0 ? op.extra : { sides: 0, add: 0 },
        roll,
        items,
      );
      if (!spent.ok) return spent;
      current = spent.live;
      said.push(spent.now);
    }
    const after = applyRulesetSheetOp(definition, build, current, { op: "rest", rest: rest.id }, roll, items);
    return after.ok ? { ...after, now: [...said, after.now].join("; ").slice(0, MAX_NOW_LENGTH) } : after;
  }
  // Dice spent to heal first (1.335), then the rest itself.
  if (op.dice !== undefined && op.dice !== 0) {
    if (!rest.dice || !isAmount(op.dice)) return { ok: false, reason: "bad-amount" };
    const spent = rulesetSpendRestDice(
      definition,
      build,
      stored,
      rest.id,
      rest.dice,
      op.dice,
      op.pool,
      op.extra,
      roll,
      items,
    );
    if (!spent.ok) return spent;
    const after = applyRulesetSheetOp(definition, build, spent.live, { op: "rest", rest: rest.id }, roll, items);
    return after.ok ? { ...after, now: `${spent.now}; ${after.now}`.slice(0, MAX_NOW_LENGTH) } : after;
  }

  // A rest does exactly what the definition says and nothing else: no implied healing, and no
  // temporary buffers dropped unless its `clear.temp` says so (1.804).
  const values = new Map(resolved.pools.map((pool) => [pool.key, { pool, value: pool.value, temp: pool.temp }]));
  const trackValues = new Map(resolved.tracks.map((track) => [track.id, { track, value: track.value }]));
  const changes: string[] = [];

  const restHealthRule = definition.combat?.health;
  const restHealth = restHealthRule && "pool" in restHealthRule ? restHealthRule.pool : undefined;
  let restEvaluated: ReturnType<typeof evaluateRulesetSheet> | undefined;
  for (const step of rest.restore) {
    // Only while a value off the sheet says so (1.434).
    if (step.when) {
      restEvaluated ??= evaluateRulesetSheet(definition, build);
      const value = resolveRulesetValueRef(definition, build, step.when.value, restEvaluated);
      if (step.when.atLeast !== undefined && value < step.when.atLeast) continue;
      if (step.when.atMost !== undefined && value > step.when.atMost) continue;
    }
    const moved = (current: number, max: number, min: number): number => {
      // A string other than these two is a state's value, which a state step below handles.
      if (step.to !== undefined) return step.to === "max" ? max : step.to === "min" ? min : Number(step.to);
      const by = step.by!;
      if ("const" in by) return current + by.const;
      return current + Math.max(by.min, roundRulesetNumber(max * by.fractionOfMax, by.round));
    };
    if (step.state !== undefined) {
      // A state the sheet hides has nothing to put back.
      const entry = resolved.states.find((state) => state.id === step.state);
      const declared = definition.sheet.live.states.find((state) => state.id === step.state);
      if (!entry || !declared || typeof step.to !== "string") continue;
      const value = step.to === "default" ? rulesetStateDefault(declared) : step.to;
      if (!declared.values.includes(value)) continue;
      if (value !== entry.value) changes.push(`${entry.label} ${own(entry.valueLabels, value) ?? value}`);
      entry.value = value;
      setState(entry, value);
      continue;
    }
    if (step.track !== undefined) {
      const entry = trackValues.get(step.track);
      if (!entry) continue;
      const value = clamp(moved(entry.value, entry.track.max, entry.track.min), entry.track.min, entry.track.max);
      // A rest can only HEAL a wound track: a step that would raise the count does nothing rather
      // than guessing at a kind. `to` clears down to that many marks, overflow and all; `by` clears
      // that many, overflow first, which is what healing means everywhere else. A step that names a
      // `kind` clears only marks of that kind and leaves the others where they are.
      if (entry.track.wound) {
        const declared = definition.sheet.live.tracks.find((candidate) => candidate.id === entry.track.id);
        if (!declared) continue;
        const work = woundWork(declared, entry.track.wound.levels, own(next.wounds, entry.track.id));
        // `by` clears the number the rest ASKED for, not the number the boxes went down by: harm
        // that could not land is still harm, and it comes off first, so a rest of two on a track
        // showing one mark and one spilled clears both rather than stopping at the box.
        const cleared =
          step.to !== undefined
            ? entry.value - value + work.overflow
            : Math.trunc(entry.value - moved(entry.value, entry.track.max, entry.track.min));
        if (cleared <= 0) continue;
        const severity = declared.kinds?.find((candidate) => candidate.id === step.kind)?.severity;
        applyWoundAmount(work, 0, -cleared, severity === undefined ? {} : { healSeverity: severity });
        const state = woundState(work);
        setWounds(entry.track.id, state);
        entry.value = filledOf(work);
        changes.push(`${entry.track.label} ${entry.value}/${entry.track.max}`);
        continue;
      }
      if (value !== entry.value) changes.push(`${entry.track.label} ${value}`);
      entry.value = value;
      setTrack(entry.track, value);
      continue;
    }
    const targets = [...values.values()].filter(({ pool }) => {
      if (step.pool !== undefined) return pool.key === step.pool;
      if (step.poolGroup !== undefined) return pool.group === step.poolGroup;
      if (step.listPools === undefined) return false;
      if (pool.listId !== step.listPools) return false;
      // One row by name (1.434).
      if (step.row !== undefined && !sameName(pool.label, step.row)) return false;
      return !step.recharge || (pool.recharge !== undefined && step.recharge.includes(pool.recharge));
    });
    // Shared (1.77): the fraction of the whole group's maximum, handed to its pools in the order the
    // sheet lists them, each up to what it is missing.
    let share =
      step.shared && step.by && "fractionOfMax" in step.by
        ? Math.max(
            step.by.min,
            roundRulesetNumber(
              targets.reduce((total, target) => total + target.pool.max, 0) * step.by.fractionOfMax,
              step.by.round,
            ),
          )
        : null;
    for (const target of targets) {
      let value: number;
      if (share !== null) {
        const taken = Math.max(0, Math.min(share, target.pool.max - target.value));
        share -= taken;
        value = target.value + taken;
      } else {
        value = clamp(moved(target.value, target.pool.max, 0), 0, target.pool.max);
      }
      // Never past what no rest gives back (1.203), and never down for it either.
      value = Math.min(value, Math.max(target.value, target.pool.max - target.pool.lasting));
      // A rest is no magical heal (1.261).
      if (value > target.value && target.pool.key === restHealth) {
        const by = healKeptOffBy(definition, next.conditions ?? [], false);
        if (by) {
          changes.push(`${by} keeps ${target.pool.label} from healing`);
          continue;
        }
      }
      if (value !== target.value) changes.push(`${target.pool.label} ${value}/${target.pool.max}`);
      target.value = value;
      setPool(target.pool, value, target.temp);
    }
  }
  // Temporary points it clears (1.804): 5e's temporary hit points at a long rest.
  if (rest.clear.temp) {
    for (const pool of resolved.pools) {
      const now = values.get(pool.key);
      if (!now || now.temp <= 0) continue;
      now.temp = 0;
      changes.push(`${pool.label} temporary points gone`);
      setPool(pool, now.value, 0);
    }
  }
  // Any rest gives back what only a rest could (1.193): nothing is sealed after one but what no rest
  // gives back (1.203).
  for (const pool of resolved.pools) {
    if (pool.sealed === pool.lasting) continue;
    const now = values.get(pool.key);
    setPool(pool, now?.value ?? pool.value, now?.temp ?? pool.temp, pool.lasting, pool.lasting);
  }
  // What a condition on them does with each such rest (1.260): Mummy Rot's lower maximum, a day at
  // a time. Sealed after the rest has given back what it gives back, so this rest keeps it.
  const health = definition.combat?.health;
  const healthPool = health && "pool" in health ? resolved.pools.find((pool) => pool.key === health.pool) : undefined;
  const held = new Set(next.conditions ?? []);
  for (const entry of definition.combat?.conditions ?? []) {
    const onRest = entry.onRest;
    if (!onRest || !healthPool || !held.has(entry.condition) || !onRest.rests.includes(rest.id)) continue;
    const label = definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
    // Its save first, if it has one: made, nothing is lowered, and with `cures` it is over.
    if (onRest.save) {
      const save = definition.sheet.saves.find((one) => one.id === onRest.save!.save);
      const { dice } = definition.resolution as { dice: { count: number; sides: number } };
      const evaluated = evaluateRulesetSheet(definition, build);
      const modifier = save
        ? rulesetCheckModifier(evaluated, {
            type: "save",
            id: save.id,
            label: save.label,
            ...(save.ability ? { ability: save.ability } : {}),
          })
        : 0;
      let total = modifier;
      if (roll) for (let index = 0; index < dice.count; index += 1) total += roll(dice.sides);
      else total += Math.floor((dice.count * (dice.sides + 1)) / 2);
      const made = total >= onRest.save.difficulty;
      changes.push(
        `${label}: ${save?.label ?? onRest.save.save} ${total} against ${onRest.save.difficulty}, ${made ? (onRest.save.cures ? "cured" : "made") : "failed"}`,
      );
      if (made) {
        if (onRest.save.cures) {
          next.conditions = (next.conditions ?? []).filter((id) => id !== entry.condition);
          const back = giveBackLowered(entry.condition);
          if (back) changes.push(back.slice(2));
        }
        continue;
      }
    }
    const dice = onRest.lowersMax.dice ? parseRulesetCombatDice(onRest.lowersMax.dice) : null;
    let amount = onRest.lowersMax.flat ?? 0;
    if (dice) {
      if (roll) for (let index = 0; index < dice.count; index += 1) amount += roll(dice.sides);
      else amount += Math.floor((dice.count * (dice.sides + 1)) / 2);
      amount += dice.flat;
    }
    if (amount <= 0) continue;
    const stored = own(next.pools, healthPool.key);
    const sealedBefore = stored?.sealed ?? 0;
    const sealed = Math.min(healthPool.max, sealedBefore + amount);
    const lasting = onRest.lasting
      ? Math.min(sealed, (stored?.lasting ?? 0) + (sealed - sealedBefore))
      : Math.min(sealed, stored?.lasting ?? 0);
    const now = values.get(healthPool.key);
    const value = Math.min(now?.value ?? healthPool.value, healthPool.max - sealed);
    if (now) now.value = value;
    setPool(healthPool, value, now?.temp ?? healthPool.temp, sealed, lasting);
    // Kept apart for a cure that gives it back (1.261).
    if (onRest.lasting && onRest.restoredWhenCured && sealed > sealedBefore) {
      next.lowered = {
        ...next.lowered,
        [entry.condition]: (own(next.lowered, entry.condition) ?? 0) + sealed - sealedBefore,
      };
    }
    changes.push(`${label} lowers ${healthPool.label}'s maximum by ${sealed - sealedBefore}`);
  }
  for (const id of rest.clear.text) setText(id, "");
  // What may be used on a creature once until this rest may be again (1.304).
  for (const key of Object.keys(next.usedOn ?? {})) if (key.startsWith(`${rest.id}|`)) delete next.usedOn![key];
  const before = next.conditions ?? [];
  if (rest.clear.conditions === "all") next.conditions = [];
  else if (rest.clear.conditions.length > 0) {
    const cleared = new Set<string>(rest.clear.conditions);
    next.conditions = (next.conditions ?? []).filter((id) => !cleared.has(id));
  }
  // Whatever came off by this rest, a cure by it, gives back what it took for good (1.261).
  for (const id of before) {
    if ((next.conditions ?? []).includes(id)) continue;
    const back = giveBackLowered(id);
    if (back) changes.push(back.slice(2));
  }
  // What it puts on as it ends (1.426): Tranquility, on a sheet its `when` holds for.
  if (rest.puts?.length) {
    const evaluated = evaluateRulesetSheetLive(definition, build, next, items);
    for (const put of rest.puts) {
      if ((next.conditions ?? []).includes(put.condition)) continue;
      if (put.when) {
        const value = resolveRulesetValueRef(definition, build, put.when.value, evaluated);
        if (put.when.atLeast !== undefined && value < put.when.atLeast) continue;
        if (put.when.atMost !== undefined && value > put.when.atMost) continue;
      }
      next.conditions = [...(next.conditions ?? []), put.condition];
      const label = definition.sheet.live.conditions.find((one) => one.id === put.condition)?.label ?? put.condition;
      changes.push(`${label} on`);
    }
  }

  return done(changes.length > 0 ? `${rest.label}: ${changes.join(", ")}` : rest.label);
}

function definitionTrackDefault(definition: RulesetDefinition, id: string): number | undefined {
  return definition.sheet.live.tracks.find((track) => track.id === id)?.default;
}

// ── The `use` command ──
//
// What a character uses is a row they picked from a catalog, so what it costs is that entry's own
// `mechanics.cost` plus one from every list-row pool the same entry wrote (a trick's uses, a class
// feature's counter). The Engine turns that into plain `spend` operations and the caller applies
// them all or nothing, so the Game Master names the ability and never does the arithmetic.

export interface RulesetUseStep {
  op: RulesetSheetOp;
  /** The pool this step pays, as the sheet shows it, for the outcome written back into the tag. */
  label: string;
}

/**
 * The ONE rule for which picked entry a name means, so everything that acts on a named entry acts
 * on the same one: a row answers to the name the sheet shows it under and to the label of the entry
 * it came from, and a name two rows answer to is refused rather than guessed at.
 */
export function rulesetEntryNamed(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  wanted: string,
):
  | {
      ok: true;
      ref: string;
      entry: RulesetCatalogEntry;
      /** The entry its row stands for (1.493), when another's: Pact of the Chain's Find Familiar. */
      standsFor?: RulesetCatalogEntry;
    }
  | { ok: false; reason: RulesetSheetRefusal } {
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const matched = new Set<string>();
  const standing = new Map<string, string>();
  for (const list of definition.sheet.lists) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const nameColumn = rulesetEntryNameColumn(definition, list);
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const cells = row as Record<string, unknown>;
      const ref = own(cells, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string") continue;
      const name = nameColumn ? own(cells, nameColumn) : undefined;
      const label = byRef.get(ref)?.label;
      if ((typeof name === "string" && sameName(name, wanted)) || (label && sameName(label, wanted))) {
        matched.add(ref);
        const stands = own(cells, RULESET_STANDS_FOR_ROW_KEY);
        if (typeof stands === "string" && stands !== ref) standing.set(ref, stands);
      }
    }
  }
  if (matched.size === 0) return { ok: false, reason: "unknown-entry" };
  if (matched.size > 1) return { ok: false, reason: "ambiguous-entry" };
  const ref = [...matched][0]!;
  const entry = byRef.get(ref);
  if (!entry) return { ok: false, reason: "unknown-entry" };
  const standsFor = standing.has(ref) ? byRef.get(standing.get(ref)!) : undefined;
  return { ok: true, ref, entry, ...(standsFor ? { standsFor } : {}) };
}

export type RulesetUsePlan =
  | {
      ok: true;
      label: string;
      steps: RulesetUseStep[];
      /** A priced material the entry needs its user to carry (1.790), for the caller to look for. */
      material?: NonNullable<RulesetCatalogMechanics["material"]>;
    }
  | { ok: false; reason: RulesetSheetRefusal };

/** The column a Game Master sees a row of this list under: what the sheet block prints it as, then
 *  the name a row pool is keyed by, then the first text column the list has. */
export function rulesetEntryNameColumn(definition: RulesetDefinition, list: RulesetList): string | undefined {
  return (
    definition.gm.sheetSummary.lists.find((entry) => entry.list === list.id)?.nameColumn ??
    list.pools?.nameColumn ??
    list.columns.find((column) => column.type === "text")?.id
  );
}

/**
 * What a Game Master's `use` of an entry heals its user outside a fight (1.788): an entry whose
 * mechanics heal `self` with `outsideFight`, rolled with `roll` (each die its average without one)
 * plus its `amountAdd`, onto the sheet's health. Null for an entry that does not, or a sheet with no
 * health pool to heal.
 */
export function rulesetUseHealOutsideFight(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  name: string,
  stored: unknown,
  roll?: (sides: number) => number,
  items?: ReadonlyArray<RulesetSheetItem>,
): RulesetSheetOpResult | null {
  const found = rulesetEntryNamed(definition, build, catalogs, name);
  const mechanics = found.ok ? found.entry.mechanics : undefined;
  if (!mechanics?.outsideFight || mechanics.kind !== "heal" || !mechanics.amount) return null;
  const health = definition.combat?.health;
  const pool = health && "pool" in health ? health.pool : undefined;
  if (!pool) return null;
  const [, count, sides, plus] = /^(\d+)d(\d+)([+-]\d+)?$/u.exec(mechanics.amount.dice ?? "") ?? [];
  let amount = (mechanics.amount.flat ?? 0) + Number(plus ?? 0);
  for (let die = 0; die < Number(count ?? 0); die++) {
    const faces = Number(sides);
    amount += roll ? Math.max(1, Math.min(faces, Math.trunc(roll(faces)))) : (faces + 1) / 2;
  }
  if (mechanics.amountAdd) {
    const added = resolveRulesetValueRef(
      definition,
      build,
      mechanics.amountAdd,
      evaluateRulesetSheetLive(definition, build, stored, items),
    );
    if (Number.isFinite(added)) amount += Math.trunc(added);
  }
  const total = Math.max(0, Math.floor(amount));
  if (total === 0) return null;
  return applyRulesetSheetOp(definition, build, stored, { op: "restore", pool, amount: total }, roll, items);
}

/** How many creature names a refusal lists, so its reason stays a line long. */
const MAX_KEPT_CALL_NAMES = 6;

/**
 * The call a Game Master's `use` of an entry outside a fight keeps (1.798): an entry set up before a
 * fight (`beforeFight`) that calls somebody, whose creature stays on its user's sheet and joins every
 * fight they are in until it is dismissed or killed. Find Familiar's familiar. Null for an entry that
 * keeps none. The creature is the one `as` names, checked against what it calls where the catalog it
 * calls from is among `catalogs`, with a creature type after a comma where it lets one be picked
 * ("Owl, Fey"); one it calls alone needs no name.
 */
export function rulesetUseKeptCall(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  op: Extract<RulesetSheetOp, { op: "use" }>,
): { ok: true; entry: string; as: string } | { ok: false; reason: RulesetSheetRefusal } | null {
  const found = rulesetEntryNamed(definition, build, catalogs, op.name.trim());
  // A row standing for another entry calls what that one calls (laptop party A: Pact of the Chain's
  // Find Familiar row is the Pact's, and the spell's calls were never read).
  const source = found.ok ? (found.standsFor?.mechanics?.calls ? found.standsFor : found.entry) : undefined;
  const mechanics = source?.mechanics;
  const calls = mechanics?.calls;
  if (!source || !mechanics?.beforeFight || !calls || definition.combat === undefined) return null;
  const entry = source.label;
  const plain = (value: string | number) => String(value).trim().toLowerCase();
  const holds = (value: unknown, want: unknown) => {
    if (value === undefined) return false;
    const have = (Array.isArray(value) ? value : [value]).map((one) => plain(one as string));
    return (Array.isArray(want) ? want : [want]).some((one) => have.includes(plain(one as string)));
  };
  // What an entry can call, by name, where that can be read: its catalog's matches, or its one creature.
  const callable = (what: NonNullable<RulesetCatalogMechanics["calls"]>) => {
    const from = what.from;
    return from
      ? catalogs[from.catalog]
          ?.filter(
            (one) =>
              Object.entries(from.filters ?? {}).every(([id, want]) => holds(one.filters?.[id], want)) &&
              !Object.entries(from.notFilters ?? {}).some(([id, want]) => holds(one.filters?.[id], want)),
          )
          .map((one) => one.label)
      : undefined;
  };
  const names = callable(calls);
  const alone = !!calls.creature || names?.length === 1;
  const types = (calls.asTypes ?? []).map((id) => ({
    id,
    label: definition.combat?.creatureTypes?.types.find((one) => one.id === id)?.label ?? id,
  }));
  const wanted = op.as?.trim() ?? "";
  if (!wanted) {
    if (alone) return { ok: true, entry, as: names?.[0] ?? "" };
    const listed = names?.length
      ? ` from ${names.slice(0, MAX_KEPT_CALL_NAMES).join(", ")}${names.length > MAX_KEPT_CALL_NAMES ? ", ..." : ""}`
      : "";
    return { ok: false, reason: `bad-amount: name the creature ${entry} calls, as as="Name"${listed}` };
  }
  const [base = "", typed] = wanted.split(",").map((part) => part.trim());
  const named = names ? names.find((one) => sameName(one, base)) : base;
  if (named === undefined || !named) {
    const listed = names?.length
      ? `; it calls ${names.slice(0, MAX_KEPT_CALL_NAMES).join(", ")}${names.length > MAX_KEPT_CALL_NAMES ? ", ..." : ""}`
      : "";
    const other = rulesetSheetEntryCalling(definition, build, catalogs, base, callable);
    const elsewhere = other && !sameName(other, op.name.trim()) ? `; use "${other}" for that` : "";
    return { ok: false, reason: `bad-amount: ${entry} cannot call "${base}"${listed}${elsewhere}` };
  }
  const type = typed ? types.find((one) => sameName(one.id, typed) || sameName(one.label, typed)) : undefined;
  if (typed && !type) return { ok: false, reason: `bad-amount: ${entry} cannot call a "${typed}"` };
  return { ok: true, entry, as: type ? `${named}, ${type.label}` : named };
}

/** The name of another row on the sheet whose entry keeps a call of `creature` (1.799), so a refusal
 *  can point a Game Master at it: the Imp a warlock calls through "Find Familiar (Pact of the Chain)"
 *  and not the plain spell. */
function rulesetSheetEntryCalling(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  creature: string,
  callable: (calls: NonNullable<RulesetCatalogMechanics["calls"]>) => string[] | undefined,
): string | undefined {
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  for (const list of definition.sheet.lists) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const nameColumn = rulesetEntryNameColumn(definition, list);
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const cells = row as Record<string, unknown>;
      const ref = own(cells, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string") continue;
      const stands = own(cells, RULESET_STANDS_FOR_ROW_KEY);
      const entry = byRef.get(ref);
      const standsFor = typeof stands === "string" ? byRef.get(stands) : undefined;
      const source = standsFor?.mechanics?.calls ? standsFor : entry;
      const calls = source?.mechanics?.beforeFight ? source.mechanics.calls : undefined;
      if (!calls || !callable(calls)?.some((one) => sameName(one, creature))) continue;
      const name = nameColumn ? own(cells, nameColumn) : undefined;
      return typeof name === "string" && name.trim() ? name.trim() : entry?.label;
    }
  }
  return undefined;
}

/**
 * The shape a Game Master's `use` of an entry outside a fight keeps its user in (1.801): an entry that
 * changes its user's own shape (`forms`, aimed at `self`), whose form stays on their sheet and starts
 * every fight they are in until it ends. A druid's Wild Shape. Null for an entry that changes no shape
 * of its user's. The form is the one `as` names, checked against the forms it offers where the catalog
 * they come from is among `catalogs`: no higher than the cap their sheet reads, and none that moves in
 * a way they may not take yet. One it offers alone needs no name.
 */
export function rulesetUseKeptForm(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  op: Extract<RulesetSheetOp, { op: "use" }>,
  stored: unknown,
  items?: ReadonlyArray<RulesetSheetItem>,
): { ok: true; shaped: RulesetLiveShaped } | { ok: false; reason: RulesetSheetRefusal } | null {
  const found = rulesetEntryNamed(definition, build, catalogs, op.name.trim());
  const source = found.ok ? (found.standsFor?.mechanics?.forms ? found.standsFor : found.entry) : undefined;
  const forms = source?.mechanics?.forms;
  if (!source || !forms || source.mechanics?.targets !== "self" || definition.combat === undefined) return null;
  const entry = source.label;
  const plain = (value: string | number) => String(value).trim().toLowerCase();
  const holds = (value: unknown, want: unknown) => {
    if (value === undefined) return false;
    const have = (Array.isArray(value) ? value : [value]).map((one) => plain(one as string));
    return (Array.isArray(want) ? want : [want]).some((one) => have.includes(plain(one as string)));
  };
  let evaluated: ReturnType<typeof evaluateRulesetSheetLive> | undefined;
  const read = (ref: RulesetValueRef) =>
    resolveRulesetValueRef(
      definition,
      build,
      ref,
      (evaluated ??= evaluateRulesetSheetLive(definition, build, stored, items)),
    );
  const cap = forms.upTo?.at ? read(forms.upTo.at) : undefined;
  // The forms it offers, as a fight reads them: those it names, then its catalog's matches.
  const refs = [...(forms.into ?? [])];
  const from = forms.from;
  for (const one of from ? (catalogs[from.catalog] ?? []) : []) {
    const ref = `${from!.catalog}/${one.id}`;
    if (refs.includes(ref)) continue;
    if (!Object.entries(from!.filters ?? {}).every(([id, want]) => holds(one.filters?.[id], want))) continue;
    if (Object.entries(from!.notFilters ?? {}).some(([id, want]) => holds(one.filters?.[id], want))) continue;
    refs.push(ref);
  }
  // Why a form it names is not one it takes now, so a refusal can say so.
  const barred = new Map<string, string>();
  const offered = refs.flatMap((ref) => {
    const [catalogId, entryId] = ref.split("/");
    const one = catalogs[catalogId ?? ""]?.find((candidate) => candidate.id === entryId);
    if (!one?.creature) return [];
    const ranked = forms.upTo ? one.filters?.[forms.upTo.filter] : undefined;
    if (cap !== undefined && typeof ranked === "number" && ranked > cap) {
      barred.set(one.label, `is above the most it takes now (${ranked} against ${cap})`);
      return [];
    }
    const speeds = (one.creature as { speeds?: Record<string, number> }).speeds;
    const bar = forms.without?.find(
      (each) => (speeds?.[each.speed] ?? 0) > 0 && !(each.unless && read(each.unless) > 0),
    );
    if (bar) {
      barred.set(one.label, `has a ${bar.speed} speed, which it cannot take yet`);
      return [];
    }
    return [one.label];
  });
  // Only what can be read is checked: forms from a catalog not to hand are taken as named.
  const known = from ? from.catalog in catalogs : true;
  const wanted = op.as?.trim() ?? "";
  if (!wanted) {
    if (offered.length === 1) return { ok: true, shaped: { entry, as: offered[0]! } };
    const listed = offered.length
      ? ` from ${offered.slice(0, MAX_KEPT_CALL_NAMES).join(", ")}${offered.length > MAX_KEPT_CALL_NAMES ? ", ..." : ""}`
      : "";
    return { ok: false, reason: `bad-amount: name the form ${entry} takes, as as="Name"${listed}` };
  }
  // Its kind said after it is not part of its name (laptop 2026-10-26: as="Reef Shark, Beast").
  const bare = withoutTrailingKind(wanted);
  const match = (name: string) => sameName(name, wanted) || (!!bare && sameName(name, bare));
  const named = offered.find(match) ?? (known ? undefined : wanted);
  if (!named) {
    const why = [...barred.entries()].find(([name]) => match(name));
    if (why) return { ok: false, reason: `bad-amount: ${entry} cannot take the form ${why[0]} now: it ${why[1]}` };
    // The forms nearest what was asked, by a word they share, else the first few it takes.
    const asked = new Set(
      plain(bare || wanted)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 2),
    );
    const near = offered.filter((one) =>
      plain(one)
        .split(/[^\p{L}\p{N}]+/u)
        .some((word) => asked.has(word)),
    );
    const shown = (near.length ? near : offered).slice(0, near.length ? 3 : MAX_KEPT_CALL_NAMES);
    const listed = shown.length
      ? `; ${near.length ? "nearest" : "it takes"} ${shown.join(", ")}${!near.length && offered.length > MAX_KEPT_CALL_NAMES ? ", ..." : ""}`
      : "";
    return { ok: false, reason: `bad-amount: ${entry} cannot take the form "${wanted}" now${listed}` };
  }
  return { ok: true, shaped: { entry, as: named } };
}

/** The shape a use outside a fight keeps its user in (1.801), as the sheet stores it. */
export function rulesetKeptForm(stored: unknown): RulesetLiveShaped | undefined {
  return readStoredLiveStateAsIs(stored).shaped;
}

/** What each entry used outside a fight called and keeps (1.798), as the sheet stores it. */
export function rulesetKeptCalls(stored: unknown): Array<{ entry: string; as: string }> {
  return Object.entries(readStoredLiveStateAsIs(stored).called ?? {}).map(([entry, as]) => ({ entry, as }));
}

/** Whether a row this entry wrote is ticked in its list's `ritual` column (1.807), so it may be used
 *  outside a fight as a ritual, by a sheet its list's `ritualNeeds` allows (1.809). */
export function rulesetRowIsRitual(definition: RulesetDefinition, build: RulesetSheetBuild, ref: string): boolean {
  const holds = (needs: readonly string[]) =>
    Object.values(build.lists ?? {}).some(
      (rows) =>
        Array.isArray(rows) &&
        rows.some(
          (row) =>
            !!row &&
            typeof row === "object" &&
            needs.includes(String(own(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY))),
        ),
    );
  return definition.sheet.lists.some((list) => {
    const rows = build.lists?.[list.id];
    if (!list.ritual || !Array.isArray(rows)) return false;
    if (list.ritualNeeds && !holds(list.ritualNeeds)) return false;
    return rows.some(
      (row) =>
        !!row &&
        typeof row === "object" &&
        own(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY) === ref &&
        own(row as Record<string, unknown>, list.ritual!) === true,
    );
  });
}

/**
 * A pool only a rest gives back, as one sheet holds it: its key and label, and the rests that give it
 * back. Null for health, which heals many ways, for a pool no rest gives back, and for one a rest
 * gives back only a fixed few of, which the story hands out too (a point of luck). A Game Master's
 * bare restore of such a pool is a rest or a feature's use told without its command (laptop
 * 2026-10-26: a cleric's spell slots back on a short rest that restores none of them, and a slot
 * Arcane Recovery gave back with its use left unspent).
 */
export function rulesetRestOnlyPool(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  pool: string,
  items?: ReadonlyArray<RulesetSheetItem>,
): { key: string; label: string; group?: string; rests: string[] } | null {
  const match = findPool(
    resolveLive(definition, build, readStoredLiveState(definition, build, stored), items).pools,
    pool,
  );
  if ("refusal" in match) return null;
  const found = match.pool;
  const health = definition.combat?.health ?? definition.battle?.health;
  if (health && "pool" in health && health.pool === found.key) return null;
  const rests: string[] = [];
  for (const rest of definition.rests) {
    const steps = rest.restore.filter((step) => {
      if (step.pool !== undefined) return step.pool === found.key;
      if (step.poolGroup !== undefined) return found.group === step.poolGroup;
      if (step.listPools === undefined || found.listId !== step.listPools) return false;
      if (step.row !== undefined && !sameName(found.label, step.row)) return false;
      return !step.recharge || (found.recharge !== undefined && step.recharge.includes(found.recharge));
    });
    if (steps.some((step) => step.by !== undefined && "const" in step.by)) return null;
    if (steps.length > 0) rests.push(rest.id);
  }
  if (rests.length === 0) return null;
  return { key: found.key, label: found.label, ...(found.group ? { group: found.group } : {}), rests };
}

/** The entries on a sheet whose use gives back spent pools of this group (1.410): Arcane Recovery
 *  for spell slots. With the rest each is offered at (1.789), where it is. */
export function rulesetRecoveriesOfGroup(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  group: string,
): Array<{ name: string; atRest?: string }> {
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const seen = new Set<string>();
  const out: Array<{ name: string; atRest?: string }> = [];
  for (const list of definition.sheet.lists) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const ref = own(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string" || seen.has(ref)) continue;
      seen.add(ref);
      const entry = byRef.get(ref);
      const recovers = entry?.mechanics?.recovers;
      if (!entry || !recovers || recovers.group !== group) continue;
      out.push({ name: entry.label, ...(recovers.atRest !== undefined ? { atRest: recovers.atRest } : {}) });
    }
  }
  return out;
}

/**
 * What using one catalog-picked ability spends, or why it cannot be worked out. Pure: nothing is
 * applied here, and the caller puts every step through `applyRulesetSheetOp` on a working copy so a
 * refusal in the middle leaves the sheet exactly as it was.
 *
 * A catalog the caller could not fetch reads as an entry that is not there: the Engine cannot know
 * what the ability costs, and guessing would let a spell be cast for free.
 */
export function planRulesetUse(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  catalogs: RulesetCatalogEntriesById,
  op: Extract<RulesetSheetOp, { op: "use" }>,
  /** How many of its rows' uses one use spends (1.245): Quivering Palm's 3 ki. */
  uses = 1,
  /** A pool the use gives back to, which it never spends (1.252): Font of Magic turning a slot into
   *  the Sorcery Points its own row counts. */
  keeps?: string,
  /** Spending another entry's counter by name (1.239 `usesOf`): the price is these terms, the using
   *  entry's own, and of the named entry only the counter the name is, never its cost or its other
   *  rows (Flurry of Blows' ki is not a Martial Arts use). */
  borrowed?: { cost: ReadonlyArray<{ pool: string; amount: number }> },
): RulesetUsePlan {
  const wanted = op.name.trim();
  if (!wanted) return { ok: false, reason: "unknown-entry" };

  const found = rulesetEntryNamed(definition, build, catalogs, wanted);
  if (!found.ok) return found;
  const { ref, entry } = found;
  // As a ritual (1.807): only a row its list's `ritual` column ticks, and then it pays none of its
  // pools, slots or counters; a priced material it still needs (laptop 2026-10-26: a ritual Detect
  // Magic spent a slot).
  if (op.ritual && !rulesetRowIsRitual(definition, build, ref)) return { ok: false, reason: "not-ritual" };

  const resolved = readRulesetLive(definition, build, stored);
  const declared = resolved.pools.filter((pool) => !pool.listId);
  const declaredByKey = new Map(declared.map((pool) => [pool.key, pool]));
  /** The family a cost term names, whether it named a pool of that family or the family itself. */
  const groupOf = (target: string): string | undefined => {
    const pool = definition.sheet.live.pools.find((entry) => entry.id === target);
    if (pool) return pool.group;
    return definition.sheet.live.pools.some((entry) => entry.group === target) ? target : undefined;
  };

  /** The level of what a pool pays at: its own `level`, else its place in its group (1.116). */
  const poolLevel = (id: string): number => {
    const pool = definition.sheet.live.pools.find((one) => one.id === id);
    if (!pool) return 0;
    if (pool.level) return Math.max(0, Math.trunc(resolveRulesetValueRef(definition, build, pool.level)));
    const family = pool.group ? definition.sheet.live.pools.filter((one) => one.group === pool.group) : [];
    return family.indexOf(pool) + 1;
  };
  const terms = op.ritual ? [] : borrowed ? borrowed.cost : (entry.mechanics?.cost ?? []);
  let costs: Array<{ pool: string; amount: number }> = [...terms];
  // The entry's own counter named as its pool asks for nothing different: it is spent as it always is
  // (laptop 2026-10-25: a Game Master's Wild Shape refused for naming its uses).
  const paidAnyway = (named: string) =>
    resolved.pools.some((pool) => !!pool.listId && sameName(pool.label, named) && sameName(pool.label, entry.label));
  if (op.pool !== undefined && !paidAnyway(op.pool.trim())) {
    // An upcast: one price, paid out of another pool of the same family. Anything else is refused
    // rather than reinterpreted, because paying a different bill is not what was asked for.
    const named = op.pool.trim();
    const group = terms.length === 1 ? groupOf(terms[0]!.pool) : undefined;
    const target = named ? poolNamed(declared, named) : undefined;
    // A pool of another group pays too where it says so (1.171): 5e's pact slots, for a spell
    // costed from the spell slots, and at no lower a level than the cost's own.
    const pays = definition.sheet.live.pools.find((pool) => pool.id === target?.key)?.pays;
    if (!group || !target) return { ok: false, reason: "bad-pool" };
    if (target.group !== group) {
      if (!pays?.includes(group) || poolLevel(target.key) < poolLevel(terms[0]!.pool)) {
        return { ok: false, reason: "bad-pool" };
      }
    }
    costs = [{ pool: target.key, amount: terms[0]!.amount }];
  }

  const steps: RulesetUseStep[] = [];
  /** What this plan already spends per pool, so two terms on one family do not both read the value
   *  the turn started with. */
  const running = new Map<string, number>();
  const spend = (pool: { key: string; label: string }, amount: number) => {
    running.set(pool.key, (running.get(pool.key) ?? 0) + amount);
    steps.push({ op: { op: "spend", pool: pool.key, amount }, label: pool.label });
  };

  for (const cost of costs) {
    const direct = declaredByKey.get(cost.pool);
    if (direct) {
      spend(direct, cost.amount);
      continue;
    }
    const family = definition.sheet.live.pools.filter((pool) => pool.group === cost.pool);
    if (family.length > 0) {
      // The first pool of the family, in declaration order, that can still afford it. There is no
      // automatic climb to a higher one: a group is not always a ladder, and the Game Master can
      // see every pool's value on the sheet block and name one with pool=.
      const present = family.flatMap((pool) => {
        const found = declaredByKey.get(pool.id);
        return found ? [found] : [];
      });
      const chosen = present.find((pool) => pool.value - (running.get(pool.key) ?? 0) >= cost.amount) ?? present[0];
      if (!chosen) return { ok: false, reason: "insufficient" };
      spend(chosen, cost.amount);
      continue;
    }
    // A pool this sheet does not have right now, such as a caster's empty ninth-level slots. It is
    // refused where every other spend on it would be, with the same reason.
    steps.push({ op: { op: "spend", pool: cost.pool, amount: cost.amount }, label: cost.pool });
  }

  // Plus one from every list-row pool this same entry wrote: the counter that tracks a feature's
  // uses is one of the entry's own rows, found by the same mark. A borrowed name spends only the row
  // it names, when a row has that name; one naming the entry itself still means all of its rows.
  const rowName = (list: RulesetList, cells: Record<string, unknown>): string | undefined => {
    const name = own(cells, list.pools?.nameColumn ?? "");
    return typeof name === "string" ? name : undefined;
  };
  const onlyNamed =
    !!borrowed &&
    definition.sheet.lists.some((list) => {
      const rows = build.lists?.[list.id];
      if (!list.pools || !Array.isArray(rows)) return false;
      return rows.some((row) => {
        if (!row || typeof row !== "object") return false;
        const cells = row as Record<string, unknown>;
        const name = rowName(list, cells);
        return own(cells, RULESET_CATALOG_ROW_KEY) === ref && !!name && sameName(name, wanted);
      });
    });
  for (const list of op.ritual ? [] : definition.sheet.lists) {
    const pools = list.pools;
    const rows = build.lists?.[list.id];
    if (!pools || !Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const cells = row as Record<string, unknown>;
      if (own(cells, RULESET_CATALOG_ROW_KEY) !== ref) continue;
      const name = own(cells, pools.nameColumn);
      if (typeof name !== "string") continue;
      if (onlyNamed && !sameName(name, wanted)) continue;
      const key = `${list.id}${LIST_POOL_SEPARATOR}${name.trim().toLowerCase()}`;
      const pool = resolved.pools.find((candidate) => candidate.key === key);
      // A counter whose maximum is 0 is not a pool at all (a scaled trick on a Heart of 0), so
      // there is nothing left to use. Saying "ok, no cost" would hand out a free use.
      if (!pool && name.trim() && !isRulesetItemHidden(list, build, definition)) {
        return { ok: false, reason: "insufficient" };
      }
      if (keeps && pool && (sameName(pool.key, keeps) || sameName(pool.label, keeps))) continue;
      if (pool && !running.has(pool.key)) spend(pool, uses);
    }
  }
  // Spent pools it gives back, as many levels as its user's sheet allows (1.410): Arcane Recovery.
  const recovers = entry.mechanics?.recovers;
  if (op.recover?.length && !recovers) return { ok: false, reason: `bad-amount: ${entry.label} recovers nothing` };
  if (recovers) {
    const group = definition.sheet.live.pools.filter((pool) => pool.group === recovers.group);
    const names = group.map((pool) => declaredByKey.get(pool.id)?.label ?? pool.id).join(", ");
    if (!op.recover?.length) {
      return {
        ok: false,
        reason: `bad-amount: name what ${entry.label} recovers, as recover="Pool:count" from ${names}`,
      };
    }
    const upTo = Math.max(0, Math.trunc(resolveRulesetValueRef(definition, build, recovers.upTo)));
    let levels = 0;
    const given = new Map<string, number>();
    for (const wanted of op.recover) {
      const target = declared.find(
        (pool) =>
          group.some((one) => one.id === pool.key) &&
          (sameName(pool.key, wanted.pool) || sameName(pool.label, wanted.pool)),
      );
      if (!target) return { ok: false, reason: "bad-pool" };
      const level = poolLevel(target.key);
      if (recovers.most !== undefined && level > recovers.most) return { ok: false, reason: "bad-pool" };
      if (!Number.isInteger(wanted.count) || wanted.count < 1) return { ok: false, reason: "bad-amount" };
      const spent = target.max - target.value + (running.get(target.key) ?? 0) - (given.get(target.key) ?? 0);
      if (wanted.count > spent) return { ok: false, reason: "insufficient" };
      given.set(target.key, (given.get(target.key) ?? 0) + wanted.count);
      levels += level * wanted.count;
      steps.push({ op: { op: "restore", pool: target.key, amount: wanted.count }, label: target.label });
    }
    if (levels > upTo) {
      return { ok: false, reason: `bad-amount: ${entry.label} recovers ${upTo} levels at most, not ${levels}` };
    }
    // As many pools in all as it says, at most (1.656).
    const total = op.recover.reduce((sum, one) => sum + one.count, 0);
    if (recovers.count !== undefined && total > recovers.count) {
      return { ok: false, reason: `bad-amount: ${entry.label} recovers ${recovers.count} at most, not ${total}` };
    }
  }
  return {
    ok: true,
    label: entry.label,
    steps,
    ...(entry.mechanics?.material ? { material: structuredClone(entry.mechanics.material) } : {}),
  };
}

/** What an item's `recovers` gives back by itself (1.656): one at a time, the highest-level spent
 *  pool of its group no higher than `most` whose level still fits under `upTo`, up to `count` of
 *  them. A Pearl of Power's one slot of 3rd level or lower. Pool keys, one per pool given back. */
export function rulesetRecoverPicks(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  recovers: { group: string; upTo: RulesetValueRef; most?: number; count?: number },
): string[] {
  const group = definition.sheet.live.pools.filter((pool) => pool.group === recovers.group);
  const levelOf = (id: string): number => {
    const pool = group.find((one) => one.id === id);
    if (!pool) return 0;
    if (pool.level) return Math.max(0, Math.trunc(resolveRulesetValueRef(definition, build, pool.level)));
    return group.indexOf(pool) + 1;
  };
  const resolved = readRulesetLive(definition, build, stored).pools.filter(
    (pool) => !pool.listId && group.some((one) => one.id === pool.key),
  );
  const spent = new Map(resolved.map((pool) => [pool.key, Math.max(0, pool.max - pool.value)]));
  let room = Math.max(0, Math.trunc(resolveRulesetValueRef(definition, build, recovers.upTo)));
  const picks: string[] = [];
  for (let one = 0; one < (recovers.count ?? 1); one++) {
    const best = resolved
      .filter((pool) => {
        const level = levelOf(pool.key);
        return (
          (spent.get(pool.key) ?? 0) > 0 && level <= room && (recovers.most === undefined || level <= recovers.most)
        );
      })
      .sort((a, b) => levelOf(b.key) - levelOf(a.key))[0];
    if (!best) break;
    picks.push(best.key);
    spent.set(best.key, spent.get(best.key)! - 1);
    room -= levelOf(best.key);
  }
  return picks;
}

/** A feature a rest offers to use as it ends (Capability API 1.789): its `recovers.atRest` names the
 *  rest. 5e's Arcane Recovery and Natural Recovery on a Short rest. */
export interface RulesetRestRecovery {
  /** The entry's name, as a `use` names it. */
  name: string;
  /** The most levels it gives back in all, read off the sheet. */
  upTo: number;
  /** No pool above this level. */
  most?: number;
  /** How many pools in all, at most. */
  count?: number;
  /** The spent pools of its group it may give back, highest level first. */
  pools: Array<{ key: string; label: string; level: number; spent: number }>;
  /** What it gives back by itself: the highest spent pools that fit. */
  picks: RulesetUseRecover[];
}

/** The features a rest offers to use as it ends (1.789): every entry on the sheet whose `recovers`
 *  names this rest in `atRest`, that has a use left and something spent to give back. */
export function rulesetRestRecoveries(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  catalogs: RulesetCatalogEntriesById,
  restId: string,
): RulesetRestRecovery[] {
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const seen = new Set<string>();
  const offers: RulesetRestRecovery[] = [];
  const resolved = readRulesetLive(definition, build, stored).pools;
  for (const list of definition.sheet.lists) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const ref = own(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string" || seen.has(ref)) continue;
      seen.add(ref);
      const entry = byRef.get(ref);
      const recovers = entry?.mechanics?.recovers;
      if (!entry || !recovers || recovers.atRest !== restId) continue;
      const group = definition.sheet.live.pools.filter((pool) => pool.group === recovers.group);
      const levelOf = (id: string): number => {
        const pool = group.find((one) => one.id === id);
        if (!pool) return 0;
        if (pool.level) return Math.max(0, Math.trunc(resolveRulesetValueRef(definition, build, pool.level)));
        return group.indexOf(pool) + 1;
      };
      const pools = resolved
        .filter((pool) => !pool.listId && group.some((one) => one.id === pool.key))
        .map((pool) => ({
          key: pool.key,
          label: pool.label,
          level: levelOf(pool.key),
          spent: Math.max(0, pool.max - pool.value),
        }))
        .filter((pool) => pool.spent > 0 && (recovers.most === undefined || pool.level <= recovers.most))
        .sort((a, b) => b.level - a.level);
      const upTo = Math.max(0, Math.trunc(resolveRulesetValueRef(definition, build, recovers.upTo)));
      // The highest that fit, one at a time, as many as `count` allows (every one that fits without it).
      const left = new Map(pools.map((pool) => [pool.key, pool.spent]));
      const given = new Map<string, number>();
      let room = upTo;
      for (let one = 0; one < (recovers.count ?? 100); one++) {
        const best = pools.find((pool) => (left.get(pool.key) ?? 0) > 0 && pool.level <= room);
        if (!best) break;
        left.set(best.key, left.get(best.key)! - 1);
        given.set(best.key, (given.get(best.key) ?? 0) + 1);
        room -= best.level;
      }
      const picks = [...given].map(([pool, count]) => ({ pool, count }));
      if (picks.length === 0) continue;
      // Offered only when its use would be taken: a use left on its counter, the levels in reach.
      const tried = applyRulesetRestRecoveries(definition, build, stored, catalogs, restId, [
        { name: entry.label, recover: picks },
      ]);
      if (!tried.ok) continue;
      offers.push({
        name: entry.label,
        upTo,
        ...(recovers.most !== undefined ? { most: recovers.most } : {}),
        ...(recovers.count !== undefined ? { count: recovers.count } : {}),
        pools,
        picks,
      });
    }
  }
  return offers;
}

/** The features a player chose to use as a rest ends (1.789), each a `use` with what it gives back,
 *  all or nothing: one this rest does not offer, or a use that is refused, refuses them all. */
export function applyRulesetRestRecoveries(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  catalogs: RulesetCatalogEntriesById,
  restId: string,
  chosen: ReadonlyArray<{ name: string; recover: RulesetUseRecover[] }>,
  roll?: (sides: number) => number,
  items?: ReadonlyArray<RulesetSheetItem>,
): { ok: true; live: unknown; now: string[] } | { ok: false; reason: RulesetSheetRefusal } {
  let state = stored;
  const now: string[] = [];
  for (const one of chosen) {
    const found = rulesetEntryNamed(definition, build, catalogs, one.name);
    if (!found.ok) return found;
    if (found.entry.mechanics?.recovers?.atRest !== restId) return { ok: false, reason: "unknown-entry" };
    const plan = planRulesetUse(definition, build, state, catalogs, {
      op: "use",
      name: one.name,
      recover: one.recover,
    });
    if (!plan.ok) return plan;
    const paid: string[] = [];
    for (const step of plan.steps) {
      const result = applyRulesetSheetOp(definition, build, state, step.op, roll, items);
      if (!result.ok) return result;
      state = result.live;
      paid.push(`${step.label} ${result.now}`);
    }
    now.push(`${plan.label}: ${paid.join(", ")}`);
  }
  return { ok: true, live: state, now };
}

type RestDiceList = NonNullable<RulesetDefinition["rests"][number]["dice"]>;
type RestDice = Extract<RestDiceList, { pool: string }>;

/** A rest's dice as a list (1.337), one entry a pool. */
export function rulesetRestDiceEntries(dice: RestDiceList | undefined): RestDice[] {
  return dice === undefined ? [] : Array.isArray(dice) ? dice : [dice];
}

/** A die's sides read off the sheet (1.335): a number, or an enum field's value written "d8". */
export function rulesetRestDieSides(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RestDice["die"],
  evaluated = evaluateRulesetSheet(definition, build),
): number {
  if (ref.field !== undefined) {
    const written = build.fields?.[ref.field];
    const match = typeof written === "string" ? /^\s*d(\d+)\s*$/i.exec(written) : null;
    if (match) return Math.min(100, Number(match[1]));
  }
  const value = resolveRulesetValueRef(definition, build, ref, evaluated);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.trunc(value))) : 0;
}

/** The extra die a sheet gives a rest's dice (1.335), Song of Rest: its sides and what is added to it;
 *  null where it gives none. */
export function rulesetRestExtraDie(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  restId: string,
  /** What the character carries, for an `itemStat` in it (1.337): Pell's Teapot. */
  items?: ReadonlyArray<RulesetSheetItem>,
  stored?: unknown,
): { sides: number; add: number } | null {
  const extra = rulesetRestDiceEntries(definition.rests.find((rest) => rest.id === restId)?.dice).find(
    (entry) => entry.extra,
  )?.extra;
  if (!extra) return null;
  const evaluated = evaluateRulesetSheetLive(definition, build, stored, items);
  const sides = rulesetRestDieSides(definition, build, extra.die, evaluated);
  if (sides < 1) return null;
  const add = extra.add ? resolveRulesetValueRef(definition, build, extra.add, evaluated) : 0;
  return { sides, add: Number.isFinite(add) ? Math.trunc(add) : 0 };
}

/** Spend `count` of a rest's dice to heal (1.335): each die rolled plus `add`, never below 0, and the
 *  extra die once, all given back to `heals` as a heal that is not magical. Without a roller each die
 *  counts its average, rounded down. Over several pools (1.337) they come from `pool` when it is
 *  named, else from the first listed pool that has any, then the next. */
function rulesetSpendRestDice(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  restId: string,
  dice: RestDiceList,
  count: number,
  pool: string | undefined,
  given: { sides: number; add: number } | undefined,
  roll: ((sides: number) => number) | undefined,
  items: ReadonlyArray<RulesetSheetItem> | undefined,
): RulesetSheetOpResult {
  const evaluated = evaluateRulesetSheetLive(definition, build, stored, items);
  const pools = readRulesetLive(definition, build, stored, items).pools;
  const listed = rulesetRestDiceEntries(dice);
  // The pool asked for by its key, or by its name or loosely where one listed pool alone fits.
  const asked =
    pool === undefined
      ? undefined
      : (listed.find((entry) => sameName(entry.pool, pool))?.pool ??
        poolNamed(
          pools.filter((one) => listed.some((entry) => entry.pool === one.key)),
          pool,
        )?.key);
  const entries = listed.filter((entry) => pool === undefined || entry.pool === asked);
  if (entries.length === 0) return { ok: false, reason: "bad-pool" };
  // How many each pool gives, in order, before anything is spent: too few in all is refused whole.
  const plan: Array<{ entry: RestDice; count: number }> = [];
  let left = count;
  for (const entry of entries) {
    if (left === 0) break;
    const has = Math.max(0, Math.trunc(pools.find((one) => one.key === entry.pool)?.value ?? 0));
    const taken = Math.min(has, left);
    if (taken > 0) plan.push({ entry, count: taken });
    left -= taken;
  }
  // What each healed pool lacks of its maximum: dice spent only while there is some, and no more of
  // them than it takes to fill it (cheap-GM playtest 2026-10-26: a party short rest with two dice
  // spent them on characters already at full health).
  const lacking = new Map<string, number>();
  for (const entry of entries) {
    const healed = pools.find((one) => !one.listId && one.key === entry.heals);
    if (healed && !lacking.has(entry.heals))
      lacking.set(entry.heals, Math.max(0, healed.max - healed.sealed - healed.value));
  }
  const full = (heals: string) => lacking.get(heals) === 0;
  if (entries.every((entry) => full(entry.heals))) {
    const labels = [...new Set(entries.map((entry) => entry.heals))].map(
      (key) => pools.find((one) => !one.listId && one.key === key)?.label ?? key,
    );
    return {
      ok: true,
      live: readStoredLiveState(definition, build, stored),
      now: `none spent: ${labels.join(", ")} already full`,
    };
  }
  if (left > 0) return { ok: false, reason: "insufficient" };
  const throwOne = (faces: number) => (roll ? Math.max(1, Math.min(faces, Math.trunc(roll(faces)))) : null);
  let live: unknown = stored;
  let last: RulesetSheetOpResult | null = null;
  const healing = new Map<string, number>();
  const rolls: Array<number | null> = [];
  let spentCount = 0;
  for (const step of plan) {
    const sides = rulesetRestDieSides(definition, build, step.entry.die, evaluated);
    if (sides < 1) return { ok: false, reason: "malformed" };
    const addRead = step.entry.add ? resolveRulesetValueRef(definition, build, step.entry.add, evaluated) : 0;
    const add = Number.isFinite(addRead) ? Math.trunc(addRead) : 0;
    // Each die's healing made more (1.688): a Periapt of Wound Closure doubles it.
    const timesRead = step.entry.times ? resolveRulesetValueRef(definition, build, step.entry.times, evaluated) : 1;
    const times = Number.isFinite(timesRead) ? Math.max(1, timesRead) : 1;
    // One die at a time, until the pool it heals is full.
    const thrown: Array<number | null> = [];
    let gained = 0;
    while (thrown.length < step.count && (lacking.get(step.entry.heals) ?? Infinity) > gained) {
      const rolled = throwOne(sides);
      thrown.push(rolled);
      gained += Math.max(0, (rolled ?? (sides + 1) / 2) + add) * times;
    }
    if (thrown.length === 0) continue;
    const lacked = lacking.get(step.entry.heals);
    if (lacked !== undefined) lacking.set(step.entry.heals, Math.max(0, lacked - gained));
    const spent = applyRulesetSheetOp(
      definition,
      build,
      live,
      { op: "spend", pool: step.entry.pool, amount: thrown.length },
      roll,
      items,
    );
    if (!spent.ok) return spent;
    live = spent.live;
    last = spent;
    spentCount += thrown.length;
    rolls.push(...thrown);
    healing.set(step.entry.heals, (healing.get(step.entry.heals) ?? 0) + gained);
  }
  // The extra die once, whatever pools paid (Song of Rest), onto what the first of them heals.
  const extra = given ?? rulesetRestExtraDie(definition, build, restId, items, stored);
  let extraSaid = "";
  if (extra && extra.sides >= 1) {
    const rolled = throwOne(extra.sides);
    const gained = Math.max(0, Math.floor((rolled ?? (extra.sides + 1) / 2) + extra.add));
    const heals = plan[0]!.entry.heals;
    healing.set(heals, (healing.get(heals) ?? 0) + gained);
    extraSaid = ` +${gained}`;
  }
  const said = rolls.every((one) => one !== null) ? ` (${rolls.join(", ")})` : "";
  const counted = spentCount < count ? `${spentCount} of ${count} spent${said}, full after` : `${count} spent${said}`;
  const healed: string[] = [];
  for (const [heals, amount] of healing) {
    const total = Math.floor(amount);
    if (total === 0) continue;
    const restored = applyRulesetSheetOp(
      definition,
      build,
      live,
      { op: "restore", pool: heals, amount: total },
      roll,
      items,
    );
    // A condition that keeps them from healing (Mummy Rot) costs the dice and heals nothing, and the
    // rest goes on, as a rest's own healing does.
    if (!restored.ok && restored.reason === "cannot-heal") {
      const by = healKeptOffBy(definition, readStoredLiveState(definition, build, live).conditions ?? [], false);
      healed.push(`${by ?? "a condition"} keeps it from healing`);
      continue;
    }
    if (!restored.ok) return restored;
    live = restored.live;
    last = restored;
    healed.push(restored.now);
  }
  if (healed.length === 0) return { ...last!, now: `${counted}, no healing` };
  return { ...last!, now: `${counted}${extraSaid}: ${healed.join("; ")}` };
}
