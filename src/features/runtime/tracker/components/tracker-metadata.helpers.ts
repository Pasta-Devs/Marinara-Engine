export function parseMetadataRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
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

export function getLatestSpriteExpressionsFromMessages(
  messages: Array<{ role?: string; extra?: unknown }> | undefined,
) {
  if (!messages?.length) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    const extra = parseMetadataRecord(message.extra);
    const expressions = normalizeSpriteExpressionMap(extra.spriteExpressions);
    if (Object.keys(expressions).length > 0) return expressions;
  }
  return null;
}
