// ──────────────────────────────────────────────
// ConnectionFolderGroup — "Group by: Folder" in the Connections list: one card per folder in the same box and well
// as a Connection's card (colour dot, name, count, ⋯, fold), and "Not in a folder" last. Also the one folder
// chooser the row ⋯ menu and multi-select share.
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { ChevronDown, MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ConnectionFolder } from "@marinara-engine/shared";
import {
  useConnectionFolders,
  useCreateConnectionFolder,
  useDeleteConnectionFolder,
  useMoveConnectionToFolder,
  useUpdateConnectionFolder,
} from "../../hooks/use-connection-folders";
import { showChoiceDialog, showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { ContextMenu } from "../ui/ContextMenu";
import { ROW_BUTTON, menuAt, type ConnectionRowData, type MenuAt } from "./ConnectionRow";

/** Dot colours a folder can wear; "" is the neutral dot. */
const FOLDER_COLOURS = {
  none: "",
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#10b981",
  blue: "#3b82f6",
  purple: "#a855f7",
} as const;

const NEW_FOLDER = "\u0000new";
const NO_FOLDER = "\u0000none";

/** Asks which folder the Models go in (or none, or a new one) and moves them there; true once they moved. */
export function useFolderChooser() {
  const { t } = useTranslation();
  const { data: folders } = useConnectionFolders();
  const createFolder = useCreateConnectionFolder();
  const moveToFolder = useMoveConnectionToFolder();
  return async (rows: ConnectionRowData[]): Promise<boolean> => {
    const shared = rows.every((row) => row.folderId === rows[0]?.folderId) ? (rows[0]?.folderId ?? null) : undefined;
    const key = await showChoiceDialog({
      title: t("connections.folders.chooseTitle", { count: rows.length }),
      message: t("connections.folders.chooseMessage"),
      choices: [
        ...(folders ?? []).map((folder) => ({
          key: folder.id,
          label: folder.name,
          description: shared === folder.id ? t("connections.folders.current") : null,
        })),
        {
          key: NO_FOLDER,
          label: t("connections.folders.noFolder"),
          description: shared === null ? t("connections.folders.current") : null,
        },
        { key: NEW_FOLDER, label: t("connections.folders.newFolder") },
      ],
      cancelLabel: t("connections.accounts.editor.cancel"),
    });
    if (key === null) return false;
    try {
      let folderId: string | null = key === NO_FOLDER ? null : key;
      if (key === NEW_FOLDER) {
        const name = (
          await showPromptDialog({
            title: t("connections.folders.newTitle"),
            message: t("connections.folders.newMessage"),
            placeholder: t("connections.folders.namePlaceholder"),
            confirmLabel: t("connections.folders.create"),
            cancelLabel: t("connections.accounts.editor.cancel"),
          })
        )?.trim();
        if (!name) return false;
        folderId = (await createFolder.mutateAsync({ name })).id;
      }
      for (const row of rows) await moveToFolder.mutateAsync({ connectionId: row.id, folderId });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  };
}

export function ConnectionFolderGroup({
  folder,
  rows,
  visibleRows,
  open,
  onToggle,
  renderRow,
}: {
  /** null: the Models in no folder. */
  folder: ConnectionFolder | null;
  rows: ConnectionRowData[];
  visibleRows: ConnectionRowData[];
  open: boolean;
  onToggle: () => void;
  renderRow: (row: ConnectionRowData) => ReactNode;
}) {
  const { t } = useTranslation();
  const updateFolder = useUpdateConnectionFolder();
  const deleteFolder = useDeleteConnectionFolder();
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const name = folder?.name ?? t("connections.folders.none");
  const listId = `connection-folder-${folder?.id ?? "none"}`;

  const rename = async () => {
    if (!folder) return;
    const next = (
      await showPromptDialog({
        title: t("connections.folders.renameTitle"),
        message: t("connections.folders.newMessage"),
        defaultValue: folder.name,
        confirmLabel: t("connections.folders.rename"),
        cancelLabel: t("connections.accounts.editor.cancel"),
      })
    )?.trim();
    if (next && next !== folder.name) updateFolder.mutate({ id: folder.id, name: next });
  };
  const recolour = async () => {
    if (!folder) return;
    const key = await showChoiceDialog({
      title: t("connections.folders.colourTitle"),
      message: t("connections.folders.colourMessage"),
      choices: Object.keys(FOLDER_COLOURS).map((colour) => ({
        key: colour,
        label: t(`connections.folders.colours.${colour}`),
      })),
      cancelLabel: t("connections.accounts.editor.cancel"),
    });
    if (key) updateFolder.mutate({ id: folder.id, color: FOLDER_COLOURS[key as keyof typeof FOLDER_COLOURS] });
  };
  const remove = async () => {
    if (!folder) return;
    const ok = await showConfirmDialog({
      title: t("connections.folders.deleteTitle", { name: folder.name }),
      message: t("connections.folders.deleteMessage"),
      confirmLabel: t("connections.folders.delete"),
      cancelLabel: t("connections.accounts.editor.cancel"),
      tone: "destructive",
    });
    if (ok) deleteFolder.mutate(folder.id);
  };

  return (
    <div
      role="group"
      aria-label={name}
      data-connection-folder={folder?.id ?? "none"}
      className="mari-connection-group flex min-w-0 flex-col"
    >
      <div className="mari-connection-card-head flex min-w-0 items-center rounded-lg">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-1 ps-2 pe-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
        >
          <span
            aria-hidden
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              !folder?.color && "border border-[var(--muted-foreground)]/60",
            )}
            style={folder?.color ? { backgroundColor: folder.color } : undefined}
          />
          <span className="min-w-0 flex-1">
            <strong className="line-clamp-2 min-w-0 break-words text-[0.9375rem] font-semibold leading-5 text-[var(--foreground)]">
              {name}
            </strong>
            <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
              {t("connections.list.models", { count: rows.length })}
            </span>
          </span>
        </button>
        {folder && (
          <button
            type="button"
            onClick={(event) => setMenu(menuAt(event))}
            className={cn(ROW_BUTTON, "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
            title={t("connections.folders.actions", { name })}
            aria-label={t("connections.folders.actions", { name })}
            aria-haspopup="menu"
            aria-expanded={!!menu}
          >
            <MoreHorizontal size="1rem" />
          </button>
        )}
        <button type="button" tabIndex={-1} aria-hidden onClick={onToggle} className={ROW_BUTTON}>
          <ChevronDown
            size="0.875rem"
            className={cn(
              "text-[var(--muted-foreground)] transition-transform motion-reduce:transition-none",
              !open && "-rotate-90",
            )}
          />
        </button>
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            autoFocus={menu.keyboard}
            onClose={() => setMenu(null)}
            items={[
              {
                label: t("connections.folders.rename"),
                icon: <Pencil size="0.75rem" />,
                onSelect: () => void rename(),
              },
              {
                label: t("connections.folders.colour"),
                icon: <Palette size="0.75rem" />,
                onSelect: () => void recolour(),
              },
              {
                label: t("connections.folders.delete"),
                icon: <Trash2 size="0.75rem" />,
                destructive: true,
                onSelect: () => void remove(),
              },
            ]}
          />
        )}
      </div>
      {open && visibleRows.length > 0 && (
        <div id={listId} className="mari-connection-model-well min-w-0">
          {visibleRows.map((row) => (
            <div key={row.id} className="mari-connection-model-slot min-w-0">
              {renderRow(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
