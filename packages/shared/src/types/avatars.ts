// ──────────────────────────────────────────────
// Avatar agents: the shared contract for 2D and 3D avatars
// ──────────────────────────────────────────────
// Two downloadable agents, "2D Avatars" and "3D Avatars", give Characters and Personas an animated
// avatar. The packages in Pasta-Devs/Marinara-Agents stay thin (agent definitions, default prompts,
// locales and the catalog entry). The Engine owns everything else: storage, import, the lazy-loaded
// renderers, the setup on each agent's Agent editor page, the stream director, the classifier and
// the generation routes. Live2D is intentionally unsupported: its licence needs Live2D's review and
// a separate agreement even for free open-source apps, and its runtime cannot be bundled.
// Developer notes: docs/development/optional-agent-packages.md, "Capability API 1.73: the avatar agents".
import { normalizeSpriteExpressionKey, normalizeSpriteLookupToken } from "../utils/sprite-labels.js";

// ── Agents ──

/** Package id and agent id of the 2D agent (PNGTuber sprites and mesh avatars). */
export const AVATAR_2D_AGENT_ID = "2d-avatars";
/** Package id and agent id of the 3D agent (VRM models). */
export const AVATAR_3D_AGENT_ID = "3d-avatars";
export const AVATAR_AGENT_IDS = [AVATAR_2D_AGENT_ID, AVATAR_3D_AGENT_ID] as const;
export type AvatarAgentId = (typeof AVATAR_AGENT_IDS)[number];

export function isAvatarAgentId(value: unknown): value is AvatarAgentId {
  return value === AVATAR_2D_AGENT_ID || value === AVATAR_3D_AGENT_ID;
}

// ── Expression contract (shared by 2D and 3D) ──

/** Emotions are the VRM 1.0 expression presets; mesh-avatar uses the same six names. */
export const AVATAR_EMOTIONS = ["neutral", "happy", "angry", "sad", "relaxed", "surprised"] as const;
export type AvatarEmotion = (typeof AVATAR_EMOTIONS)[number];

/** Mouth shapes are the VRM 1.0 viseme presets (the vowels a, i, u, e, o). */
export const AVATAR_VISEMES = ["aa", "ih", "ou", "ee", "oh"] as const;
export type AvatarViseme = (typeof AVATAR_VISEMES)[number];

/** States drive body motion, not the face: waiting for a reply, speaking, or the user typing. */
export const AVATAR_STATES = ["idle", "thinking", "talking", "listening"] as const;
export type AvatarState = (typeof AVATAR_STATES)[number];

/** One frame of what the director wants an avatar to show. Renderers only read this. */
export interface AvatarFrameInput {
  emotion: AvatarEmotion;
  /** 0..1: how strongly the emotion shows. */
  emotionWeight: number;
  /** The sprite expression label behind the emotion when one is known (an Expression Engine or Game Master
   *  pick). A PNGTuber setup shows that exact layer set when it has one; other renderers ignore it. */
  label?: string | null;
  /** The more specific feeling inside `emotion` (AVATAR_FEELING_EMOTIONS), only ever one whose emotion is this
   *  frame's. A PNGTuber setup shows its face when it has one (`feelingMap`), else the emotion's face; other
   *  renderers ignore it. */
  feeling?: AvatarExtraFeeling | null;
  /** Mouth shape right now, or null when the mouth rests. */
  viseme: AvatarViseme | null;
  /** 0..1 mouth opening from the speech clock (streamed text) or the TTS audio level. */
  mouthOpen: number;
  /** 0..1 eyelid closure. Omitted means the renderer blinks on its own timer. */
  blink?: number;
  state: AvatarState;
  /** Gaze target in stage coordinates, -1..1 on both axes with +y up. Omitted means straight ahead. */
  lookAt?: { x: number; y: number };
}

export const AVATAR_NEUTRAL_FRAME: Readonly<AvatarFrameInput> = Object.freeze({
  emotion: "neutral",
  emotionWeight: 1,
  viseme: null,
  mouthOpen: 0,
  state: "idle",
});

// ── Sprite expression labels → emotions ──

/** Every label the Character and Persona sprite editors suggest, which is also every label the
 *  roleplay sprite fallback `detectExpression()` returns (packages/client/src/components/chat/SpriteOverlay.tsx).
 *  The Expression Engine picks from the labels an owner actually has, so free-form labels go through the
 *  word stems below. */
export const SPRITE_EXPRESSION_LABELS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "embarrassed",
  "thinking",
  "laughing",
  "worried",
  "scared",
  "disgusted",
  "love",
  "smirk",
  "crying",
  "determined",
  "hurt",
  "blushing",
] as const;
export type SpriteExpressionLabel = (typeof SPRITE_EXPRESSION_LABELS)[number];

export interface AvatarEmotionWeight {
  emotion: AvatarEmotion;
  /** 0..1: how much of the emotion the label carries. */
  weight: number;
}

// ── Feelings: the 28 the emotion classifier detects ──

/** The GoEmotions labels the streaming emotion classifier scores, in the model's order. Each belongs to one of
 *  the six emotions (AVATAR_FEELING_EMOTIONS), which is all 3D and mesh avatars show. */
