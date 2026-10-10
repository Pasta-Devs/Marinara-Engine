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
  aliases: readonly string[];
  /** Looser synonyms, scored below the label/alias match (O3). Controls only. */
  keywords?: readonly string[];
  tab: SettingsTabId;
  sectionLabel: string;
  controlId?: string;
  sectionId?: SettingsSectionId;
};

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
 * Strings are the registry's English. The caller localizes them the same way
 * the Settings panel's own search does, through `useLocalizedUiText`.
 */
export function getOmnibarSettingsDestinations(): readonly OmnibarSettingsDestination[] {
  // The registry is static, so this is built once. The caller localizes the
  // strings, which is the only part that varies.
  cachedDestinations ??= buildDestinations();
  return cachedDestinations;
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
