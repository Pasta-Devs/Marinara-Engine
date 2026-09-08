// ──────────────────────────────────────────────
// Hook: Translation — multi-provider message translation
// ──────────────────────────────────────────────
import { useCallback } from "react";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { Message } from "@marinara-engine/shared";
import { toast } from "sonner";
import { api } from "../lib/api-client";
import { parseMessageExtraRecord } from "../lib/chat-message-extra";
import { useTranslationStore } from "../stores/translation.store";
import { chatKeys, replaceCachedMessage } from "./use-chats";

const translationPersistenceQueues = new Map<string, Promise<void>>();

function enqueueTranslationPersistence(
  queryClient: QueryClient,
  chatId: string,
  messageId: string,
  extra: Record<string, unknown>,
) {
  const queueKey = `${chatId}:${messageId}`;
  const previous = translationPersistenceQueues.get(queueKey) ?? Promise.resolve();
  const request = previous
    .catch(() => undefined)
    .then(async () => {
      await api.patch(`/chats/${chatId}/messages/${messageId}/extra`, extra);
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

      // Skip if already in-flight
      if (store.translating[messageId]) return;

      store.setTranslating(messageId, true);
      try {
        const result = await api.post<{ translatedText: string }>("/translate", {
          text,
          provider: store.config.provider,
          targetLanguage: store.config.outputTargetLanguage,
          connectionId: store.config.connectionId,
          systemPrompt: store.config.outputSystemPrompt,
          deeplApiKey: store.config.deeplApiKey,
          deeplxUrl: store.config.deeplxUrl,
        });
        if (isCurrentChat()) store.setTranslation(messageId, result.translatedText, text);
        // Persist to message extra so translation survives refresh/chat switch
        if (chatId) {
          enqueueTranslationPersistence(queryClient, chatId, messageId, {
            translation: result.translatedText,
            translationSource: text,
            translationHidden: false,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Translation failed:", err);
        if (isCurrentChat()) toast.error(err instanceof Error ? err.message : "Translation failed");
      } finally {
        if (isCurrentChat()) store.setTranslating(messageId, false);
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
