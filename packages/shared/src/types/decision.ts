/**
 * The decision model that answers agent activation questions.
 *
 * Two families answer the same question. System One backends (TypeSafe, OpenRouter,
 * a user-run Open-Jev server) speak the `/v1/systemone` wire format and live as stored
 * connection rows. Local slots reuse a model the user already runs and read the answer
 * out of the first token's log-probabilities, so a user who never wants a second model
 * or a paid API can still gate their agents.
 *
 * Local slots are pseudo-connections with no stored row, following `SIDECAR_CONNECTION_ID`.
 * Which one is selected is a single app setting rather than a flag on each slot's own
 * config, because the choice is exclusive across all of them and three booleans in three
 * files would drift.
 */
import { DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD } from "../constants/agent-activation.js";
import { SIDECAR_CONNECTION_ID } from "./sidecar.js";

/** The local slots that can answer a decision. */
export const DECISION_LOCAL_SLOTS = ["primary", "utility", "decision_sidecar"] as const;
export type DecisionLocalSlot = (typeof DECISION_LOCAL_SLOTS)[number];

/**
 * Reserved ids for the local entries, in the style of `SIDECAR_CONNECTION_ID`.
 * Never stored in the connections table; the decision default holds one of these
 * strings or names a real connection row.
 */
export const DECISION_SIDECAR_CONNECTION_ID = "decision-sidecar:local";
export const UTILITY_SIDECAR_DECISION_CONNECTION_ID = "utility-sidecar:decision";

export const DECISION_LOCAL_SLOT_IDS: Record<DecisionLocalSlot, string> = {
  primary: SIDECAR_CONNECTION_ID,
  utility: UTILITY_SIDECAR_DECISION_CONNECTION_ID,
  decision_sidecar: DECISION_SIDECAR_CONNECTION_ID,
};

export function decisionLocalSlotForId(id: string | null | undefined): DecisionLocalSlot | null {
  if (!id) return null;
  const match = DECISION_LOCAL_SLOTS.find((slot) => DECISION_LOCAL_SLOT_IDS[slot] === id);
  return match ?? null;
}

/**
 * How a local chat model is allowed to reach its yes/no answer.
 *
 * Some models ignore a reasoning-off flag, or open a reasoning block from their chat
 * template regardless. The backend never assumes the flag worked; it checks what came
 * back and, in Auto, switches that model over once it has failed twice.
 */
export const DECISION_THINKING_MODES = ["auto", "off", "allowed"] as const;
export type DecisionThinkingMode = (typeof DECISION_THINKING_MODES)[number];
export const DEFAULT_DECISION_THINKING_MODE: DecisionThinkingMode = "auto";

/**
 * Read a Thinking mode from a slot's config file.
 *
 * Both slots persist their settings as JSON on disk, so an older install has no value
 * here and a hand-edited one may have any string. An unrecognised value would match
 * neither branch in the backend and silently behave as Off, which is a setting nobody
 * chose; it becomes the default instead.
 */
export function normalizeDecisionThinking(value: unknown): DecisionThinkingMode {
  return DECISION_THINKING_MODES.includes(value as DecisionThinkingMode)
    ? (value as DecisionThinkingMode)
    : DEFAULT_DECISION_THINKING_MODE;
}

/**
 * How a decision backend wants its question worded on the wire.
 *
 * System One accepts text, an object or an array for `instructions`. Which one a model
 * answers best is a property of its training, not a style choice: Open-Jev's own
 * shipped fixtures use task objects (`{"task": ..., "hazard": ...}`) and never plain
 * sentences, and it answers a wrapped question far more confidently than the same
 * sentence sent bare. Measured on 2026-09-22 over eight roleplay turns: the gap
 * between the least certain "yes" and the most certain "no" went from 3.8x to 10.9x
 * just by wrapping.
 */
export const DECISION_QUESTION_SHAPES = ["text", "task_object"] as const;
export type DecisionQuestionShape = (typeof DECISION_QUESTION_SHAPES)[number];

/** Domain hint sent with a wrapped question, so the model knows what it is reading. */
const DECISION_QUESTION_ABOUT = "the latest message of a roleplay conversation";

/** Render an agent's question for a backend that wants a particular shape. */
export function buildDecisionInstructions(question: string, shape: DecisionQuestionShape): string | object {
  return shape === "task_object" ? { task: question, about: DECISION_QUESTION_ABOUT } : question;
}

/**
 * The operating point a decision backend answers on.
 *
 * Probabilities are not comparable across models, so a threshold only means something
 * next to the model that produced it. A general chat model asked for one token answers
 * a roleplay scene question at 0.97 to 0.9997 for yes and 0.0000 to 0.0001 for no, so
 * 0.5 sits in the middle of an enormous gap. Open-Jev 2B answers the same turns at
 * 0.15 to 0.59 for yes and 0.009 to 0.026 for no: the classes separate just as
 * cleanly, around a completely different point. Leaving both on 0.5 makes the second
 * model skip every relevant turn while appearing to work.
 */
export interface DecisionCalibration {
  /** Threshold to use when an agent has not chosen one, and to seed the editor with. */
  defaultThreshold: number;
  questionShape: DecisionQuestionShape;
}

/**
 * The hosted System One backends stay on the documented default.
 *
 * TypeSafe's own Jev has not been measured here, and changing its operating point or
 * its wire shape on the strength of an independent model's numbers would be guessing.
 */
export const DEFAULT_DECISION_CALIBRATION: DecisionCalibration = {
  defaultThreshold: DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD,
  questionShape: "text",
};

