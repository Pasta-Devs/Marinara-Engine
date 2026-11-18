import { inventoryTrackerComparableName } from "./inventory-tracker-rows.js";
import { normalizeTextForMatch } from "./text-matching.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Prefix of the ids the server gives Character Tracker NPCs (#9541). No card behind them, so no sprites. */
export const TRACKER_NPC_ID_PREFIX = "npc-";

/** Game Mode's party NPC ids (`npc:<slug>`, `party-npc:<name>`): owned elsewhere, so the tracker leaves them as they are. */
export function isGamePartyNpcId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const id = value.trim();
  return id.startsWith("npc:") || id.startsWith("party-npc:");
}

/**
 * Character Tracker ids written by a model drift between runs: "Garrick Thum", "garrick_thum", "garrick-thum".
 * This folds them (and a display name) to one comparable form: lower case, letters and digits only.
 */
export function trackerIdentitySlug(value: unknown): string {
  return normalizeTextForMatch(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** How many of the model's own ids a tracker row remembers. */
export const TRACKER_ID_ALIAS_LIMIT = 5;
/** Longer model ids aren't remembered: they go back to the model with the row. */
export const TRACKER_ID_ALIAS_MAX_LENGTH = 80;

/**
 * The row's id aliases after the model called it `modelId` while the row keeps `keptId`: the model's id goes first,
 * duplicates and the kept id itself drop out, at most {@link TRACKER_ID_ALIAS_LIMIT}. Undefined when none are left.
 */
export function withTrackerIdAlias(aliases: unknown, modelId: unknown, keptId: unknown): string[] | undefined {
  const kept = typeof keptId === "string" ? keptId.trim().toLowerCase() : "";
  const id = typeof modelId === "string" ? modelId.trim() : "";
  const seen = new Set<string>([kept]);
  const next: string[] = [];
  for (const alias of [id, ...(Array.isArray(aliases) ? aliases : [])]) {
    if (typeof alias !== "string" || !alias.trim() || alias.trim().length > TRACKER_ID_ALIAS_MAX_LENGTH) continue;
    const key = alias.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(alias.trim());
  }
  return next.length > 0 ? next.slice(0, TRACKER_ID_ALIAS_LIMIT) : undefined;
}

/**
 * The one row a drifted character id means, by the strongest evidence first: a row whose id folds to the same slug,
 * then one that had that id before (an alias), then one whose name folds to it when the update names nobody else.
 * Returns -1 for none and -2 when several rows qualify at the same level.
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
  // Another row already carries the name this update gives.
  const namedElsewhere = (index: number) =>
    !!nameKey && rows.some((row, i) => i !== index && normalizeTextForMatch(row.name) === nameKey);
  const tiers: Array<(row: Record<string, unknown>, index: number) => boolean> = [
    (row) => trackerIdentitySlug(row.characterId) === slug,
    // An id the model used for this row before, e.g. copied from its previous output. It holds through a rename
    // ("the barkeep" learning her name is Mara), unless the new name belongs to another row.
    (row, index) =>
      Array.isArray(row.idAliases) &&
      row.idAliases.some((alias) => trackerIdentitySlug(alias) === slug) &&
      !namedElsewhere(index),
    // An id that is the row's name counts only when the update doesn't name someone else (#9541).
    (row) => (!nameKey || normalizeTextForMatch(row.name) === nameKey) && trackerIdentitySlug(row.name) === slug,
  ];
  for (const matchesTier of tiers) {
    const matches = rows.flatMap((row, index) => (isAvailable(row, index) && matchesTier(row, index) ? [index] : []));
    if (matches.length > 0) return matches.length > 1 ? -2 : matches[0]!;
  }
  return -1;
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
      // Remember the model's own id for a server-minted NPC row, so it is found again next time. Card, cast, manual
      // and Game Mode party rows have ids of their own and need none.
      if (index >= 0 && String(next.characterId ?? "").startsWith(TRACKER_NPC_ID_PREFIX)) {
        const aliases = withTrackerIdAlias(current.idAliases, id, next.characterId);
        if (aliases) next.idAliases = aliases;
        else delete next.idAliases;
      }
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
