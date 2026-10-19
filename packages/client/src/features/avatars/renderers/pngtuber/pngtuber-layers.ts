// ──────────────────────────────────────────────
// PNGTuber avatars: layer sets from sprites, and the frame rules the renderer follows (lane: 2D)
// ──────────────────────────────────────────────
// Pure functions (no DOM), shared by the renderer and the setup panel and pinned by
// scripts/regressions/avatar-2d-renderers.regression.ts.
import {
  AVATAR_EMOTIONS,
  AVATAR_EXTRA_FEELINGS,
  AVATAR_FEELING_EMOTIONS,
  PNGTUBER_DEFAULT_MOTION,
  SPRITE_EXPRESSION_LABELS,
  detectSpriteEmotionBindings,
  detectSpriteFeelingBindings,
  isAvatarExtraFeeling,
  normalizeSpriteExpressionKey,
  type AvatarEmotion,
  type AvatarExpressionBinding,
  type AvatarExtraFeeling,
  type AvatarFrameInput,
  type AvatarImageRef,
  type PngtuberAvatarData,
  type PngtuberLayerSet,
} from "@marinara-engine/shared";

/** Crossfade between faces. */
export const PNGTUBER_FADE_MS = 120;
/** How long the eyes stay shut in one blink. */
export const PNGTUBER_BLINK_MS = 140;
/** One hop while talking. */
export const PNGTUBER_HOP_MS = 220;
/** Same bound as the PNGTuber schema in packages/shared/src/schemas/avatars.schema.ts. */
const MAX_LAYER_SETS = 64;
const LAYER_KEY = /^[\p{L}\p{N}_]{1,64}$/u;
const FULL_BODY = /^full[_\s-]+/iu;
const MOUTH_OPEN_SUFFIXES = ["mouth_open", "open_mouth", "talking", "talk", "speaking", "speak"];
const EYES_CLOSED_SUFFIXES = ["eyes_closed", "closed_eyes", "eyes_shut", "blinking", "blink"];

/** Names of the extra feelings (the six have AVATAR_EMOTION_LABEL_KEYS in PngtuberSetupPanel.tsx). */
export const AVATAR_FEELING_LABEL_KEYS: Readonly<Record<AvatarExtraFeeling, string>> = {
  curiosity: "avatars.pngtuber.emotionCuriosity",
  admiration: "avatars.pngtuber.emotionAdmiration",
  amusement: "avatars.pngtuber.emotionAmusement",
  desire: "avatars.pngtuber.emotionDesire",
  embarrassment: "avatars.pngtuber.emotionEmbarrassment",
  excitement: "avatars.pngtuber.emotionExcitement",
  gratitude: "avatars.pngtuber.emotionGratitude",
  optimism: "avatars.pngtuber.emotionOptimism",
  pride: "avatars.pngtuber.emotionPride",
  annoyance: "avatars.pngtuber.emotionAnnoyance",
  disapproval: "avatars.pngtuber.emotionDisapproval",
  disgust: "avatars.pngtuber.emotionDisgust",
  disappointment: "avatars.pngtuber.emotionDisappointment",
  grief: "avatars.pngtuber.emotionGrief",
  nervousness: "avatars.pngtuber.emotionNervousness",
  remorse: "avatars.pngtuber.emotionRemorse",
  approval: "avatars.pngtuber.emotionApproval",
  caring: "avatars.pngtuber.emotionCaring",
  love: "avatars.pngtuber.emotionLove",
  relief: "avatars.pngtuber.emotionRelief",
  confusion: "avatars.pngtuber.emotionConfusion",
  fear: "avatars.pngtuber.emotionFear",
  realization: "avatars.pngtuber.emotionRealization",
};

export interface SpriteLike {
  expression: string;
  url?: string;
}

/** Splits a sprite key like `happy_talk_blink` into its face (`happy`) and the variant its suffixes name. */
export function splitSpriteVariant(key: string): { base: string; mouthOpen: boolean; eyesClosed: boolean } {
  let base = key;
  let mouthOpen = false;
  let eyesClosed = false;
  for (let changed = true; changed;) {
    changed = false;
    for (const [suffixes, isMouth] of [
      [MOUTH_OPEN_SUFFIXES, true],
      [EYES_CLOSED_SUFFIXES, false],
    ] as const) {
      const suffix = suffixes.find((candidate) => base.length > candidate.length + 1 && base.endsWith(`_${candidate}`));
      if (!suffix) continue;
      base = base.slice(0, -(suffix.length + 1));
      if (isMouth) mouthOpen = true;
      else eyesClosed = true;
      changed = true;
    }
  }
  return { base, mouthOpen, eyesClosed };
}

