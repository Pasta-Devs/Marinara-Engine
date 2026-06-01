import { Download } from "lucide-react";

interface PersonasSelectionToolbarProps {
  selectedCount: number;
  visibleCount: number;
  exportingSelected: boolean;
  onSelectVisible: () => void;
  onClearSelection: () => void;
  onOpenExportDialog: () => void;
  onDone: () => void;
}

export function PersonasSelectionToolbar({
  selectedCount,
  visibleCount,
  exportingSelected,
  onSelectVisible,
  onClearSelection,
  onOpenExportDialog,
  onDone,
}: PersonasSelectionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
      <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{selectedCount} selected</span>
      <button
        onClick={onSelectVisible}
        disabled={visibleCount === 0}
        className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-emerald-400 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
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
        onClick={onOpenExportDialog}
        disabled={selectedCount === 0 || exportingSelected}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[0.625rem] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
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
