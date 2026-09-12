import type { LLMUsage } from "../llm/base-provider.js";

export const GENERIC_EMPTY_RESPONSE_MESSAGE = "The AI returned an empty response. Try sending your message again.";

export interface EmptyResponseContext {
  finishReason?: string | null;
  usage?: Pick<LLMUsage, "completionTokens" | "completionReasoningTokens"> | null;
  maxTokens?: number | null;
  hadThinking: boolean;
}

/**
 * The output budget that actually went to the provider. Routes compute
 * max_tokens before the connection-level override is applied; the provider
 * caps it on the way out (BaseLLMProvider.applyMaxTokensCap). Quote the capped
 * number, or "16 of 4096" is what the user reads when 16 is what was sent.
 */
export function sentOutputBudget(
  maxTokens: number | null | undefined,
  maxTokensOverride: number | null | undefined,
): number | undefined {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens) || maxTokens <= 0) return undefined;
  if (typeof maxTokensOverride === "number" && Number.isFinite(maxTokensOverride) && maxTokensOverride > 0) {
    return Math.min(maxTokens, Math.floor(maxTokensOverride));
  }
  return maxTokens;
}

/**
 * Turn an empty model reply into a sentence that says what the provider
 * reported, so the user can act on it instead of retrying blind.
 *
 * Reasoning models spend one output budget on thinking and on text. When the
 * budget runs out mid-thought the reply is empty, and the provider says so:
 * finish_reason "length", completion tokens at the cap, nearly all of them
 * reasoning. Z.AI also reports "sensitive" (content policy) and
 * "model_context_window_exceeded" (docs.z.ai chat-completion reference); any
 * other reason is quoted verbatim rather than hidden.
 */
export function describeEmptyModelResponse(context: EmptyResponseContext): string {
  const finish = typeof context.finishReason === "string" ? context.finishReason.trim().toLowerCase() : "";
  const completion = context.usage?.completionTokens;
  const reasoning = context.usage?.completionReasoningTokens;
  const max = typeof context.maxTokens === "number" && context.maxTokens > 0 ? context.maxTokens : undefined;
  const budgetSpent =
    finish === "length" ||
    (context.hadThinking && typeof completion === "number" && typeof max === "number" && completion >= max);

  if (finish === "sensitive") {
    return 'The provider stopped the reply for content policy (finish reason "sensitive") and returned no text.';
  }
  if (finish === "model_context_window_exceeded") {
    return 'The prompt exceeded the model\'s context window (finish reason "model_context_window_exceeded"). Lower Max Context or shorten the prompt.';
  }
  if (budgetSpent) {
    let spent = "";
    if (typeof completion === "number" && typeof max === "number") {
      spent = ` (${completion} of ${max} output tokens`;
      spent += typeof reasoning === "number" ? `, ${reasoning} of them reasoning)` : ")";
    }
    return `The model used its whole output budget${spent} before writing any visible text. Raise Max Tokens or lower Reasoning Effort, then try again.`;
  }
  if (context.hadThinking) {
    const details = [
      typeof reasoning === "number" ? `${reasoning} reasoning tokens` : null,
      finish ? `finish reason "${finish}"` : null,
    ].filter((part): part is string => part !== null);
    const detail = details.length ? ` (${details.join(", ")})` : "";
    return `The model finished reasoning${detail} but returned no visible text. Try again, or lower Reasoning Effort.`;
  }
  if (finish) {
    return `The AI returned an empty response (finish reason "${finish}"). Try sending your message again.`;
  }
  return GENERIC_EMPTY_RESPONSE_MESSAGE;
}
