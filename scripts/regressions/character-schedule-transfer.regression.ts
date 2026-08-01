import assert from "node:assert/strict";
import type { WeekSchedule } from "../../packages/shared/src/utils/conversation-presence.js";
import {
  CHARACTER_SCHEDULE_EXPORT_KIND,
  createCharacterScheduleExport,
  parseCharacterScheduleImport,
} from "../../packages/client/src/lib/character-schedule-transfer.js";

const schedule: WeekSchedule = {
  weekStart: "2026-07-20T00:00:00.000Z",
  days: Object.fromEntries(
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => [day, []]),
  ),
  inactivityThresholdMinutes: 90,
  idleResponseDelayMinutes: 4,
  dndResponseDelayMinutes: 12,
  autonomousDailyCapOverride: 3,
  routineSummary: "Research during the day and unwind in the evening.",
  routineSummaryGeneratedAt: "2026-07-20T12:00:00.000Z",
  disabledAutonomousIntents: ["meal_break"],
  talkativeness: 70,
};
schedule.days.Monday = [{ time: "09:00-17:00", activity: "Research", status: "dnd" }];

const envelope = createCharacterScheduleExport(schedule, "Il Dottore");
assert.equal(envelope.kind, CHARACTER_SCHEDULE_EXPORT_KIND);
assert.equal(envelope.characterName, "Il Dottore");

const current = parseCharacterScheduleImport(envelope, "2026-07-27T00:00:00.000Z");
assert.equal(current.ok, true);
if (current.ok) {
  assert.equal(current.format, "current");
  assert.equal(current.schedule.weekStart, "2026-07-27T00:00:00.000Z");
  assert.deepEqual(current.schedule.days.Monday, schedule.days.Monday);
  assert.equal(current.schedule.routineSummary, schedule.routineSummary);
  assert.deepEqual(current.schedule.disabledAutonomousIntents, ["meal_break"]);
}

const legacy = parseCharacterScheduleImport(schedule, "2026-08-03T00:00:00.000Z");
assert.equal(legacy.ok, true);
if (legacy.ok) {
  assert.equal(legacy.format, "legacy");
  assert.equal(legacy.schedule.weekStart, "2026-08-03T00:00:00.000Z");
}

assert.deepEqual(parseCharacterScheduleImport({ ...envelope, version: 2 }), {
  ok: false,
  reason: "unsupported-version",
});
assert.deepEqual(
  parseCharacterScheduleImport({
    ...schedule,
    days: { ...schedule.days, Monday: [{ time: "09:00-17:00", activity: "Research", status: "unknown" }] },
  }),
  { ok: false, reason: "invalid" },
);
assert.deepEqual(parseCharacterScheduleImport({ ...schedule, inactivityThresholdMinutes: "90" }), {
  ok: false,
  reason: "invalid",
});

console.info("Character schedule transfer regressions passed.");
