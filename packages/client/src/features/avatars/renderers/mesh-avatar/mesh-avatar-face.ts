// ──────────────────────────────────────────────
// Mesh avatars: what one frame asks of the mesh-avatar runtime (lane: 2D)
// ──────────────────────────────────────────────
// Pure functions (no DOM and no mesh-avatar import), so the setup panel can use the names without loading
// the runtime, and scripts/regressions/avatar-2d-renderers.regression.ts can pin the mapping.
import type { AvatarEmotion, AvatarExpressionMap, AvatarFrameInput, AvatarViseme } from "@marinara-engine/shared";

/** mesh-avatar 0.1.1 emotion tags (setEmotion): the same six names as the avatar emotions. */
export const MESH_AVATAR_EMOTION_TAGS: readonly AvatarEmotion[] = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
];
/** mesh-avatar 0.1.1 live expressions (setExpression) offered besides the emotion tags; its `angry`, `sad`,
 *  `surprise` and `neutral` overlays repeat the tags above. */
export const MESH_AVATAR_EXTRA_EXPRESSIONS = ["smile", "shy", "halfLidded", "wink"] as const;
const LIVE_EXPRESSIONS = new Set<string>(["neutral", "smile", "shy", "surprise", "halfLidded", "angry", "sad", "wink"]);
const EMOTION_TAGS = new Set<string>(MESH_AVATAR_EMOTION_TAGS);
const VOWELS: Readonly<Record<AvatarViseme, string>> = { aa: "a", ih: "i", ou: "u", ee: "e", oh: "o" };
const VALID_VOWELS = new Set(["a", "i", "u", "e", "o"]);
/** Below this weight a feeling is too faint to change the face. */
const MIN_EMOTION_WEIGHT = 0.25;
/** Below this opening a mouth shape closes. */
const MIN_MOUTH_OPEN = 0.08;

export interface MeshAvatarFace {
  /** setEmotion tag. */
  emotion: AvatarEmotion;
  /** setExpression overlay; `neutral` clears it. */
  expression: string;
}

/** The runtime face for a frame: the binding's target when it is a tag or a live expression, otherwise
 *  the frame's own emotion. */
export function meshAvatarFace(
  expressionMap: AvatarExpressionMap,
  frame: Pick<AvatarFrameInput, "emotion" | "emotionWeight">,
): MeshAvatarFace {
  const emotion = frame.emotionWeight >= MIN_EMOTION_WEIGHT ? frame.emotion : "neutral";
  const target = expressionMap[emotion]?.target ?? emotion;
  if (EMOTION_TAGS.has(target)) return { emotion: target as AvatarEmotion, expression: "neutral" };
  if (LIVE_EXPRESSIONS.has(target)) return { emotion: "neutral", expression: target };
  return { emotion, expression: "neutral" };
}

export type MeshAvatarMouth =
  | { mode: "off" }
  /** A known mouth shape (the speech clock): hold that vowel, or `n` to close. */
  | { mode: "hold"; vowel: string }
  /** Only a loudness (text-to-speech audio): the runtime picks vowels per syllable. */
  | { mode: "voice"; level: number };

export function meshAvatarMouth(
  expressionMap: AvatarExpressionMap,
  frame: Pick<AvatarFrameInput, "viseme" | "mouthOpen">,
  lipSync: boolean,
): MeshAvatarMouth {
  if (!lipSync) return { mode: "off" };
  if (frame.viseme) {
    const bound = expressionMap[frame.viseme]?.target;
    const vowel = bound && VALID_VOWELS.has(bound) ? bound : VOWELS[frame.viseme];
    return { mode: "hold", vowel: frame.mouthOpen > MIN_MOUTH_OPEN ? vowel : "n" };
  }
  return { mode: "voice", level: Math.max(0, Math.min(1, frame.mouthOpen)) };
}

/** How open mesh-avatar 0.1.1 holds the eyes for each emotion tag (the eyeOpen of the preset setEmotion picks:
 *  happyTalk, angryTalk, sadTalk, relaxedTalk, surprisedTalk). An eyelid override replaces the runtime's own
 *  eyes, emotion included, so overrides start from these. */
export const MESH_AVATAR_EMOTION_EYE_OPEN: Readonly<Record<AvatarEmotion, number>> = {
  neutral: 1,
  happy: 0.8,
  angry: 0.72,
  sad: 0.78,
  relaxed: 0.82,
  surprised: 1.18,
};

/** Eases the eyes toward an emotion's openness at the runtime's own expression rate (9 per second), so an
 *  override follows a face change as smoothly as the brows do. */
export function easeMeshAvatarEyes(current: number, emotion: AvatarEmotion, seconds: number): number {
  const target = MESH_AVATAR_EMOTION_EYE_OPEN[emotion];
  return current + (target - current) * (1 - Math.exp(-Math.max(0, seconds) * 9));
}

/** Parameter overrides (setParameters) for one frame: the head held still for reduced motion or with idle
 *  motion off, eyelids when the director drives the blink or blinking is off, and the gaze. `eyeOpen` is the
 *  face's own eye openness (easeMeshAvatarEyes), which the eyelids keep. */
export function meshAvatarOverrides(
  frame: Pick<AvatarFrameInput, "blink" | "lookAt">,
  options: { still: boolean; blink: boolean; eyeOpen: number; mouthOpen?: number },
): Record<string, number> {
  const overrides: Record<string, number> = {};
  if (options.mouthOpen !== undefined) overrides.mouthOpen = Math.max(0, Math.min(1, options.mouthOpen));
  if (options.still) {
    Object.assign(overrides, { angleX: 0, angleY: 0, angleZ: 0, bodyAngleX: 0, bodyAngleZ: 0, breath: 0 });
  }
  const shut = !options.blink ? 0 : frame.blink !== undefined ? Math.max(0, Math.min(1, frame.blink)) : null;
  if (shut !== null) {
    const eyesOpen = Math.round(options.eyeOpen * (1 - shut) * 1000) / 1000;
    Object.assign(overrides, { eyeLOpen: eyesOpen, eyeROpen: eyesOpen });
  }
  if (frame.lookAt) {
    overrides.gazeX = Math.max(-1, Math.min(1, frame.lookAt.x));
    overrides.gazeY = Math.max(-1, Math.min(1, frame.lookAt.y));
  }
  return overrides;
}

interface Size {
  width: number;
  height: number;
}

/** Where a drawing made at `drawn` pixels goes on a `target` canvas so the avatar looks as if drawn at the
 *  target's own size. mesh-avatar 0.1.1 (Renderer.resize, fit "contain") scales the picture plus the rig's
 *  margins to fit, centred and standing on the bottom edge, so one scale and a bottom-centre anchor map one
 *  size onto the other. The rectangle may overhang the target; drawImage clips it. */
export function meshAvatarCopyRect(
  rig: { image: Size; view: { padTop: number; padSide: number } },
  drawn: Size,
  target: Size,
): { x: number; y: number; width: number; height: number } {
  const boxWidth = rig.image.width * (1 + 2 * rig.view.padSide);
  const boxHeight = rig.image.height * (1 + rig.view.padTop);
  const fit = (size: Size) => Math.min(size.width / boxWidth, size.height / boxHeight);
  const scale = fit(target) / fit(drawn);
  const width = drawn.width * scale;
  const height = drawn.height * scale;
  return { x: (target.width - width) / 2, y: target.height - height, width, height };
}
