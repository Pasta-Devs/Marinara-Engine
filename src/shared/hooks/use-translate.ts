import { useCallback } from "react";
import { toast } from "sonner";
import { storageApi } from "../api/storage-api";
import { translationApi } from "../api/translation-api";
import { useTranslationStore } from "../stores/translation.store";

async function patchMessageExtra(messageId: string, patch: Record<string, unknown>) {
  const message = await storageApi.get<{ extra?: unknown }>("messages", messageId);
  const extra =
    message?.extra && typeof message.extra === "object" && !Array.isArray(message.extra)
      ? { ...(message.extra as Record<string, unknown>) }
      : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete extra[key];
    } else {
      extra[key] = value;
    }
  }
  await storageApi.update("messages", messageId, { extra });
}

export function useTranslate() {
  const config = useTranslationStore((s) => s.config);
  const translations = useTranslationStore((s) => s.translations);
  const translating = useTranslationStore((s) => s.translating);
  const setTranslation = useTranslationStore((s) => s.setTranslation);
  const removeTranslation = useTranslationStore((s) => s.removeTranslation);
  const setTranslating = useTranslationStore((s) => s.setTranslating);

  const translate = useCallback(
    async (messageId?: string, content?: string, chatId?: string) => {
      if (!messageId || !content?.trim()) return;
      if (translations[messageId]) {
        removeTranslation(messageId);
        if (chatId) {
          patchMessageExtra(messageId, { translation: null }).catch((error) =>
            console.warn("[translation] Failed to clear persisted translation", error),
          );
        }
        return;
      }
      setTranslating(messageId, true);
      try {
        const result = await translationApi.translateText({
          text: content,
          provider: config.provider,
          targetLanguage: config.targetLanguage,
          connectionId: config.connectionId,
          deeplApiKey: config.deeplApiKey,
          deeplxUrl: config.deeplxUrl,
        });
        setTranslation(messageId, result.translatedText);
        if (chatId) {
          await patchMessageExtra(messageId, { translation: result.translatedText }).catch((error) =>
            console.warn("[translation] Failed to persist translation", error),
          );
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to translate message");
      } finally {
        setTranslating(messageId, false);
      }
    },
    [config, removeTranslation, setTranslating, setTranslation, translations],
  );

  return {
    translations,
    translating,
    translateMessage: translate,
    translate,
  };
}
