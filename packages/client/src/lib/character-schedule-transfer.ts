import {
  CONVERSATION_SCHEDULE_DAYS,
  type ConversationMessageIntent,
  type ConversationPresenceStatus,
  type ScheduleBlock,
  type WeekSchedule,
} from "@marinara-engine/shared";

export const CHARACTER_SCHEDULE_EXPORT_KIND = "marinara.character-schedule";
export const CHARACTER_SCHEDULE_EXPORT_VERSION = 1;
export const MAX_CHARACTER_SCHEDULE_FILE_SIZE = 1024 * 1024;

const PRESENCE_STATUSES = new Set<ConversationPresenceStatus>(["online", "idle", "dnd", "offline"]);
const MESSAGE_INTENTS = new Set<ConversationMessageIntent>([
  "check_in",
  "long_absence_check_in",
  "came_back_online",
  "after_busy",
  "good_morning",
  "good_night",
  "meal_break",
  "transition_ping",
]);

export type CharacterScheduleImportFailure = "invalid" | "unsupported-version";

export type CharacterScheduleImportResult =
  | { ok: true; schedule: WeekSchedule; format: "current" | "legacy" }
  | { ok: false; reason: CharacterScheduleImportFailure };

export function getCurrentMondayIso(now = new Date()): string {
  const date = new Date(now);
  const diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function createCharacterScheduleExport(schedule: WeekSchedule, characterName?: string) {
  return {
    kind: CHARACTER_SCHEDULE_EXPORT_KIND,
    version: CHARACTER_SCHEDULE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(characterName?.trim() ? { characterName: characterName.trim() } : {}),
    schedule: cloneSchedule(schedule),
  };
}

export function parseCharacterScheduleImport(
  value: unknown,
  currentWeekStart = getCurrentMondayIso(),
): CharacterScheduleImportResult {
  if (!isRecord(value)) return { ok: false, reason: "invalid" };

  let format: "current" | "legacy" = "legacy";
  let source: unknown = value;
  if ("kind" in value || "version" in value || "schedule" in value) {
    if (value.kind !== CHARACTER_SCHEDULE_EXPORT_KIND || value.version !== CHARACTER_SCHEDULE_EXPORT_VERSION) {
      return {
        ok: false,
        reason:
          value.kind === CHARACTER_SCHEDULE_EXPORT_KIND && typeof value.version === "number"
            ? "unsupported-version"
            : "invalid",
      };
    }
    format = "current";
    source = value.schedule;
  }

  const schedule = normalizeSchedule(source, currentWeekStart);
  return schedule ? { ok: true, schedule, format } : { ok: false, reason: "invalid" };
}

function normalizeSchedule(value: unknown, currentWeekStart: string): WeekSchedule | null {
  if (!isRecord(value) || !isRecord(value.days)) return null;
  if (!isValidNumber(value.inactivityThresholdMinutes, 15, 360)) return null;
  if (!isValidNumber(value.talkativeness, 0, 100)) return null;
  if (!isOptionalNumber(value.idleResponseDelayMinutes, 0, 120)) return null;
  if (!isOptionalNumber(value.dndResponseDelayMinutes, 0, 120)) return null;
  if (!isOptionalCap(value.autonomousDailyCapOverride)) return null;
  if (!isOptionalString(value.routineSummary) || !isOptionalString(value.routineSummaryGeneratedAt)) return null;

  const days: Record<string, ScheduleBlock[]> = {};
  for (const day of CONVERSATION_SCHEDULE_DAYS) {
    const blocks = value.days[day];
    if (blocks !== undefined && !Array.isArray(blocks)) return null;
    const normalizedBlocks: ScheduleBlock[] = [];
    for (const block of blocks ?? []) {
      const normalized = normalizeBlock(block);
      if (!normalized) return null;
      normalizedBlocks.push(normalized);
    }
    days[day] = normalizedBlocks;
  }

  const disabledAutonomousIntents = normalizeMessageIntents(value.disabledAutonomousIntents);
  if (disabledAutonomousIntents === null) return null;

  return {
    weekStart: currentWeekStart,
    days,
    inactivityThresholdMinutes: value.inactivityThresholdMinutes,
    talkativeness: value.talkativeness,
    ...(typeof value.idleResponseDelayMinutes === "number"
      ? { idleResponseDelayMinutes: value.idleResponseDelayMinutes }
      : {}),
    ...(typeof value.dndResponseDelayMinutes === "number"
      ? { dndResponseDelayMinutes: value.dndResponseDelayMinutes }
      : {}),
    ...(value.autonomousDailyCapOverride === null || typeof value.autonomousDailyCapOverride === "number"
      ? { autonomousDailyCapOverride: value.autonomousDailyCapOverride }
      : {}),
    ...(value.routineSummary === null || typeof value.routineSummary === "string"
      ? { routineSummary: value.routineSummary }
      : {}),
    ...(value.routineSummaryGeneratedAt === null || typeof value.routineSummaryGeneratedAt === "string"
      ? { routineSummaryGeneratedAt: value.routineSummaryGeneratedAt }
      : {}),
    ...(disabledAutonomousIntents.length > 0 ? { disabledAutonomousIntents } : {}),
  };
}

function normalizeBlock(value: unknown): ScheduleBlock | null {
  if (!isRecord(value) || typeof value.time !== "string" || typeof value.activity !== "string") return null;
  if (!PRESENCE_STATUSES.has(value.status as ConversationPresenceStatus)) return null;
  return { time: value.time, activity: value.activity, status: value.status as ConversationPresenceStatus };
}

function normalizeMessageIntents(value: unknown): ConversationMessageIntent[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const intents = new Set<ConversationMessageIntent>();
  for (const intent of value) {
    if (!MESSAGE_INTENTS.has(intent as ConversationMessageIntent)) return null;
    intents.add(intent as ConversationMessageIntent);
  }
  return Array.from(intents);
}

function cloneSchedule(schedule: WeekSchedule): WeekSchedule {
  return {
    ...schedule,
    days: Object.fromEntries(
      CONVERSATION_SCHEDULE_DAYS.map((day) => [day, (schedule.days[day] ?? []).map((block) => ({ ...block }))]),
    ),
    ...(schedule.disabledAutonomousIntents
      ? { disabledAutonomousIntents: [...schedule.disabledAutonomousIntents] }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isOptionalNumber(value: unknown, min: number, max: number): boolean {
  return value === undefined || isValidNumber(value, min, max);
}

function isOptionalCap(value: unknown): boolean {
  return value === undefined || value === null || (isValidNumber(value, 1, 8) && Number.isInteger(value));
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}
