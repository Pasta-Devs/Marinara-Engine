import { createInstance, type TOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import {
  APP_LANGUAGE_OPTIONS,
  loadLocaleResource,
  resolveSupportedLocale,
} from "./locale-loader";
import { DEFAULT_APP_LANGUAGE, type AppLanguage, type LocaleMetadata } from "./locale-types";

const loadedMetadata = new Map<string, LocaleMetadata>();
const englishMessageKeys = new Map<string, string[]>();

export const i18n = createInstance();

const initialization = i18n.use(initReactI18next).init({
  resources: {},
  lng: DEFAULT_APP_LANGUAGE,
  fallbackLng: DEFAULT_APP_LANGUAGE,
  supportedLngs: APP_LANGUAGE_OPTIONS.map((option) => option.id),
  load: "currentOnly",
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: true,
  returnNull: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  initAsync: false,
});

let activationRevision = 0;

async function ensureLocaleResource(locale: AppLanguage) {
  if (i18n.hasResourceBundle(locale, "translation")) return;

  const resource = await loadLocaleResource(locale);
  i18n.addResourceBundle(locale, "translation", resource.messages, true, true);
  loadedMetadata.set(locale, resource.metadata);

  if (locale === DEFAULT_APP_LANGUAGE) {
    englishMessageKeys.clear();
    for (const [key, message] of Object.entries(resource.messages)) {
      const keys = englishMessageKeys.get(message) ?? [];
      keys.push(key);
      englishMessageKeys.set(message, keys);
    }
  }
}

function syncDocumentLocale(locale: string, metadata: LocaleMetadata) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = metadata.direction;
}

function syncDocumentTitle() {
  if (typeof document === "undefined") return;
  document.title = i18n.t("app.documentTitle");
}

export async function activateLocale(requestedLocale: unknown): Promise<AppLanguage> {
  const requestRevision = ++activationRevision;
  await initialization;
  await ensureLocaleResource(DEFAULT_APP_LANGUAGE);

  let locale = resolveSupportedLocale(requestedLocale);
  try {
    await ensureLocaleResource(locale);
  } catch (error) {
    console.error(`[localization] Could not load ${locale}; falling back to English`, error);
    locale = DEFAULT_APP_LANGUAGE;
  }

  if (requestRevision !== activationRevision) {
    return locale;
  }

  const metadata = loadedMetadata.get(locale) ?? loadedMetadata.get(DEFAULT_APP_LANGUAGE);
  if (!metadata) {
    throw new Error(`Missing ${DEFAULT_APP_LANGUAGE} localization metadata`);
  }
  syncDocumentLocale(locale, metadata);
  await i18n.changeLanguage(locale);
  syncDocumentTitle();
  return locale;
}

export async function initializeLocalization(requestedLocale: unknown): Promise<AppLanguage> {
  return activateLocale(requestedLocale);
}

export function translate(key: string, options?: TOptions): string {
  return String(i18n.t(key, options));
}

/**
 * Finds the semantic catalog key for an exact canonical-English UI message.
 *
 * This is a migration bridge for shared primitives that still receive legacy
 * English labels as props. New UI should call t("semantic.key") directly.
 */
export function findEnglishMessageKey(message: string, locale?: string): string | undefined {
  const keys = englishMessageKeys.get(message);
  if (!keys?.length) return undefined;
  if (!locale || locale === DEFAULT_APP_LANGUAGE) return keys[0];

  return (
    keys.find((key) => typeof i18n.getResource(locale, "translation", key) === "string") ??
    keys[0]
  );
}
