import type { WorldCustomField } from "../types/game-state.js";
import { normalizeIconNameFormat } from "../utils/icon-name-format.js";

export const DEFAULT_WORLD_CUSTOM_FIELD_ICON = "tag";

export const SUPPORTED_WORLD_CUSTOM_FIELD_ICONS = [
  "activity",
  "anchor",
  "backpack",
  "bed",
  "beer",
  "book-open",
  "building-2",
  "calendar-days",
  "car",
  "castle",
  "church",
  "clock",
  "cloud",
  "cloud-rain",
  "coffee",
  "coins",
  "compass",
  "crown",
  "drama",
  "eye",
  "factory",
  "flame",
  "gem",
  "heart",
  "home",
  "hospital",
  "key",
  "landmark",
  "lock",
  "map-pin",
  "moon",
  "mountain",
  "music",
  "package",
  "plane",
  "sailboat",
  "school",
  "scroll",
  "shield",
  "ship",
  "skull",
  "smile",
  "snowflake",
  "sparkles",
  "stars",
  "store",
  "sun",
  "sword",
  "swords",
  "tag",
  "tent",
  "thermometer",
  "train",
  "tree-pine",
  "trees",
  "umbrella",
  "user",
  "users",
  "utensils",
  "venetian-mask",
  "warehouse",
  "waves",
  "wind",
  "zap",
] as const;

export type SupportedWorldCustomFieldIcon = (typeof SUPPORTED_WORLD_CUSTOM_FIELD_ICONS)[number];

const SUPPORTED_WORLD_CUSTOM_FIELD_ICON_SET = new Set<string>(SUPPORTED_WORLD_CUSTOM_FIELD_ICONS);

export function normalizeWorldCustomFieldIcon(value: unknown): SupportedWorldCustomFieldIcon | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeIconNameFormat(value);
  return SUPPORTED_WORLD_CUSTOM_FIELD_ICON_SET.has(normalized) ? (normalized as SupportedWorldCustomFieldIcon) : null;
}

export function normalizeWorldCustomFields(value: unknown): WorldCustomField[] {
  if (!Array.isArray(value)) return [];
  const fields: WorldCustomField[] = [];
  const seenNames = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    const comparableName = name.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
    if (seenNames.has(comparableName)) continue;
    seenNames.add(comparableName);
    const fieldValue =
      typeof record.value === "string" ? record.value : record.value == null ? "" : String(record.value);
    fields.push({
      name,
      value: fieldValue,
      icon: normalizeWorldCustomFieldIcon(record.icon) ?? DEFAULT_WORLD_CUSTOM_FIELD_ICON,
    });
  }
  return fields;
}
