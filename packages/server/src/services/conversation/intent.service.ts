import { blockDurationMinutes, getAdjacentBlocks, type ScheduleBlock, type WeekSchedule } from "./schedule.service.js";
import type { ConversationMessageIntent } from "@marinara-engine/shared";

export type MessageIntent = ConversationMessageIntent;

const INTENT_HINTS: Record<MessageIntent, string> = {
  check_in: "You have a free moment and feel like reaching out. The user has been quiet.",
  long_absence_check_in:
    "The user has been away for a long while. Send one warm, low-pressure check-in without sounding needy or escalating.",
  came_back_online: "You were unavailable earlier when the user wrote. You just became free and are getting back to them.",
  after_busy: "You just wrapped up a busy stretch. You have some breathing room now.",
  good_morning: "You just woke up and are starting your day. This is your first message of the morning.",
  good_night: "You are winding down for the night and checking in before you go offline.",
  meal_break: "You are on a short break - eating or stepping away briefly. A good moment to drop a quick message.",
  transition_ping: "You just moved from one thing to another and thought of the user.",
};

const MEAL_KEYWORDS = ["eating", "lunch", "dinner", "breakfast", "brunch", "meal", "food"];
const LONG_ABSENCE_MS = 18 * 60 * 60 * 1000;
const GOOD_NIGHT_WINDOW_MINUTES = 90;

const MESSAGE_INTENTS = new Set<MessageIntent>([
  "check_in",
  "long_absence_check_in",
  "came_back_online",
  "after_busy",
  "good_morning",
  "good_night",
  "meal_break",
  "transition_ping",
]);

const INTENT_COOLDOWNS_MS: Record<MessageIntent, number> = {
  check_in: 0,
  long_absence_check_in: 36 * 60 * 60 * 1000,
  came_back_online: 4 * 60 * 60 * 1000,
  after_busy: 3 * 60 * 60 * 1000,
  good_morning: 20 * 60 * 60 * 1000,
  good_night: 20 * 60 * 60 * 1000,
  meal_break: 3 * 60 * 60 * 1000,
  transition_ping: 2 * 60 * 60 * 1000,
};

function hasStatus(block: ScheduleBlock | null, status: ScheduleBlock["status"]): boolean {
  return block?.status === status;
}

function minutesUntilBlockStart(block: ScheduleBlock, now: Date): number {
  const [startStr] = block.time.split("-");
  if (!startStr) return Infinity;
  const [hourRaw, minuteRaw] = startStr.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Infinity;

  const startMinutes = hour * 60 + minute;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return startMinutes >= currentMinutes ? startMinutes - currentMinutes : 1440 - currentMinutes + startMinutes;
}

export function resolveIntent(
  schedule: WeekSchedule,
  msSinceUserLastSpoke: number,
  hadUnansweredUserMessage: boolean,
  now: Date = new Date(),
): MessageIntent {
  const { previous, current, next } = getAdjacentBlocks(schedule, now);
  const hour = now.getHours();

  if (!hadUnansweredUserMessage && msSinceUserLastSpoke >= LONG_ABSENCE_MS) {
    return "long_absence_check_in";
  }

  if (hadUnansweredUserMessage && hasStatus(previous, "offline") && current?.status !== "offline") {
    return "came_back_online";
  }

  if (hasStatus(previous, "offline") && current?.status !== "offline" && hour >= 5 && hour < 11) {
    return "good_morning";
  }

  if (
    next &&
    next.status === "offline" &&
    blockDurationMinutes(next) >= 360 &&
    minutesUntilBlockStart(next, now) <= GOOD_NIGHT_WINDOW_MINUTES
  ) {
    return "good_night";
  }

  if (hasStatus(previous, "dnd") && (current?.status === "online" || current?.status === "idle")) {
    return "after_busy";
  }

  if (
    current?.status === "idle" &&
    MEAL_KEYWORDS.some((keyword) => current.activity.toLowerCase().includes(keyword)) &&
    blockDurationMinutes(current) <= 90
  ) {
    return "meal_break";
  }

  if (previous && current && previous.status !== current.status) {
    return "transition_ping";
  }

  return "check_in";
}

export function getIntentHint(intent: MessageIntent): string {
  return INTENT_HINTS[intent];
}

export function isMessageIntent(value: string): value is MessageIntent {
  return MESSAGE_INTENTS.has(value as MessageIntent);
}

export function getIntentCooldowns(
  chatMeta: Record<string, unknown>,
  characterId: string,
): Record<string, string> {
  const all = chatMeta.intentCooldowns as Record<string, Record<string, string>> | undefined;
  return all?.[characterId] ?? {};
}

export function isIntentOnCooldown(
  chatMeta: Record<string, unknown>,
  characterId: string,
  intent: MessageIntent,
  now = Date.now(),
): boolean {
  const cooldownMs = INTENT_COOLDOWNS_MS[intent];
  if (!cooldownMs) return false;
  const cooldowns = getIntentCooldowns(chatMeta, characterId);
  const lastFired = cooldowns[intent];
  if (!lastFired) return false;
  return now - new Date(lastFired).getTime() < cooldownMs;
}

export function buildIntentCooldownPatch(
  chatMeta: Record<string, unknown>,
  characterId: string,
  intent: MessageIntent,
  now: Date = new Date(),
): { intentCooldowns: Record<string, Record<string, string>> } {
  const all = (chatMeta.intentCooldowns as Record<string, Record<string, string>> | undefined) ?? {};
  return {
    intentCooldowns: {
      ...all,
      [characterId]: {
        ...(all[characterId] ?? {}),
        [intent]: now.toISOString(),
      },
    },
  };
}
