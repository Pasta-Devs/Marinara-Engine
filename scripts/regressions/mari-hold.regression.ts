import assert from "node:assert/strict";
import type { MariPendulum } from "../../packages/client/src/lib/mari-hold.js";
import {
  isNewMariSmash,
  isMariFling,
  isMariShaken,
  mariFigureExtent,
  mariHandVelocity,
  mariThrowPeak,
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

// A vigorous circular drag (160 px circle, 1.5 Hz, on a pivot that moves with it) turns her fully over: she
// reaches π, past upside down, and one full turn is counted by the wraps.
const circle = (frame: number) => {
  const t = frame / 60;
  const w = 2 * Math.PI * 1.5;
  return { x: -160 * w * w * Math.cos(w * t), y: -160 * w * w * Math.sin(w * t) };
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

// Phone flick: the lagging pivot can read slow at the wall, so the hand's own speed judges the hit. A fast
// hand into the wall smashes; a slow push does not; a hand moving away from the wall never smashes.
assert.equal(
  stepMariWall({ x: 10, v: -300 }, -53, 53, 390, -1_200).smash,
  true,
  "a fast hand smashes though the pivot is slow",
);
assert.equal(stepMariWall({ x: 10, v: -300 }, -53, 53, 390, -400).smash, false, "a slow hand push does not smash");
assert.equal(stepMariWall({ x: 10, v: -300 }, -53, 53, 390, 1_200).smash, false, "a hand moving away does not smash");
assert.equal(
  stepMariWall({ x: 380, v: 300 }, -53, 53, 390, 1_200).smash,
  true,
  "a fast hand on the right wall smashes",
);

// The hand's velocity is over the last 50 ms: older samples drop out, and a still hand reads zero.
const trail = [
  { x: 200, y: 0, at: 0 },
  { x: 180, y: 0, at: 10 },
  { x: 150, y: 0, at: 40 },
];
assert.ok(Math.abs(mariHandVelocity(trail).x - -1_250) < 1e-9, "50 px in 40 ms is 1250 px/s");
trail.push({ x: 120, y: 0, at: 70 });
assert.ok(Math.abs(mariHandVelocity(trail).x - -1_000) < 1e-9, "30 px in 30 ms is 1000 px/s");
assert.equal(trail.length, 2, "samples older than 50 ms drop out");
trail.push({ x: 120, y: 0, at: 120 });
assert.equal(mariHandVelocity(trail).x, 0, "a still hand reads zero");

// The pivot reaches the edge after a flick has stopped. The fast reading still counts for 150 ms, then goes.
let throwPeak = mariThrowPeak({ v: 0, at: 0 }, -1_200, 100);
throwPeak = mariThrowPeak(throwPeak, 0, 200);
assert.equal(
  stepMariWall({ x: 10, v: -300 }, -53, 53, 390, throwPeak.v).smash,
  true,
  "a throw counts after the finger stops",
);
assert.equal(mariThrowPeak(throwPeak, 0, 300).v, 0, "an old throw is forgotten");

// A 120 px sideways shake at 1.5 Hz, with the pivot on the app's spring as in the figure, wobbles her
// but never spins her past 1.3 rad.
let shakePivot = { x: 0, v: 0 };
let shakeBody: MariPendulum = { angle: 0, omega: 0 };
let shakePeak = 0;
for (let frame = 0; frame < 6 * 60; frame += 1) {
  const next = stepMariSpring(shakePivot, 120 * Math.sin((2 * Math.PI * 1.5 * frame) / 60), 520, 0.62, 1 / 60);
  shakeBody = stepMariPendulum(shakeBody, { x: (next.v - shakePivot.v) * 60, y: 0 }, 1 / 60);
  shakePivot = next;
  shakePeak = Math.max(shakePeak, Math.abs(shakeBody.angle));
}
assert.ok(shakePeak < 1.3, `a 120 px shake at 1.5 Hz stays under 1.3 rad, got ${shakePeak}`);

// After a bounce the pivot can still overlap the wall while it moves back inside: a retained throw must
// not smash her a second time.
assert.equal(stepMariWall({ x: 10, v: 300 }, -53, 53, 390, -1_200).smash, false, "a retained throw does not re-smash");

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

// One flick is one bonk: the bounce the hand pins back to the same wall is not a second smash (two would
// count as a shake and make her dizzy). The other wall, or the same wall later, is a new hit.
assert.equal(isNewMariSmash({ side: 0, at: -Infinity }, -1, 1_000), true, "a first smash counts");
assert.equal(isNewMariSmash({ side: -1, at: 1_000 }, -1, 1_200), false, "its bounce on the same wall does not");
assert.equal(isNewMariSmash({ side: -1, at: 1_000 }, 1, 1_050), true, "the opposite wall is a new hit");
assert.equal(isNewMariSmash({ side: -1, at: 1_000 }, -1, 1_500), true, "the same wall later is a new hit");

console.info("Mari hold: press thresholds, shake, fling, spring and pendulum rules pass.");
