import { buildDecisionInstructions, type DecisionQuestionShape } from "@marinara-engine/shared";
import { isProviderLocalUrlsEnabled } from "../../config/runtime-config.js";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import { logDebugOverride } from "../../lib/logger.js";
import { safeFetch } from "../../utils/security.js";
import type { DecisionConnection } from "./decision-connection.js";

export interface NoulQuestion {
  id: string;
  instructions: string;
  /**
   * Present for a Choice question: the option names it chooses between. Sent as a
   * System One `choice` question, answered in `choices` rather than `answers`.
   */
  options?: string[];
}

/** The option a Choice question adds so a turn that fits none of the others can say so. */
export const DECISION_CHOICE_NONE = "none of these";
export type DecisionRequestError =
  "timeout" | "cancelled" | "network" | "invalid_response" | "partial_response" | `http_${number}`;

export interface DecisionRequest {
  connection: DecisionConnection;
  state: unknown;
  questions: NoulQuestion[];
  timeoutMs?: number;
  signal?: AbortSignal;
  debugMode?: boolean;
  /**
   * How this backend wants the question worded. Defaults to plain text, which is what
   * every backend shipped before a model was measured wanting otherwise.
   */
  questionShape?: DecisionQuestionShape;
}

/** Safe, bounded System One transport. Error bodies may contain chat data, so never log them. */
export async function askNoulQuestions(req: DecisionRequest): Promise<{
  answers: Map<string, number>;
  /** The chosen option for each Choice question that was answered. */
  choices: Map<string, string>;
  error?: DecisionRequestError;
  latencyMs: number;
}> {
  const start = Date.now();
  const answers = new Map<string, number>();
  const choices = new Map<string, string>();
  const timeout = AbortSignal.timeout(req.timeoutMs ?? 1500);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  let error: DecisionRequestError | undefined;
  let onAbort: (() => void) | undefined;
  try {
    signal.throwIfAborted();
    const body = {
      model: req.connection.model,
      state: req.state,
      questions: Object.fromEntries(
        req.questions.map((q) => {
          const instructions = buildDecisionInstructions(q.instructions, req.questionShape ?? "text");
          if (!q.options) return [q.id, { type: "noul", instructions }];
          // Descriptions are optional in System One; the option name says it all, and
          // only the added "none" option needs one.
          const criteria: Record<string, string | null> = Object.fromEntries(q.options.map((option) => [option, null]));
          criteria[DECISION_CHOICE_NONE] = "None of the other options apply.";
          return [q.id, { type: "choice", instructions, criteria }];
        }),
      ),
    };
    logDebugOverride(
      req.debugMode === true || process.env.DEBUG_AGENTS === "true",
      "[decision] System One request: %s",
      JSON.stringify(body),
    );
    // DNS validation precedes fetch and cannot itself be aborted. Bound the entire operation.
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    const response = await Promise.race([
      safeFetch(req.connection.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.connection.apiKey ? { Authorization: `Bearer ${req.connection.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
        policy: {
          allowLocal: isProviderLocalUrlsEnabled(),
          allowLoopback: true,
          allowMdns: true,
          allowedProtocols: ["https:", "http:"],
          allowedOrigins: [new URL(req.connection.endpoint).origin],
          flagName: "PROVIDER_LOCAL_URLS_ENABLED",
        },
        maxResponseBytes: 1024 * 1024,
        bufferResponse: true,
        decodeCompressedResponse: true,
      }),
      aborted,
    ]);
    if (!response.ok) {
      error = `http_${response.status}`;
    } else {
      const payload = (await response.json()) as {
        answers?: Record<string, { type?: unknown; noul?: unknown; choice?: unknown }>;
      } | null;
      if (!payload || typeof payload.answers !== "object" || !payload.answers || Array.isArray(payload.answers)) {
        error = "invalid_response";
      } else {
        for (const question of req.questions) {
          const answer = Object.hasOwn(payload.answers, question.id) ? payload.answers[question.id] : undefined;
          if (question.options) {
            // Only an option that was offered counts; anything else is a malformed answer.
            if (
              answer?.type === "choice" &&
              typeof answer.choice === "string" &&
              (question.options.includes(answer.choice) || answer.choice === DECISION_CHOICE_NONE)
            )
              choices.set(question.id, answer.choice);
            else error = "partial_response";
            continue;
          }
          if (
            answer?.type === "noul" &&
            typeof answer.noul === "number" &&
            Number.isFinite(answer.noul) &&
            answer.noul >= 0 &&
            answer.noul <= 1
          ) {
            answers.set(question.id, answer.noul);
          } else error = "partial_response";
        }
      }
    }
  } catch (caught) {
    error = req.signal?.aborted
      ? "cancelled"
      : timeout.aborted
        ? "timeout"
        : caught instanceof SyntaxError
          ? "invalid_response"
          : "network";
  }
  if (onAbort) signal.removeEventListener("abort", onAbort);
  // A gate calls this on every turn, so a server that stays down would repeat the same
  // warning each time; at most one line per error code per window.
  if (error && error !== "cancelled")
    logRateLimited(
      "warn",
      `decision.system-one:${error}`,
      undefined,
      "[decision] Activation request failed: %s",
      error,
    );
  return { answers, choices, ...(error ? { error } : {}), latencyMs: Date.now() - start };
}
