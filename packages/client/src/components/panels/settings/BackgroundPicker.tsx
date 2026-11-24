import { useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Folder,
  FolderInput,
  FolderPlus,
  Image,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  Search,
  Star,
  Tag,
  Trash2,
  Download,
  User,
  X,
} from "lucide-react";
import { BACKGROUND_THUMBNAIL_WIDTH, CHAT_IMAGE_PREVIEW_WIDTH } from "@marinara-engine/shared";
import { saveExportUrl } from "../../../lib/file-download";
import { cn, getAvatarCropStyle } from "../../../lib/utils";
import { librarySortOptions } from "../../../lib/library-sort-options";
import { avatarPreviewSrc } from "../../../lib/avatar-preview";
import { getBackgroundLibraryTitle, type BackgroundLibrarySort } from "../../../lib/background-library";
import { DEFAULT_ROLEPLAY_BACKGROUND_URL, useUIStore } from "../../../stores/ui.store";
import { useChatOwnerBackgrounds, type OwnerBackground } from "../../../hooks/use-chat-gallery-owners";
import { useChat } from "../../../hooks/use-chats";
import { useChatStore } from "../../../stores/chat.store";
import { useGameAssetStore } from "../../../stores/game-asset.store";
import { Spinner } from "../../ui/Spinner";
import { ImageUploadDropzone } from "../../ui/ImageUploadDropzone";
import { Modal } from "../../ui/Modal";
import { useOverhaulLook } from "../../../stores/overhaul.store";
import { openLibrarySection } from "../../overhaul/library-navigation";
import { useBackgroundLibrary, type BackgroundLibraryItem } from "./use-background-library";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../../lib/chat-resource-drag";
import { ChatResourceActionButton } from "../../chat/ChatResourceActionButton";
import { ContextMenu, type ContextMenuItem } from "../../ui/ContextMenu";
import { Select } from "../../ui/Select";
import {
  SETTINGS_BUTTON_CLASS,
  SETTINGS_ICON_BUTTON_CLASS,
  SETTINGS_PRIMARY_FULL_BUTTON_CLASS,
} from "./SettingControls";

type BackgroundPickerProps = {
  selected: string | null;
  sceneBackgroundTag?: string | null;
  chatFloatingPanel?: boolean;
  showRoleplayDefault?: boolean;
  onSelect: (url: string | null) => void;
  defaultRoleplayBackground: string;
  onDefaultChange: (url: string) => void;
  /**
   * Pictures labeled "background" in the galleries of the chat's characters and persona.
   * Leave it out where there is no chat: the library's Characters source then shows every character.
   */
  ownerBackgrounds?: OwnerBackground[];
  /** Replaces the preview, recent picks and Browse button with a custom opener (the library window stays). */
  trigger?: (openLibrary: () => void) => ReactNode;
};

const CARD_TEXT_FIELD_CLASS =
  "min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[0.6875rem] max-sm:!text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)]";

/**
 * The rename input keeps its draft here rather than in the picker, so typing a name
 * re-renders one card instead of every card in the grid.
 */
function CardNameForm({
  initialValue,
  ariaLabel,
  placeholder,
  saveLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  ariaLabel: string;
  placeholder: string;
  saveLabel: string;
  pending: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      className="flex min-w-0 items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
      }}
    >
      <input
        type="text"
        value={value}
        maxLength={100}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onCancel();
        }}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={CARD_TEXT_FIELD_CLASS}
        autoFocus
      />
      <button type="submit" disabled={pending} className={SETTINGS_BUTTON_CLASS}>
        {saveLabel}
      </button>
    </form>
  );
}

