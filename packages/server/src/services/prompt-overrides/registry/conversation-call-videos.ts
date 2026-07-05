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
      "Create a seamless neutral video-call idle loop. The first frame and final frame must match: same pose, expression, gaze, camera framing, hair, outfit, lighting, and background. Add only subtle breathing, blinking, and tiny natural head movement between those matching endpoints.",
  },
  {
    kind: "talking",
    label: "talking loop",
    instruction:
      "Start on the exact same reference-matching neutral video-call pose, animate natural speaking with subtle mouth and face movement, then return to that identical neutral pose by the final frame. The clip must loop cleanly without a visible jump.",
  },
  {
    kind: "laughing",
    label: "laughing reaction",
    instruction:
      "Start on the exact same reference-matching neutral video-call pose, laugh softly with natural face and shoulder movement, then return to that identical neutral pose by the final frame. The first and final frames must match for a clean loop.",
  },
  {
    kind: "angry",
    label: "angry reaction",
    instruction:
      "Start on the exact same reference-matching neutral video-call pose, show anger or irritation in the face and posture, then return to that identical neutral pose by the final frame. The first and final frames must match for a clean loop.",
  },
  {
    kind: "crying",
    label: "crying reaction",
    instruction:
      "Start on the exact same reference-matching neutral video-call pose, show a restrained tearful or crying reaction, then return to that identical neutral pose by the final frame. The first and final frames must match for a clean loop.",
  },
  {
    kind: "sighing",
    label: "sighing reaction",
    instruction:
      "Start on the exact same reference-matching neutral video-call pose, sigh with a small breath and head movement, then return to that identical neutral pose by the final frame. The first and final frames must match for a clean loop.",
  },
];

const LOCKED_CAMERA_REFERENCE_LINES = [
  "Use a still camera: the camera must be completely locked off for the entire clip. Do not animate the camera.",
  "No zoom in, zoom out, push-in, pull-out, dolly, pan, tilt, roll, crop change, reframing, phone movement, handheld drift, or perspective change.",
  "Keep the character's face at the same screen position and the same apparent size from first frame to final frame. Only the character may move.",
];

function buildDefaultPrompt(ctx: ConversationCallVideoClipCtx) {
  return [
    `Create a ${ctx.durationSeconds}-second ${ctx.aspectRatio} ${ctx.clipLabel} for an AI character in a private video call.`,
    `Character name: ${ctx.characterName}.`,
    ctx.clipInstruction,
    "Use only the supplied avatar/reference image as the character identity, appearance, outfit, art style, camera framing, and background reference.",
    "The first frame must match the supplied reference image as closely as the provider allows.",
    "The final frame must return to that same reference-matching pose, expression, framing, lighting, outfit, and background so the clip loops seamlessly.",
    "This must be a clean loop with no jump cut, sudden pose reset, snap in expression, or identity drift at the loop point.",
    ...LOCKED_CAMERA_REFERENCE_LINES,
    "Preserve the reference image's face, hair, outfit, mask/accessories, colors, proportions, and art style for the entire clip.",
    "No sudden outfit changes, hairstyle changes, identity drift, lighting shifts, new accessories, or altered facial features.",
    "Single character only. No extra people. No UI, captions, subtitles, speech bubbles, text, logos, or watermarks.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDefaultCustomClipPrompt(ctx: ConversationCallCustomVideoClipCtx) {
  return [
    `Create a ${ctx.durationSeconds}-second ${ctx.aspectRatio} custom video-call clip for an AI character.`,
    `Character name: ${ctx.characterName}.`,
    `Clip label: ${ctx.clipLabel}.`,
    `Requested custom action or look: ${ctx.customPrompt}.`,
    "Use only the supplied avatar/reference image as the character identity, appearance, outfit, art style, camera framing, and background reference.",
    "Begin from the reference-matching neutral video-call pose, perform only the requested visual action or reveal, then settle back into a reference-matching stable pose by the final frame.",
    ...LOCKED_CAMERA_REFERENCE_LINES,
    "Preserve the reference image's face, hair, outfit, mask/accessories, colors, proportions, and art style unless the custom request explicitly changes one of those details.",
    "Only change appearance details that the custom request explicitly asks to change; avoid sudden outfit changes, hairstyle changes, identity drift, lighting shifts, or unrelated new accessories.",
    "Single character only. No extra people. No UI, captions, subtitles, speech bubbles, text, logos, or watermarks.",
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
      description: "The requested custom visual action or look.",
      example: "Dottore takes off his mask and reveals red eyes while looking into the phone camera.",
    },
    { name: "durationSeconds", description: "Requested clip duration in seconds.", example: "5" },
    { name: "aspectRatio", description: "Requested video aspect ratio.", example: "16:9" },
  ],
  defaultBuilder: buildDefaultCustomClipPrompt,
  exampleContext: {
    characterName: "Dottore",
    clipLabel: "Mask off",
    customPrompt: "Dottore takes off his mask and reveals red eyes while looking into the phone camera.",
    durationSeconds: 5,
    aspectRatio: "16:9",
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
