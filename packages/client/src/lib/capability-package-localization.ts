import type { CapabilityCatalogPackage, CapabilityPackageManifest } from "@marinara-engine/shared";

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
    ...(canonicalWidgets
      ? {
          homeWidgets: canonicalWidgets.map((widget) => ({
            ...widget,
            label: localized?.homeWidgets?.[widget.id]?.label ?? widget.label,
            description: localized?.homeWidgets?.[widget.id]?.description ?? widget.description,
          })),
        }
      : {}),
  };
}

/** A catalog entry as its store card shows it: a ruleset's name and description from the catalog's
 *  listing of its language pack (1.811) where it lists one in this language, else as the manifest says. */
export function resolveCapabilityCatalogEntryDisplay(
  entry: Pick<CapabilityCatalogPackage, "manifest" | "locales">,
  locale: string | undefined,
) {
  const display = resolveCapabilityPackageDisplay(entry.manifest, locale);
  const packs = entry.locales ?? {};
  const pack = localeCandidates(locale)
    .map((candidate) => packs[Object.keys(packs).find((key) => normalizeLocale(key) === candidate) ?? ""])
    .find(Boolean);
  return {
    ...display,
    name: pack?.name ?? display.name,
    description: pack?.description ?? display.description,
  };
}
