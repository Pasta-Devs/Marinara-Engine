import { ArrowUpDown, ChevronDown, Minus, Search, Star, Tag, X } from "lucide-react";

import { cn } from "../../../../shared/lib/utils";
import type { FavoriteFilter, SortOption } from "../lib/characters-panel-model";

export function CharactersFilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  favoriteFilter,
  onFavoriteFilterChange,
  allTags,
  tagsExpanded,
  onToggleTagsExpanded,
  includedTags,
  excludedTags,
  onClearTagFilters,
  onToggleIncludedTag,
  onToggleExcludedTag,
  onDeleteTag,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  favoriteFilter: FavoriteFilter;
  onFavoriteFilterChange: (value: FavoriteFilter) => void;
  allTags: string[];
  tagsExpanded: boolean;
  onToggleTagsExpanded: () => void;
  includedTags: ReadonlySet<string>;
  excludedTags: ReadonlySet<string>;
  onClearTagFilters: () => void;
  onToggleIncludedTag: (tag: string) => void;
  onToggleExcludedTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
}) {
  const hasTagFilters = includedTags.size > 0 || excludedTags.size > 0;

  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search characters"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-2.5 pr-7 text-[0.6875rem] outline-none transition-colors focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            title="Sort order"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="favorites">Favorites</option>
          </select>
          <ArrowUpDown
            size="0.625rem"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
        </div>
      </div>

      <div className="flex gap-1">
        {(["all", "favorites", "non-favorites"] as const).map((option) => (
          <button
            key={option}
            onClick={() => onFavoriteFilterChange(option)}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
              favoriteFilter === option
                ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            {option === "favorites" && <Star size="0.5625rem" />}
            {option === "all" ? "All" : option === "favorites" ? "Favorites" : "Non-favorites"}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={onToggleTagsExpanded}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
              hasTagFilters
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Tag size="0.625rem" />
            Tags ({allTags.length})
            {hasTagFilters && (
              <span className="ml-0.5 opacity-70">
                ·{" "}
                {[
                  includedTags.size > 0 ? `+${includedTags.size}` : null,
                  excludedTags.size > 0 ? `-${excludedTags.size}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            <ChevronDown size="0.625rem" className={cn("transition-transform", tagsExpanded && "rotate-180")} />
          </button>
          {tagsExpanded && (
            <div className="flex flex-wrap gap-1">
              {hasTagFilters && (
                <button
                  onClick={onClearTagFilters}
                  className="flex items-center gap-1 rounded-full bg-[var(--destructive)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20"
                >
                  <X size="0.5rem" /> Clear
                </button>
              )}
              {allTags.map((tag) => {
                const included = includedTags.has(tag);
                const excluded = excludedTags.has(tag);
                return (
                  <div
                    key={tag}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleIncludedTag(tag)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleIncludedTag(tag);
                      }
                    }}
                    className={cn(
                      "group/tag flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium transition-all",
                      included
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                        : excluded
                          ? "bg-[var(--destructive)]/12 text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <Tag size="0.5rem" />
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExcludedTag(tag);
                      }}
                      className={cn(
                        "ml-0.5 rounded-full p-0.5 transition-colors",
                        excluded
                          ? "bg-[var(--destructive)]/20 text-[var(--destructive)]"
                          : "hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]",
                      )}
                      title={excluded ? `Stop excluding "${tag}"` : `Exclude tag "${tag}"`}
                    >
                      <Minus size="0.5rem" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTag(tag);
                      }}
                      className="rounded-full p-0.5 transition-colors hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)]"
                      title={`Delete tag "${tag}"`}
                    >
                      <X size="0.5rem" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
