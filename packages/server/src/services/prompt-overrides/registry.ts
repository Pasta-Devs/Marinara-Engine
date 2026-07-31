// ──────────────────────────────────────────────
// Prompt Override Registry — barrel
//
// Per-domain entries live in registry/*.ts. This
// file aggregates them into the lookup table.
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "./types.js";

import {
  SPRITES_ANIMATED_PORTRAIT,
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
} from "./registry/sprites.js";
import {
  GAME_NPC_PORTRAIT,
  GAME_BACKGROUND,
  MAPS_LOCATION_ARTWORK,
  GAME_SCENE_ILLUSTRATION,
  GAME_NARRATION_SUMMARIZER,
  GAME_IMAGE_PROMPT_DIRECTOR,
  GAME_VIDEO,
} from "./registry/game-assets.js";
import { CONVERSATION_SELFIE } from "./registry/conversation.js";
import { ROLEPLAY_GALLERY_VIDEO_DIRECTOR } from "./registry/roleplay.js";
import {
  CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND,
  CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND,
  CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT,
  CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND,
  CONVERSATION_CALL_VIDEO_PROMPTS,
} from "./registry/conversation-call-videos.js";
import { NOODLE_IMAGE_POST, NOODLE_TIMELINE_BASE, NOODLE_TIMELINE_VOICE } from "./registry/noodle.js";

export const PROMPT_OVERRIDE_REGISTRY = [
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_ANIMATED_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
  GAME_NPC_PORTRAIT,
  GAME_BACKGROUND,
  MAPS_LOCATION_ARTWORK,
  GAME_SCENE_ILLUSTRATION,
  GAME_NARRATION_SUMMARIZER,
  GAME_IMAGE_PROMPT_DIRECTOR,
  GAME_VIDEO,
  ROLEPLAY_GALLERY_VIDEO_DIRECTOR,
  ...CONVERSATION_CALL_VIDEO_PROMPTS,
  CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT,
  CONVERSATION_SELFIE,
  NOODLE_IMAGE_POST,
  NOODLE_TIMELINE_BASE,
  NOODLE_TIMELINE_VOICE,
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKeyDef = PromptOverrideKeyDef<any>;

const REGISTRY_BY_KEY: ReadonlyMap<string, AnyKeyDef> = (() => {
  const map = new Map<string, AnyKeyDef>();
  for (const def of PROMPT_OVERRIDE_REGISTRY) {
    if (map.has(def.key)) {
      throw new Error(`Duplicate prompt override key registered: ${def.key}`);
    }
    map.set(def.key, def as AnyKeyDef);
  }
  return map;
})();

export function getPromptOverrideDef(key: string): AnyKeyDef | undefined {
  return REGISTRY_BY_KEY.get(key);
}

export function listPromptOverrideKeys(): string[] {
  return PROMPT_OVERRIDE_REGISTRY.map((def) => def.key);
}

// Re-export the typed key defs for direct import at call sites.
export {
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_ANIMATED_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
  GAME_NPC_PORTRAIT,
  GAME_BACKGROUND,
  MAPS_LOCATION_ARTWORK,
  GAME_SCENE_ILLUSTRATION,
  GAME_NARRATION_SUMMARIZER,
  GAME_IMAGE_PROMPT_DIRECTOR,
  GAME_VIDEO,
  ROLEPLAY_GALLERY_VIDEO_DIRECTOR,
  CONVERSATION_CALL_VIDEO_PROMPTS,
  CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT,
  CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND,
  CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND,
  CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND,
  CONVERSATION_SELFIE,
  NOODLE_IMAGE_POST,
  NOODLE_TIMELINE_BASE,
  NOODLE_TIMELINE_VOICE,
};
export type {
  SpritesExpressionSheetCtx,
  SpritesSinglePortraitCtx,
  SpritesAnimatedPortraitCtx,
  SpritesSingleFullBodyCtx,
  SpritesFullBodySheetCtx,
} from "./registry/sprites.js";
export type {
  GameNpcPortraitCtx,
  GameBackgroundCtx,
  MapsLocationArtworkCtx,
  GameSceneIllustrationCtx,
  GameNarrationSummarizerCtx,
  GameImagePromptDirectorCtx,
  GameVideoCtx,
} from "./registry/game-assets.js";
export type { RoleplayGalleryVideoDirectorCtx } from "./registry/roleplay.js";
export type {
  ConversationCallCustomVideoClipCtx,
  ConversationCallVideoClipCtx,
} from "./registry/conversation-call-videos.js";
export type { ConversationSelfieCtx } from "./registry/conversation.js";
export type { NoodleImagePostCtx, NoodleTimelineBaseCtx, NoodleTimelineVoiceCtx } from "./registry/noodle.js";
export type { PromptOverrideKeyDef, PromptVariable } from "./types.js";
