type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

function localDateParts(date: Date): ZonedDateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date),
  };
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function normalizePromptTimeZone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timeZone = value.trim();
  if (!timeZone || timeZone.length > 100) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return undefined;
  }
}

/** Conversation schedule overrides take precedence over the legacy per-chat browser timezone. */
export function resolveConversationTimeZone(metadata: Record<string, unknown>): string | undefined {
  return normalizePromptTimeZone(metadata.conversationTimeZone) ?? normalizePromptTimeZone(metadata.promptTimeZone);
}

export function getZonedDateParts(date: Date, timeZone?: string): ZonedDateParts {
  if (!timeZone) return localDateParts(date);

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

  const hour = Number(readPart(parts, "hour"));
  return {
    year: Number(readPart(parts, "year")),
    month: Number(readPart(parts, "month")),
    day: Number(readPart(parts, "day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(readPart(parts, "minute")),
    second: Number(readPart(parts, "second")),
    weekday: readPart(parts, "weekday"),
  };
}

export function toZonedWallClockDate(date: Date, timeZone?: string): Date {
  const parts = getZonedDateParts(date, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function zonedWallClockToInstant(
  desired: Pick<ZonedDateParts, "year" | "month" | "day" | "hour" | "minute" | "second">,
  timeZone?: string,
): Date {
  if (!timeZone) {
    return new Date(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  }
  const desiredUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getZonedDateParts(new Date(candidate), timeZone);
    const observedUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = desiredUtc - observedUtc;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

export function getZonedDayBounds(date: Date, timeZone?: string, dayOffset = 0): { start: Date; end: Date } {
  const parts = getZonedDateParts(date, timeZone);
  const calendarDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  const nextCalendarDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset + 1));
  const start = zonedWallClockToInstant(
    {
      year: calendarDay.getUTCFullYear(),
      month: calendarDay.getUTCMonth() + 1,
      day: calendarDay.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
  const nextStart = zonedWallClockToInstant(
    {
      year: nextCalendarDay.getUTCFullYear(),
      month: nextCalendarDay.getUTCMonth() + 1,
      day: nextCalendarDay.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
  return { start, end: new Date(nextStart.getTime() - 1) };
}

export function getZonedWeekdayName(date: Date, timeZone?: string): string {
  return getZonedDateParts(date, timeZone).weekday;
}

export function formatZonedConversationTime(date: Date, timeZone?: string): string {
  const parts = getZonedDateParts(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatZonedConversationDate(date: Date, timeZone?: string, rolloverHour = 0): string {
  const shifted = new Date(date.getTime() - rolloverHour * 3_600_000);
  const parts = getZonedDateParts(shifted, timeZone);
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.${parts.year}`;
}

export function zonedLogicalDateKey(date: Date, timeZone?: string, rolloverHour = 0): string {
  const shifted = new Date(date.getTime() - rolloverHour * 3_600_000);
  const parts = getZonedDateParts(shifted, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isSameZonedLogicalDay(a: Date, b: Date, timeZone?: string, rolloverHour = 0): boolean {
  return zonedLogicalDateKey(a, timeZone, rolloverHour) === zonedLogicalDateKey(b, timeZone, rolloverHour);
}
