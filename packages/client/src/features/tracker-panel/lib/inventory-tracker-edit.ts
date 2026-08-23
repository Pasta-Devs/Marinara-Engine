// ──────────────────────────────────────────────
// Inventory Tracker manual-edit invariant
// ──────────────────────────────────────────────
// The agent apply path normalizes rows and keeps equipped/currency items out of
// carried inventory. Hand edits from the tracker panel and the HUD popover used to
// skip all of it, so a value the agent could never emit could still be typed in.
//
// Editing one group can change two: equipping a carried item removes it from the
// backpack. That is why this returns a whole patch instead of one array — the caller
// must persist every field it produces, in one write.
import {
  excludeInventoryTrackerCarriedDuplicates,
  normalizeInventoryTrackerRows,
  type InventoryTrackerGroup,
  type InventoryTrackerRow,
  type PlayerStats,
} from "@marinara-engine/shared";

const FIELD_BY_GROUP = {
  currencies: "inventoryTrackerCurrencies",
  equipped: "inventoryTrackerEquipped",
  inventory: "inventoryTrackerInventory",
} as const satisfies Record<InventoryTrackerGroup, keyof PlayerStats>;

export type InventoryTrackerPatch = Pick<
  PlayerStats,
  "inventoryTrackerCurrencies" | "inventoryTrackerEquipped" | "inventoryTrackerInventory"
>;

/**
 * Build the `playerStats` patch for one edited group.
 *
 * Rows merge by name here exactly as they do on the server, so the optimistic store
 * cannot drift from what was persisted. Adding a row stays safe because the panel
 * gives each new placeholder a name no existing row has.
 */
export function buildInventoryTrackerEditPatch(
  currentPlayerStats: PlayerStats | null | undefined,
  group: InventoryTrackerGroup,
  rows: InventoryTrackerRow[],
): Partial<InventoryTrackerPatch> {
  const normalized = normalizeInventoryTrackerRows(rows);

  const currencies = group === "currencies" ? normalized : (currentPlayerStats?.inventoryTrackerCurrencies ?? []);
  const equipped = group === "equipped" ? normalized : (currentPlayerStats?.inventoryTrackerEquipped ?? []);
  const carried = group === "inventory" ? normalized : (currentPlayerStats?.inventoryTrackerInventory ?? []);

  const patch: Partial<InventoryTrackerPatch> = { [FIELD_BY_GROUP[group]]: normalized };

  const deduped = excludeInventoryTrackerCarriedDuplicates(carried, currencies, equipped);
  if (deduped.length !== carried.length) patch.inventoryTrackerInventory = deduped;

  return patch;
}
