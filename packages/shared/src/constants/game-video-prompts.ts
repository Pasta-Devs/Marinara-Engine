import type { AgentPromptTemplateOption } from "../types/agent.js";

export const GAME_VIDEO_PROMPT_TEMPLATE_ID = "cinematic-scene-video";
export const ANIME_GAME_VIDEO_PROMPT_TEMPLATE_ID = "anime-game-video";
export const COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID = "comic-page-game-video";
export const LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID = "ltx-director-video";

export const GAME_VIDEO_PROMPT_TEMPLATE_VARIABLES = [
  "sceneTitle",
  "narrationSummary",
  "illustrationPrompt",
  "charactersLine",
  "settingLine",
  "artStyleLine",
  "durationSeconds",
  "aspectRatio",
  "sourceIllustrationLine",
] as const;

export const GAME_VIDEO_PROMPT_TEMPLATE = [
  "Create a ${durationSeconds}-second ${aspectRatio} animated game scene from the provided first-frame illustration.",
  "${sourceIllustrationLine}",
  "Scene: ${sceneTitle}",
  "Story beat: ${narrationSummary}",
  "Characters: ${charactersLine}",
  "Setting: ${settingLine}",
  "Art style: ${artStyleLine}",
  "Reference prompt excerpt: ${illustrationPrompt}",
  "Use the reference image as the visual anchor. Keep recognizable characters, setting, and mood while adding motion that feels natural for this moment.",
  "You may choose the most cinematic camera drift, focus shift, gestures, atmospheric movement, and ending pose that fit the scene.",
  "Avoid subtitles, captions, UI, logos, watermarks, unrelated new characters, distorted anatomy, and abrupt cuts.",
].join("\n");

export const COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE = [
  "Create a ${durationSeconds}-second ${aspectRatio} animation from the supplied comic or manga page reference.",
  "${sourceIllustrationLine}",
  "Sequence: ${sceneTitle}",
  "Timed animation direction: ${narrationSummary}",
  "Visible characters: ${charactersLine}",
  "Setting: ${settingLine}",
  "Art style: ${artStyleLine}",
  "Comic-page reference description: ${illustrationPrompt}",
  "Use the supplied page as the authoritative visual reference for character identity, appearance, setting, composition, art style, and panel order.",
  "Interpret its panels as ordered temporal beats rather than simultaneous subjects or one literal physical scene. Follow the page's reading order and the timed animation direction.",
  "Enter panel 1 immediately whenever the full page would reveal a later consequence before its cause. A full-page establish may last no more than 0.35 seconds and is allowed only when it cannot spoil a future beat; otherwise do not use the whole page as an opening recap.",
  "Preserve cause before effect, character continuity, panel order, and the final panel's outcome. Use cuts, pushes, pans, or transitions only at panel boundaries.",
  "Within each panel beat, animate one primary subject action clearly, use one simple camera move or a locked camera, and add only supporting environmental motion. Reserve the final 0.4-0.7 seconds for the final panel's ending pose or hold.",
  "Keep recognizable characters, faces, hair, clothing, anatomy, injuries, equipment, environment, lighting, and mood stable. Do not invent connective events when the page uses a panel break.",
  "Do not merge panels, collapse gutters, duplicate characters from different moments into one shot, reveal a later consequence early, animate every panel at once, or rush through more beats than the duration supports.",
  "Prioritize the timed direction and primary character action over decorative lettering, background extras, or minor props when the duration cannot support every page detail.",
  "Preserve any deliberate comic lettering only while it remains visible, but do not invent, rewrite, or animate extra dialogue, captions, subtitles, UI, logos, or watermarks.",
].join("\n");

export const ANIME_GAME_VIDEO_PROMPT_TEMPLATE = [
  "Create a ${durationSeconds}-second ${aspectRatio} anime shot from the supplied first-frame illustration.",
  "${sourceIllustrationLine}",
  "Shot: ${sceneTitle}",
  "Animation direction: ${narrationSummary}",
  "Visible characters: ${charactersLine}",
  "Setting: ${settingLine}",
  "Art style: ${artStyleLine}",
  "First-frame visual description: ${illustrationPrompt}",
  "Follow the animation direction as the temporal plan for the clip.",
  "- Begin exactly from the supplied illustration. Treat the first-frame illustration as authoritative whenever textual details conflict with it.",
  "- Preserve character identity, face, hair, clothing, anatomy, equipment, environment, lighting, and art style.",
  "- Perform the described primary action clearly.",
  "- Use the specified camera behavior; if none is specified, keep the camera mostly stable.",
  "- Add only subtle secondary environmental motion that supports the primary action.",
  "- Finish in the described ending pose or dramatic hold.",
  "- Keep this as one continuous anime shot without cuts or scene changes.",
  "- Use controlled anime timing: anticipation, decisive movement, impact or emotional reaction, then a brief settling hold.",
  "- Stage severe harm with broadcast-anime restraint using occlusion, silhouette, impact light, reaction framing, and aftermath.",
  "- Avoid unrelated movement, new characters, duplicated subjects, morphing, costume changes, distorted anatomy, subtitles, captions, speech bubbles, UI, logos, and watermarks.",
].join("\n");

export const LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE = "${narrationSummary}";

export const GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES: AgentPromptTemplateOption[] = [
  {
    id: GAME_VIDEO_PROMPT_TEMPLATE_ID,
    name: "Cinematic Scene Video",
    description:
      "Default Game Mode video prompt for animating a saved scene or storyboard keyframe from its first-frame image.",
    promptTemplate: GAME_VIDEO_PROMPT_TEMPLATE,
  },
  {
    id: ANIME_GAME_VIDEO_PROMPT_TEMPLATE_ID,
    name: "Anime Game Video",
    description:
      "Animates a generated first frame as a continuous anime shot while preserving characters and composition.",
    promptTemplate: ANIME_GAME_VIDEO_PROMPT_TEMPLATE,
  },
  {
    id: COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID,
    name: "Comic Page Video",
    description:
      "Interprets comic or manga panels as duration-aware ordered animation beats without changing ordinary scene videos.",
    promptTemplate: COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE,
  },
  {
    id: LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE_ID,
    name: "Narration Passthrough",
    description:
      "Passes the Storyboard's current motion direction through the universal video prompt contract without another planning call.",
    promptTemplate: LTX_DIRECTOR_GAME_VIDEO_PROMPT_TEMPLATE,
  },
];
