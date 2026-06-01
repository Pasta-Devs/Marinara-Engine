import { invokeTauri } from "./tauri-client";

type TranslationProvider = "ai" | "deeplx" | "deepl" | "google";

export interface TranslateTextInput {
  text: string;
  provider: TranslationProvider;
  targetLanguage: string;
  connectionId?: string;
  deeplApiKey?: string;
  deeplxUrl?: string;
}

export interface TranslateTextResponse {
  translatedText: string;
}

export const translationApi = {
  translateText: async (input: TranslateTextInput): Promise<TranslateTextResponse> => {
    const response = await invokeTauri<unknown>("translate_text_command", { input });
    if (!response || typeof response !== "object" || !("translatedText" in response)) {
      throw new Error("Translation response did not include translated text.");
    }
    const translatedText = (response as { translatedText: unknown }).translatedText;
    if (typeof translatedText !== "string") {
      throw new Error("Translation response did not include translated text.");
    }
    return { translatedText };
  },
};
