// ──────────────────────────────────────────────
// Story Bundle Presets Tab
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { PromptPreset } from "@marinara-engine/shared";

const PRESET_PICKER_PAGE_SIZE = 20;

export interface StoryBundlePresetsProps {
  presetIds: string[];
  onPresetIdsChange: (ids: string[]) => void;
  presets: PromptPreset[];
  validPresetIds: Set<string>;
}

export function StoryBundlePresets({ presetIds, onPresetIdsChange, presets, validPresetIds }: StoryBundlePresetsProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [presetPickerLimit, setPresetPickerLimit] = useState(PRESET_PICKER_PAGE_SIZE);

  useEffect(() => {
    setPresetPickerLimit(PRESET_PICKER_PAGE_SIZE);
  }, [search]);

  const selectedIds = useMemo(() => new Set(presetIds), [presetIds]);

  const available = useMemo(() => {
    const query = search.toLowerCase().trim();
    return presets.filter((p) => {
      if (selectedIds.has(p.id)) return false;
      if (!validPresetIds.has(p.id)) return false;
      if (!query) return true;
      const name = p.name.toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }, [presets, selectedIds, validPresetIds, search]);

  const visibleAvailable = useMemo(() => available.slice(0, presetPickerLimit), [available, presetPickerLimit]);

  const selectedPresets = useMemo(
    () => presets.filter((p) => selectedIds.has(p.id) && validPresetIds.has(p.id)),
    [presets, selectedIds, validPresetIds],
  );

  // True when the active search matches the already-selected preset. In that
  // case the picker's empty state should say a preset is selected, not that
  // nothing matches the search (the preset does match — it is just picked).
  const searchMatchesSelected = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return false;
    return selectedPresets.some((p) => {
      const name = p.name.toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }, [search, selectedPresets]);

  const handleToggle = (id: string) => {
    // A story bundle plays exactly one preset: picking a preset replaces any
    // previous selection instead of adding to it.
    if (selectedIds.has(id)) {
      onPresetIdsChange([]);
    } else {
      onPresetIdsChange([id]);
    }
  };

  const handleRandom = () => {
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    onPresetIdsChange([pick.id]);
  };

  return (
    <div data-testid="story-bundle-editor-presets" className="flex flex-col gap-6">
      {/* Add Preset */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.addPreset", "Add Preset")}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size="0.875rem"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              data-testid="story-bundle-editor-presets-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("storyBundles.searchPresets", "Search presets…")}
              className="mari-input w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            data-testid="story-bundle-editor-presets-random"
            onClick={handleRandom}
            disabled={available.length === 0}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            title={t("storyBundles.presetRandomHint", "Pick a random preset")}
          >
            <Dices size="0.75rem" />
            <span className="block truncate text-xs">{t("storyBundles.random", "Random")}</span>
          </button>
        </div>

        {visibleAvailable.length > 0 ? (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {visibleAvailable.map((p) => (
              <button
                key={p.id}
                data-testid={`story-bundle-editor-presets-add-${p.id}`}
                onClick={() => handleToggle(p.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-[var(--accent)]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <SlidersHorizontal size="0.75rem" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">{p.name}</div>
                  <div className="truncate text-xs text-[var(--muted-foreground)]">{p.description || "\u00A0"}</div>
                </div>
                <Plus size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
              </button>
            ))}
            {available.length > presetPickerLimit && (
              <button
                data-testid="story-bundle-editor-presets-load-more"
                onClick={() => setPresetPickerLimit((limit) => limit + PRESET_PICKER_PAGE_SIZE)}
                className="w-full rounded-md px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              >
                {t("storyBundles.loadMore", "Load more")} ({visibleAvailable.length} {t("storyBundles.of", "of")}{" "}
                {available.length})
              </button>
            )}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-presets-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {search && !searchMatchesSelected
              ? t("storyBundles.noPresetsMatch", "No presets match your search.")
              : selectedPresets.length > 0
                ? t("storyBundles.presetAlreadySelected", "A preset is already selected.")
                : t("storyBundles.noPresetsAvailable", "No presets available.")}
          </div>
        )}
      </section>

      {/* Selected Preset */}
      <section data-testid="story-bundle-editor-presets-selected">
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.selectedPreset", "Selected Preset")}
        </h3>

        {selectedPresets.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {selectedPresets.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <SlidersHorizontal size="0.75rem" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">{p.name}</div>
                  <div className="truncate text-xs text-[var(--muted-foreground)]">{p.description || "\u00A0"}</div>
                </div>
                <button
                  data-testid={`story-bundle-editor-presets-remove-${p.id}`}
                  onClick={() => handleToggle(p.id)}
                  className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                  title={t("storyBundles.removePreset", "Remove")}
                >
                  <X size="0.875rem" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-presets-selected-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {t("storyBundles.presetEmpty", "No preset selected yet.")}
          </div>
        )}
      </section>
    </div>
  );
}
