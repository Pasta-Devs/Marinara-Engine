import type { InventoryTrackerItem, PlayerStats } from "../types/game-state.js";

/**
 * The three groups the Inventory Tracker agent maintains. They share a row shape,
 * so every merge, lock, and render path is written once and parameterized by group.
 */
export const INVENTORY_TRACKER_GROUPS = ["currencies", "equipped", "carried"] as const;

export type InventoryTrackerGroup = (typeof INVENTORY_TRACKER_GROUPS)[number];

/** Group → the `PlayerStats` array that stores it. */
export const INVENTORY_TRACKER_GROUP_FIELDS = {
  currencies: "inventoryTrackerCurrencies",
  equipped: "inventoryTrackerEquipped",
  carried: "inventoryTrackerCarried",
} as const satisfies Record<InventoryTrackerGroup, keyof PlayerStats>;

/** The agent writes `inventory` for carried items; the stored group is named `carried`. */
export const INVENTORY_TRACKER_GROUP_RESULT_KEYS = {
  currencies: "currencies",
  equipped: "equipped",
  carried: "inventory",
} as const satisfies Record<InventoryTrackerGroup, string>;

const INVENTORY_TRACKER_GROUP_PROMPT_LABELS: Record<InventoryTrackerGroup, string> = {
  currencies: "Currencies",
  equipped: "Equipped",
  carried: "Carried",
};

/**
 * Upper bound for a tracked quantity.
 *
 * Beyond this, arithmetic stops being exact and a sum can reach `Infinity`,
 * which `JSON.stringify` writes as `null` — silently corrupting the stored row.
 */
const MAX_INVENTORY_TRACKER_QUANTITY = Number.MAX_SAFE_INTEGER;

function clampQuantity(value: number): number {
  // The agent omits qty for single items and occasionally emits 0 for "none left";
  // a row that exists means at least one unit, so clamp rather than drop it.
  return Math.min(MAX_INVENTORY_TRACKER_QUANTITY, Math.max(1, Math.floor(value)));
}

/** Coerce any user- or agent-supplied quantity into a storable whole number >= 1. */
export function normalizeInventoryTrackerQuantity(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return 1;
  return clampQuantity(numeric);
}

function comparableName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

/**
 * Coerce raw agent output into storable rows: drop unnamed entries, clamp quantities,
 * and merge same-named rows so a model that lists an item twice cannot duplicate it.
 */
export function normalizeInventoryTrackerItems(value: unknown): InventoryTrackerItem[] {
  if (!Array.isArray(value)) return [];

  const items: InventoryTrackerItem[] = [];
  const indexByName = new Map<string, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    const qty = normalizeInventoryTrackerQuantity(record.qty ?? record.quantity);
    const existingIndex = indexByName.get(comparableName(name));
    if (existingIndex === undefined) {
      indexByName.set(comparableName(name), items.length);
      items.push({ name, qty });
      continue;
    }
    items[existingIndex]!.qty = clampQuantity(items[existingIndex]!.qty + qty);
  }
  return items;
}

/**
 * Read an Inventory Tracker agent result into per-group rows.
 *
 * Only groups the agent actually emitted are returned, so a dropped key means
 * "leave unchanged" instead of silently wiping that group — the failure mode that
 * made empty tracker output destructive before (#2370, #2724).
 */
export function parseInventoryTrackerResult(
  data: unknown,
): Partial<Record<InventoryTrackerGroup, InventoryTrackerItem[]>> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};

  const record = data as Record<string, unknown>;
  const groups: Partial<Record<InventoryTrackerGroup, InventoryTrackerItem[]>> = {};
  for (const group of INVENTORY_TRACKER_GROUPS) {
    const raw = record[INVENTORY_TRACKER_GROUP_RESULT_KEYS[group]];
    if (!Array.isArray(raw)) continue;
    groups[group] = normalizeInventoryTrackerItems(raw);
  }
  return groups;
}

function formatItemForPrompt(item: InventoryTrackerItem): string {
  return item.qty > 1 ? `${item.name} x${item.qty}` : item.name;
}

/**
 * Render the tracked groups as compact prompt lines, one per non-empty group:
 *
 *     Currencies: Silver coin x6
 *     Equipped: Family heirloom longsword, Hunting knife
 *     Carried: Billhook, Scavenged axe x2
 *
 * Returns an empty string when nothing is tracked, so callers can skip the block.
 */
export function formatInventoryTrackerForPrompt(playerStats: Partial<PlayerStats> | null | undefined): string {
  if (!playerStats) return "";

  const lines: string[] = [];
  for (const group of INVENTORY_TRACKER_GROUPS) {
    const items = normalizeInventoryTrackerItems(playerStats[INVENTORY_TRACKER_GROUP_FIELDS[group]]);
    if (items.length === 0) continue;
    lines.push(`${INVENTORY_TRACKER_GROUP_PROMPT_LABELS[group]}: ${items.map(formatItemForPrompt).join(", ")}`);
  }
  return lines.join("\n");
}
