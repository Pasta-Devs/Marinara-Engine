// ──────────────────────────────────────────────
// Hook: Translation — multi-provider message translation
// ──────────────────────────────────────────────
import { useCallback } from "react";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { Message } from "@marinara-engine/shared";
import { toast } from "sonner";
import { api } from "../lib/api-client";
import { parseMessageExtraRecord } from "../lib/chat-message-extra";
import { useTranslationStore, type TranslationConfig } from "../stores/translation.store";
import { chatKeys, replaceCachedMessage } from "./use-chats";

const translationPersistenceQueues = new Map<string, Promise<void>>();
const pendingTranslations = new Map<
  string,
  { messageId: string; text: string; request: Promise<void>; invalidated: boolean }
>();
const queuedTranslations = new Set<{ messageId: string; invalidated: boolean }>();

/** Editing a source also invalidates requests that have not returned yet. */
export function invalidateTranslation(messageId: string) {
  for (const pending of [...pendingTranslations.values(), ...queuedTranslations]) {
    if (pending.messageId === messageId) pending.invalidated = true;
  }
  useTranslationStore.getState().invalidateTranslation(messageId);
}

function enqueueTranslationPersistence(
  queryClient: QueryClient,
  chatId: string,
  messageId: string,
  extra: Record<string, unknown>,
  isValid: () => boolean = () => true,
) {
  const queueKey = `${chatId}:${messageId}`;
  const previous = translationPersistenceQueues.get(queueKey) ?? Promise.resolve();
  const request = previous
    .catch(() => undefined)
    .then(async () => {
      if (!isValid()) return;
      await api.patch(`/chats/${chatId}/messages/${messageId}/extra`, extra);
      if (!isValid()) return;
      queryClient.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        replaceCachedMessage(old, messageId, (message) => ({
          ...message,
          extra: { ...parseMessageExtraRecord(message.extra), ...extra } as unknown as Message["extra"],
        })),
      );
    });
  const settled = request.then(
    () => undefined,
    () => undefined,
  );
  translationPersistenceQueues.set(queueKey, settled);
  void settled.finally(() => {
    if (translationPersistenceQueues.get(queueKey) === settled) {
      translationPersistenceQueues.delete(queueKey);
    }
  });
  return request;
}

/** Shared by manual and automatic translation; navigation must not change the request's settings. */
export function translateMessage(
  queryClient: QueryClient,
  messageId: string,
  text: string,
  config: TranslationConfig,
  chatId?: string,
): Promise<void> {
  const requestChatId = chatId ?? config.chatId;
  const key = `${requestChatId ?? ""}:${messageId}`;
  const pending = pendingTranslations.get(key);
  if (pending) {
    // Finish the previous source (including persistence) before translating a regenerated reply.
    if (pending.text === text && !pending.invalidated) return pending.request;
    const queued = { messageId, invalidated: false };
    queuedTranslations.add(queued);
    return pending.request
      .catch(() => undefined)
      .then(() => {
        queuedTranslations.delete(queued);
        if (!queued.invalidated) return translateMessage(queryClient, messageId, text, config, chatId);
      });
  }
  const store = useTranslationStore.getState();
  const isCurrentChat = () => useTranslationStore.getState().config.chatId === requestChatId;
  if (isCurrentChat()) store.setTranslating(messageId, true);
  const attempt = { messageId, text, request: Promise.resolve(), invalidated: false };
  const request = (async () => {
    let translatedText: string;
    try {
      const result = await api.post<{ translatedText: string }>("/translate", {
        chatId: requestChatId,
        text,
        provider: config.provider,
        targetLanguage: config.outputTargetLanguage,
        connectionId: config.connectionId,
        systemPrompt: config.outputSystemPrompt,
        deeplApiKey: config.deeplApiKey,
        deeplxUrl: config.deeplxUrl,
      });
      if (attempt.invalidated) return;
      translatedText = result.translatedText;
      if (chatId) {
        await enqueueTranslationPersistence(
          queryClient,
          chatId,
          messageId,
          { translation: translatedText, translationSource: text, translationHidden: false },
          () => !attempt.invalidated,
        ).catch(() => {});
      }
      // Navigation can return to this chat while its extras are being saved.
      // Publish after persistence so a seeded, older translation cannot win.
      if (!attempt.invalidated && isCurrentChat()) store.setTranslation(messageId, translatedText, text);
    } finally {
      if (isCurrentChat()) store.setTranslating(messageId, false);
    }
  })();
  attempt.request = request;
  pendingTranslations.set(key, attempt);
  void request
    .finally(() => {
      if (pendingTranslations.get(key)?.request === request) pendingTranslations.delete(key);
    })
    .catch(() => {});
  return request;
}

// ── Hook ──
export function useTranslate() {
  const queryClient = useQueryClient();
  const translations = useTranslationStore((s) => s.translations);
  const translationSources = useTranslationStore((s) => s.translationSources);
  const translating = useTranslationStore((s) => s.translating);
  const config = useTranslationStore((s) => s.config);

  const translate = useCallback(
    async (messageId: string, text: string, chatId?: string, currentSourceAliases: readonly string[] = []) => {
      const store = useTranslationStore.getState();
      const requestChatId = chatId ?? store.config.chatId;
      const isCurrentChat = () => useTranslationStore.getState().config.chatId === requestChatId;
      const storedSource = store.translationSources[messageId];
      const translationMatchesCurrentText = storedSource === text || currentSourceAliases.includes(storedSource);

      // Toggle off if already translated. Keep the saved translation, but persist the hidden display state.
      if (store.translations[messageId] && translationMatchesCurrentText) {
        store.removeTranslation(messageId);
        if (chatId) {
          enqueueTranslationPersistence(queryClient, chatId, messageId, { translationHidden: true }).catch(() => {});
        }
        return;
      }

      try {
        await translateMessage(queryClient, messageId, text, store.config, chatId);
      } catch (err) {
        console.error("Translation failed:", err);
        if (isCurrentChat()) toast.error(err instanceof Error ? err.message : "Translation failed");
      }
    },
    [queryClient],
  );

  return {
    translate,
    translations,
    translationSources,
    translating,
    config,
  };
}
