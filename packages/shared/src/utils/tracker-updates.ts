import { inventoryTrackerComparableName } from "./inventory-tracker-rows.js";
import { normalizeTextForMatch } from "./text-matching.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Character Tracker ids written by a model drift between runs: "Garrick Thum", "garrick_thum", "garrick-thum".
 * This folds them (and a display name) to one comparable form: lower case, letters and digits only.
 */
export function trackerIdentitySlug(value: unknown): string {
  return normalizeTextForMatch(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * The one row a drifted character id means: a row whose id folds to the same slug, or whose name does when the
 * update names nobody else. Returns -1 for none and -2 when several rows qualify.
 */
export function findTrackerCharacterRowByDriftedId(
  rows: readonly Record<string, unknown>[],
  id: unknown,
  name: unknown,
  isAvailable: (row: Record<string, unknown>, index: number) => boolean = () => true,
): number {
  const slug = trackerIdentitySlug(id);
  if (!slug) return -1;
  const nameKey = normalizeTextForMatch(name);
  const matches = rows.flatMap((row, index) => {
    if (!isAvailable(row, index)) return [];
    if (trackerIdentitySlug(row.characterId) === slug) return [index];
    // An id that is the row's name counts only when the update doesn't name someone else (#9541).
    const sameName = !nameKey || normalizeTextForMatch(row.name) === nameKey;
    return sameName && trackerIdentitySlug(row.name) === slug ? [index] : [];
  });
  return matches.length > 1 ? -2 : (matches[0] ?? -1);
}

export function isNamedTrackerRow(value: unknown): value is Record<string, unknown> & { name: string } {
  return isRecord(value) && typeof value.name === "string" && value.name.trim().length > 0;
}

export function isTrackerRowsUpdate(value: unknown): value is { updates?: unknown[]; removed?: unknown[] } {
  return (
    isRecord(value) &&
    ("updates" in value || "removed" in value) &&
    (value.updates === undefined || Array.isArray(value.updates)) &&
    (value.removed === undefined || Array.isArray(value.removed))
  );
}

/** Arrays retain their legacy meaning; explicit updates preserve every omitted row/property. */
export function resolveTrackerRowsUpdate(
  value: unknown,
  previous: readonly unknown[],
  identity: "name" | "characterId" = "name",
  canRemove: (row: Record<string, unknown>, index: number) => boolean = () => true,
): Record<string, unknown>[] | undefined {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (!isTrackerRowsUpdate(value)) return undefined;
  const rows = previous.filter(isRecord).map((row) => ({ ...row }));
  // Replacements keep these original identities stable for the entire batch.
  const identityRows = [...rows];
  const findNamed = (name: unknown) => {
    const key = inventoryTrackerComparableName(name);
    if (!key) return -1;
    const matches = identityRows.flatMap((row, index) =>
      inventoryTrackerComparableName(row.name) === key ? [index] : [],
    );
    return matches.length > 1 ? -2 : (matches[0] ?? -1);
  };
  const findId = (id: string, name: unknown = "") => {
    const matches = identityRows.flatMap((row, index) => (row.characterId === id ? [index] : []));
    if (matches.length > 0) return matches.length > 1 ? -2 : matches[0]!;
    // A model may write the same character's id differently on each run (#9541).
    return findTrackerCharacterRowByDriftedId(identityRows, id, name);
  };

  // Resolve references and removal permission before updates can change their identity or locks.
  const removed = new Set<number>();
  for (const reference of value.removed ?? []) {
    if (typeof reference !== "string" || !reference.trim()) continue;
    const byId = identity === "characterId" ? findId(reference.trim()) : -1;
    const index = byId !== -1 ? byId : findNamed(reference);
    if (index >= 0 && canRemove(rows[index]!, index)) removed.add(index);
  }

  for (const raw of value.updates ?? []) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.characterId === "string" ? raw.characterId.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name && !(identity === "characterId" && id)) continue;
    const index = identity === "characterId" && id ? findId(id, name) : findNamed(name);
    if (index === -2) continue;
    // An unknown ID must not silently replace another character with the same name.
    if (index < 0 && identity === "characterId" && (!name || (id && findNamed(name) !== -1))) continue;
    const current = index >= 0 ? rows[index]! : {};
    const next = { ...current, ...raw };
    if (typeof current.locked === "boolean") next.locked = current.locked;
    if (identity === "name") next.name = current.name ?? name;
    if (identity === "characterId") {
      // A stored row keeps its id, so a drifted id can't detach its locks and hidden fields (#9541).
      const storedId = typeof current.characterId === "string" ? current.characterId.trim() : "";
      if (storedId) next.characterId = current.characterId;
      else if (id) next.characterId = id;
      if (name) next.name = name;
      if (isRecord(raw.customFields)) {
        next.customFields = { ...(isRecord(current.customFields) ? current.customFields : {}), ...raw.customFields };
      }
      if (Array.isArray(raw.stats)) {
        next.stats = resolveTrackerRowsUpdate(
          { updates: raw.stats },
          Array.isArray(current.stats) ? current.stats : [],
        );
      }
    }
    if (index >= 0) rows[index] = next;
    else {
      rows.push(next);
      identityRows.push(next);
    }
  }
  return rows.filter((_row, index) => !removed.has(index));
}
