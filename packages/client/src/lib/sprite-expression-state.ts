import { parseMessageExtraRecord } from "./chat-message-extra";

interface SpriteExpressionMessage {
  role?: string;
  extra?: unknown;
}

export function normalizeSpriteExpressionMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const expressions: Record<string, string> = {};
  for (const [key, expression] of Object.entries(value as Record<string, unknown>)) {
    if (typeof expression !== "string") continue;
    const trimmed = expression.trim();
    if (key && trimmed) expressions[key] = trimmed;
  }
  return expressions;
}

/**
 * Resolve sparse Expression Engine updates into the current per-character state.
 * Messages must be ordered from oldest to newest so explicit later expressions,
 * including `neutral`, replace earlier values without clearing omitted characters.
 */
export function resolveSpriteExpressionState(
  messages: readonly SpriteExpressionMessage[] | undefined,
  fallback?: unknown,
): Record<string, string> {
  const expressions = normalizeSpriteExpressionMap(fallback);

  for (const message of messages ?? []) {
    const update = normalizeSpriteExpressionMap(parseMessageExtraRecord(message.extra).spriteExpressions);
    for (const [characterId, expression] of Object.entries(update)) {
      expressions[characterId] = expression;
    }
  }

  return expressions;
}

/** Find the latest completed expression turn, skipping messages whose expressions are still pending. */
export function resolveLatestSpriteExpressionTurn(
  messages: readonly (SpriteExpressionMessage & { id: string })[] | undefined,
) {
  for (let index = (messages?.length ?? 0) - 1; index >= 0; index--) {
    const message = messages![index]!;
    if (message.role !== "assistant") continue;
    const extra = parseMessageExtraRecord(message.extra);
    if (Array.isArray(extra.expressionSpriteIds)) {
      const characterIds = extra.expressionSpriteIds.filter((id): id is string => typeof id === "string" && !!id);
      return { characterIds, messageId: message.id, messageIndex: index };
    }

    // Older turns only stored sparse expressions, with persona expressions on the preceding user message.
    // A user map alone can outlive a regenerated assistant swipe, so it cannot prove that turn completed.
    const characterIds = Object.keys(normalizeSpriteExpressionMap(extra.spriteExpressions));
    if (characterIds.length > 0) {
      for (let previous = index - 1; previous >= 0; previous--) {
        const prior = messages![previous]!;
        if (prior.role === "assistant") break;
        if (prior.role !== "user") continue;
        characterIds.push(
          ...Object.keys(normalizeSpriteExpressionMap(parseMessageExtraRecord(prior.extra).spriteExpressions)),
        );
        break;
      }
      return { characterIds, messageId: message.id, messageIndex: index };
    }
  }
  return undefined;
}
