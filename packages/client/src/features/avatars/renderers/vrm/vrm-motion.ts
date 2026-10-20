// ──────────────────────────────────────────────
// VRM avatars: expression easing, blinking, idle pose and camera framing (lane: 3D)
// ──────────────────────────────────────────────
// Plain maths with no three.js import, so it is cheap to test. vrm-renderer.ts applies the results to a
// loaded model every frame the stage asks for.
import type { AvatarExpressionMap, AvatarFrameInput, AvatarViseme } from "@marinara-engine/shared";
import { AVATAR_EMOTIONS, AVATAR_VISEMES, PNGTUBER_DEFAULT_MOTION } from "@marinara-engine/shared";
import type { AvatarFraming } from "../../contract";
import { pngtuberBlinkWaitMs } from "../pngtuber/pngtuber-layers";

/** Seconds for an eased value to cover about 63% of the way to its target. */
const EMOTION_EASE_SECONDS = 0.15;
const MOUTH_EASE_SECONDS = 0.05;
const POSE_EASE_SECONDS = 0.35;
/** A body-only model's talking nod follows the voice this quickly, so each phrase shows instead of averaging out. */
const TALK_EASE_SECONDS = 0.08;
/** A model with no mouth shapes (a generated body) sways this much more, and nods and tilts its head as it
 *  talks: its body is the only thing left to show that it is alive and speaking. */
const BODY_ONLY_GAIN = 2.5;
/** Below this the mouth counts as closed. */
const MOUTH_CLOSED = 0.02;
/** An eased weight this close to its target lands on it. Easing alone never reaches 0, and three-vrm treats
 *  any weight above 0 of a "block" expression as fully on, so a faded face would keep blocking blinks. */
const SETTLED = 0.001;
/** While the avatar speaks, a face that holds the mouth still stays at this weight, leaving the mouth 60%
 *  of its movement. */
const SPEAKING_FACE_WEIGHT = 0.4;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function ease(current: number, target: number, dtSeconds: number, seconds: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dtSeconds) / seconds));
}

// ── Expressions ──

/** Current weight of each bound model expression, keyed by the model's expression name. */
export type ExpressionWeights = Map<string, number>;

export function createExpressionWeights(): ExpressionWeights {
  return new Map();
}

/** VRM 1.0 lets a face hold the mouth still (`overrideMouth`: "block" at any weight, "blend" in
 *  proportion), which would freeze lip sync whenever the avatar speaks with that face. Each bound emotion
 *  that does so switches to "blend", and stepExpressionWeights keeps it at SPEAKING_FACE_WEIGHT while the
 *  avatar speaks. Returns the expression names that hold the mouth. */
export function softenMouthOverrides(
  map: AvatarExpressionMap,
  getExpression: (name: string) => { overrideMouth: string } | null | undefined,
): Set<string> {
  const names = new Set<string>();
  for (const emotion of AVATAR_EMOTIONS) {
    const name = map[emotion]?.target;
    const expression = name ? getExpression(name) : null;
    if (!name || !expression || expression.overrideMouth === "none") continue;
    expression.overrideMouth = "blend";
    names.add(name);
  }
  return names;
}

/** Eases every bound emotion and mouth expression toward what the frame asks for: the frame's emotion
 *  at its weight (held down while speaking when it is in `mouthHolders`), and the frame's mouth shape
 *  opened by `mouthOpen` (aa when the shape is unknown or the model lacks it). Blink is not eased here:
 *  the blink timer already shapes it. */
export function stepExpressionWeights(
  weights: ExpressionWeights,
  map: AvatarExpressionMap,
  frame: AvatarFrameInput,
  features: { lipSync: boolean },
  dtSeconds: number,
  mouthHolders: ReadonlySet<string> = new Set(),
): void {
  const targets = new Map<string, { value: number; seconds: number }>();
  const want = (name: string | null | undefined, value: number, seconds: number) => {
    if (!name) return;
    const previous = targets.get(name);
    targets.set(name, {
      value: Math.max(previous?.value ?? 0, value),
      seconds: Math.min(previous?.seconds ?? seconds, seconds),
    });
  };
  const mouthOpen = features.lipSync ? clamp01(frame.mouthOpen) : 0;
  const speaking = features.lipSync && (frame.state === "talking" || mouthOpen > MOUTH_CLOSED);
  for (const emotion of AVATAR_EMOTIONS) {
    const name = map[emotion]?.target;
    const weight = emotion === frame.emotion ? clamp01(frame.emotionWeight) : 0;
    const held = speaking && !!name && mouthHolders.has(name);
    want(name, held ? Math.min(weight, SPEAKING_FACE_WEIGHT) : weight, EMOTION_EASE_SECONDS);
  }
  const viseme: AvatarViseme | null = frame.viseme ?? (mouthOpen > MOUTH_CLOSED ? "aa" : null);
  const mouthTarget = viseme ? (map[viseme]?.target ?? map.aa?.target) : null;
  for (const slot of AVATAR_VISEMES) {
    const name = map[slot]?.target;
    want(name, name && name === mouthTarget ? mouthOpen : 0, MOUTH_EASE_SECONDS);
  }
  for (const [name, target] of targets) {
    const next = ease(weights.get(name) ?? 0, target.value, dtSeconds, target.seconds);
    weights.set(name, Math.abs(next - target.value) < SETTLED ? target.value : next);
  }
}

