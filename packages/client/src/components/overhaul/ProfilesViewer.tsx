// ──────────────────────────────────────────────
// UI overhaul: Library > Settings profiles
//
// Chat settings profiles (saved chat settings that new chats start with, or
// that existing chats take on) get their own Library section, so they can be
// looked through and edited without opening a chat first. The list sits on
// the left like Regex scripts and Custom tools: your folders, then the loose
// profiles by chat mode, each mode's built-in Default first. The open profile
// edits on the right in the same builder Chat settings uses.
// Data is the classic Presets panel's Profiles tab (/chat-presets, folder
// scope "profiles"), so both layouts agree.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { CheckSquare, Copy, Download, FolderPlus, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { ChatPreset } from "@marinara-engine/shared";
import { IMAGE_SETTINGS_PROFILE_ID, useUIStore } from "../../stores/ui.store";
import {
  useChatPresets,
  useDeleteChatPreset,
  useDuplicateChatPreset,
  useImportChatPreset,
  useSetActiveChatPreset,
} from "../../hooks/use-chat-presets";
import { api } from "../../lib/api-client";
import { showAlertDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { isProfileMode, newProfileDetailId, PROFILE_MODES, type ProfileMode } from "../presets/profile-detail-id";
import { OvViewer, type OvViewerGroup, type OvViewerKit, type OvViewerRow } from "./LibraryViewers";
import { openLibrarySection } from "./library-navigation";
import {
  folderActions,
  kitDelete,
  moveToFolderAction,
  useKitMenu,
  useKitRowDrag,
  useKitSelection,
  useScopeFolders,
  useSuppressClick,
  type KitAction,
} from "./LibraryKit";

type ModeFilter = "all" | ProfileMode;

/** Export one file per profile: the server's export leaves out this install's own addresses and keys. */
export async function exportProfiles(profiles: ChatPreset[], failedText: (count: number) => string) {
  let failed = 0;
  for (const profile of profiles) {
    try {
      await api.download(`/chat-presets/${profile.id}/export`, `${profile.name}.marinara-settings-profile.json`);
    } catch {
      failed += 1;
    }
  }
  if (failed > 0) toast.error(failedText(failed));
}

/** The star on a row: which profile new chats of that mode start with. One per mode; picking another moves it. */
function NewChatsStar({ profile, onSet }: { profile: ChatPreset; onSet: () => void }) {
  const { t } = useTranslation();
  const label = t(
    profile.isActive ? "chat.settingsProfile.default.current" : "chat.settingsProfile.default.markForMode",
  );
  return (
    <button
      type="button"
      className={cn("ov-prof-star", profile.isActive && "is-on")}
      aria-pressed={profile.isActive}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        if (!profile.isActive) onSet();
      }}
    >
      <Star size={14} aria-hidden="true" />
    </button>
  );
}

