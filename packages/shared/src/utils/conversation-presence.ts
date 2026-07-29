// ──────────────────────────────────────────────
// Conversation Presence — schedule/override status derivation
// ──────────────────────────────────────────────
// Pure helpers shared by the server (schedule service, generation, autonomous
// scheduler, status route) and the client (chat list + in-chat presence dots)
// so every surface derives a character's current conversation status the same
// way: active manual override > current schedule block > "online" default.

import type { ConversationPresenceStatus, ConversationStatusOverride } from "../types/chat.js";

// ── Types ──

/** A single time block in a character's daily schedule */
export interface ScheduleBlock {
  /** Hour range, e.g. "06:00-08:00" */
  time: string;
  /** What the character is doing */
  activity: string;
  /** Derived status for this block */
  status: ConversationPresenceStatus;
}

/** One day of a character's schedule */
export type DaySchedule = ScheduleBlock[];

export type ConversationMessageIntent =
  | "check_in"
  | "long_absence_check_in"
  | "came_back_online"
  | "after_busy"
  | "good_morning"
  | "good_night"
  | "meal_break"
  | "transition_ping";

/** Full weekly schedule for a character */
export interface WeekSchedule {
  /** ISO date string of the Monday this schedule starts */
  weekStart: string;
  /** Schedules keyed by day name */
  days: Record<string, DaySchedule>;
  /** How many minutes of user inactivity before this character messages unprompted (0 = never) */
  inactivityThresholdMinutes: number;
  /** Optional exact response delay in minutes while idle */
  idleResponseDelayMinutes?: number;
  /** Optional exact response delay in minutes while busy / DND */
  dndResponseDelayMinutes?: number;
  /** Optional per-character daily autonomous check-in cap. Chat caps can still lower this ceiling. */
  autonomousDailyCapOverride?: number | null;
  /** Optional generated profile text that summarizes this character's weekly routine. */
  routineSummary?: string | null;
  /** ISO timestamp for the generated routine summary. */
  routineSummaryGeneratedAt?: string | null;
  /** Optional special autonomous message reasons this routine should not use. */
  disabledAutonomousIntents?: ConversationMessageIntent[];
  /** How chatty the character is — affects autonomous messaging frequency (0-100) */
  talkativeness: number;
}

/** All character schedules stored in chat metadata */
export interface CharacterSchedules {
  [characterId: string]: WeekSchedule;
}

export interface CurrentConversationStatus {
  status: ConversationPresenceStatus;
  activity: string;
  override?: ConversationStatusOverride;
}

export interface AdjacentScheduleBlocks {
  previous: ScheduleBlock | null;
  current: ScheduleBlock | null;
  next: ScheduleBlock | null;
}

// ── Constants ──

/** Schedule day order, Monday-first to match getDay() remapping below. */
export const CONVERSATION_SCHEDULE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Re-express an instant as a local wall-clock Date in an IANA timezone.
 * This lets schedule code keep using Date's weekday/hour accessors without
 * tying evaluation to the browser or server host timezone.
 */
export function toConversationScheduleWallClockDate(date: Date, timeZone?: string): Date {
  if (!timeZone) return date;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const readPart = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const hour = readPart("hour");
    return new Date(
      readPart("year"),
      readPart("month") - 1,
      readPart("day"),
      hour === 24 ? 0 : hour,
      readPart("minute"),
      readPart("second"),
    );
  } catch {
    return date;
  }
}

// ── Status Derivation ──

function parseScheduleBlockMinutes(block: ScheduleBlock): { start: number; end: number } | null {
  if (!block || typeof block.time !== "string") return null;
  const [startStr, endStr] = block.time.split("-");
  if (!startStr || !endStr) return null;
  const [shRaw, smRaw] = startStr.split(":");
  const [ehRaw, emRaw] = endStr.split(":");
  const sh = Number(shRaw);
  const sm = Number(smRaw);
  const eh = Number(ehRaw);
  const em = Number(emRaw);
  if (
    !Number.isInteger(sh) ||
    !Number.isInteger(sm) ||
    !Number.isInteger(eh) ||
    !Number.isInteger(em) ||
    sh < 0 ||
    sh > 23 ||
    eh < 0 ||
    eh > 23 ||
    sm < 0 ||
    sm > 59 ||
    em < 0 ||
    em > 59
  ) {
    return null;
  }
  return { start: sh * 60 + sm, end: eh * 60 + em };
}

