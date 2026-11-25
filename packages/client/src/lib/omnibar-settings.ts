import {
  SETTINGS_SEARCHABLE_CONTROLS,
  SETTINGS_SECTION_BY_ID,
  SETTINGS_SECTIONS,
  SETTINGS_TABS,
  type SettingsSectionId,
  type SettingsTabId,
} from "./settings-registry";

export type OmnibarSettingsDestination = {
  id: string;
  title: string;
  description: string;
  /** `en.json` keys for a control's `title` and `description`; tabs and sections have none. */
  titleKey?: string;
  descriptionKey?: string;
  aliases: readonly string[];
  /** Looser synonyms, scored below the label/alias match (O3). Controls only. */
  keywords?: readonly string[];
  tab: SettingsTabId;
  sectionLabel: string;
  controlId?: string;
  sectionId?: SettingsSectionId;
};

type DestinationText = Pick<OmnibarSettingsDestination, "title" | "description" | "titleKey" | "descriptionKey">;

export function localizeOmnibarSettingTitle(
  setting: DestinationText,
  localize: (englishText: string) => string,
  t: (key: string, defaultValue: string) => string,
): string {
  return setting.titleKey ? t(setting.titleKey, setting.title) : localize(setting.title);
}

export function localizeOmnibarSettingDescription(
  setting: DestinationText,
  localize: (englishText: string) => string,
  t: (key: string, defaultValue: string) => string,
): string {
  return setting.descriptionKey ? t(setting.descriptionKey, setting.description) : localize(setting.description);
}

let cachedDestinations: readonly OmnibarSettingsDestination[] | null = null;

/**
 * Every settings destination the omnibar can reach, derived from
 * `settings-registry.ts` rather than restated here.
 *
 * This file used to hand-maintain its own list of 6 tabs and 25 controls beside
 * the registry's 32 sections and 99 controls. The two drifted: three of the 25
 * pointed at control ids that no longer existed, so choosing those rows opened
 * the tab and silently failed to scroll. Deriving removes the second list, and
 * `omnibar-settings.test.ts` fails if a row ever points at an unknown id.
 *
 * Strings are the registry's English. A control also carries its `en.json` keys; the caller translates
 * through `localizeOmnibarSettingTitle` / `localizeOmnibarSettingDescription`, which use the key when there
 * is one and `useLocalizedUiText` for tabs and sections.
 */
// The window-size sliders sit in sections hidden below `sm`, so on a phone their results would open nowhere.
const WINDOW_SIZE_CONTROL_IDS = new Set(["omnibar-window-height", "omnibar-window-width"]);

export function getOmnibarSettingsDestinations(): readonly OmnibarSettingsDestination[] {
  // The registry is static, so this is built once. The caller localizes the
  // strings, which is the only part that varies. The phone filter depends on the
  // viewport, so it is applied on every read, not baked into the cache.
  cachedDestinations ??= buildDestinations();
  const phone = typeof window !== "undefined" && !window.matchMedia("(min-width: 640px)").matches;
  return phone
    ? cachedDestinations.filter((destination) => !WINDOW_SIZE_CONTROL_IDS.has(destination.controlId ?? ""))
    : cachedDestinations;
}

function buildDestinations(): OmnibarSettingsDestination[] {
  const result: OmnibarSettingsDestination[] = [];

  for (const tab of SETTINGS_TABS) {
    result.push({
      id: `settings-section:${tab.id}`,
      title: tab.label,
      description: tab.description,
      aliases: tab.aliases,
      tab: tab.id,
      sectionLabel: tab.label,
    });
  }

  for (const section of SETTINGS_SECTIONS) {
    result.push({
      id: `settings-section-detail:${section.id}`,
      title: section.label,
      description: section.description,
      aliases: section.aliases,
      tab: section.tab,
      sectionLabel: SETTINGS_TABS.find((tab) => tab.id === section.tab)?.label ?? section.label,
      sectionId: section.id,
    });
  }

  for (const control of SETTINGS_SEARCHABLE_CONTROLS) {
    const section = SETTINGS_SECTION_BY_ID.get(control.sectionId);
    // Unreachable while the registry is self-consistent, and `omnibar-settings`
    // asserts that it is. Logged rather than thrown: this runs during render, so
    // a throw would take the whole omnibar down over one missing row.
    if (!section) {
      console.error("[omnibar] settings control %s names unknown section %s", control.id, control.sectionId);
      continue;
    }
    result.push({
      id: `settings-control:${control.id}`,
      title: control.label,
      description: control.description,
      titleKey: control.labelKey,
      descriptionKey: control.descriptionKey,
      // The control kind joins the aliases so "toggle" or "slider" finds them.
      aliases: [...control.aliases, section.label, control.kind],
      keywords: control.keywords,
      tab: section.tab,
      sectionLabel: section.label,
      controlId: control.id,
      sectionId: section.id,
    });
  }

  return result;
}
