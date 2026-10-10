// Pull-to-open on the phone top bar: the pure parts. No DOM, so the regression
// script can drive them with plain numbers. The look and feel is ported from the
// approved prototype (.tmp/omnibar-ux/drop/index.html, slice 15).

/** Movement before the gesture decides whether it is a pull at all. */
export const PULL_LOCK_DISTANCE = 10;
/** Down must beat sideways by this much; 1 (45°) lets a pull aim diagonally at Mari. */
const PULL_LOCK_RATIO = 1;
/** A flick opens early, but only after this much travel. */
export const PULL_FLICK_MIN_DISTANCE = 40;
/** px/ms. */
export const PULL_FLICK_VELOCITY = 0.5;
/** A release this long after the last move is not a flick. */
const PULL_VELOCITY_STALE_MS = 100;
/** An armed pull cancels only once it is back under 85% of the threshold, so a jitter cannot. */
const PULL_CANCEL_AT = 0.85;

/** 30% of the height, 160-280 px: the sheet has room to stretch and the circle room above the finger. */
export function pullOpenThreshold(viewportHeight: number) {
  return Math.max(160, Math.min(280, viewportHeight * 0.3));
}

/**
 * `pending` until the finger has moved {@link PULL_LOCK_DISTANCE}; then `rejected`
 * (sideways or up) or `pulling`; `armed` past the threshold; `cancelled` if an
 * armed pull goes back under 85% of it. `rejected` and `cancelled` are final.
 */
export type PullStep = "pending" | "pulling" | "armed" | "rejected" | "cancelled";

export function createPullRecognizer(startX: number, startY: number, startTime: number, threshold: number) {
  let step: PullStep = "pending";
  let distance = 0;
  let lastY = startY;
  let lastTime = startTime;
  let velocity = 0;
  return {
    get step() {
      return step;
    },
    get distance() {
      return distance;
    },
    move(x: number, y: number, time: number): PullStep {
      if (step === "rejected" || step === "cancelled") return step;
      const dx = x - startX;
      distance = y - startY;
      if (step === "pending") {
        if (Math.hypot(dx, distance) < PULL_LOCK_DISTANCE) return step;
        step = distance > PULL_LOCK_RATIO * Math.abs(dx) ? "pulling" : "rejected";
        if (step === "rejected") return step;
      }
      if (time > lastTime) {
        velocity = 0.6 * ((y - lastY) / (time - lastTime)) + 0.4 * velocity;
        lastY = y;
        lastTime = time;
      }
      if (step === "armed" && distance < threshold * PULL_CANCEL_AT) step = "cancelled";
      else if (step === "pulling" && distance >= threshold) step = "armed";
      return step;
    },
    /** Downward speed at release in px/ms; 0 when the finger had stopped. */
    releaseVelocity(time: number) {
      return time - lastTime > PULL_VELOCITY_STALE_MS ? 0 : Math.max(0, velocity);
    },
    /** Opens when released past the threshold, or on a flick after enough travel. */
    release(time: number) {
      if (step === "armed") return true;
      if (step !== "pulling") return false;
      return distance >= PULL_FLICK_MIN_DISTANCE && this.releaseVelocity(time) > PULL_FLICK_VELOCITY;
    },
  };
}

export type PullRecognizer = ReturnType<typeof createPullRecognizer>;

// ── Target ─────────────────────────────────────────────────────────────────

export type PullTarget = "search" | "mari";

/** px each side of the middle: once chosen, a side holds until the finger crosses the far edge. */
export const PULL_SIDE_DEAD_ZONE = 28;
/** The side is chosen from 35% of the threshold on. */
export const PULL_SIDE_FROM = 0.35;

/**
 * The target for a finger at `x` on a bar `width` wide: left half search, right
 * half Mari, with a dead zone around the middle so it cannot flicker. Without
 * Mari the whole bar is search.
 */
export function pullTarget(current: PullTarget | null, x: number, width: number, mariEnabled: boolean): PullTarget {
  if (!mariEnabled) return "search";
  const middle = width / 2;
  if (current === "search") return x > middle + PULL_SIDE_DEAD_ZONE ? "mari" : "search";
  if (current === "mari") return x < middle - PULL_SIDE_DEAD_ZONE ? "search" : "mari";
  return x < middle ? "search" : "mari";
}

