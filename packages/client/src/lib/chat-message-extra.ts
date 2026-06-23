export function parseMessageExtraRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function hasPendingPostProcessingExtra(value: unknown): boolean {
  const pending = parseMessageExtraRecord(value).postProcessingPending;
  return !!pending && typeof pending === "object" && !Array.isArray(pending);
}

export function messageHasPendingPostProcessing(message: { extra?: unknown } | null | undefined): boolean {
  return hasPendingPostProcessingExtra(message?.extra);
}
