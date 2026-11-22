// ──────────────────────────────────────────────
// UI overhaul: Library > Backgrounds
//
// The background library was a big window reached from Settings > Appearance and from
// Chat settings. In the new layout it is a Library page laid out like Characters: title
// with New folder and Upload, then one toolbar (search, source, tags, favourites, sort,
// list or gallery), then the folders as tiles and the pictures as cards. Clicking a
// picture opens a strip above the grid with its name, tags, "Use as default" and Delete,
// in place (no window). The chat's own picker stays a small window (BackgroundPicker).
// Data is the classic window's (/backgrounds, /backgrounds/folders), so both layouts agree.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent, type ReactNode } from "react";
import {
  Check,
  Download,
  FolderInput,
  FolderPlus,
  Pencil,
  Pin,
  Search,
  Star,
  Tag,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { BACKGROUND_THUMBNAIL_WIDTH, CHAT_IMAGE_PREVIEW_WIDTH } from "@marinara-engine/shared";
import { DEFAULT_ROLEPLAY_BACKGROUND_URL, useUIStore } from "../../stores/ui.store";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { saveExportUrl } from "../../lib/file-download";
import { avatarPreviewSrc } from "../../lib/avatar-preview";
import { getBackgroundLibraryTitle, type BackgroundLibrarySort } from "../../lib/background-library";
import { clearActiveChatResourceDrag } from "../../lib/chat-resource-drag";
import type { OwnerBackground } from "../../hooks/use-chat-gallery-owners";
import {
  useBackgroundLibrary,
  type BackgroundLibrary,
  type BackgroundLibraryFolder,
  type BackgroundLibraryItem,
} from "../panels/settings/use-background-library";
import { countItemTags, matchesPickedTags, TagFilter } from "./TagFilter";
import { ViewSwitch } from "./LibraryTables";
import {
  KitEmpty,
  KitFolderCrumb,
  KitFolderIcon,
  KitFolderTile,
  KitMoreButton,
  useKitMenu,
  type KitAction,
  type KitFolder,
} from "./LibraryKit";

type Source = "all" | "user" | "game_asset" | "characters";

/** What the detail strip shows: one of the library's pictures, or a character's gallery picture (read only). */
type Picked = { kind: "library"; id: string } | { kind: "owner"; url: string } | null;

export function BackgroundsPage() {
  const { t } = useUiTranslation();
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  const defaultRoleplayBackground = useUIStore((s) => s.defaultRoleplayBackground);
  const setDefaultRoleplayBackground = useUIStore((s) => s.setDefaultRoleplayBackground);
  const [picked, setPicked] = useState<Picked>(null);
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [listView, setListView] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const library = useBackgroundLibrary({
    // The page has no chat: "selected" is the picture open in the strip. An upload opens the new picture.
    selected: picked?.kind === "library" ? (findById(picked.id)?.url ?? null) : null,
    onSelect: (url) => {
      const match = url ? libraryRef.current?.backgrounds.find((background) => background.url === url) : null;
      setPicked(match ? { kind: "library", id: match.id } : null);
    },
    defaultRoleplayBackground,
    onDefaultChange: setDefaultRoleplayBackground,
    active: true,
  });
  const libraryRef = useRef<BackgroundLibrary | null>(null);
  libraryRef.current = library;
  function findById(id: string) {
    return libraryRef.current?.backgrounds.find((background) => background.id === id) ?? null;
  }
  const {
    backgrounds,
    folders,
    visibleBackgrounds,
    folderFilter,
    setFolderFilter,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    sourceFilter,
    setSourceFilter,
    sourceCounts,
    uploading,
    handleUpload,
    characterGroups,
    allCharactersLoading,
    allCharactersError,
    refetchAllCharacters,
    toggleFavorite,
    assignBackground,
    allowFolderDrop,
    handleFolderDrop,
    startBackgroundTouchDrag,
    draggedBackgroundId,
    handleCreateFolder,
    handleRenameActiveFolder,
    handleDeleteFolder,
  } = library;
  const menu = useKitMenu();
  const source = sourceFilter as Source;
  const openFolder = folders.find((folder) => folder.id === folderFilter) ?? null;
  const searching = !!searchQuery.trim() || pickedTags.length > 0 || favoritesOnly;
  const tagCounts = useMemo(() => countItemTags(backgrounds), [backgrounds]);
  const shown = visibleBackgrounds.filter(
    (background) => matchesPickedTags(background.tags, pickedTags) && (!favoritesOnly || background.favorite),
  );
  // At the top level the folders are tiles and only the unfiled pictures show beside them; a search or a
  // filter reaches into every folder instead.
  const loose = openFolder || searching ? shown : shown.filter((background) => !background.folderId);
  const kitFolder = (folder: BackgroundLibraryFolder): KitFolder => ({
    id: folder.id,
    name: folder.name,
    itemIds: backgrounds.filter((background) => background.folderId === folder.id).map((background) => background.id),
  });
  const folderMenu = (folder: BackgroundLibraryFolder): KitAction[] => [
    {
      key: "rename",
      label: "Rename",
      icon: <Pencil size={14} />,
      onSelect: () => void handleRenameActiveFolder(folder),
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void handleDeleteFolder(folder, kitFolder(folder).itemIds.length),
    },
  ];
  const moveSubmenu = (background: BackgroundLibraryItem): KitAction[] =>
    [{ id: "", name: localize("Not in a folder") }, ...folders.map((folder) => ({ id: folder.id, name: folder.name }))]
      .filter((target) => target.id !== (background.folderId ?? ""))
      .map((target) => ({
        key: `move:${target.id}`,
        label: target.name,
        onSelect: () => assignBackground(background.id, target.id || null),
      }));
  const cardActions = (background: BackgroundLibraryItem): KitAction[] => {
    const editable = isEditable(background);
    const isDefault = defaultRoleplayBackground === background.url;
    return [
      {
        key: "default",
        label: t(isDefault ? "library.backgrounds.removeDefault" : "library.backgrounds.useAsDefault"),
        icon: <Pin size={14} />,
        onSelect: () => setDefaultRoleplayBackground(isDefault ? DEFAULT_ROLEPLAY_BACKGROUND_URL : background.url),
      },
      {
        key: "favorite",
        label: t(
          background.favorite
            ? "ui.panels.backgroundpicker.removeFromFavorites"
            : "ui.panels.backgroundpicker.addToFavorites",
        ),
        icon: <Star size={14} />,
        onSelect: () => toggleFavorite.mutate({ backgroundId: background.id, favorite: !background.favorite }),
      },
      {
        key: "move",
        label: t("ui.panels.backgroundpicker.moveToFolder"),
        icon: <FolderInput size={14} />,
        submenu: moveSubmenu(background),
        disabled: folders.length === 0 && !background.folderId,
      },
      ...(editable
        ? [
            {
              key: "edit",
              label: t("library.backgrounds.renameOrTag"),
              icon: <Tag size={14} />,
              onSelect: () => setPicked({ kind: "library", id: background.id }),
            },
          ]
        : []),
      {
        key: "download",
        label: t("ui.panels.backgroundpicker.downloadBackground"),
        icon: <Download size={14} />,
        onSelect: () => void saveExportUrl(background.url, background.filename),
      },
      ...(editable && background.deletable !== false
        ? [
            {
              key: "delete",
              label: "Delete",
              icon: <Trash2 size={14} />,
              danger: true,
              onSelect: () => void library.handleDeleteBackground(background),
            },
          ]
        : []),
    ];
  };

  const renderThumb = (background: BackgroundLibraryItem) => (
    <img
      src={`${background.url}?w=${BACKGROUND_THUMBNAIL_WIDTH}`}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
  const sourceLabel = (background: BackgroundLibraryItem) =>
    t(
      background.source === "game_asset"
        ? "ui.panels.backgroundpicker.gameAsset"
        : "ui.panels.backgroundpicker.myUpload",
    );

  const renderCard = (background: BackgroundLibraryItem) => {
    const title = getBackgroundLibraryTitle(background);
    const on = picked?.kind === "library" && picked.id === background.id;
    const isDefault = defaultRoleplayBackground === background.url;
    const payload = { version: 1 as const, kind: "background" as const, ids: [background.url], label: title };
    const startDrag = (event: Parameters<typeof startBackgroundTouchDrag>[0]) =>
      startBackgroundTouchDrag(event, background.id, {
        chatResourcePayload: payload,
        sourceElement: (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-touch-drag-card="background"]'),
      });
    return (
      <div
        key={background.id}
        className={cn(
          "ov-card ov-bglib__card",
          on && "is-selected",
          draggedBackgroundId === background.id && "is-dragging",
        )}
        data-background-id={background.id}
        data-touch-drag-card="background"
        data-drag-id={background.id}
        data-drag-kind="background"
        data-drag-folder={background.folderId ?? ""}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onDragEnd={clearActiveChatResourceDrag}
        onContextMenu={(event) => menu.openFromEvent(event, title, cardActions(background))}
      >
        <button
          type="button"
          className="ov-card__art"
          data-drag-surface
          aria-pressed={on}
          aria-label={title}
          onClick={() => setPicked(on ? null : { kind: "library", id: background.id })}
        >
          {renderThumb(background)}
          {background.favorite ? (
            <span className="ov-bglib__fav" aria-label={t("ui.panels.backgroundpicker.favorites")}>
              <Star size={12} fill="currentColor" aria-hidden="true" />
            </span>
          ) : null}
          {isDefault ? (
            <span className="ov-bglib__badge">{t("ui.panels.backgroundpicker.roleplayDefaultShort")}</span>
          ) : null}
        </button>
        <KitMoreButton
          className="ov-card__more"
          label={localize("More actions")}
          onOpen={(event) => menu.openFromEvent(event, title, cardActions(background), "button")}
        />
        <button
          type="button"
          className="ov-card__name"
          data-drag-surface
          onClick={() => setPicked(on ? null : { kind: "library", id: background.id })}
          title={title}
        >
          <span className="ov-card__name-text">{title}</span>
        </button>
        <p className="ov-card__tags">
          {background.tags.length ? background.tags.map((tag) => `#${tag}`).join(" ") : sourceLabel(background)}
        </p>
      </div>
    );
  };

  const renderOwnerCard = (background: OwnerBackground) => {
    const on = picked?.kind === "owner" && picked.url === background.url;
    return (
      <div
        key={`${background.owner.type}:${background.imageId}`}
        className={cn("ov-card ov-bglib__card", on && "is-selected")}
      >
        <button
          type="button"
          className="ov-card__art"
          aria-pressed={on}
          aria-label={background.title}
          onClick={() => setPicked(on ? null : { kind: "owner", url: background.url })}
        >
          <img src={background.url} alt="" loading="lazy" decoding="async" draggable={false} />
        </button>
        <button
          type="button"
          className="ov-card__name"
          title={background.title}
          onClick={() => setPicked(on ? null : { kind: "owner", url: background.url })}
        >
          <span className="ov-card__name-text">{background.title}</span>
        </button>
        <p className="ov-card__tags">{background.owner.name}</p>
      </div>
    );
  };

  const pickedItem = picked?.kind === "library" ? findById(picked.id) : null;
  const pickedOwner =
    picked?.kind === "owner"
      ? (characterGroups.flatMap((group) => group.backgrounds).find((background) => background.url === picked.url) ??
        null)
      : null;

  const onUploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void handleUpload(files);
  };
  const uploadButton = (
    <button
      type="button"
      className="ov-btn ov-btn--primary"
      disabled={uploading}
      onClick={() => fileRef.current?.click()}
      aria-label={t("library.backgrounds.upload")}
    >
      <Upload size={14} aria-hidden="true" />
      {uploading
        ? t("ui.panels.backgroundpicker.importing")
        : mobile
          ? localize("Upload")
          : t("library.backgrounds.upload")}
    </button>
  );

  const emptyLibrary = source !== "characters" && backgrounds.length === 0;
  const firstOtherGroup = characterGroups.findIndex((group) => !group.inChat);

  return (
    <section
      className="ov-gallery ov-bglib"
      data-component="OverhaulBackgroundsPage"
      data-kind="backgrounds"
      data-view={listView ? "list" : "grid"}
    >
      <header className="ov-gallery__head">
        <h1 data-mari-part="page-title">{t("library.sections.backgrounds")}</h1>
        <button
          type="button"
          className={cn("ov-btn", mobile && "ov-btn--icon")}
          onClick={() => void handleCreateFolder()}
          aria-label={localize("New folder")}
          title={localize("New folder")}
        >
          <FolderPlus size={14} aria-hidden="true" />
          {mobile ? null : localize("New folder")}
        </button>
        {uploadButton}
        {mobile ? <ViewSwitch gallery={!listView} onChange={(gallery) => setListView(!gallery)} /> : null}
      </header>
      <div className="ov-gallery__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("ui.panels.backgroundpicker.searchBackgrounds")}
          />
        </label>
        <select
          className="ov-select"
          value={source}
          onChange={(event) => {
            setSourceFilter(event.target.value as Source);
            setPicked(null);
          }}
          aria-label={t("ui.panels.backgroundpicker.filterBySource")}
        >
          {(
            [
              ["all", "ui.panels.backgroundpicker.allSources"],
              ["user", "ui.panels.backgroundpicker.myUploads"],
              ["game_asset", "ui.panels.backgroundpicker.gameAssets"],
              ["characters", "ui.panels.backgroundpicker.characters"],
            ] as const
          ).map(([value, key]) => (
            <option key={value} value={value}>
              {sourceCounts[value] !== null ? `${t(key)} (${sourceCounts[value]})` : t(key)}
            </option>
          ))}
        </select>
        {source !== "characters" && (tagCounts.tags.length || pickedTags.length) ? (
          <TagFilter tags={tagCounts.tags} untagged={tagCounts.untagged} picked={pickedTags} onChange={setPickedTags} />
        ) : null}
        {source !== "characters" ? (
          <button
            type="button"
            className={cn("ov-btn", favoritesOnly && "is-on", mobile && "ov-btn--icon")}
            aria-pressed={favoritesOnly}
            aria-label={t("ui.panels.backgroundpicker.favorites")}
            title={t("ui.panels.backgroundpicker.favorites")}
            onClick={() => setFavoritesOnly((value) => !value)}
          >
            {mobile ? <Star size={15} aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} /> : null}
            {mobile ? null : t("ui.panels.backgroundpicker.favorites")}
          </button>
        ) : null}
        <span className="ov-gallery__spacer" />
        {source !== "characters" ? (
          <select
            className="ov-select"
            value={library.manualOrderActive ? "custom" : sort}
            onChange={(event) => {
              const value = event.target.value;
              library.manualOrder.setActive(value === "custom");
              library.folderDrag.setActive(value === "custom");
              if (value !== "custom") setSort(value as BackgroundLibrarySort);
            }}
            aria-label={t("ui.panels.backgroundpicker.sortBackgrounds")}
          >
            <option value="name-asc">{localize("A to Z")}</option>
            <option value="name-desc">{localize("Z to A")}</option>
            <option value="newest">{localize("Newest")}</option>
            <option value="oldest">{localize("Oldest")}</option>
            <option value="custom">{localize("My order")}</option>
          </select>
        ) : null}
        {mobile ? null : <ViewSwitch gallery={!listView} onChange={(gallery) => setListView(!gallery)} />}
      </div>

      {pickedItem ? (
        <BackgroundDetail
          key={pickedItem.id}
          library={library}
          background={pickedItem}
          isDefault={defaultRoleplayBackground === pickedItem.url}
          onDefault={(on) => setDefaultRoleplayBackground(on ? pickedItem.url : DEFAULT_ROLEPLAY_BACKGROUND_URL)}
          onClose={() => setPicked(null)}
        />
      ) : pickedOwner ? (
        <OwnerDetail
          background={pickedOwner}
          isDefault={defaultRoleplayBackground === pickedOwner.url}
          onDefault={(on) => setDefaultRoleplayBackground(on ? pickedOwner.url : DEFAULT_ROLEPLAY_BACKGROUND_URL)}
          onClose={() => setPicked(null)}
        />
      ) : null}

      {source === "characters" ? (
        <>
          {characterGroups.map((group, index) => (
            <section key={`${group.owner.type}:${group.owner.id}`} className="ov-bglib__owner">
              {index === firstOtherGroup && index > 0 ? (
                <p className="ov-bglib__rule">{t("ui.panels.backgroundpicker.otherCharacters")}</p>
              ) : null}
              <h2 className="ov-bglib__ownerhead">
                <span className="ov-bglib__avatar">
                  {group.owner.avatarPath ? (
                    <img
                      src={avatarPreviewSrc(group.owner.avatarPath, "row")}
                      alt=""
                      loading="lazy"
                      style={getAvatarCropStyle(group.owner.avatarCrop)}
                    />
                  ) : (
                    <User size={12} aria-hidden="true" />
                  )}
                </span>
                <span>{group.owner.name}</span>
                <small>{group.backgrounds.length}</small>
              </h2>
              <div className="ov-gallery__grid ov-bglib__grid">{group.backgrounds.map(renderOwnerCard)}</div>
            </section>
          ))}
          {allCharactersLoading && characterGroups.length === 0 ? (
            <p className="ov-gallery__note">{localize("Loading…")}</p>
          ) : null}
          {allCharactersError ? (
            <p className="ov-gallery__note">
              {t("ui.panels.backgroundpicker.characterBackgroundsFailed")}{" "}
              <button type="button" className="ov-btn" onClick={() => refetchAllCharacters()}>
                {t("ui.panels.backgroundpicker.retry")}
              </button>
            </p>
          ) : null}
          {!allCharactersLoading && !allCharactersError && characterGroups.length === 0 ? (
            <KitEmpty
              title={
                searchQuery.trim()
                  ? t("ui.panels.backgroundpicker.noBackgroundsMatchThoseFilters")
                  : t("ui.panels.backgroundpicker.noCharacterBackgrounds")
              }
              text={searchQuery.trim() ? undefined : t("ui.panels.backgroundpicker.characterBackgroundsHint")}
            />
          ) : null}
        </>
      ) : emptyLibrary ? (
        <KitEmpty
          title={t("ui.panels.backgroundpicker.noBackgroundsAvailableYet")}
          text={t("library.backgrounds.emptyHint")}
          action={uploadButton}
        />
      ) : listView ? (
        <BackgroundTable
          rows={loose}
          folders={openFolder || searching ? [] : folders}
          library={library}
          openFolder={openFolder}
          pickedId={picked?.kind === "library" ? picked.id : null}
          onPick={(id) => setPicked(picked?.kind === "library" && picked.id === id ? null : { kind: "library", id })}
          onOpenFolder={(id) => setFolderFilter(id)}
          onBack={() => setFolderFilter("all")}
          renderThumb={renderThumb}
          sourceLabel={sourceLabel}
          onRowMenu={(event, background) =>
            menu.openFromEvent(event, getBackgroundLibraryTitle(background), cardActions(background), "button")
          }
          onFolderMenu={(event, folder) => menu.openFromEvent(event, folder.name, folderMenu(folder), "button")}
        />
      ) : (
        <div className="ov-gallery__grid ov-bglib__grid" data-size="medium">
          {openFolder ? (
            <div className="ov-kit-folder-cell" data-background-folder-root="">
              <KitFolderCrumb
                backLabel={t("library.sections.backgrounds")}
                folder={kitFolder(openFolder)}
                count={shown.length}
                onBack={() => setFolderFilter("all")}
                onMenu={(event, anchor) => menu.openFromEvent(event, openFolder.name, folderMenu(openFolder), anchor)}
              />
            </div>
          ) : null}
          {!openFolder && !searching
            ? library.folderDrag.orderItems(folders).map((folder) => {
                const members = backgrounds.filter((background) => background.folderId === folder.id);
                return (
                  <FolderDrop
                    key={folder.id}
                    onDragOver={allowFolderDrop}
                    onDrop={(event) => handleFolderDrop(event, folder.id)}
                  >
                    <KitFolderTile
                      folder={kitFolder(folder)}
                      count={members.length}
                      dragKind="background"
                      previews={members.slice(0, 4).map((background) => (
                        <img key={background.id} src={`${background.url}?w=${BACKGROUND_THUMBNAIL_WIDTH}`} alt="" />
                      ))}
                      onOpen={() => {
                        setPicked(null);
                        setFolderFilter(folder.id);
                      }}
                      onMenu={(event, anchor) => menu.openFromEvent(event, folder.name, folderMenu(folder), anchor)}
                    />
                  </FolderDrop>
                );
              })
            : null}
          {loose.map(renderCard)}
          {loose.length === 0 && (searching || openFolder) ? (
            <p className="ov-gallery__note ov-kit-folder-cell">
              {searching
                ? t("ui.panels.backgroundpicker.noBackgroundsMatchThoseFilters")
                : t("library.backgrounds.emptyFolder")}
            </p>
          ) : null}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onUploadFiles} />
      {menu.node}
    </section>
  );
}

function isEditable(background: BackgroundLibraryItem) {
  return background.editable !== false && background.source !== "game_asset";
}

/** Folder tiles take dragged pictures (desktop drag); touch and mouse drags find them by data attribute. */
function FolderDrop({
  children,
  onDragOver,
  onDrop,
}: {
  children: ReactNode;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}) {
  return (
    <div className="ov-bglib__drop" onDragOver={onDragOver} onDrop={onDrop}>
      {children}
    </div>
  );
}

/** List view: one row per picture (thumbnail, name, where from, tags, folder). */
function BackgroundTable({
  rows,
  folders,
  library,
  openFolder,
  pickedId,
  onPick,
  onOpenFolder,
  onBack,
  renderThumb,
  sourceLabel,
  onRowMenu,
  onFolderMenu,
}: {
  rows: BackgroundLibraryItem[];
  folders: BackgroundLibraryFolder[];
  library: BackgroundLibrary;
  openFolder: BackgroundLibraryFolder | null;
  pickedId: string | null;
  onPick: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onBack: () => void;
  renderThumb: (background: BackgroundLibraryItem) => ReactNode;
  sourceLabel: (background: BackgroundLibraryItem) => string;
  onRowMenu: (event: MouseEvent<HTMLElement>, background: BackgroundLibraryItem) => void;
  onFolderMenu: (event: MouseEvent<HTMLElement>, folder: BackgroundLibraryFolder) => void;
}) {
  const { t } = useUiTranslation();
  const localize = useLocalizedUiText();
  return (
    <div className="ov-table-wrap ov-bglib__table">
      {openFolder ? (
        <div className="ov-cl__crumb" data-background-folder-root="">
          <KitFolderCrumb
            backLabel={t("library.sections.backgrounds")}
            folder={{ id: openFolder.id, name: openFolder.name, itemIds: rows.map((row) => row.id) }}
            count={rows.length}
            onBack={onBack}
            onMenu={(event) => onFolderMenu(event, openFolder)}
          />
        </div>
      ) : null}
      <table className="ov-table">
        <thead>
          <tr>
            <th className="ov-table__lead" aria-hidden="true" />
            <th className="ov-table__name">{localize("Name")}</th>
            <th>{t("library.backgrounds.source")}</th>
            <th>{localize("Tags")}</th>
            <th className="ov-table__more" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => {
            const count = library.backgrounds.filter((background) => background.folderId === folder.id).length;
            return (
              <tr
                key={`folder:${folder.id}`}
                className="ov-table__folder"
                data-background-folder-id={folder.id}
                data-ov-folder-id={folder.id}
                onDragOver={library.allowFolderDrop}
                onDrop={(event) => library.handleFolderDrop(event, folder.id)}
                onClick={() => onOpenFolder(folder.id)}
              >
                <td className="ov-table__lead">
                  <KitFolderIcon folder={{ id: folder.id, name: folder.name, itemIds: [] }} />
                </td>
                <td className="ov-table__name">{folder.name}</td>
                <td>{t("ui.overhaul.kit.itemCount", { count })}</td>
                <td />
                <td className="ov-table__more">
                  <KitMoreButton label={localize("Folder actions")} onOpen={(event) => onFolderMenu(event, folder)} />
                </td>
              </tr>
            );
          })}
          {rows.map((background) => {
            const title = getBackgroundLibraryTitle(background);
            return (
              <tr
                key={background.id}
                className={cn(pickedId === background.id && "is-on")}
                aria-selected={pickedId === background.id}
                onClick={() => onPick(background.id)}
                onContextMenu={(event) => onRowMenu(event, background)}
              >
                <td className="ov-table__lead">
                  <span className="ov-thumb ov-bglib__thumb">{renderThumb(background)}</span>
                </td>
                <td className="ov-table__name" title={title}>
                  {background.favorite ? (
                    <Star size={11} fill="currentColor" className="ov-bglib__rowfav" aria-hidden="true" />
                  ) : null}
                  {title}
                </td>
                <td>{sourceLabel(background)}</td>
                <td>
                  <span className="ov-table__clip">
                    {background.tags.length ? background.tags.map((tag) => `#${tag}`).join(" ") : "—"}
                  </span>
                </td>
                <td className="ov-table__more">
                  <KitMoreButton label={localize("More actions")} onOpen={(event) => onRowMenu(event, background)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && folders.length === 0 ? (
        <p className="ov-list__empty">{t("ui.panels.backgroundpicker.noBackgroundsMatchThoseFilters")}</p>
      ) : null}
    </div>
  );
}

/** The open picture, in place above the grid: preview, name, tags and what it is used for. */
function BackgroundDetail({
  library,
  background,
  isDefault,
  onDefault,
  onClose,
}: {
  library: BackgroundLibrary;
  background: BackgroundLibraryItem;
  isDefault: boolean;
  onDefault: (on: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useUiTranslation();
  const localize = useLocalizedUiText();
  const editable = isEditable(background);
  const title = getBackgroundLibraryTitle(background);
  const [name, setName] = useState(background.filename.replace(/\.[^.]+$/, ""));
  const [tag, setTag] = useState("");
  const renamed = name.trim() && name.trim() !== background.filename.replace(/\.[^.]+$/, "");
  const suggestions = library.allTags.filter((each) => !background.tags.includes(each));
  return (
    <div className="ov-bglib__detail" data-component="BackgroundDetail" role="region" aria-label={title}>
      <img
        className="ov-bglib__preview"
        src={`${background.url}?w=${CHAT_IMAGE_PREVIEW_WIDTH}`}
        alt=""
        decoding="async"
      />
      <div className="ov-bglib__fields">
        {editable ? (
          <form
            className="ov-bglib__line"
            onSubmit={(event) => {
              event.preventDefault();
              if (renamed) library.renameBackground.mutate({ filename: background.filename, name: name.trim() });
            }}
          >
            <input
              className="ov-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={t("ui.panels.backgroundpicker.renameValue1", { value1: title })}
              placeholder={t("ui.panels.backgroundpicker.backgroundNamePlaceholder")}
            />
            <button type="submit" className="ov-btn" disabled={!renamed || library.renameBackground.isPending}>
              {localize("Rename")}
            </button>
          </form>
        ) : (
          <h2 className="ov-bglib__title" title={title}>
            {title}
          </h2>
        )}
        <p className="ov-bglib__meta">
          {t(
            background.source === "game_asset"
              ? "ui.panels.backgroundpicker.gameAsset"
              : "ui.panels.backgroundpicker.myUpload",
          )}
          {background.folderId
            ? ` · ${library.folders.find((folder) => folder.id === background.folderId)?.name ?? ""}`
            : ""}
        </p>
        {editable ? (
          <div className="ov-bglib__tags" role="group" aria-label={localize("Tags")}>
            {background.tags.map((each) => (
              <button
                key={each}
                type="button"
                className="ov-chip"
                onClick={() => void library.removeTag(background.filename, background.tags, each)}
                disabled={library.updateTags.isPending}
                aria-label={t("ui.panels.backgroundpicker.removeTagValue1", { value1: each })}
                title={t("ui.panels.backgroundpicker.removeTagValue1", { value1: each })}
              >
                #{each}
                <X size={11} aria-hidden="true" />
              </button>
            ))}
            <form
              className="ov-bglib__tagform"
              onSubmit={(event) => {
                event.preventDefault();
                if (!tag.trim()) return;
                void library.addTag(background.filename, background.tags, tag);
                setTag("");
              }}
            >
              <input
                className="ov-input"
                value={tag}
                list={`bglib-tags-${background.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                onChange={(event) => setTag(event.target.value)}
                placeholder={t("ui.panels.backgroundpicker.addTag")}
                aria-label={t("ui.panels.backgroundpicker.addTag")}
              />
              <datalist id={`bglib-tags-${background.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}>
                {suggestions.map((each) => (
                  <option key={each} value={each} />
                ))}
              </datalist>
            </form>
          </div>
        ) : background.tags.length ? (
          <p className="ov-bglib__meta">{background.tags.map((each) => `#${each}`).join(" ")}</p>
        ) : null}
        <div className="ov-bglib__actions">
          <button
            type="button"
            className={cn("ov-btn", isDefault && "is-on")}
            aria-pressed={isDefault}
            onClick={() => onDefault(!isDefault)}
          >
            {isDefault ? <Check size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
            {t(isDefault ? "library.backgrounds.isDefault" : "library.backgrounds.useAsDefault")}
          </button>
          <button
            type="button"
            className={cn("ov-btn ov-btn--icon", background.favorite && "is-on")}
            aria-pressed={!!background.favorite}
            title={t(
              background.favorite
                ? "ui.panels.backgroundpicker.removeFromFavorites"
                : "ui.panels.backgroundpicker.addToFavorites",
            )}
            aria-label={t(
              background.favorite
                ? "ui.panels.backgroundpicker.removeFromFavorites"
                : "ui.panels.backgroundpicker.addToFavorites",
            )}
            onClick={() =>
              library.toggleFavorite.mutate({ backgroundId: background.id, favorite: !background.favorite })
            }
          >
            <Star size={14} aria-hidden="true" fill={background.favorite ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className="ov-btn ov-btn--icon"
            title={t("ui.panels.backgroundpicker.downloadBackground")}
            aria-label={t("ui.panels.backgroundpicker.downloadBackground")}
            onClick={() => void saveExportUrl(background.url, background.filename)}
          >
            <Download size={14} aria-hidden="true" />
          </button>
          {library.folders.length || background.folderId ? (
            <select
              className="ov-select"
              value={background.folderId ?? ""}
              onChange={(event) => library.assignBackground(background.id, event.target.value || null)}
              aria-label={t("ui.panels.backgroundpicker.moveToFolder")}
            >
              <option value="">{localize("Not in a folder")}</option>
              {library.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          ) : null}
          <span className="ov-bglib__gap" />
          {editable && background.deletable !== false ? (
            <button
              type="button"
              className="ov-btn ov-btn--danger"
              onClick={() => void library.handleDeleteBackground(background)}
            >
              <Trash2 size={14} aria-hidden="true" />
              {localize("Delete")}
            </button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="ov-btn ov-btn--icon ov-bglib__close"
        onClick={onClose}
        aria-label={localize("Close")}
        title={localize("Close")}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

/** A character's or persona's gallery picture: it belongs to them, so it can only be used, not edited here. */
function OwnerDetail({
  background,
  isDefault,
  onDefault,
  onClose,
}: {
  background: OwnerBackground;
  isDefault: boolean;
  onDefault: (on: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useUiTranslation();
  const localize = useLocalizedUiText();
  return (
    <div className="ov-bglib__detail" data-component="BackgroundDetail" role="region" aria-label={background.title}>
      <img className="ov-bglib__preview" src={background.url} alt="" decoding="async" />
      <div className="ov-bglib__fields">
        <h2 className="ov-bglib__title">{background.title}</h2>
        <p className="ov-bglib__meta">{t("library.backgrounds.fromGallery", { name: background.owner.name })}</p>
        <div className="ov-bglib__actions">
          <button
            type="button"
            className={cn("ov-btn", isDefault && "is-on")}
            aria-pressed={isDefault}
            onClick={() => onDefault(!isDefault)}
          >
            {isDefault ? <Check size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
            {t(isDefault ? "library.backgrounds.isDefault" : "library.backgrounds.useAsDefault")}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="ov-btn ov-btn--icon ov-bglib__close"
        onClick={onClose}
        aria-label={localize("Close")}
        title={localize("Close")}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
