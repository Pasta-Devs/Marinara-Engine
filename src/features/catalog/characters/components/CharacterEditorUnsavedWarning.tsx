import { AlertTriangle } from "lucide-react";

export function CharacterEditorUnsavedWarning({
  avatarUploading,
  saving,
  onDiscard,
  onKeepEditing,
  onSaveAndClose,
}: {
  avatarUploading: boolean;
  saving: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
  onSaveAndClose: () => void | Promise<unknown>;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      <AlertTriangle size="0.9375rem" className="shrink-0 text-amber-500" />
      <p className="flex-1 text-xs font-medium text-amber-500">You have unsaved changes. Close without saving?</p>
      <button
        type="button"
        onClick={onKeepEditing}
        className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
      >
        Keep editing
      </button>
      <button
        type="button"
        onClick={onDiscard}
        disabled={avatarUploading}
        className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Discard & close
      </button>
      <button
        type="button"
        onClick={() => void onSaveAndClose()}
        disabled={saving || avatarUploading}
        className="rounded-lg bg-gradient-to-r from-pink-400 to-purple-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save & close
      </button>
    </div>
  );
}
