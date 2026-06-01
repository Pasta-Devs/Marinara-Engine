import { systemClock } from "../core/clock";
import { createId } from "../core/ids";
import { readString } from "../shared/value-readers";

export { readString };

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseRecord(value: unknown): JsonRecord {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

export function stringArray(value: unknown): string[] {
  return parseArray(value).filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function readNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = readNumber(value, fallback);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function boolish(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
  }
  return fallback;
}

function orderValue(record: JsonRecord): number {
  return readNumber(record.sortOrder ?? record.order ?? record.injectionOrder, 0);
}

export function bySortOrder(a: JsonRecord, b: JsonRecord): number {
  const orderDiff = orderValue(a) - orderValue(b);
  if (orderDiff !== 0) return orderDiff;
  return readString(a.createdAt).localeCompare(readString(b.createdAt));
}

export function hiddenFromAi(message: JsonRecord): boolean {
  const extra = parseRecord(message.extra);
  return boolish(extra.hiddenFromAI ?? extra.hiddenFromAi, false);
}

export function newId(prefix: string): string {
  return createId(prefix);
}

export function nowIso(): string {
  return systemClock.nowIso();
}
