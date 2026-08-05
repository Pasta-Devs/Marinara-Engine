import assert from "node:assert/strict";
import {
  dueNoodleRefreshTimes,
  generateNoodleRefreshTimes,
  localScheduleDate,
  markNoodleRefreshFailure,
  markNoodleRefreshSuccess,
  nextNoodleRefreshTime,
  noodleRefreshSchedulerStatus,
  parsePersistedNoodleRefreshSchedule,
  reconcileNoodleRefreshSchedule,
  rescheduleNoodleRefreshTime,
} from "../../packages/server/src/services/noodle/noodle-refresh-schedule.js";
import {
  nextNoodleSchedulerPollDelayMs,
  noodleRefreshRetryDelayMs,
} from "../../packages/server/src/services/noodle/noodle-refresh-scheduler.service.js";
import { noodlerReservePollIsIdle } from "../../packages/server/src/services/noodle/noodle-autopost-scheduler.service.js";

const day = new Date(2026, 6, 10, 12, 0, 0, 0);
const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
const randomValues = [0, 0.25, 0.75, 0.999];
let randomIndex = 0;
const times = generateNoodleRefreshTimes(day, 4, () => randomValues[randomIndex++] ?? 0.5);
assert.equal(times.length, 4);
assert.deepEqual(times, [...times].sort());
for (const [index, time] of times.entries()) {
  const windowSize = (end - start) / times.length;
  const timestamp = Date.parse(time);
  assert.ok(timestamp >= start + windowSize * index + windowSize * 0.15);
  assert.ok(timestamp <= start + windowSize * index + windowSize * 0.85);
}

const schedule = reconcileNoodleRefreshSchedule(null, 4, day, () => 0.5);
assert.equal(schedule.scheduleDate, localScheduleDate(day));
assert.equal(schedule.scheduledTimes.length, 4);
assert.equal(reconcileNoodleRefreshSchedule(schedule, 4, day), schedule);

const dueTimes = dueNoodleRefreshTimes(schedule, day);
assert.equal(dueTimes.length, 2);
const caughtUp = markNoodleRefreshSuccess(schedule, dueTimes, day);
assert.equal(caughtUp.completedTimes.length, 2);
assert.equal(caughtUp.successfulRefreshes, 1);
assert.equal(noodleRefreshSchedulerStatus(caughtUp, day).skippedSlots, 1);
assert.equal(nextNoodleRefreshTime(caughtUp), schedule.scheduledTimes[2]);

const rescheduled = rescheduleNoodleRefreshTime(caughtUp, schedule.scheduledTimes[2]!, "18:45", day);
assert.equal(rescheduled.scheduledTimes.includes(schedule.scheduledTimes[2]!), false);
assert.equal(
  rescheduled.scheduledTimes.some((time) => {
    const date = new Date(time);
    return date.getHours() === 18 && date.getMinutes() === 45;
  }),
  true,
);
assert.deepEqual(rescheduled.completedTimes, caughtUp.completedTimes);
assert.equal(rescheduled.lastError, null);
assert.equal(rescheduled.nextAttemptAt, null);
assert.throws(
  () => rescheduleNoodleRefreshTime(caughtUp, schedule.scheduledTimes[0]!, "18:45", day),
  /Completed automatic refresh slots cannot be rescheduled/u,
);
assert.throws(
  () => rescheduleNoodleRefreshTime(caughtUp, schedule.scheduledTimes[2]!, "10:00", day),
  /Choose a future time/u,
);
assert.throws(
  () => rescheduleNoodleRefreshTime(caughtUp, schedule.scheduledTimes[2]!, "21:00", day),
  /already planned/u,
);

const failed = markNoodleRefreshFailure(caughtUp, "Connection unavailable", day, 15 * 60_000);
const failedStatus = noodleRefreshSchedulerStatus(failed, day);
assert.equal(failedStatus.state, "retrying");
assert.equal(failedStatus.lastError, "Connection unavailable");
assert.equal(nextNoodleSchedulerPollDelayMs(failed, day), 60_000);
const rescheduledFailure = rescheduleNoodleRefreshTime(failed, schedule.scheduledTimes[2]!, "19:15", day);
assert.equal(rescheduledFailure.lastError, null);
assert.equal(rescheduledFailure.nextAttemptAt, null);
assert.equal(rescheduledFailure.failureAttempts, 0);

const reconfigured = reconcileNoodleRefreshSchedule(failed, 3, day, () => 0.5);
assert.equal(reconfigured.scheduledTimes.length, 3);
assert.equal(reconfigured.completedTimes.length, 2);
assert.equal(reconfigured.successfulRefreshes, 1);
assert.equal(reconfigured.lastError, null);
assert.equal(reconfigured.nextAttemptAt, null);

const nextDay = new Date(2026, 6, 11, 0, 1, 0, 0);
const rolled = reconcileNoodleRefreshSchedule(reconfigured, 3, nextDay, () => 0.5);
assert.equal(rolled.scheduleDate, localScheduleDate(nextDay));
assert.equal(rolled.completedTimes.length, 0);
assert.equal(rolled.successfulRefreshes, 0);
assert.equal(rolled.lastAutomaticRefreshAt, reconfigured.lastAutomaticRefreshAt);

const disabled = reconcileNoodleRefreshSchedule(rolled, 0, nextDay);
assert.equal(noodleRefreshSchedulerStatus(disabled, nextDay).state, "disabled");
// A disabled schedule backs the poll off instead of waking every minute for nothing.
assert.equal(nextNoodleSchedulerPollDelayMs(disabled, nextDay), 15 * 60_000);

assert.equal(noodlerReservePollIsIdle({ enableNoodler: false, autoPostingScheduleEnabled: false }), true);
assert.equal(noodlerReservePollIsIdle({ enableNoodler: true, autoPostingScheduleEnabled: false }), true);
assert.equal(noodlerReservePollIsIdle({ enableNoodler: false, autoPostingScheduleEnabled: true }), true);
assert.equal(noodlerReservePollIsIdle({ enableNoodler: true, autoPostingScheduleEnabled: true }), false);

assert.equal(noodleRefreshRetryDelayMs(409, 0), 60_000);
assert.equal(noodleRefreshRetryDelayMs(400, 0), 15 * 60_000);
assert.equal(noodleRefreshRetryDelayMs(429, 0), 5 * 60_000);
assert.equal(noodleRefreshRetryDelayMs(500, 0), 5 * 60_000);
assert.equal(noodleRefreshRetryDelayMs(500, 10), 60 * 60_000);
assert.equal(parsePersistedNoodleRefreshSchedule({ version: 999 }), null);
assert.deepEqual(parsePersistedNoodleRefreshSchedule(JSON.parse(JSON.stringify(caughtUp))), caughtUp);

process.stdout.write("Noodle scheduler regression passed.\n");
