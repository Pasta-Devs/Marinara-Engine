import { SETTINGS_SECTIONS, SETTINGS_TABS } from "@marinara-engine/shared";

/**
 * A compact "tab: section, section, ..." list of every real Settings label,
 * grouped by tab, computed once from the same registry the Settings panel and
 * omnibar use. Gives the unasked quick-answer aside real on-screen labels to
 * name instead of guessing, without sending the full section
 * descriptions/aliases.
 *
 * Kept in its own module (no fastify/db/storage imports) so it is cheap to
 * import in isolation, e.g. from a regression check.
 */
export const QUICK_ANSWER_SETTINGS_LABELS = (() => {
  const tabLabelById = new Map(SETTINGS_TABS.map((tab) => [tab.id, tab.label]));
  const sectionLabelsByTab = new Map<string, string[]>();
  for (const section of SETTINGS_SECTIONS) {
    const tabLabel = tabLabelById.get(section.tab) ?? section.tab;
    const labels = sectionLabelsByTab.get(tabLabel) ?? [];
    labels.push(section.label);
    sectionLabelsByTab.set(tabLabel, labels);
  }
  return [...sectionLabelsByTab.entries()].map(([tab, labels]) => `${tab}: ${labels.join(", ")}`).join("\n");
})();
