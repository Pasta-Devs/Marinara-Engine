import { CheckSquare, Eye, List, Pencil } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";
import { ToolbarButton } from "./NotepadChrome";

export function NotepadToolbar({
  canEdit,
  viewMode,
  onPrefixLines,
  onToggleViewMode,
  onWrapSelection,
}: {
  canEdit: boolean;
  viewMode: "edit" | "preview";
  onPrefixLines: (prefix: string) => void;
  onToggleViewMode: () => void;
  onWrapSelection: (prefix: string, suffix?: string, fallback?: string) => void;
}) {
  const editDisabled = !canEdit || viewMode === "preview";

  return (
    <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[var(--border)] bg-[var(--card)]/60 px-2 py-1">
      <div className="flex min-w-0 gap-1 overflow-x-auto">
        <ToolbarButton title="Bold selected text" disabled={editDisabled} onClick={() => onWrapSelection("**")}>
          <span className="font-black">B</span>
        </ToolbarButton>
        <ToolbarButton title="Italicize selected text" disabled={editDisabled} onClick={() => onWrapSelection("*")}>
          <span className="font-black italic">I</span>
        </ToolbarButton>
        <ToolbarButton title="Underline selected text" disabled={editDisabled} onClick={() => onWrapSelection("__")}>
          <span className="font-black underline underline-offset-2">U</span>
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough selected text"
          disabled={editDisabled}
          onClick={() => onWrapSelection("~~")}
        >
          <span className="font-black line-through">S</span>
        </ToolbarButton>
        <ToolbarButton title="Add bullet list item" disabled={editDisabled} onClick={() => onPrefixLines("- ")}>
          <List size="0.75rem" />
        </ToolbarButton>
        <ToolbarButton title="Add checklist item" disabled={editDisabled} onClick={() => onPrefixLines("- [ ] ")}>
          <CheckSquare size="0.75rem" />
        </ToolbarButton>
      </div>
      <button
        type="button"
        aria-label={viewMode === "preview" ? "Edit note" : "Preview note"}
        title={viewMode === "preview" ? "Edit note" : "Preview note"}
        aria-pressed={viewMode === "preview"}
        onClick={onToggleViewMode}
        className="grid h-6 w-12 shrink-0 grid-cols-2 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--secondary)]/45 p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]"
      >
        <span
          className={cn(
            "grid place-items-center rounded-full transition-colors",
            viewMode === "edit" && "bg-[var(--primary)]/20 text-[var(--foreground)]",
          )}
        >
          <Pencil size="0.7rem" />
        </span>
        <span
          className={cn(
            "grid place-items-center rounded-full transition-colors",
            viewMode === "preview" && "bg-[var(--primary)]/20 text-[var(--foreground)]",
          )}
        >
          <Eye size="0.7rem" />
        </span>
      </button>
    </div>
  );
}
