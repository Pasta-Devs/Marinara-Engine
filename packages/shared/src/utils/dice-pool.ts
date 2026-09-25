// ──────────────────────────────────────────────
// Game: the sighted dice pool — the primitive
//
// The blind forms (the branch block and the placeholder) need no pool at all: the
// engine rolls at parse time, after the model has committed the sentence, so there
// is nothing to pre-throw. The pool exists for the one case neither blind form can
// serve — a number that itself has to pick between three or more different endings —
// and the only way to put a value in front of the model before it writes is to have
// thrown it already. That is the whole reason this module exists and the whole source
// of its integrity loss, which is why the sub-option ships off.
//
// What lives here is the arithmetic half, with no chat, no database and no prompt in
// it: the sizes, the allotment, the queue, the refill, the aging clock and the slot
// names. Everything that needs a chat lives in the server's pool service beside it.
//
// The queue is what makes the model's freedoms bounded rather than a matter of trust:
// it cannot get a value out of order, it cannot reuse one, and it cannot see past the
// window, because none of those is a rule the prompt asks it to follow — they are
// facts about a queue the engine holds.
// ──────────────────────────────────────────────

import type { GameDicePool, GameDicePoolSize, GameDicePoolSlotName, GameDicePoolView } from "../types/game.js";

/**
 * The seven sizes the product already treats as standard, in the order the prompt
 * lists them: biggest first, because a GM scanning the block wants the d20 first, and
 * the d100 last because it is the odd one out in both allotment and use.
 *
 * Anything outside this set is an overflow case, not a pool miss. The NdM grammar
 * allows up to 100 dice of up to 1000 sides and pre-loading that space is not possible.
 */
export const GAME_DICE_POOL_SIZES: readonly GameDicePoolSize[] = ["d20", "d12", "d10", "d8", "d6", "d4", "d100"];

/**
 * How many values of each size the engine holds. Six for d4 through d20, two for d100.
 *
 * Reasoned from what a turn actually spends: one `[dice:]` tag can consume several
 * values of one size (`3d8+2` is one tag and three d8 values), advantage needs two d20
 * values for one check, and the guide frames checks as rare. The allotment governs only
 * how many BLIND spends a turn can absorb before overflowing; the window is what governs
 * how much the model sees, and that is a different number.
 */
export const GAME_DICE_POOL_ALLOTMENT: Readonly<Record<GameDicePoolSize, number>> = {
  d4: 6,
  d6: 6,
  d8: 6,
  d10: 6,
  d12: 6,
  d20: 6,
  d100: 2,
};

/**
 * How many values per size the model is shown. **One**, and this is the single largest
 * mitigation in the whole design: at 1 the exposed surface is seven values rather than
 * thirty-eight, and every second spend of a size in a turn is blind.
 */
export const DEFAULT_GAME_DICE_POOL_WINDOW = 1;

/**
 * How many accepted turns a size may go unspent before it is rethrown. Without it the
 * head is a LATCH, not a per-turn choice: once a 2 parks at the head of the d20 queue, a
 * model that prefers successes can refuse d20 checks forever and the 2 never ages out.
 * Three bounds that latch. Zero turns aging off.
 */
export const DEFAULT_GAME_DICE_POOL_AGE_TURNS = 3;

/** The widest window worth offering: showing the whole allotment is showing everything. */
export const MAX_GAME_DICE_POOL_WINDOW = 6;
/** The longest idle clock worth offering. Past this the latch is effectively unbounded. */
export const MAX_GAME_DICE_POOL_AGE_TURNS = 20;

/** The current on-disk revision of a serialized pool. */
export const GAME_DICE_POOL_VERSION = 1;

/** Faces per size, so a size never has to be re-parsed out of its own name. */
export function gameDicePoolSizeFaces(size: GameDicePoolSize): number {
  return Number.parseInt(size.slice(1), 10);
}

/** The pooled size for a die with this many faces, or null when the size is not pooled. */
export function gameDicePoolSizeForFaces(sides: number): GameDicePoolSize | null {
  const candidate = `d${sides}` as GameDicePoolSize;
  return GAME_DICE_POOL_SIZES.includes(candidate) ? candidate : null;
}

