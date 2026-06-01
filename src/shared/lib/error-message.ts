function hasMessage(value: unknown): value is { message: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string" &&
    (value as { message: string }).message.length > 0
  );
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return hasMessage(error) ? error.message : fallback;
}
