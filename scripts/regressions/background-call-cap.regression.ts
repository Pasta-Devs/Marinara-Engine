import assert from "node:assert/strict";

// Settings > Advanced > Features "Background call cap" (backgroundCallCap + backgroundCallsPerHour). OFF (the
// default) is no cap. ON limits automatic model calls per rolling hour to the number (600 by default). Refused calls
// send no request. MARINARA_BACKGROUND_CALLS_PER_HOUR wins over both when set.
process.env.LOG_LEVEL = "silent";
delete process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR;
const {
  DEFAULT_BACKGROUND_CALLS_PER_HOUR,
  BACKGROUND_CALL_BUDGET_WINDOW_MS,
  backgroundCallBudgetSnapshot,
  backgroundCallsPerHourLimit,
  resetBackgroundCallBudgetForTests,
  tryConsumeBackgroundCall,
} = await import("../../packages/server/src/services/generation/background-call-budget.js");
const { resetFeatureSettingsForTests } = await import("../../packages/server/src/services/features/feature-settings.js");
const { BackgroundConnectionBusyError, resetConnectionAdmissionForTests, withConnectionAdmission } =
  await import("../../packages/server/src/services/generation/connection-admission.js");
const now = Date.parse("2026-09-23T12:00:00.000Z");

try {
  // Default: the switch is off, so there is no cap at all.
  resetBackgroundCallBudgetForTests();
  resetFeatureSettingsForTests();
  assert.equal(backgroundCallsPerHourLimit(), 0, "OFF by default: no cap");
  for (let index = 0; index < 1000; index += 1) {
    assert.equal(tryConsumeBackgroundCall("test", now + index).allowed, true, "OFF: never refused");
  }
  assert.equal(backgroundCallBudgetSnapshot(now + 1000).used, 0, "OFF: nothing is even counted");

  // On: the number is the cap; the default number is 600.
  resetFeatureSettingsForTests({ backgroundCallCap: true });
  assert.equal(backgroundCallsPerHourLimit(), DEFAULT_BACKGROUND_CALLS_PER_HOUR);
  assert.equal(DEFAULT_BACKGROUND_CALLS_PER_HOUR, 600);

  resetFeatureSettingsForTests({ backgroundCallCap: true, backgroundCallsPerHour: 2 });
  assert.equal(backgroundCallsPerHourLimit(), 2, "the Features number sets the cap");
  assert.equal(tryConsumeBackgroundCall("a", now).allowed, true);
  assert.equal(tryConsumeBackgroundCall("b", now + 1).allowed, true);
  const refused = tryConsumeBackgroundCall("a", now + 2);
  assert.equal(refused.allowed, false, "ON: the third call in the hour is refused");
  assert.equal(!refused.allowed && refused.retryAfterMs, BACKGROUND_CALL_BUDGET_WINDOW_MS - 2);
  assert.deepEqual(backgroundCallBudgetSnapshot(now + 3), { used: 2, limit: 2, exhausted: true, bySource: { a: 1, b: 1 } });
  // The window rolls: once the oldest call is an hour old, a slot is free again.
  assert.equal(tryConsumeBackgroundCall("a", now + BACKGROUND_CALL_BUDGET_WINDOW_MS + 1).allowed, true);

  // Environment variable wins over the saved switch and number.
  resetBackgroundCallBudgetForTests();
  resetFeatureSettingsForTests({ backgroundCallCap: false, backgroundCallsPerHour: 2 });
  process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR = "7";
  assert.equal(backgroundCallsPerHourLimit(), 7, "env wins over a saved off");
  process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR = "off";
  resetFeatureSettingsForTests({ backgroundCallCap: true, backgroundCallsPerHour: 3 });
  assert.equal(backgroundCallsPerHourLimit(), 0, "env off wins over a saved on");
  process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR = "junk";
  assert.equal(backgroundCallsPerHourLimit(), DEFAULT_BACKGROUND_CALLS_PER_HOUR, "invalid env falls back to 600");
  delete process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR;

  // Connection admission: a background-mode provider call is refused before any request once the cap is spent.
  // Foreground (interactive) calls never count and are never refused.
  resetBackgroundCallBudgetForTests(1);
  resetConnectionAdmissionForTests();
  let providerCalls = 0;
  const call = () => {
    providerCalls += 1;
    return Promise.resolve("ok");
  };
  assert.equal(await withConnectionAdmission("conn-cap", { kind: "background" }, call), "ok");
  await assert.rejects(
    withConnectionAdmission("conn-cap", { kind: "background" }, call),
    (error: unknown) => error instanceof BackgroundConnectionBusyError && error.reason === "budget",
  );
  assert.equal(providerCalls, 1, "the refused call sent nothing");
  assert.equal(await withConnectionAdmission("conn-cap", { kind: "foreground" }, call), "ok");
  assert.equal(providerCalls, 2, "interactive calls are not capped");
  assert.equal(backgroundCallBudgetSnapshot().used, 1, "interactive calls are not counted");
} finally {
  delete process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR;
  resetFeatureSettingsForTests();
  resetBackgroundCallBudgetForTests();
}

// The autonomous scheduler asks the budget before it starts an unattended turn.
const { readFileSync } = await import("node:fs");
const schedulerSource = readFileSync(
  new URL("../../packages/server/src/services/conversation/server-autonomous-scheduler.service.ts", import.meta.url),
  "utf8",
);
const budgetCheck = schedulerSource.indexOf("tryConsumeBackgroundCall(`autonomous:");
assert.ok(budgetCheck > 0, "the scheduler books its turns against the cap");
assert.ok(budgetCheck < schedulerSource.indexOf('url: "/api/generate"'), "and checks it before calling generate");

console.log("background-call-cap regression passed");
