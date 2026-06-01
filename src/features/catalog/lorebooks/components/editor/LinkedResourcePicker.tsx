import { useMemo, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";

export type LinkedResourceItem = {
  id: string;
  name: string;
  description?: string | null;
  searchText?: string[];
  deleted?: boolean;
};

function splitSearchTerms(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function searchValuesMatchTerms(values: string[], terms: string[]): boolean {
  if (terms.length === 0) return true;
  const normalizedValues = values.map((value) => value.toLowerCase());
  return terms.every((term) => normalizedValues.some((value) => value.includes(term)));
}

export function LinkedResourcePicker({
  label,
  help,
  emptyText,
  addLabel,
  searchPlaceholder,
  icon,
  items,
  selectedIds,
  search,
  onSearchChange,
  isLoading = false,
  isError = false,
  isOpen,
  onOpen,
  onClose,
  onAdd,
  onRemove,
}: {
  label: string;
  help: string;
  emptyText: string;
  addLabel: string;
  searchPlaceholder: string;
  icon: ReactNode;
  items: LinkedResourceItem[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const selectedItems = selectedIds.map(
    (id) =>
      items.find((item) => item.id === id) ?? {
        id,
        name: "(deleted)",
        description: id,
        deleted: true,
      },
  );
  const searchTerms = useMemo(() => splitSearchTerms(search), [search]);
  const availableItems = items.filter(
    (item) =>
      !selectedIds.includes(item.id) &&
      searchValuesMatchTerms(item.searchText ?? [item.name, item.description ?? ""], searchTerms),
  );

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
        {label} <HelpTooltip text={help} />
      </label>

      {selectedItems.length === 0 ? (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {selectedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
            >
              <span className="text-[var(--primary)]">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{item.name}</span>
                {item.description && (
                  <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                    {item.description}
                  </span>
                )}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                aria-label={`Remove ${item.name}`}
                title={`Remove ${item.name}`}
              >
                <X size="0.6875rem" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isOpen ? (
        <button
          onClick={onOpen}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
          aria-label={addLabel}
        >
          <Plus size="0.75rem" /> {addLabel}
        </button>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={`Search ${label.toLowerCase()}`}
              autoFocus
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
            />
            <button
              onClick={onClose}
              className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              aria-label={`Close ${label.toLowerCase()} picker`}
            >
              <X size="0.75rem" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {availableItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onAdd(item.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <span className="text-[var(--muted-foreground)]">{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{item.name}</span>
                  {item.description && (
                    <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                      {item.description}
                    </span>
                  )}
                </span>
                <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
              </button>
            ))}
            {availableItems.length === 0 && (
              <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                {isLoading
                  ? "Loading..."
                  : isError
                    ? `${label} could not be loaded.`
                    : items.length > 0 && items.every((item) => selectedIds.includes(item.id))
                      ? `All ${label.toLowerCase()} already added.`
                      : "No matches."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
