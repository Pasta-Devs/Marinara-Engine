// ──────────────────────────────────────────────
// File Browser — Search input (responsive)
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { SearchInput as SharedSearchInput } from "../ui/SearchInput";

/**
 * Responsive search input for the file browser.
 *
 * Desktop: always-visible 192px input on the right.
 * Mobile: collapsed to a search-icon button; expands inline when tapped.
 */
export function SearchInput({ search, onSearch }: { search: string; onSearch: (v: string) => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  return (
    <div className="relative ml-auto flex items-center">
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) bg-(--background) text-(--muted-foreground) transition-colors hover:bg-(--accent) hover:text-(--foreground) sm:hidden"
          title={t("search.folder.title")}
        >
          <Search size="0.875rem" />
        </button>
      )}
      <SharedSearchInput
        value={search}
        onChange={onSearch}
        label={t("search.folder.placeholder")}
        placeholder={t("search.folder.placeholder")}
        inputRef={inputRef}
        onBlur={() => {
          if (!search) setExpanded(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !search) setExpanded(false);
        }}
        className={cn(
          "w-48 max-sm:absolute max-sm:right-0 max-sm:top-1/2 max-sm:-translate-y-1/2",
          !expanded && "hidden sm:flex",
        )}
      />
    </div>
  );
}
