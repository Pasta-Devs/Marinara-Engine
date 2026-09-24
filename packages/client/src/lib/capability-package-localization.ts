import type { CapabilityPackageManifest } from "@marinara-engine/shared";

function normalizeLocale(locale: string | undefined) {
  return locale?.trim().replace(/_/g, "-").toLowerCase() ?? "";
}

function localeCandidates(locale: string | undefined) {
  const normalized = normalizeLocale(locale);
  if (!normalized) return [];
  const language = normalized.split("-")[0];
  return language && language !== normalized ? [normalized, language] : [normalized];
}

export function resolveCapabilityPackageDisplay(manifest: CapabilityPackageManifest, locale: string | undefined) {
  const entries = manifest.localizations ?? {};
  const localized = localeCandidates(locale)
    .map(
      (candidate) =>
        entries[candidate] ?? entries[Object.keys(entries).find((key) => normalizeLocale(key) === candidate) ?? ""],
    )
    .find(Boolean);
  const canonicalTab = manifest.contributions?.homeBrowserTab;
  const canonicalWidgets = manifest.contributions?.homeWidgets;

  return {
    name: localized?.name ?? manifest.name,
    description: localized?.description ?? manifest.description,
    homeBrowserTab: canonicalTab
      ? {
          ...canonicalTab,
          label: localized?.homeBrowserTab?.label ?? canonicalTab.label,
          ariaLabel: localized?.homeBrowserTab?.ariaLabel ?? canonicalTab.ariaLabel,
        }
      : undefined,
    homeWidgets: canonicalWidgets?.map((widget) => ({
      ...widget,
      label: localized?.homeWidgets?.[widget.id]?.label ?? widget.label,
      description: localized?.homeWidgets?.[widget.id]?.description ?? widget.description,
    })),
  };
}
