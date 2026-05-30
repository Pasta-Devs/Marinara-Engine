export type SecretPlotDirection = { direction: string; fulfilled?: boolean };

export function normalizeSecretPlotSceneDirections(raw: unknown): SecretPlotDirection[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry === "string") {
      const direction = entry.trim();
      return direction ? [{ direction, fulfilled: false }] : [];
    }
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { direction?: unknown; fulfilled?: unknown };
    if (typeof candidate.direction !== "string") return [];
    const direction = candidate.direction.trim();
    return direction ? [{ direction, fulfilled: candidate.fulfilled === true }] : [];
  });
}

export function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const text = entry.trim();
    return text ? [text] : [];
  });
}
