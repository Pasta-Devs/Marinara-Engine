/**
 * Reading a yes/no probability out of a chat model's token log-probabilities.
 *
 * A decision is one chat completion with `max_tokens: 1`: the probabilities of the
 * `yes`-shaped and `no`-shaped tokens in the first position are what the question is
 * actually asking for, so no text needs to be generated or parsed.
 *
 * Pure functions with no transport, so the regression can drive them from recorded
 * llama-server responses.
 */
import { DECISION_DIRECT_ANSWER_MIN_SHARE } from "@marinara-engine/shared";

/** One entry of `top_logprobs`, as llama-server and OpenAI-compatible servers return it. */
export interface TopLogprob {
  token?: unknown;
  logprob?: unknown;
}

export interface LogprobReading {
  /** yes / (yes + no), or null when neither shape appeared. */
  probability: number | null;
  /** Summed probability of the `yes` variants. */
  yes: number;
  /** Summed probability of the `no` variants. */
  no: number;
  /** Total probability listed across the returned candidates. */
  listed: number;
  /** Share of the listed mass the yes/no variants carry. */
  share: number;
}

/**
 * Collapse a token to the word it stands for.
 *
 * Tokenizers hand back `" Yes"`, `"yes"`, `"No."` and friends for the same answer, so
 * leading whitespace and surrounding punctuation are stripped before comparing. The
 * comparison stays exact after that: `"nothing"` is not a `no`.
 */
export function normalizeAnswerToken(token: string): string {
  return token
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .toLowerCase();
}

const YES_TOKENS = new Set(["yes", "y", "true"]);
const NO_TOKENS = new Set(["no", "n", "false"]);

/** Sum the yes and no mass in one position's candidate list. */
export function readLogprobAnswer(topLogprobs: readonly TopLogprob[] | null | undefined): LogprobReading {
  let yes = 0;
  let no = 0;
  let listed = 0;
  for (const candidate of topLogprobs ?? []) {
    if (typeof candidate?.token !== "string" || typeof candidate.logprob !== "number") continue;
    if (!Number.isFinite(candidate.logprob)) continue;
    const probability = Math.exp(candidate.logprob);
    if (!Number.isFinite(probability) || probability <= 0) continue;
    listed += probability;
    const normalized = normalizeAnswerToken(candidate.token);
    if (YES_TOKENS.has(normalized)) yes += probability;
    else if (NO_TOKENS.has(normalized)) no += probability;
  }
  const total = yes + no;
  return {
    probability: total > 0 ? yes / total : null,
    yes,
    no,
    listed,
    share: listed > 0 ? total / listed : 0,
  };
}

/**
 * Did the model actually answer in one token?
 *
 * A reasoning marker, an empty token, unrelated prose or missing log-probabilities all
 * mean no, and so does a list where yes/no variants carry less than half the listed
 * mass — that is a model writing something else and happening to consider "no" on the
 * way. Treating any of these as an answer would turn a model's confusion into a
 * confident probability.
 */
export function isDirectAnswer(reading: LogprobReading): boolean {
  return reading.probability !== null && reading.share >= DECISION_DIRECT_ANSWER_MIN_SHARE;
}

/**
 * The fallback for a slot whose runtime returns no log-probabilities, and for reasoning
 * models whose answer arrives as text after the thinking ends.
 *
 * Returns 1 or 0 rather than a probability, which is why a connection reading answers
 * this way is marked uncalibrated and its threshold slider is disabled: there is no
 * gradient left for a threshold to sit on.
 */
export function readWordAnswer(content: string | null | undefined): number | null {
  const words = (content ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu);
  for (let index = (words?.length ?? 0) - 1; index >= 0; index--) {
    const word = words![index]!;
    if (YES_TOKENS.has(word)) return 1;
    if (NO_TOKENS.has(word)) return 0;
  }
  return null;
}