// ── Blinking ──

const BLINK_CLOSE_SECONDS = 0.06;
const BLINK_HOLD_SECONDS = 0.03;
const BLINK_OPEN_SECONDS = 0.09;

export interface BlinkTimer {
  random: () => number;
  /** Seconds until the next blink starts. */
  wait: number;
  /** Seconds into the current blink, or -1 while the eyes are open. */
  phase: number;
}

/** Seconds until the next blink: VRM avatars blink at the PNGTuber default rate (3 to 6 seconds). */
function nextBlinkWait(random: () => number): number {
  return pngtuberBlinkWaitMs(PNGTUBER_DEFAULT_MOTION.blinkIntervalSeconds, random) / 1000;
}

export function createBlinkTimer(random: () => number = Math.random): BlinkTimer {
  return { random, wait: nextBlinkWait(random), phase: -1 };
}

/** Eyelid closure 0..1 for this frame: a quick blink every 3 to 6 seconds while enabled. */
export function stepBlink(timer: BlinkTimer, dtSeconds: number, options: { enabled: boolean }): number {
  if (!options.enabled) {
    timer.phase = -1;
    return 0;
  }
  const dt = Math.max(0, dtSeconds);
  if (timer.phase < 0) {
    timer.wait -= dt;
    if (timer.wait > 0) return 0;
    timer.phase = -timer.wait;
  } else {
    timer.phase += dt;
  }
  const phase = timer.phase;
  if (phase < BLINK_CLOSE_SECONDS) return phase / BLINK_CLOSE_SECONDS;
  if (phase < BLINK_CLOSE_SECONDS + BLINK_HOLD_SECONDS) return 1;
  const opening = phase - BLINK_CLOSE_SECONDS - BLINK_HOLD_SECONDS;
  if (opening < BLINK_OPEN_SECONDS) return 1 - opening / BLINK_OPEN_SECONDS;
  timer.phase = -1;
  timer.wait = nextBlinkWait(timer.random);
  return 0;
}

// ── Body pose ──

export const POSE_BONES = [
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "leftUpperArm",
  "rightUpperArm",
  "leftLowerArm",
  "rightLowerArm",
] as const;
export type PoseBone = (typeof POSE_BONES)[number];
/** Euler angles (radians, XYZ order) of normalized humanoid bones, in VRM 1.0 space (model faces +Z). */
export type BodyPose = Record<PoseBone, [x: number, y: number, z: number]>;

/** Upper arms rotate this far down from the T-pose, elbows bend this far forward. */
const ARM_DOWN = 1.2;
const ELBOW_BEND = 0.25;

export interface IdleMotionState {
  tilt: number;
  nod: number;
  lean: number;
  /** A body-only model's voice, eased just enough to nod once per phrase. */
  talk: number;
}

export function createIdleMotionState(): IdleMotionState {
  return { tilt: 0, nod: 0, lean: 0, talk: 0 };
}

/** VRM 0.x models face -Z in their normalized bone space, so x and z rotations flip sign there. */
export function vrm0Mirror(metaVersion: string | undefined): 1 | -1 {
  return metaVersion === "0" ? -1 : 1;
}

/** Arms resting at the sides, plus (when `animate`) breathing, a slow sway and a head pose for the state:
 *  tilted and looking up while thinking, leaning in while listening, nodding a little while talking. A
 *  `bodyOnly` model (no mouth shapes) moves more, and nods and tilts its head with each phrase it speaks. */
