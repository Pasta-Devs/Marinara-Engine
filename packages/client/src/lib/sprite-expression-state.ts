import { parseMessageExtraRecord } from "./chat-message-extra";

interface SpriteExpressionMessage {
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
    const update = normalizeSpriteExpressionMap(
      parseMessageExtraRecord(message.extra).spriteExpressions,
    );
    for (const [characterId, expression] of Object.entries(update)) {
      expressions[characterId] = expression;
    }
  }

  return expressions;
}
