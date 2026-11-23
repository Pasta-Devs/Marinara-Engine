// ──────────────────────────────────────────────
// Lorebooks panel: saved lorebook sets (#9672). A set is a named list of lorebooks that the
// New Roleplay wizard and agents' fixed sources can pick in one go. It only references the
// lorebooks (no copies), and picking it copies the list, so changes made there never reach it.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Layers, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useUpdateLibraryFolder,
  type LibraryFolder,
} from "../../../hooks/use-library-folders";
import { useLorebooks } from "../../../hooks/use-lorebooks";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { LorebookListField } from "../../ui/LibraryPickers";
import { SmoothFolderContent } from "../../ui/SmoothFolderContent";

export function LorebookSetsSection() {
  const { t } = useTranslation();
  const { data: sets = [] } = useLibraryFolders("lorebook-sets");
  const createSet = useCreateLibraryFolder("lorebook-sets");
  const deleteSet = useDeleteLibraryFolder("lorebook-sets");
  const [open, setOpen] = useState(false);
  const [openSetId, setOpenSetId] = useState<string | null>(null);

  const handleCreate = () =>
    createSet.mutate(
      { name: getNextUnnamedLibraryFolderName(sets) },
      {
        onSuccess: (set) => {
          setOpen(true);
          setOpenSetId(set.id);
        },
      },
    );

  const handleDelete = async (set: LibraryFolder) => {
    const confirmed = await showConfirmDialog({
      title: t("lorebook.sets.deleteTitle"),
      message: t("lorebook.sets.deleteMessage", { name: set.name }),
      confirmLabel: t("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;
    deleteSet.mutate(set.id);
    if (openSetId === set.id) setOpenSetId(null);
  };

  return (
    <div data-component="LorebookSetsSection" className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--sidebar-accent)]/40 max-md:min-h-11"
        >
          <ChevronRight
            size="0.75rem"
            className={cn(
              "mari-chrome-accent-icon shrink-0 transition-transform duration-200 ease-out",
              open && "rotate-90",
            )}
          />
          <Layers size="0.75rem" className="mari-chrome-accent-icon shrink-0" />
          <span className="mari-chrome-text-muted min-w-0 flex-1 truncate text-xs font-medium">
            {t("lorebook.sets.title")}
          </span>
          {sets.length > 0 && (
            <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">{sets.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createSet.isPending}
          className="mari-chrome-control mari-chrome-control--small shrink-0 whitespace-nowrap text-[0.6875rem] active:scale-90 max-md:min-h-11"
        >
          <Plus size="0.75rem" />
          {t("lorebook.sets.create")}
        </button>
      </div>
      <SmoothFolderContent
        open={open}
        className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
        innerClassName="flex flex-col gap-0.5"
      >
        {sets.length === 0 ? (
          <p className="mari-chrome-text-muted py-2 text-[0.625rem] italic">{t("lorebook.sets.empty")}</p>
        ) : (
          sets.map((set) => {
            const isOpen = openSetId === set.id;
            return (
              <div key={set.id} className="flex flex-col">
                <div className="group relative flex items-center">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenSetId(isOpen ? null : set.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 pr-10 text-left transition-colors hover:bg-[var(--sidebar-accent)]/40 max-md:min-h-11"
                  >
                    <ChevronRight
                      size="0.75rem"
                      className={cn(
                        "mari-chrome-accent-icon shrink-0 transition-transform duration-200 ease-out",
                        isOpen && "rotate-90",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">{set.name}</span>
                    <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                      {t("lorebook.sets.lorebookCount", { count: set.itemIds.length })}
                    </span>
                  </button>
                  <div className="absolute right-2 top-1/2 flex shrink-0 -translate-y-1/2 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                    <button
                      type="button"
                      onClick={() => void handleDelete(set)}
                      className="flex items-center justify-center rounded-md p-1 text-[var(--destructive)] active:scale-90"
                      title={t("lorebook.sets.delete")}
                      aria-label={t("lorebook.sets.deleteNamed", { name: set.name })}
                    >
                      <Trash2 size="0.75rem" />
                    </button>
                  </div>
                </div>
                {isOpen && <LorebookSetEditor set={set} />}
              </div>
            );
          })
        )}
      </SmoothFolderContent>
    </div>
  );
}

// An open set: its name and its lorebooks. Mounted only while open, so the full lorebook list
// loads only when someone edits a set. The picks are kept here as well, so quick changes in a
// row each build on the last one instead of on a list that hasn't refetched yet. Each pick
// sends only what it adds or removes, so changes made elsewhere (another window, Mari) stay.
// The name field takes a name changed elsewhere unless someone is typing in it.
function LorebookSetEditor({ set }: { set: LibraryFolder }) {
  const { t } = useTranslation();
  const { data: lorebooks } = useLorebooks();
  const updateSet = useUpdateLibraryFolder("lorebook-sets");
  const [name, setName] = useState(set.name);
  const [itemIds, setItemIds] = useState(set.itemIds);
  const nameEdited = useRef(false);
  useEffect(() => {
    if (!nameEdited.current) setName(set.name);
  }, [set.name]);
  useEffect(() => {
    if (!updateSet.isPending) setItemIds(set.itemIds);
  }, [set.itemIds, updateSet.isPending]);

  const saveItems = (addItemIds: string[], removeItemIds: string[] = []) => {
    setItemIds((current) => [...new Set([...current.filter((id) => !removeItemIds.includes(id)), ...addItemIds])]);
    updateSet.mutate({ id: set.id, addItemIds, removeItemIds });
  };
  const saveName = () => {
    nameEdited.current = false;
    const trimmed = name.trim();
    if (!trimmed) setName(set.name);
    else if (trimmed !== set.name) updateSet.mutate({ id: set.id, name: trimmed });
  };

  return (
    <div className="space-y-2 px-2 pb-2 pt-1">
      <label className="block space-y-1">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">{t("lorebook.sets.name")}</span>
        <input
          value={name}
          maxLength={200}
          onChange={(event) => {
            nameEdited.current = true;
            setName(event.target.value);
          }}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="mari-chrome-field h-9 w-full min-w-0 rounded-lg px-3 text-base md:text-xs"
        />
      </label>
      <LorebookListField
        lorebooks={lorebooks ?? []}
        disabled={lorebooks === undefined}
        selectedIds={itemIds}
        onToggle={(id) => (itemIds.includes(id) ? saveItems([], [id]) : saveItems([id]))}
        onAdd={(ids) => saveItems(ids)}
        ariaLabel={t("lorebook.sets.lorebooks", { name: set.name })}
        triggerClassName="mari-chrome-field min-h-10 w-full min-w-0 rounded-lg px-3 py-2 text-base md:text-xs"
      />
    </div>
  );
}
