import { Eraser, Loader2, Redo2, RotateCcw, Undo2 } from "lucide-react";

interface SpriteCleanupFooterProps {
  applying: boolean;
  loading: boolean;
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  error: string | null;
  status: string | null;
  hoverReadout: string;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onClose: () => void;
  onApply: () => void;
}

export function SpriteCleanupFooter({
  applying,
  loading,
  hasChanges,
  canUndo,
  canRedo,
  error,
  status,
  hoverReadout,
  onUndo,
  onRedo,
  onReset,
  onClose,
  onApply,
}: SpriteCleanupFooterProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <div className="w-full min-w-0 space-y-0.5 text-xs text-[var(--muted-foreground)] sm:flex-1">
        <div>{error ? <span className="text-[var(--destructive)]">{error}</span> : (status ?? "Wand ready")}</div>
        <div className="font-mono text-[0.6875rem] text-[var(--muted-foreground)]/85">{hoverReadout}</div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={loading || applying || !canUndo}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)] disabled:opacity-45"
        title="Undo (Ctrl/Cmd+Z)"
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        <Undo2 size="0.875rem" />
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={loading || applying || !canRedo}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)] disabled:opacity-45"
        title="Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)"
        aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z Meta+Shift+Z"
      >
        <Redo2 size="0.875rem" />
        Redo
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={loading || applying || !hasChanges}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)] disabled:opacity-45"
      >
        <RotateCcw size="0.875rem" />
        Reset
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={applying}
        className="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={loading || applying || !hasChanges}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {applying ? <Loader2 size="0.875rem" className="animate-spin" /> : <Eraser size="0.875rem" />}
        Apply Cleanup
      </button>
    </div>
  );
}