export const AVATAR_FEELINGS = [
  "admiration",
  "amusement",
  "anger",
  "annoyance",
  "approval",
  "caring",
  "confusion",
  "curiosity",
  "desire",
  "disappointment",
  "disapproval",
  "disgust",
  "embarrassment",
  "excitement",
  "fear",
  "gratitude",
  "grief",
  "joy",
  "love",
  "nervousness",
  "optimism",
  "pride",
  "realization",
  "relief",
  "remorse",
  "sadness",
  "surprise",
  "neutral",
] as const;
export type AvatarFeeling = (typeof AVATAR_FEELINGS)[number];

/** The emotion each feeling belongs to and how much of it the feeling carries. */
export const AVATAR_FEELING_EMOTIONS: Readonly<Record<AvatarFeeling, AvatarEmotionWeight>> = Object.freeze({
  admiration: { emotion: "happy", weight: 0.6 },
  amusement: { emotion: "happy", weight: 1 },
  anger: { emotion: "angry", weight: 1 },
  annoyance: { emotion: "angry", weight: 0.6 },
  approval: { emotion: "relaxed", weight: 0.4 },
  caring: { emotion: "relaxed", weight: 0.8 },
  confusion: { emotion: "surprised", weight: 0.4 },
  curiosity: { emotion: "neutral", weight: 1 },
  desire: { emotion: "happy", weight: 0.5 },
  disappointment: { emotion: "sad", weight: 0.7 },
  disapproval: { emotion: "angry", weight: 0.5 },
  disgust: { emotion: "angry", weight: 0.6 },
  embarrassment: { emotion: "happy", weight: 0.4 },
  excitement: { emotion: "happy", weight: 0.9 },
  fear: { emotion: "surprised", weight: 0.8 },
  gratitude: { emotion: "happy", weight: 0.7 },
  grief: { emotion: "sad", weight: 1 },
  joy: { emotion: "happy", weight: 1 },
  love: { emotion: "relaxed", weight: 1 },
  nervousness: { emotion: "sad", weight: 0.5 },
  optimism: { emotion: "happy", weight: 0.6 },
  pride: { emotion: "happy", weight: 0.6 },
  realization: { emotion: "surprised", weight: 0.5 },
  relief: { emotion: "relaxed", weight: 0.8 },
  remorse: { emotion: "sad", weight: 0.7 },
  sadness: { emotion: "sad", weight: 1 },
  surprise: { emotion: "surprised", weight: 1 },
  neutral: { emotion: "neutral", weight: 1 },
});

/** The 23 feelings a talking head (PNGTuber) can give a face of its own, grouped by their emotion in
 *  AVATAR_EMOTIONS order. The other five (neutral, joy, anger, sadness, surprise) are the main faces
 *  themselves. A feeling without its own face shows its emotion's face. */
export const AVATAR_EXTRA_FEELINGS = [
  "curiosity",
  "admiration",
  "amusement",
  "desire",
  "embarrassment",
  "excitement",
  "gratitude",
  "optimism",
  "pride",
  "annoyance",
  "disapproval",
  "disgust",
  "disappointment",
  "grief",
  "nervousness",
  "remorse",
  "approval",
  "caring",
  "love",
  "relief",
  "confusion",
  "fear",
  "realization",
] as const satisfies readonly AvatarFeeling[];
export type AvatarExtraFeeling = (typeof AVATAR_EXTRA_FEELINGS)[number];

export function isAvatarExtraFeeling(value: unknown): value is AvatarExtraFeeling {
  return typeof value === "string" && (AVATAR_EXTRA_FEELINGS as readonly string[]).includes(value);
}

/** The talking head's faces grouped by emotion: each main face, then the extra feelings that fall back to it. */
export const AVATAR_FACE_GROUPS: ReadonlyArray<readonly [AvatarEmotion, ...AvatarExtraFeeling[]]> = AVATAR_EMOTIONS.map(
  (emotion) =>
    [
      emotion,
      ...AVATAR_EXTRA_FEELINGS.filter((feeling) => AVATAR_FEELING_EMOTIONS[feeling].emotion === emotion),
    ] as const,
);

export const SPRITE_EXPRESSION_AVATAR_EMOTIONS: Readonly<Record<SpriteExpressionLabel, AvatarEmotionWeight>> =
  Object.freeze({
    neutral: { emotion: "neutral", weight: 1 },
    happy: { emotion: "happy", weight: 1 },
    sad: { emotion: "sad", weight: 1 },
    angry: { emotion: "angry", weight: 1 },
    surprised: { emotion: "surprised", weight: 1 },
    embarrassed: { emotion: "happy", weight: 0.4 },
    thinking: { emotion: "neutral", weight: 1 },
    laughing: { emotion: "happy", weight: 1 },
    worried: { emotion: "sad", weight: 0.5 },
    scared: { emotion: "surprised", weight: 0.7 },
    disgusted: { emotion: "angry", weight: 0.5 },
    love: { emotion: "relaxed", weight: 1 },
    smirk: { emotion: "happy", weight: 0.4 },
    crying: { emotion: "sad", weight: 1 },
    determined: { emotion: "angry", weight: 0.4 },
    hurt: { emotion: "sad", weight: 0.7 },
    blushing: { emotion: "happy", weight: 0.4 },
  });