/** A sprite that is another face's talk or blink picture (`happy_talk`, `happy_blink`), not a face itself. */
export function isSpriteVariant(expression: string): boolean {
  const { mouthOpen, eyesClosed } = splitSpriteVariant(normalizeSpriteExpressionKey(expression));
  return mouthOpen || eyesClosed;
}

/** A full-body sprite (`full_happy`, `Full Happy`), not a portrait. */
export function isFullBodySprite(expression: string): boolean {
  return FULL_BODY.test(expression.trim());
}

/** The sprites a PNGTuber setup uses: portrait sprites when there are any, otherwise full-body ones, so the
 *  faces never mix the two framings. */
export function pngtuberSpriteFamily<T extends SpriteLike>(sprites: readonly T[]): T[] {
  const portraits = sprites.filter((sprite) => !isFullBodySprite(sprite.expression));
  return portraits.length > 0 ? portraits : [...sprites];
}

/** A PNGTuber setup built from an owner's expression sprites: one layer set per face, with `_talk` and
 *  `_blink` sprites (and their spelling variants) as its mouth-open and eyes-closed pictures, and a face for each
 *  extra feeling a sprite is named after. The suggested labels and the feelings' names come first, so the
 *  64-face cap (`limit`) never drops them. Null when the owner has no usable sprite. */
export function buildPngtuberLayersFromSprites(
  sprites: readonly SpriteLike[],
  limit = MAX_LAYER_SETS,
): PngtuberAvatarData | null {
  const layers = new Map<string, PngtuberLayerSet>();
  const variants: { base: string; key: string; mouthOpen: boolean; eyesClosed: boolean }[] = [];
  for (const sprite of pngtuberSpriteFamily(sprites)) {
    const key = normalizeSpriteExpressionKey(sprite.expression);
    if (!LAYER_KEY.test(key)) continue;
    const split = splitSpriteVariant(key);
    if (split.mouthOpen || split.eyesClosed) variants.push({ ...split, key });
    else if (!layers.has(key)) layers.set(key, { base: { source: "sprite", label: key } });
  }
  for (const variant of variants) {
    const set = layers.get(variant.base);
    if (!set) continue;
    const slot =
      variant.mouthOpen && variant.eyesClosed ? "eyesClosedMouthOpen" : variant.mouthOpen ? "mouthOpen" : "eyesClosed";
    set[slot] ??= { source: "sprite", label: variant.key };
  }
  const known: readonly string[] = [...SPRITE_EXPRESSION_LABELS, ...AVATAR_EXTRA_FEELINGS];
  const rank = (key: string) => (known.includes(key) ? known.indexOf(key) : known.length);
  const keys = [...layers.keys()]
    .sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))
    .slice(0, limit);
  if (keys.length === 0) return null;
  return {
    layers: Object.fromEntries(keys.map((key) => [key, layers.get(key)!])),
    expressionMap: detectSpriteEmotionBindings(keys),
    feelingMap: detectSpriteFeelingBindings(keys),
    motion: { ...PNGTUBER_DEFAULT_MOTION },
    source: "sprites",
  };
}

/** Every face a feeling can be given: the setup's own, then each sprite face it doesn't have yet, also ones named
 *  after a feeling, so any sprite can be chosen. Choosing one adds one face, so a setup at the 64-face cap offers
 *  only its own. A PNGTuber Plus import keeps its own faces. */
export function pngtuberFaceChoices(
  shown: PngtuberAvatarData | null,
  fromSprites: PngtuberAvatarData | null,
): Record<string, PngtuberLayerSet> {
  if (!shown) return {};
  if (shown.source === "pngtuber-plus" || !fromSprites) return shown.layers;
  if (Object.keys(shown.layers).length >= MAX_LAYER_SETS) return shown.layers;
  const added = Object.entries(fromSprites.layers).filter(([key]) => !Object.hasOwn(shown.layers, key));
  return added.length ? { ...shown.layers, ...Object.fromEntries(added) } : shown.layers;
}

/** A face the face maker saved: the sprite label it was saved as, and the face it was drawn as. */
export interface SavedTalkingHeadFace {
  label: string;
  drawnAs?: string;
}

/** The setup with each face the face maker just saved as its feeling's face, over any earlier choice: making a
 *  face is the user's choice. A face saved under a feeling's name (`happy`) is that feeling's; one renamed in the
 *  last step (`happy_2`) is the face it was drawn as. Its face set starts again from the sprite, because talk and
 *  blink pictures made for an older picture would not match it. Other feelings and faces stay as they are, and
 *  so does a PNGTuber Plus import. */
