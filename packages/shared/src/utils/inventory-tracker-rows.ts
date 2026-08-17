// ──────────────────────────────────────────────
// Inventory Tracker row normalization
// ──────────────────────────────────────────────
// Shared by every path that writes the three Inventory Tracker arrays: the agent
// apply path on the server, the chat game-state route, the tracker panel and HUD
// edits, and the Agent Suite JSON editor. Keeping one implementation is the point
// — the agent path had these rules and the hand-edit paths did not, so a value the
// agent could never produce could still be typed in by hand.
//
// This module is deliberately standalone. It must not import tracker-field-locks
// or anything else from the package; exclusivity between the groups is a separate
// concern applied after normalization.
import type { InventoryTrackerRow } from "../types/game-state.js";

/** Longest tracked item name. Anything past this is truncated, not rejected. */
export const INVENTORY_TRACKER_MAX_NAME_LENGTH = 160;

/** Most rows kept per group. Extra rows are dropped from the end. */
export const INVENTORY_TRACKER_MAX_ROWS = 250;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keep a tracked quantity a finite safe integer.
 *
 * Without an upper bound, deduplicating two very large rows sums to `Infinity`,
 * which `JSON.stringify` writes as `null` — persisting a row whose qty can no
 * longer be read back as a number.
 */
export function clampInventoryTrackerQty(value: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.floor(value)));
}

/** Canonical stored form of a tracked name: NFKC, collapsed whitespace, trimmed, capped. */
export function normalizeInventoryTrackerName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, INVENTORY_TRACKER_MAX_NAME_LENGTH);
}

/**
 * Repair an arbitrary value into storable rows.
 *
 * Lossy by design: rows without a usable name are dropped and same-name rows are
 * merged with summed quantities. Callers that need to tell a user their input was
 * malformed must validate first — see `findInvalidInventoryTrackerRow`.
 */
export function normalizeInventoryTrackerRows(value: unknown, options?: { merge?: boolean }): InventoryTrackerRow[] {
  if (!Array.isArray(value)) return [];
  const merge = options?.merge ?? true;

  const rows: InventoryTrackerRow[] = [];
  const indexByName = new Map<string, number>();
  for (const candidate of value) {
    if (!isPlainRecord(candidate)) continue;
    const name = normalizeInventoryTrackerName(candidate.name);
    if (!name) continue;
    const key = name.toLocaleLowerCase("en-US");
    const numericQty = Number(candidate.qty);
    const qty = Number.isFinite(numericQty) ? clampInventoryTrackerQty(numericQty) : 1;
    const existingIndex = merge ? indexByName.get(key) : undefined;
    if (existingIndex !== undefined) {
      const existing = rows[existingIndex]!;
      const combinedQty = clampInventoryTrackerQty((existing.qty ?? 1) + qty);
      rows[existingIndex] = combinedQty > 1 ? { ...existing, qty: combinedQty } : existing;
      continue;
    }
    indexByName.set(key, rows.length);
    rows.push(qty > 1 ? { name, qty } : { name });
  }
  return rows.slice(0, INVENTORY_TRACKER_MAX_ROWS);
}

/** Key used to decide whether two tracked rows name the same thing. */
export function inventoryTrackerComparableName(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ")
    : "";
}

/**
 * The exclusivity rule, in one place: an item that is equipped or counted as money is
 * not also sitting in the backpack.
 *
 * Note this is a one-way filter, not three-way exclusivity — currencies and equipped
 * may still name the same thing. That is pre-existing behaviour, kept deliberately so
 * this change does not quietly start deleting equipped rows.
 */
export function excludeInventoryTrackerCarriedDuplicates(
  carried: readonly InventoryTrackerRow[],
  currencies: readonly InventoryTrackerRow[],
  equipped: readonly InventoryTrackerRow[],
): InventoryTrackerRow[] {
  if (carried.length === 0 || (currencies.length === 0 && equipped.length === 0)) return [...carried];
  const excluded = new Set([...currencies, ...equipped].map((row) => inventoryTrackerComparableName(row?.name)));
  return carried.filter((row) => !excluded.has(inventoryTrackerComparableName(row?.name)));
}

/** Rows to use for a group nobody is rewriting. Never trusts the stored value's shape. */
function existingRows(value: unknown): InventoryTrackerRow[] {
  return Array.isArray(value) ? (value as InventoryTrackerRow[]) : [];
}

/**
 * Repair the three Inventory Tracker arrays on an arbitrary `playerStats` payload,
 * leaving every other field untouched.
 *
 * Presence is decided by whether the key is there, not by whether its value happens to
 * be an array — a key sent as `{}` or `"nope"` is a malformed write to repair, while a
 * key that was never sent must stay absent. Conflating the two both crashed on the
 * malformed value and risked turning "the caller did not mention currencies" into "the
 * caller cleared currencies", the failure mode #5117 fixed on the agent path.
 *
 * Returns `unknown` deliberately: names, quantities and array identity all change, so
 * promising to hand back the caller's exact input type would be a lie.
 */
export function normalizeInventoryTrackerPlayerStats(playerStats: unknown): unknown {
  if (!isPlainRecord(playerStats)) return playerStats;

  const hasCurrencies = "inventoryTrackerCurrencies" in playerStats;
  const hasEquipped = "inventoryTrackerEquipped" in playerStats;
  const hasCarried = "inventoryTrackerInventory" in playerStats;
  if (!hasCurrencies && !hasEquipped && !hasCarried) return playerStats;

  const currencies = hasCurrencies
    ? normalizeInventoryTrackerRows(playerStats.inventoryTrackerCurrencies)
    : existingRows(playerStats.inventoryTrackerCurrencies);
  const equipped = hasEquipped
    ? normalizeInventoryTrackerRows(playerStats.inventoryTrackerEquipped)
    : existingRows(playerStats.inventoryTrackerEquipped);
  const carried = hasCarried
    ? normalizeInventoryTrackerRows(playerStats.inventoryTrackerInventory)
    : existingRows(playerStats.inventoryTrackerInventory);

  const next: Record<string, unknown> = { ...playerStats };
  if (hasCurrencies) next.inventoryTrackerCurrencies = currencies;
  if (hasEquipped) next.inventoryTrackerEquipped = equipped;

  const deduped = excludeInventoryTrackerCarriedDuplicates(carried, currencies, equipped);
  // Write carried back when the caller sent it, and also when exclusivity removed a
  // row from a group the caller did not send — omitting it would persist the duplicate.
  if (hasCarried || deduped.length !== carried.length) next.inventoryTrackerInventory = deduped;

  return next;
}

/**
 * Describe the first row a human would consider malformed, or `null` when the whole
 * array is usable.
 *
 * Exists because `normalizeInventoryTrackerRows` silently discards junk, which is the
 * right behaviour for an inline edit and the wrong behaviour for a JSON editor where
 * quietly emptying a hand-written group looks like data loss.
 */
export function findInvalidInventoryTrackerRow(value: unknown): string | null {
  if (!Array.isArray(value)) return "must be an array";
  for (const [index, candidate] of value.entries()) {
    if (!isPlainRecord(candidate)) return `row ${index} must be an object`;
    if (typeof candidate.name !== "string") return `row ${index} is missing a string "name"`;
    if (!normalizeInventoryTrackerName(candidate.name)) return `row ${index} has an empty "name"`;
    if (candidate.qty === undefined || candidate.qty === null) continue;
    const numericQty = Number(candidate.qty);
    if (!Number.isFinite(numericQty)) return `row ${index} has a non-numeric "qty"`;
    if (numericQty < 1) return `row ${index} has a "qty" below 1`;
  }
  return null;
}
