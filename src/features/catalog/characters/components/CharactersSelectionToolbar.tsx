import { Download, Trash2 } from "lucide-react";

export function CharactersSelectionToolbar({
  selectedCount,
  visibleCount,
  exportingSelected,
  onSelectVisible,
  onClearSelection,
  onDeleteSelected,
  onExportSelected,
  onDone,
}: {
  selectedCount: number;
  visibleCount: number;
  exportingSelected: boolean;
  onSelectVisible: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
      <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{selectedCount} selected</span>
      <button
        onClick={onSelectVisible}
        disabled={visibleCount === 0}
        className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
      >
        Select visible
      </button>
      <button
        onClick={onClearSelection}
        disabled={selectedCount === 0}
        className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
      >
        Clear
      </button>
      <button
        onClick={onDeleteSelected}
        disabled={selectedCount === 0}
        className="inline-flex items-center gap-1 rounded-lg bg-[var(--destructive)]/12 px-2.5 py-1 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20 disabled:opacity-40"
      >
        <Trash2 size="0.6875rem" />
        Delete
      </button>
      <button
        onClick={onExportSelected}
        disabled={selectedCount === 0 || exportingSelected}
        className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-40"
      >
        <Download size="0.6875rem" />
        {exportingSelected ? "Exporting..." : "Export ZIP"}
      </button>
      <button
        onClick={onDone}
        className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
      >
        Done
      </button>
    </div>
  );
}
