// #5655: the freeze detector must turn a process suspension into positive,
// recorded evidence. The classifier is pinned pure; the wired detector is
// pinned by genuinely blocking the event loop past the gap threshold — the
// same thing an OS freeze does to timers — and asserting the recorded
// suspension. Intervals are sized so scheduler jitter on a loaded CI runner
// cannot false-positive the on-time assertion (200ms interval tolerates
// 200ms of lateness before the 2x threshold).
import assert from "node:assert/strict";

const { classifyTickGap, startFreezeDetector, stopFreezeDetector, getLastFreeze } =
  await import("../../packages/server/src/lib/freeze-detector.js");

// Classifier: on-time and slightly-late ticks are not freezes.
assert.equal(classifyTickGap(60_000, 0, 60_000), null, "an exact-interval tick is not a freeze");
assert.equal(classifyTickGap(119_999, 0, 60_000), null, "a tick inside 2x interval is not a freeze");
// Past 2x interval, the estimated suspension is the gap minus the interval.
assert.equal(classifyTickGap(180_000, 0, 60_000), 120_000, "a 3x-late tick reports gap minus interval");

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

startFreezeDetector(200);
try {
  await settle(250);
  // A loaded CI runner can genuinely stall this process >400ms, which the
  // detector must record — that would be a true positive, not a bug. Only a
  // record WITHOUT a genuinely late tick is a detector false positive.
  const onTimePhase = getLastFreeze();
  if (onTimePhase !== null) {
    assert.equal(
      onTimePhase.gapMs >= 400,
      true,
      `a freeze recorded during the on-time phase must reflect a genuinely late tick (got ${onTimePhase.gapMs}ms)`,
    );
  }

  // Synchronously freeze the event loop well past the 2x threshold.
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, 900);
  await settle(300);

  const freeze = getLastFreeze();
  assert.notEqual(freeze, null, "a blocked event loop is recorded as a suspension");
  assert.equal(freeze!.gapMs >= 900, true, `the recorded gap covers the blocked window (got ${freeze!.gapMs}ms)`);
  assert.equal(freeze!.suspendedMs, freeze!.gapMs - 200, "the estimated suspension subtracts the scheduled interval");
  assert.equal(typeof freeze!.detectedAt, "string", "the thaw moment is timestamped");
} finally {
  stopFreezeDetector();
}

console.log("Freeze detector regression passed.");
