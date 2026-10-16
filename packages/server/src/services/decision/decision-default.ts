/**
 * Which decision model gates run against, and the one `ask` they all reach it through.
 *
 * The two backend families answer the same question and differ only in how they are
 * reached, so the gate sites take a resolved backend rather than knowing about either.
 * Everything here fails open: an unreachable backend returns no answers, and an agent
 * with no answer runs exactly as it would with no question at all.
 */
import {
  DECISION_LOCAL_DEFAULT_SETTINGS_KEY,
  DEFAULT_DECISION_CALIBRATION,
  type DecisionCalibration,
  DECISION_SMART_ORDER_SETTINGS_KEY,
  DECISION_THINKING_PREGENERATION_SETTINGS_KEY,
  DECISION_TIMEOUT_MS,
  decisionLocalSlotForId,
  type DecisionLocalSlot,
  type DecisionDebugReport,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getAnswerStyle } from "./decision-thinking-cache.js";
import { decisionSlotContextSize, resolveDecisionSlot } from "./decision-slots.js";
import { askSidecarNoulQuestions, connectionChatTarget, type ChatDecisionTarget } from "./sidecar-decision.backend.js";
import { resolveDecisionConnection, type DecisionConnectionRow } from "./decision-connection.js";
import { whenDecisionServerFree } from "./decision-server-queue.js";
import { askNoulQuestions, DECISION_CHOICE_NONE, type NoulQuestion } from "./system-one.client.js";

/**
 * Headroom left for the system prompt and the question when capping a state against a
 * local slot's context. The question itself is capped at 500 characters by the schema.
 */
const SIDECAR_STATE_HEADROOM_TOKENS = 512;

/**
 * Expected time of one statement on a model nothing measured: a chat model asked one question per request, one
 * at a time, or a pasted sidecar checkpoint. A guess on the slow side, used to size passes of many statements.
 */
export const DECISION_UNMEASURED_STATEMENT_MS = 1000;

export interface DecisionBackend {
  model?: string;
  debugMode?: boolean;
  inspection?: DecisionDebugReport;
  /** The budget a state is capped to before it is sent. */
  maxStateTokens: number;
  /**
   * Where this model answers, and how it wants the question worded.
   *
   * Carried on the backend rather than read from a constant because both are
   * properties of the model that produces the probability, not of the feature.
   */
  calibration: DecisionCalibration;
  /**
   * True when a gate in front of the user's reply should be skipped rather than waited
   * on. Only a reasoning local model sets this, and only while the user has not opted
   * into gating pre-generation agents anyway.
   */
  deferPreGeneration: boolean;
  /**
   * The expected time of one request carrying this many statements, measured where the model is known, for
   * sizing a pass of many requests. Not a time limit. Absent, the time is unknown: each statement counts
   * `DECISION_UNMEASURED_STATEMENT_MS`, and a pass asks every statement rather than judge fewer on a guess.
   */
  requestMs?: (statements: number) => number;
  ask: (state: unknown, questions: NoulQuestion[]) => Promise<Map<string, number> | null>;
  /**
   * Yes/no and Choice questions together, for prompt conditionals. A question with
   * `options` is a Choice question; its answer is the chosen option, or
   * `DECISION_CHOICE_NONE` when none of them fits.
   */
  askMixed: (state: unknown, questions: NoulQuestion[]) => Promise<MixedDecisionAnswers>;
}

export interface MixedDecisionAnswers {
  answers: Map<string, number>;
  choices: Map<string, string>;
  binaryAnswers?: Set<string>;
  error?: string;
}

/**
 * Choice for a model that only answers yes or no: each option becomes its own
 * statement, and the likeliest wins if it clears the model's threshold. This is how
 * Open-Jev answers Choice internally too, one candidate at a time.
 */
export async function askChoicesAsStatements(
  ask: (state: unknown, questions: NoulQuestion[]) => Promise<Map<string, number> | null>,
  state: unknown,
  questions: NoulQuestion[],
  threshold: number,
): Promise<MixedDecisionAnswers> {
  const plain = questions.filter((question) => !question.options);
  const expanded = questions.flatMap((question) =>
    (question.options ?? []).map((option, index) => ({
      id: `${question.id}\u0000${index}`,
      instructions: `${question.instructions}: ${option}`,
    })),
  );
  const answers = (await ask(state, [...plain, ...expanded])) ?? new Map<string, number>();
  const choices = new Map<string, string>();
  for (const question of questions) {
    if (!question.options) continue;
    let bestOption: string | null = null;
    let bestP = -1;
    for (const [index, option] of question.options.entries()) {
      const p = answers.get(`${question.id}\u0000${index}`);
      if (p !== undefined && p > bestP) {
        bestOption = option;
        bestP = p;
      }
    }
    // No answer at all leaves the question unanswered, which reads as false.
    if (bestOption !== null) choices.set(question.id, bestP >= threshold ? bestOption : DECISION_CHOICE_NONE);
  }
  for (const key of [...answers.keys()]) if (key.includes("\u0000")) answers.delete(key);
  return { answers, choices };
}

