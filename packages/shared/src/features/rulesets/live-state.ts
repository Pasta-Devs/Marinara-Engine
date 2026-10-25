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
  rulesetSheetBuildSchema,
  storedRulesetSheetsSchema,
  RULESET_WOUND_EXTRA_PER_ROW,
  RULESET_WOUND_LEVELS_MAX,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetList,
  type RulesetLiveTrack,
  type RulesetSheetBuild,
  type RulesetTrackKind,
  type RulesetTrackLevel,
} from "../../schemas/ruleset.schema.js";
import { rulesetCatalogEntriesByRef } from "./scaled-rows.js";
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
  type RulesetSheetItem,
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
  /** Whom an entry used once a creature until a rest went to (1.304), by name, keyed `rest|action`:
   *  that rest clears its lists. */
  usedOn?: Record<string, string[]>;
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
  return z.record(values).superRefine((record, ctx) => {
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
    usedOn: boundedRecord(liveUsedOnNames, MAX_LIVE_USED_ON, "used-on lists").optional(),
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
export function listRulesetLivePools(definition: RulesetDefinition, build: RulesetSheetBuild): RulesetLivePoolSpec[] {
  const evaluated = evaluateRulesetSheet(definition, build);
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
    const { nameColumn, maxColumn, rechargeColumn } = list.pools;
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
      pools.push({
        key,
        label: name,
        max: Math.min(MAX_LIVE_NUMBER, max),
        allowTemp: false,
        start: "full",
        listId: list.id,
        ...(typeof recharge === "string" && recharge ? { recharge } : {}),
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
  const usedOn = keepValid(source.usedOn, liveUsedOnNames, MAX_LIVE_USED_ON);
  if (usedOn) state.usedOn = usedOn;
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
  if (state.usedOn && Object.keys(state.usedOn).length > 0) normalized.usedOn = state.usedOn;
  return normalized;
}

function resolveLive(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetLiveState,
): ResolvedRulesetLive {
  const active = new Set(state.conditions ?? []);
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
    pools: listRulesetLivePools(definition, build).map((spec) => {
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
  };
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
): ResolvedRulesetLive {
  return resolveLive(definition, build, readStoredLiveState(definition, build, stored));
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
): ReturnType<typeof evaluateRulesetSheet> {
  return evaluateRulesetSheet(definition, build, {
    ...readRulesetLive(definition, build, stored),
    ...(items ? { items } : {}),
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
  /** Sets a live state to one of its values, named by the value or its label. */
  | { op: "state"; state: string; value: string }
  | { op: "note"; field: string; value: string }
  /** `dice` (1.335): spend that many of the rest's dice to heal first, as its `dice` says. `extra` is the
   *  party's best extra die for it (Song of Rest), worked out where the party is known; without it, the
   *  sheet's own. */
  | { op: "rest"; rest: string; dice?: number; pool?: string; extra?: { sides: number; add: number } }
  /** Uses something the character picked from a catalog, paying everything it costs. Resolved by
   *  `planRulesetUse` before it reaches `applyRulesetSheetOp`, because it needs the catalogs. */
  | { op: "use"; name: string; pool?: string };

export type RulesetSheetRefusal =
  | "unknown-pool"
  | "ambiguous-pool"
  | "insufficient"
  | "bad-amount"
  | `bad-amount: ${string}`
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
  "advance",
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
    (!!pool.label && (loose(pool.label) === looseWanted || initials(pool.label) === looseWanted))
  );
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
      if (!Number.isFinite(value) || value < entry.min || value > entry.max || (integer && !Number.isInteger(value))) {
        return { ok: false, reason: `bad-amount: ${integer ? "integer " : ""}${entry.min} to ${entry.max}` };
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
  // `use` is turned into plain spends by `planRulesetUse` before it gets here: it needs the
  // ruleset's catalogs, which this function deliberately does not take.
  if (op.op === "use") return { ok: false, reason: "malformed" };
  if (op.op === "advance") return advanceBuild(definition, build, stored, op);
  const next = readStoredLiveState(definition, build, stored);
  const resolved = resolveLive(definition, build, next);

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
    const sealed = op.seals ? Math.min(pool.max, pool.sealed + (pool.value - value)) : pool.sealed;
    const lasting = op.seals && op.lasting ? Math.min(sealed, pool.lasting + (pool.value - value)) : pool.lasting;
    setPool(pool, value, temp, sealed, lasting);
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
    return done(`${condition.label} ${op.active ? "on" : "off"}${restored}`);
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

  if (op.op === "note") {
    const field = resolved.text.find((entry) => sameName(entry.id, op.field) || sameName(entry.label, op.field));
    if (!field) return { ok: false, reason: "unknown-field" };
    const value = typeof op.value === "string" ? op.value.slice(0, field.maxLength) : "";
    setText(field.id, value);
    return done(value ? `${field.label}: ${value}` : `${field.label} cleared`);
  }

  // Every other command was answered above, so what is left is a rest. Said rather than fallen
  // into, because `damage` now has two shapes and only one of them reaches this far.
  if (op.op !== "rest") return { ok: false, reason: "malformed" };
  const rest = definition.rests.find((entry) => sameName(entry.id, op.rest) || sameName(entry.label, op.rest));
  if (!rest) return { ok: false, reason: "unknown-rest" };
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

  // A rest does exactly what the definition says and nothing else — no implied healing, and no
  // temporary buffers dropped, because no ruleset asked for that here.
  const values = new Map(resolved.pools.map((pool) => [pool.key, { pool, value: pool.value, temp: pool.temp }]));
  const trackValues = new Map(resolved.tracks.map((track) => [track.id, { track, value: track.value }]));
  const changes: string[] = [];

  const restHealthRule = definition.combat?.health;
  const restHealth = restHealthRule && "pool" in restHealthRule ? restHealthRule.pool : undefined;
  for (const step of rest.restore) {
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
): { ok: true; ref: string; entry: RulesetCatalogEntry } | { ok: false; reason: RulesetSheetRefusal } {
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const matched = new Set<string>();
  for (const list of definition.sheet.lists) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const nameColumn = listNameColumn(definition, list);
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const cells = row as Record<string, unknown>;
      const ref = own(cells, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string") continue;
      const name = nameColumn ? own(cells, nameColumn) : undefined;
      const label = byRef.get(ref)?.label;
      if ((typeof name === "string" && sameName(name, wanted)) || (label && sameName(label, wanted))) {
        matched.add(ref);
      }
    }
  }
  if (matched.size === 0) return { ok: false, reason: "unknown-entry" };
  if (matched.size > 1) return { ok: false, reason: "ambiguous-entry" };
  const ref = [...matched][0]!;
  const entry = byRef.get(ref);
  if (!entry) return { ok: false, reason: "unknown-entry" };
  return { ok: true, ref, entry };
}

export type RulesetUsePlan =
  { ok: true; label: string; steps: RulesetUseStep[] } | { ok: false; reason: RulesetSheetRefusal };

/** The column a Game Master sees a row of this list under: what the sheet block prints it as, then
 *  the name a row pool is keyed by, then the first text column the list has. */
function listNameColumn(definition: RulesetDefinition, list: RulesetList): string | undefined {
  return (
    definition.gm.sheetSummary.lists.find((entry) => entry.list === list.id)?.nameColumn ??
    list.pools?.nameColumn ??
    list.columns.find((column) => column.type === "text")?.id
  );
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
  const terms = borrowed ? borrowed.cost : (entry.mechanics?.cost ?? []);
  let costs: Array<{ pool: string; amount: number }> = [...terms];
  if (op.pool !== undefined) {
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
  for (const list of definition.sheet.lists) {
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
  return { ok: true, label: entry.label, steps };
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
  const pools = readRulesetLive(definition, build, stored).pools;
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
  if (left > 0) return { ok: false, reason: "insufficient" };
  const throwOne = (faces: number) => (roll ? Math.max(1, Math.min(faces, Math.trunc(roll(faces)))) : null);
  let live: unknown = stored;
  let last: RulesetSheetOpResult | null = null;
  const healing = new Map<string, number>();
  const rolls: Array<number | null> = [];
  for (const step of plan) {
    const sides = rulesetRestDieSides(definition, build, step.entry.die, evaluated);
    if (sides < 1) return { ok: false, reason: "malformed" };
    const addRead = step.entry.add ? resolveRulesetValueRef(definition, build, step.entry.add, evaluated) : 0;
    const add = Number.isFinite(addRead) ? Math.trunc(addRead) : 0;
    const spent = applyRulesetSheetOp(definition, build, live, {
      op: "spend",
      pool: step.entry.pool,
      amount: step.count,
    });
    if (!spent.ok) return spent;
    live = spent.live;
    last = spent;
    const thrown = Array.from({ length: step.count }, () => throwOne(sides));
    rolls.push(...thrown);
    const each = thrown.map((rolled) => Math.max(0, (rolled ?? (sides + 1) / 2) + add));
    healing.set(step.entry.heals, (healing.get(step.entry.heals) ?? 0) + each.reduce((sum, one) => sum + one, 0));
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
  const healed: string[] = [];
  for (const [heals, amount] of healing) {
    const total = Math.floor(amount);
    if (total === 0) continue;
    const restored = applyRulesetSheetOp(definition, build, live, { op: "restore", pool: heals, amount: total });
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
  if (healed.length === 0) return { ...last!, now: `${count} spent${said}, no healing` };
  return { ...last!, now: `${count} spent${said}${extraSaid}: ${healed.join("; ")}` };
}
