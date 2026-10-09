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
 * The body hangs from the grab point (g/L 34, damping 3.2) and is a real pendulum: a sin restoring
 * torque, no limit, so a circular drag carries her over the top. The grab point's acceleration on
 * both axes drives it; 90 px/s² of pivot acceleration is one rad/s² of torque. Tuned by a simulated
 * 110 px circle at 1–1.5 Hz: it turns her fully over, and a still hand never does.
 */
export function stepMariPendulum(pendulum: MariPendulum, accel: MariPivotAccel, dt: number): MariPendulum {
  const { angle, omega } = pendulum;
  const drive = (accel.x * Math.cos(angle) - accel.y * Math.sin(angle)) / 90;
  const nextOmega = omega + (-34 * Math.sin(angle) - 3.2 * omega - drive) * dt;
  return { angle: wrapMariAngle(angle + nextOmega * dt), omega: nextOmega };
}

/** Keeps an angle in [-π, π]; the figure only needs its orientation, so wrapping loses nothing. */
export function wrapMariAngle(angle: number): number {
  return ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}