export interface DecisionDefaultDeps {
  getLocalDefault: () => Promise<string | null>;
  getThinkingPreGeneration: () => Promise<boolean>;
  getDefaultConnection: () => Promise<DecisionConnectionRow | null>;
  getConnectionWithKey: (id: string) => Promise<DecisionConnectionRow | null>;
  debugMode?: boolean;
  inspection?: DecisionDebugReport;
}

/**
 * How many answers a request asks the model for: one per statement, and one per
 * Choice option plus the added "none of these", each of which costs about as much as
 * a statement (measured on Open-Jev 2B and 9B).
 */
export function answersAskedFor(questions: NoulQuestion[]): number {
  return questions.reduce((n, q) => n + (q.options ? q.options.length + 1 : 1), 0);
}

/**
 * A request's time limit, built per answer: `first` for the first, `each` for every
 * further one. A time limit belongs to a statement, never to the whole group, so a
 * request carrying thirty statements is never held to the limit of one.
 */
export function perStatementLimitMs(answers: number, first: number, each: number): number {
  return first + each * Math.max(0, answers - 1);
}

/**
 * A chat model asked for one yes/no token per statement: a local chat slot, or a
 * chat-model Decision connection on the user's own server.
 */
async function chatBackend(
  target: ChatDecisionTarget,
  maxStateTokens: number,
  deps: DecisionDefaultDeps,
  signal: AbortSignal | undefined,
): Promise<DecisionBackend> {
  // Exactly the formula askQuestion uses, so what is deferred matches what is
  // actually slow. Reading the cached verdict without the "auto" guard would keep
  // deferring after the user switched the slot to Off, where every request is a
  // fast one-token call again.
  const thinks =
    target.thinking === "allowed" || (target.thinking === "auto" && getAnswerStyle(target.modelIdentity) === "thinks");
  return {
    model: target.model,
    debugMode: deps.debugMode,
    inspection: deps.inspection,
    maxStateTokens,
    // A chat model is prompted, not queried, so it reads the question as written and
    // answers on the ordinary scale.
    calibration: DEFAULT_DECISION_CALIBRATION,
    deferPreGeneration: thinks && !(await deps.getThinkingPreGeneration()),
    // No requestMs: a chat model's speed is not measured, so a recall pass asks every statement (#7699).
    ask: async (state, questions) =>
      askSidecarNoulQuestions({
        slot: target,
        state,
        questions,
        signal,
        debugMode: deps.debugMode,
        inspection: deps.inspection,
      }),
    askMixed: async (state, questions) => {
      const binaryAnswers = new Set<string>();
      const result = await askChoicesAsStatements(
        (innerState, inner) =>
          askSidecarNoulQuestions({
            slot: target,
            state: innerState,
            questions: inner,
            signal,
            debugMode: deps.debugMode,
            inspection: deps.inspection,
            onAnswer: (id, answer) => {
              if (answer.uncalibrated) binaryAnswers.add(id);
            },
          }),
        state,
        questions,
        DEFAULT_DECISION_CALIBRATION.defaultThreshold,
      );
      return { ...result, binaryAnswers };
    },
  };
}

/** Read the local entry the user picked, if any, ignoring one this build cannot serve. */
export async function readDecisionLocalSlot(
  getLocalDefault: () => Promise<string | null>,
): Promise<DecisionLocalSlot | null> {
  const slot = decisionLocalSlotForId(await getLocalDefault());
  // Whether the slot can actually serve is `resolveDecisionSlot`'s answer, not a
  // property of the id: a slot with no model is still a real slot.
  return slot;
}

/**
 * Resolve the Decision model setting into something a gate can call, or null for None.
 *
 * A local entry wins over a connection row: it is the more specific choice, and the
 * dropdown clears the other side whenever the user switches, so both being set at once
 * only happens after a hand-edited database.
 */
