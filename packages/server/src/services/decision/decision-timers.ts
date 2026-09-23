/**
 * Sticky and cooldown on decision statements (#6582): `decision:"..." sticky:3 cooldown:5`.
 *
 * After a yes, a statement stays yes for `sticky` turns, then reads as no for `cooldown`
 * turns, and is not asked meanwhile, so it takes none of the turn's statement slots. A
 * turn is each new message the Decision model reads: a regeneration or swipe of the
 * same message is the same turn. Kept in chat metadata, so it survives a restart.
 */

/** A statement's held answer: the yes it keeps during sticky, or no during cooldown. */
export interface HeldDecision {
  yes: boolean;
  /** For a Choice statement held yes, the option it keeps. */
  choice?: string;
}

interface DecisionTimerEntry {
  /** The turn the statement was answered yes. */
  yesTurn: number;
  /** Held yes through this turn. */
  stickyUntil: number;
  /** Then held no through this turn. */
  cooldownUntil: number;
  choice?: string;
}

export interface DecisionTimerState {
  /** How many turns this chat has had since timers were first kept. */
  turn: number;
  /** The last turn's id (`latestTurnDecisionId`), to tell a new turn from the same one again. */
  turnId: string | null;
  statements: Record<string, DecisionTimerEntry>;
}

export const DECISION_TIMERS_METADATA_KEY = "decisionTimers";

const nonNegative = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/** The chat's stored timers, or a fresh state when there are none or they are malformed. */
export function readDecisionTimers(value: unknown): DecisionTimerState {
  const state: DecisionTimerState = { turn: 0, turnId: null, statements: {} };
  if (!value || typeof value !== "object") return state;
  const raw = value as Record<string, unknown>;
  state.turn = nonNegative(raw.turn) ?? 0;
  state.turnId = typeof raw.turnId === "string" ? raw.turnId : null;
  if (raw.statements && typeof raw.statements === "object")
    for (const [key, entry] of Object.entries(raw.statements as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const fields = entry as Record<string, unknown>;
      const yesTurn = nonNegative(fields.yesTurn);
      const stickyUntil = nonNegative(fields.stickyUntil);
      const cooldownUntil = nonNegative(fields.cooldownUntil);
      if (yesTurn === null || stickyUntil === null || cooldownUntil === null) continue;
      state.statements[key] = {
        yesTurn,
        stickyUntil,
        cooldownUntil,
        ...(typeof fields.choice === "string" ? { choice: fields.choice } : {}),
      };
    }
  return state;
}

/**
 * The turn `turnId` falls on: the stored turn again for the same message, otherwise the
 * next one, which also drops timers that have run out. Mutates `state`.
 */
export function decisionTurnFor(state: DecisionTimerState, turnId: string | null): number {
  if (turnId && turnId !== state.turnId) {
    state.turn += 1;
    state.turnId = turnId;
    for (const [key, entry] of Object.entries(state.statements))
      if (state.turn > entry.cooldownUntil) delete state.statements[key];
  }
  return state.turn;
}

const timerKey = (kind: "noul" | "choice", key: string) => `${kind}\u0000${key}`;

/** What timing holds a statement to on `turn`, or undefined when it is asked as usual. */
export function heldDecision(
  state: DecisionTimerState,
  turn: number,
  kind: "noul" | "choice",
  key: string,
): HeldDecision | undefined {
  const entry = state.statements[timerKey(kind, key)];
  // The yes turn itself reads the answer it was given, so a regeneration matches it.
  if (!entry || turn <= entry.yesTurn) return undefined;
  if (turn <= entry.stickyUntil) return { yes: true, ...(entry.choice !== undefined ? { choice: entry.choice } : {}) };
  if (turn <= entry.cooldownUntil) return { yes: false };
  return undefined;
}

/** Start a statement's timers from a fresh yes (or a chosen option) on `turn`. */
export function recordDecisionTimer(
  state: DecisionTimerState,
  turn: number,
  decision: { kind: "noul" | "choice"; key: string; sticky?: number; cooldown?: number },
  answer: { yes?: boolean; choice?: string },
): void {
  const sticky = decision.sticky ?? 0;
  const cooldown = decision.cooldown ?? 0;
  if (sticky + cooldown <= 0) return;
  if (decision.kind === "noul" ? answer.yes !== true : answer.choice === undefined) return;
  state.statements[timerKey(decision.kind, decision.key)] = {
    yesTurn: turn,
    stickyUntil: turn + sticky,
    cooldownUntil: turn + sticky + cooldown,
    ...(decision.kind === "choice" ? { choice: answer.choice } : {}),
  };
}
