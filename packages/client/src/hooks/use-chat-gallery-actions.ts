// ──────────────────────────────────────────────
// Gallery actions offered by the chat surface that is on screen
//
// The Gallery drawer lives in Chat Settings, outside the chat surface that knows
// how to illustrate, animate or storyboard. Each surface (Conversation,
// Roleplay, Game) provides its actions here, keyed by chat id.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { create } from "zustand";
import type { ChatImage } from "./use-gallery";

export interface ChatGalleryActions {
  /** Manually trigger the Illustrator agent. */
  onIllustrate?: () => void | Promise<void>;
  /** Manually trigger an active custom image-generation agent. */
  onIllustrateWithAgent?: (agentType: string) => void | Promise<void>;
  /** Generate an on-demand Conversation selfie. */
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
  selfieCharacters?: Array<{ id: string; name: string }>;
  /** Run Illustrator in its background prompt mode. */
  onGenerateBackground?: () => void | Promise<void>;
  /** Generate a storyboard for the latest completed turn. */
  onGenerateStoryboard?: () => void | Promise<void>;
  /** Show the latest Game Mode storyboard viewer. */
  onViewStoryboard?: () => void;
  /** Generate a scene video from the latest illustration. */
  onGenerateVideo?: () => void | Promise<void>;
  /** Generate a scene video from a specific gallery illustration. */
  onAnimateImage?: (image: ChatImage) => void | Promise<void>;
}

const useChatGalleryActionsStore = create<{ byChat: Record<string, ChatGalleryActions> }>(() => ({ byChat: {} }));

/** The actions the mounted surface offers for this chat (none while no surface shows it). */
export function useChatGalleryActions(chatId: string): ChatGalleryActions | undefined {
  return useChatGalleryActionsStore((state) => state.byChat[chatId]);
}

/** Offers a surface's gallery actions while it is mounted. Pass a memoized object. */
export function useProvideChatGalleryActions(chatId: string | null | undefined, actions: ChatGalleryActions) {
  useEffect(() => {
    if (!chatId) return;
    useChatGalleryActionsStore.setState((state) => ({ byChat: { ...state.byChat, [chatId]: actions } }));
  }, [actions, chatId]);
  useEffect(() => {
    if (!chatId) return;
    return () =>
      useChatGalleryActionsStore.setState((state) => {
        const byChat = { ...state.byChat };
        delete byChat[chatId];
        return { byChat };
      });
  }, [chatId]);
}
