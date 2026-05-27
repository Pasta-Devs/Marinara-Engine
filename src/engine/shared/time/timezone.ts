// ──────────────────────────────────────────────
// Zoned-time helpers for prompt assembly
//
// Refactor parity with the pre-rewrite generation flow, which propagated the
// user's IANA timezone (`userTimeZone`) from the client into every prompt so
// {{date}} / {{time}} / {{datetime}} / {{weekday}} resolve in the user's local
// frame rather than UTC. A per-chat `promptTimeZone` override may take
// precedence over the live browser value when persisted on chat metadata.
// ──────────────────────────────────────────────

const MAX_TIMEZONE_LENGTH = 100;

export function normalizeUserTimeZone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timeZone = value.trim();
  if (!timeZone || timeZone.length > MAX_TIMEZONE_LENGTH) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return undefined;
  }
}

interface ZonedDateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  weekday: string;
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getZonedDateParts(date: Date, timeZone?: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
  }).formatToParts(date);
  const hour = readPart(parts, "hour");
  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hour: hour === "24" ? "00" : hour,
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second"),
    weekday: readPart(parts, "weekday"),
  };
}

export function formatZonedDate(date: Date, timeZone?: string): string {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatZonedTime(date: Date, timeZone?: string): string {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function formatZonedIsoDateTime(date: Date, timeZone?: string): string {
  // Keep the no-zone fallback consistent with formatZonedDate and
  // formatZonedTime, which delegate to Intl with `timeZone: undefined` (i.e.
  // host-local). Falling back to `date.toISOString()` here would resolve in
  // UTC, splitting {{datetime}} away from {{date}}/{{time}} for any caller
  // that doesn't explicitly thread a zone.
  const parts = getZonedDateParts(date, timeZone);
  const offsetMinutes = timeZone ? zonedOffsetMinutes(date, timeZone) : -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const offsetMins = String(absMinutes % 60).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offsetHours}:${offsetMins}`;
}

export function getZonedWeekdayName(date: Date, timeZone?: string): string {
  return getZonedDateParts(date, timeZone).weekday;
}

function zonedOffsetMinutes(date: Date, timeZone: string): number {
  const utcParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const toEpochMinutes = (parts: Intl.DateTimeFormatPart[]) => {
    const year = Number(readPart(parts, "year"));
    const month = Number(readPart(parts, "month"));
    const day = Number(readPart(parts, "day"));
    const hour = Number(readPart(parts, "hour"));
    const minute = Number(readPart(parts, "minute"));
    return Date.UTC(year, month - 1, day, hour === 24 ? 0 : hour, minute) / 60_000;
  };
  return toEpochMinutes(localParts) - toEpochMinutes(utcParts);
}
