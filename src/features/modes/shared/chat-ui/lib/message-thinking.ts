const STORED_THINKING_KEYS = ["thinking", "reasoning_content", "reasoning"] as const;

export function readStoredThinking(extra: unknown): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;

  const record = extra as Record<string, unknown>;
  for (const key of STORED_THINKING_KEYS) {
    const value = record[key];
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return null;
}
