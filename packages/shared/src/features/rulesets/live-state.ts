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
  RULESET_CATALOG_ROW_KEY,
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
import {
  evaluateRulesetSheet,
  isRulesetItemHidden,
  lookupStepTable,
  resolveRulesetValueRef,
  roundRulesetNumber,
} from "./sheet-math.js";

export interface RulesetLivePoolValue {
  value: number;
  temp?: number;
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
}

/** Live state of every card in one game, keyed by normalizeCharacterLookupName(card name). */
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
const MAX_LIVE_CONDITIONS = 80;
const MAX_LIVE_CONDITION_LENGTH = 80;
const MAX_LIVE_STATES = 30;
const MAX_LIVE_STATE_VALUE_LENGTH = 80;
/** Every stored number is an integer in this range, so no arithmetic here can reach an unsafe one. */
const MAX_LIVE_NUMBER = 1_000_000;
/** What one command may move at once. A bigger number is a typo or a model inventing damage. */
const MAX_OP_AMOUNT = 100_000;

const liveNumber = z.number().int().min(-MAX_LIVE_NUMBER).max(MAX_LIVE_NUMBER);

export const rulesetLivePoolValueSchema = z.object({ value: liveNumber, temp: liveNumber.min(0).optional() }).strict();

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
    text: boundedRecord(z.string().max(MAX_LIVE_TEXT_LENGTH), MAX_LIVE_TEXTS, "text fields").optional(),
    conditions: z.array(z.string().max(MAX_LIVE_CONDITION_LENGTH)).max(MAX_LIVE_CONDITIONS).optional(),
    states: boundedRecord(z.string().max(MAX_LIVE_STATE_VALUE_LENGTH), MAX_LIVE_STATES, "states").optional(),
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
  pools: Array<RulesetLivePoolSpec & { value: number; temp: number }>;
  tracks: Array<{ id: string; label: string; min: number; max: number; value: number; wound?: ResolvedRulesetWounds }>;
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
function readStoredLiveState(stored: unknown): RulesetLiveState {
  const source =
    stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const state: RulesetLiveState = {};
  const pools = keepValid(source.pools, rulesetLivePoolValueSchema, MAX_LIVE_POOLS);
  if (pools) state.pools = pools;
  const tracks = keepValid(source.tracks, liveNumber, MAX_LIVE_TRACKS);
  if (tracks) state.tracks = tracks;
  const wounds = keepValid(source.wounds, rulesetLiveWoundsSchema, MAX_LIVE_TRACKS);
  if (wounds) state.wounds = wounds;
  const text = keepValid(source.text, z.string().max(MAX_LIVE_TEXT_LENGTH), MAX_LIVE_TEXTS);
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
  const states = keepValid(source.states, z.string().max(MAX_LIVE_STATE_VALUE_LENGTH), MAX_LIVE_STATES);
  if (states) state.states = states;
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
      const fallback = spec.start === "full" ? spec.max : 0;
      return {
        ...spec,
        value: clamp(entry?.value ?? fallback, 0, spec.max),
        // A pool that carries no buffer can never show one, however the blob got written.
        temp: spec.allowTemp ? Math.max(0, entry?.temp ?? 0) : 0,
      };
    }),
    // A track a field takes off the sheet is not on it, exactly as a hidden pool is not.
    tracks: definition.sheet.live.tracks.flatMap((track) => {
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
      const fallback = clamp(track.default ?? track.min, track.min, max);
      return [
        {
          id: track.id,
          label: track.label,
          min: track.min,
          max,
          value: clamp(own(state.tracks, track.id) ?? fallback, track.min, max),
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
  return resolveLive(definition, build, readStoredLiveState(stored));
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
): ReturnType<typeof evaluateRulesetSheet> {
  return evaluateRulesetSheet(definition, build, readRulesetLive(definition, build, stored));
}

// ── Commands ──

export type RulesetSheetOp =
  /** The four that move one pool. One member rather than four, because `damage` also has a track
   *  shape below and two members under one name could not be told apart by the name alone. */
  | { op: "spend" | "restore" | "damage" | "temp"; pool: string; amount: number }
  /** Marks a WOUND track. `kind` is one the track declares; `amount` is a number of marks of that
   *  one kind, and a NEGATIVE amount heals, clearing marks of that kind (the lightest first when the
   *  kind is not one the track knows). `box` is where the first mark aims on an indexed track: that
   *  box, or the next free one above it. Told apart from the pool shape above by naming a track,
   *  which is what `"track" in op` reads. */
  | { op: "damage"; track: string; kind: string; amount: number; box?: number }
  | { op: "track"; track: string; to?: number; by?: number }
  | { op: "condition"; condition: string; active: boolean }
  /** Sets a live state to one of its values, named by the value or its label. */
  | { op: "state"; state: string; value: string }
  | { op: "note"; field: string; value: string }
  | { op: "rest"; rest: string }
  /** Uses something the character picked from a catalog, paying everything it costs. Resolved by
   *  `planRulesetUse` before it reaches `applyRulesetSheetOp`, because it needs the catalogs. */
  | { op: "use"; name: string; pool?: string };

export type RulesetSheetRefusal =
  | "unknown-pool"
  | "ambiguous-pool"
  | "insufficient"
  | "bad-amount"
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
  | "malformed";

export type RulesetSheetOpResult =
  { ok: true; live: RulesetLiveState; now: string } | { ok: false; reason: RulesetSheetRefusal };

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
  return { refusal: rows.length > 1 ? "ambiguous-pool" : "unknown-pool" };
}

function poolNow(pool: { max: number }, value: number, temp: number): string {
  return `${value}/${pool.max}${temp > 0 ? ` +${temp} temp` : ""}`;
}

function isAmount(amount: number, allowZero = false): boolean {
  return Number.isInteger(amount) && amount >= (allowZero ? 0 : 1) && amount <= MAX_OP_AMOUNT;
}

/** Apply one command to one character's live state. Pure: the input blob is never touched, and the
 *  result is a new sparse state. A refusal changes nothing, which is what lets the Game Master's
 *  fiction be corrected rather than silently accepted. */
export function applyRulesetSheetOp(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  stored: unknown,
  op: RulesetSheetOp,
): RulesetSheetOpResult {
  // `use` is turned into plain spends by `planRulesetUse` before it gets here: it needs the
  // ruleset's catalogs, which this function deliberately does not take.
  if (op.op === "use") return { ok: false, reason: "malformed" };
  const next = readStoredLiveState(stored);
  const resolved = resolveLive(definition, build, next);

  const setPool = (spec: RulesetLivePoolSpec, value: number, temp: number): void => {
    const pools = next.pools ?? {};
    // Back at its default, with no buffer, the entry goes away again: that is what lets an
    // untouched pool follow its maximum when a level-up raises it.
    if (value === (spec.start === "full" ? spec.max : 0) && temp === 0) delete pools[spec.key];
    else pools[spec.key] = temp > 0 ? { value, temp } : { value };
    next.pools = pools;
  };
  const setTrack = (track: ResolvedRulesetLive["tracks"][number], value: number): void => {
    const tracks = next.tracks ?? {};
    if (value === clamp(definitionTrackDefault(definition, track.id) ?? track.min, track.min, track.max)) {
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
    if (!isAmount(op.amount, op.op === "temp")) return { ok: false, reason: "bad-amount" };

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
      const value = Math.min(pool.max, pool.value + op.amount);
      setPool(pool, value, pool.temp);
      return done(poolNow(pool, value, pool.temp));
    }
    // Damage drains the temporary buffer first and then the pool, and is never refused for being
    // bigger than what is left: a killing blow is still a killing blow.
    const fromTemp = Math.min(pool.temp, op.amount);
    const temp = pool.temp - fromTemp;
    const value = Math.max(0, pool.value - (op.amount - fromTemp));
    setPool(pool, value, temp);
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
    const value = clamp(moved, track.min, track.max);
    setTrack(track, value);
    return done(`${track.label} ${value}`);
  }

  if (op.op === "condition") {
    const condition = resolved.conditions.find(
      (entry) => sameName(entry.id, op.condition) || sameName(entry.label, op.condition),
    );
    if (!condition) return { ok: false, reason: "unknown-condition" };
    const active = new Set(next.conditions ?? []);
    if (op.active) active.add(condition.id);
    else active.delete(condition.id);
    next.conditions = [...active].slice(0, MAX_LIVE_CONDITIONS);
    return done(`${condition.label} ${op.active ? "on" : "off"}`);
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

  // A rest does exactly what the definition says and nothing else — no implied healing, and no
  // temporary buffers dropped, because no ruleset asked for that here.
  const values = new Map(resolved.pools.map((pool) => [pool.key, { pool, value: pool.value, temp: pool.temp }]));
  const trackValues = new Map(resolved.tracks.map((track) => [track.id, { track, value: track.value }]));
  const changes: string[] = [];

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
    for (const target of targets) {
      const value = clamp(moved(target.value, target.pool.max, 0), 0, target.pool.max);
      if (value !== target.value) changes.push(`${target.pool.label} ${value}/${target.pool.max}`);
      target.value = value;
      setPool(target.pool, value, target.temp);
    }
  }
  for (const id of rest.clear.text) setText(id, "");
  if (rest.clear.conditions === "all") next.conditions = [];
  else if (rest.clear.conditions.length > 0) {
    const cleared = new Set<string>(rest.clear.conditions);
    next.conditions = (next.conditions ?? []).filter((id) => !cleared.has(id));
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

  const terms = entry.mechanics?.cost ?? [];
  let costs: Array<{ pool: string; amount: number }> = [...terms];
  if (op.pool !== undefined) {
    // An upcast: one price, paid out of another pool of the same family. Anything else is refused
    // rather than reinterpreted, because paying a different bill is not what was asked for.
    const named = op.pool.trim();
    const group = terms.length === 1 ? groupOf(terms[0]!.pool) : undefined;
    const target = named
      ? declared.find((pool) => sameName(pool.key, named) || sameName(pool.label, named))
      : undefined;
    if (!group || !target || target.group !== group) return { ok: false, reason: "bad-pool" };
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
  // uses is one of the entry's own rows, found by the same mark.
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
      const key = `${list.id}${LIST_POOL_SEPARATOR}${name.trim().toLowerCase()}`;
      const pool = resolved.pools.find((candidate) => candidate.key === key);
      // A counter whose maximum is 0 is not a pool at all (a scaled trick on a Heart of 0), so
      // there is nothing left to use. Saying "ok, no cost" would hand out a free use.
      if (!pool && name.trim() && !isRulesetItemHidden(list, build, definition)) {
        return { ok: false, reason: "insufficient" };
      }
      if (pool && !running.has(pool.key)) spend(pool, 1);
    }
  }
  return { ok: true, label: entry.label, steps };
}
