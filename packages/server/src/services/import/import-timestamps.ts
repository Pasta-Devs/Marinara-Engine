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
  // A date in SillyTavern's shape that isn't a real time ("February 31", "1:99pm") stays unread rather than
  // letting `new Date()` roll it into another day.
  if (sillyTavern !== undefined) return sillyTavern;

  // `new Date()` reads almost anything as some date ("12" and "user 2" become 2001), so only strings that look
  // like a real date and time go to it.
  if (looksLikeDateTime(raw)) {
    const parsed = new Date(raw);
    // `new Date()` rolls an impossible day over ("2025-02-30" becomes March 2), so a written ISO day must survive.
    if (!Number.isNaN(parsed.getTime()) && isoDayExists(raw)) {
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

  if (
    Number.isNaN(legacyDate.getTime()) ||
    legacyDate.getDate() !== Number(day) ||
    legacyDate.getMonth() !== Number(month) - 1 ||
    legacyDate.getHours() !== Number(hour) ||
    legacyDate.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return legacyDate.toISOString();
}

/** ISO 8601 ("2025-03-01", "2025-03-01T12:00:00Z") */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?)?(?: ?(?:z|utc|gmt|[+-]\d{2}(?::?\d{2})?))?$/iu;
const MONTH_NAME =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?/iu;

/** False for an ISO date whose day doesn't exist in its month ("2025-02-30"); true for anything else. */
function isoDayExists(raw: string): boolean {
  const found = raw.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!found) return true;
  const [year, month, day] = [Number(found[1]), Number(found[2]), Number(found[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Whether a string looks like a written date: ISO 8601, or a month name with a four-digit year (RFC 2822,
 * JavaScript's own Date.toString(), "March 1, 2025"). Bare numbers and words with a number in them are not.
 */
function looksLikeDateTime(raw: string): boolean {
  if (ISO_DATE_TIME.test(raw)) return true;
  return MONTH_NAME.test(raw) && /(?:^|\D)\d{4}(?:\D|$)/u.test(raw);
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
function parseSillyTavernSendDate(raw: string): string | null | undefined {
  const found = raw
    .replace(/\s+/gu, " ")
    .match(/^([a-z]+)\.? (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?([ap])\.?m\.?)?$/iu);
  if (!found) return undefined;
  const [, monthName, day, year, hourText, minute, second, meridiem] = found;
  if (Number(minute) > 59 || Number(second ?? 0) > 59) return null;
  const lowerMonth = monthName!.toLowerCase();
  const month = ENGLISH_MONTHS.findIndex(
    (name) => name === lowerMonth || (lowerMonth.length >= 3 && name.startsWith(lowerMonth)),
  );
  if (month < 0) return undefined;
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

// Cards can claim any date; one before character cards existed or in the future is ignored.
const EARLIEST_CARD_DATE = "2015-01-01T00:00:00.000Z";
const CARD_DATE_FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

/**
 * The creation date a character card carries, if any: V3 `data.creation_date` (Unix seconds) or the
 * `create_date` SillyTavern writes beside the card (or inside `data`).
 */
export function cardCreationTimestamp(raw: Record<string, unknown>, nowMs = Date.now()): string | null {
  const data = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {};
  for (const value of [data.creation_date, raw.create_date, data.create_date]) {
    // V3 writes 0 when the date is unknown.
    if (value === 0 || value === "0") continue;
    const parsed = parseTrustedTimestamp(value);
    if (!parsed) continue;
    if (parsed < EARLIEST_CARD_DATE || Date.parse(parsed) > nowMs + CARD_DATE_FUTURE_SLACK_MS) continue;
    return parsed;
  }
  return null;
}

/**
 * Dates for a character made from an imported card. Created is when the card was made: its own creation
 * date, else the file's date sent with the upload, else now. Updated is always the import time, so every
 * card imported (or updated) in one go shows the same "Updated" time.
 */
export function characterCardImportTimestamps(
  raw: Record<string, unknown>,
  overrides?: TimestampOverrides | null,
  nowMs = Date.now(),
): { createdAt: string; updatedAt: string } {
  const updatedAt = new Date(nowMs).toISOString();
  const createdAt = cardCreationTimestamp(raw, nowMs) ?? normalizeTimestampOverrides(overrides)?.createdAt ?? updatedAt;
  return { createdAt: createdAt > updatedAt ? updatedAt : createdAt, updatedAt };
}