// ── The sheet ──────────────────────────────────────────────────────────────
// Path coordinates: x in viewport px, y in px below the bar's bottom edge,
// shifted by `origin` into the box of the element they clip.

export const PULL_CIRCLE_MIN = 12;
export const PULL_CIRCLE_MAX = 40;
/** The small bar under the circle, and the gap between them. */
export const PULL_TAG_HEIGHT = 32;
export const PULL_TAG_GAP = 8;
/** The small bar's bottom edge sits this far above the touch point; the thumb comes from below. */
export const PULL_FINGER_GAP = 32;
/** Half-width of the sheet on the bar at the threshold, as a share of the bar's width. */
const PULL_BASE_SHARE = 0.42;
/** How far below the circle's equator (rad) the sheet's sides flow into it. */
const PULL_SIDE_ANGLE = 0.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const px = (value: number) => Math.round(value * 10) / 10;
const norm = (x: number, y: number): [number, number] => {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
};
type Point = [number, number];
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * Where the circle wants to be for a finger `fingerY` px below the bar after a
 * pull of `pull` (share of the threshold): above the fingertip, under the small
 * bar once there is room for it, never above the bar edge.
 */
export function pullCircleTarget(fingerY: number, pull: number) {
  const gap = PULL_FINGER_GAP;
  const want = lerp(PULL_CIRCLE_MIN, PULL_CIRCLE_MAX, smooth(pull / 0.85));
  // The small bar appears once there is room for it and a real circle above the finger.
  const room = fingerY - gap - (PULL_TAG_HEIGHT + PULL_TAG_GAP) - 2 * PULL_CIRCLE_MIN * 1.6;
  const tag = smooth(room / 24) * smooth((pull - PULL_SIDE_FROM) / 0.25);
  const bottom = fingerY - gap - (PULL_TAG_HEIGHT + PULL_TAG_GAP) * tag;
  const radius = clamp(bottom / 2, PULL_CIRCLE_MIN, want);
  return { radius, centerY: Math.max(bottom - radius, radius * 0.75), tag };
}

/** The sheet's half-width on the bar: a little wider than the circle at first, most of the bar at the threshold. */
export function pullSheetBase(radius: number, pull: number, width: number) {
  return lerp(radius + 18, width * PULL_BASE_SHARE, smooth(pull));
}

/** The circle and the small bar stay this far in from the screen's sides. */
export const PULL_EDGE_MARGIN = 6;

/**
 * `x` for something `half` px wide each side of it, moved in only as far as it
 * must to stay on a `width` px screen: it follows the finger right up to the edge.
 */
export function pullOnScreenX(x: number, half: number, width: number) {
  const min = half + PULL_EDGE_MARGIN;
  return clamp(x, min, Math.max(min, width - min));
}

// ── Gaze (45b) ─────────────────────────────────────────────────────────────

/** The frames of a pack's `pull-heads` sheet, left to right, 96 px each. */
export const PULL_GAZE_FRAMES = ["neutral", "down", "down-left", "down-right", "peering", "delighted"] as const;
export type PullGazeFrame = (typeof PULL_GAZE_FRAMES)[number];
/** A new gaze holds at least this long, so a jittery finger on a bucket edge cannot flicker it. */
export const PULL_GAZE_HOLD_MS = 150;

/**
 * Where Mari looks while she is pulled down: at the screen's middle, where the
 * chat or the open editor is. Near the middle third she looks straight down; out
 * to one side she looks back across the screen (down-left from the right side).
 */
export function pullGazeFrame(fingerX: number, screenWidth: number): "down" | "down-left" | "down-right" {
  const offset = fingerX - screenWidth / 2;
  if (Math.abs(offset) <= screenWidth / 6) return "down";
  return offset > 0 ? "down-left" : "down-right";
}

/** The shown frame after a move at `now`: a change waits until the current frame has held its minimum. */
export function holdPullGaze(
  shown: { frame: PullGazeFrame; since: number } | null,
  next: PullGazeFrame,
  now: number,
): { frame: PullGazeFrame; since: number } {
  if (!shown) return { frame: next, since: now };
  if (next === shown.frame || now - shown.since < PULL_GAZE_HOLD_MS) return shown;
  return { frame: next, since: now };
}

