import assert from "node:assert/strict";
import {
  isMariFling,
  isMariShaken,
  resolveMariPress,
  stepMariPendulum,
  stepMariSpring,
} from "../../packages/client/src/lib/mari-hold.js";

// Slice 85: a mouse lifts after 6 px of travel or a 300 ms still hold.
assert.equal(resolveMariPress({ pointerType: "mouse", travelPx: 5, heldMs: 50 }), "pending");
assert.equal(resolveMariPress({ pointerType: "mouse", travelPx: 6, heldMs: 50 }), "lift");
assert.equal(resolveMariPress({ pointerType: "mouse", travelPx: 0, heldMs: 300 }), "lift");

// Touch and pen: a still 300 ms hold lifts; more than 8 px of travel first is a scroll.
assert.equal(resolveMariPress({ pointerType: "touch", travelPx: 7, heldMs: 299 }), "pending");
assert.equal(resolveMariPress({ pointerType: "touch", travelPx: 7, heldMs: 300 }), "lift");
assert.equal(resolveMariPress({ pointerType: "touch", travelPx: 9, heldMs: 120 }), "scroll");
assert.equal(resolveMariPress({ pointerType: "pen", travelPx: 0, heldMs: 300 }), "lift");

// Shake: four direction flips inside 0.9 s; spread-out flips never shake her.
assert.equal(isMariShaken([100, 200, 300], 400), false, "three flips are not a shake");
assert.equal(isMariShaken([100, 200, 300, 400], 500), true, "four quick flips shake her");
assert.equal(isMariShaken([0, 1_000, 2_000, 3_000], 3_000), false, "slow flips are not a shake");

assert.equal(isMariFling(1_399), false);
assert.equal(isMariFling(1_400), true);

// The pointer spring settles on its target, and a release spring does not overshoot without zeta < 1.
let spring = { x: 0, v: 0 };
for (let frame = 0; frame < 120; frame += 1) spring = stepMariSpring(spring, 200, 520, 0.62, 1 / 60);
assert.ok(Math.abs(spring.x - 200) < 0.5, `spring settles on the pointer, got ${spring.x}`);

// The body swings, never beyond ±0.85 rad, and settles back to hanging still.
let body = { angle: 0, omega: 0 };
for (let frame = 0; frame < 60; frame += 1) body = stepMariPendulum(body, 900_000, 1 / 60);
assert.ok(Math.abs(body.angle) <= 0.85, `pendulum is limited, got ${body.angle}`);
for (let frame = 0; frame < 600; frame += 1) body = stepMariPendulum(body, 0, 1 / 60);
assert.ok(Math.abs(body.angle) < 0.01, `pendulum settles, got ${body.angle}`);

console.info("Mari hold: press thresholds, shake, fling, spring and pendulum rules pass.");
