// ──────────────────────────────────────────────
// Prompt Override Registry — barrel
//
// Per-domain entries live in registry/*.ts. This
// file aggregates them into the lookup table.
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "./types.js";

import {
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
} from "./registry/sprites.js";
import { GAME_NPC_PORTRAIT, GAME_BACKGROUND, GAME_SCENE_ILLUSTRATION } from "./registry/game-assets.js";
import { CONVERSATION_SELFIE } from "./registry/conversation.js";

export const PROMPT_OVERRIDE_REGISTRY = [
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
  GAME_NPC_PORTRAIT,
  GAME_BACKGROUND,
  GAME_SCENE_ILLUSTRATION,
  CONVERSATION_SELFIE,
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
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
  GAME_NPC_PORTRAIT,
  GAME_BACKGROUND,
  GAME_SCENE_ILLUSTRATION,
  CONVERSATION_SELFIE,
};
export type {
  SpritesExpressionSheetCtx,
  SpritesSinglePortraitCtx,
  SpritesSingleFullBodyCtx,
  SpritesFullBodySheetCtx,
} from "./registry/sprites.js";
export type { GameNpcPortraitCtx, GameBackgroundCtx, GameSceneIllustrationCtx } from "./registry/game-assets.js";
export type { ConversationSelfieCtx } from "./registry/conversation.js";
export type { PromptOverrideKeyDef, PromptVariable } from "./types.js";
