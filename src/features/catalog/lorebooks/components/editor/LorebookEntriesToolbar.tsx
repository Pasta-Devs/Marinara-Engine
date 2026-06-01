import { ArrowUpDown, CheckSquare2, Copy, Eraser, FolderPlus, Loader2, MoveRight, Plus, Search } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";

export type EntrySortKey = "order" | "name-asc" | "name-desc" | "tokens" | "keys" | "newest" | "oldest";

const SORT_OPTIONS: Array<{ value: EntrySortKey; label: string }> = [
  { value: "order", label: "Order" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "tokens", label: "Tokens ↓" },
  { value: "keys", label: "Keys ↓" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function LorebookEntriesToolbar({
  search,
  sort,
  selectionMode,
  onSearchChange,
  onSortChange,
  onToggleSelectionMode,
  onAddFolder,
  onAddEntry,
}: {
  search: string;
  sort: EntrySortKey;
  selectionMode: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: EntrySortKey) => void;
  onToggleSelectionMode: () => void;
  onAddFolder: () => void;
  onAddEntry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <div className="relative min-w-0 flex-[1_1_12rem]">
        <Search
          size="0.8125rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          type="text"
          placeholder="Search entries…"
          aria-label="Search entries"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-xl bg-[var(--secondary)] py-2.5 pl-8 pr-3 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div className="relative shrink-0">
        <ArrowUpDown
          size="0.8125rem"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <select
          value={sort}
          aria-label="Sort entries"
          onChange={(event) => onSortChange(event.target.value as EntrySortKey)}
          className="h-full appearance-none rounded-xl bg-[var(--secondary)] py-2.5 pl-8 pr-6 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={onToggleSelectionMode}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium ring-1 transition-colors",
          selectionMode
            ? "bg-amber-400/15 text-amber-400 ring-amber-400/30"
            : "bg-[var(--secondary)] ring-[var(--border)] hover:bg-[var(--accent)]",
        )}
        title="Select entries to copy or move"
      >
        <CheckSquare2 size="0.8125rem" />
        Select
      </button>
      <button
        onClick={onAddFolder}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
        title="Create a new folder to group entries"
      >
        <FolderPlus size="0.8125rem" />
        Add Folder
      </button>
      <button
        onClick={onAddEntry}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
      >
        <Plus size="0.8125rem" />
        Add Entry
      </button>
    </div>
  );
}

export function LorebookEntrySelectionToolbar({
  selectedCount,
  visibleEntryCount,
  transferTargetLorebooks,
  transferTargetId,
  transferPending,
  unvectorizePending,
  onSelectAll,
  onClear,
  onTransferTargetChange,
  onCopy,
  onMove,
  onUnvectorize,
  onDone,
}: {
  selectedCount: number;
  visibleEntryCount: number;
  transferTargetLorebooks: Array<{ id: string; name: string }>;
  transferTargetId: string;
  transferPending: boolean;
  unvectorizePending: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onTransferTargetChange: (id: string) => void;
  onCopy: () => void;
  onMove: () => void;
  onUnvectorize: () => void;
  onDone: () => void;
}) {
  const hasTransferTargets = transferTargetLorebooks.length > 0;
  const transferDisabled = selectedCount === 0 || !transferTargetId || transferPending;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
      <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{selectedCount} selected</span>
      <button
        onClick={onSelectAll}
        disabled={visibleEntryCount === 0}
        className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-amber-400 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
      >
        Select all
      </button>
      <button
        onClick={onClear}
        disabled={selectedCount === 0}
        className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
      >
        Clear
      </button>
      <select
        value={transferTargetId}
        onChange={(event) => onTransferTargetChange(event.target.value)}
        disabled={!hasTransferTargets}
        className="min-h-8 min-w-[12rem] flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
      >
        {!hasTransferTargets ? (
          <option value="">Create another lorebook first</option>
        ) : (
          transferTargetLorebooks.map((book) => (
            <option key={book.id} value={book.id}>
              {book.name}
            </option>
          ))
        )}
      </select>
      <button
        onClick={onCopy}
        disabled={transferDisabled}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[0.625rem] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
      >
        {transferPending ? <Loader2 size="0.6875rem" className="animate-spin" /> : <Copy size="0.6875rem" />}
        Copy
      </button>
      <button
        onClick={onMove}
        disabled={transferDisabled}
        className="inline-flex items-center gap-1 rounded-lg bg-[var(--destructive)]/12 px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20 disabled:opacity-40"
      >
        {transferPending ? <Loader2 size="0.6875rem" className="animate-spin" /> : <MoveRight size="0.6875rem" />}
        Move
      </button>
      <button
        onClick={onUnvectorize}
        disabled={selectedCount === 0 || unvectorizePending}
        className="inline-flex items-center gap-1 rounded-lg bg-violet-500/12 px-2.5 py-1.5 text-[0.625rem] font-medium text-violet-300 transition-all hover:bg-violet-500/20 disabled:opacity-40"
        title="Clear stored embeddings for selected entries"
      >
        {unvectorizePending ? <Loader2 size="0.6875rem" className="animate-spin" /> : <Eraser size="0.6875rem" />}
        Unvectorize
      </button>
      <button
        onClick={onDone}
        className="rounded-lg px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
      >
        Done
      </button>
    </div>
  );
}