/** VRM 0.x preset names and the six emotions themselves, matched exactly. */
const AVATAR_EMOTION_EXACT_NAMES: Readonly<Record<string, AvatarEmotionWeight>> = Object.freeze({
  relaxed: { emotion: "relaxed", weight: 1 },
  joy: { emotion: "happy", weight: 1 },
  fun: { emotion: "relaxed", weight: 1 },
  sorrow: { emotion: "sad", weight: 1 },
});

/** Word stems for free-form labels (Game Master lines, custom sprite names), tried in order against the
 *  lookup token, so a longer or negated stem comes before the stem it contains. */
const AVATAR_EMOTION_STEMS: ReadonlyArray<readonly [stem: string, emotion: AvatarEmotion, weight: number]> = [
  ["unhappy", "sad", 0.7],
  ["funny", "happy", 0.8],
  ["laugh", "happy", 1],
  ["happy", "happy", 1],
  ["joy", "happy", 1],
  ["cheer", "happy", 0.9],
  ["excit", "happy", 0.9],
  ["delight", "happy", 0.9],
  ["smil", "happy", 0.8],
  ["grin", "happy", 0.8],
  ["glad", "happy", 0.7],
  ["proud", "happy", 0.6],
  ["playful", "happy", 0.6],
  ["amus", "happy", 0.6],
  ["smirk", "happy", 0.4],
  ["blush", "happy", 0.4],
  ["embarrass", "happy", 0.4],
  ["shy", "happy", 0.3],
  ["courag", "happy", 0.5],
  ["furious", "angry", 1],
  ["rage", "angry", 1],
  ["anger", "angry", 1],
  ["angry", "angry", 1],
  ["glar", "angry", 0.8],
  ["frustrat", "angry", 0.7],
  ["annoy", "angry", 0.6],
  ["irrit", "angry", 0.6],
  ["disgust", "angry", 0.5],
  ["determin", "angry", 0.4],
  ["stern", "angry", 0.4],
  ["cry", "sad", 1],
  ["sob", "sad", 1],
  ["weep", "sad", 1],
  ["sad", "sad", 1],
  ["sorrow", "sad", 1],
  ["grief", "sad", 1],
  ["tear", "sad", 0.9],
  ["hurt", "sad", 0.7],
  ["pain", "sad", 0.7],
  ["disappoint", "sad", 0.6],
  ["lonel", "sad", 0.6],
  ["guilt", "sad", 0.6],
  ["regret", "sad", 0.6],
  ["worr", "sad", 0.5],
  ["anxi", "sad", 0.5],
  ["nervous", "sad", 0.4],
  ["surpris", "surprised", 1],
  ["shock", "surprised", 1],
  ["astonish", "surprised", 1],
  ["startl", "surprised", 0.9],
  ["gasp", "surprised", 0.9],
  ["amaz", "surprised", 0.8],
  ["terrif", "surprised", 0.8],
  ["panic", "surprised", 0.8],
  ["scare", "surprised", 0.7],
  ["fear", "surprised", 0.7],
  ["afraid", "surprised", 0.7],
  ["confus", "surprised", 0.3],
  ["relax", "relaxed", 1],
  ["love", "relaxed", 1],
  ["affection", "relaxed", 0.9],
  ["calm", "relaxed", 0.8],
  ["content", "relaxed", 0.8],
  ["peace", "relaxed", 0.8],
  ["seren", "relaxed", 0.8],
  ["tender", "relaxed", 0.8],
  ["relie", "relaxed", 0.7],
  ["fond", "relaxed", 0.7],
  ["sleep", "relaxed", 0.6],
  ["tired", "relaxed", 0.4],
  ["neutral", "neutral", 1],
  ["default", "neutral", 1],
  ["idle", "neutral", 1],
  ["think", "neutral", 1],
  ["ponder", "neutral", 1],
  ["curious", "neutral", 1],
  ["serious", "neutral", 1],
  ["focus", "neutral", 1],
];

const SPRITE_LABEL_EMOTIONS_BY_TOKEN: ReadonlyMap<string, AvatarEmotionWeight> = new Map(
  [
    ...Object.entries(SPRITE_EXPRESSION_AVATAR_EMOTIONS),
    ...AVATAR_EMOTIONS.map((emotion) => [emotion, { emotion, weight: 1 }] as const),
    ...Object.entries(AVATAR_EMOTION_EXACT_NAMES),
  ].map(([label, value]): [string, AvatarEmotionWeight] => [normalizeSpriteLookupToken(label), value]),
);

/** The emotion a sprite expression label (or a Game Master expression) stands for, or null when the label
 *  names nothing the six emotions cover. Labels are normalized like sprite lookups, so `full_happy`,
 *  `Happy` and `happy-1` all match `happy`. */
export function mapSpriteExpressionToAvatarEmotion(label: string | null | undefined): AvatarEmotionWeight | null {
  if (typeof label !== "string") return null;
  const token = normalizeSpriteLookupToken(label).replace(/\d+$/u, "");
  if (!token) return null;
  const exact = SPRITE_LABEL_EMOTIONS_BY_TOKEN.get(token);
  if (exact) return { ...exact };
  for (const [stem, emotion, weight] of AVATAR_EMOTION_STEMS) {
    if (token.includes(stem)) return { emotion, weight };
  }
  // A feeling's own name or word (`gratitude`, `smug`) carries that feeling's emotion.
  const feeling = mapSpriteExpressionToAvatarFeeling(label);
  return feeling ? { ...AVATAR_FEELING_EMOTIONS[feeling] } : null;
}