/** A source of fresh values. Production passes the crypto roller; a lane passes its own. */
export type GameDicePoolRoller = (sides: number) => number;

/** Throw a full allotment of every size. */
export function createGameDicePool(roll: GameDicePoolRoller, turn = 0): GameDicePool {
  const values = {} as Record<GameDicePoolSize, number[]>;
  const idle = {} as Record<GameDicePoolSize, number>;
  for (const size of GAME_DICE_POOL_SIZES) {
    values[size] = throwValues(roll, size, GAME_DICE_POOL_ALLOTMENT[size]);
    idle[size] = 0;
  }
  return { v: GAME_DICE_POOL_VERSION, turn, values, idle };
}

function throwValues(roll: GameDicePoolRoller, size: GameDicePoolSize, count: number): number[] {
  const faces = gameDicePoolSizeFaces(size);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) values.push(clampToFaces(roll(faces), faces));
  return values;
}

/**
 * A roller that answers out of range would put a number in the prompt that the die it
 * names cannot show, and the model would then narrate it as fact. Clamping is the only
 * answer that neither invents a value nor fails the turn.
 */
function clampToFaces(value: number, faces: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(faces, Math.max(1, Math.floor(value)));
}

/** JSON for the row's `pool` column. Compact on purpose: one row per (message, swipe). */
export function serializeGameDicePool(pool: GameDicePool): string {
  return JSON.stringify(pool);
}

/**
 * Read a pool back, or null when the text is not one.
 *
 * Strict about shape and lenient about nothing: a half-read pool would spend values a
 * prompt never showed, which is the one failure the queue exists to make impossible. A
 * null here means the caller throws a fresh allotment and says so in the log, which
 * costs the turn its continuity and nothing else.
 */
export function parseGameDicePool(raw: string | null | undefined): GameDicePool | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const candidate = parsed as { v?: unknown; turn?: unknown; values?: unknown; idle?: unknown };
  if (candidate.v !== GAME_DICE_POOL_VERSION) return null;
  if (!candidate.values || typeof candidate.values !== "object" || Array.isArray(candidate.values)) return null;

  const rawValues = candidate.values as Record<string, unknown>;
  const rawIdle =
    candidate.idle && typeof candidate.idle === "object" && !Array.isArray(candidate.idle)
      ? (candidate.idle as Record<string, unknown>)
      : {};
  const values = {} as Record<GameDicePoolSize, number[]>;
  const idle = {} as Record<GameDicePoolSize, number>;
  for (const size of GAME_DICE_POOL_SIZES) {
    const list = rawValues[size];
    if (!Array.isArray(list)) return null;
    // A short queue is one a previous turn overspent and is legitimate; a queue past its
    // allotment was never written by this code, and accepting it would let a hand-edited
    // row hand out more values than the allotment allows.
    if (list.length > GAME_DICE_POOL_ALLOTMENT[size]) return null;
    const faces = gameDicePoolSizeFaces(size);
    const cleaned: number[] = [];
    for (const entry of list) {
      if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 1 || entry > faces) return null;
      cleaned.push(entry);
    }
    values[size] = cleaned;
    const idleValue = rawIdle[size];
    idle[size] = typeof idleValue === "number" && Number.isInteger(idleValue) && idleValue >= 0 ? idleValue : 0;
  }
  const turn =
    typeof candidate.turn === "number" && Number.isInteger(candidate.turn) && candidate.turn >= 0 ? candidate.turn : 0;
  return { v: GAME_DICE_POOL_VERSION, turn, values, idle };
}

/**
 * The head values the prompt shows, one per size at the default window.
 *
 * A size whose queue is empty renders nothing rather than a zero: there is no value, and
 * writing one would be inventing it.
 */
export function renderGameDicePoolView(pool: GameDicePool, window: number): GameDicePoolView {
  const bounded = Math.max(1, Math.min(MAX_GAME_DICE_POOL_WINDOW, Math.floor(window) || 1));
  return GAME_DICE_POOL_SIZES.map((size) => ({ size, values: pool.values[size].slice(0, bounded) })).filter(
    (entry) => entry.values.length > 0,
  );
}

/**
 * The next unspent value of a size, given how many of that size this turn already spent.
 *
 * Returns null on overflow — the allotment is exhausted, or the size was never pooled.
 * No value exists, so nothing is written: the engine cannot invent one and, by the
 * one-request guarantee, must not send a second request to get one.
 */
