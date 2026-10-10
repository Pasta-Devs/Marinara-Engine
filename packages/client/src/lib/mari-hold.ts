/**
 * Slice 85: holding Mari. The gesture thresholds and the physics steps live here, pure, so the
 * regression can pin them without a DOM. The hook and the figure only read them.
 */

/** Touch and pen: a still press this long lifts her. Mouse: a press this long lifts her too. */
export const MARI_HOLD_DELAY_MS = 300;
/** Mouse: moving this far while pressed lifts her at once. */
export const MARI_HOLD_MOUSE_SLOP_PX = 6;
/** Touch and pen: moving more than this before the hold completes is a scroll, and she stays put. */
export const MARI_HOLD_TOUCH_SLOP_PX = 8;
/** Shake: this many direction flips inside the window make her dizzy. */
export const MARI_SHAKE_FLIPS = 4;
export const MARI_SHAKE_WINDOW_MS = 900;
export const MARI_DIZZY_MS = 1_800;
/** A release faster than this flings her: she overshoots and says so. */
export const MARI_FLING_SPEED_PX_S = 1_400;

export type MariPressStep = "pending" | "lift" | "scroll";

/** While the button is down: is it still a tap, a scroll for the page, or a hold that lifts her? */
export function resolveMariPress({
  pointerType,
  travelPx,
  heldMs,
}: {
  pointerType: string;
  travelPx: number;
  heldMs: number;
}): MariPressStep {
  if (pointerType === "mouse") {
    if (travelPx >= MARI_HOLD_MOUSE_SLOP_PX || heldMs >= MARI_HOLD_DELAY_MS) return "lift";
    return "pending";
  }
  if (travelPx > MARI_HOLD_TOUCH_SLOP_PX) return "scroll";
  return heldMs >= MARI_HOLD_DELAY_MS ? "lift" : "pending";
}

/** `flips` are the times (ms) of direction reversals, oldest first. Four inside 0.9 s shake her dizzy. */
export function isMariShaken(flips: readonly number[], now: number): boolean {
  return flips.filter((at) => now - at <= MARI_SHAKE_WINDOW_MS).length >= MARI_SHAKE_FLIPS;
}

export function isMariFling(speedPxPerSec: number): boolean {
  return speedPxPerSec >= MARI_FLING_SPEED_PX_S;
}

export interface MariSpring {
  x: number;
  v: number;
}

/** One semi-implicit Euler step of a damped spring pulled toward `target`. */
export function stepMariSpring(spring: MariSpring, target: number, stiffness: number, zeta: number, dt: number) {
  const v = spring.v + (stiffness * (target - spring.x) - 2 * zeta * Math.sqrt(stiffness) * spring.v) * dt;
  return { x: spring.x + v * dt, v };
}

export interface MariPendulum {
  /** Radians from hanging straight down, wrapped to [-π, π]. Past ±π/2 she is upside down. */
  angle: number;
  omega: number;
}

/** A pivot acceleration in px/s², on each axis. */
export interface MariPivotAccel {
  x: number;
  y: number;
}

/**
 * The body hangs from the grab point (g/L 18, a 1.5 s period, damping 4.5) and is a real pendulum: a
 * sin restoring torque, no limit, so a vigorous circular drag carries her over the top. The grab point's
 * acceleration on both axes drives it; 160 px/s² of pivot acceleration is one rad/s² of torque. Tuned
 * so a 120 px sideways shake at 1.5 Hz peaks near 1 rad, a gentle 110 px circle never flips her, and a
 * 160 px circle at 1.5 Hz turns her fully over. A still hand never does.
 */
export function stepMariPendulum(pendulum: MariPendulum, accel: MariPivotAccel, dt: number): MariPendulum {
  const { angle, omega } = pendulum;
  // The figure rotates with CSS `rotate()` about its top centre (clockwise = +angle), so the body sits at
  // (-sin, cos) from the grab point: the pivot's pseudo-force makes her lag behind the hand.
  const drive = (accel.x * Math.cos(angle) + accel.y * Math.sin(angle)) / 160;
  const nextOmega = omega + (-18 * Math.sin(angle) - 4.5 * omega + drive) * dt;
  return { angle: wrapMariAngle(angle + nextOmega * dt), omega: nextOmega };
}

