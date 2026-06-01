import { AlertTriangle } from "lucide-react";

export function LorebookUnsavedWarning({
  onKeepEditing,
  onDiscardAndClose,
  onSaveAndClose,
}: {
  onKeepEditing: () => void;
  onDiscardAndClose: () => void;
  onSaveAndClose: () => void;
}) {
  return (
    <div role="alert" className="flex items-center gap-3 bg-amber-500/10 px-4 py-2.5 text-xs">
      <AlertTriangle size="0.875rem" className="text-amber-400" aria-hidden="true" />
      <span className="flex-1 text-amber-200">You have unsaved changes</span>
      <button
        onClick={onKeepEditing}
        className="rounded-lg px-3 py-1 text-[0.6875rem] font-medium text-amber-300 ring-1 ring-amber-400/30 transition-colors hover:bg-amber-400/10"
      >
        Keep editing
      </button>
      <button
        onClick={onDiscardAndClose}
        className="rounded-lg px-3 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
      >
        Discard & close
      </button>
      <button
        onClick={onSaveAndClose}
        className="rounded-lg bg-amber-500 px-3 py-1 text-[0.6875rem] font-medium text-white transition-colors hover:bg-amber-600"
      >
        Save & close
      </button>
    </div>
  );
}
