import type { ConversationCallCharacterVideoClipKind } from "@marinara-engine/shared";
import type { PromptOverrideKeyDef } from "../types.js";

export interface ConversationCallVideoClipCtx extends Record<string, string | number | undefined> {
  characterName: string;
  clipLabel: string;
  clipInstruction: string;
  durationSeconds: number;
  aspectRatio: string;
}

export interface ConversationCallCustomVideoClipCtx extends Record<string, string | number | undefined> {
  characterName: string;
  clipLabel: string;
  customPrompt: string;
  durationSeconds: number;
  aspectRatio: string;
  referenceInstruction: string;
}

type ClipPromptSeed = {
  kind: ConversationCallCharacterVideoClipKind;
  label: string;
  instruction: string;
};

const CLIP_PROMPT_SEEDS: ClipPromptSeed[] = [
  {
    kind: "idle",
    label: "idle loop",
    instruction:
      "The character stands still with very subtle breathing, maybe a gentle smile, and no mouth movement. If their eyes are visible, they may blink naturally. If a mask, visor, hair, or accessory covers their eyes, keep it exactly as shown and do not invent blinking or visible eyes.",
  },
  {
    kind: "talking",
    label: "talking loop",
    instruction:
      "The character speaks naturally with visible mouth or mask-area motion as appropriate, subtle breathing, small head and shoulder movement, gentle expression changes, and slight hair or clothing motion if present. Keep the movement restrained and video-call-like, then return to the original pose. Preserve masks, visors, eye coverings, and accessories exactly as shown.",
  },
  {
    kind: "laughing",
    label: "laughing reaction",
    instruction:
      "The character laughs naturally with visible mouth or mask-area motion as appropriate, subtle breathing, small head and shoulder movement, gentle expression changes, and slight hair or clothing motion if present. Keep the movement restrained and video-call-like, then return to the original pose. Preserve masks, visors, eye coverings, and accessories exactly as shown.",
  },
  {
    kind: "angry",
    label: "angry reaction",
    instruction:
      "The character reacts with restrained anger or irritation through subtle breathing, small head and shoulder movement, gentle expression changes, and slight hair or clothing motion if present. Keep the movement restrained and video-call-like, then return to the original pose. Preserve masks, visors, eye coverings, and accessories exactly as shown.",
  },
  {
    kind: "crying",
    label: "crying reaction",
    instruction:
      "The character reacts with restrained sadness or tears through subtle breathing, small head and shoulder movement, gentle expression changes, and slight hair or clothing motion if present. Keep the movement restrained and video-call-like, then return to the original pose. Preserve masks, visors, eye coverings, and accessories exactly as shown.",
  },
  {
    kind: "sighing",
    label: "sighing reaction",
    instruction:
      "The character sighs naturally with visible mouth or mask-area motion as appropriate, subtle breathing, small head and shoulder movement, gentle expression changes, and slight hair or clothing motion if present. Keep the movement restrained and video-call-like, then return to the original pose. Preserve masks, visors, eye coverings, and accessories exactly as shown.",
  },
];

