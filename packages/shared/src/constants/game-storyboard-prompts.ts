export const GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATE_ID = "still-keyframes";
export const GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE_ID = "comic-page-keyframes";
export const GAME_STORYBOARD_STILL_ANIMATION_PROMPT_TEMPLATE_ID = "still-keyframes-animation";
export const GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID = "comic-page-animation";
export const GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATE_ID = GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID;
export const GAME_STORYBOARD_ANIME_EPISODE_PROMPT_TEMPLATE_ID = "anime-episode-director";
export const GAME_STORYBOARD_LTX_DIRECTOR_PROMPT_TEMPLATE_ID = "ltx-director-storyboard";
export const GAME_STORYBOARD_LTX_SIMPLE_PROMPT_TEMPLATE_ID = "ltx-simple-image-to-video";
export const GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE_ID = "colored-manga-keyframes";
export const GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE_ID = "bw-manga-keyframes";
export const GAME_STORYBOARD_NOVELAI_PROMPT_TEMPLATE_ID = "novelai-keyframes";
export const GAME_STORYBOARD_NOVELAI_ANIMATION_PROMPT_TEMPLATE_ID = "novelai-keyframes-animation";
export const GAME_STORYBOARD_COLORED_MANGA_ANIMATION_PROMPT_TEMPLATE_ID = "colored-manga-keyframes-animation";
export const GAME_STORYBOARD_BW_MANGA_ANIMATION_PROMPT_TEMPLATE_ID = "bw-manga-keyframes-animation";

export const GAME_STORYBOARD_KEYFRAME_COUNT_MIN = 1;
export const GAME_STORYBOARD_KEYFRAME_COUNT_MAX = 6;
export const GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT = 3;
export const GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN = 1;
export const GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX = 15;
export const GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_DEFAULT = 6;

export function normalizeGameStoryboardKeyframeCount(
  value: unknown,
  fallback = GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  const normalizedFallback = Math.min(
    GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
    Math.max(GAME_STORYBOARD_KEYFRAME_COUNT_MIN, Math.trunc(fallback)),
  );
  return Number.isFinite(parsed)
    ? Math.min(GAME_STORYBOARD_KEYFRAME_COUNT_MAX, Math.max(GAME_STORYBOARD_KEYFRAME_COUNT_MIN, Math.trunc(parsed)))
    : normalizedFallback;
}

// Host-side contract only. Prompt bodies and selectable presets are owned by the
// installable Storyboard Agent package.
export const GAME_STORYBOARD_PROMPT_TEMPLATE_VARIABLES = [
  "gameContextBlock",
  "sourceSectionsBlock",
  "sourceNarration",
  "keyframeCount",
  "durationSeconds",
  "aspectRatio",
] as const;
