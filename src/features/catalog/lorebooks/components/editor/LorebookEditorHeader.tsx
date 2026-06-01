import { ArrowLeft, BookOpen, Save, Trash2 } from "lucide-react";
import type { LorebookCategory } from "../../../../../engine/contracts/types/lorebook";

export function LorebookEditorHeader({
  name,
  category,
  entryCount,
  dirty,
  saving,
  onClose,
  onSave,
  onExport,
  onDelete,
}: {
  name: string;
  category: LorebookCategory;
  entryCount: number;
  dirty: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
      <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--accent)]">
        <ArrowLeft size="1rem" />
      </button>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
        <BookOpen size="1.125rem" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold">{name}</h2>
        <p className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {entryCount} entries • {category}
        </p>
      </div>
      <button
        onClick={onSave}
        disabled={!dirty || saving}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
      >
        <Save size="0.8125rem" />
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onExport}
        className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        title="Export lorebook"
      >
        <svg width="0.875rem" height="0.875rem" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 13V3m0 0l-4 4m4-4l4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={onDelete}
        className="rounded-lg p-2 text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/15"
        title="Delete lorebook"
      >
        <Trash2 size="0.875rem" />
      </button>
    </div>
  );
}
