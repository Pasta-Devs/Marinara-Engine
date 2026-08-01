import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Folder,
  FolderInput,
  FolderPlus,
  Image,
  Loader2,
  Pencil,
  Search,
  Star,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BACKGROUND_THUMBNAIL_WIDTH } from "@marinara-engine/shared";
import { api } from "../../../lib/api-client";
import { cn } from "../../../lib/utils";
import {
  filterAndSortBackgrounds,
  getBackgroundLibraryTitle,
  getNextBackgroundFolderName,
  type BackgroundLibrarySort,
} from "../../../lib/background-library";
import {
  confirmNonEmptyFolderDelete,
  showChoiceDialog,
  showConfirmDialog,
  showPromptDialog,
} from "../../../lib/app-dialogs";
import { DEFAULT_ROLEPLAY_BACKGROUND_URL } from "../../../stores/ui.store";
import { useGameAssetManifest } from "../../../hooks/use-game-assets";
import { useTouchFolderDrag } from "../../../hooks/use-touch-folder-drag";
import { ImageUploadDropzone } from "../../ui/ImageUploadDropzone";
import { TouchDragHandle } from "../../ui/TouchDragHandle";
import { Modal } from "../../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../../lib/chat-resource-drag";
import { ChatResourceActionButton } from "../../chat/ChatResourceActionButton";

type BackgroundLibraryItem = {
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
};

type BackgroundLibraryFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type BackgroundUploadResponse = {
  success: boolean;
  filename: string;
  url: string;
  tags: string[];
};

type BackgroundPickerProps = {
  selected: string | null;
  onSelect: (url: string | null) => void;
  defaultRoleplayBackground: string;
  onDefaultChange: (url: string) => void;
};

const BACKGROUND_QUERY_KEY = ["backgrounds"] as const;
const BACKGROUND_FOLDER_QUERY_KEY = ["background-folders"] as const;
// The actions are a static row under the thumbnail with card colours and a touch-sized hit target.
const CARD_ACTION_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] md:h-7 md:w-7";
// From md up they normally float over the image on hover instead, which needs white-on-scrim.
const FLOATING_CARD_ACTION_CLASS = "md:text-white/80 md:hover:bg-white/15 md:hover:text-white";
const INLINE_ACCENT_BUTTON_CLASS =
  "rounded-md bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.625rem] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25 disabled:cursor-not-allowed disabled:opacity-50";

