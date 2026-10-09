import assert from "node:assert/strict";
import type { MariPendulum } from "../../packages/client/src/lib/mari-hold.js";
import {
  isMariFling,
  isMariShaken,
  mariFigureExtent,
  resolveMariPress,
  stepMariPendulum,
  stepMariSpring,
  stepMariWall,
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

// She lags behind the hand: moving the grab point left swings her body right (negative CSS angle), and
// right swings it left. Inertia, not a puppet following the pointer.
const draggedLeft = stepMariPendulum({ angle: 0, omega: 0 }, { x: -3_000, y: 0 }, 1 / 60);
assert.ok(draggedLeft.omega < 0, `a left drag swings her right, got omega ${draggedLeft.omega}`);
const draggedRight = stepMariPendulum({ angle: 0, omega: 0 }, { x: 3_000, y: 0 }, 1 / 60);
assert.ok(draggedRight.omega > 0, `a right drag swings her left, got omega ${draggedRight.omega}`);
// A downward jerk of the grab point lightens her (less restoring pull), an upward one weighs her down.
const lighter = stepMariPendulum({ angle: 0.5, omega: 0 }, { x: 0, y: 900 }, 1 / 60);
const heavier = stepMariPendulum({ angle: 0.5, omega: 0 }, { x: 0, y: -900 }, 1 / 60);
assert.ok(Math.abs(lighter.omega) < Math.abs(heavier.omega), "a falling grab point lightens her swing");

// Walls: a hit at 900 px/s or more smashes and bounces at half speed; a light hit only stops her.
const hard = stepMariWall({ x: 10, v: -1_200 }, -53, 53, 390);
assert.equal(hard.smash, true, "a fast hit on the left wall smashes");
assert.equal(hard.spring.x, 53, "she is pushed back inside the left wall");
assert.equal(hard.spring.v, 600, "she bounces at half speed");
const light = stepMariWall({ x: 10, v: -300 }, -53, 53, 390);
assert.equal(light.smash, false, "a light hit is not a smash");
assert.equal(light.spring.v, 0, "a light hit stops her");
const hardRight = stepMariWall({ x: 380, v: 1_200 }, -53, 53, 390);
assert.equal(hardRight.smash, true, "a fast hit on the right wall smashes");
assert.equal(hardRight.spring.x, 337, "pushed back inside the right wall");
assert.equal(hardRight.spring.v, -600, "bounces back left");
const returning = stepMariWall({ x: 10, v: 800 }, -53, 53, 390);
assert.equal(returning.smash, false, "moving back inside is no hit");
assert.equal(returning.spring.v, 800, "moving back inside keeps its speed");
assert.equal(stepMariWall({ x: 200, v: -5_000 }, -53, 53, 390).smash, false, "inside the walls nothing happens");

// An upside-down figure hangs above her grab point, so the extent covers both sides of it.
const upright = mariFigureExtent(0, 100, 160);
assert.deepEqual([upright.top, upright.bottom], [0, 160]);
const swollen = mariFigureExtent(0, 100, 160, 1.1, 1.1);
assert.ok(
  Math.abs(swollen.right - 55) < 1e-9 && Math.abs(swollen.bottom - 176) < 1e-9,
  "scale grows the box she must fit",
);
const inverted = mariFigureExtent(Math.PI, 100, 160);
assert.ok(
  Math.abs(inverted.top + 160) < 1e-9 && Math.abs(inverted.bottom) < 1e-9,
  "upside down, she is above her grab point",
);

// The whole figure stays on screen while a fast pointer keeps slamming into the edges.
const viewport = { width: 390, height: 844 };
let pivotX = { x: 195, v: 0 };
let pivotY = { x: 300, v: 0 };
let turn: MariPendulum = { angle: 0, omega: 0 };
let smashes = 0;
for (let frame = 0; frame < 20 * 60; frame += 1) {
  const t = frame / 60;
  const targetX = 195 + 230 * Math.sin(t * 4.2);
  const targetY = 300 + 260 * Math.cos(t * 2.3);
  const nextX = stepMariSpring(pivotX, targetX, 520, 0.62, 1 / 60);
  const nextY = stepMariSpring(pivotY, targetY, 520, 0.62, 1 / 60);
  turn = stepMariPendulum(turn, { x: (nextX.v - pivotX.v) * 60, y: (nextY.v - pivotY.v) * 60 }, 1 / 60);
  const extent = mariFigureExtent(turn.angle, 106.67, 160);
  const wallX = stepMariWall(nextX, extent.left, extent.right, viewport.width);
  const wallY = stepMariWall(nextY, extent.top, extent.bottom, viewport.height);
  pivotX = wallX.spring;
  pivotY = wallY.spring;
  if (wallX.smash || wallY.smash) smashes += 1;
  assert.ok(
    pivotX.x + extent.left >= -1e-9 && pivotX.x + extent.right <= viewport.width + 1e-9,
    "figure stays across the screen",
  );
  assert.ok(
    pivotY.x + extent.top >= -1e-9 && pivotY.x + extent.bottom <= viewport.height + 1e-9,
    "figure stays down the screen",
  );
}
assert.ok(smashes > 0, "the sweep does hit the walls hard enough to smash");

console.info("Mari hold: press thresholds, shake, fling, spring and pendulum rules pass.");
