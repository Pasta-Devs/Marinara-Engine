// Registered prompt-override keys: Roleplay media generation.
import type { PromptOverrideKeyDef } from "../types.js";
import { renderTemplate } from "../template.js";

const ROLEPLAY_GALLERY_VIDEO_DIRECTOR_VARIABLES = ["durationSeconds"] as const;

export const ROLEPLAY_GALLERY_VIDEO_DIRECTOR_PROMPT_TEMPLATE = [
  "You are an animation director for one ${durationSeconds}-second image-to-video Roleplay clip.",
  "The supplied reference image is the exact first frame at time zero.",
  "Plan only the action already happening in the source exchange or its immediate visual follow-through.",
  "Describe one continuous shot with concrete subject motion, camera movement, point of view, environmental motion, spoken dialogue only when supported by the source, sound effects, and ambient audio.",
  "Fit the action, dialogue, camera movement, and ending hold inside the ${durationSeconds}-second runtime; prioritize one clear beat over rushed detail.",
  "Keep identities, clothing, objects, setting, lighting, and composition continuous with the first frame.",
  "Do not repeat a static image description, list character traits, invent the user's next reply, continue into a new story beat, add cuts or a montage, or mention prompts, storyboards, keyframes, timestamps, or the reference image.",
  "End on a stable hold that can loop or cut cleanly.",
  'Return only JSON in this exact shape: {"narrationBeat":"one cohesive animation direction"}',
].join("\n");

export interface RoleplayGalleryVideoDirectorCtx extends Record<string, string | number | undefined> {
  durationSeconds: number;
}

export const ROLEPLAY_GALLERY_VIDEO_DIRECTOR: PromptOverrideKeyDef<RoleplayGalleryVideoDirectorCtx> = {
  key: "roleplay.galleryVideoDirector",
  label: "Roleplay Gallery Animation Director",
  description: "Instructions sent to the selected Prompt Model when planning motion for a Roleplay Gallery animation.",
  variables: [
    {
      name: "durationSeconds",
      description: "Selected animation duration in seconds.",
      example: "10",
    },
  ],
  defaultBuilder: (ctx) =>
    renderTemplate(ROLEPLAY_GALLERY_VIDEO_DIRECTOR_PROMPT_TEMPLATE, ctx, ROLEPLAY_GALLERY_VIDEO_DIRECTOR_VARIABLES),
  exampleContext: {
    durationSeconds: 10,
  },
};

// ── Roleplay clip director (no picture) ──
//
// For a Roleplay clip with no picture of its own (/video or the Gallery's Video button with First frame on
// Prompt only, or starting from an avatar): the writer describes the scene itself, since no image shows it.

export const ROLEPLAY_CLIP_DIRECTOR_PROMPT_TEMPLATE = [
  "You are a video director for one ${durationSeconds}-second Roleplay video clip.",
  "No picture of this moment exists: describe the scene itself, so the video model can show it from your words alone.",
  "Show the latest moment of the source exchange (or the requested clip): where it happens, who is there and how they look, the lighting, and what they do.",
  "Describe one continuous shot with concrete subject motion, camera movement, point of view, environmental motion, spoken dialogue only when supported by the source, sound effects, and ambient audio.",
  "Fit the action, dialogue, camera movement, and ending hold inside the ${durationSeconds}-second runtime; prioritize one clear beat over rushed detail.",
  "Do not invent the user's next reply, continue into a new story beat, add cuts or a montage, or mention prompts, storyboards, keyframes, timestamps, or images.",
  "End on a stable hold that can loop or cut cleanly.",
  'Return only JSON in this exact shape: {"narrationBeat":"one cohesive video direction"}',
].join("\n");

export const ROLEPLAY_CLIP_DIRECTOR: PromptOverrideKeyDef<RoleplayGalleryVideoDirectorCtx> = {
  key: "roleplay.clipDirector",
  label: "Roleplay Clip Director",
  description:
    "Instructions sent to the selected Prompt Model when writing a Roleplay clip that has no picture to start from (/video and the Gallery's Video button).",
  variables: [
    {
      name: "durationSeconds",
      description: "Selected clip duration in seconds.",
      example: "10",
    },
  ],
  defaultBuilder: (ctx) =>
    renderTemplate(ROLEPLAY_CLIP_DIRECTOR_PROMPT_TEMPLATE, ctx, ROLEPLAY_GALLERY_VIDEO_DIRECTOR_VARIABLES),
  exampleContext: {
    durationSeconds: 10,
  },
};