export function consumeFromPool(
  pool: GameDicePool,
  size: GameDicePoolSize,
  alreadySpent: number,
): { value: number; slot: number } | null {
  const queue = pool.values[size];
  if (!queue || alreadySpent < 0 || alreadySpent >= queue.length) return null;
  const value = queue[alreadySpent];
  if (typeof value !== "number") return null;
  return { value, slot: alreadySpent };
}

/**
 * Refill after an accepted turn: shift every consumed slot off the head, push one fresh
 * value of the same size at the tail, and advance the aging clock for every size this
 * turn did not touch.
 *
 * Refill happens ONCE per accepted turn, which is what closes reroll-until-lucky: a
 * swipe, a regenerate and a continuation all re-read the same pool rather than a refilled
 * one, so an alternative telling of one turn faces the same luck.
 *
 * Aging is the bound on the frozen head. A size that goes `ageTurns` accepted turns with
 * no spend is rethrown whole and its clock reset; the caller logs which sizes aged out.
 */
export function refillPool(
  pool: GameDicePool,
  spentBySize: Partial<Record<GameDicePoolSize, number>>,
  roll: GameDicePoolRoller,
  ageTurns: number = DEFAULT_GAME_DICE_POOL_AGE_TURNS,
): { pool: GameDicePool; aged: GameDicePoolSize[] } {
  const values = {} as Record<GameDicePoolSize, number[]>;
  const idle = {} as Record<GameDicePoolSize, number>;
  const aged: GameDicePoolSize[] = [];
  const bounded = Number.isFinite(ageTurns) && ageTurns > 0 ? Math.floor(ageTurns) : 0;

  for (const size of GAME_DICE_POOL_SIZES) {
    const allotment = GAME_DICE_POOL_ALLOTMENT[size];
    const spent = Math.max(0, Math.min(allotment, Math.floor(spentBySize[size] ?? 0)));
    if (spent > 0) {
      const kept = pool.values[size].slice(spent);
      values[size] = [...kept, ...throwValues(roll, size, allotment - kept.length)];
      idle[size] = 0;
      continue;
    }
    const nextIdle = (pool.idle[size] ?? 0) + 1;
    if (bounded > 0 && nextIdle >= bounded) {
      values[size] = throwValues(roll, size, allotment);
      idle[size] = 0;
      aged.push(size);
      continue;
    }
    // Untouched: the queue keeps its positions exactly, short queue included. A size
    // that is short is one whose allotment a previous turn overspent; topping it up here
    // would hand the model a value the aging clock has not yet earned.
    values[size] = [...pool.values[size]];
    idle[size] = nextIdle;
  }
  return { pool: { v: GAME_DICE_POOL_VERSION, turn: pool.turn + 1, values, idle }, aged };
}

/** `pool="d20:1"`, or `pool="d6:1|2|3"` for a tag that spends several of one size. 1-based. */
export function formatPoolSlotName(size: GameDicePoolSize, slots: readonly number[]): string {
  return `${size}:${slots.map((slot) => slot + 1).join("|")}`;
}

/**
 * Read a `pool=` value the model wrote.
 *
 * Read as a CHECKSUM, never as an instruction: what comes back is compared against what
 * the engine spent and recorded as a mismatch when they disagree. Nothing here can make
 * the engine spend a different value, which is why a hostile or nonsense slot name costs
 * the turn a log line rather than a roll.
 */
export function parsePoolSlotName(raw: string | null | undefined): GameDicePoolSlotName | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0) return null;
  const size = trimmed.slice(0, separator).trim().toLowerCase() as GameDicePoolSize;
  if (!GAME_DICE_POOL_SIZES.includes(size)) return null;
  const slots: number[] = [];
  for (const part of trimmed.slice(separator + 1).split(/[|,]/)) {
    const entry = part.trim();
    if (!/^\d+$/.test(entry)) return null;
    const slot = Number.parseInt(entry, 10);
    if (slot < 1 || slot > GAME_DICE_POOL_ALLOTMENT[size]) return null;
    slots.push(slot - 1);
  }
  return slots.length > 0 ? { size, slots } : null;
}
