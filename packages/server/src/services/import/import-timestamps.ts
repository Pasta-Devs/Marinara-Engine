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

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const legacy = raw.match(
    /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*@?\s*|\s+)(\d{1,2})h?\s*(\d{1,2})m?\s*(\d{1,2})s?(?:\s*(\d{1,3})ms?)?$/i,
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
