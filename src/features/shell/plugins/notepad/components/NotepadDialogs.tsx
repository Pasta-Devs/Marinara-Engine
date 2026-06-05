import { X } from "lucide-react";
import type { NotepadMemoryState, NotepadTab } from "../types";

export function DeleteTabDialog({
  noteCount,
  onCancel,
  onDelete,
  tab,
}: {
  noteCount: number;
  onCancel: () => void;
  onDelete: () => void;
  tab: NotepadTab;
}) {
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-[var(--background)]/70 p-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="me-notes-delete-title"
        aria-describedby="me-notes-delete-message"
        className="w-full max-w-72 rounded-lg border border-[var(--destructive)]/35 bg-[var(--card)] p-3 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-black uppercase text-[var(--destructive)]">Delete tab</div>
            <h3 id="me-notes-delete-title" className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
              Delete this tab?
            </h3>
          </div>
          <button
            type="button"
            aria-label="Cancel delete"
            title="Cancel delete"
            onClick={onCancel}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
          >
            <X size="0.875rem" />
          </button>
        </div>
        <p id="me-notes-delete-message" className="mt-2 text-xs leading-snug text-[var(--muted-foreground)]">
          {noteCount > 0
            ? `This removes "${tab.title}" and ${noteCount} saved note ${noteCount === 1 ? "entry" : "entries"}.`
            : `This removes "${tab.title}".`}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-[var(--destructive)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function RestoreBackupDialog({
  onCancel,
  onRestore,
  pendingState,
}: {
  onCancel: () => void;
  onRestore: () => void;
  pendingState: NotepadMemoryState;
}) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[var(--background)]/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="me-notes-restore-title"
        aria-describedby="me-notes-restore-message"
        className="w-full max-w-72 rounded-lg border border-[var(--primary)]/35 bg-[var(--card)] p-3 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-black uppercase text-[var(--primary)]">Restore backup</div>
            <h3 id="me-notes-restore-title" className="mt-1 text-sm font-semibold text-[var(--foreground)]">
              Replace current notes?
            </h3>
          </div>
          <button
            type="button"
            aria-label="Cancel restore"
            title="Cancel restore"
            onClick={onCancel}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
          >
            <X size="0.875rem" />
          </button>
        </div>
        <p id="me-notes-restore-message" className="mt-2 text-xs leading-snug text-[var(--muted-foreground)]">
          This restores {pendingState.tabs.length} tab{pendingState.tabs.length === 1 ? "" : "s"} and replaces current
          synced notes data.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