export async function resolveDecisionBackend(
  deps: DecisionDefaultDeps,
  signal?: AbortSignal,
): Promise<DecisionBackend | null> {
  const slot = await readDecisionLocalSlot(deps.getLocalDefault);
  if (slot) {
    const resolution = await resolveDecisionSlot(slot, signal, deps.inspection?.mode === "inspect");
    // resolveDecisionSlot already wrote the one line for this failure.
    if (!resolution.resolved) return null;
    const resolved = resolution.resolved;
    if (deps.inspection) deps.inspection.model = resolved.label;

    // The managed decision sidecar is a System One server, not a chat model. Asking it
    // over /v1/chat/completions gets a 404, so the protocol is carried on the resolved
    // slot rather than assumed from the fact that it is local.
    if (resolved.protocol === "system_one") {
      const calibration = resolved.calibration ?? DEFAULT_DECISION_CALIBRATION;
      // The model's own launch limit, never the main sidecar's context. Overshooting
      // it is not a truncation, it is a 422 and a failed gate on every long scene.
      const limit = resolved.maxLengthTokens ?? decisionSlotContextSize(slot);
      const maxStateTokens = Math.max(256, limit - SIDECAR_STATE_HEADROOM_TOKENS);
      const perQuestionMs = resolved.perQuestionMs;
      // Local and on loopback, but a model still has to run: the sidecar's limit for the
      // first answer, then its measured cost for each further one. A model with no
      // measured cost gets the full limit for every answer. Never one limit for the
      // whole group, however many statements it carries.
      const askSidecar = (state: unknown, questions: NoulQuestion[]) =>
        // Its server answers one request at a time, so a request's clock starts once it
        // reaches the model, not while another request is still being answered.
        whenDecisionServerFree(resolved.baseUrl, resolved.serverSlots, signal, () =>
          askNoulQuestions({
            connection: {
              protocol: "system_one",
              endpoint: `${resolved.baseUrl}/v1/systemone`,
              apiKey: "",
              model: resolved.model,
              maxStateTokens,
            },
            state,
            questions,
            timeoutMs: perStatementLimitMs(
              answersAskedFor(questions),
              DECISION_TIMEOUT_MS.sidecar,
              resolved.perQuestionMs ?? DECISION_TIMEOUT_MS.sidecar,
            ),
            signal,
            questionShape: calibration.questionShape,
            debugMode: deps.debugMode,
            inspection: deps.inspection,
          }),
        );
      return {
        model: resolved.model,
        debugMode: deps.debugMode,
        inspection: deps.inspection,
        maxStateTokens,
        calibration,
        // It scores candidates in one pass and never reasons, so nothing is deferred.
        deferPreGeneration: false,
        // Each statement re-reads the scene, so a request costs its measured time per statement. A pasted
        // checkpoint has none measured.
        requestMs: perQuestionMs ? (statements) => statements * perQuestionMs : undefined,
        ask: async (state, questions) => (await askSidecar(state, questions)).answers,
        askMixed: askSidecar,
      };
    }

    return chatBackend(
      resolved,
      Math.max(256, decisionSlotContextSize(slot) - SIDECAR_STATE_HEADROOM_TOKENS),
      deps,
      signal,
    );
  }

  const row = await deps.getDefaultConnection();
  if (!row) return null;
  const resolved = await resolveDecisionConnection(row, deps.getConnectionWithKey);
  if (!resolved.connection) {
    logger.warn("[decision] Activation connection unavailable: %s", resolved.error);
    return null;
  }
  const connection = resolved.connection;
  if (deps.inspection) deps.inspection.model = connection.model;
  // An ordinary chat model on the user's own server, asked the way a local slot is.
  if (connection.protocol === "chat_logprobs")
    return chatBackend(
      connectionChatTarget(row.id, row.name ?? connection.model, connection),
      connection.maxStateTokens,
      deps,
      signal,
    );
  // Every System One connection keeps the documented operating point and wire shape.
  //
  // Deliberate, including for the `custom` source. A custom endpoint is any System
  // One host, and this code cannot tell a self-hosted Open-Jev from TypeSafe's own
  // Jev or anything else that speaks the protocol. Applying one model's measured
  // calibration to all of them would silently move the operating point under hosts
  // it was never measured against, which is worse than a default that is merely
  // wrong for one of them. Self-hosted Open-Jev users tune the threshold per agent,
  // and the managed sidecar carries its own calibration because there the model is
  // known.
  const calibration = DEFAULT_DECISION_CALIBRATION;
  // The connection's Time limit is per statement. A request that asks several at once
  // gets that much for each of them, never one limit for the whole group.
  const perStatement = connection.timeoutMs ?? DECISION_TIMEOUT_MS.systemOne;
  const askConnection = (state: unknown, questions: NoulQuestion[]) =>
    askNoulQuestions({
      connection,
      state,
      questions,
      timeoutMs: perStatementLimitMs(answersAskedFor(questions), perStatement, perStatement),
      signal,
      questionShape: calibration.questionShape,
      debugMode: deps.debugMode,
      inspection: deps.inspection,
    });
  return {
    model: connection.model,
    debugMode: deps.debugMode,
    inspection: deps.inspection,
    maxStateTokens: connection.maxStateTokens,
    calibration,
    deferPreGeneration: false,
    // System One answers a request's statements together, so a request costs about one statement's time. A long
    // per-statement limit allows for a slow outlier; it is not the expected time, so it counts at most the 4 s a
    // local request gets.
    requestMs: () => Math.min(perStatement, DECISION_TIMEOUT_MS.sidecar),
    ask: async (state, questions) => (await askConnection(state, questions)).answers,
    askMixed: askConnection,
  };
}

export const DECISION_SETTINGS_KEYS = {
  localDefault: DECISION_LOCAL_DEFAULT_SETTINGS_KEY,
  thinkingPreGeneration: DECISION_THINKING_PREGENERATION_SETTINGS_KEY,
  smartOrder: DECISION_SMART_ORDER_SETTINGS_KEY,
} as const;
