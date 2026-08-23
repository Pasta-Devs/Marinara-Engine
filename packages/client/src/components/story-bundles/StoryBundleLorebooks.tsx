// ──────────────────────────────────────────────
// Story Bundle Lorebooks Tab
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Dices, Plus, Search, X } from "lucide-react";
import type { Lorebook } from "@marinara-engine/shared";

const LOREBOOK_PICKER_PAGE_SIZE = 20;

export interface StoryBundleLorebooksProps {
  lorebookIds: string[];
  onLorebookIdsChange: (ids: string[]) => void;
  lorebooks: Lorebook[];
  validLorebookIds: Set<string>;
}

function getLorebookCategoryLabel(lorebook: Lorebook): string {
  return lorebook.category ?? "uncategorized";
}

export function StoryBundleLorebooks({
  lorebookIds,
  onLorebookIdsChange,
  lorebooks,
  validLorebookIds,
}: StoryBundleLorebooksProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [lorebookPickerLimit, setLorebookPickerLimit] = useState(LOREBOOK_PICKER_PAGE_SIZE);

  useEffect(() => {
    setLorebookPickerLimit(LOREBOOK_PICKER_PAGE_SIZE);
  }, [search]);

  const selectedIds = useMemo(() => new Set(lorebookIds), [lorebookIds]);

  const available = useMemo(() => {
    const query = search.toLowerCase().trim();
    return lorebooks.filter((lb) => {
      if (selectedIds.has(lb.id)) return false;
      if (!validLorebookIds.has(lb.id)) return false;
      if (!query) return true;
      const name = lb.name.toLowerCase();
      const desc = (lb.description ?? "").toLowerCase();
      const category = getLorebookCategoryLabel(lb).toLowerCase();
      return name.includes(query) || desc.includes(query) || category.includes(query);
    });
  }, [lorebooks, selectedIds, validLorebookIds, search]);

  const visibleAvailable = useMemo(() => available.slice(0, lorebookPickerLimit), [available, lorebookPickerLimit]);

  const selectedLorebooks = useMemo(
    () => lorebooks.filter((lb) => selectedIds.has(lb.id) && validLorebookIds.has(lb.id)),
    [lorebooks, selectedIds, validLorebookIds],
  );

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onLorebookIdsChange([...next]);
  };

  const handleRandom = () => {
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    const next = new Set(selectedIds);
    next.add(pick.id);
    onLorebookIdsChange([...next]);
  };

  return (
    <div data-testid="story-bundle-editor-lorebooks" className="flex flex-col gap-6">
      {/* Add Lorebooks */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.addLorebooks", "Add Lorebooks")}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size="0.875rem"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              data-testid="story-bundle-editor-lorebooks-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("storyBundles.searchLorebooks", "Search lorebooks…")}
              className="mari-input w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            data-testid="story-bundle-editor-lorebooks-random"
            onClick={handleRandom}
            disabled={available.length === 0}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            title={t("storyBundles.lorebookRandomHint", "Pick a random lorebook")}
          >
            <Dices size="0.75rem" />
            <span className="block truncate text-xs">{t("storyBundles.random", "Random")}</span>
          </button>
        </div>

        {visibleAvailable.length > 0 ? (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {visibleAvailable.map((lb) => {
              const category = getLorebookCategoryLabel(lb);
              return (
                <button
                  key={lb.id}
                  data-testid={`story-bundle-editor-lorebooks-add-${lb.id}`}
                  onClick={() => handleToggle(lb.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-[var(--accent)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <BookOpen size="0.75rem" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{lb.name}</div>
                    <div className="truncate text-xs text-[var(--muted-foreground)] capitalize">{category}</div>
                  </div>
                  <Plus size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                </button>
              );
            })}
            {available.length > lorebookPickerLimit && (
              <button
                data-testid="story-bundle-editor-lorebooks-load-more"
                onClick={() => setLorebookPickerLimit((limit) => limit + LOREBOOK_PICKER_PAGE_SIZE)}
                className="w-full rounded-md px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              >
                {t("storyBundles.loadMore", "Load more")} ({visibleAvailable.length} {t("storyBundles.of", "of")}{" "}
                {available.length})
              </button>
            )}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-lorebooks-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {search
              ? t("storyBundles.noLorebooksMatch", "No lorebooks match your search.")
              : t("storyBundles.allLorebooksAdded", "All lorebooks have been added.")}
          </div>
        )}
      </section>

      {/* Selected Lorebooks */}
      <section data-testid="story-bundle-editor-lorebooks-selected">
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.selectedLorebooks", "Selected Lorebooks")}
        </h3>

        {selectedLorebooks.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {selectedLorebooks.map((lb) => {
              const category = getLorebookCategoryLabel(lb);
              return (
                <div key={lb.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <BookOpen size="0.75rem" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{lb.name}</div>
                    <div className="truncate text-xs text-[var(--muted-foreground)] capitalize">{category}</div>
                  </div>
                  <button
                    data-testid={`story-bundle-editor-lorebooks-remove-${lb.id}`}
                    onClick={() => handleToggle(lb.id)}
                    className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                    title={t("storyBundles.removeLorebook", "Remove")}
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-lorebooks-selected-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {t("storyBundles.lorebooksEmpty", "No lorebooks assigned yet.")}
          </div>
        )}
      </section>
    </div>
  );
}