export function OvProfilesViewer({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { t } = useTranslation();
  const { data } = useChatPresets();
  const deleteProfile = useDeleteChatPreset();
  const duplicateProfile = useDuplicateChatPreset();
  const importProfile = useImportChatPreset();
  const setActiveProfile = useSetActiveChatPreset();
  const selectedId = useUIStore((s) => s.profileDetailId);
  const openProfileDetail = useUIStore((s) => s.openProfileDetail);
  const closeProfileDetail = useUIStore((s) => s.closeProfileDetail);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const folders = useScopeFolders("profiles", localize("profiles"));

  const modeLabel = (mode: string) => t(`chat.settingsProfile.builder.mode.${mode}`);
  const profiles = useMemo(
    () =>
      ((data ?? []) as ChatPreset[])
        // Game chats have no profiles.
        .filter((profile) => isProfileMode(profile.mode))
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name)),
    [data],
  );
  const byId = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  const needle = search.trim().toLowerCase();
  const matches = (profile: ChatPreset) =>
    (modeFilter === "all" || profile.mode === modeFilter) && (!needle || profile.name.toLowerCase().includes(needle));
  const toRow = (profile: ChatPreset, inModeGroup: boolean): OvViewerRow => ({
    id: profile.id,
    name: profile.name,
    // Under a mode heading the mode goes without saying; in a folder (modes mixed) it's said.
    sub:
      [
        profile.isDefault ? t("presets.library.builtIn") : null,
        inModeGroup ? null : modeLabel(profile.mode),
        profile.isActive ? t("ui.panels.profilessection.newChatsDefault") : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    trail: <NewChatsStar profile={profile} onSet={() => setActiveProfile.mutate(profile.id)} />,
  });

  // Image settings first: every chat's picture defaults (styles, sizes, templates), opened as its own page.
  const groups: OvViewerGroup[] = [];
  const imageLabel = t("imageSettings.title");
  if (modeFilter === "all" && (!needle || imageLabel.toLowerCase().includes(needle)))
    groups.push({
      id: "images",
      label: t("imageSettings.group"),
      rows: [{ id: IMAGE_SETTINGS_PROFILE_ID, name: imageLabel, sub: t("imageSettings.rowSub") }],
    });
  // Your folders, which can mix modes, then the loose profiles under their chat mode.
  const filed = new Set<string>();
  const filtering = !!needle || modeFilter !== "all";
  for (const folder of folders.folders) {
    const members = folder.itemIds.map((id) => byId.get(id)).filter((profile): profile is ChatPreset => !!profile);
    members.forEach((profile) => filed.add(profile.id));
    const rows = members.filter(matches).map((profile) => toRow(profile, false));
    if (filtering && !rows.length) continue;
    groups.push({
      id: `folder:${folder.id}`,
      label: folder.name,
      rows,
      folder: {
        dropId: folder.id,
        dragKind: "profile",
        closed: folders.isCollapsed(folder),
        onToggle: () => folders.toggleCollapsed(folder),
        menu: folderActions(folders, folder),
      },
    });
  }
  for (const mode of PROFILE_MODES) {
    if (modeFilter !== "all" && modeFilter !== mode) continue;
    groups.push({
      id: `mode:${mode}`,
      label: modeLabel(mode),
      rows: profiles
        .filter((profile) => profile.mode === mode && !filed.has(profile.id) && matches(profile))
        .map((profile) => toRow(profile, true)),
    });
  }

  const visibleIds = groups
    .flatMap((group) => group.rows.map((row) => row.id))
    .filter((id) => id !== IMAGE_SETTINGS_PROFILE_ID);
  // The built-in Defaults can't be deleted, so Select skips them.
  const selection = useKitSelection(visibleIds.filter((id) => !byId.get(id)?.isDefault));
  const menu = useKitMenu();
  const suppress = useSuppressClick();
  const failedExport = (count: number) => t("ui.panels.profilessection.exportFailed", { count });
  const removeMany = async (ids: string[], names?: string) => {
    const deletable = ids.filter((id) => byId.get(id) && !byId.get(id)!.isDefault);
    const failed = await kitDelete(deletable, (id) => deleteProfile.mutateAsync(id), {
      noun: localize("profiles"),
      localize,
      names,
    });
    if (failed && selectedId && deletable.includes(selectedId) && !failed.includes(selectedId)) closeProfileDetail();
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const duplicate = (profile: ChatPreset) =>
    void duplicateProfile
      .mutateAsync({
        id: profile.id,
        name: t("ui.panels.profilessection.copyName", { name: profile.name }).slice(0, 120),
      })
      .then((copy) => {
        toast.success(t("ui.overhaul.text.copiedName", { name: profile.name }));
        if (copy?.id) openProfileDetail(copy.id);
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : t("chat.settingsProfile.saveFailed")),
      );

  const rowActions = (profile: ChatPreset): KitAction[] => [
    {
      key: "new-chats",
      label: t("ui.overhaul.profiles.useForNewChats"),
      icon: <Star size={14} />,
      disabled: profile.isActive,
      onSelect: () => setActiveProfile.mutate(profile.id),
    },
    { key: "dup", label: "Duplicate", icon: <Copy size={14} />, onSelect: () => duplicate(profile) },
    moveToFolderAction(folders, () => [profile.id], folders.folderOf(profile.id)),
    ...(profile.isDefault
      ? []
      : [
          {
            key: "export",
            label: "Export",
            icon: <Upload size={14} />,
            onSelect: () => void exportProfiles([profile], failedExport),
          },
          {
            key: "select",
            label: "Select",
            icon: <CheckSquare size={14} />,
            onSelect: () => selection.start(profile.id),
          },
          {
            key: "delete",
            label: "Delete",
            icon: <Trash2 size={14} />,
            danger: true,
            onSelect: () => void removeMany([profile.id], `"${profile.name}"`),
          },
        ]),
  ];
  const dragProps = useKitRowDrag({
    kind: "profile",
    folders,
    selection,
    suppress,
    onHold: (id) => {
      const profile = byId.get(id);
      if (profile) menu.open(profile.name, rowActions(profile), { x: 0, y: 0 });
    },
  });
  const kit: OvViewerKit = {
    selection,
    menu,
    blocked: suppress.blocked,
    rowDrag: needle ? undefined : (id, folderId) => dragProps(id, folderId),
    rowMenu: (id) => {
      const profile = byId.get(id);
      return profile ? { title: profile.name, actions: rowActions(profile) } : null;
    },
    bulkActions: [
      moveToFolderAction(folders, () => selection.list, null),
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () =>
          void exportProfiles(
            selection.list.map((id) => byId.get(id)).filter((profile): profile is ChatPreset => !!profile),
            failedExport,
          ),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => void removeMany(selection.list),
      },
    ],
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // the same file can come in again
    if (!file) return;
    try {
      const created = await importProfile.mutateAsync(JSON.parse(await file.text()));
      if (created?.name) {
        toast.success(t("ui.panels.profilessection.imported", { name: created.name }));
        openProfileDetail(created.id);
      }
    } catch (error) {
      await showAlertDialog({
        title: t("chat.settingsProfile.import.failedTitle"),
        message: t("chat.settingsProfile.import.failedWithReason", {
          reason: error instanceof Error ? error.message : t("chat.settingsProfile.import.invalidFile"),
        }),
        tone: "destructive",
      });
    }
  };

  const counts = PROFILE_MODES.map(
    (mode) => `${profiles.filter((profile) => profile.mode === mode).length} ${modeLabel(mode).toLowerCase()}`,
  ).join(" · ");
  // + New makes a profile for the mode the filter shows (Roleplay while it shows both).
  const newMode: ProfileMode = modeFilter === "all" ? "roleplay" : modeFilter;

  return (
    <OvViewer
      className="ov-vw--drill ov-vw--profiles"
      title={localize("Settings profiles")}
      meta={counts}
      tools={[
        { label: localize("Import"), icon: Download, onClick: () => fileRef.current?.click() },
        { label: localize("New folder"), icon: FolderPlus, onClick: folders.create, compact: true },
      ]}
      listLabel={t("ui.panels.profilessection.profiles")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={t("search.panels.profiles")}
      findExtra={
        <select
          className="ov-vw__filter"
          value={modeFilter}
          onChange={(event) => setModeFilter(event.target.value as ModeFilter)}
          aria-label={t("chat.settingsProfile.builder.modeLabel")}
        >
          <option value="all">{localize("All")}</option>
          {PROFILE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {modeLabel(mode)}
            </option>
          ))}
        </select>
      }
      newLabel={t("ui.overhaul.profiles.newProfile")}
      newShortLabel={localize("New")}
      onNew={() => openProfileDetail(newProfileDetailId(newMode))}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => openProfileDetail(id)}
      kit={kit}
      emptyList={t("ui.overhaul.profiles.empty")}
      emptyText={t("ui.panels.profilessection.hint")}
      emptyDetail={t("ui.overhaul.profiles.pick")}
      onSection={() => openLibrarySection("profiles")}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => void handleImport(event)}
      />
      {children}
    </OvViewer>
  );
}
