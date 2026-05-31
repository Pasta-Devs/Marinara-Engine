import { ArrowLeft, ArrowUpDown, Download, Plus, Search, Sparkles, Star } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import type { SortOption } from "../lib/character-library-model";

type CharacterLibraryToolbarProps = {
  filteredCount: number;
  totalCount: number;
  updating: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  sort: SortOption;
  onSortChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onImport: () => void;
  onOpenMaker: () => void;
};

export function CharacterLibraryToolbar({
  filteredCount,
  totalCount,
  updating,
  search,
  onSearchChange,
  favoritesOnly,
  onToggleFavorites,
  sort,
  onSortChange,
  onClose,
  onCreate,
  onImport,
  onOpenMaker,
}: CharacterLibraryToolbarProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-[var(--border)]/40 bg-[var(--card)]/85 backdrop-blur-xl">
      <div className="flex flex-col gap-2 px-3 py-2 md:px-6 md:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/80 text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/35 hover:text-[var(--primary)] md:h-10 md:w-10"
            title="Close library"
          >
            <ArrowLeft size="0.95rem" />
          </button>
          <div className="min-w-0">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
              Character Library
            </p>
            <h1 className="truncate text-base font-semibold text-[var(--foreground)] md:text-2xl">
              Browse your characters
            </h1>
            <p className="text-xs text-[var(--muted-foreground)] md:text-sm">
              {filteredCount} out of {totalCount} card{totalCount === 1 ? "" : "s"}
              {updating ? " · updating" : ""}
            </p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 pb-1 sm:gap-2 sm:pb-0 lg:w-auto lg:justify-end">
          <button
            onClick={onCreate}
            className="inline-flex min-w-[5.25rem] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[var(--secondary)] px-2.5 py-1.5 text-[0.8125rem] font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] sm:min-w-[8rem] sm:flex-none sm:px-3 sm:py-2 sm:text-sm"
          >
            <Plus size="0.8125rem" />
            <span className="truncate">New</span>
          </button>
          <button
            onClick={onImport}
            className="inline-flex min-w-[5.25rem] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[var(--secondary)] px-2.5 py-1.5 text-[0.8125rem] font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] sm:min-w-[8rem] sm:flex-none sm:px-3 sm:py-2 sm:text-sm"
          >
            <Download size="0.8125rem" />
            <span className="truncate">Import</span>
          </button>
          <button
            onClick={onOpenMaker}
            className="inline-flex min-w-[6rem] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-400 to-rose-500 px-2.5 py-1.5 text-[0.8125rem] font-medium text-white shadow-lg shadow-pink-500/15 transition-all hover:shadow-pink-500/25 sm:min-w-[8rem] sm:flex-none sm:px-3 sm:py-2 sm:text-sm"
          >
            <Sparkles size="0.8125rem" />
            <span className="truncate">AI Maker</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-[var(--border)]/30 px-3 py-2 md:px-6 md:py-3 sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:min-w-[16rem]">
          <Search
            size="0.8125rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder='Search names, tags, descriptions, or -tag:"tag name"'
            className="w-full rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/80 py-2 pl-8.5 pr-3 text-[0.8125rem] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20 md:py-2.5 md:pl-9 md:text-sm"
          />
        </div>

        <div className="flex items-center gap-2 sm:flex-wrap">
          <button
            onClick={onToggleFavorites}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-1.5 text-[0.8125rem] font-medium transition-all sm:flex-none sm:px-3.5 sm:py-2 sm:text-sm",
              favoritesOnly
                ? "bg-[var(--primary)]/12 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)]/80 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/60 hover:text-[var(--foreground)]",
            )}
          >
            <Star size="0.8125rem" className={favoritesOnly ? "fill-current" : ""} />
            Favorites
          </button>

          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/80 py-2 pl-3 pr-8 text-[0.8125rem] outline-none transition-colors focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20 md:py-2.5 md:pl-3.5 md:pr-9 md:text-sm"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="favorites">Favorites first</option>
            </select>
            <ArrowUpDown
              size="0.6875rem"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
