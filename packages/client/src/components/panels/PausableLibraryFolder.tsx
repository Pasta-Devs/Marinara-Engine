// ──────────────────────────────────────────────
// Panel: pausable library folder (Regexes and Functions tabs)
// ──────────────────────────────────────────────
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Folder, Pencil, Trash2 } from "lucide-react";
import { confirmNonEmptyFolderDelete } from "../../lib/app-dialogs";
import { handleFolderRenameInputKeyDown } from "../../hooks/use-folder-rename-gesture";
import type {
  LibraryFolder,
  useDeleteLibraryFolder,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { SettingsSwitch } from "./settings/SettingControls";

export type EditingLibraryFolder = { id: string; name: string } | null;

/** The "Move to folder" menu shared by the per-row button and the bulk action bar. */
export function useLibraryMoveMenu(
  folders: LibraryFolder[],
  moveItems: ReturnType<typeof useMoveLibraryItem>,
  onError: () => void,
) {
  const { t: localizeUi } = useTranslation();
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const folderByItemId = new Map(folders.flatMap((folder) => folder.itemIds.map((id) => [id, folder.id] as const)));
  const openMoveMenu = (button: HTMLButtonElement, itemIds: string[]) => {
    const rect = button.getBoundingClientRect();
    const source = itemIds.length === 1 ? (folderByItemId.get(itemIds[0]!) ?? null) : undefined;
    setMenu({
      x: rect.left,
      y: rect.bottom,
      items: [{ id: null, name: localizeUi("lorebook.editor.bulk.noFolder") }, ...folders].map((folder) => ({
        label: folder.name,
        checked: source === folder.id,
        onSelect: () => moveItems.mutate({ itemIds, folderId: folder.id }, { onError }),
      })),
    });
  };
  const moveMenu = menu ? <ContextMenu {...menu} autoFocus onClose={() => setMenu(null)} /> : null;
  return { openMoveMenu, moveMenu };
}

/**
 * One library folder with a collapse chevron, item count, pause switch, rename and delete.
 * Shared by the Regexes and Functions tabs; `children` are the folder's rows.
 */
export function PausableLibraryFolder({
  folder,
  dataAttribute,
  itemCount,
  itemCountLabel,
  switchLabel,
  switchHint,
  deleteConfirmMessage,
  editingFolder,
  setEditingFolder,
  updateFolder,
  deleteFolder,
  onError,
  busy,
  selectionMode,
  searching,
  children,
}: {
  folder: LibraryFolder;
  /** The `data-*` attribute that carries the folder id, e.g. `data-regex-folder`. */
  dataAttribute: string;
  itemCount: number;
  itemCountLabel: string;
  switchLabel: string;
  switchHint: string;
  deleteConfirmMessage: string;
  editingFolder: EditingLibraryFolder;
  setEditingFolder: Dispatch<SetStateAction<EditingLibraryFolder>>;
  updateFolder: ReturnType<typeof useUpdateLibraryFolder>;
  deleteFolder: ReturnType<typeof useDeleteLibraryFolder>;
  onError: () => void;
  busy: boolean;
  selectionMode: boolean;
  searching: boolean;
  children: ReactNode;
}) {
  const { t: localizeUi } = useTranslation();
  const editing = editingFolder?.id === folder.id;
  return (
    <div className="rounded-lg border border-[var(--border)]" {...{ [dataAttribute]: folder.id }}>
      <div className="flex items-center gap-1.5 px-2 py-1">
        {editing ? (
          <input
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            aria-label={localizeUi("ui.panels.backgroundpicker.renameFolder")}
            maxLength={200}
            value={editingFolder.name}
            onChange={(event) => setEditingFolder({ id: folder.id, name: event.target.value })}
            onBlur={() => {
              const name = editingFolder.name.trim();
              setEditingFolder(null);
              if (name && name !== folder.name) updateFolder.mutate({ id: folder.id, name }, { onError });
            }}
            onKeyDown={(event) => handleFolderRenameInputKeyDown(event, () => setEditingFolder(null))}
            className="mari-chrome-field min-w-0 flex-1 px-2 py-1 text-xs"
          />
        ) : (
          <button
            type="button"
            aria-expanded={!folder.collapsed}
            aria-label={folder.name}
            onClick={() => updateFolder.mutate({ id: folder.id, collapsed: !folder.collapsed }, { onError })}
            className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold"
          >
            {folder.collapsed ? (
              <ChevronRight size="0.75rem" className="shrink-0" />
            ) : (
              <ChevronDown size="0.75rem" className="shrink-0" />
            )}
            <Folder size="0.875rem" className="mari-chrome-accent-icon shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate" title={folder.name}>
                {folder.name}
              </span>
              <span className="flex flex-wrap gap-x-1.5 text-[0.625rem] font-normal text-[var(--muted-foreground)]">
                <span>{itemCountLabel}</span>
                {folder.paused && <span>{localizeUi("regex.library.paused")}</span>}
              </span>
            </span>
          </button>
        )}
        <SettingsSwitch
          ariaLabel={switchLabel}
          title={switchHint}
          checked={!folder.paused}
          disabled={busy || updateFolder.isPending}
          onChange={(checked) => updateFolder.mutate({ id: folder.id, paused: !checked }, { onError })}
          className="min-h-9 p-0 hover:bg-transparent"
        />
        {!selectionMode && (
          <>
            <button
              type="button"
              onClick={() => setEditingFolder({ id: folder.id, name: folder.name })}
              aria-label={localizeUi("ui.panels.backgroundpicker.renameFolder")}
              title={localizeUi("ui.panels.backgroundpicker.renameFolder")}
              className="mari-chrome-control mari-chrome-control--small min-h-8 shrink-0 p-1.5"
            >
              <Pencil size="0.75rem" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  !(await confirmNonEmptyFolderDelete(itemCount, {
                    title: localizeUi("ui.panels.backgroundpicker.deleteFolder"),
                    message: deleteConfirmMessage,
                    confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                    tone: "destructive",
                  }))
                )
                  return;
                deleteFolder.mutate(folder.id, { onError });
              }}
              aria-label={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
              title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
              className="mari-chrome-control mari-chrome-control--small min-h-8 shrink-0 p-1.5"
            >
              <Trash2 size="0.75rem" />
            </button>
          </>
        )}
      </div>
      {/* A search opens matching folders for the view only; the saved collapse state is untouched. */}
      <SmoothFolderContent open={searching || !folder.collapsed} innerClassName="px-1 pb-1">
        {children}
      </SmoothFolderContent>
    </div>
  );
}
