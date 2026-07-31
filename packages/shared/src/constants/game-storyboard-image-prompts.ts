export const GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID = "game-scene-illustration";
export const STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID = "storyboard-illustration";
export const STORYBOARD_FIRST_FRAME_IMAGE_PROMPT_TEMPLATE_ID = "storyboard-first-frame";

// Host-side formatter contract only. Prompt bodies and selectable formatters are
// owned by the installable Storyboard Agent package.
export const GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_VARIABLES = [
  "sceneTitleLine",
  "scenePrompt",
  "finalVisibilityRuleLine",
  "narrativePurposeLine",
  "charactersLine",
  "referenceHandlingLine",
  "locationHandlingLine",
  "appearanceNotesBlock",
  "artDirectionLine",
  "imagePromptInstructionsLine",
] as const;