/** Other words for each extra feeling, matched as whole words of a sprite label. Each one either maps to no
 *  emotion through the stems above or to its feeling's own emotion, so a feeling's face never contradicts the
 *  emotion picked for the same label. */
const AVATAR_FEELING_SYNONYMS: Readonly<Record<AvatarExtraFeeling, readonly string[]>> = {
  curiosity: ["curious", "interested", "intrigued", "wondering", "thinking", "pondering"],
  admiration: ["admiring", "awe", "impressed", "starstruck"],
  amusement: ["amused", "laughing", "laugh", "giggle", "chuckle", "funny", "smirk"],
  desire: ["longing", "yearning", "lust", "lustful", "seductive", "flirty"],
  embarrassment: ["embarrassed", "blushing", "blush", "flustered", "shy", "sheepish", "awkward"],
  excitement: ["excited", "eager", "thrilled", "hyped"],
  gratitude: ["grateful", "thankful", "thanks"],
  optimism: ["optimistic", "hopeful", "hope"],
  pride: ["proud", "smug", "confident", "triumphant"],
  annoyance: ["annoyed", "irritated", "grumpy", "frustrated", "pout"],
  disapproval: ["disapproving", "skeptical", "unimpressed", "disdain"],
  disgust: ["disgusted", "grossed_out", "revolted", "eww"],
  disappointment: ["disappointed", "letdown", "dejected"],
  grief: ["grieving", "crying", "sobbing", "weeping", "heartbroken", "mourning", "devastated"],
  nervousness: ["nervous", "anxious", "worried", "concerned", "uneasy", "tense"],
  remorse: ["remorseful", "guilty", "guilt", "apologetic", "sorry", "ashamed", "regret"],
  approval: ["approving", "nod", "thumbs_up", "agree"],
  caring: ["care", "gentle", "kind", "sympathetic", "comforting"],
  love: ["loving", "in_love", "affection", "affectionate", "adoring", "heart_eyes"],
  relief: ["relieved", "phew"],
  confusion: ["confused", "puzzled", "perplexed", "huh"],
  fear: ["scared", "afraid", "frightened", "terrified", "horrified", "panic", "panicked"],
  realization: ["realizing", "epiphany", "aha", "eureka"],
};

interface FeelingMatch {
  feeling: AvatarExtraFeeling;
  /** The feeling's own name 1, another word for it 0.8. */
  confidence: number;
}

/** Lookup token → the feeling it names. */
const AVATAR_FEELING_WORDS: ReadonlyMap<string, FeelingMatch> = new Map(
  AVATAR_EXTRA_FEELINGS.flatMap((feeling) => [
    ...AVATAR_FEELING_SYNONYMS[feeling].map((word): [string, FeelingMatch] => [
      normalizeSpriteLookupToken(word),
      { feeling, confidence: 0.8 },
    ]),
    [feeling, { feeling, confidence: 1 }] as [string, FeelingMatch],
  ]),
);

/** The feeling a label names: the whole label first, then each of its words. Never part of a word, so
 *  `scarecrow`, `careful` and `fearless` name nothing. */
function matchSpriteFeeling(label: string): FeelingMatch | null {
  const key = normalizeSpriteExpressionKey(label).replace(/_?\d+$/u, "");
  if (!key) return null;
  const whole = AVATAR_FEELING_WORDS.get(normalizeSpriteLookupToken(key));
  if (whole) return whole;
  for (const word of key.split("_")) {
    const found = AVATAR_FEELING_WORDS.get(word);
    if (found) return found;
  }
  return null;
}

/** The extra feeling a sprite expression label (or a Game Master expression) names, by the feeling's own name
 *  or another word for it (`scared` → fear), or null. Labels are normalized like sprite lookups. */
export function mapSpriteExpressionToAvatarFeeling(label: string | null | undefined): AvatarExtraFeeling | null {
  return typeof label === "string" ? (matchSpriteFeeling(label)?.feeling ?? null) : null;
}

// ── Kinds and owners ──

export const AVATAR_KINDS = ["pngtuber", "mesh-avatar", "vrm"] as const;
export type AvatarKind = (typeof AVATAR_KINDS)[number];

/** The agent that has to be installed and on in a chat for each kind to show. */
export const AVATAR_KIND_AGENT: Readonly<Record<AvatarKind, AvatarAgentId>> = Object.freeze({
  pngtuber: AVATAR_2D_AGENT_ID,
  "mesh-avatar": AVATAR_2D_AGENT_ID,
  vrm: AVATAR_3D_AGENT_ID,
});

export const AVATAR_OWNER_TYPES = ["character", "persona"] as const;
export type AvatarOwnerType = (typeof AVATAR_OWNER_TYPES)[number];

/** Character and persona ids are nanoids; imported legacy ids may be UUIDs. Both fit this pattern, which
 *  also keeps an id safe as one folder name. */
export const AVATAR_OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

export interface AvatarOwnerRef {
  ownerType: AvatarOwnerType;
  ownerId: string;
}

// ── Expression bindings (what the model calls each slot) ──

export const AVATAR_EXPRESSION_SLOTS = [...AVATAR_EMOTIONS, ...AVATAR_VISEMES, "blink"] as const;
export type AvatarExpressionSlot = (typeof AVATAR_EXPRESSION_SLOTS)[number];