const CARD_TEXT_FIELD_CLASS =
  "min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[0.6875rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]";

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
      <button type="submit" disabled={pending} className={INLINE_ACCENT_BUTTON_CLASS}>
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
        className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        data-background-tag-input
        autoFocus
        list={datalistId}
      />
      <datalist id={datalistId}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || pending}
        className={INLINE_ACCENT_BUTTON_CLASS}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function BackgroundPicker({
  selected,
  onSelect,
  defaultRoleplayBackground,
  onDefaultChange,
}: BackgroundPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BackgroundLibrarySort>("name-asc");
  const [sourceFilter, setSourceFilter] = useState<"all" | "user" | "game_asset">("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [includedTagValues, setIncludedTagValues] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [draggedBackgroundId, setDraggedBackgroundId] = useState<string | null>(null);
  const { refetch: refreshGameAssetManifest } = useGameAssetManifest();
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
      const previous = qc.getQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY);
      qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
        current.map((background) => (background.id === backgroundId ? { ...background, folderId } : background)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(BACKGROUND_QUERY_KEY, context.previous);
      toast.error(localizeUi("ui.panels.backgroundpicker.failedToMoveBackground"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY }),
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ backgroundId, favorite }: { backgroundId: string; favorite: boolean }) =>
      api.patch("/backgrounds/favorite", { backgroundId, favorite }),
    onMutate: async ({ backgroundId, favorite }) => {
      await qc.cancelQueries({ queryKey: BACKGROUND_QUERY_KEY });
      const previous = qc.getQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY);
      qc.setQueryData<BackgroundLibraryItem[]>(BACKGROUND_QUERY_KEY, (current = []) =>
        current.map((background) => (background.id === backgroundId ? { ...background, favorite } : background)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(BACKGROUND_QUERY_KEY, context.previous);
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
    return filtered.filter((background) => {
      if (sourceFilter !== "all" && background.source !== sourceFilter) return false;
      if (folderFilter === "favorites") return Boolean(background.favorite);
      if (folderFilter === "unfiled") return !background.folderId;
      if (folderFilter !== "all") return background.folderId === folderFilter;
      return true;
    });
  }, [backgrounds, folderFilter, includedTags, searchQuery, sort, sourceFilter]);
  const activeFolder = folders.find((folder) => folder.id === folderFilter) ?? null;
  const selectedBackground = backgrounds.find((background) => background.url === selected) ?? null;
  const sourceCounts = useMemo(
    () => ({
      all: backgrounds.length,
      user: backgrounds.filter((background) => background.source !== "game_asset").length,
      game_asset: backgrounds.filter((background) => background.source === "game_asset").length,
    }),
    [backgrounds],
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
    (background: BackgroundLibraryItem, isSelected: boolean) => {
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
        event.dataTransfer.getData("application/x-marinara-background-id") ||
        event.dataTransfer.getData("text/plain")
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
    (backgroundId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest<HTMLElement>("[data-background-folder-id]");
      const rootElement = target?.closest<HTMLElement>("[data-background-folder-root]");
      if (folderElement?.dataset.backgroundFolderId) {
        assignBackground(backgroundId, folderElement.dataset.backgroundFolderId);
      } else if (rootElement) {
        assignBackground(backgroundId, null);
      } else {
        setDraggedBackgroundId(null);
        draggedBackgroundIdRef.current = null;
      }
    },
    [assignBackground],
  );

  const { startTouchDrag: startBackgroundTouchDrag } = useTouchFolderDrag({
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
          "group relative min-w-0 touch-pan-y overflow-hidden rounded-xl bg-[var(--secondary)]/35 ring-1 transition-all",
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
            onClick={() => selectBackground(background, isSelected)}
            className="relative block aspect-[16/10] w-full overflow-hidden bg-[var(--background)] text-left"
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
            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.5625rem] font-medium text-white/90 backdrop-blur-sm">
              {localizeUi(
                background.source === "game_asset"
                  ? "ui.panels.backgroundpicker.gameAsset"
                  : "ui.panels.backgroundpicker.myUpload",
              )}
            </span>
            {isDefaultRoleplay && (
              <span
                data-background-default-indicator
                className="absolute bottom-2 right-2 hidden rounded-md bg-black/60 px-1.5 py-0.5 text-[0.5rem] font-medium text-amber-300 backdrop-blur-sm md:block md:group-hover:opacity-0"
              >
                {localizeUi("ui.panels.backgroundpicker.roleplayDefaultShort")}
              </span>
            )}
            {isSelected && (
              <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg">
                <Check size="0.875rem" strokeWidth={3} />
              </span>
            )}
          </button>

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
                ? "text-amber-300"
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

          <TouchDragHandle
            label={localizeUi("ui.panels.backgroundpicker.dragValue1ToAFolder", { value1: title })}
            size="0.875rem"
            className="absolute right-2 top-2 rounded-full bg-black/55 text-white/80 backdrop-blur-sm max-md:h-11 max-md:w-11"
            onTouchStart={(event) => {
              cancelPendingClose();
              startBackgroundTouchDrag(event, background.id, {
                allowInteractiveTarget: true,
                chatResourcePayload: { version: 1, kind: "background", ids: [background.url], label: title },
                sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="background"]'),
              });
            }}
          />

          {/* Static row under the thumbnail on touch (always visible, so it must not cover the name
              or the tags), floating scrim over the image on hover from md up. While an inline
              editor is open the row stays in flow on every viewport, so the floating version can
              never land on top of the input and its Save/Add button. */}
          <div
            data-background-actions
            className={cn(
              "flex flex-wrap items-center justify-end gap-0.5 px-1.5 pb-0.5 pt-1.5",
              isFloatingActions &&
                "md:absolute md:bottom-2 md:right-2 md:flex-nowrap md:rounded-lg md:bg-black/60 md:px-0.5 md:pb-0.5 md:pt-0.5 md:opacity-0 md:backdrop-blur-sm md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100",
            )}
          >
            <ChatResourceActionButton
              payload={{ version: 1, kind: "background", ids: [background.url], label: title }}
              className={cn(CARD_ACTION_CLASS, isFloatingActions && FLOATING_CARD_ACTION_CLASS)}
            />
            <button
              type="button"
              data-background-move
              onClick={() => void handleMoveBackground(background)}
              className={cn(CARD_ACTION_CLASS, isFloatingActions && FLOATING_CARD_ACTION_CLASS)}
              title={localizeUi("ui.panels.backgroundpicker.moveToFolder")}
              aria-label={localizeUi("ui.panels.backgroundpicker.moveValue1ToAFolder", { value1: title })}
            >
              <FolderInput size="0.875rem" />
            </button>
            {isEditable && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    cancelPendingClose();
                    setRenamingFile(background.id);
                  }}
                  className={cn(CARD_ACTION_CLASS, isFloatingActions && FLOATING_CARD_ACTION_CLASS)}
                  title={localizeUi("ui.panels.backgroundpicker.renameBackground")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.renameValue1", { value1: title })}
                >
                  <Pencil size="0.875rem" />
                </button>
                <button
                  type="button"
                  data-background-edit-tags
                  onClick={() => {
                    cancelPendingClose();
                    setEditingTags(isEditingTags ? null : background.id);
                  }}
                  className={cn(
                    CARD_ACTION_CLASS,
                    isFloatingActions && FLOATING_CARD_ACTION_CLASS,
                    isEditingTags && "bg-[var(--primary)]/20 text-[var(--primary)]",
                  )}
                  title={localizeUi("ui.panels.backgroundpicker.editTags")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.editTagsForValue1", { value1: title })}
                  aria-pressed={isEditingTags}
                >
                  <Tag size="0.875rem" />
                </button>
              </>
            )}
            <button
              type="button"
              data-background-default-toggle
              onClick={() => {
                cancelPendingClose();
                onDefaultChange(isDefaultRoleplay ? DEFAULT_ROLEPLAY_BACKGROUND_URL : background.url);
              }}
              className={cn(
                CARD_ACTION_CLASS,
                isFloatingActions && FLOATING_CARD_ACTION_CLASS,
                "w-auto px-2 text-[0.5625rem] font-medium md:px-1.5 md:text-[0.5rem]",
                isDefaultRoleplay && "bg-amber-300/12 text-amber-300",
              )}
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
              {localizeUi("ui.panels.backgroundpicker.roleplayDefaultShort")}
            </button>
            {background.deletable !== false && isEditable && (
              <button
                type="button"
                onClick={() => {
                  cancelPendingClose();
                  void handleDeleteBackground(background);
                }}
                className={cn(
                  CARD_ACTION_CLASS,
                  "text-[var(--destructive)] hover:bg-[var(--destructive)]/12",
                )}
                title={localizeUi("ui.panels.backgroundpicker.deleteBackground")}
                aria-label={localizeUi("ui.panels.botbrowserpanel.deleteValue1", { value1: title })}
              >
                <Trash2 size="0.875rem" />
              </button>
            )}
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
              {background.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex max-w-28 items-center gap-0.5 truncate rounded-full bg-[var(--background)]/65 px-1.5 py-0.5 text-[0.5rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/60"
                >
                  {tag}
                  {isEditingTags && (
                    <button
                      type="button"
                      onClick={() => void removeTag(background.filename, background.tags, tag)}
                      disabled={updateTags.isPending}
                      className="-my-1 flex h-6 w-6 items-center justify-center rounded-full hover:text-[var(--destructive)] md:my-0 md:h-4 md:w-4"
                      aria-label={localizeUi("ui.panels.backgroundpicker.removeTagValue1", { value1: tag })}
                    >
                      <X size="0.5rem" />
                    </button>
                  )}
                </span>
              ))}
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

  return (
    <>
      {/* Stacked, not one row: the preview reads as the current value, and the two actions get a
          full-width line each instead of being squeezed against it. */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--secondary)]/55 hover:ring-[var(--primary)]/45"
        >
          <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-[var(--secondary)] ring-1 ring-[var(--border)]">
            {selected ? (
              <img
                src={`${selected}?w=${BACKGROUND_THUMBNAIL_WIDTH}`}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]/45">
                <Image size="1.25rem" />
              </div>
            )}
          </span>
          <span className="min-w-0 flex-1 basis-24">
            <div className="truncate text-xs font-semibold text-[var(--foreground)]">
              {selectedBackground
                ? getBackgroundLibraryTitle(selectedBackground)
                : localizeUi("ui.panels.backgroundpicker.defaultBackground")}
            </div>
            <div className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.backgroundpicker.value1BackgroundsAvailable", { value1: backgrounds.length })}
            </div>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mari-chrome-control mari-chrome-control--compact min-h-9 w-full"
        >
          <Image size="0.75rem" />
          {localizeUi("ui.panels.backgroundpicker.browseLibrary")}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mari-chrome-control mari-chrome-control--compact min-h-9 w-full !text-[var(--muted-foreground)] hover:!text-[var(--destructive)]"
            title={localizeUi("ui.panels.backgroundpicker.clearSelection")}
          >
            <X size="0.75rem" />
            {localizeUi("ui.panels.backgroundpicker.clearSelection")}
          </button>
        )}
      </div>

      <Modal
        open={open}
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
                className="mari-chrome-field h-10 w-full py-0 pl-8 pr-8 text-xs md:h-9"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title={localizeUi("ui.noodle.noodlehome.clearSearch")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.clearBackgroundSearch")}
                >
                  <X size="0.6875rem" />
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as BackgroundLibrarySort)}
                className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
                title={localizeUi("ui.panels.backgroundpicker.sortBackgrounds")}
                aria-label={localizeUi("ui.panels.backgroundpicker.sortBackgrounds")}
              >
                <option value="name-asc">{localizeUi("ui.panels.backgroundpicker.aZ")}</option>
                <option value="name-desc">{localizeUi("ui.panels.backgroundpicker.zA")}</option>
                <option value="newest">{localizeUi("ui.panels.backgroundpicker.newest")}</option>
                <option value="oldest">{localizeUi("ui.panels.backgroundpicker.oldest")}</option>
              </select>
              <ArrowUpDown
                size="0.625rem"
                className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
              />
            </div>
            <ImageUploadDropzone
              label={localizeUi("ui.panels.backgroundpicker.importBackgrounds")}
              pending={uploading}
              pendingLabel={localizeUi("ui.panels.backgroundpicker.importing")}
              dragLabel={localizeUi("ui.panels.backgroundpicker.dropBackgroundsToImport")}
              onFilesSelected={(files) => void handleUpload(files)}
              icon={uploading ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
              className="!h-10 shrink-0 !rounded-lg !border !border-solid !px-3 !py-0 text-[0.6875rem] hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/50 md:!h-9"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-[var(--secondary)]/30 p-2 ring-1 ring-[var(--border)]/70 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="grid grid-cols-3 rounded-lg bg-[var(--background)]/70 p-0.5 ring-1 ring-[var(--border)]/70"
              role="group"
              aria-label={localizeUi("ui.panels.backgroundpicker.filterBySource")}
            >
              {(
                [
                  ["all", localizeUi("ui.panels.backgroundpicker.allSources")],
                  ["user", localizeUi("ui.panels.backgroundpicker.myUploads")],
                  ["game_asset", localizeUi("ui.panels.backgroundpicker.gameAssets")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSourceFilter(value)}
                  className={cn(
                    "flex min-h-8 items-center justify-center gap-1 rounded-md px-2 text-[0.625rem] font-medium transition-colors",
                    sourceFilter === value
                      ? "bg-[var(--primary)]/16 text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/25"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                  )}
                  aria-pressed={sourceFilter === value}
                >
                  <span>{label}</span>
                  <span className="tabular-nums opacity-60">{sourceCounts[value]}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mari-folder-helper">
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
                className={cn(
                  "mari-chrome-control mari-chrome-control--compact",
                  folderFilter === value && "mari-chrome-control--selected",
                )}
                aria-pressed={folderFilter === value}
              >
                {value === "favorites" && (
                  <Star size="0.625rem" fill={folderFilter === value ? "currentColor" : "none"} />
                )}
                {label}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            ))}
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setFolderFilter(folder.id)}
                data-background-folder-filter-id={folder.id}
                data-background-folder-id={folder.id}
                onDragOver={allowFolderDrop}
                onDrop={(event) => handleFolderDrop(event, folder.id)}
                className={cn(
                  "mari-chrome-control mari-chrome-control--compact",
                  folderFilter === folder.id && "mari-chrome-control--selected",
                )}
                aria-pressed={folderFilter === folder.id}
              >
                <Folder size="0.625rem" />
                <span className="max-w-32 truncate">{folder.name}</span>
                <span className="tabular-nums opacity-60">
                  {backgrounds.filter((background) => background.folderId === folder.id).length}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => void handleCreateFolder()}
              disabled={createFolder.isPending}
              className="mari-chrome-control mari-chrome-control--compact"
              title={localizeUi("ui.panels.backgroundpicker.newFolder")}
              aria-label={localizeUi("ui.panels.backgroundpicker.newFolder")}
            >
              {createFolder.isPending ? (
                <Loader2 size="0.625rem" className="animate-spin" />
              ) : (
                <FolderPlus size="0.625rem" />
              )}
              {localizeUi("ui.panels.backgroundpicker.newFolder")}
            </button>
            {activeFolder && (
              <>
                <button
                  type="button"
                  onClick={() => void handleRenameActiveFolder(activeFolder)}
                  className="mari-chrome-control mari-chrome-control--compact"
                  title={localizeUi("ui.panels.backgroundpicker.renameFolder")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.renameFolderValue1", {
                    value1: activeFolder.name,
                  })}
                >
                  <Pencil size="0.625rem" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleDeleteFolder(
                      activeFolder,
                      backgrounds.filter((background) => background.folderId === activeFolder.id).length,
                    )
                  }
                  className="mari-chrome-control mari-chrome-control--compact !text-[var(--destructive)]"
                  title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.deleteFolderValue1", {
                    value1: activeFolder.name,
                  })}
                >
                  <Trash2 size="0.625rem" />
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setIncludedTagValues([])}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact",
                includedTags.size === 0 && "mari-chrome-control--selected",
              )}
              aria-pressed={includedTags.size === 0}
            >
              {localizeUi("ui.noodle.stageprofilesourcepicker.all")}
            </button>
            {allTags.length > 0 && (
              <button
                type="button"
                onClick={() => setTagsExpanded((expanded) => !expanded)}
                className={cn(
                  "mari-chrome-control mari-chrome-control--compact",
                  includedTags.size > 0 && "mari-chrome-control--selected",
                )}
                aria-expanded={tagsExpanded}
              >
                <Tag size="0.625rem" />
                {localizeUi("ui.panels.backgroundpicker.tagsValue1", { value1: allTags.length })}
                <ChevronDown size="0.625rem" className={cn("transition-transform", tagsExpanded && "rotate-180")} />
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
                  className={cn(
                    "mari-chrome-control mari-chrome-control--compact",
                    includedTags.has(tag) && "mari-chrome-control--selected",
                  )}
                  aria-pressed={includedTags.has(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
            <span>
              {visibleBackgrounds.length} {localizeUi("ui.noodle.noodlehome.of")} {backgrounds.length}{" "}
              {localizeUi("ui.panels.backgroundpicker.backgrounds")}
            </span>
            <button
              type="button"
              onClick={() => onDefaultChange(DEFAULT_ROLEPLAY_BACKGROUND_URL)}
              className={cn(
                "inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                defaultRoleplayBackground === DEFAULT_ROLEPLAY_BACKGROUND_URL && "invisible pointer-events-none",
              )}
              aria-hidden={defaultRoleplayBackground === DEFAULT_ROLEPLAY_BACKGROUND_URL}
              tabIndex={defaultRoleplayBackground === DEFAULT_ROLEPLAY_BACKGROUND_URL ? -1 : 0}
            >
              <Star size="0.625rem" />
              {localizeUi("ui.panels.backgroundpicker.resetRoleplayDefault")}
            </button>
          </div>

          {visibleBackgrounds.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {visibleBackgrounds.map(renderCard)}
            </div>
          )}

          {backgrounds.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <Image size="1.25rem" className="text-[var(--muted-foreground)]/40" />
              <p className="mari-chrome-text-muted text-[0.625rem]">
                {localizeUi("ui.panels.backgroundpicker.noBackgroundsAvailableYet")}
              </p>
            </div>
          )}
          {backgrounds.length > 0 && visibleBackgrounds.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <Search size="1.25rem" className="text-[var(--muted-foreground)]/40" />
              <p className="mari-chrome-text-muted text-[0.625rem]">
                {localizeUi("ui.panels.backgroundpicker.noBackgroundsMatchThoseFilters")}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
