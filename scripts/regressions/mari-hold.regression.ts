import assert from "node:assert/strict";
import {
  isMariFling,
  isMariShaken,
  resolveMariPress,
  stepMariPendulum,
  stepMariSpring,
  wrapMariAngle,
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

// The angle wraps into [-π, π], so a full turn never leaves the range.
assert.ok(Math.abs(wrapMariAngle(3.5) - (3.5 - 2 * Math.PI)) < 1e-9, "angles past π wrap");
assert.ok(Math.abs(wrapMariAngle(-3.5) - (2 * Math.PI - 3.5)) < 1e-9, "angles past -π wrap");

// A circular drag (110 px circle, 1 Hz, on a pivot that moves with it) turns her fully over: she
// reaches π, past upside down, and one full turn is counted by the wraps.
const circle = (frame: number) => {
  const t = frame / 60;
  const w = 2 * Math.PI;
  return { x: -110 * w * w * Math.cos(w * t), y: -110 * w * w * Math.sin(w * t) };
};
let body = { angle: 0, omega: 0 };
let peak = 0;
let turns = 0;
for (let frame = 0; frame < 6 * 60; frame += 1) {
  const next = stepMariPendulum(body, circle(frame), 1 / 60);
  if (Math.abs(next.angle - body.angle) > Math.PI) turns += 1;
  body = next;
  peak = Math.max(peak, Math.abs(body.angle));
}
assert.ok(peak > Math.PI - 0.1, `circular drag turns her fully over, peak ${peak}`);
assert.ok(turns >= 1, `a full turn wraps the angle, got ${turns} wraps`);

// Still: she swings back and settles hanging straight down, from wherever the spin left her.
for (let frame = 0; frame < 15 * 60; frame += 1) body = stepMariPendulum(body, { x: 0, y: 0 }, 1 / 60);
assert.ok(Math.abs(body.angle) < 0.01, `pendulum settles, got ${body.angle}`);

// Vertical pivot motion torques a body held off its straight-down rest; at rest it does nothing.
const rest = stepMariPendulum({ angle: 0, omega: 0 }, { x: 0, y: 900 }, 1 / 60);
assert.equal(rest.omega, 0, "vertical pivot motion does not swing a body hanging straight down");
const aside = stepMariPendulum({ angle: Math.PI / 2, omega: 0 }, { x: 0, y: 900 }, 1 / 60);
assert.notEqual(aside.omega, 0, "vertical pivot motion swings a body held off its rest");

console.info("Mari hold: press thresholds, shake, fling, spring and pendulum rules pass.");
