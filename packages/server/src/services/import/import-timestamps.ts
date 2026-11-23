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

  // `new Date()` reads almost anything as some date ("12" and "user 2" become 2001), so only strings that look
  // like a real date and time go to it.
  if (looksLikeDateTime(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
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

/** ISO 8601 ("2025-03-01", "2025-03-01T12:00:00Z") */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?)?(?: ?(?:z|utc|gmt|[+-]\d{2}(?::?\d{2})?))?$/iu;
const MONTH_NAME = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?![a-z])/iu;

/**
 * Whether a string looks like a written date: ISO 8601, or a month name with a four-digit year (RFC 2822,
 * JavaScript's own Date.toString(), "March 1, 2025"). Bare numbers and words with a number in them are not.
 */
function looksLikeDateTime(raw: string): boolean {
  if (ISO_DATE_TIME.test(raw)) return true;
  return MONTH_NAME.test(raw) && /(?:^|\D)\d{4}(?:\D|$)/u.test(raw);
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