/** Keeps an angle in [-π, π]; the figure only needs its orientation, so wrapping loses nothing. */
export function wrapMariAngle(angle: number): number {
  return ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/** A wall hit this fast squashes her and bonks her; slower hits only stop her. */
export const MARI_SMASH_SPEED_PX_S = 900;
/** A smash bounces her back at this share of her speed. */
export const MARI_WALL_BOUNCE = 0.5;
/** The hand's speed is read over this many ms. */
export const MARI_HAND_WINDOW_MS = 50;
/**
 * A fast hand still counts for a wall hit this long after it was fast. The pivot trails the hand by about
 * 55 ms, so on a phone it reaches the edge after the finger has stopped on it.
 */
export const MARI_THROW_MEMORY_MS = 150;
/**
 * A smash on the same wall within this many ms is the same hit: she bounces, the hand pins her back, and
 * the remembered throw would smash her again, which counts as a shake and makes one flick dizzy.
 */
export const MARI_RESMASH_MS = 450;

/** Whether a smash on `side` (-1 left/top, 1 right/bottom) is a new hit, not the bounce of the last one. */
export function isNewMariSmash(last: { side: number; at: number }, side: number, now: number): boolean {
  return side !== last.side || now - last.at >= MARI_RESMASH_MS;
}

/** One sample of the hand: where the pointer was, and when (ms). */
export interface MariHandSample {
  x: number;
  y: number;
  at: number;
}

/**
 * The hand's velocity (px/s) over the last `MARI_HAND_WINDOW_MS`. `samples` are oldest first; the older
 * ones past the window are dropped in place. A still hand reads zero once the window holds only its spot.
 */
export function mariHandVelocity(samples: MariHandSample[]): { x: number; y: number } {
  const last = samples[samples.length - 1];
  while (samples.length > 1 && last.at - samples[0].at > MARI_HAND_WINDOW_MS) samples.shift();
  const first = samples[0];
  const dt = (last.at - first.at) / 1000;
  return dt > 0 ? { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt } : { x: 0, y: 0 };
}

/** One axis of the hand's fastest recent velocity: `at` is when (ms) it was read. */
export interface MariThrow {
  v: number;
  at: number;
}

/** Keeps the faster of the held peak and a new reading, and lets a peak go once it is `MARI_THROW_MEMORY_MS` old. */
export function mariThrowPeak(peak: MariThrow, v: number, now: number): MariThrow {
  return Math.abs(v) >= Math.abs(peak.v) || now - peak.at > MARI_THROW_MEMORY_MS ? { v, at: now } : peak;
}

/**
 * The figure's box relative to its grab point (the top centre), for the angle and scale it is at now:
 * scaled first, then turned, the same order as her transform.
 */
export function mariFigureExtent(angle: number, width: number, height: number, scaleX = 1, scaleY = 1) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [-width / 2, 0],
    [width / 2, 0],
    [-width / 2, height],
    [width / 2, height],
  ].map(([x, y]) => ({ x: x * scaleX * cos - y * scaleY * sin, y: x * scaleX * sin + y * scaleY * cos }));
  return {
    left: Math.min(...corners.map((c) => c.x)),
    right: Math.max(...corners.map((c) => c.x)),
    top: Math.min(...corners.map((c) => c.y)),
    bottom: Math.max(...corners.map((c) => c.y)),
  };
}

/**
 * One axis of the viewport as a wall. The grab point is `position`; the figure spans `min`..`max`
 * from it, and the screen is `size` px long. A figure past a wall bounces off it, or stops if the
 * hit is light. A hit at smash speed also reports that it smashed. The impact is the faster of the
 * pivot moving into the wall and the hand (`handV`, signed px/s on this axis) moving into it.
 */
export function stepMariWall(
  spring: MariSpring,
  min: number,
  max: number,
  size: number,
  handV = 0,
): { spring: MariSpring; smash: boolean } {
  // Positive: the figure must move right or down to fit. Negative: left or up.
  const push = spring.x + min < 0 ? -(spring.x + min) : spring.x + max > size ? size - (spring.x + max) : 0;
  if (push === 0) return { spring, smash: false };
  // Moving into the wall: its speed is the impact. A push and a velocity with opposite signs mean that.
  // Moving back inside already: nothing to stop.
  const hitting = Math.sign(push) !== Math.sign(spring.v);
  // The hand adds to a hit only while the pivot is hitting too: a bounce that still overlaps must not re-smash.
  const handHitting = Math.sign(handV) === -Math.sign(push);
  const impact = hitting ? Math.max(Math.abs(spring.v), handHitting ? Math.abs(handV) : 0) : 0;
  const smash = impact >= MARI_SMASH_SPEED_PX_S;
  const v = !hitting ? spring.v : smash ? -spring.v * MARI_WALL_BOUNCE : 0;
  return { spring: { x: spring.x + push, v }, smash };
}
