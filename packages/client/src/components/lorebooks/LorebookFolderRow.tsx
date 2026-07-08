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
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ChevronDown, Copy, GripVertical, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { confirmNonEmptyFolderDelete } from "../../lib/app-dialogs";
import { useUpdateLorebookFolder, useDeleteLorebookFolder, useCloneLorebookFolder } from "../../hooks/use-lorebooks";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { canReparentFolder, collectFolderSubtreeIds, type LorebookFolder } from "@marinara-engine/shared";

interface Props {
  folder: LorebookFolder;
  lorebookId: string;
  /** All folders in this lorebook — builds the parent picker + validates moves. */
  folders: LorebookFolder[];
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
  /** True while a dragged folder hovers this row's nest band — draws a nest ring. */
  isNestTarget?: boolean;
  onDragHandleMouseDown: () => void;
  onDragHandleMouseUp: () => void;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragHandleTouchStart?: (e: ReactTouchEvent<HTMLButtonElement>, sourceElement: HTMLDivElement | null) => void;
}

export function LorebookFolderRow({
  folder,
  lorebookId,
  folders,
  entryCount,
  isCollapsed,
  onToggleCollapse,
  draggable,
  isDragging,
  isDragReady,
  isNestTarget = false,
  onDragHandleMouseDown,
  onDragHandleMouseUp,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragHandleTouchStart,
}: Props) {
  const updateFolder = useUpdateLorebookFolder();
  const deleteFolder = useDeleteLorebookFolder();
  const cloneFolder = useCloneLorebookFolder();

  // The native drag is armed on this row imperatively (see the handle's onMouseDown)
  // so a heavy re-render can't lose the race against the browser's drag threshold.
  const rowRef = useRef<HTMLDivElement>(null);

  // Optimistic mirrors so toggle/rename feel snappy while the mutation flushes.
  const [localEnabled, setLocalEnabled] = useState(folder.enabled);
  const [localName, setLocalName] = useState(folder.name);
  const [localParentId, setLocalParentId] = useState(folder.parentFolderId);

  const lastSyncedRef = useRef(folder);
  useEffect(() => {
    if (lastSyncedRef.current === folder) return;
    lastSyncedRef.current = folder;
    setLocalEnabled(folder.enabled);
    setLocalName(folder.name);
    setLocalParentId(folder.parentFolderId);
  }, [folder]);

  const handleEnabledChange = useCallback(
    (next: boolean) => {
      const previous = localEnabled;
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

  // Guards the optimistic rollback below: if several parent changes fire in quick
  // succession, only the latest may roll back — a stale out-of-order failure must
  // not clobber a newer optimistic value.
  const parentChangeSeqRef = useRef(0);
  const handleParentChange = useCallback(
    (parentFolderId: string | null) => {
      const previous = localParentId;
      const seq = ++parentChangeSeqRef.current;
      // Optimistic flip; roll back if the move is rejected server-side.
      setLocalParentId(parentFolderId);
      updateFolder.mutate(
        { lorebookId, folderId: folder.id, parentFolderId },
        {
          onError: () => {
            if (parentChangeSeqRef.current === seq) setLocalParentId(previous);
          },
        },
      );
    },
    [localParentId, lorebookId, folder.id, updateFolder],
  );

  // Valid parents only: same lorebook, not this folder, not one of its own
  // descendants — so the picker can never offer a move that would cycle.
  const parentOptions = folders.filter(
    (candidate) => candidate.id !== folder.id && canReparentFolder(folders, folder.id, candidate.id).ok,
  );

  const handleDelete = useCallback(
    async (e: ReactMouseEvent) => {
      e.stopPropagation();
      const descendantCount = collectFolderSubtreeIds(folders, folder.id).length - 1;
      const hasSubfolders = descendantCount > 0;
      const contentCount = entryCount + descendantCount;
      const confirmed = await confirmNonEmptyFolderDelete(contentCount, {
        title: "Delete Folder",
        message: hasSubfolders
          ? `Delete "${folder.name}"? Its nested subfolder${descendantCount === 1 ? "" : "s"} and entries will move up to the top level.`
          : `Delete "${folder.name}"? Its ${entryCount} entr${entryCount === 1 ? "y" : "ies"} will move up to the top level.`,
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (!confirmed) return;
      deleteFolder.mutate({ lorebookId, folderId: folder.id });
    },
    [entryCount, lorebookId, folder.id, folder.name, folders, deleteFolder],
  );

  return (
    <div
      className={cn(
        "mari-editor-panel mari-editor-panel--soft transition-all",
        !isCollapsed && "border-[var(--marinara-editor-border-strong)]",
        isDragging && "opacity-40",
        isNestTarget && "border-[var(--marinara-editor-accent)] shadow-[0_0_0_1px_var(--marinara-editor-accent)]",
      )}
      ref={rowRef}
      data-lorebook-folder-row-id={folder.id}
      draggable={draggable && isDragReady}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div
        className="group flex min-w-0 cursor-pointer items-center gap-0.5 px-1.5 py-1.5 sm:gap-2 sm:px-2"
        onClick={onToggleCollapse}
      >
        {/* Drag handle */}
        <button
          type="button"
          className={cn(
            "flex h-6 w-4 shrink-0 items-center justify-center rounded p-0 text-[var(--muted-foreground)] transition-colors sm:h-auto sm:w-auto sm:p-0.5",
            draggable
              ? "cursor-grab hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:cursor-grabbing"
              : "cursor-not-allowed opacity-40",
          )}
          title={draggable ? "Drag to reorder folder" : "Use Order sort and clear search to reorder"}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (draggable) {
              // Arm the native drag synchronously so it can begin on THIS gesture.
              // The React state flip alone (onDragHandleMouseDown) can lose the race
              // with the browser's drag threshold on a heavy re-render (deep folder
              // trees), leaving the folder unable to lift.
              if (rowRef.current) rowRef.current.draggable = true;
              onDragHandleMouseDown();
            }
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onDragHandleMouseUp();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            if (draggable) onDragHandleTouchStart?.(e, rowRef.current);
          }}
        >
          <GripVertical size="0.875rem" />
        </button>

        {/* Collapse chevron */}
        <button
          type="button"
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
          className="flex h-6 w-4 shrink-0 items-center justify-center rounded p-0 text-[var(--muted-foreground)] transition-transform hover:bg-[var(--accent)] hover:text-[var(--foreground)] sm:h-auto sm:w-auto sm:p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
        >
          <ChevronDown
            size="0.875rem"
            className={cn("transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")}
          />
        </button>

        <div
          className="-mx-1 shrink-0 sm:mx-0"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <SettingsSwitch
            ariaLabel={localEnabled ? "Disable folder" : "Enable folder"}
            title={
              localEnabled
                ? "Folder enabled — entries inside activate normally"
                : "Folder disabled — entries inside will not activate, regardless of their own toggle"
            }
            checked={localEnabled}
            onChange={handleEnabledChange}
            className="p-0 hover:bg-transparent"
          />
        </div>

        {/* Folder name */}
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

        {/* Parent folder picker — nest this folder under another (cycle-safe options) */}
        {parentOptions.length > 0 && (
          <select
            value={localParentId ?? ""}
            onChange={(e) => handleParentChange(e.target.value || null)}
            onClick={(e) => e.stopPropagation()}
            title="Nest this folder under another folder"
            aria-label="Parent folder"
            className="mari-editor-field shrink-0 max-w-[4.75rem] truncate px-1 py-0.5 text-[0.625rem] text-[var(--marinara-editor-muted)] sm:max-w-[7rem] sm:px-1.5"
          >
            <option value="">(top level)</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name.trim() || "Untitled folder"}
              </option>
            ))}
          </select>
        )}

        {/* Entry count badge */}
        <span
          className="mari-editor-chip shrink-0 px-1.5 py-0.5 text-[0.625rem] sm:px-2"
          title={`${entryCount} entr${entryCount === 1 ? "y" : "ies"} in this folder`}
        >
          {entryCount}
        </span>

        {/* Clone — deep-copies the folder, its entries, and its sub-folders */}
        <button
          type="button"
          aria-label="Clone folder"
          title="Clone this folder, its entries, and its sub-folders"
          disabled={cloneFolder.isPending}
          onClick={(e) => {
            e.stopPropagation();
            cloneFolder.mutate({ lorebookId, folderId: folder.id });
          }}
          className="shrink-0 rounded p-0.5 opacity-0 transition-all hover:bg-[var(--accent)] group-hover:opacity-100 max-md:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 sm:p-1"
        >
          <Copy size="0.75rem" className="text-[var(--muted-foreground)]" />
        </button>

        {/* Delete (hover-revealed on desktop, always visible on mobile per the row-action convention) */}
        <button
          type="button"
          aria-label="Delete folder"
          onClick={handleDelete}
          className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100 max-md:opacity-100 sm:p-1"
        >
          <Trash2 size="0.75rem" />
        </button>
      </div>
    </div>
  );
}
