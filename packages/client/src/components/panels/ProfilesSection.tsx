// ──────────────────────────────────────────────
// Presets panel → Profiles tab. Game chats have no profiles.
// ──────────────────────────────────────────────
import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, FolderInput, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ChatMode, ChatPreset } from "@marinara-engine/shared";
import { AgentModeFilter, type AgentModeFilterValue } from "../agents/AgentModeFilter";
import { LibraryToolbar } from "../ui/LibraryToolbar";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { BuiltInPresetBadge } from "./BuiltInPresetBadge";
import { PausableLibraryFolder, useLibraryMoveMenu, type EditingLibraryFolder } from "./PausableLibraryFolder";
import { api } from "../../lib/api-client";
import { showAlertDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { isProfileMode, newProfileDetailId, PROFILE_MODES, type ProfileMode } from "../presets/profile-detail-id";
import {
  useChatPresets,
  useDeleteChatPreset,
  useDuplicateChatPreset,
  useImportChatPreset,
  useSetActiveChatPreset,
} from "../../hooks/use-chat-presets";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";
import { Checkbox } from "../ui/Checkbox";

interface ProfilesSectionProps {
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  /** The active chat's mode, used for a new profile while the filter shows All. */
  activeChatMode: ChatMode | null;
}

export function ProfilesSection({ selectionMode, setSelectionMode, activeChatMode }: ProfilesSectionProps) {
  const { t: localizeUi } = useTranslation();
  const openProfileDetail = useUIStore((s) => s.openProfileDetail);
  const { data: allProfiles, isLoading } = useChatPresets();
  const deleteProfile = useDeleteChatPreset();
  const duplicateProfile = useDuplicateChatPreset();
  const importProfile = useImportChatPreset();
  const setActiveProfile = useSetActiveChatPreset();
  const { data: folders = [], isLoading: foldersLoading, isError: foldersError } = useLibraryFolders("profiles");
  const createFolder = useCreateLibraryFolder("profiles");
  const updateFolder = useUpdateLibraryFolder("profiles");
  const deleteFolder = useDeleteLibraryFolder("profiles");
  const moveProfiles = useMoveLibraryItem("profiles");
  const [editingFolder, setEditingFolder] = useState<EditingLibraryFolder>(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<AgentModeFilterValue>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const profiles = useMemo(
    () =>
      ((allProfiles ?? []) as ChatPreset[])
        .filter((profile) => isProfileMode(profile.mode))
        // Each mode's built-in Default first, then A–Z.
        .sort(
          (left, right) =>
            PROFILE_MODES.indexOf(left.mode as ProfileMode) - PROFILE_MODES.indexOf(right.mode as ProfileMode) ||
            Number(right.isDefault) - Number(left.isDefault) ||
            left.name.localeCompare(right.name),
        ),
    [allProfiles],
  );
  const query = search.trim().toLowerCase();
  const visible = profiles.filter(
    (profile) =>
      (modeFilter === "all" || profile.mode === modeFilter) && (!query || profile.name.toLowerCase().includes(query)),
  );
  const folderByProfileId = new Map(folders.flatMap((folder) => folder.itemIds.map((id) => [id, folder.id] as const)));
  const rowsByFolder = new Map<string | null, ChatPreset[]>();
  for (const profile of visible) {
    const folderId = folderByProfileId.get(profile.id) ?? null;
    const rows = rowsByFolder.get(folderId);
    if (rows) rows.push(profile);
    else rowsByFolder.set(folderId, [profile]);
  }
  const rootProfiles = rowsByFolder.get(null) ?? [];
  const builtInProfiles = rootProfiles.filter((profile) => profile.isDefault);
  const otherRootProfiles = rootProfiles.filter((profile) => !profile.isDefault);
  const visibleFolders = folders.filter(
    (folder) =>
      folder.id === editingFolder?.id ||
      rowsByFolder.has(folder.id) ||
      (!query && (modeFilter === "all" || folder.itemIds.length === 0)),
  );
  const reportFolderError = () => toast.error(localizeUi("ui.panels.profilessection.folderSaveFailed"));
  const { openMoveMenu, moveMenu } = useLibraryMoveMenu(folders, moveProfiles, reportFolderError);
  // The built-in Default profiles can't be deleted, so they are never selectable.
  const selectable = visible.filter((profile) => !profile.isDefault);
  const selected = profiles.filter((profile) => selectedIds.has(profile.id) && !profile.isDefault);

  const newProfileMode: ProfileMode =
    modeFilter !== "all" && isProfileMode(modeFilter)
      ? modeFilter
      : isProfileMode(activeChatMode)
        ? activeChatMode
        : "roleplay";

  const modeLabel = (mode: ChatMode) => localizeUi(`chat.settingsProfile.builder.mode.${mode}`);

  const toggleSelected = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportProfiles = async (rows: ChatPreset[]) => {
    // One file per profile: the server's export strips this install's local destinations.
    // A failed one doesn't stop the rest; a cancelled save-as returns a status and isn't counted.
    let failed = 0;
    for (const profile of rows) {
      try {
        await api.download(`/chat-presets/${profile.id}/export`, `${profile.name}.marinara-settings-profile.json`);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) toast.error(localizeUi("ui.panels.profilessection.exportFailed", { count: failed }));
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const created = await importProfile.mutateAsync(JSON.parse(await file.text()));
      if (created?.name) toast.success(localizeUi("ui.panels.profilessection.imported", { name: created.name }));
    } catch (error) {
      await showAlertDialog({
        title: localizeUi("chat.settingsProfile.import.failedTitle"),
        message: localizeUi("chat.settingsProfile.import.failedWithReason", {
          reason: error instanceof Error ? error.message : localizeUi("chat.settingsProfile.import.invalidFile"),
        }),
        tone: "destructive",
      });
    }
  };

  const handleDelete = async (profile: ChatPreset) => {
    if (profile.isDefault) return;
    const ok = await showConfirmDialog({
      title: localizeUi("chat.settingsProfile.action.delete"),
      message: localizeUi("dialog.delete.namedPermanent", { name: profile.name }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (ok) deleteProfile.mutate(profile.id);
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0 || busy) return;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.panels.profilessection.deleteSelectedTitle"),
      message: localizeUi("ui.panels.profilessection.deleteSelectedMessage", { count: selected.length }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(selected.map((profile) => deleteProfile.mutateAsync(profile.id)));
      const failedIds = new Set(
        selected.filter((_, index) => results[index]?.status === "rejected").map((profile) => profile.id),
      );
      // Keep the ones that failed selected, so a retry is one click.
      setSelectedIds(failedIds);
      if (failedIds.size > 0)
        toast.error(localizeUi("ui.panels.profilessection.deleteFailed", { count: failedIds.size }));
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (profile: ChatPreset) => {
    const isBulkSelected = selectedIds.has(profile.id);
    const canSelect = !profile.isDefault;
    const open = () => {
      if (selectionMode) {
        if (canSelect) toggleSelected(profile.id);
      } else if (!profile.isDefault) openProfileDetail(profile.id);
    };
    return (
      <div
        key={profile.id}
        data-settings-profile-row={profile.id}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)] max-md:flex-wrap max-md:gap-y-1 [@media(pointer:coarse)]:flex-wrap [@media(pointer:coarse)]:gap-y-1",
          selectionMode &&
            isBulkSelected &&
            "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
        )}
      >
        <button
          type="button"
          onClick={open}
          disabled={selectionMode ? !canSelect : profile.isDefault}
          aria-pressed={selectionMode && canSelect ? isBulkSelected : undefined}
          title={profile.isDefault ? localizeUi("ui.panels.profilessection.builtInHint") : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] max-md:basis-40 [@media(pointer:coarse)]:basis-40"
        >
          {selectionMode && (
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                !canSelect && "opacity-30",
                isBulkSelected
                  ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
                  : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
              )}
            >
              {isBulkSelected && <Check size="0.75rem" />}
            </span>
          )}
          <span className="mari-panel-gradient-surface mari-panel-gradient--presets relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <SlidersHorizontal size="1rem" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-medium leading-5" title={profile.name}>
                {profile.name}
              </span>
              {profile.isDefault && <BuiltInPresetBadge />}
            </span>
            <span className="flex min-w-0 items-center gap-2 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
              <span className="shrink-0">{modeLabel(profile.mode)}</span>
              {profile.isActive && (
                <span className="flex min-w-0 items-center gap-0.5 truncate">
                  <Star size="0.5625rem" className="shrink-0 fill-yellow-500 text-yellow-500" aria-hidden />
                  {localizeUi("ui.panels.profilessection.newChatsDefault")}
                </span>
              )}
            </span>
          </span>
        </button>

        {!selectionMode && (
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:static max-md:ml-auto max-md:translate-y-0 max-md:opacity-100 [@media(pointer:coarse)]:static [@media(pointer:coarse)]:ml-auto [@media(pointer:coarse)]:translate-y-0 [@media(pointer:coarse)]:opacity-100 group-hover:[&_button]:pointer-events-auto [@media(pointer:fine)]:group-focus-within:[&_button]:pointer-events-auto max-md:[&_button]:pointer-events-auto [@media(pointer:coarse)]:[&_button]:pointer-events-auto">
            {folders.length > 0 && (
              <button
                type="button"
                onClick={(event) => openMoveMenu(event.currentTarget, [profile.id])}
                disabled={moveProfiles.isPending}
                className="mari-chrome-control mari-chrome-control--small flex min-h-11 min-w-11 items-center justify-center"
                title={localizeUi("ui.panels.backgroundpicker.moveToFolder")}
                aria-label={localizeUi("ui.panels.backgroundpicker.moveToFolder")}
              >
                <FolderInput size="0.75rem" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!profile.isActive) setActiveProfile.mutate(profile.id);
              }}
              disabled={setActiveProfile.isPending}
              aria-pressed={profile.isActive}
              className={cn(
                "mari-chrome-control mari-chrome-control--small p-1.5",
                profile.isActive && "mari-chrome-control--selected",
              )}
              title={localizeUi(
                profile.isActive ? "chat.settingsProfile.default.current" : "chat.settingsProfile.default.markForMode",
              )}
              aria-label={localizeUi(
                profile.isActive ? "chat.settingsProfile.default.current" : "chat.settingsProfile.default.markForMode",
              )}
            >
              <Star size="0.75rem" className={profile.isActive ? "fill-yellow-500" : ""} />
            </button>
            {!profile.isDefault && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    duplicateProfile.mutate({
                      id: profile.id,
                      name: localizeUi("ui.panels.profilessection.copyName", { name: profile.name }).slice(0, 120),
                    })
                  }
                  disabled={duplicateProfile.isPending}
                  className="mari-chrome-control mari-chrome-control--small p-1.5"
                  title={localizeUi("ui.panels.profilessection.duplicate")}
                  aria-label={localizeUi("ui.panels.profilessection.duplicate")}
                >
                  <Copy size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => void exportProfiles([profile])}
                  className="mari-chrome-control mari-chrome-control--small p-1.5"
                  title={localizeUi("chat.settingsProfile.action.export")}
                  aria-label={localizeUi("chat.settingsProfile.action.export")}
                >
                  <Download size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(profile)}
                  className="mari-chrome-control mari-chrome-control--small p-1.5"
                  title={localizeUi("chat.settingsProfile.action.delete")}
                  aria-label={localizeUi("chat.settingsProfile.action.delete")}
                >
                  <Trash2 size="0.75rem" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <LibraryToolbar
        tone="presets"
        create={{
          label: localizeUi("ui.panels.profilessection.createProfile"),
          title: localizeUi("ui.panels.profilessection.createProfile"),
          onClick: () => openProfileDetail(newProfileDetailId(newProfileMode)),
        }}
        importAction={{
          label: localizeUi("chat.settingsProfile.action.import"),
          title: localizeUi("chat.settingsProfile.action.import"),
          accept: ".json,application/json",
          onChange: (event) => void handleImport(event),
        }}
        select={{
          active: selectionMode,
          label: localizeUi(
            selectionMode ? "ui.panels.profilessection.exitSelection" : "ui.panels.profilessection.selectProfiles",
          ),
          title: localizeUi(
            selectionMode ? "ui.panels.profilessection.exitSelection" : "ui.panels.profilessection.selectProfiles",
          ),
          // Only entering select mode needs a deletable profile; leaving it must always work.
          disabled: busy || (!selectionMode && profiles.every((profile) => profile.isDefault)),
          onToggle: () => {
            setSelectionMode(!selectionMode);
            if (selectionMode) setSelectedIds(new Set());
          },
        }}
        search={{ value: search, placeholder: localizeUi("search.panels.profiles"), onChange: setSearch }}
        folder={{
          label: localizeUi("ui.panels.backgroundpicker.newFolder"),
          disabled: foldersLoading || foldersError || createFolder.isPending,
          onCreate: () =>
            createFolder.mutate(
              { name: getNextUnnamedLibraryFolderName(folders) },
              {
                onSuccess: (folder) => setEditingFolder({ id: folder.id, name: folder.name }),
                onError: reportFolderError,
              },
            ),
        }}
      >
        <AgentModeFilter value={modeFilter} onChange={setModeFilter} modes={PROFILE_MODES} />
      </LibraryToolbar>

      <div className="flex flex-col gap-1">
        <div className="mb-1.5 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.profilessection.hint")}
        </div>
        {selectionMode && (
          <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs">
            <Checkbox
              checked={selectable.length > 0 && selectable.every((profile) => selectedIds.has(profile.id))}
              disabled={busy || selectable.length === 0}
              onChange={(event) =>
                setSelectedIds(new Set(event.target.checked ? selectable.map((profile) => profile.id) : []))
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />
            {localizeUi("ui.panels.profilessection.selectAll")}
          </label>
        )}
        {foldersError && (
          <p className="mari-chrome-text-muted px-1 text-xs" role="status">
            {localizeUi("ui.panels.profilessection.folderLoadFailed")}
          </p>
        )}
        {isLoading || foldersLoading ? (
          <div className="flex flex-col gap-2 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 && visibleFolders.length === 0 ? (
          <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">{localizeUi("search.panels.noMatches")}</p>
        ) : (
          <div data-settings-profile-list className="flex flex-col gap-1">
            {builtInProfiles.map(renderRow)}
            {builtInProfiles.length > 0 && (otherRootProfiles.length > 0 || visibleFolders.length > 0) && (
              <hr className="mx-2 my-1 border-[var(--border)]" />
            )}
            {visibleFolders.map((folder) => {
              const rows = rowsByFolder.get(folder.id) ?? [];
              return (
                <PausableLibraryFolder
                  key={folder.id}
                  folder={folder}
                  dataAttribute="data-profile-folder"
                  itemCount={folder.itemIds.length}
                  itemCountLabel={
                    rows.length === folder.itemIds.length
                      ? localizeUi("ui.panels.profilessection.folderCount", { count: rows.length })
                      : localizeUi("ui.panels.profilessection.folderFilteredCount", {
                          count: rows.length,
                          total: folder.itemIds.length,
                        })
                  }
                  deleteConfirmMessage={localizeUi("ui.panels.profilessection.deleteFolderConfirm", {
                    name: folder.name,
                  })}
                  editingFolder={editingFolder}
                  setEditingFolder={setEditingFolder}
                  updateFolder={updateFolder}
                  deleteFolder={deleteFolder}
                  onError={reportFolderError}
                  busy={busy}
                  selectionMode={selectionMode}
                  searching={Boolean(query)}
                >
                  {rows.length > 0 ? (
                    rows.map(renderRow)
                  ) : (
                    <p className="mari-chrome-text-muted px-2 py-1 text-[0.625rem]">
                      {localizeUi("ui.panels.profilessection.emptyFolder")}
                    </p>
                  )}
                </PausableLibraryFolder>
              );
            })}
            {otherRootProfiles.map(renderRow)}
          </div>
        )}
        {moveMenu}
        {selectionMode && (
          <SelectionActionBar
            placement="panel"
            selectedCount={selected.length}
            onExport={() => {
              setBusy(true);
              void exportProfiles(selected).finally(() => setBusy(false));
            }}
            onDelete={() => void handleDeleteSelected()}
            exporting={busy}
            deleteDisabled={busy}
          />
        )}
      </div>
    </>
  );
}
