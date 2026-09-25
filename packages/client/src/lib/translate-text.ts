import { api } from "./api-client";
import { useTranslationStore } from "../stores/translation.store";

export type TranslationDirection = "input" | "output";

/** Standalone translate helper for on-demand translation flows. */
export async function translateText(text: string, direction: TranslationDirection = "output"): Promise<string> {
  const store = useTranslationStore.getState();
  const isInput = direction === "input";
  const result = await api.post<{ translatedText: string }>("/translate", {
    chatId: store.config.chatId,
    text,
    provider: store.config.provider,
    targetLanguage: isInput ? store.config.inputTargetLanguage : store.config.outputTargetLanguage,
    connectionId: store.config.connectionId,
    systemPrompt: isInput ? store.config.inputSystemPrompt : store.config.outputSystemPrompt,
    deeplApiKey: store.config.deeplApiKey,
    deeplxUrl: store.config.deeplxUrl,
  });
  return result.translatedText;
}
