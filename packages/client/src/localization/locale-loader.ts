import type { TextDirection } from "@marinara-engine/shared";
import {
  DEFAULT_APP_LANGUAGE,
  type AppLanguage,
  type LoadedLocale,
  type LocaleDescriptor,
  type LocaleMetadata,
} from "./locale-types";

type LocaleAssetLoader = () => Promise<string>;

const INTENTIONALLY_EMPTY_TRANSLATION_KEYS = new Set([
  "ui.lorebooks.lorebookeditor.es",
  "ui.noodle.stageprofileview.s",
]);

const localeAssets = import.meta.glob<string>("./locales/*.json", {
  import: "default",
  query: "?url",
});
const localeLoaders = new Map<string, LocaleAssetLoader>();

function canonicalizeLocale(value: string): string | null {
  try {
    return Intl.getCanonicalLocales(value.trim())[0] ?? null;
  } catch {
    return null;
  }
}

function localeFromModulePath(path: string): string | null {
  const match = /\/([^/]+)\.json$/u.exec(path);
  return match ? canonicalizeLocale(match[1]) : null;
}

for (const [path, loader] of Object.entries(localeAssets)) {
  const locale = localeFromModulePath(path);
  if (!locale) {
    throw new Error(`Invalid localization filename: ${path}`);
  }
  if (localeLoaders.has(locale)) {
    throw new Error(`Duplicate localization locale: ${locale}`);
  }
  localeLoaders.set(locale, loader);
}

if (!localeLoaders.has(DEFAULT_APP_LANGUAGE)) {
  throw new Error(`Missing canonical ${DEFAULT_APP_LANGUAGE}.json localization file`);
}

function getNativeLanguageName(locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
    // Intl returns mid-sentence forms ("español", "français"); as standalone
    // UI labels they are capitalized, matching the Documentation Language
    // selector's native names. Caseless scripts pass through unchanged.
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return locale;
  }
}

export const APP_LANGUAGE_OPTIONS: readonly LocaleDescriptor[] = Object.freeze(
  [...localeLoaders.keys()]
    .map((id) => ({ id, label: getNativeLanguageName(id) }))
    .sort((left, right) => {
      if (left.id === DEFAULT_APP_LANGUAGE) return -1;
      if (right.id === DEFAULT_APP_LANGUAGE) return 1;
      // Order by language code, not label: comparing native-script labels with
      // a per-item collation locale is non-transitive across scripts and
      // scrambled the dropdown. Code order also matches the Documentation
      // Language selector, so the two pickers agree.
      return left.id.localeCompare(right.id, "en");
    }),
);

export function resolveSupportedLocale(value: unknown): AppLanguage {
  if (typeof value !== "string") return DEFAULT_APP_LANGUAGE;
  const locale = canonicalizeLocale(value);
  return locale && localeLoaders.has(locale) ? locale : DEFAULT_APP_LANGUAGE;
}

function normalizeDirection(value: unknown): TextDirection | null {
  return value === "ltr" || value === "rtl" ? value : null;
}

export function normalizeLocaleResource(locale: string, input: unknown): LoadedLocale {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${locale}.json must contain a JSON object`);
  }

  const resource = input as Record<string, unknown>;
  const rawMetadata = resource._meta;
  if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) {
    throw new Error(`${locale}.json is missing its _meta object`);
  }

  const metadataValue = rawMetadata as Record<string, unknown>;
  const metadataLocale = typeof metadataValue.locale === "string" ? canonicalizeLocale(metadataValue.locale) : null;
  const direction = normalizeDirection(metadataValue.direction);
  if (metadataLocale !== locale || !direction) {
    throw new Error(`${locale}.json has invalid locale metadata`);
  }

  const messages: Record<string, string> = {};
  for (const [key, value] of Object.entries(resource)) {
    if (key === "_meta") continue;
    const intentionallyEmpty =
      value === "" && locale !== DEFAULT_APP_LANGUAGE && INTENTIONALLY_EMPTY_TRANSLATION_KEYS.has(key);
    if (typeof value !== "string" || (!value.trim() && !intentionallyEmpty)) {
      throw new Error(`${locale}.json key ${key} must contain non-empty text`);
    }
    messages[key] = value;
  }

  const metadata: LocaleMetadata = { locale, direction };
  return { metadata, messages };
}

export async function loadLocaleResource(value: unknown): Promise<LoadedLocale> {
  const locale = resolveSupportedLocale(value);
  const loader = localeLoaders.get(locale);
  if (!loader) {
    throw new Error(`Localization file is unavailable for ${locale}`);
  }
  const assetUrl = await loader();
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Localization file ${locale}.json returned HTTP ${response.status}`);
  }
  return normalizeLocaleResource(locale, await response.json());
}