export function computeBodyPose(
  state: IdleMotionState,
  timeSeconds: number,
  frame: AvatarFrameInput,
  animate: boolean,
  dtSeconds: number,
  bodyOnly = false,
): BodyPose {
  const pose: BodyPose = {
    hips: [0, 0, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    leftUpperArm: [0, 0, -ARM_DOWN],
    rightUpperArm: [0, 0, ARM_DOWN],
    leftLowerArm: [0, -ELBOW_BEND, 0],
    rightLowerArm: [0, ELBOW_BEND, 0],
  };
  if (!animate) {
    state.tilt = 0;
    state.nod = 0;
    state.lean = 0;
    state.talk = 0;
    return pose;
  }
  const talking = frame.state === "talking" ? clamp01(frame.mouthOpen) : 0;
  const goal =
    frame.state === "thinking"
      ? { tilt: 0.08, nod: -0.06, lean: 0 }
      : frame.state === "listening"
        ? { tilt: -0.05, nod: 0.03, lean: 0.03 }
        : { tilt: 0, nod: bodyOnly ? 0 : talking * 0.04, lean: 0 };
  state.tilt = ease(state.tilt, goal.tilt, dtSeconds, POSE_EASE_SECONDS);
  state.nod = ease(state.nod, goal.nod, dtSeconds, POSE_EASE_SECONDS);
  state.lean = ease(state.lean, goal.lean, dtSeconds, POSE_EASE_SECONDS);
  state.talk = ease(state.talk, bodyOnly ? talking : 0, dtSeconds, TALK_EASE_SECONDS);

  // A model with a face keeps gain 1 and talk 0, so its pose is exactly what it always was.
  const gain = bodyOnly ? BODY_ONLY_GAIN : 1;
  const t = timeSeconds * Math.PI * 2;
  const breath = Math.sin(t / 4.2) * gain;
  const talk = state.talk * gain;
  const nod = state.nod + talk * 0.04;
  pose.spine = [breath * 0.012 + state.lean, 0, Math.sin(t / 5.9) * 0.012 * gain];
  pose.chest = [breath * 0.015 + talk * 0.012, 0, 0];
  pose.hips = [0, Math.sin(t / 7.3) * 0.025 * gain, 0];
  pose.neck = [nod * 0.4, Math.sin(t / 6.7) * 0.02 * gain, 0];
  pose.head = [
    nod * 0.6 + Math.sin(t / 3.1) * 0.006 * gain,
    Math.sin(t / 8.3) * 0.03 * gain,
    state.tilt + Math.sin(t / 2.3) * state.talk * 0.06,
  ];
  pose.leftUpperArm = [0, 0, -ARM_DOWN + breath * 0.012];
  pose.rightUpperArm = [0, 0, ARM_DOWN - breath * 0.012];
  return pose;
}

// ── Drawing size ──

/** Largest drawing size per side, so a huge canvas cannot ask for an unbounded GPU buffer. */
const MAX_PIXELS_PER_SIDE = 2048;

/** Device pixels for a canvas of this CSS size: the pixel ratio is capped at `maxRatio`, and one scale
 *  applies to both sides so the size cap never changes the shape the camera projects into. */
export function canvasPixels(
  width: number,
  height: number,
  devicePixelRatio: number,
  maxRatio: number,
): { width: number; height: number } {
  const cssWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const cssHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const ratio = Math.min(Math.max(Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1, 0.5), maxRatio);
  const scale = Math.min(ratio, MAX_PIXELS_PER_SIDE / Math.max(1, cssWidth, cssHeight));
  return { width: Math.round(cssWidth * scale), height: Math.round(cssHeight * scale) };
}

// ── Camera framing ──

/** World heights (metres) of the model's head and hips bones and its lowest foot, at rest. */
export interface BodyHeights {
  headY: number;
  hipsY: number;
  footY: number;
  /** The top of the model (hair, ears, a hat), when measured. */
  topY?: number;
  /** The bottom of the model (the soles), when measured. */
  bottomY?: number;
}

export interface CameraFraming {
  targetY: number;
  distance: number;
}

/** Fits the framed part of the model into a camera with this aspect and vertical field of view, from bone
 *  heights (the head's size scales with the hips-to-head distance) and the measured top and bottom of the
 *  model. Portrait fits the head and shoulders, half body reaches the hips, and full body fits the whole
 *  model from the top of its hair or hat to its soles, with a little floor below. The head stays near the
 *  top: a narrower canvas, which needs the camera further back to fit the width, shows more of the body
 *  below, down to the whole figure. The framing changes smoothly with the canvas shape, so a resize never
 *  flips it. */
export function frameCamera(
  body: BodyHeights,
  aspect: number,
  fovDegrees: number,
  framing: AvatarFraming = "portrait",
): CameraFraming {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const unit = Math.max(0.1, body.headY - body.hipsY);
  const measuredTop = Number.isFinite(body.topY) ? body.topY! : -Infinity;
  // A head and a bit above the head bone reaches the top of most heads. Hair, ears or a hat that rise higher
  // (a Tripo model's reach 0.3 m and more above its head bone) raise the top, never lower it, so other models
  // frame as before. Closer framings count at most one unit above the head, so a stray part far above can't
  // shrink the face; full body shows all of the model.
  const top = Math.max(
    body.headY + 0.42 * unit,
    framing === "full-body" ? measuredTop : Math.min(measuredTop, body.headY + unit),
  );
  const soles = Math.min(body.footY - 0.03, Number.isFinite(body.bottomY) ? body.bottomY! : Infinity);
  const bottom =
    framing === "full-body"
      ? soles - 0.05 * unit
      : framing === "half-body"
        ? body.hipsY - 0.25 * unit
        : body.headY - 0.6 * unit;
  const feet = framing === "full-body" ? bottom : Math.min(body.footY - 0.03, bottom);
  // Shoulders for a bust; with the hips in view the hanging arms widen it.
  const width = (framing === "portrait" ? 1.1 : 1.4) * unit;
  const margin = 1.08;
  const tanHalf = Math.tan((fovDegrees * Math.PI) / 360);
  const distance = Math.max(((top - bottom) * margin) / 2 / tanHalf, (width * margin) / 2 / (tanHalf * safeAspect));
  const halfView = distance * tanHalf;
  return { targetY: Math.max(top - halfView / margin, (top + feet) / 2), distance };
}