/** Where a binding came from: the format's own preset names (VRM 1.0 presets, mesh-avatar emotions), a
 *  name match against the model's custom names, the owner's sprite labels (PNGTuber), the user's choice,
 *  or nothing usable found. */
export const AVATAR_EXPRESSION_BINDING_SOURCES = ["preset", "name-match", "sprite-label", "user", "missing"] as const;
export type AvatarExpressionBindingSource = (typeof AVATAR_EXPRESSION_BINDING_SOURCES)[number];

export interface AvatarExpressionBinding {
  /** The model's own name for this slot (VRM expression name, mesh-avatar emotion or expression, PNGTuber
   *  layer-set label), or null when the model has nothing for it. */
  target: string | null;
  source: AvatarExpressionBindingSource;
  /** 0..1: how sure the detection is. A user choice is 1. */
  confidence: number;
}

export type AvatarExpressionMap = Partial<Record<AvatarExpressionSlot, AvatarExpressionBinding>>;

/** Binds each emotion to the best of an owner's sprite labels (PNGTuber setups that reuse sprites). An
 *  emotion no label carries gets a `missing` binding, which renderers treat as "use neutral". */
export function detectSpriteEmotionBindings(labels: readonly string[]): AvatarExpressionMap {
  const map: AvatarExpressionMap = {};
  for (const emotion of AVATAR_EMOTIONS) {
    // A face named after the feeling itself ("relaxed") is that feeling's face, even beside "love".
    const named = labels.find((label) => normalizeSpriteLookupToken(label) === emotion);
    if (named !== undefined) {
      map[emotion] = { target: named, source: "sprite-label", confidence: 1 };
      continue;
    }
    let best: AvatarExpressionBinding = { target: null, source: "missing", confidence: 0 };
    for (const label of labels) {
      const mapped = mapSpriteExpressionToAvatarEmotion(label);
      if (mapped?.emotion === emotion && mapped.weight > best.confidence) {
        best = { target: label, source: "sprite-label", confidence: mapped.weight };
      }
    }
    map[emotion] = best;
  }
  return map;
}

/** Faces for the extra feelings (PNGTuber only), keyed by feeling; targets are layer keys. An absent feeling
 *  shows its emotion's face, and so does a `null` target the user chose. */
export type AvatarFeelingMap = Partial<Record<AvatarExtraFeeling, AvatarExpressionBinding>>;

/** Binds each extra feeling a sprite label names (mapSpriteExpressionToAvatarFeeling) to the best such label:
 *  the feeling's own name before another word for it, the first label on a tie. A label whose own emotion is
 *  another one (`crying_laughing` is happy, so never the grief face) is skipped. Feelings no label names are
 *  left out, so they show their emotion's face. */
export function detectSpriteFeelingBindings(labels: readonly string[]): AvatarFeelingMap {
  const map: AvatarFeelingMap = {};
  for (const label of labels) {
    const match = matchSpriteFeeling(label);
    if (!match) continue;
    const emotion = mapSpriteExpressionToAvatarEmotion(label)?.emotion;
    if (emotion && emotion !== AVATAR_FEELING_EMOTIONS[match.feeling].emotion) continue;
    if (match.confidence > (map[match.feeling]?.confidence ?? 0)) {
      map[match.feeling] = { target: label, source: "sprite-label", confidence: match.confidence };
    }
  }
  return map;
}

// ── Stored files ──

/** Name of the per-owner settings file. */
export const AVATAR_CONFIG_FILENAME = "avatar.json";
export const AVATAR_CONFIG_VERSION = 1;

/** A stored file, relative to the owner's avatar folder: `<kind>/<name>`. Never absolute, never `..`,
 *  never a nested folder, never ending in a dot (Windows drops it), and never a Windows device name.
 *  Check paths with isAvatarFilePath(); the pattern alone does not refuse device names. */
export type AvatarFilePath = string;
export const AVATAR_FILE_PATH_PATTERN =
  /^(?:pngtuber|mesh-avatar|vrm)\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/u;
/** CON, PRN, AUX, NUL, COM0-9 and LPT0-9 name devices on Windows, with or without an extension. */
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu;

export function isAvatarFilePath(value: unknown): value is AvatarFilePath {
  return (
    typeof value === "string" &&
    AVATAR_FILE_PATH_PATTERN.test(value) &&
    !WINDOWS_DEVICE_NAME.test(value.slice(value.indexOf("/") + 1))
  );
}

/** An image a PNGTuber layer shows: one of the owner's existing sprites, by its label normalized with
 *  normalizeSpriteExpressionKey, or a stored file. */
export type AvatarImageRef = { source: "sprite"; label: string } | { source: "file"; path: AvatarFilePath };

/** One PNGTuber layer set: the base picture plus optional variants for talking and blinking. A missing
 *  variant falls back to the base, so a single sprite still bounces while talking. */
export interface PngtuberLayerSet {
  base: AvatarImageRef;
  mouthOpen?: AvatarImageRef;
  eyesClosed?: AvatarImageRef;
  eyesClosedMouthOpen?: AvatarImageRef;
}

export interface PngtuberMotion {
  /** Hop while talking, like PNGTuber apps do. */
  bounceOnTalk: boolean;
  /** Hop height as a share of the avatar's height, 0..0.25. */
  bounceHeight: number;
  /** Seconds between blinks on average, 1..20. */
  blinkIntervalSeconds: number;
}

