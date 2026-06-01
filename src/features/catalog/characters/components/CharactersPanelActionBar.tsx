import { Check, Download, Plus, Sparkles } from "lucide-react";

import { cn } from "../../../../shared/lib/utils";

export function CharactersPanelActionBar({
  selectionMode,
  onCreate,
  onImport,
  onOpenMaker,
  onToggleSelectionMode,
}: {
  selectionMode: boolean;
  onCreate: () => void;
  onImport: () => void;
  onOpenMaker: () => void;
  onToggleSelectionMode: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <button
        onClick={onCreate}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-pink-500/15 transition-all hover:shadow-lg hover:shadow-pink-500/25 active:scale-[0.98]"
        title="New"
      >
        <Plus size="0.8125rem" /> <span className="md:hidden">New</span>
      </button>
      <button
        onClick={onImport}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
        title="Import"
      >
        <Download size="0.8125rem" /> <span className="md:hidden">Import</span>
      </button>
      <button
        onClick={onOpenMaker}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
        title="AI Maker"
      >
        <Sparkles size="0.8125rem" /> <span className="md:hidden">Maker</span>
      </button>
      <button
        onClick={onToggleSelectionMode}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
          selectionMode
            ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--secondary)] text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
        )}
        title="Select"
      >
        <Check size="0.8125rem" />
        <span className="md:hidden">Select</span>
      </button>
    </div>
  );
}
