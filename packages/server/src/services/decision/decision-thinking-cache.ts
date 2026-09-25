/**
 * What each locally loaded model turned out to do when asked for a one-token answer.
 *
 * Marinara gets bug reports whenever something forces thinking on or off, so the
 * backend never trusts `enable_thinking: false` to have worked. It sends the request,
 * looks at what came back, and remembers the answer here.
 *
 * Keyed by the loaded model rather than by the slot: a slot that swaps to a
 * well-behaved model should go straight back to the fast path instead of inheriting
 * the previous model's verdict. In-memory on purpose — a restart reloads the model
 * anyway, and re-probing costs one request.
 */
import { DECISION_AUTO_THINKING_FAILURES, type DecisionAnswerStyle } from "@marinara-engine/shared";

interface ModelRecord {
  style: DecisionAnswerStyle;
  /** Consecutive one-token attempts that did not produce a usable answer. */
  failures: number;
  /** True when the runtime returned no log-probabilities, so answers are 1 or 0. */
  uncalibrated: boolean;
}

const records = new Map<string, ModelRecord>();

function record(modelIdentity: string): ModelRecord {
  const existing = records.get(modelIdentity);
  if (existing) return existing;
  const created: ModelRecord = { style: "unknown", failures: 0, uncalibrated: false };
  records.set(modelIdentity, created);
  return created;
}

export function getAnswerStyle(modelIdentity: string): DecisionAnswerStyle {
  return records.get(modelIdentity)?.style ?? "unknown";
}

export function isUncalibrated(modelIdentity: string): boolean {
  return records.get(modelIdentity)?.uncalibrated ?? false;
}

/** A one-token request produced a real yes/no answer. */
export function recordDirectAnswer(modelIdentity: string, uncalibrated = false): void {
  const entry = record(modelIdentity);
  entry.style = "direct";
  entry.failures = 0;
  entry.uncalibrated = uncalibrated;
}

/**
 * A one-token request did not produce an answer.
 *
 * Returns true once the model has failed often enough that Auto should stop trying,
 * so the caller can switch that model over and tell the user rather than gating on a
 * method this model cannot use.
 */
export function recordOneTokenFailure(modelIdentity: string): boolean {
  const entry = record(modelIdentity);
  entry.failures += 1;
  if (entry.failures >= DECISION_AUTO_THINKING_FAILURES) {
    entry.style = "thinks";
    return true;
  }
  return false;
}

/** A reasoning-mode request answered, with or without usable log-probabilities. */
export function recordThinkingAnswer(modelIdentity: string, uncalibrated: boolean): void {
  const entry = record(modelIdentity);
  entry.style = "thinks";
  entry.uncalibrated = uncalibrated;
}

/** Drop what was learned, for a slot that has loaded a different model. */
export function forgetDecisionModel(modelIdentity: string): void {
  records.delete(modelIdentity);
}

export function clearDecisionThinkingCache(): void {
  records.clear();
}