function buildDefaultPrompt(ctx: ConversationCallVideoClipCtx) {
  return [
    `Create a ${ctx.durationSeconds}-second ${ctx.aspectRatio} animated portrait loop for an AI video call.`,
    "Reference: use the attached 16:9 image as the character identity, crop, and first/final frame target.",
    "Preserve the reference image's crop, especially the top/head framing. If any framing must be lost, crop lower body or lower clothing instead of hair, head, mask, or face.",
    "Preserve the reference image's background, lighting, colors, face shape, hair, clothing, mask or eyewear, accessories, and art style.",
    `Action: ${ctx.clipInstruction}`,
    "Motion quality: one smooth, restrained, video-call-like motion throughout the clip.",
    "Lighting and background: keep them from the reference image; do not invent a new ambience or setting.",
    "Camera: locked-off still camera, no zoom, pan, tilt, dolly, crop change, reframing, handheld shake, or scene cut.",
    "Looping: return to the first-frame pose by the final frame for a seamless loop.",
    "Focus: single character only, no captions, subtitles, UI, logos, extra people, new clothing, or new facial features.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDefaultCustomClipPrompt(ctx: ConversationCallCustomVideoClipCtx) {
  const hasReference = ctx.referenceInstruction.startsWith("Reference:");
  const startingPose = hasReference ? "the reference pose" : "a stable neutral video-call pose";
  return [
    `Create a ${ctx.durationSeconds}-second ${ctx.aspectRatio} animated portrait loop for an AI video call.`,
    ctx.referenceInstruction,
    hasReference
      ? "Preserve the reference image's crop, especially the top/head framing. If any framing must be lost, crop lower body or lower clothing instead of hair, head, mask, or face."
      : "Keep the character design, crop, lighting, background, clothing, accessories, and art style consistent throughout the clip.",
    hasReference
      ? "Preserve the reference image's base background, lighting, colors, face shape, hair, clothing, mask or eyewear, accessories, and art style unless the custom request explicitly changes one visual detail."
      : "",
    `Action: Start from ${startingPose}, ${ctx.customPrompt}, then return to that same pose by the final frame.`,
    "Motion quality: one smooth, natural, video-call-like motion throughout the clip, with subtle breathing, small head or shoulder movement, and slight hair or clothing motion if present.",
    hasReference
      ? "Lighting and background: keep them from the reference image unless the custom request explicitly changes them."
      : "Lighting and background: keep them stable unless the custom request explicitly changes them.",
    "Camera: locked-off still camera, no zoom, pan, tilt, dolly, crop change, reframing, handheld shake, or scene cut.",
    "Looping: return to the first-frame pose by the final frame for a seamless loop.",
    "Focus: single character only, no captions, subtitles, UI, logos, extra people, or unrelated costume/accessory changes.",
  ]
    .filter(Boolean)
    .join("\n");
}

function makeConversationCallVideoPrompt(seed: ClipPromptSeed): PromptOverrideKeyDef<ConversationCallVideoClipCtx> {
  return {
    key: `conversation.callVideo.${seed.kind}`,
    description: `Conversation Call character video prompt for the ${seed.label} clip.`,
    variables: [
      { name: "characterName", description: "Character display name.", example: "Dottore" },
      { name: "clipLabel", description: "Human-readable clip type.", example: seed.label },
      {
        name: "clipInstruction",
        description: "Clip-specific animation direction.",
        example: seed.instruction,
      },
      { name: "durationSeconds", description: "Requested clip duration in seconds.", example: "5" },
      { name: "aspectRatio", description: "Requested video aspect ratio.", example: "16:9" },
    ],
    defaultBuilder: buildDefaultPrompt,
    exampleContext: {
      characterName: "Dottore",
      clipLabel: seed.label,
      clipInstruction: seed.instruction,
      durationSeconds: 5,
      aspectRatio: "16:9",
    },
  };
}

export const CONVERSATION_CALL_VIDEO_PROMPTS = CLIP_PROMPT_SEEDS.map(makeConversationCallVideoPrompt);

export const CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT: PromptOverrideKeyDef<ConversationCallCustomVideoClipCtx> = {
  key: "conversation.callVideo.custom",
  description: "Conversation Call custom character video prompt for sparse user-requested clips.",
  variables: [
    { name: "characterName", description: "Character display name.", example: "Dottore" },
    { name: "clipLabel", description: "Short saved clip label.", example: "Mask off" },
    {
      name: "customPrompt",
      description: "The requested custom visual action or look from the call command.",
      example: "blow a kiss",
    },
    { name: "durationSeconds", description: "Requested clip duration in seconds.", example: "5" },
    { name: "aspectRatio", description: "Requested video aspect ratio.", example: "16:9" },
    {
      name: "referenceInstruction",
      description: "Whether a reference image is attached and how it should be used.",
      example: "Reference: use the attached 16:9 image as the character identity, crop, and first/final frame target.",
    },
  ],
  defaultBuilder: buildDefaultCustomClipPrompt,
  exampleContext: {
    characterName: "Dottore",
    clipLabel: "Blow kiss",
    customPrompt: "blow a kiss",
    durationSeconds: 5,
    aspectRatio: "16:9",
    referenceInstruction:
      "Reference: use the attached 16:9 image as the character identity, crop, and first/final frame target.",
  },
};

export const CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND = new Map(
  CLIP_PROMPT_SEEDS.map((seed, index) => [seed.kind, CONVERSATION_CALL_VIDEO_PROMPTS[index]!]),
);

export const CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND = new Map(
  CLIP_PROMPT_SEEDS.map((seed) => [seed.kind, seed.instruction]),
);

export const CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND = new Map(
  CLIP_PROMPT_SEEDS.map((seed) => [seed.kind, seed.label]),
);
