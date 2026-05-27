function normalizeChatSummaryFingerprint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function fingerprintChatSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function chatSummaryFingerprintMatches(extra: Record<string, unknown>, current: string | null): boolean {
  if (!Object.prototype.hasOwnProperty.call(extra, "chatSummaryFingerprint")) return false;
  return normalizeChatSummaryFingerprint(extra.chatSummaryFingerprint) === current;
}
