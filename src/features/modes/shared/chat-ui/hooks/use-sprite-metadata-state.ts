import { useCallback, useEffect, useMemo, useRef } from "react";
import { useUpdateChatMetadata, useUpdateMessageExtra, type Chat } from "../../../../catalog/chats/index";
import type { SpritePlacement, SpriteSide } from "../../../../../engine/contracts/types/chat";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { mirrorSpritePlacements, normalizeSpritePlacements } from "../../../../runtime/visuals/sprite-placement";
import { normalizeSpriteDisplayModes, type SpriteDisplayMode } from "../../../../runtime/visuals/sprite-display-modes";
import type { MessageWithSwipes } from "../types";

type UseSpriteMetadataStateOptions = {
  chat: Chat | null | undefined;
  chatMeta: Record<string, unknown>;
  messages?: MessageWithSwipes[] | undefined;
};

function normalizeSpriteDisplayValue(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function readMessageExtra(message: MessageWithSwipes): Record<string, unknown> {
  return message.extra && typeof message.extra === "object" && !Array.isArray(message.extra)
    ? (message.extra as unknown as Record<string, unknown>)
    : {};
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length ? Object.fromEntries(entries) : null;
}

export function useSpriteMetadataState({ chat, chatMeta, messages }: UseSpriteMetadataStateOptions) {
  const updateMeta = useUpdateChatMetadata();
  const updateMessageExtra = useUpdateMessageExtra(chat?.id ?? null);
  const roleplaySpriteScale = useUIStore((state) => state.roleplaySpriteScale);
  const expressionSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const spritePlacementSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const spriteCharacterIds: string[] = Array.isArray(chatMeta.spriteCharacterIds) ? chatMeta.spriteCharacterIds : [];
  const spriteDisplayModes: SpriteDisplayMode[] = normalizeSpriteDisplayModes(chatMeta.spriteDisplayModes);
  const spritePosition: SpriteSide = chatMeta.spritePosition === "right" ? "right" : "left";
  const spriteScale = normalizeSpriteDisplayValue(chatMeta.spriteScale, roleplaySpriteScale, 0.5, 1.75);
  const spriteOpacity = normalizeSpriteDisplayValue(chatMeta.spriteOpacity, 1, 0.15, 1);
  const spritePlacements = useMemo(
    () => normalizeSpritePlacements(chatMeta.spritePlacements),
    [chatMeta.spritePlacements],
  );
  const hasCustomSpritePlacements = Object.keys(spritePlacements).length > 0;

  const spriteExpressions: Record<string, string> = useMemo(() => {
    if (messages?.length) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]!;
        if (message.role === "assistant") {
          const extra = readMessageExtra(message);
          const spriteExpressions = stringRecord(extra.spriteExpressions);
          if (spriteExpressions && Object.keys(spriteExpressions).length > 0) {
            return spriteExpressions;
          }
          break;
        }
      }
    }
    return {};
  }, [messages]);

  const pendingExpressions = useRef<Record<string, string>>(spriteExpressions);
  const pendingSpritePlacements = useRef<Record<string, SpritePlacement>>(spritePlacements);

  useEffect(() => {
    pendingExpressions.current = spriteExpressions;
  }, [spriteExpressions]);

  useEffect(() => {
    pendingSpritePlacements.current = spritePlacements;
  }, [spritePlacements]);

  useEffect(() => {
    return () => {
      if (expressionSaveTimer.current) clearTimeout(expressionSaveTimer.current);
      if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
    };
  }, []);

  const persistSpriteExpressions = useCallback(
    (expressions: Record<string, string>) => {
      if (!chat?.id) return;
      if (messages?.length) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
          const message = messages[index]!;
          if (message.role === "assistant") {
            updateMessageExtra.mutate({
              messageId: message.id,
              extra: { spriteExpressions: expressions },
            });
            break;
          }
        }
      }
    },
    [chat?.id, messages, updateMessageExtra],
  );

  const handleExpressionChange = useCallback(
    (characterId: string, expression: string, options?: { immediate?: boolean }) => {
      if (!chat?.id) return;
      pendingExpressions.current = { ...pendingExpressions.current, [characterId]: expression };
      if (expressionSaveTimer.current) clearTimeout(expressionSaveTimer.current);
      if (options?.immediate) {
        persistSpriteExpressions(pendingExpressions.current);
        return;
      }
      expressionSaveTimer.current = setTimeout(() => {
        persistSpriteExpressions(pendingExpressions.current);
      }, 1000);
    },
    [chat?.id, persistSpriteExpressions],
  );

  const handleSpritePlacementChange = useCallback(
    (characterId: string, placement: SpritePlacement) => {
      if (!chat?.id) return;
      pendingSpritePlacements.current = { ...pendingSpritePlacements.current, [characterId]: placement };
      if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
      spritePlacementSaveTimer.current = setTimeout(() => {
        updateMeta.mutate({ id: chat.id, spritePlacements: pendingSpritePlacements.current });
      }, 250);
    },
    [chat?.id, updateMeta],
  );

  const handleResetSpritePlacements = useCallback(() => {
    if (!chat?.id) return;
    pendingSpritePlacements.current = {};
    if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
    updateMeta.mutate({ id: chat.id, spritePlacements: {} });
  }, [chat?.id, updateMeta]);

  const handleSetSpritePosition = useCallback(
    (nextSide: SpriteSide) => {
      if (!chat?.id || nextSide === spritePosition) return;
      const nextPlacements = hasCustomSpritePlacements ? mirrorSpritePlacements(spritePlacements) : spritePlacements;
      pendingSpritePlacements.current = nextPlacements;
      if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
      updateMeta.mutate({
        id: chat.id,
        spritePosition: nextSide,
        spritePlacements: nextPlacements,
      });
    },
    [chat?.id, hasCustomSpritePlacements, spritePlacements, spritePosition, updateMeta],
  );

  const handleToggleSpritePosition = useCallback(() => {
    handleSetSpritePosition(spritePosition === "left" ? "right" : "left");
  }, [handleSetSpritePosition, spritePosition]);

  return {
    spriteCharacterIds,
    spriteDisplayModes,
    spritePosition,
    spriteScale,
    spriteOpacity,
    spritePlacements,
    hasCustomSpritePlacements,
    spriteExpressions,
    handleExpressionChange,
    handleSpritePlacementChange,
    handleResetSpritePlacements,
    handleSetSpritePosition,
    handleToggleSpritePosition,
  };
}