/** Same reason as CardNameForm: the tag draft belongs to the card that is being edited. */
function CardTagInput({
  suggestions,
  datalistId,
  placeholder,
  addLabel,
  pending,
  onAdd,
  onCancel,
}: {
  suggestions: string[];
  datalistId: string;
  placeholder: string;
  addLabel: string;
  pending: boolean;
  onAdd: (tag: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };

  return (
    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[0.6875rem] max-sm:!text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        data-background-tag-input
        autoFocus
        list={datalistId}
      />
      <datalist id={datalistId}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <button type="button" onClick={submit} disabled={!value.trim() || pending} className={SETTINGS_BUTTON_CLASS}>
        {addLabel}
      </button>
    </div>
  );
}

/** ChatArea already restores and persists this active-chat selection for every picker/agent. */
export function ActiveChatBackgroundPicker({ game = false }: { game?: boolean }) {
  const selected = useUIStore((state) => state.chatBackground);
  const onSelect = useUIStore((state) => state.setChatBackground);
  const defaultBackground = useUIStore((state) => state.defaultRoleplayBackground);
  const onDefaultChange = useUIStore((state) => state.setDefaultRoleplayBackground);
  const sceneBackgroundTag = useGameAssetStore((state) => (game ? state.currentBackground : null));
  const activeChatId = useChatStore((state) => state.activeChatId);
  const { data: activeChat } = useChat(activeChatId);
  const ownerBackgrounds = useChatOwnerBackgrounds(activeChat);
  return (
    <BackgroundPicker
      ownerBackgrounds={ownerBackgrounds}
      chatFloatingPanel
      showRoleplayDefault={!game}
      selected={selected}
      sceneBackgroundTag={sceneBackgroundTag}
      onSelect={onSelect}
      defaultRoleplayBackground={defaultBackground}
      onDefaultChange={onDefaultChange}
    />
  );
}

export function BackgroundPicker({
  selected,
  chatFloatingPanel = false,
  showRoleplayDefault = true,
  sceneBackgroundTag,
  onSelect,
  defaultRoleplayBackground,
  onDefaultChange,
  ownerBackgrounds: chatOwnerBackgrounds,
  trigger,
}: BackgroundPickerProps) {
  const library = useBackgroundLibrary({
    selected,
    sceneBackgroundTag,
    onSelect,
    defaultRoleplayBackground,
    onDefaultChange,
    ownerBackgrounds: chatOwnerBackgrounds,
  });
  const {
    hasChat,
    ownerBackgrounds,
    manualOrder,
    folderDrag,
    showAllCharacters,
    draggedBackgroundIdRef,
    modalContentRef,
    updateTags,
    renameBackground,
    createFolder,
    toggleFavorite,
    includedTags,
    allTags,
    visibleBackgrounds,
    activeFolder,
    previewUrl,
    selectedBackground,
    selectedOwnerBackground,
    characterGroups,
    recentBackgrounds,
    sourceCounts,
    cancelPendingClose,
    selectBackground,
    closePicker,
    handleUpload,
    addTag,
    removeTag,
    handleCreateFolder,
    handleRenameActiveFolder,
    handleDeleteFolder,
    handleMoveBackground,
    handleFolderDrop,
    allowFolderDrop,
    handleDeleteBackground,
    toggleIncludedTag,
    open,
    setOpen,
    pendingSelection,
    uploading,
    editingTags,
    setEditingTags,
    renamingFile,
    setRenamingFile,
    cardMenu,
    setCardMenu,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    sourceFilter,
    setSourceFilter,
    characterScope,
    setCharacterScope,
    folderFilter,
    setFolderFilter,
    setIncludedTagValues,
    tagsExpanded,
    setTagsExpanded,
    draggedBackgroundId,
    setDraggedBackgroundId,
    manualOrderActive,
    localizeUi,
    backgrounds,
    folders,
    allCharacterBackgrounds,
    allCharactersLoading,
    allCharactersError,
    refetchAllCharacters,
    startBackgroundTouchDrag,
  } = library;
  // New layout: the window is a picker (search, sort, source, grid, Upload). Managing the library (folders,
  // tags, rename, delete) is Library > Backgrounds, and with no chat to pick for, "Browse" opens that page.
  const overhaulLook = useOverhaulLook();
  const pickerOnly = overhaulLook;
  const openLibrary = () => {
    if (overhaulLook && !hasChat) openLibrarySection("backgrounds");
    else setOpen(true);
  };
  const manageInLibrary = () => {
    closePicker();
    openLibrarySection("backgrounds");
  };

  const renderCard = (background: BackgroundLibraryItem) => {
    const isSelected = selected === background.url || pendingSelection === background.url;
    const isDefaultRoleplay = defaultRoleplayBackground === background.url;
    const isEditable = background.editable !== false && background.source !== "game_asset";
    const isEditingTags = editingTags === background.id;
    const isRenaming = renamingFile === background.id;
    const title = getBackgroundLibraryTitle(background);
    const isFloatingActions = !isEditingTags && !isRenaming;
    const datalistId = `background-tag-suggestions-${background.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

    return (
      <article
        key={background.id}
        data-background-id={background.id}
        data-background-selected={isSelected ? "true" : "false"}
        data-touch-drag-card="background"
        data-drag-id={background.id}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        data-drag-kind="background"
        data-drag-folder={background.folderId ?? ""}
        data-drag-payload={JSON.stringify({ version: 1, kind: "background", ids: [background.url], label: title })}
        onMouseDown={(event) => {
          if (isRenaming || isEditingTags) return;
          cancelPendingClose();
          startBackgroundTouchDrag(event, background.id, {
            chatResourcePayload: { version: 1, kind: "background", ids: [background.url], label: title },
            sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="background"]'),
          });
        }}
        onTouchStart={(event) => {
          if (isRenaming || isEditingTags) return;
          cancelPendingClose();
          startBackgroundTouchDrag(event, background.id, {
            chatResourcePayload: { version: 1, kind: "background", ids: [background.url], label: title },
            sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="background"]'),
          });
        }}
        draggable={!isRenaming}
        onDragStart={(event) => {
          draggedBackgroundIdRef.current = background.id;
          setDraggedBackgroundId(background.id);
          event.dataTransfer.effectAllowed = "copyMove";
          event.dataTransfer.setData("application/x-marinara-background-id", background.id);
          event.dataTransfer.setData("text/plain", background.id);
          writeChatResourceDragPayload(event.dataTransfer, {
            version: 1,
            kind: "background",
            ids: [background.url],
            label: title,
          });
        }}
        onDragEnd={() => {
          draggedBackgroundIdRef.current = null;
          setDraggedBackgroundId(null);
          clearActiveChatResourceDrag();
        }}
        className={cn(
          "group relative min-w-0 touch-pan-y rounded-xl bg-[var(--secondary)]/35 ring-1 transition-all",
          isSelected
            ? "shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)] ring-2 ring-[var(--primary)]"
            : "ring-[var(--border)] hover:-translate-y-0.5 hover:shadow-lg hover:ring-[var(--primary)]/45",
          draggedBackgroundId === background.id && "opacity-50",
        )}
      >
        {/* The overlays are positioned against the thumbnail, not the card: anchoring them to the
            card floated the always-visible mobile action row on top of the name and tag chips. */}
        <div className="relative">
          <button
            type="button"
            data-drag-surface
            onClick={() => selectBackground(background, isSelected)}
            className="relative block aspect-[16/10] w-full cursor-grab overflow-hidden rounded-t-xl bg-[var(--background)] text-left active:cursor-grabbing"
            aria-label={
              isSelected
                ? localizeUi("ui.panels.backgroundpicker.removeValue1FromThisChat", { value1: title })
                : localizeUi("ui.panels.backgroundpicker.useValue1ForThisChat", { value1: title })
            }
            aria-pressed={isSelected}
          >
            {/* Thumbnail, not the original: a grid of full-size backgrounds decodes to
                hundreds of MB of bitmap. The server falls back to the original when it
                cannot resize (animated GIF, no native sharp). */}
            <img
              src={`${background.url}?w=${BACKGROUND_THUMBNAIL_WIDTH}`}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.5625rem] max-sm:!text-[13px] font-medium text-white/90 backdrop-blur-sm">
              {localizeUi(
                background.source === "game_asset"
                  ? "ui.panels.backgroundpicker.gameAsset"
                  : "ui.panels.backgroundpicker.myUpload",
              )}
            </span>
            {showRoleplayDefault && isDefaultRoleplay && (
              <span
                data-background-default-indicator
                className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.5rem] max-sm:!text-[13px] font-medium text-[var(--primary)] md:group-hover:opacity-0"
              >
                {localizeUi("ui.panels.backgroundpicker.roleplayDefaultShort")}
              </span>
            )}
          </button>

          {isSelected && (
            <span
              data-background-selection-indicator
              className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm ring-2 ring-[var(--card)]"
            >
              <Check size="0.875rem" strokeWidth={3} />
            </span>
          )}

          {/* The star sits on the image so favouriting never competes with the row of card actions. */}
          <button
            type="button"
            data-background-favorite-toggle
            onClick={() => {
              cancelPendingClose();
              toggleFavorite.mutate({ backgroundId: background.id, favorite: !background.favorite });
            }}
            className={cn(
              "absolute left-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-colors md:h-7 md:w-7",
              background.favorite
                ? "text-[var(--primary)]"
                : "text-white/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100",
            )}
            title={localizeUi(
              background.favorite
                ? "ui.panels.backgroundpicker.removeFromFavorites"
                : "ui.panels.backgroundpicker.addToFavorites",
            )}
            aria-label={localizeUi(
              background.favorite
                ? "ui.panels.backgroundpicker.removeValue1FromFavorites"
                : "ui.panels.backgroundpicker.addValue1ToFavorites",
              { value1: title },
            )}
            aria-pressed={Boolean(background.favorite)}
          >
            <Star size="0.875rem" fill={background.favorite ? "currentColor" : "none"} />
          </button>

          {/* Static row under the thumbnail on touch (always visible, so it must not cover the name
              or the tags), floating scrim over the image on hover from md up. While an inline
              editor is open the row stays in flow on every viewport, so the floating version can
              never land on top of the input and its Save/Add button. */}
          <div
            data-background-actions
            className={cn(
              "flex flex-wrap items-center justify-end gap-0.5 px-1.5 pb-0.5 pt-1.5 max-sm:[&_button]:min-h-11 max-sm:[&_button]:min-w-11",
              isFloatingActions &&
                "md:absolute md:bottom-2 md:right-2 md:flex-nowrap md:rounded-lg md:bg-black/60 md:px-0.5 md:pb-0.5 md:pt-0.5 md:opacity-0 md:backdrop-blur-sm md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100",
            )}
          >
            <ChatResourceActionButton
              payload={{ version: 1, kind: "background", ids: [background.url], label: title }}
              className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!size-11")}
            />
            {pickerOnly ? null : (
              <button
                type="button"
                data-background-move
                onClick={() => void handleMoveBackground(background)}
                className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!hidden")}
                title={localizeUi("ui.panels.backgroundpicker.moveToFolder")}
                aria-label={localizeUi("ui.panels.backgroundpicker.moveValue1ToAFolder", { value1: title })}
              >
                <FolderInput size="0.75rem" />
              </button>
            )}
            {isEditable && !pickerOnly && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    cancelPendingClose();
                    setRenamingFile(background.id);
                  }}
                  className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!hidden")}
                  title={localizeUi("ui.panels.backgroundpicker.renameBackground")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.renameValue1", { value1: title })}
                >
                  <Pencil size="0.75rem" />
                </button>
                <button
                  type="button"
                  data-background-edit-tags
                  onClick={() => {
                    cancelPendingClose();
                    setEditingTags(isEditingTags ? null : background.id);
                  }}
                  className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!hidden")}
                  title={localizeUi("ui.panels.backgroundpicker.editTags")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.editTagsForValue1", { value1: title })}
                  aria-pressed={isEditingTags}
                >
                  <Tag size="0.75rem" />
                </button>
              </>
            )}
            {showRoleplayDefault && (
              <button
                type="button"
                data-background-default-toggle
                onClick={() => {
                  cancelPendingClose();
                  onDefaultChange(isDefaultRoleplay ? DEFAULT_ROLEPLAY_BACKGROUND_URL : background.url);
                }}
                className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!hidden")}
                title={
                  isDefaultRoleplay
                    ? localizeUi("ui.panels.backgroundpicker.removeAsRoleplayDefault")
                    : localizeUi("ui.panels.backgroundpicker.setAsDefaultForNewRoleplayChats")
                }
                aria-label={
                  isDefaultRoleplay
                    ? localizeUi("ui.panels.backgroundpicker.value1IsTheDefaultRoleplayBackground", { value1: title })
                    : localizeUi("ui.panels.backgroundpicker.setValue1AsTheDefaultRoleplayBackground", {
                        value1: title,
                      })
                }
                aria-pressed={isDefaultRoleplay}
              >
                <Pin size="0.75rem" />
              </button>
            )}
            <button
              type="button"
              data-background-download
              onClick={() => {
                cancelPendingClose();
                void saveExportUrl(background.url, background.filename);
              }}
              className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!hidden")}
              title={localizeUi("ui.panels.backgroundpicker.downloadBackground")}
              aria-label={localizeUi("ui.panels.backgroundpicker.downloadValue1", { value1: title })}
            >
              <Download size="0.75rem" />
            </button>
            {background.deletable !== false && isEditable && !pickerOnly && (
              <button
                type="button"
                onClick={() => {
                  cancelPendingClose();
                  void handleDeleteBackground(background);
                }}
                className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger max-sm:!hidden")}
                title={localizeUi("ui.panels.backgroundpicker.deleteBackground")}
                aria-label={localizeUi("ui.panels.botbrowserpanel.deleteValue1", { value1: title })}
              >
                <Trash2 size="0.75rem" />
              </button>
            )}
            {/* Phones: one 44px menu button instead of a crowded row of small icons. */}
            <button
              type="button"
              onClick={(event) => {
                cancelPendingClose();
                const items: ContextMenuItem[] = pickerOnly
                  ? []
                  : [
                      {
                        label: localizeUi("ui.panels.backgroundpicker.moveToFolder"),
                        icon: <FolderInput size="1rem" />,
                        onSelect: () => void handleMoveBackground(background),
                      },
                    ];
                if (isEditable && !pickerOnly) {
                  items.push(
                    {
                      label: localizeUi("ui.panels.backgroundpicker.renameBackground"),
                      icon: <Pencil size="1rem" />,
                      onSelect: () => setRenamingFile(background.id),
                    },
                    {
                      label: localizeUi("ui.panels.backgroundpicker.editTags"),
                      icon: <Tag size="1rem" />,
                      onSelect: () => setEditingTags(isEditingTags ? null : background.id),
                    },
                  );
                }
                if (showRoleplayDefault) {
                  items.push({
                    label: isDefaultRoleplay
                      ? localizeUi("ui.panels.backgroundpicker.removeAsRoleplayDefault")
                      : localizeUi("ui.panels.backgroundpicker.setAsDefaultForNewRoleplayChats"),
                    icon: <Pin size="1rem" />,
                    onSelect: () =>
                      onDefaultChange(isDefaultRoleplay ? DEFAULT_ROLEPLAY_BACKGROUND_URL : background.url),
                  });
                }
                items.push({
                  label: localizeUi("ui.panels.backgroundpicker.downloadBackground"),
                  icon: <Download size="1rem" />,
                  onSelect: () => void saveExportUrl(background.url, background.filename),
                });
                if (background.deletable !== false && isEditable && !pickerOnly) {
                  items.push({
                    label: localizeUi("ui.panels.backgroundpicker.deleteBackground"),
                    icon: <Trash2 size="1rem" />,
                    destructive: true,
                    onSelect: () => void handleDeleteBackground(background),
                  });
                }
                setCardMenu({ x: event.clientX, y: event.clientY, items });
              }}
              className={cn(SETTINGS_ICON_BUTTON_CLASS, "max-sm:!size-11 sm:!hidden")}
              title={localizeUi("connections.accounts.header.more")}
              aria-label={localizeUi("connections.accounts.header.more")}
            >
              <MoreHorizontal size="1rem" />
            </button>
          </div>
        </div>

        <div className="px-2.5 pb-2.5 pt-2">
          {isRenaming ? (
            <CardNameForm
              initialValue={background.filename.replace(/\.[^.]+$/, "")}
              ariaLabel={localizeUi("ui.panels.backgroundpicker.renameValue1", { value1: title })}
              placeholder={localizeUi("ui.panels.backgroundpicker.backgroundNamePlaceholder")}
              saveLabel={localizeUi("ui.noodle.noodlehome.save")}
              pending={renameBackground.isPending}
              onSubmit={(value) => {
                if (value) renameBackground.mutate({ filename: background.filename, name: value });
              }}
              onCancel={() => setRenamingFile(null)}
            />
          ) : (
            <h3 data-background-name className="truncate text-xs font-semibold text-[var(--foreground)]" title={title}>
              {title}
            </h3>
          )}

          {background.tags.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
              {background.tags.map((tag) =>
                // While editing, each tag is its own remove chip instead of a tiny X inside the pill.
                isEditingTags ? (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => void removeTag(background.filename, background.tags, tag)}
                    disabled={updateTags.isPending}
                    className={cn(SETTINGS_BUTTON_CLASS, "max-w-full")}
                    aria-label={localizeUi("ui.panels.backgroundpicker.removeTagValue1", { value1: tag })}
                  >
                    <span>{tag}</span>
                    <X size="0.75rem" />
                  </button>
                ) : (
                  <span
                    key={tag}
                    className="inline-flex max-w-28 items-center truncate rounded-full bg-[var(--background)]/65 px-1.5 py-0.5 text-[0.5rem] max-sm:!text-[13px] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/60"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
          )}

          {isEditingTags && (
            <CardTagInput
              datalistId={datalistId}
              suggestions={allTags.filter((tag) => !background.tags.includes(tag))}
              placeholder={localizeUi("ui.panels.backgroundpicker.addTag")}
              addLabel={localizeUi("ui.panels.appearancesettings.add")}
              pending={updateTags.isPending}
              onAdd={(tag) => void addTag(background.filename, background.tags, tag)}
              onCancel={() => setEditingTags(null)}
            />
          )}
        </div>
      </article>
    );
  };

  const renderOwnerCard = (background: OwnerBackground) => {
    const isSelected = selected === background.url || pendingSelection === background.url;
    return (
      <article
        key={`${background.owner.type}:${background.imageId}`}
        data-owner-background-id={background.imageId}
        className={cn(
          "group relative min-w-0 rounded-xl bg-[var(--secondary)]/35 ring-1 transition-all",
          isSelected
            ? "shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)] ring-2 ring-[var(--primary)]"
            : "ring-[var(--border)] hover:-translate-y-0.5 hover:shadow-lg hover:ring-[var(--primary)]/45",
        )}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => selectBackground(background, isSelected)}
            className="relative block aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-[var(--background)] text-left"
            aria-label={
              isSelected
                ? localizeUi("ui.panels.backgroundpicker.removeValue1FromThisChat", { value1: background.title })
                : localizeUi("ui.panels.backgroundpicker.useValue1ForThisChat", { value1: background.title })
            }
            aria-pressed={isSelected}
          >
            <img
              src={background.url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
              loading="lazy"
              decoding="async"
            />
          </button>
          {isSelected && (
            <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm ring-2 ring-[var(--card)]">
              <Check size="0.875rem" strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="px-2.5 pb-2.5 pt-2">
          <h3 className="truncate text-xs font-semibold text-[var(--foreground)]" title={background.title}>
            {background.title}
          </h3>
        </div>
      </article>
    );
  };
  const firstOtherGroup = characterGroups.findIndex((group) => !group.inChat);

  return (
    <>
      {trigger ? (
        trigger(openLibrary)
      ) : (
        /* Big preview of the current value, the last picks one tap away, then the full library. */
        <div className="flex flex-col gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={openLibrary}
              aria-label={localizeUi("ui.panels.backgroundpicker.browseLibrary")}
              className="relative block h-28 w-full overflow-hidden rounded-xl bg-[var(--secondary)] text-left shadow-lg ring-1 ring-[var(--border)] transition-shadow hover:ring-[var(--primary)]/45"
            >
              {previewUrl ? (
                <img
                  src={`${previewUrl}?w=${CHAT_IMAGE_PREVIEW_WIDTH}`}
                  alt=""
                  className="h-full w-full object-cover"
                  decoding="async"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[var(--muted-foreground)]/45">
                  <Image size="2rem" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-7 text-sm font-semibold text-white">
                {selectedBackground
                  ? getBackgroundLibraryTitle(selectedBackground)
                  : selectedOwnerBackground
                    ? selectedOwnerBackground.title
                    : localizeUi("ui.panels.backgroundpicker.defaultBackground")}
              </span>
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => onSelect(null)}
                aria-label={localizeUi("ui.panels.backgroundpicker.clearSelection")}
                title={localizeUi("ui.panels.backgroundpicker.clearSelection")}
                className="absolute right-2 top-2 flex h-8 w-8 max-sm:h-11 max-sm:w-11 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/15 transition-transform active:scale-90"
              >
                <X size="0.875rem" />
              </button>
            )}
          </div>
          {recentBackgrounds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.backgroundpicker.recent")}
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {recentBackgrounds.map((background) => {
                  const title = getBackgroundLibraryTitle(background);
                  return (
                    <button
                      key={background.id}
                      type="button"
                      onClick={() => onSelect(background.url)}
                      aria-label={localizeUi("ui.panels.backgroundpicker.useValue1ForThisChat", { value1: title })}
                      className="group flex min-w-0 flex-col gap-1.5 text-left"
                    >
                      <img
                        src={`${background.url}?w=${BACKGROUND_THUMBNAIL_WIDTH}`}
                        alt=""
                        className="aspect-[4/3] w-full rounded-lg object-cover ring-1 ring-[var(--border)] transition-shadow group-hover:ring-[var(--primary)]/60"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="truncate text-[0.6875rem] max-sm:!text-[13px] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                        {title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {ownerBackgrounds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.backgroundpicker.fromCharacterGalleries")}
              </span>
              {/* ov- classes and an inline grid: Chat settings flattens plain grids of buttons into chips. */}
              <div
                className="ov-owner-backgrounds gap-2.5"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
              >
                {ownerBackgrounds.map((background) => {
                  const isSelected = background.url === previewUrl;
                  return (
                    <button
                      key={`${background.owner.type}:${background.owner.id}:${background.url}`}
                      type="button"
                      onClick={() => onSelect(background.url)}
                      aria-pressed={isSelected}
                      aria-label={localizeUi("ui.panels.backgroundpicker.useValue1ForThisChat", {
                        value1: background.title,
                      })}
                      title={
                        background.places
                          ? localizeUi("ui.panels.settingspanel.value1Value2", {
                              value1: background.owner.name,
                              value2: background.places,
                            })
                          : background.owner.name
                      }
                      className="ov-owner-background group flex min-w-0 flex-col gap-1.5 text-left"
                    >
                      <img
                        src={background.url}
                        alt=""
                        className={cn(
                          "aspect-[4/3] w-full rounded-lg object-cover ring-1 transition-shadow group-hover:ring-[var(--primary)]/60",
                          isSelected ? "ring-2 ring-[var(--primary)]" : "ring-[var(--border)]",
                        )}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="truncate text-[0.6875rem] max-sm:!text-[13px] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                        {background.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button type="button" onClick={openLibrary} className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}>
            <Image size="0.8125rem" />
            {localizeUi("ui.panels.backgroundpicker.browseLibrary")}
            <span className="opacity-70">· {backgrounds.length}</span>
          </button>
        </div>
      )}

      <Modal
        open={open}
        chatFloatingPanel={chatFloatingPanel}
        onClose={closePicker}
        title={localizeUi("ui.panels.backgroundpicker.backgroundLibrary")}
        width="max-w-4xl"
        mobileFullscreen
        panelClassName="sm:h-[min(88dvh,52rem)]"
        contentRef={modalContentRef}
        dragThrough={draggedBackgroundId !== null}
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search size="0.8125rem" className="mari-chrome-field-icon absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={localizeUi("ui.panels.backgroundpicker.searchBackgrounds")}
                className="mari-chrome-field h-10 w-full py-0 pl-8 pr-8 text-xs max-sm:text-base md:h-9"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={cn(SETTINGS_ICON_BUTTON_CLASS, "absolute right-1.5 top-1/2 -translate-y-1/2")}
                  title={localizeUi("ui.noodle.noodlehome.clearSearch")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.clearBackgroundSearch")}
                >
                  <X size="0.75rem" />
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              {/* The sort icon below stands in for the Select's own chevron, so that one is hidden. */}
              <Select<"custom" | BackgroundLibrarySort>
                value={manualOrderActive || folderDrag.active ? "custom" : sort}
                options={[
                  {
                    value: "custom",
                    label: localizeUi("dragDrop.manualOrder"),
                    description: localizeUi("dragDrop.manualOrderHelp"),
                  },
                  ...librarySortOptions<BackgroundLibrarySort>(localizeUi, {
                    az: "name-asc",
                    za: "name-desc",
                    newest: "newest",
                    oldest: "oldest",
                  }),
                ]}
                searchable={false}
                // Character backgrounds are grouped by owner, so the library sort does not apply.
                disabled={sourceFilter === "characters"}
                onChange={(value) => {
                  manualOrder.setActive(value === "custom");
                  folderDrag.setActive(value === "custom");
                  if (value !== "custom") setSort(value);
                }}
                className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 py-0 pl-2.5 pr-7 text-[0.6875rem] max-sm:!text-[13px] max-md:!w-10 max-md:!px-0 max-md:!text-transparent [&>svg]:hidden md:h-9 disabled:opacity-50"
                label={localizeUi("ui.panels.backgroundpicker.sortBackgrounds")}
              />
              <ArrowUpDown
                size="0.625rem"
                className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 max-md:left-1/2 max-md:-translate-x-1/2"
              />
            </div>
            <ImageUploadDropzone
              label={localizeUi("ui.panels.backgroundpicker.importBackgrounds")}
              pending={uploading}
              pendingLabel={localizeUi("ui.panels.backgroundpicker.importing")}
              dragLabel={localizeUi("ui.panels.backgroundpicker.dropBackgroundsToImport")}
              onFilesSelected={(files) => void handleUpload(files)}
              icon={uploading ? <Spinner size="sm" /> : <Download size="0.75rem" />}
              labelClassName="max-md:sr-only"
              // h-10/md:h-9 and the mobile w-10 match the search field and sort select beside it.
              className={cn(SETTINGS_BUTTON_CLASS, "h-10 max-md:w-10 md:h-9 max-sm:h-11 max-sm:w-11")}
            />
          </div>

          {pickerOnly ? (
            <div className="ov-bgpick__bar">
              <select
                className="ov-select"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
                aria-label={localizeUi("ui.panels.backgroundpicker.filterBySource")}
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
                    {sourceCounts[value] !== null
                      ? localizeUi("ui.panels.ttsconfigcard.value1Value2", {
                          value1: localizeUi(key),
                          value2: sourceCounts[value],
                        })
                      : localizeUi(key)}
                  </option>
                ))}
              </select>
              <button type="button" className="ov-bgpick__manage" onClick={manageInLibrary}>
                <FolderInput size="0.8125rem" aria-hidden="true" />
                {localizeUi("library.backgrounds.manage")}
              </button>
            </div>
          ) : (
            <div
              className="grid grid-cols-4 gap-1 max-sm:flex max-sm:flex-wrap sm:w-fit"
              role="group"
              aria-label={localizeUi("ui.panels.backgroundpicker.filterBySource")}
            >
              {(
                [
                  ["all", localizeUi("ui.panels.backgroundpicker.allSources")],
                  ["user", localizeUi("ui.panels.backgroundpicker.myUploads")],
                  ["game_asset", localizeUi("ui.panels.backgroundpicker.gameAssets")],
                  ["characters", localizeUi("ui.panels.backgroundpicker.characters")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSourceFilter(value)}
                  className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                  aria-pressed={sourceFilter === value}
                >
                  <span>{label}</span>
                  {sourceCounts[value] !== null && (
                    <span className="tabular-nums opacity-60">{sourceCounts[value]}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {sourceFilter !== "characters" && (
            <>
              {pickerOnly ? null : (
                <>
                  <p className="mari-folder-helper max-sm:!text-[13px]">
                    {localizeUi("ui.panels.backgroundpicker.dragBackgroundsOntoAFolderChip")}
                  </p>

                  {/* Folder chips wrap like the tag filters: no rail, no scroll strip, same on touch. */}
                  <div
                    className="flex flex-wrap items-center gap-1"
                    role="group"
                    aria-label={localizeUi("ui.panels.backgroundpicker.filterByFolder")}
                  >
                    {(
                      [
                        ["all", localizeUi("ui.panels.backgroundpicker.allFolders"), backgrounds.length],
                        [
                          "favorites",
                          localizeUi("ui.panels.backgroundpicker.favorites"),
                          backgrounds.filter((background) => background.favorite).length,
                        ],
                        [
                          "unfiled",
                          localizeUi("ui.panels.backgroundpicker.unfiled"),
                          backgrounds.filter((background) => !background.folderId).length,
                        ],
                      ] as const
                    ).map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFolderFilter(value)}
                        data-background-folder-filter-id={value}
                        {...(value === "unfiled" ? { "data-background-folder-root": "" } : {})}
                        // Only Unfiled is a drop target; All and Favorites are not folders.
                        onDragOver={value === "unfiled" ? allowFolderDrop : undefined}
                        onDrop={value === "unfiled" ? (event) => handleFolderDrop(event, null) : undefined}
                        className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                        aria-pressed={folderFilter === value}
                      >
                        {value === "favorites" && (
                          <Star size="0.75rem" fill={folderFilter === value ? "currentColor" : "none"} />
                        )}
                        {label}
                        <span className="tabular-nums opacity-60">{count}</span>
                      </button>
                    ))}
                    {folderDrag.orderItems(folders).map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setFolderFilter(folder.id)}
                        {...folderDrag.bind(folder.id)}
                        data-background-folder-filter-id={folder.id}
                        data-background-folder-id={folder.id}
                        onDragOver={allowFolderDrop}
                        onDrop={(event) => handleFolderDrop(event, folder.id)}
                        className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                        aria-pressed={folderFilter === folder.id}
                      >
                        <Folder size="0.75rem" />
                        <span>{folder.name}</span>
                        <span className="tabular-nums opacity-60">
                          {backgrounds.filter((background) => background.folderId === folder.id).length}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void handleCreateFolder()}
                      disabled={createFolder.isPending}
                      className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                      title={localizeUi("ui.panels.backgroundpicker.newFolder")}
                      aria-label={localizeUi("ui.panels.backgroundpicker.newFolder")}
                    >
                      {createFolder.isPending ? <Spinner size="sm" /> : <FolderPlus size="0.75rem" />}
                      {localizeUi("ui.panels.backgroundpicker.newFolder")}
                    </button>
                    {activeFolder && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRenameActiveFolder(activeFolder)}
                          className={SETTINGS_ICON_BUTTON_CLASS}
                          title={localizeUi("ui.panels.backgroundpicker.renameFolder")}
                          aria-label={localizeUi("ui.panels.backgroundpicker.renameFolderValue1", {
                            value1: activeFolder.name,
                          })}
                        >
                          <Pencil size="0.75rem" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteFolder(
                              activeFolder,
                              backgrounds.filter((background) => background.folderId === activeFolder.id).length,
                            )
                          }
                          className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger")}
                          title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
                          aria-label={localizeUi("ui.panels.backgroundpicker.deleteFolderValue1", {
                            value1: activeFolder.name,
                          })}
                        >
                          <Trash2 size="0.75rem" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setIncludedTagValues([])}
                      className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                      aria-pressed={includedTags.size === 0}
                    >
                      {localizeUi("ui.noodle.stageprofilesourcepicker.all")}
                    </button>
                    {allTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTagsExpanded((expanded) => !expanded)}
                        // Selected while a tag filter is active: the counterpart of the pressed All chip.
                        className={cn(
                          SETTINGS_BUTTON_CLASS,
                          "max-sm:!min-h-11 max-sm:!text-[13px]",
                          includedTags.size > 0 && "mari-chrome-control--selected",
                        )}
                        aria-expanded={tagsExpanded}
                      >
                        <Tag size="0.75rem" />
                        {localizeUi("ui.panels.backgroundpicker.tagsValue1", { value1: allTags.length })}
                        <ChevronDown
                          size="0.75rem"
                          className={cn("transition-transform", tagsExpanded && "rotate-180")}
                        />
                      </button>
                    )}
                  </div>

                  {tagsExpanded && allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleIncludedTag(tag)}
                          className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                          aria-pressed={includedTags.has(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 text-[0.625rem] max-sm:!text-[13px] text-[var(--muted-foreground)]">
                <span>
                  {visibleBackgrounds.length} {localizeUi("ui.noodle.noodlehome.of")} {backgrounds.length}{" "}
                  {localizeUi("ui.panels.backgroundpicker.backgrounds")}
                </span>
                {showRoleplayDefault && (
                  <button
                    type="button"
                    onClick={() => onDefaultChange(DEFAULT_ROLEPLAY_BACKGROUND_URL)}
                    className={cn(
                      SETTINGS_BUTTON_CLASS,
                      "max-sm:!min-h-11 max-sm:!text-[13px]",
                      defaultRoleplayBackground === DEFAULT_ROLEPLAY_BACKGROUND_URL && "invisible pointer-events-none",
                    )}
                    aria-hidden={defaultRoleplayBackground === DEFAULT_ROLEPLAY_BACKGROUND_URL}
                    tabIndex={defaultRoleplayBackground === DEFAULT_ROLEPLAY_BACKGROUND_URL ? -1 : 0}
                  >
                    <Star size="0.75rem" />
                    {localizeUi("ui.panels.backgroundpicker.resetRoleplayDefault")}
                  </button>
                )}
              </div>

              {visibleBackgrounds.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {visibleBackgrounds.map(renderCard)}
                </div>
              )}
            </>
          )}

          {sourceFilter === "characters" && (
            <>
              {hasChat && (
                <div
                  className="flex flex-wrap items-center gap-1"
                  role="group"
                  aria-label={localizeUi("ui.panels.backgroundpicker.whichCharacters")}
                >
                  {(
                    [
                      ["chat", localizeUi("ui.panels.backgroundpicker.inThisChat"), ownerBackgrounds.length],
                      [
                        "all",
                        localizeUi("ui.panels.backgroundpicker.allCharacters"),
                        allCharacterBackgrounds.length || null,
                      ],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCharacterScope(value)}
                      className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                      aria-pressed={characterScope === value}
                    >
                      <span>{label}</span>
                      {count !== null && <span className="tabular-nums opacity-60">{count}</span>}
                    </button>
                  ))}
                </div>
              )}

              {characterGroups.map((group, index) => (
                <section
                  key={`${group.owner.type}:${group.owner.id}`}
                  className="flex flex-col gap-2"
                  aria-labelledby={`owner-backgrounds-${group.owner.type}-${group.owner.id}`}
                >
                  {index === firstOtherGroup && index > 0 && (
                    <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)] max-sm:!text-[11px]">
                      {localizeUi("ui.panels.backgroundpicker.otherCharacters")}
                    </div>
                  )}
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                      {group.owner.avatarPath ? (
                        <img
                          src={avatarPreviewSrc(group.owner.avatarPath, "row")}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(group.owner.avatarCrop)}
                        />
                      ) : (
                        <User size="0.75rem" />
                      )}
                    </span>
                    <h3
                      id={`owner-backgrounds-${group.owner.type}-${group.owner.id}`}
                      className="truncate text-xs font-semibold text-[var(--foreground)] max-sm:!text-[13px]"
                    >
                      {group.owner.name}
                    </h3>
                    {group.owner.type === "persona" ? (
                      <span className="shrink-0 rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.panels.backgroundpicker.persona")}
                      </span>
                    ) : (
                      group.inChat &&
                      showAllCharacters && (
                        <span className="shrink-0 rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.panels.backgroundpicker.inThisChat")}
                        </span>
                      )
                    )}
                    <span className="shrink-0 text-[0.625rem] tabular-nums text-[var(--muted-foreground)] max-sm:!text-[11px]">
                      {group.backgrounds.length}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {group.backgrounds.map(renderOwnerCard)}
                  </div>
                </section>
              ))}

              {showAllCharacters && allCharactersLoading && characterGroups.length === 0 && (
                <div className="flex justify-center py-4 text-[var(--muted-foreground)]">
                  <Loader2 size="1.25rem" className="animate-spin" />
                </div>
              )}

              {showAllCharacters && allCharactersError && (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="mari-chrome-text-muted text-[0.625rem] max-sm:text-[13px]">
                    {localizeUi("ui.panels.backgroundpicker.characterBackgroundsFailed")}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetchAllCharacters()}
                    className="text-[0.625rem] underline max-sm:text-[13px]"
                  >
                    {localizeUi("ui.panels.backgroundpicker.retry")}
                  </button>
                </div>
              )}
              {!(showAllCharacters && allCharactersLoading) &&
                !(showAllCharacters && allCharactersError) &&
                characterGroups.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <Image size="1.25rem" className="text-[var(--muted-foreground)]/40" />
                    <p className="mari-chrome-text-muted text-[0.625rem] max-sm:!text-[13px]">
                      {searchQuery.trim()
                        ? localizeUi("ui.panels.backgroundpicker.noBackgroundsMatchThoseFilters")
                        : showAllCharacters
                          ? localizeUi("ui.panels.backgroundpicker.noCharacterBackgrounds")
                          : localizeUi("ui.panels.backgroundpicker.noChatCharacterBackgrounds")}
                    </p>
                    {!searchQuery.trim() && (
                      <p className="mari-chrome-text-muted text-[0.625rem] max-sm:!text-[13px]">
                        {localizeUi("ui.panels.backgroundpicker.characterBackgroundsHint")}
                      </p>
                    )}
                    {!showAllCharacters && (
                      <button
                        type="button"
                        onClick={() => setCharacterScope("all")}
                        className={cn(SETTINGS_BUTTON_CLASS, "max-sm:!min-h-11 max-sm:!text-[13px]")}
                      >
                        {localizeUi("ui.panels.backgroundpicker.showAllCharacters")}
                      </button>
                    )}
                  </div>
                )}
            </>
          )}
          {cardMenu && (
            <ContextMenu x={cardMenu.x} y={cardMenu.y} items={cardMenu.items} onClose={() => setCardMenu(null)} />
          )}

          {sourceFilter !== "characters" && backgrounds.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <Image size="1.25rem" className="text-[var(--muted-foreground)]/40" />
              <p className="mari-chrome-text-muted text-[0.625rem] max-sm:!text-[13px]">
                {localizeUi("ui.panels.backgroundpicker.noBackgroundsAvailableYet")}
              </p>
            </div>
          )}
          {sourceFilter !== "characters" && backgrounds.length > 0 && visibleBackgrounds.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <Search size="1.25rem" className="text-[var(--muted-foreground)]/40" />
              <p className="mari-chrome-text-muted text-[0.625rem] max-sm:!text-[13px]">
                {localizeUi("ui.panels.backgroundpicker.noBackgroundsMatchThoseFilters")}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
