import type { TextDirection } from "@marinara-engine/shared";

export const DEFAULT_APP_LANGUAGE = "en";

/** Persisted BCP-47 choice, normalized against the shared language registry. */
export type AppLanguage = string;

export interface LocaleMetadata {
  locale: string;
  direction: TextDirection;
}

export interface LocaleDescriptor {
  id: AppLanguage;
  label: string;
}

export interface LoadedLocale {
  metadata: LocaleMetadata;
  messages: Record<string, string>;
}
