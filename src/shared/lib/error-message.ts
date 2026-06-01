function hasMessage(value: unknown): value is { message: string } {
  if (!value || typeof value !== "object" || !("message" in value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.message === "string" && candidate.message.length > 0;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return hasMessage(error) ? error.message : fallback;
}
