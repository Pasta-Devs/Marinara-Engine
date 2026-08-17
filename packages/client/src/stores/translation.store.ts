import { create } from "zustand";

// ── Translation config (set from chat metadata) ──
export interface TranslationConfig {
  provider: "ai" | "deeplx" | "deepl" | "google";
  inputTargetLanguage: string;
  outputTargetLanguage: string;
  connectionId?: string;
  inputSystemPrompt?: string;
  outputSystemPrompt?: string;
  deeplApiKey?: string;
  deeplxUrl?: string;
}

// ── Zustand store for translation cache ──
interface TranslationStore {
  /** Config for the currently active chat */
  config: TranslationConfig;
  setConfig: (config: TranslationConfig) => void;
  /** messageId -> translated text */
  translations: Record<string, string>;
  /** messageId -> the source text that was translated (used to detect stale swipe/edit content) */
  translationSources: Record<string, string>;
  /** messageId -> hidden translation display state */
  hiddenTranslationIds: Record<string, boolean>;
  /** messageId -> currently translating */
  translating: Record<string, boolean>;
  setTranslation: (id: string, text: string, source?: string) => void;
  removeTranslation: (id: string) => void;
  setTranslating: (id: string, val: boolean) => void;
  /** Clear all translations (e.g. on chat switch) */
  clearAll: () => void;
  /** Seed translations from message extras (e.g. on chat load) */
  seedFromMessages: (
    messages: Array<{ id: string; content?: string; extra?: string | Record<string, unknown> | null }>,
  ) => void;
}

export const useTranslationStore = create<TranslationStore>((set) => ({
  config: { provider: "google", inputTargetLanguage: "en", outputTargetLanguage: "en" },
  setConfig: (config) => set({ config }),
  translations: {},
  translationSources: {},
  hiddenTranslationIds: {},
  translating: {},
  setTranslation: (id, text, source) =>
    set((s) => {
      const { [id]: _, ...hiddenRest } = s.hiddenTranslationIds;
      return {
        translations: { ...s.translations, [id]: text },
        translationSources: source === undefined ? s.translationSources : { ...s.translationSources, [id]: source },
        hiddenTranslationIds: hiddenRest,
      };
    }),
  removeTranslation: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.translations;
      const { [id]: __, ...sourceRest } = s.translationSources;
      return {
        translations: rest,
        translationSources: sourceRest,
        hiddenTranslationIds: { ...s.hiddenTranslationIds, [id]: true },
      };
    }),
  setTranslating: (id, val) => set((s) => ({ translating: { ...s.translating, [id]: val } })),
  clearAll: () => set({ translations: {}, translationSources: {}, translating: {}, hiddenTranslationIds: {} }),
  seedFromMessages: (messages) =>
    set((s) => {
      const seeded: Record<string, string> = {};
      const seededSources: Record<string, string> = {};
      for (const msg of messages) {
        if (!msg.extra) continue;
        try {
          const extra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : msg.extra;
          if (
            extra.translation &&
            typeof extra.translation === "string" &&
            extra.translationHidden !== true &&
            !s.hiddenTranslationIds[msg.id]
          ) {
            seeded[msg.id] = extra.translation;
            if (typeof extra.translationSource === "string") {
              seededSources[msg.id] = extra.translationSource;
            } else if (typeof msg.content === "string") {
              seededSources[msg.id] = msg.content;
            }
          }
        } catch {
          // Skip messages with malformed extra JSON
        }
      }
      // Merge with existing (in-flight translations win over seeded)
      return {
        translations: { ...seeded, ...s.translations },
        translationSources: { ...seededSources, ...s.translationSources },
      };
    }),
}));