/** Motion for a new PNGTuber setup: a small hop while talking and a blink every 4.5 seconds on average. VRM
 *  avatars blink at the same rate; mesh avatars keep the mesh-avatar runtime's own blinking. */
export const PNGTUBER_DEFAULT_MOTION: Readonly<PngtuberMotion> = Object.freeze({
  bounceOnTalk: true,
  bounceHeight: 0.06,
  blinkIntervalSeconds: 4.5,
});

export interface PngtuberAvatarData {
  /** Layer sets keyed by sprite expression label (normalized with normalizeSpriteExpressionKey). */
  layers: Record<string, PngtuberLayerSet>;
  /** Emotion and blink bindings; targets are keys of `layers`. */
  expressionMap: AvatarExpressionMap;
  /** Faces for the extra feelings; targets are keys of `layers`. Optional: setups saved before it had none. */
  feelingMap?: AvatarFeelingMap;
  motion: PngtuberMotion;
  /** Built from the owner's sprites, imported from a PNGTuber Plus `.save`, or generated. */
  source: "sprites" | "pngtuber-plus" | "generated";
}

export interface MeshAvatarData {
  /** The `.mavatar` archive, e.g. `mesh-avatar/model.mavatar`. */
  file: AvatarFilePath;
  /** Targets are mesh-avatar emotion tags or live expression names. */
  expressionMap: AvatarExpressionMap;
  source: "import" | "generated";
}

/** What a VRM file says about itself, read at import and shown in setup. Values stay in the file's own
 *  vocabulary (VRM 1.0 or 0.x); the Engine shows the author's terms and does not enforce them. */
export interface VrmModelMeta {
  title: string | null;
  authors: string[];
  version: string | null;
  /** Who may use the model as an avatar: VRM 1.0 `avatarPermission` or VRM 0.x `allowedUserName`. */
  avatarPermission: string | null;
  /** VRM 1.0 `commercialUsage` or VRM 0.x `commercialUssageName`. */
  commercialUsage: string | null;
  /** VRM 1.0 `modification`; VRM 0.x states this through `licenseName`. */
  modification: string | null;
  /** VRM 0.x `licenseName`; VRM 1.0 has none. */
  licenseName: string | null;
  /** An http(s) link: VRM 1.0 `licenseUrl` or VRM 0.x `otherLicenseUrl`. */
  licenseUrl: string | null;
  /** The author's own terms, an http(s) link: VRM 1.0 `otherLicenseUrl` or VRM 0.x `otherPermissionUrl`. */
  termsUrl?: string | null;
  /** VRM 1.0 `creditNotation`: whether the author must be credited. */
  creditNotation?: string | null;
  /** VRM 1.0 `allowRedistribution`: whether the model file may be shared. */
  allowRedistribution?: boolean | null;
  /** VRM 1.0 `allowExcessivelySexualUsage` or VRM 0.x `sexualUssageName` (Allow/Disallow). */
  allowSexualUse?: boolean | null;
  /** VRM 1.0 `allowExcessivelyViolentUsage` or VRM 0.x `violentUssageName` (Allow/Disallow). */
  allowViolentUse?: boolean | null;
  /** VRM 1.0 `allowPoliticalOrReligiousUsage`. */
  allowPoliticalOrReligiousUse?: boolean | null;
  /** VRM 1.0 `allowAntisocialOrHateUsage`. */
  allowAntisocialOrHateUse?: boolean | null;
}

export interface VrmAvatarData {
  /** The `.vrm` model, e.g. `vrm/model.vrm`. */
  file: AvatarFilePath;
  specVersion: "0.x" | "1.0";
  /** Targets are the model's expression (blend shape) names. */
  expressionMap: AvatarExpressionMap;
  /** Optional `.vrma` idle animation. */
  idleAnimation?: AvatarFilePath | null;
  /** The model's own details, read at import. */
  meta?: VrmModelMeta | null;
  /** Every expression name the model has, as three-vrm names them, for choosing bindings in setup. */
  expressionNames?: string[];
}

export interface AvatarKindDataMap {
  pngtuber: PngtuberAvatarData;
  "mesh-avatar": MeshAvatarData;
  vrm: VrmAvatarData;
}

export interface AvatarFeatureFlags {
  /** Move the mouth with the reply text, or with the voice when text-to-speech plays. */
  lipSync: boolean;
  /** Blink on a timer. */
  blink: boolean;
  /** Breathing, sway and the thinking/listening poses. Reduced motion turns this off regardless. */
  idleMotion: boolean;
}

export const DEFAULT_AVATAR_FEATURE_FLAGS: Readonly<AvatarFeatureFlags> = Object.freeze({
  lipSync: true,
  blink: true,
  idleMotion: true,
});

/** `avatar.json`, version 1: one per character or persona. */
export interface AvatarConfig {
  version: typeof AVATAR_CONFIG_VERSION;
  owner: AvatarOwnerRef;
  /** Show this owner's avatar in chats where the matching agent is on. */
  enabled: boolean;
  /** The kind to show when several are set up. When its agent is off in a chat, the stage falls back to
   *  another set-up kind whose agent is on (pngtuber, then mesh-avatar, then vrm). */
  activeKind: AvatarKind | null;
  features: AvatarFeatureFlags;
  kinds: Partial<AvatarKindDataMap>;
  updatedAt: string;
}

