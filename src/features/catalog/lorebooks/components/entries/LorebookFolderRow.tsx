import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ChevronDown, Folder, GripVertical, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { useUpdateLorebookFolder, useDeleteLorebookFolder } from "../../hooks/use-lorebooks";
import { canReparentFolder } from "../../lib/lorebook-folder-tree";
import { CompactSelect } from "./LorebookEntryRowControls";
import type { LorebookFolder } from "../../../../../engine/contracts/types/lorebook";

interface Props {
  folder: LorebookFolder;
  folders: LorebookFolder[];
  lorebookId: string;
  entryCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  draggable: boolean;
  isDragging: boolean;
  isNestTarget?: boolean;
  inheritedDisabled?: boolean;
  onDragHandleMouseDown: () => void;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function LorebookFolderRow({
  folder,
  folders,
  lorebookId,
  entryCount,
  isCollapsed,
  onToggleCollapse,
  draggable,
  isDragging,
  isNestTarget,
  inheritedDisabled = false,
  onDragHandleMouseDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const updateFolder = useUpdateLorebookFolder();
  const deleteFolder = useDeleteLorebookFolder();

  // Optimistic mirrors roll back on mutation errors.
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

  const handleEnableToggle = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      const previous = localEnabled;
      const next = !previous;
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
            setLocalName(previous);
          },
        },
      );
    }
  }, [localName, folder.name, lorebookId, folder.id, updateFolder]);

  const handleParentChange = useCallback(
    (value: string) => {
      const next = value === "" ? null : value;
      const previous = localParentId;
      setLocalParentId(next);
      updateFolder.mutate(
        { lorebookId, folderId: folder.id, parentFolderId: next },
        {
          onError: () => {
            setLocalParentId(previous);
          },
        },
      );
    },
    [localParentId, lorebookId, folder.id, updateFolder],
  );

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

  // Valid parents use the same ancestry guard as drag/drop.
  const parentOptions = [
    { value: "", label: "(no parent)" },
    ...folders
      .filter((candidate) => candidate.id !== folder.id && canReparentFolder(folders, folder.id, candidate.id).ok)
      .map((candidate) => ({ value: candidate.id, label: candidate.name.trim() || "Untitled folder" })),
  ];

  // Disabled ancestors gate entries even when this folder's own toggle is on.
  const effectivelyDisabled = inheritedDisabled || !localEnabled;

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--secondary)]/60 ring-1 ring-[var(--border)] transition-all",
        !isCollapsed && "ring-amber-400/30",
        isNestTarget && "ring-2 ring-amber-400",
        isDragging && "opacity-40",
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="group flex cursor-pointer items-center gap-2 px-2 py-1.5" onClick={onToggleCollapse}>
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
        >
          <GripVertical size="0.875rem" />
        </button>

        <button
          type="button"
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
          className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-transform hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
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

        <button
          type="button"
          aria-label={localEnabled ? "Disable folder" : "Enable folder"}
          title={
            inheritedDisabled
              ? "A parent folder is disabled, so entries here won't activate even though this folder is on."
              : localEnabled
                ? "Folder enabled — entries inside activate normally"
                : "Folder disabled — entries inside will not activate, regardless of their own toggle"
          }
          onClick={handleEnableToggle}
          className="shrink-0"
        >
          {localEnabled ? (
            <ToggleRight
              size="1.125rem"
              className={inheritedDisabled ? "text-[var(--muted-foreground)]" : "text-amber-400"}
            />
          ) : (
            <ToggleLeft size="1.125rem" className="text-[var(--muted-foreground)]" />
          )}
        </button>

        <Folder
          size="0.875rem"
          className={cn("shrink-0", effectivelyDisabled ? "text-[var(--muted-foreground)]" : "text-amber-400")}
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

        {(folders.length > 1 || localParentId !== null) && (
          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <CompactSelect
              value={localParentId ?? ""}
              onChange={handleParentChange}
              title="Nest this folder under another folder, or choose (no parent) for the top level."
              options={parentOptions}
              className="w-[5.5rem] sm:w-[7rem]"
            />
          </span>
        )}

        {inheritedDisabled && (
          <span
            className="shrink-0 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-medium text-amber-500/80"
            title="A parent folder is disabled, so entries in this folder won't activate."
          >
            parent off
          </span>
        )}

        <span
          className="shrink-0 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]"
          title={`${entryCount} entr${entryCount === 1 ? "y" : "ies"} in this folder`}
        >
          {entryCount}
        </span>

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
