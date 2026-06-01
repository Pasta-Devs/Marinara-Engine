export type ChoiceSelections = Record<string, string | string[]>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeChoiceSelections(value: unknown): ChoiceSelections {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | string[]] =>
        typeof entry[1] === "string" || (Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string")),
    ),
  );
}
