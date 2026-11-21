import type { Stats } from "fs";

export interface TimestampOverrides {
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NormalizedTimestampOverrides {
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function parseTrustedTimestamp(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{10,}$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const normalized = raw.length <= 10 ? numeric * 1000 : numeric;
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
  }

  const sillyTavern = parseSillyTavernSendDate(raw);
  if (sillyTavern) return sillyTavern;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const normalizedLegacy = raw.replace(/\s+/gu, " ");
  const legacy = normalizedLegacy.match(
    /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,2}) ?@? ?(\d{1,2})h? ?(\d{1,2})m? ?(\d{1,2})s?(?: ?(\d{1,3})ms?)?$/i,
  );
  if (!legacy) return null;

  const [, year, month, day, hour, minute, second, ms] = legacy;
  const legacyDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms ?? 0),
  );

  return Number.isNaN(legacyDate.getTime()) ? null : legacyDate.toISOString();
}

const ENGLISH_MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * SillyTavern writes each message's `send_date` as moment's "MMMM D, YYYY h:mma" ("March 1, 2025 12:00pm"),
 * in the machine's local time. `new Date()` can't read the am/pm glued to the minutes, so without this every
 * imported message got the import time. Seconds ("12:00:05pm") and a 24-hour clock are read too.
 */
function parseSillyTavernSendDate(raw: string): string | null {
  const found = raw
    .replace(/\s+/gu, " ")
    .match(/^([a-z]+)\.? (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?([ap])\.?m\.?)?$/iu);
  if (!found) return null;
  const [, monthName, day, year, hourText, minute, second, meridiem] = found;
  const lowerMonth = monthName!.toLowerCase();
  const month = ENGLISH_MONTHS.findIndex(
    (name) => name === lowerMonth || (lowerMonth.length >= 3 && name.startsWith(lowerMonth)),
  );
  if (month < 0) return null;
  let hour = Number(hourText);
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const pm = meridiem.toLowerCase() === "p";
    hour = (hour % 12) + (pm ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  const date = new Date(Number(year), month, Number(day), hour, Number(minute), Number(second ?? 0));
  // Reject roll-overs such as "February 31".
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(day) || date.getMonth() !== month) return null;
  return date.toISOString();
}

export function normalizeTimestampOverrides(
  overrides?: TimestampOverrides | null,
): NormalizedTimestampOverrides | undefined {
  if (!overrides) return undefined;

  const createdAt = parseTrustedTimestamp(overrides.createdAt);
  const updatedAt = parseTrustedTimestamp(overrides.updatedAt);

  if (!createdAt && !updatedAt) return undefined;

  return {
    createdAt: createdAt ?? updatedAt ?? null,
    updatedAt: updatedAt ?? createdAt ?? null,
  };
}

export function getFileTimestampOverrides(fileStat: Stats): TimestampOverrides | undefined {
  const modifiedAt = parseTrustedTimestamp(fileStat.mtime);
  if (!modifiedAt) return undefined;
  return { createdAt: modifiedAt, updatedAt: modifiedAt };
}

export function latestTrustedTimestamp(values: Array<unknown>): string | null {
  const normalized = values
    .map((value) => parseTrustedTimestamp(value))
    .filter((value): value is string => !!value)
    .sort((a, b) => a.localeCompare(b));

  return normalized.at(-1) ?? null;
}

/** Keep live records in creation order when the clock has not advanced a millisecond. */
export function ensureTimestampAfter(candidate: unknown, previous: unknown): string {
  const normalizedCandidate = parseTrustedTimestamp(candidate) ?? new Date().toISOString();
  const normalizedPrevious = parseTrustedTimestamp(previous);
  if (!normalizedPrevious || normalizedCandidate > normalizedPrevious) return normalizedCandidate;
  return new Date(new Date(normalizedPrevious).getTime() + 1).toISOString();
}
