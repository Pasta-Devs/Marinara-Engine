import { useEffect, useRef } from "react";
import { useUpdateChatMetadata, type Chat } from "../../../../catalog/chats/index";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "../../../../../shared/lib/backgrounds";
import { useTranslationStore } from "../../../../../shared/stores/translation.store";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import type { MessageWithSwipes } from "../types";

type UseChatMetadataSyncOptions = {
  chat: Chat | null | undefined;
  chatMeta: Record<string, unknown>;
  messages: MessageWithSwipes[] | undefined;
  messagePageCount: number;
};

function metadataString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function metadataTranslationProvider(value: unknown): "ai" | "deeplx" | "deepl" | "google" {
  return value === "ai" || value === "deeplx" || value === "deepl" || value === "google" ? value : "google";
}

export function useChatMetadataSync({ chat, chatMeta, messages, messagePageCount }: UseChatMetadataSyncOptions) {
  const chatBackground = useUIStore((state) => state.chatBackground);
  const updateMeta = useUpdateChatMetadata();

  useEffect(() => {
    if (!chat?.id) return;
    useTranslationStore.getState().setConfig({
      provider: metadataTranslationProvider(chatMeta.translationProvider),
      targetLanguage: metadataString(chatMeta.translationTargetLang) ?? "en",
      connectionId: metadataString(chatMeta.translationConnectionId),
      deeplApiKey: metadataString(chatMeta.translationDeeplApiKey),
      deeplxUrl: metadataString(chatMeta.translationDeeplxUrl),
    });
  }, [
    chat?.id,
    chatMeta.translationProvider,
    chatMeta.translationTargetLang,
    chatMeta.translationConnectionId,
    chatMeta.translationDeeplApiKey,
    chatMeta.translationDeeplxUrl,
  ]);

  const prevChatIdRef = useRef(chat?.id);
  useEffect(() => {
    if (!messages) return;
    if (prevChatIdRef.current !== chat?.id) {
      useTranslationStore.getState().clearAll();
      prevChatIdRef.current = chat?.id;
    }
    useTranslationStore
      .getState()
      .seedFromMessages(messages as unknown as Array<{ id: string; extra?: string | Record<string, unknown> | null }>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, messagePageCount]);

  const restoredChatBackgroundRef = useRef<{ chatId: string | null; url: string | null; isSyncing: boolean }>({
    chatId: null,
    url: null,
    isSyncing: false,
  });
  useEffect(() => {
    if (!chat?.id) return;
    const restoredUrl = chatBackgroundMetadataToUrl(chatMeta.background);
    const previousRestore = restoredChatBackgroundRef.current;
    const currentBackground = useUIStore.getState().chatBackground;
    const chatChanged = previousRestore.chatId !== chat.id;
    const metadataCaughtUpToLocalChange = currentBackground === restoredUrl;
    const backgroundStillAtLastRestore = currentBackground === previousRestore.url;

    if (!chatChanged && !metadataCaughtUpToLocalChange && !backgroundStillAtLastRestore) return;

    const needsUiRestore = currentBackground !== restoredUrl;
    restoredChatBackgroundRef.current = { chatId: chat.id, url: restoredUrl, isSyncing: needsUiRestore };
    if (needsUiRestore) useUIStore.getState().setChatBackground(restoredUrl);
  }, [chat?.id, chatMeta.background]);

  const bgPersistTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const clearBackgroundPersistTimer = (chatId: string) => {
    const timer = bgPersistTimers.current.get(chatId);
    if (!timer) return;
    clearTimeout(timer);
    bgPersistTimers.current.delete(chatId);
  };
  const scheduleBackgroundPersist = (chatId: string, background: string | null) => {
    clearBackgroundPersistTimer(chatId);
    const timer = setTimeout(() => {
      bgPersistTimers.current.delete(chatId);
      updateMeta.mutate({ id: chatId, background });
    }, 500);
    bgPersistTimers.current.set(chatId, timer);
  };
  useEffect(() => {
    if (!chat?.id) return;
    const chatId = chat.id;
    const savedBackground = chatBackgroundUrlToMetadata(chatBackgroundMetadataToUrl(chatMeta.background));
    const restoredBackground = restoredChatBackgroundRef.current;

    if (
      restoredBackground.isSyncing &&
      (restoredBackground.chatId !== chatId || chatBackground !== restoredBackground.url)
    ) {
      return;
    }
    if (restoredBackground.isSyncing) {
      restoredBackground.isSyncing = false;
    }

    if (!chatBackground) {
      if (savedBackground === null) {
        clearBackgroundPersistTimer(chatId);
        return;
      }
      scheduleBackgroundPersist(chatId, null);
      return;
    }

    const nextBackground = chatBackgroundUrlToMetadata(chatBackground);
    if (nextBackground === savedBackground) {
      clearBackgroundPersistTimer(chatId);
      return;
    }
    scheduleBackgroundPersist(chatId, nextBackground);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatBackground, chat?.id, chatMeta.background]);

  useEffect(() => {
    const timers = bgPersistTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return { chatBackground, updateMeta };
}
