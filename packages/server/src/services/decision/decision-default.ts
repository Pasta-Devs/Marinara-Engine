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
  DECISION_THINKING_PREGENERATION_SETTINGS_KEY,
  DECISION_TIMEOUT_MS,
  decisionLocalSlotForId,
  type DecisionLocalSlot,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getAnswerStyle } from "./decision-thinking-cache.js";
import { decisionSlotContextSize, resolveDecisionSlot } from "./decision-slots.js";
import { askSidecarNoulQuestions } from "./sidecar-decision.backend.js";
import { resolveDecisionConnection, type DecisionConnectionRow } from "./decision-connection.js";
import { askNoulQuestions, type NoulQuestion } from "./system-one.client.js";

/**
 * Headroom left for the system prompt and the question when capping a state against a
 * local slot's context. The question itself is capped at 500 characters by the schema.
 */
const SIDECAR_STATE_HEADROOM_TOKENS = 512;

export interface DecisionBackend {
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
  ask: (state: unknown, questions: NoulQuestion[]) => Promise<Map<string, number> | null>;
}

export interface DecisionDefaultDeps {
  getLocalDefault: () => Promise<string | null>;
  getThinkingPreGeneration: () => Promise<boolean>;
  getDefaultConnection: () => Promise<DecisionConnectionRow | null>;
  getConnectionWithKey: (id: string) => Promise<DecisionConnectionRow | null>;
  debugMode?: boolean;
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
    const resolution = await resolveDecisionSlot(slot);
    if (!resolution.resolved) {
      logger.warn("[decision] The selected local model cannot serve decisions: %s", resolution.failure.reason);
      return null;
    }
    const resolved = resolution.resolved;

    // The managed decision sidecar is a System One server, not a chat model. Asking it
    // over /v1/chat/completions gets a 404, so the protocol is carried on the resolved
    // slot rather than assumed from the fact that it is local.
    if (resolved.protocol === "system_one") {
      const calibration = resolved.calibration ?? DEFAULT_DECISION_CALIBRATION;
      // The model's own launch limit, never the main sidecar's context. Overshooting
      // it is not a truncation, it is a 422 and a failed gate on every long scene.
      const limit = resolved.maxLengthTokens ?? decisionSlotContextSize(slot);
      const maxStateTokens = Math.max(256, limit - SIDECAR_STATE_HEADROOM_TOKENS);
      return {
        maxStateTokens,
        calibration,
        // It scores candidates in one pass and never reasons, so nothing is deferred.
        deferPreGeneration: false,
        ask: async (state, questions) =>
          (
            await askNoulQuestions({
              connection: {
                endpoint: `${resolved.baseUrl}/v1/systemone`,
                apiKey: "",
                model: resolved.model,
                maxStateTokens,
              },
              state,
              questions,
              // Local and on loopback, but a model still has to run: the sidecar
              // budget rather than the hosted one.
              timeoutMs: DECISION_TIMEOUT_MS.sidecar,
              signal,
              questionShape: calibration.questionShape,
              debugMode: deps.debugMode,
            })
          ).answers,
      };
    }

    // Exactly the formula askQuestion uses, so what is deferred matches what is
    // actually slow. Reading the cached verdict without the "auto" guard would keep
    // deferring after the user switched the slot to Off, where every request is a
    // fast one-token call again.
    const thinks =
      resolved.thinking === "allowed" ||
      (resolved.thinking === "auto" && getAnswerStyle(resolved.modelIdentity) === "thinks");
    return {
      maxStateTokens: Math.max(256, decisionSlotContextSize(slot) - SIDECAR_STATE_HEADROOM_TOKENS),
      // A local chat model is prompted, not queried, so it reads the question as
      // written and answers on the ordinary scale.
      calibration: DEFAULT_DECISION_CALIBRATION,
      deferPreGeneration: thinks && !(await deps.getThinkingPreGeneration()),
      ask: async (state, questions) => askSidecarNoulQuestions({ slot: resolved, state, questions, signal }),
    };
  }

  const row = await deps.getDefaultConnection();
  if (!row) return null;
  const resolved = await resolveDecisionConnection(row, deps.getConnectionWithKey);
  if (!resolved.connection) {
    logger.warn("[decision] Activation connection unavailable: %s", resolved.error);
    return null;
  }
  const connection = resolved.connection;
  // Hosted Jev keeps the documented operating point and wire shape: it has not been
  // measured here, and re-pointing it on another model's numbers would be a guess.
  const calibration = DEFAULT_DECISION_CALIBRATION;
  return {
    maxStateTokens: connection.maxStateTokens,
    calibration,
    deferPreGeneration: false,
    ask: async (state, questions) =>
      (
        await askNoulQuestions({
          connection,
          state,
          questions,
          timeoutMs: DECISION_TIMEOUT_MS.systemOne,
          signal,
          questionShape: calibration.questionShape,
          debugMode: deps.debugMode,
        })
      ).answers,
  };
}

export const DECISION_SETTINGS_KEYS = {
  localDefault: DECISION_LOCAL_DEFAULT_SETTINGS_KEY,
  thinkingPreGeneration: DECISION_THINKING_PREGENERATION_SETTINGS_KEY,
} as const;
