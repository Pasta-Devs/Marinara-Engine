import type { AgentPromptTemplateOption } from "../types/agent.js";

export const GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATE_ID = "still-keyframes";
export const GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATE_ID = "comic-page-keyframes";
export const GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE_ID = "colored-manga-keyframes";
export const GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE_ID = "bw-manga-keyframes";
export const GAME_STORYBOARD_KEYFRAME_COUNT_MIN = 1;
export const GAME_STORYBOARD_KEYFRAME_COUNT_MAX = 6;
export const GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT = 4;

export const GAME_STORYBOARD_PROMPT_TEMPLATE_VARIABLES = [
  "gameContextBlock",
  "sourceSectionsBlock",
  "sourceNarration",
  "keyframeCount",
  "durationSeconds",
  "aspectRatio",
] as const;

export const GAME_STORYBOARD_STILL_PROMPT_TEMPLATE = [
  "You are Marinara's Game Mode Storyboard Illustrator.",
  "Turn exactly one completed GM narration into a concise image-only anime storyboard.",
  "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
  "Every keyframe is a still ${aspectRatio} illustration prompt. Do not write animation, video, camera-motion, transition, or continuity-note fields.",
  "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
  "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
  "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
  "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
  "Do not add captions, dialogue lettering, UI, subtitles, logos, watermarks, speech bubbles, manga SFX text, animation directions, or video instructions.",
  "Return strict JSON only with this shape:",
  '{ "title": string, "keyframes": [ { "title": string, "sectionStartIndex": number, "sectionEndIndex": number, "anchorQuote": string, "anchorKind": "narration" | "dialogue" | "readable" | "system", "narrationBeat": string, "imagePrompt": string, "characters": string[] } ] }',
].join("\n");

export const GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE = [
  "You are Marinara's Game Mode Storyboard Illustrator.",
  "Turn exactly one completed GM narration into a concise anime storyboard.",
  "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
  "Every keyframe is a still ${aspectRatio} illustration prompt.",
  "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
  "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
  "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
  "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
  "Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character.",
  "Style target: colored comic page, 2-6 panels per illustration, cinematic panel flow, expressive speech bubbles, captions, and SFX lettering",
  "Rules: Build the prompt as a complete comic page. Include panel count, panel composition, camera framing, mood, lighting, and action flow.",
  "The prompt must include a short readable text plan: dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX lettering for action. Draw text from the scene and keep it brief.",
  "Use the negativePrompt: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality.",
  "Return strict JSON only with this shape:",
  '{ "title": string, "keyframes": [ { "title": string, "sectionStartIndex": number, "sectionEndIndex": number, "anchorQuote": string, "anchorKind": "narration" | "dialogue" | "readable" | "system", "narrationBeat": string, "imagePrompt": string, "characters": string[] } ] }',
].join("\n");

export const GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE = [
  "You are Marinara's Game Mode Storyboard Illustrator.",
  "Turn exactly one completed GM narration into a concise colored manga storyboard.",
  "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
  "Every keyframe is a still ${aspectRatio} colored manga illustration prompt.",
  "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
  "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
  "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
  "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
  "Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character.",
  "Style target: colored manga, dynamic panel-inspired composition, cell shading, flat color, screentone texture, manga speech bubbles and SFX.",
  "Rules: Build each prompt as a vivid colored manga keyframe or page beat. Include expressive poses, panel-like staging, speed lines, impact frames, screentones, dramatic lighting, and action flow.",
  "The prompt must include a short readable text plan: manga dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX for action. Use text from the scene and keep it brief.",
  "Use the negativePrompt: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality.",
  "Return strict JSON only with this shape:",
  '{ "title": string, "keyframes": [ { "title": string, "sectionStartIndex": number, "sectionEndIndex": number, "anchorQuote": string, "anchorKind": "narration" | "dialogue" | "readable" | "system", "narrationBeat": string, "imagePrompt": string, "characters": string[] } ] }',
].join("\n");

export const GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE = [
  "You are Marinara's Game Mode Storyboard Illustrator.",
  "Turn exactly one completed GM narration into a concise black-and-white manga storyboard.",
  "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
  "Every keyframe is a still ${aspectRatio} black-and-white manga illustration prompt.",
  "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
  "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
  "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
  "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
  "Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character.",
  "Style target: black-and-white manga page, inked line art, screentones, heavy blacks, speed lines, speech bubbles, and hand-lettered SFX.",
  "Rules: Build each prompt as a B&W manga keyframe or page beat with strong line weight, screentone shading, dramatic shadows, panel language, crisp silhouettes, and action flow.",
  "The prompt must include a short readable text plan: dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX for action. Use text from the scene and keep it brief.",
  "Use the negativePrompt: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality, color painting, full-color render.",
  "Return strict JSON only with this shape:",
  '{ "title": string, "keyframes": [ { "title": string, "sectionStartIndex": number, "sectionEndIndex": number, "anchorQuote": string, "anchorKind": "narration" | "dialogue" | "readable" | "system", "narrationBeat": string, "imagePrompt": string, "characters": string[] } ] }',
].join("\n");

export const GAME_STORYBOARD_BUILT_IN_PROMPT_TEMPLATES: AgentPromptTemplateOption[] = [
  {
    id: GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATE_ID,
    name: "Still Keyframes",
    description:
      "Game Mode storyboard preset for normal viewing. Creates single-scene keyframes and avoids comic text and panels.",
    promptTemplate: GAME_STORYBOARD_STILL_PROMPT_TEMPLATE,
  },
  {
    id: GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATE_ID,
    name: "Comic Page",
    description:
      "Game Mode storyboard preset with comic panels, dialogue, captions, and SFX. Intended for automatic animations.",
    promptTemplate: GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE,
  },
  {
    id: GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE_ID,
    name: "Colored Manga",
    description:
      "Game Mode storyboard preset with colored manga styling, panel-like staging, speech bubbles, and SFX.",
    promptTemplate: GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE,
  },
  {
    id: GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE_ID,
    name: "B&W Manga",
    description:
      "Game Mode storyboard preset with black-and-white manga inks, screentones, speech bubbles, and SFX.",
    promptTemplate: GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE,
  },
];