/**
 * Resolve the blocks immediately around a wall-clock instant. A range that
 * crosses midnight belongs to the named day on which it starts, so Monday
 * 02:00 can resolve Sunday's 23:00-07:00 block but not Monday's night block.
 */
export function getAdjacentScheduleBlocks(
  schedule: WeekSchedule,
  now: Date = new Date(),
): AdjacentScheduleBlocks {
  const todayIndex = (now.getDay() + 6) % 7;
  const todayName = CONVERSATION_SCHEDULE_DAYS[todayIndex]!;
  const yesterdayName = CONVERSATION_SCHEDULE_DAYS[(todayIndex + 6) % 7]!;
  const tomorrowName = CONVERSATION_SCHEDULE_DAYS[(todayIndex + 1) % 7]!;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const candidates: Array<{ block: ScheduleBlock; start: number; end: number }> = [];
  const addBlocks = (blocks: ScheduleBlock[] | undefined, dayOffset: number) => {
    for (const block of blocks ?? []) {
      const range = parseScheduleBlockMinutes(block);
      if (!range) continue;
      const start = dayOffset * 1440 + range.start;
      let end = dayOffset * 1440 + range.end;
      if (range.end <= range.start) end += 1440;
      candidates.push({ block, start, end });
    }
  };

  addBlocks(schedule.days[yesterdayName], -1);
  addBlocks(schedule.days[todayName], 0);
  addBlocks(schedule.days[tomorrowName], 1);
  candidates.sort((a, b) => a.start - b.start);

  let previous: ScheduleBlock | null = null;
  let current: ScheduleBlock | null = null;
  let next: ScheduleBlock | null = null;
  for (const candidate of candidates) {
    if (candidate.start <= currentMinutes && currentMinutes < candidate.end) {
      current = candidate.block;
      continue;
    }
    if (candidate.end <= currentMinutes) {
      previous = candidate.block;
      continue;
    }
    if (!next && candidate.start > currentMinutes) {
      next = candidate.block;
    }
  }

  return { previous, current, next };
}

/**
 * Get the current status and activity for a character based on their schedule.
 */
export function getCurrentStatus(
  schedule: WeekSchedule,
  now: Date = new Date(),
): { status: ConversationPresenceStatus; activity: string } {
  const current = getAdjacentScheduleBlocks(schedule, now).current;
  if (current) return { status: current.status, activity: current.activity };

  return { status: "online", activity: "free time" };
}

function isManualPresenceStatus(value: unknown): value is ConversationStatusOverride["status"] {
  return value === "online" || value === "idle" || value === "dnd" || value === "offline";
}

export function getActiveStatusOverride(
  override: ConversationStatusOverride | null | undefined,
  now: Date = new Date(),
): ConversationStatusOverride | null {
  if (!override || !isManualPresenceStatus(override.status)) return null;
  if (typeof override.expiresAt === "string") {
    const expiresAt = new Date(override.expiresAt).getTime();
    if (!override.expiresAt.trim() || !Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null;
  }
  return override;
}

export function getEffectiveCurrentStatus(
  schedule: WeekSchedule | null | undefined,
  override: ConversationStatusOverride | null | undefined,
  now: Date = new Date(),
  fallbackActivity = "free time",
  scheduleNow: Date = now,
): CurrentConversationStatus {
  const scheduled = schedule
    ? getCurrentStatus(schedule, scheduleNow)
    : { status: "online" as const, activity: fallbackActivity };
  const activeOverride = getActiveStatusOverride(override, now);
  if (!activeOverride) return scheduled;
  const activity = typeof activeOverride.activity === "string" ? activeOverride.activity.trim() : scheduled.activity;
  return { status: activeOverride.status, activity, override: activeOverride };
}