export function withGeneratedFaces(
  data: PngtuberAvatarData,
  saved: readonly SavedTalkingHeadFace[],
): PngtuberAvatarData {
  if (data.source === "pngtuber-plus") return data;
  const feelingOf = (value: string | undefined): AvatarEmotion | AvatarExtraFeeling | null => {
    const key = value ? normalizeSpriteExpressionKey(value) : "";
    return (AVATAR_EMOTIONS as readonly string[]).includes(key) || isAvatarExtraFeeling(key)
      ? (key as AvatarEmotion | AvatarExtraFeeling)
      : null;
  };
  const faces = new Map<AvatarEmotion | AvatarExtraFeeling, string>();
  for (const { label, drawnAs } of saved) {
    const feeling = feelingOf(label) ? null : feelingOf(drawnAs);
    if (feeling) faces.set(feeling, label);
  }
  // Named faces last, so one saved under a feeling's name wins over one renamed away from it.
  for (const { label } of saved) {
    const feeling = feelingOf(label);
    if (feeling) faces.set(feeling, label);
  }
  if (faces.size === 0) return data;
  const layers = { ...data.layers };
  const expressionMap = { ...data.expressionMap };
  const feelingMap = { ...data.feelingMap };
  for (const [feeling, label] of faces) {
    const key = normalizeSpriteExpressionKey(label);
    if (!LAYER_KEY.test(key) || (!Object.hasOwn(layers, key) && Object.keys(layers).length >= MAX_LAYER_SETS)) {
      continue;
    }
    layers[key] = { base: { source: "sprite", label: key } };
    const binding: AvatarExpressionBinding = { target: key, source: "user", confidence: 1 };
    if (isAvatarExtraFeeling(feeling)) feelingMap[feeling] = binding;
    else expressionMap[feeling] = binding;
  }
  return { ...data, layers, expressionMap, feelingMap };
}

/** The layer set a frame shows: the exact sprite label when the setup has it (an Expression Engine or
 *  Game Master pick), else the face of the frame's feeling when it belongs to the frame's emotion, else the set
 *  bound to the frame's emotion, else the resting face. */
export function pickPngtuberLayerKey(
  data: Pick<PngtuberAvatarData, "layers" | "expressionMap" | "feelingMap">,
  frame: Pick<AvatarFrameInput, "emotion" | "label" | "feeling">,
): string | null {
  const has = (key: string | null | undefined): key is string => !!key && Object.hasOwn(data.layers, key);
  const label = frame.label ? normalizeSpriteExpressionKey(frame.label) : null;
  if (has(label)) return label;
  const feeling =
    frame.feeling && AVATAR_FEELING_EMOTIONS[frame.feeling]?.emotion === frame.emotion
      ? data.feelingMap?.[frame.feeling]?.target
      : null;
  if (has(feeling)) return feeling;
  const bound = data.expressionMap[frame.emotion]?.target;
  if (has(bound)) return bound;
  const neutral = data.expressionMap.neutral?.target;
  if (has(neutral)) return neutral;
  if (has("neutral")) return "neutral";
  return Object.keys(data.layers)[0] ?? null;
}

/** One face of the talking head, with the feelings that show it. */
export interface TalkingHeadFace {
  key: string;
  emotions: AvatarEmotion[];
  /** Extra feelings with this face of their own. */
  feelings: AvatarExtraFeeling[];
  set: PngtuberLayerSet;
  /** The sprite new pictures are drawn from; null when the face has none (an imported or deleted one). */
  label: string | null;
}

/** The faces the talking head shows for the six feelings, in feeling order, then the faces of extra feelings
 *  that have one of their own, each once with every feeling that shows it: the face the renderer picks
 *  (pickPngtuberLayerKey), or, while a setup made from sprites has no face for a feeling the user didn't choose,
 *  the sprite face made for it since (saving its pictures adds it). An extra feeling without its own face shows
 *  its emotion's, so its emotion's row covers it. A PNGTuber Plus import keeps its own faces: sprites never join
 *  it this way.
 *  ponytail: faces reached only by an exact Expression Engine or Game Master label aren't listed; a collapsed
 *  "Other faces" group is the upgrade. */