/** What a slot's cached probe concluded about the model currently loaded in it. */
export type DecisionAnswerStyle = "direct" | "thinks" | "unknown";

/**
 * Request budgets, per backend family.
 *
 * System One answers every question of a group in one parallel pass, so 1500 ms is the
 * default for a Decision connection. It is not always enough: a hosted provider's
 * response time varies, so each connection can set its own limit (below). A local
 * slot may already be busy with agent work and answers one question per request, so
 * it gets longer; a model that has to reason first gets longer still, which is why
 * reasoning-mode gates are limited to post-processing by default.
 */
export const DECISION_TIMEOUT_MS = {
  systemOne: 1500,
  sidecar: 4000,
  thinking: 20_000,
} as const;

/**
 * What a Decision connection's own time limit may be set to. `systemOne` above is only
 * its default: hosted providers answer at very different speeds, and one that is
 * sometimes slower than 1.5 s looked randomly broken with no way to allow for it (#6580).
 */
export const DECISION_CONNECTION_TIMEOUT_BOUNDS_MS = { min: 500, max: 30_000 } as const;

/** A Decision connection's time limit: its own when set, otherwise the default. */
export function resolveDecisionConnectionTimeoutMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DECISION_TIMEOUT_MS.systemOne;
  const { min, max } = DECISION_CONNECTION_TIMEOUT_BOUNDS_MS;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * How long the Test button waits. Well past the default limit, so a slow answer is
 * reported with its real time instead of as the same timeout a dead endpoint gives.
 */
export const DECISION_TEST_TIMEOUT_MS = 10_000;

/** Token budget for a reasoning model to finish thinking and then answer. */
export const DECISION_THINKING_MAX_TOKENS = 1024;

/**
 * Share of the listed probability mass that `yes`/`no` variants must carry before a
 * one-token answer counts as a real answer rather than a model going its own way.
 */
export const DECISION_DIRECT_ANSWER_MIN_SHARE = 0.5;

/** Consecutive one-token failures before Auto gives a model permission to think. */
export const DECISION_AUTO_THINKING_FAILURES = 2;

/** Why an entry in the Decision model dropdown cannot serve right now. */
export type DecisionUnavailableReason =
  | "no_model"
  | "not_enabled"
  | "not_installed"
  | "unsupported_platform"
  | "needs_relinking"
  | "stopped";

/** One row of the Decision model dropdown. Unavailable entries are shown, never hidden. */
export interface DecisionModelOption {
  id: string;
  label: string;
  group: "local" | "connection";
  slot: DecisionLocalSlot | null;
  selected: boolean;
  /** Null when the entry can serve. Otherwise why it cannot, for the greyed-out reason. */
  unavailable: DecisionUnavailableReason | null;
  /** Extra detail for a reason that names something specific, e.g. a platform requirement. */
  detail?: string;
  /** For local slots: the Thinking setting and what the last probe concluded. */
  thinking?: DecisionThinkingMode;
  answerStyle?: DecisionAnswerStyle;
  /**
   * True when probabilities from this entry are not calibrated: a general chat model
   * answering yes/no, or a slot whose runtime could not return log-probabilities.
   */
  uncalibrated?: boolean;
}

export interface DecisionModelOptions {
  /** The selected entry's id, or null for None. */
  selected: string | null;
  options: DecisionModelOption[];
  /**
   * The selected model's operating point.
   *
   * The Agent editor seeds a new question's threshold from this, because 0.5 is only
   * meaningful for a model that answers around 0.5. A question authored against one
   * model keeps whatever the author chose; this only supplies the starting value.
   */
  calibration: DecisionCalibration;
}

/**
 * Where the chosen local entry is recorded.
 *
 * A connection is selected the way every other purpose default is, by its own row's
 * flag. A local entry has no row, so its id lives here. A local entry wins when both
 * are somehow set, and "None" is the absence of both.
 */
export const DECISION_LOCAL_DEFAULT_SETTINGS_KEY = "decision-local-default";

/**
 * Whether a model that has to think first may also gate pre-generation and parallel
 * agents.
 *
 * Off by default: reasoning takes seconds and those gates sit in front of the user's
 * reply, so every turn would wait. Post-processing gates run after the reply is on
 * screen and are unaffected.
 */
export const DECISION_THINKING_PREGENERATION_SETTINGS_KEY = "decision-thinking-pregeneration";

/**
 * Whether Smart response order asks the Decision model who should speak, instead of a
 * chat completion. Off by default: it trades the chat model's multi-candidate reasoning
 * for a cheaper, faster yes/no per candidate, and that trade is the user's to make.
 */
export const DECISION_SMART_ORDER_SETTINGS_KEY = "decision-smart-order";

/**
 * How many decision statements prompt conditionals may ask in one turn.
 *
 * A limit because a shared preset, card or lorebook decides how many it contains, and
 * on a hosted Decision connection every statement is part of a billed request. It is
 * the user's setting because the cost is theirs: nothing, on a local model.
 */
export const DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY = "decision-prompt-question-limit";
export const DEFAULT_DECISION_PROMPT_QUESTION_LIMIT = 32;
export const MAX_DECISION_PROMPT_QUESTION_LIMIT = 255;

export function parseDecisionPromptQuestionLimit(raw: unknown): number {
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
  return Number.isInteger(value) && value >= 1 && value <= MAX_DECISION_PROMPT_QUESTION_LIMIT
    ? value
    : DEFAULT_DECISION_PROMPT_QUESTION_LIMIT;
}