export function createAvatarConfig(owner: AvatarOwnerRef, updatedAt: string): AvatarConfig {
  return {
    version: AVATAR_CONFIG_VERSION,
    owner: { ownerType: owner.ownerType, ownerId: owner.ownerId },
    enabled: true,
    activeKind: null,
    features: { ...DEFAULT_AVATAR_FEATURE_FLAGS },
    kinds: {},
    updatedAt,
  };
}

/** Body of `PUT /api/avatar-models/:ownerType/:ownerId`. A kind's data replaces what is stored for it;
 *  file paths it names must already exist in the owner's folder. */
export interface AvatarConfigUpdate {
  enabled?: boolean;
  activeKind?: AvatarKind | null;
  features?: Partial<AvatarFeatureFlags>;
  kinds?: Partial<AvatarKindDataMap>;
}

/** One row of `GET /api/avatar-models`: who has an avatar, without the per-kind data. */
export interface AvatarOwnerSummary {
  owner: AvatarOwnerRef;
  enabled: boolean;
  activeKind: AvatarKind | null;
  kinds: AvatarKind[];
  updatedAt: string;
}

// ── Import ──

/** File extensions each kind imports (lower case, with the dot). PNGTuber Plus saves are `.save`; VRM
 *  animations (`.vrma`) attach to an already imported VRM. Owner sprites need no import. */
export const AVATAR_IMPORT_EXTENSIONS: Readonly<Record<AvatarKind, readonly string[]>> = Object.freeze({
  pngtuber: [".save"],
  "mesh-avatar": [".mavatar"],
  vrm: [".vrm", ".vrma"],
});

/** Response of `POST /api/avatar-models/:ownerType/:ownerId/import`. */
export interface AvatarImportResult {
  kind: AvatarKind;
  config: AvatarConfig;
  /** What the import found for each slot and how sure it is. */
  detected: AvatarExpressionMap;
  /** Plain sentences about anything skipped or guessed, shown to the user as they are. */
  warnings: string[];
}

export const AVATAR_IMPORT_ERROR_CODES = ["unsupported-format", "invalid-file"] as const;
export type AvatarImportErrorCode = (typeof AVATAR_IMPORT_ERROR_CODES)[number];

/** A refusal whose message is plain enough to show the person who chose the file. */
export class AvatarImportError extends Error {
  readonly code: AvatarImportErrorCode;
  constructor(code: AvatarImportErrorCode, message: string) {
    super(message);
    this.name = "AvatarImportError";
    this.code = code;
  }
}

export interface AvatarImportInput {
  owner: AvatarOwnerRef;
  filename: string;
  /** The whole upload. Untrusted: importers parse it defensively and never trust declared sizes. */
  bytes: Uint8Array;
}

export interface AvatarExtractedFile {
  path: AvatarFilePath;
  bytes: Uint8Array;
}

export interface AvatarExtractedImport<K extends AvatarKind = AvatarKind> {
  kind: K;
  /** Files to store in the owner's folder; every path starts with `<kind>/`. */
  files: AvatarExtractedFile[];
  /** Kind data to store in `avatar.json`; its paths name files in `files` (or files already stored). */
  data: AvatarKindDataMap[K];
  detected: AvatarExpressionMap;
  warnings: string[];
}

/** One import format, implemented server-side in packages/server/src/services/avatars/formats/.
 *  The import route sniffs with `detect`, then runs `validate` and `extract` on the importer that claimed
 *  the file. Archives are read with the Engine's strict ZIP reader (packages/server/src/lib/zip-reader.ts);
 *  importers add no size limit below the global upload cap. */
export interface AvatarFormatImporter<K extends AvatarKind = AvatarKind, V = unknown> {
  readonly kind: K;
  readonly extensions: readonly string[];
  /** Cheap check of the file name and its first bytes (at most 64 KiB); no full parse. */
  detect(input: { filename: string; head: Uint8Array }): boolean;
  /** Parse and check the untrusted bytes. Throws AvatarImportError with a plain message on refusal. */
  validate(input: AvatarImportInput): Promise<V>;
  /** Turn a validated file into stored files and kind data. */
  extract(validated: V, input: AvatarImportInput): Promise<AvatarExtractedImport<K>>;
}

// ── Classifier (Roleplay expression source while streaming) ──

/** `keywords`: the instant word list, always available. `local-model`: a small local emotion model the
 *  Engine server runs when it can load one. Neither calls an LLM or a Decision model. */
export const AVATAR_CLASSIFIER_TIERS = ["keywords", "local-model"] as const;
export type AvatarClassifierTier = (typeof AVATAR_CLASSIFIER_TIERS)[number];

/** Request bounds (not file-size limits). */
export const AVATAR_CLASSIFY_LIMITS = Object.freeze({ maxTexts: 16, maxTextLength: 2000 });

/** Body of `POST /api/avatar-classify`. */
export interface AvatarClassifyRequest {
  /** Visible reply text to classify, usually the sentences finished since the last call, oldest first. */
  texts: string[];
  /** BCP-47 language hint when the chat has one. */
  language?: string | null;
  /** The best tier the caller wants; the server answers with this tier or a faster one. */
  tier?: AvatarClassifierTier;
  debugMode?: boolean;
}

