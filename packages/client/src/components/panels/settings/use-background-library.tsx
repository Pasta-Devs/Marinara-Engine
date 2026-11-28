import { useLibraryFolderDrag } from "../../../hooks/use-library-folder-drag";
import { useLibraryOrder } from "../../../hooks/use-library-order";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import {
  filterAndSortBackgrounds,
  getBackgroundLibraryTitle,
  getNextBackgroundFolderName,
  groupCharacterBackgrounds,
  type BackgroundLibrarySort,
} from "../../../lib/background-library";
import {
  confirmNonEmptyFolderDelete,
  showChoiceDialog,
  showConfirmDialog,
  showPromptDialog,
} from "../../../lib/app-dialogs";
import { DEFAULT_ROLEPLAY_BACKGROUND_URL, useUIStore } from "../../../stores/ui.store";
import { useGameAssetManifest } from "../../../hooks/use-game-assets";
import { useAllCharacterBackgrounds, type OwnerBackground } from "../../../hooks/use-chat-gallery-owners";
import { gameAssetFileUrl } from "../../../lib/game-asset-urls";
import { useTouchFolderDrag } from "../../../hooks/use-touch-folder-drag";
import { useTranslation as useUiTranslation } from "react-i18next";
import { type ContextMenuItem } from "../../ui/ContextMenu";

export type BackgroundLibraryItem = {
  id: string;
  filename: string;
  url: string;
  tags: string[];
  source?: "user" | "game_asset";
  tag?: string;
  editable?: boolean;
  deletable?: boolean;
  renameable?: boolean;
  createdAt: string;
  folderId: string | null;
  favorite?: boolean;
  /** A weather or time of day version's plain picture: a library file name or a gallery address. */
  versionOf?: string | null;
};

export type BackgroundLibraryFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type BackgroundUploadResponse = {
  success: boolean;
  filename: string;
  url: string;
  tags: string[];
};

export const NO_OWNER_BACKGROUNDS: OwnerBackground[] = [];
export const BACKGROUND_QUERY_KEY = ["backgrounds"] as const;
export const BACKGROUND_FOLDER_QUERY_KEY = ["background-folders"] as const;

export type BackgroundLibraryOptions = {
  selected: string | null;
  sceneBackgroundTag?: string | null;
  onSelect: (url: string | null) => void;
  defaultRoleplayBackground: string;
  onDefaultChange: (url: string) => void;
  /** The chat's characters' and persona's background pictures; leave out where there is no chat. */
  ownerBackgrounds?: OwnerBackground[];
  /** Library > Backgrounds: the manager is always on screen (no window to open), so every source loads. */
  active?: boolean;
};

/**
 * The background library's data and actions: the list, folders, tags, filters, upload, rename, delete and
 * the drag into folders. Shared by the classic window, the new layout's chat picker and Library > Backgrounds.
 */
