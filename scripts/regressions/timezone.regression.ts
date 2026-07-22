import assert from "node:assert/strict";
import { normalizeRuntimeTimezoneEnv } from "../../packages/server/src/config/runtime-config.js";
import {
  formatZonedConversationTime,
  getZonedDayBounds,
  normalizePromptTimeZone,
  resolveConversationTimeZone,
} from "../../packages/server/src/services/conversation/timezone.js";
import {
  getEffectiveCurrentStatus,
  toConversationScheduleWallClockDate,
  type WeekSchedule,
} from "../../packages/shared/src/utils/conversation-presence.js";

const blankEnv: NodeJS.ProcessEnv = { TZ: "   " };
assert.equal(normalizeRuntimeTimezoneEnv(blankEnv), true);
assert.equal("TZ" in blankEnv, false);

const configuredEnv: NodeJS.ProcessEnv = { TZ: "Europe/Warsaw" };
assert.equal(normalizeRuntimeTimezoneEnv(configuredEnv), false);
assert.equal(configuredEnv.TZ, "Europe/Warsaw");

assert.equal(normalizePromptTimeZone(" Europe/Warsaw "), "Europe/Warsaw");
assert.equal(normalizePromptTimeZone("Not/A_Timezone"), undefined);
assert.equal(
  resolveConversationTimeZone({ conversationTimeZone: "America/New_York", promptTimeZone: "Europe/Warsaw" }),
  "America/New_York",
);
assert.equal(resolveConversationTimeZone({ promptTimeZone: "Europe/Warsaw" }), "Europe/Warsaw");
assert.equal(formatZonedConversationTime(new Date("2026-07-14T12:30:00.000Z"), "Europe/Warsaw"), "14:30");

const scheduleInstant = new Date("2026-07-14T23:30:00.000Z");
const newYorkScheduleNow = toConversationScheduleWallClockDate(scheduleInstant, "America/New_York");
const tokyoScheduleNow = toConversationScheduleWallClockDate(scheduleInstant, "Asia/Tokyo");
assert.equal(newYorkScheduleNow.getDay(), 2);
assert.equal(newYorkScheduleNow.getHours(), 19);
assert.equal(tokyoScheduleNow.getDay(), 3);
assert.equal(tokyoScheduleNow.getHours(), 8);

const timeZoneSchedule: WeekSchedule = {
  weekStart: "2026-07-13T00:00:00.000Z",
  inactivityThresholdMinutes: 60,
  talkativeness: 50,
  days: {
    Tuesday: [{ time: "19:00-20:00", activity: "evening class", status: "dnd" }],
    Wednesday: [{ time: "08:00-09:00", activity: "breakfast", status: "idle" }],
  },
};
assert.equal(
  getEffectiveCurrentStatus(timeZoneSchedule, null, scheduleInstant, "free time", newYorkScheduleNow).status,
  "dnd",
);
assert.equal(
  getEffectiveCurrentStatus(timeZoneSchedule, null, scheduleInstant, "free time", tokyoScheduleNow).status,
  "idle",
);
const malformedSchedule = {
  ...timeZoneSchedule,
  days: { Tuesday: [{ activity: "missing time", status: "dnd" }] },
} as unknown as WeekSchedule;
assert.deepEqual(
  getEffectiveCurrentStatus(malformedSchedule, null, scheduleInstant, "free time", newYorkScheduleNow),
  { status: "online", activity: "free time" },
);
assert.equal(
  getEffectiveCurrentStatus(
    timeZoneSchedule,
    { status: "online", activity: "available", expiresAt: "2026-07-14T23:45:00.000Z" },
    scheduleInstant,
    "free time",
    newYorkScheduleNow,
  ).status,
  "online",
);

const springForwardDay = getZonedDayBounds(new Date("2026-03-08T12:00:00.000Z"), "America/New_York");
assert.equal(springForwardDay.start.toISOString(), "2026-03-08T05:00:00.000Z");
assert.equal(springForwardDay.end.toISOString(), "2026-03-09T03:59:59.999Z");

console.log("Timezone regression checks passed.");