export interface PullSheet {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Half-width on the bar. */
  base: number;
  /** 0-1: how far the sheet has thinned towards letting go of the circle. */
  pinch: number;
  /** 0-1: a slight sag while it is being pulled down fast. */
  sag: number;
}

// One side of the sheet as a single cubic, top to bottom: it leaves the bar edge
// level (so the bar stays straight outside it) and arrives on the circle along
// the circle's own tangent (so there is no bump where they meet).
function sideCurve(sign: 1 | -1, { cx, cy, rx, ry, base, sag }: PullSheet): Point[] {
  const sb = Math.sin(PULL_SIDE_ANGLE);
  const cb = Math.cos(PULL_SIDE_ANGLE);
  const start: Point = [cx + sign * base, 0];
  const end: Point = [cx + sign * rx * cb, cy + ry * sb];
  const [dx, dy] = norm(-sign * rx * sb, ry * cb);
  const h = Math.abs(start[0] - end[0]) * 0.55;
  const k = end[1] * (0.5 + 0.12 * sag);
  return [start, [start[0] - sign * h, 0], [end[0] - dx * k, end[1] - dy * k], end];
}

// Split a cubic in half (exactly), so the pinch can pull its middle in without changing the rest.
function halves(curve: Point[]): Point[] {
  const p01 = mid(curve[0], curve[1]);
  const p12 = mid(curve[1], curve[2]);
  const p23 = mid(curve[2], curve[3]);
  const p012 = mid(p01, p12);
  const p123 = mid(p12, p23);
  return [p01, p012, mid(p012, p123), p123, p23];
}

/**
 * One clockwise outline, symmetric around the circle: a stretch of the bar edge,
 * two calm sides, the circle's lower arc. `waistY` is where the sheet lets go.
 */
export function pullSheetPath(sheet: PullSheet, origin: Point = [0, 0]) {
  const P = ([x, y]: Point) => `${px(x - origin[0])} ${px(y - origin[1])}`;
  const right = sideCurve(1, sheet);
  const left = sideCurve(-1, sheet);
  const r = halves(right);
  const l = halves(left);
  for (const [h, sign] of [
    [r, 1],
    [l, -1],
  ] as const) {
    const waist = h[2][0] + (sheet.cx - h[2][0]) * clamp01(sheet.pinch);
    // The waist's handles move with it, but never past the middle: on a wide sheet the handle
    // towards the circle reached across and the two sides crossed. Narrowing them in x only keeps
    // them in line, so the waist stays smooth, and each side's control points stay on its own side.
    const room = sign * (waist - sheet.cx);
    const inward = Math.max(0, -sign * (h[1][0] - h[2][0]), -sign * (h[3][0] - h[2][0]));
    const s = inward > room ? room / inward : 1;
    for (const i of [1, 3]) h[i] = [waist + (h[i][0] - h[2][0]) * s, h[i][1]];
    h[2] = [waist, h[2][1]];
  }
  const { cx, base, rx, ry } = sheet;
  const d =
    `M${P([cx - base, -3])}L${P([cx + base, -3])}L${P(right[0])}` +
    `C${P(r[0])} ${P(r[1])} ${P(r[2])}C${P(r[3])} ${P(r[4])} ${P(right[3])}` +
    `A${px(rx)} ${px(ry)} 0 0 1 ${P(left[3])}` +
    `C${P(l[4])} ${P(l[3])} ${P(l[2])}C${P(l[1])} ${P(l[0])} ${P(left[0])}Z`;
  return { d, waistY: r[2][1] };
}

