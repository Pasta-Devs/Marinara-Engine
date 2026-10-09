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
  /** Radians from hanging straight down, limited to ±0.85. */
  angle: number;
  omega: number;
}

const MARI_PENDULUM_LIMIT = 0.85;

/**
 * The body hangs from the grab point (g/L 34, damping 3.2). `drive` is the grab point's horizontal
 * acceleration in px/s², so a sudden move swings her the other way.
 */
export function stepMariPendulum(pendulum: MariPendulum, drive: number, dt: number): MariPendulum {
  const alpha = -34 * pendulum.angle - 3.2 * pendulum.omega - drive / 900;
  const omega = pendulum.omega + alpha * dt;
  const angle = pendulum.angle + omega * dt;
  if (Math.abs(angle) >= MARI_PENDULUM_LIMIT) {
    return { angle: Math.sign(angle) * MARI_PENDULUM_LIMIT, omega: 0 };
  }
  return { angle, omega };
}
