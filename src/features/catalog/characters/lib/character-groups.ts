export function normalizeCharacterGroupMemberIds(value: unknown): string[] {
  const rawIds = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Older malformed records can store one id as a string.
    }
    return [trimmed];
  })();

  return Array.from(
    new Set(rawIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter((id) => id.length > 0)),
  );
}