/** The freed circle, with a short tail at its top while it pulls it in. */
export function pullCirclePath(cx: number, cy: number, rx: number, ry: number, tail: number, origin: Point = [0, 0]) {
  const P = ([x, y]: Point) => `${px(x - origin[0])} ${px(y - origin[1])}`;
  if (tail < 0.5)
    return `M${P([cx, cy - ry])}A${px(rx)} ${px(ry)} 0 1 1 ${P([cx, cy + ry])}A${px(rx)} ${px(ry)} 0 1 1 ${P([cx, cy - ry])}Z`;
  const a = 0.6;
  const right: Point = [cx + rx * Math.sin(a), cy - ry * Math.cos(a)];
  const left: Point = [cx - rx * Math.sin(a), cy - ry * Math.cos(a)];
  const [rdx, rdy] = norm(rx * Math.cos(a), ry * Math.sin(a));
  const [ldx, ldy] = norm(rx * Math.cos(a), -ry * Math.sin(a));
  const tip = cy - ry - tail;
  const k = Math.min(tail * 0.6, rx * 0.5);
  return (
    `M${P([cx, tip])}C${P([cx + 1.5, tip + tail * 0.45])} ${P([right[0] - rdx * k, right[1] - rdy * k])} ${P(right)}` +
    `A${px(rx)} ${px(ry)} 0 1 1 ${P(left)}` +
    `C${P([left[0] + ldx * k, left[1] + ldy * k])} ${P([cx - 1.5, tip + tail * 0.45])} ${P([cx, tip])}Z`
  );
}

/** What is left on the bar after it lets go: a smooth sag that draws back up. */
export function pullRemnantPath(x: number, halfWidth: number, depth: number, origin: Point = [0, 0]) {
  const P = ([x0, y0]: Point) => `${px(x0 - origin[0])} ${px(y0 - origin[1])}`;
  const d = Math.max(0, depth);
  const w = halfWidth;
  return (
    `M${P([x - w, -3])}L${P([x + w, -3])}L${P([x + w, 0])}C${P([x + w * 0.45, 0])} ${P([x + w * 0.3, d])} ${P([x, d])}` +
    `C${P([x - w * 0.3, d])} ${P([x - w * 0.45, 0])} ${P([x - w, 0])}Z`
  );
}

// ── The morph into the present Mari (M17) ──────────────────────────────────
// Box coordinates: the morph element has the target sprite's size and is moved
// with `translate(x, y) scale(scale)` from its top-left corner; the clip is in
// its own (unscaled) pixels.

export interface PullMorphFrame {
  x: number;
  y: number;
  scale: number;
  clip: string;
  /** The pull circle's portrait, fading out over the sprite. */
  portrait: number;
  /** The target sprite's own image, fading in under it. */
  sprite: number;
}

/**
 * The circle (centre `from.x/y`, radius `from.r`) becoming the sprite box `to`
 * at progress `t` (0-1, a spring may overshoot a little). At 0 the box is
 * shrunk so the square at its top - her head - is exactly the circle; at 1 it
 * is the box itself, unclipped.
 */
export function pullMorphFrame(
  from: { x: number; y: number; r: number },
  to: { left: number; top: number; width: number; height: number },
  t: number,
): PullMorphFrame {
  const side = Math.max(1, Math.min(to.width, to.height));
  const start = (2 * from.r) / side;
  const rest = Math.max(0, 1 - t);
  const scale = lerp(start, 1, t);
  return {
    x: px(lerp(from.x - (start * to.width) / 2, to.left, t)),
    y: px(lerp(from.y - (start * side) / 2, to.top, t)),
    scale: Math.round(scale * 1000) / 1000,
    clip: `inset(0px ${px(((to.width - side) / 2) * rest)}px ${px((to.height - side) * rest)}px ${px(((to.width - side) / 2) * rest)}px round ${px((side / 2) * rest)}px)`,
    portrait: Math.round((1 - smooth((t - 0.3) / 0.5)) * 100) / 100,
    sprite: Math.round(smooth((t - 0.1) / 0.5) * 100) / 100,
  };
}

// ── Hand-off to the dialog ─────────────────────────────────────────────────
// The omnibar dialog is lazy and mounts after the release. It calls this with its
// panel once it is on screen, so the circle can pop it open and dock in it.

let pullHandoff: ((panel: HTMLElement | null) => void) | null = null;

export function setPullHandoff(reveal: ((panel: HTMLElement | null) => void) | null) {
  pullHandoff = reveal;
}

/** True when this open came from the pull; the dialog then skips its own pop-in. */
export function isPullHandoffPending() {
  return pullHandoff !== null;
}

export function takePullHandoff() {
  const reveal = pullHandoff;
  pullHandoff = null;
  return reveal;
}
