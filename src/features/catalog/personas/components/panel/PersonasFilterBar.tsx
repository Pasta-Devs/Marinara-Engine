import { ArrowUpDown, ChevronDown, Search, Star, Tag, X } from "lucide-react";

import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";
import { cn } from "../../../../../shared/lib/utils";
import type { PersonaActiveFilter, SortOption } from "../../lib/personas-panel-model";

interface PersonasFilterBarProps {
  search: string;
  sort: SortOption;
  activeFilter: PersonaActiveFilter;
  allTags: string[];
  activeTag: string | null;
  tagsExpanded: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onActiveFilterChange: (value: PersonaActiveFilter) => void;
  onActiveTagChange: (value: string | null) => void;
  onTagsExpandedChange: (value: boolean) => void;
  onDeleteTag: (tag: string) => void;
}

export function PersonasFilterBar({
  search,
  sort,
  activeFilter,
  allTags,
  activeTag,
  tagsExpanded,
  onSearchChange,
  onSortChange,
  onActiveFilterChange,
  onActiveTagChange,
  onTagsExpandedChange,
  onDeleteTag,
}: PersonasFilterBarProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        Your personas
        <HelpTooltip text="Personas are your different identities. The active persona determines how the AI refers to you and sees your description, personality, backstory, and appearance. Great for switching between different player characters!" />
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search personas"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortOption)}
            className="h-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-2.5 pr-7 text-[0.6875rem] outline-none transition-colors focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            title="Sort order"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="tokens">Tokens</option>
          </select>
          <ArrowUpDown
            size="0.625rem"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
        </div>
      </div>

      <div className="flex gap-1">
        {(["all", "active", "inactive"] as const).map((option) => (
          <button
            key={option}
            onClick={() => onActiveFilterChange(option)}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
              activeFilter === option
                ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            {option === "active" && <Star size="0.5625rem" />}
            {option === "all" ? "All" : option === "active" ? "Active" : "Inactive"}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => onTagsExpandedChange(!tagsExpanded)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
              activeTag
                ? "bg-emerald-400/15 text-emerald-400"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Tag size="0.625rem" />
            Tags ({allTags.length}){activeTag && <span className="ml-0.5 opacity-70">· {activeTag}</span>}
            <ChevronDown size="0.625rem" className={cn("transition-transform", tagsExpanded && "rotate-180")} />
          </button>
          {tagsExpanded && (
            <div className="flex flex-wrap gap-1">
              {activeTag && (
                <button
                  onClick={() => onActiveTagChange(null)}
                  className="flex items-center gap-1 rounded-full bg-[var(--destructive)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20"
                >
                  <X size="0.5rem" /> Clear
                </button>
              )}
              {allTags.map((tag) => (
                <div
                  key={tag}
                  role="button"
                  tabIndex={0}
                  onClick={() => onActiveTagChange(activeTag === tag ? null : tag)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onActiveTagChange(activeTag === tag ? null : tag);
                    }
                  }}
                  className={cn(
                    "group/tag flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium transition-all",
                    activeTag === tag
                      ? "bg-emerald-400/20 text-emerald-400 ring-1 ring-emerald-400/30"
                      : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Tag size="0.5rem" />
                  {tag}
                  <button
                    type="button"
                    aria-label={`Delete tag ${tag}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteTag(tag);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                    className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)]"
                    title={`Delete tag "${tag}"`}
                  >
                    <X size="0.5rem" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
