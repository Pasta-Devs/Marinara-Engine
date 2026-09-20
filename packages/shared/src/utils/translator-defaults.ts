export const TRANSLATOR_DEFAULTS_SETTINGS_KEY = "translator-defaults";

const stringKeys = [
  "translationProvider",
  "translationConnectionId",
  "translationTargetLang",
  "translationInputTargetLang",
  "translationOutputTargetLang",
  "translationDeeplApiKey",
  "translationDeeplxUrl",
] as const;
const promptKeys = ["translationPrompt", "translationInputPrompt", "translationOutputPrompt"] as const;
const booleanKeys = ["autoTranslate", "translateInput", "showInputTranslateButton", "translationDisplayOnly"] as const;
export const TRANSLATOR_SETTINGS_KEYS = [...stringKeys, ...promptKeys, ...booleanKeys] as const;

/** Keep only reusable translator settings, including explicit false, empty and prompt-reset values. */
export function normalizeTranslatorSettings(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const settings: Record<string, unknown> = {};
  for (const key of stringKeys) {
    if (typeof source[key] === "string") settings[key] = source[key];
  }
  for (const key of promptKeys) {
    if (source[key] === null || typeof source[key] === "string") settings[key] = source[key];
  }
  for (const key of booleanKeys) {
    if (typeof source[key] === "boolean") settings[key] = source[key];
  }
  if (!["google", "deepl", "deeplx", "ai"].includes(settings.translationProvider as string)) {
    delete settings.translationProvider;
  }
  // Resolve legacy shared values before layering a profile over global defaults.
  for (const key of ["translationInputTargetLang", "translationOutputTargetLang"]) {
    if (!(key in settings) && "translationTargetLang" in settings) settings[key] = settings.translationTargetLang;
  }
  for (const key of ["translationInputPrompt", "translationOutputPrompt"]) {
    if (!(key in settings) && "translationPrompt" in settings) settings[key] = settings.translationPrompt;
  }
  return settings;
}

export interface TranslationConfig {
  chatId?: string;
  provider: "ai" | "deeplx" | "deepl" | "google";
  inputTargetLanguage: string;
  outputTargetLanguage: string;
  connectionId?: string;
  inputSystemPrompt?: string;
  outputSystemPrompt?: string;
  deeplApiKey?: string;
  deeplxUrl?: string;
}

export function getChatTranslationConfig(chatId: string, metadata: unknown): TranslationConfig {
  const chatMeta = normalizeTranslatorSettings(metadata);
  const legacyTargetLanguage =
    (typeof chatMeta.translationTargetLang === "string" ? chatMeta.translationTargetLang.trim() : "") || "en";
  const legacySystemPrompt = typeof chatMeta.translationPrompt === "string" ? chatMeta.translationPrompt : undefined;
  const inputSystemPrompt =
    chatMeta.translationInputPrompt === undefined
      ? legacySystemPrompt
      : typeof chatMeta.translationInputPrompt === "string"
        ? chatMeta.translationInputPrompt
        : undefined;
  const outputSystemPrompt =
    chatMeta.translationOutputPrompt === undefined
      ? legacySystemPrompt
      : typeof chatMeta.translationOutputPrompt === "string"
        ? chatMeta.translationOutputPrompt
        : undefined;
  return {
    chatId,
    provider: (chatMeta.translationProvider as TranslationConfig["provider"] | undefined) ?? "google",
    // Cleared fields retain the legacy/default language.
    inputTargetLanguage:
      (typeof chatMeta.translationInputTargetLang === "string" ? chatMeta.translationInputTargetLang.trim() : "") ||
      legacyTargetLanguage,
    outputTargetLanguage:
      (typeof chatMeta.translationOutputTargetLang === "string" ? chatMeta.translationOutputTargetLang.trim() : "") ||
      legacyTargetLanguage,
    connectionId: chatMeta.translationConnectionId as string | undefined,
    inputSystemPrompt,
    outputSystemPrompt,
    deeplApiKey: chatMeta.translationDeeplApiKey as string | undefined,
    deeplxUrl: chatMeta.translationDeeplxUrl as string | undefined,
  };
}
