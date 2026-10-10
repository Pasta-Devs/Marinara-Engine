/**
 * Small readers for the loosely-typed rows the omnibar gets back from queries.
 * They live in `lib/` so the entity-row and result builders do not have to
 * import from `components/`.
 */
export function readNamedRow(value: unknown) {
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string") return null;
  const name = "name" in value && typeof value.name === "string" ? value.name : value.id;
  return { id: value.id, name };
}

export function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const MEDIUM_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function formatDate(value: unknown) {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? MEDIUM_DATE_FORMATTER.format(date) : undefined;
}