export interface AvatarClassification {
  emotion: AvatarEmotion;
  /** 0..1 confidence of `emotion`. */
  weight: number;
  scores: Record<AvatarEmotion, number>;
  /** The more specific feeling the text shows, only ever one whose emotion is `emotion`, or null. Missing from
   *  older servers' answers. */
  feeling?: AvatarExtraFeeling | null;
}

export interface AvatarClassifyResponse {
  /** One result per request text, in the same order. */
  results: AvatarClassification[];
  tier: AvatarClassifierTier;
  /** Model id for the `local-model` tier, otherwise null. */
  model: string | null;
  latencyMs: number;
}

// ── Generation ──

export const AVATAR_PNGTUBER_VARIANTS = ["eyes-closed", "mouth-open"] as const;
export type AvatarPngtuberVariant = (typeof AVATAR_PNGTUBER_VARIANTS)[number];

/** Body of `POST /api/avatar-generation/pngtuber-variants`: edit the owner's sprites into blink and talk
 *  variants with the existing sprite/image generation, and store them as PNGTuber layers. */
export interface AvatarPngtuberVariantsRequest {
  owner: AvatarOwnerRef;
  /** Sprite labels to make variants for. Omitted means every layer set in the PNGTuber setup, or the
   *  owner's sprites when there is no setup yet. */
  labels?: string[];
  variants: AvatarPngtuberVariant[];
  /** Image generation connection; omitted uses the default image connection. */
  connectionId?: string | null;
  debugMode?: boolean;
}

/** Body of `POST /api/avatar-generation/mesh-rig`: read one sprite with the user's vision model and build
 *  a `.mavatar` rig from it with the JavaScript (sharp) layer builder. No Python, OpenCV or GPU. */
export interface AvatarMeshRigRequest {
  owner: AvatarOwnerRef;
  /** Sprite label of the source picture (a front-facing full-body or bust sprite works best). */
  sourceLabel: string;
  /** Vision-capable chat connection; omitted uses the chat's or the default connection. */
  connectionId?: string | null;
  debugMode?: boolean;
}

export interface AvatarGenerationResponse {
  kind: AvatarKind;
  config: AvatarConfig;
  /** Files written or replaced. */
  files: AvatarFilePath[];
  warnings: string[];
}

/** Ids of the generation prompts. The default text lives in the 2D Avatars package, in its agent's
 *  `defaultSettings[AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY]` (a prompt template collection the Agent editor
 *  can edit and Reset), never in the Engine. Templates use `${name}` placeholders, rendered with
 *  renderTemplate() from packages/server/src/services/prompt-overrides/template.ts. */
export const AVATAR_PROMPT_TEMPLATE_IDS = Object.freeze({
  pngtuberEyesClosed: "avatar-pngtuber-eyes-closed",
  pngtuberMouthOpen: "avatar-pngtuber-mouth-open",
  meshRigLayout: "avatar-mesh-rig-layout",
} as const);
export type AvatarPromptTemplateId = (typeof AVATAR_PROMPT_TEMPLATE_IDS)[keyof typeof AVATAR_PROMPT_TEMPLATE_IDS];

export const AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY = "avatarGenerationTemplates";

/** The variables each template may use:
 *  - `characterName`: the owner's name.
 *  - `appearance`: the owner's appearance text (may be empty).
 *  - `expression`: the sprite label being edited.
 *  - `imageWidth`, `imageHeight`: pixel size of the source sprite.
 *  - `layoutSchema`: the JSON shape the layer builder expects back, filled in by the Engine. */
export const AVATAR_PROMPT_TEMPLATE_VARIABLES: Readonly<Record<AvatarPromptTemplateId, readonly string[]>> =
  Object.freeze({
    "avatar-pngtuber-eyes-closed": ["characterName", "appearance", "expression"],
    "avatar-pngtuber-mouth-open": ["characterName", "appearance", "expression"],
    "avatar-mesh-rig-layout": ["characterName", "appearance", "imageWidth", "imageHeight", "layoutSchema"],
  });

// ── Routes ──

/** Route prefixes, relative to `/api` (the client's api helper adds it). */
export const AVATAR_API_PREFIXES = Object.freeze({
  models: "/avatar-models",
  classify: "/avatar-classify",
  generation: "/avatar-generation",
} as const);

/** `/avatar-models/<ownerType>/<ownerId>`: GET, PUT and DELETE of one owner's avatar. GET answers the
 *  `AvatarConfig`, JSON `null` when the owner has no avatar yet, and 404 only when the owner does not exist. */
export function avatarModelPath(owner: AvatarOwnerRef): string {
  return `${AVATAR_API_PREFIXES.models}/${owner.ownerType}/${encodeURIComponent(owner.ownerId)}`;
}

/** `/avatar-models/<ownerType>/<ownerId>/files/<kind>/<name>`: a stored file, for the client's `api.raw`. */
export function avatarModelFilePath(owner: AvatarOwnerRef, path: AvatarFilePath): string {
  return `${avatarModelPath(owner)}/files/${path}`;
}

/** The same file as a URL an `<img>` or a loader can use directly (`/api/...`). */
export function avatarModelFileUrl(owner: AvatarOwnerRef, path: AvatarFilePath): string {
  return `/api${avatarModelFilePath(owner, path)}`;
}
