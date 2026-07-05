// ──────────────────────────────────────────────
// Prompt Overrides — Public exports
// ──────────────────────────────────────────────
export { loadPrompt } from "./load-prompt.js";
export { renderTemplate, validateTemplate } from "./template.js";
export type { TemplateValidationResult } from "./template.js";
export {
  PROMPT_OVERRIDE_REGISTRY,
  SPRITES_ANIMATED_PORTRAIT,
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
  GAME_NPC_PORTRAIT,
  GAME_BACKGROUND,
  GAME_SCENE_ILLUSTRATION,
  GAME_NARRATION_SUMMARIZER,
  GAME_IMAGE_PROMPT_DIRECTOR,
  GAME_STORYBOARD_ILLUSTRATION_DIRECTOR,
  GAME_STORYBOARD_DIRECTOR,
  GAME_VIDEO,
  CONVERSATION_CALL_VIDEO_PROMPTS,
  CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT,
  CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND,
  CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND,
  CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND,
  CONVERSATION_SELFIE,
  getPromptOverrideDef,
  listPromptOverrideKeys,
} from "./registry.js";
export type {
  PromptOverrideKeyDef,
  PromptVariable,
  SpritesExpressionSheetCtx,
  SpritesSinglePortraitCtx,
  SpritesAnimatedPortraitCtx,
  SpritesSingleFullBodyCtx,
  SpritesFullBodySheetCtx,
  GameNpcPortraitCtx,
  GameBackgroundCtx,
  GameSceneIllustrationCtx,
  GameNarrationSummarizerCtx,
  GameImagePromptDirectorCtx,
  GameStoryboardDirectorCtx,
  GameVideoCtx,
  ConversationCallCustomVideoClipCtx,
  ConversationCallVideoClipCtx,
  ConversationSelfieCtx,
} from "./registry.js";