export function useBackgroundLibrary({
  selected,
  sceneBackgroundTag,
  onSelect,
  defaultRoleplayBackground,
  onDefaultChange,
  ownerBackgrounds: chatOwnerBackgrounds,
  active = false,
}: BackgroundLibraryOptions) {
  const hasChat = chatOwnerBackgrounds !== undefined;
  const ownerBackgrounds = chatOwnerBackgrounds ?? NO_OWNER_BACKGROUNDS;
  const manualOrder = useLibraryOrder("background");
  const { active: manualOrderActive, orderItems: orderLibraryItems } = manualOrder;
  const folderDrag = useLibraryFolderDrag("background");
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BackgroundLibrarySort>("name-asc");
  const [sourceFilter, setSourceFilter] = useState<"all" | "user" | "game_asset" | "characters">("all");
  const [characterScope, setCharacterScope] = useState<"chat" | "all">("chat");
  const showAllCharacters = !hasChat || characterScope === "all";
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [includedTagValues, setIncludedTagValues] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [draggedBackgroundId, setDraggedBackgroundId] = useState<string | null>(null);
  const { data: assetManifest, refetch: refreshGameAssetManifest } = useGameAssetManifest();
  const qc = useQueryClient();
  const draggedBackgroundIdRef = useRef<string | null>(null);
  const tagUpdatePendingRef = useRef(false);
  const closeAfterSelectionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (closeAfterSelectionRef.current) clearTimeout(closeAfterSelectionRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    // The focus scope can scroll the panel while it mounts; start at the top regardless.
    const frame = requestAnimationFrame(() => modalContentRef.current?.scrollTo({ top: 0 }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const { data: backgrounds = [] } = useQuery({
    queryKey: BACKGROUND_QUERY_KEY,
    queryFn: () => api.get<BackgroundLibraryItem[]>("/backgrounds"),
  });

  const { data: folders = [] } = useQuery({
    queryKey: BACKGROUND_FOLDER_QUERY_KEY,
    queryFn: () => api.get<BackgroundLibraryFolder[]>("/backgrounds/folders"),
  });

  const deleteBackground = useMutation({
    mutationFn: (filename: string) => api.delete(`/backgrounds/${encodeURIComponent(filename)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY }),
  });

  const updateTags = useMutation({
    mutationFn: ({ filename, tags }: { filename: string; tags: string[] }) =>
      api.patch(`/backgrounds/${encodeURIComponent(filename)}/tags`, { tags }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY }),
  });

  const renameBackground = useMutation({
    mutationFn: ({ filename, name }: { filename: string; name: string }) =>
      api.patch<{ success: boolean; oldFilename: string; filename: string; url: string }>(
        `/backgrounds/${encodeURIComponent(filename)}/rename`,
        { name },
      ),
    onSuccess: (data) => {
      const oldUrl = `/api/backgrounds/file/${encodeURIComponent(data.oldFilename)}`;
      if (selected === oldUrl) onSelect(data.url);
      if (defaultRoleplayBackground === oldUrl) onDefaultChange(data.url);
      setRenamingFile(null);
      qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY });
    },
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => api.post<BackgroundLibraryFolder>("/backgrounds/folders", { name }),
    onSuccess: (folder) => {
      qc.setQueryData<BackgroundLibraryFolder[]>(BACKGROUND_FOLDER_QUERY_KEY, (current = []) => [...current, folder]);
    },
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<BackgroundLibraryFolder>(`/backgrounds/folders/${encodeURIComponent(id)}`, { name }),
    onSuccess: (updatedFolder) => {
      qc.setQueryData<BackgroundLibraryFolder[]>(BACKGROUND_FOLDER_QUERY_KEY, (current = []) =>
        current.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder)),
      );
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (folderId: string) => api.delete(`/backgrounds/folders/${encodeURIComponent(folderId)}`),
    onSuccess: (_data, folderId) => {
      qc.setQueryData<BackgroundLibraryFolder[]>(BACKGROUND_FOLDER_QUERY_KEY, (current = []) =>
        current.filter((folder) => folder.id !== folderId),
      );
      qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
        current.map((background) =>
          background.folderId === folderId ? { ...background, folderId: null } : background,
        ),
      );
      // Never leave the chips filtered on a folder that no longer exists.
      setFolderFilter((current) => (current === folderId ? "all" : current));
    },
  });

  const moveBackground = useMutation({
    mutationFn: ({ backgroundId, folderId }: { backgroundId: string; folderId: string | null }) =>
      api.patch("/backgrounds/organization", { backgroundId, folderId }),
    onMutate: async ({ backgroundId, folderId }) => {
      await qc.cancelQueries({ queryKey: BACKGROUND_QUERY_KEY });
      const before = qc.getQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY)?.find((b) => b.id === backgroundId);
      qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
        current.map((background) => (background.id === backgroundId ? { ...background, folderId } : background)),
      );
      return { previousFolderId: before ? before.folderId : undefined };
    },
    onError: (_error, { backgroundId, folderId }, context) => {
      // Put back only this picture's folder, and only if nothing changed it since: restoring the whole list from
      // before undid other moves and favourites made meanwhile (bug sweep Nov 23, L10).
      if (context && context.previousFolderId !== undefined)
        qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
          current.map((background) =>
            background.id === backgroundId && background.folderId === folderId
              ? { ...background, folderId: context.previousFolderId ?? null }
              : background,
          ),
        );
      toast.error(localizeUi("ui.panels.backgroundpicker.failedToMoveBackground"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY }),
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ backgroundId, favorite }: { backgroundId: string; favorite: boolean }) =>
      api.patch("/backgrounds/favorite", { backgroundId, favorite }),
    onMutate: async ({ backgroundId, favorite }) => {
      await qc.cancelQueries({ queryKey: BACKGROUND_QUERY_KEY });
      const before = qc.getQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY)?.find((b) => b.id === backgroundId);
      qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
        current.map((background) => (background.id === backgroundId ? { ...background, favorite } : background)),
      );
      return { previousFavorite: before ? before.favorite : undefined, known: !!before };
    },
    onError: (_error, { backgroundId, favorite }, context) => {
      // Only this picture's star, and only if nothing changed it since (as for moves above).
      if (context?.known)
        qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
          current.map((background) =>
            background.id === backgroundId && background.favorite === favorite
              ? { ...background, favorite: context.previousFavorite }
              : background,
          ),
        );
      toast.error(localizeUi("ui.panels.backgroundpicker.failedToUpdateFavorite"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY }),
  });

  const includedTags = useMemo(() => new Set(includedTagValues), [includedTagValues]);
  const allTags = useMemo(() => {
    const values = new Set<string>();
    for (const background of backgrounds) {
      for (const tag of background.tags) if (tag.trim()) values.add(tag.trim());
    }
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [backgrounds]);

  const visibleBackgrounds = useMemo(() => {
    const filtered = filterAndSortBackgrounds(backgrounds, { search: searchQuery, includedTags, sort });
    return orderLibraryItems(
      filtered.filter((background) => {
        if (sourceFilter !== "all" && background.source !== sourceFilter) return false;
        if (folderFilter === "favorites") return Boolean(background.favorite);
        if (folderFilter === "unfiled") return !background.folderId;
        if (folderFilter !== "all") return background.folderId === folderFilter;
        return true;
      }),
    );
  }, [backgrounds, folderFilter, includedTags, searchQuery, sort, sourceFilter, orderLibraryItems]);
  const activeFolder = folders.find((folder) => folder.id === folderFilter) ?? null;
  const previewUrl =
    selected ?? (sceneBackgroundTag ? gameAssetFileUrl(assetManifest?.assets[sceneBackgroundTag]?.path) : null);
  const selectedBackground = backgrounds.find((background) => background.url === previewUrl) ?? null;
  // A picture from a character outside the chat needs the full list for its name.
  const previewIsOtherCharacterBackground =
    !!previewUrl &&
    /^\/api\/characters\/(?!personas\/)[^/]+\/gallery\/file\//u.test(previewUrl) &&
    !ownerBackgrounds.some((background) => background.url === previewUrl);
  const {
    backgrounds: allCharacterBackgrounds,
    loading: allCharactersLoading,
    error: allCharactersError,
    refetch: refetchAllCharacters,
  } = useAllCharacterBackgrounds(
    ((open || active) && sourceFilter === "characters" && showAllCharacters) || previewIsOtherCharacterBackground,
  );
  const selectedOwnerBackground =
    ownerBackgrounds.find((background) => background.url === previewUrl) ??
    allCharacterBackgrounds.find((background) => background.url === previewUrl) ??
    null;
  const characterGroups = useMemo(
    () => groupCharacterBackgrounds(ownerBackgrounds, showAllCharacters ? allCharacterBackgrounds : [], searchQuery),
    [allCharacterBackgrounds, ownerBackgrounds, searchQuery, showAllCharacters],
  );
  const recentUrls = useUIStore((state) => state.recentChatBackgrounds);
  // Deleted files drop out because only library rows are shown.
  const recentBackgrounds = recentUrls
    .filter((url) => url !== previewUrl)
    .flatMap((url) => backgrounds.filter((background) => background.url === url))
    .slice(0, 3);
  const sourceCounts = useMemo(
    () => ({
      all: backgrounds.length,
      user: backgrounds.filter((background) => background.source !== "game_asset").length,
      game_asset: backgrounds.filter((background) => background.source === "game_asset").length,
      // Without a chat the count is everyone's, known once loaded.
      characters: hasChat ? ownerBackgrounds.length : allCharacterBackgrounds.length || null,
    }),
    [allCharacterBackgrounds.length, backgrounds, hasChat, ownerBackgrounds.length],
  );

  /**
   * Selecting a background closes the library shortly after, which is a race against any control
   * the user reaches for next. Every other card action calls this first so the sheet stays open.
   */
  const cancelPendingClose = useCallback(() => {
    if (!closeAfterSelectionRef.current) return;
    clearTimeout(closeAfterSelectionRef.current);
    closeAfterSelectionRef.current = null;
    setPendingSelection(null);
  }, []);

  const selectBackground = useCallback(
    (background: { url: string }, isSelected: boolean) => {
      if (isSelected) {
        cancelPendingClose();
        setPendingSelection(null);
        onSelect(null);
        return;
      }
      if (closeAfterSelectionRef.current) clearTimeout(closeAfterSelectionRef.current);
      setPendingSelection(background.url);
      onSelect(background.url);
      closeAfterSelectionRef.current = setTimeout(() => {
        setOpen(false);
        setPendingSelection(null);
        closeAfterSelectionRef.current = null;
      }, 280);
    },
    [cancelPendingClose, onSelect],
  );

  const closePicker = useCallback(() => {
    cancelPendingClose();
    setOpen(false);
  }, [cancelPendingClose]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      try {
        const uploads = await Promise.allSettled(
          files.map((file) => {
            const formData = new FormData();
            formData.append("file", file);
            return api.upload<BackgroundUploadResponse>("/backgrounds/upload", formData);
          }),
        );
        const successfulUploads = uploads
          .filter((result): result is PromiseFulfilledResult<BackgroundUploadResponse> => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((result) => result.success);
        const failed = uploads.length - successfulUploads.length;

        if (successfulUploads.length > 0) {
          // Importing while browsing a folder files the uploads there instead of into Unfiled.
          const targetFolderId = folders.some((folder) => folder.id === folderFilter) ? folderFilter : null;
          if (targetFolderId) {
            const moves = await Promise.allSettled(
              successfulUploads.map((upload) =>
                api.patch("/backgrounds/organization", {
                  backgroundId: `user:${upload.filename}`,
                  folderId: targetFolderId,
                }),
              ),
            );
            // An upload that fails to file would otherwise silently land in Unfiled.
            if (moves.some((result) => result.status === "rejected")) {
              toast.error(localizeUi("ui.panels.backgroundpicker.failedToMoveBackground"));
            }
          }
          qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY });
          void refreshGameAssetManifest().catch(() => undefined);
          onSelect(successfulUploads[successfulUploads.length - 1]!.url);
          toast.success(
            localizeUi("ui.panels.backgroundpicker.importedValue1BackgroundValue2", {
              value1: successfulUploads.length,
              value2: successfulUploads.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            }),
          );
        }
        if (failed > 0) {
          const rejected = uploads.find((result) => result.status === "rejected");
          toast.error(
            rejected?.status === "rejected" && rejected.reason instanceof Error
              ? rejected.reason.message
              : localizeUi("ui.panels.backgroundpicker.value1BackgroundImportValue2Failed", {
                  value1: failed,
                  value2: failed === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                }),
          );
        }
      } catch {
        toast.error(localizeUi("ui.panels.backgroundpicker.backgroundImportFailed"));
      } finally {
        setUploading(false);
      }
    },
    [folderFilter, folders, onSelect, qc, refreshGameAssetManifest, localizeUi],
  );

  const addTag = useCallback(
    async (filename: string, currentTags: string[], rawTag: string) => {
      if (tagUpdatePendingRef.current) return;
      const tag = rawTag
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 _-]/g, "");
      if (!tag || currentTags.includes(tag)) return;
      tagUpdatePendingRef.current = true;
      try {
        await updateTags.mutateAsync({ filename, tags: [...currentTags, tag] });
      } catch {
        toast.error(localizeUi("ui.panels.backgroundpicker.failedToUpdateBackgroundTags"));
      } finally {
        tagUpdatePendingRef.current = false;
      }
    },
    [updateTags, localizeUi],
  );

  const removeTag = useCallback(
    async (filename: string, currentTags: string[], tagToRemove: string) => {
      if (tagUpdatePendingRef.current) return;
      tagUpdatePendingRef.current = true;
      try {
        await updateTags.mutateAsync({ filename, tags: currentTags.filter((tag) => tag !== tagToRemove) });
        setIncludedTagValues((current) => current.filter((tag) => tag !== tagToRemove));
      } catch {
        toast.error(localizeUi("ui.panels.backgroundpicker.failedToUpdateBackgroundTags"));
      } finally {
        tagUpdatePendingRef.current = false;
      }
    },
    [updateTags, localizeUi],
  );

  const handleCreateFolder = useCallback(async () => {
    const name = await showPromptDialog({
      title: localizeUi("ui.panels.backgroundpicker.newFolder"),
      message: localizeUi("ui.panels.backgroundpicker.folderName"),
      defaultValue: getNextBackgroundFolderName(folders),
      confirmLabel: localizeUi("ui.panels.appearancesettings.add"),
    });
    const trimmed = name?.trim();
    if (trimmed) createFolder.mutate(trimmed);
  }, [createFolder, folders, localizeUi]);

  const handleRenameActiveFolder = useCallback(
    async (folder: BackgroundLibraryFolder) => {
      const name = await showPromptDialog({
        title: localizeUi("ui.panels.backgroundpicker.renameFolder"),
        message: localizeUi("ui.panels.backgroundpicker.folderName"),
        defaultValue: folder.name,
        confirmLabel: localizeUi("ui.noodle.noodlehome.save"),
      });
      const trimmed = name?.trim();
      if (trimmed && trimmed !== folder.name) renameFolder.mutate({ id: folder.id, name: trimmed });
    },
    [localizeUi, renameFolder],
  );

  const handleDeleteFolder = useCallback(
    async (folder: BackgroundLibraryFolder, itemCount: number) => {
      const confirmed = await confirmNonEmptyFolderDelete(itemCount, {
        title: "Delete Background Folder",
        message:
          itemCount > 0
            ? `Delete “${folder.name}”? Its ${itemCount} background${itemCount === 1 ? "" : "s"} will return to the unfiled list.`
            : `Delete “${folder.name}”?`,
        confirmLabel: "Delete Folder",
        tone: "destructive",
      });
      if (confirmed) deleteFolder.mutate(folder.id);
    },
    [deleteFolder],
  );

  const assignBackground = useCallback(
    (backgroundId: string, folderId: string | null) => {
      moveBackground.mutate({ backgroundId, folderId });
      setDraggedBackgroundId(null);
      draggedBackgroundIdRef.current = null;
    },
    [moveBackground],
  );

  /**
   * Keyboard and screen-reader path to the same result as dragging a card onto a folder chip.
   * Drag is pointer-only, so without this there is no way to file a background without a mouse.
   */
  const handleMoveBackground = useCallback(
    async (background: BackgroundLibraryItem) => {
      cancelPendingClose();
      const currentFolderId = background.folderId ?? "";
      const choice = await showChoiceDialog({
        title: localizeUi("ui.panels.backgroundpicker.moveToFolder"),
        message: getBackgroundLibraryTitle(background),
        choices: [
          { key: "", label: localizeUi("ui.panels.backgroundpicker.unfiled") },
          ...folders.map((folder) => ({ key: folder.id, label: folder.name })),
        ].filter((choice) => choice.key !== currentFolderId),
      });
      if (choice === null) return;
      assignBackground(background.id, choice || null);
    },
    [assignBackground, cancelPendingClose, folders, localizeUi],
  );

  const handleFolderDrop = useCallback(
    (event: DragEvent, folderId: string | null) => {
      event.preventDefault();
      const backgroundId = (
        event.dataTransfer.getData("application/x-marinara-background-id") || event.dataTransfer.getData("text/plain")
      ).trim();
      if (backgroundId) assignBackground(backgroundId, folderId);
    },
    [assignBackground],
  );

  const allowFolderDrop = useCallback((event: DragEvent) => {
    if (!draggedBackgroundIdRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const finishBackgroundTouchDrag = useCallback(
    (backgroundId: string, x: number, y: number, dragIds: string[] = [backgroundId]) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest<HTMLElement>("[data-background-folder-id]");
      const rootElement = target?.closest<HTMLElement>("[data-background-folder-root]");
      if (folderElement?.dataset.backgroundFolderId) {
        dragIds.forEach((id) => assignBackground(id, folderElement.dataset.backgroundFolderId!));
      } else if (rootElement) {
        dragIds.forEach((id) => assignBackground(id, null));
      } else {
        setDraggedBackgroundId(null);
        draggedBackgroundIdRef.current = null;
      }
    },
    [assignBackground],
  );

  const { startTouchDrag: startBackgroundTouchDrag } = useTouchFolderDrag({
    getDragIds: (id) => [id],
    onReorder: manualOrder.reorder,
    reorderHandlesDrop: true,
    onActivate: (backgroundId) => {
      draggedBackgroundIdRef.current = backgroundId;
      setDraggedBackgroundId(backgroundId);
    },
    onDrop: finishBackgroundTouchDrag,
    onCancel: () => {
      draggedBackgroundIdRef.current = null;
      setDraggedBackgroundId(null);
    },
  });

  const handleDeleteBackground = useCallback(
    async (background: BackgroundLibraryItem) => {
      const title = getBackgroundLibraryTitle(background);
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.panels.backgroundpicker.deleteBackground_e1c408d"),
        message: localizeUi("ui.panels.backgroundpicker.deleteValue1ThisCannotBeUndone", { value1: title }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      });
      if (!confirmed) return;
      try {
        await deleteBackground.mutateAsync(background.filename);
        if (selected === background.url) onSelect(null);
        if (defaultRoleplayBackground === background.url) onDefaultChange(DEFAULT_ROLEPLAY_BACKGROUND_URL);
      } catch {
        toast.error(localizeUi("ui.panels.backgroundpicker.failedToDeleteBackground"));
      }
    },
    [defaultRoleplayBackground, deleteBackground, onDefaultChange, onSelect, selected, localizeUi],
  );

  const toggleIncludedTag = useCallback((tag: string) => {
    setIncludedTagValues((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  }, []);

  return {
    hasChat,
    ownerBackgrounds,
    manualOrder,
    folderDrag,
    showAllCharacters,
    qc,
    draggedBackgroundIdRef,
    tagUpdatePendingRef,
    closeAfterSelectionRef,
    modalContentRef,
    deleteBackground,
    updateTags,
    renameBackground,
    createFolder,
    renameFolder,
    deleteFolder,
    moveBackground,
    toggleFavorite,
    includedTags,
    allTags,
    visibleBackgrounds,
    activeFolder,
    previewUrl,
    selectedBackground,
    previewIsOtherCharacterBackground,
    selectedOwnerBackground,
    characterGroups,
    recentUrls,
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
    assignBackground,
    handleMoveBackground,
    handleFolderDrop,
    allowFolderDrop,
    finishBackgroundTouchDrag,
    handleDeleteBackground,
    toggleIncludedTag,
    open,
    setOpen,
    pendingSelection,
    setPendingSelection,
    uploading,
    setUploading,
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
    includedTagValues,
    setIncludedTagValues,
    tagsExpanded,
    setTagsExpanded,
    draggedBackgroundId,
    setDraggedBackgroundId,
    manualOrderActive,
    orderLibraryItems,
    localizeUi,
    assetManifest,
    refreshGameAssetManifest,
    backgrounds,
    folders,
    allCharacterBackgrounds,
    allCharactersLoading,
    allCharactersError,
    refetchAllCharacters,
    startBackgroundTouchDrag,
  };
}

export type BackgroundLibrary = ReturnType<typeof useBackgroundLibrary>;
