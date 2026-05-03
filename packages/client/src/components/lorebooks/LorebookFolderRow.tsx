// ──────────────────────────────────────────────
// Lorebook Folder Row
// Header for a collapsible folder of lorebook entries. Mirrors the visual
// language of LorebookEntryRow (compact, drag handle on the left, inline
// rename, hover-revealed delete) so the two row types feel like one list.
//
// Two toggles live on this row:
//  • Collapse — a UI-only chevron that hides/shows the folder body. Persisted
//    in localStorage by the parent editor; never sent to the server.
//  • Enable  — a server-persisted folder.enabled flag. When OFF, every entry
//    inside the folder is gated out at activation time regardless of the
//    entry's own enabled flag. Entries' own flags are preserved untouched.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ChevronDown, Folder, GripVertical, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useUpdateLorebookFolder, useDeleteLorebookFolder } from "../../hooks/use-lorebooks";
import type { LorebookFolder } from "@marinara-engine/shared";

interface Props {
  folder: LorebookFolder;
  lorebookId: string;
  /** Number of entries currently inside this folder (for the count badge). */
  entryCount: number;
  /** UI-only collapse state — owned by the parent editor and persisted in localStorage. */
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Drag handle wiring — folder rows are draggable to reorder folders, AND
  // act as drop targets when dragging an entry across containers.
  draggable: boolean;
  isDragging: boolean;
  isDragReady: boolean;
  onDragHandleMouseDown: () => void;
  onDragHandleMouseUp: () => void;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function LorebookFolderRow({
  folder,
  lorebookId,
  entryCount,
  isCollapsed,
  onToggleCollapse,
  draggable,
  isDragging,
  isDragReady,
  onDragHandleMouseDown,
  onDragHandleMouseUp,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const updateFolder = useUpdateLorebookFolder();
  const deleteFolder = useDeleteLorebookFolder();

  // Optimistic mirrors so toggle/rename feel snappy while the mutation flushes.
  const [localEnabled, setLocalEnabled] = useState(folder.enabled);
  const [localName, setLocalName] = useState(folder.name);

  const lastSyncedRef = useRef(folder);
  useEffect(() => {
    if (lastSyncedRef.current === folder) return;
    lastSyncedRef.current = folder;
    setLocalEnabled(folder.enabled);
    setLocalName(folder.name);
  }, [folder]);

  const handleEnableToggle = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      const previous = localEnabled;
      const next = !previous;
      // Optimistic flip — but if the PATCH fails, restore the previous value
      // so the row doesn't lie about the server state. This matters most for
      // `enabled`: the activation gate runs server-side, so a failed flip
      // would mean the row says "off" while entries still activate (or vice
      // versa).
      setLocalEnabled(next);
      updateFolder.mutate(
        { lorebookId, folderId: folder.id, enabled: next },
        {
          onError: () => {
            setLocalEnabled(previous);
          },
        },
      );
    },
    [localEnabled, lorebookId, folder.id, updateFolder],
  );

  const handleNameCommit = useCallback(() => {
    const trimmed = localName.trim();
    if (!trimmed) {
      setLocalName(folder.name);
      return;
    }
    if (trimmed !== folder.name) {
      const previous = folder.name;
      updateFolder.mutate(
        { lorebookId, folderId: folder.id, name: trimmed },
        {
          onError: () => {
            // Roll the displayed name back to whatever the server still has
            // so the row doesn't continue showing a renamed folder that the
            // server never accepted.
            setLocalName(previous);
          },
        },
      );
    }
  }, [localName, folder.name, lorebookId, folder.id, updateFolder]);

  const handleDelete = useCallback(
    async (e: ReactMouseEvent) => {
      e.stopPropagation();
      const confirmed = await showConfirmDialog({
        title: "Delete Folder",
        message:
          entryCount > 0
            ? `Delete this folder? The ${entryCount} entr${entryCount === 1 ? "y" : "ies"} inside will be moved back to the root level.`
            : "Delete this folder?",
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (!confirmed) return;
      deleteFolder.mutate({ lorebookId, folderId: folder.id });
    },
    [entryCount, lorebookId, folder.id, deleteFolder],
  );

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--secondary)]/60 ring-1 ring-[var(--border)] transition-all",
        !isCollapsed && "ring-amber-400/30",
        isDragging && "opacity-40",
      )}
      draggable={draggable && isDragReady}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="group flex cursor-pointer items-center gap-2 px-2 py-1.5" onClick={onToggleCollapse}>
        {/* Drag handle */}
        <button
          type="button"
          className={cn(
            "shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-colors",
            draggable
              ? "cursor-grab hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:cursor-grabbing"
              : "cursor-not-allowed opacity-40",
          )}
          title={draggable ? "Drag to reorder folder" : "Use Order sort and clear search to reorder"}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (draggable) onDragHandleMouseDown();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onDragHandleMouseUp();
          }}
        >
          <GripVertical size="0.875rem" />
        </button>

        {/* Collapse chevron */}
        <button
          type="button"
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
          className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-transform hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
        >
          <ChevronDown size="0.875rem" className={cn("transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")} />
        </button>

        {/* Enable toggle */}
        <button
          type="button"
          aria-label={localEnabled ? "Disable folder" : "Enable folder"}
          title={
            localEnabled
              ? "Folder enabled — entries inside activate normally"
              : "Folder disabled — entries inside will not activate, regardless of their own toggle"
          }
          onClick={handleEnableToggle}
          className="shrink-0"
        >
          {localEnabled ? (
            <ToggleRight size="1.125rem" className="text-amber-400" />
          ) : (
            <ToggleLeft size="1.125rem" className="text-[var(--muted-foreground)]" />
          )}
        </button>

        {/* Folder icon + name */}
        <Folder
          size="0.875rem"
          className={cn("shrink-0", localEnabled ? "text-amber-400" : "text-[var(--muted-foreground)]")}
        />
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Untitled folder"
          className="min-w-0 flex-1 truncate bg-transparent px-1 text-sm font-semibold outline-none transition-colors hover:bg-[var(--accent)]/40 focus:bg-[var(--accent)]/40 focus:ring-1 focus:ring-[var(--ring)] rounded"
        />

        {/* Entry count badge */}
        <span
          className="shrink-0 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]"
          title={`${entryCount} entr${entryCount === 1 ? "y" : "ies"} in this folder`}
        >
          {entryCount}
        </span>

        {/* Delete (hover-revealed on desktop, always visible on mobile per the row-action convention) */}
        <button
          type="button"
          aria-label="Delete folder"
          onClick={handleDelete}
          className="shrink-0 rounded p-1 opacity-0 transition-all hover:bg-[var(--destructive)]/15 group-hover:opacity-100 max-md:opacity-100"
        >
          <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
        </button>
      </div>
    </div>
  );
}