export function talkingHeadFaces(
  shown: PngtuberAvatarData | null,
  fromSprites: PngtuberAvatarData | null,
  labelFor: (key: string) => string | null,
): TalkingHeadFace[] {
  if (!shown) return [];
  const faces = new Map<string, TalkingHeadFace>();
  const faceFor = (key: string) => {
    let face = faces.get(key);
    if (!face) {
      const set = Object.hasOwn(shown.layers, key) ? shown.layers[key]! : fromSprites!.layers[key]!;
      face = { key, emotions: [], feelings: [], set, label: labelFor(key) };
      faces.set(key, face);
    }
    return face;
  };
  /** The sprite face made for a slot since the setup was saved, when the setup has none the user chose. */
  const freshFace = (binding: AvatarExpressionBinding | undefined, fresh: string | null | undefined) =>
    shown.source !== "pngtuber-plus" &&
    binding?.source !== "user" &&
    !(binding?.target && Object.hasOwn(shown.layers, binding.target)) &&
    fresh &&
    Object.hasOwn(fromSprites!.layers, fresh)
      ? fresh
      : null;
  for (const emotion of AVATAR_EMOTIONS) {
    const key =
      freshFace(shown.expressionMap[emotion], fromSprites?.expressionMap[emotion]?.target) ??
      pickPngtuberLayerKey(shown, { emotion });
    if (key) faceFor(key).emotions.push(emotion);
  }
  for (const feeling of AVATAR_EXTRA_FEELINGS) {
    const binding = shown.feelingMap?.[feeling];
    const own = binding?.target && Object.hasOwn(shown.layers, binding.target) ? binding.target : null;
    const key = own ?? freshFace(binding, fromSprites?.feelingMap?.[feeling]?.target);
    if (key) faceFor(key).feelings.push(feeling);
  }
  return [...faces.values()];
}

/** The picture of a layer set for the mouth and eyes right now; a missing variant falls back to one the set
 *  has, so a single sprite still works. While talking and blinking at once, the open mouth wins. */
export function pickPngtuberPicture(set: PngtuberLayerSet, mouthOpen: boolean, eyesClosed: boolean): AvatarImageRef {
  if (mouthOpen && eyesClosed) return set.eyesClosedMouthOpen ?? set.mouthOpen ?? set.eyesClosed ?? set.base;
  if (mouthOpen) return set.mouthOpen ?? set.base;
  if (eyesClosed) return set.eyesClosed ?? set.base;
  return set.base;
}

/** Mouth open or shut for one frame, with hysteresis so a level hovering at the edge does not flicker. Vowels
 *  open it and consonants close it: the director's speech clock holds consonants at 0.2 and vowels at 0.5 or
 *  more, and text-to-speech levels are scaled so the loud parts of a clip reach 1. */
export function nextPngtuberMouthOpen(wasOpen: boolean, mouthOpen: number): boolean {
  return wasOpen ? mouthOpen >= 0.3 : mouthOpen > 0.42;
}

export interface PngtuberBlinkClock {
  /** Time until the next blink starts. */
  waitMs: number;
  /** Time left in the blink now showing; 0 when the eyes are open. */
  closedMs: number;
}

/** Seconds between blinks, randomised to two thirds and four thirds of the average (3 to 6 s for 4.5). */
export function pngtuberBlinkWaitMs(intervalSeconds: number, random: () => number): number {
  return intervalSeconds * 1000 * (2 / 3 + (random() * 2) / 3);
}

/** Advances the blink timer and says whether the eyes are shut now. */
export function advancePngtuberBlink(
  clock: PngtuberBlinkClock,
  dtMs: number,
  intervalSeconds: number,
  random: () => number,
): boolean {
  if (clock.closedMs > 0) {
    clock.closedMs -= dtMs;
    if (clock.closedMs > 0) return true;
    clock.closedMs = 0;
    clock.waitMs = pngtuberBlinkWaitMs(intervalSeconds, random);
    return false;
  }
  clock.waitMs -= dtMs;
  if (clock.waitMs > 0) return false;
  clock.closedMs = PNGTUBER_BLINK_MS;
  return true;
}

/** Height of a hop, 0..1 of the bounce height, `elapsedMs` after it started. */
export function pngtuberHop(elapsedMs: number): number {
  const progress = elapsedMs / PNGTUBER_HOP_MS;
  return progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * progress);
}

/** Breathing: a slow vertical stretch of about one percent. */
export function pngtuberBreath(timeMs: number): number {
  return 1 + 0.01 * Math.sin((2 * Math.PI * timeMs) / 3600);
}

/** Thinking: a slow tilt of about one degree each way. */
export function pngtuberThinkingTilt(timeMs: number): number {
  return 0.018 * Math.sin((2 * Math.PI * timeMs) / 5000);
}

/** Where a picture sits in the canvas: as large as fits, centred and standing on the bottom edge, with room
 *  above for the hop. */
export function fitPngtuberPicture(
  canvasWidth: number,
  canvasHeight: number,
  pictureWidth: number,
  pictureHeight: number,
  headroom: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(canvasWidth / pictureWidth, (canvasHeight * (1 - headroom)) / pictureHeight);
  const width = pictureWidth * scale;
  const height = pictureHeight * scale;
  return { x: (canvasWidth - width) / 2, y: canvasHeight - height, width, height };
}
