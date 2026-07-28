import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Image,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Search,
  Star,
  Tag,
  Trash2,
  Type,
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
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../../lib/app-dialogs";
import { DEFAULT_ROLEPLAY_BACKGROUND_URL } from "../../../stores/ui.store";
import { useGameAssetManifest } from "../../../hooks/use-game-assets";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../../hooks/use-touch-folder-drag";
import { ImageUploadDropzone } from "../../ui/ImageUploadDropzone";
import { SmoothFolderContent } from "../../ui/SmoothFolderContent";
import { TouchDragHandle } from "../../ui/TouchDragHandle";
import { Modal } from "../../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";

type BackgroundLibraryItem = {
  id: string;
  filename: string;
  url: string;
  label: string | null;
  originalName: string | null;
  tags: string[];
  source?: "user" | "game_asset";
  tag?: string;
  editable?: boolean;
  deletable?: boolean;
  renameable?: boolean;
  createdAt: string;
  folderId: string | null;
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
  originalName: string;
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
const INLINE_ACCENT_BUTTON_CLASS =
  "rounded-md bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.625rem] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25 disabled:cursor-not-allowed disabled:opacity-50";

function parseDraggedBackgroundId(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function BackgroundPicker({
  selected,
  onSelect,
  defaultRoleplayBackground,
  onDefaultChange,
}: BackgroundPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BackgroundLibrarySort>("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sourceFilter, setSourceFilter] = useState<"all" | "user" | "game_asset">("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [includedTagValues, setIncludedTagValues] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [expandedBackgroundTagIds, setExpandedBackgroundTagIds] = useState<Set<string>>(() => new Set());
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [draggedBackgroundId, setDraggedBackgroundId] = useState<string | null>(null);
  const handleFolderRenameGesture = useFolderRenameGesture();
  const { refetch: refreshGameAssetManifest } = useGameAssetManifest();
  const qc = useQueryClient();
  const draggedBackgroundIdRef = useRef<string | null>(null);
  const tagUpdatePendingRef = useRef(false);

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

  const updateLabel = useMutation({
    mutationFn: ({ filename, label }: { filename: string; label: string | null }) =>
      api.patch(`/backgrounds/${encodeURIComponent(filename)}/label`, { label }),
    onSuccess: () => {
      setEditingLabel(null);
      setLabelInput("");
      qc.invalidateQueries({ queryKey: BACKGROUND_QUERY_KEY });
    },
    onError: () => toast.error(localizeUi("ui.panels.backgroundpicker.failedToUpdateBackgroundLabel")),
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
      setExpandedFolderId(folder.id);
    },
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<BackgroundLibraryFolder>(`/backgrounds/folders/${encodeURIComponent(id)}`, { name }),
    onSuccess: (updatedFolder) => {
      qc.setQueryData<BackgroundLibraryFolder[]>(BACKGROUND_FOLDER_QUERY_KEY, (current = []) =>
        current.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder)),
      );
      setEditingFolderId(null);
      setEditFolderName("");
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
      if (expandedFolderId === folderId) setExpandedFolderId(null);
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
      if (folderFilter === "unfiled") return !background.folderId;
      if (folderFilter !== "all") return background.folderId === folderFilter;
      return true;
    });
  }, [backgrounds, folderFilter, includedTags, searchQuery, sort, sourceFilter]);
  const folderFilterActive =
    searchQuery.trim().length > 0 || includedTags.size > 0 || sourceFilter !== "all" || folderFilter !== "all";
  const visibleRootBackgrounds = useMemo(
    () => visibleBackgrounds.filter((background) => !background.folderId),
    [visibleBackgrounds],
  );
  const selectedBackground = backgrounds.find((background) => background.url === selected) ?? null;
  const sourceCounts = useMemo(
    () => ({
      all: backgrounds.length,
      user: backgrounds.filter((background) => background.source !== "game_asset").length,
      game_asset: backgrounds.filter((background) => background.source === "game_asset").length,
    }),
    [backgrounds],
  );

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
    [onSelect, qc, refreshGameAssetManifest, localizeUi],
  );

  const addTag = useCallback(
    async (filename: string, currentTags: string[]) => {
      if (tagUpdatePendingRef.current) return;
      const tag = tagInput
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 _-]/g, "");
      if (!tag || currentTags.includes(tag)) return;
      tagUpdatePendingRef.current = true;
      try {
        await updateTags.mutateAsync({ filename, tags: [...currentTags, tag] });
        setTagInput("");
      } catch {
        toast.error(localizeUi("ui.panels.backgroundpicker.failedToUpdateBackgroundTags"));
      } finally {
        tagUpdatePendingRef.current = false;
      }
    },
    [tagInput, updateTags, localizeUi],
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

  const handleCreateFolder = useCallback(() => {
    createFolder.mutate(getNextBackgroundFolderName(folders));
  }, [createFolder, folders]);

  const commitFolderRename = useCallback(
    (folder: BackgroundLibraryFolder) => {
      const name = editFolderName.trim();
      if (!name || name === folder.name) {
        setEditingFolderId(null);
        setEditFolderName("");
        return;
      }
      renameFolder.mutate({ id: folder.id, name });
    },
    [editFolderName, renameFolder],
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

  const toggleBackgroundTags = useCallback((backgroundId: string) => {
    setExpandedBackgroundTagIds((current) => {
      const next = new Set(current);
      if (next.has(backgroundId)) next.delete(backgroundId);
      else next.add(backgroundId);
      return next;
    });
  }, []);

  const commitLabel = useCallback(
    (background: BackgroundLibraryItem) => {
      const label = labelInput.trim();
      if (label === (background.label ?? "")) {
        setEditingLabel(null);
        setLabelInput("");
        return;
      }
      updateLabel.mutate({ filename: background.filename, label: label || null });
    },
    [labelInput, updateLabel],
  );

  const renderBackground = (background: BackgroundLibraryItem) => {
    const isSelected = selected === background.url;
    const isDefaultRoleplay = defaultRoleplayBackground === background.url;
    const isUserBackground = background.source !== "game_asset";
    const isEditable = background.editable !== false && isUserBackground;
    const canRename = background.renameable !== false && isUserBackground;
    const canDelete = background.deletable !== false && isUserBackground;
    const isEditing = editingTags === background.id;
    const isEditingLabel = editingLabel === background.id;
    const areTagsExpanded = expandedBackgroundTagIds.has(background.id);
    const isRenaming = renamingFile === background.id;
    const title = getBackgroundLibraryTitle(background);
    const sourceLabel = localizeUi(
      background.source === "game_asset"
        ? "ui.panels.backgroundpicker.gameAsset"
        : "ui.panels.backgroundpicker.myUpload",
    );
    const datalistId = `background-tag-suggestions-${background.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const tagsId = `background-tags-${background.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

    return (
      <div
        key={background.id}
        data-background-id={background.id}
        data-touch-drag-card="background"
        draggable={!isRenaming}
        onDragStart={(event) => {
          draggedBackgroundIdRef.current = background.id;
          setDraggedBackgroundId(background.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-marinara-background-id", background.id);
          event.dataTransfer.setData("text/plain", background.id);
        }}
        onDragEnd={() => {
          draggedBackgroundIdRef.current = null;
          setDraggedBackgroundId(null);
        }}
        onMouseLeave={(event) => {
          const focused = event.currentTarget.ownerDocument.activeElement;
          if (
            focused instanceof HTMLElement &&
            event.currentTarget.contains(focused) &&
            !focused.matches(":focus-visible")
          ) {
            focused.blur();
          }
        }}
        className={cn(
          "group relative flex touch-pan-y items-start gap-2 rounded-xl p-1.5 transition-colors hover:bg-[var(--sidebar-accent)]/45",
          draggedBackgroundId === background.id && "opacity-50",
        )}
      >
        <TouchDragHandle
          label={localizeUi("ui.panels.backgroundpicker.dragValue1ToAFolder", { value1: title })}
          size="0.75rem"
          className="mt-1.5"
          onTouchStart={(event) => {
            startBackgroundTouchDrag(event, background.id, {
              allowInteractiveTarget: true,
              sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="background"]'),
            });
          }}
        />
        <button
          type="button"
          onClick={() => {
            onSelect(isSelected ? null : background.url);
            if (!isSelected) setOpen(false);
          }}
          className={cn(
            "relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors md:w-[4.5rem]",
            isSelected
              ? "border-[var(--primary)] shadow-md shadow-[var(--primary)]/20"
              : "border-transparent hover:border-[var(--muted-foreground)]/30",
          )}
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
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {isSelected && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Check size="0.875rem" className="text-white" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex min-w-0 items-center gap-1">
            {isRenaming ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (renameInput.trim()) {
                    renameBackground.mutate({ filename: background.filename, name: renameInput.trim() });
                  }
                }}
              >
                <input
                  type="text"
                  value={renameInput}
                  onChange={(event) => setRenameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setRenamingFile(null);
                    }
                  }}
                  className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[0.6875rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!renameInput.trim() || renameBackground.isPending}
                  className={INLINE_ACCENT_BUTTON_CLASS}
                >
                  {renameBackground.isPending ? "…" : localizeUi("ui.noodle.noodlehome.save")}
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  {isEditingLabel ? (
                    <form
                      className="flex min-w-0 items-center gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        commitLabel(background);
                      }}
                    >
                      <input
                        type="text"
                        value={labelInput}
                        maxLength={100}
                        onChange={(event) => setLabelInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            setEditingLabel(null);
                          }
                        }}
                        aria-label={localizeUi("ui.panels.backgroundpicker.labelForValue1", { value1: title })}
                        placeholder={localizeUi("ui.panels.backgroundpicker.backgroundLabelPlaceholder")}
                        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[0.6875rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                        autoFocus
                      />
                      <button type="submit" disabled={updateLabel.isPending} className={INLINE_ACCENT_BUTTON_CLASS}>
                        {updateLabel.isPending ? "…" : localizeUi("ui.noodle.noodlehome.save")}
                      </button>
                    </form>
                  ) : (
                    <>
                      <span
                        data-background-name
                        className="block truncate text-xs font-medium text-[var(--foreground)]"
                        title={title}
                      >
                        {title}
                      </span>
                      {background.label && (
                        <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                          {background.filename}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {isEditable && !isEditingLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      setLabelInput(background.label ?? "");
                      setEditingLabel(background.id);
                    }}
                    className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--primary)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
                    title={localizeUi("ui.panels.backgroundpicker.editLabel")}
                    aria-label={localizeUi("ui.panels.backgroundpicker.editLabelForValue1", { value1: title })}
                  >
                    <Type size="0.625rem" />
                  </button>
                )}
                {canRename && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameInput(background.filename.replace(/\.[^.]+$/, ""));
                      setRenamingFile(background.id);
                    }}
                    className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--primary)] group-hover:opacity-100 max-md:opacity-100"
                    title={localizeUi("ui.panels.backgroundpicker.renameBackground")}
                    aria-label={localizeUi("ui.panels.backgroundpicker.renameValue1", { value1: title })}
                  >
                    <Pencil size="0.625rem" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-0.5 flex min-h-7 items-center justify-between gap-1 md:min-h-6">
            <span
              className={cn(
                "rounded-full px-1.5 py-0 text-[0.5625rem]",
                background.source === "game_asset"
                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
              )}
            >
              {sourceLabel}
            </span>

            <div className="relative h-7 w-[3.875rem] shrink-0 md:h-6 md:w-[3.25rem]">
              {isDefaultRoleplay && (
                <span
                  data-background-default-indicator
                  className="pointer-events-none absolute right-0 top-0 hidden h-7 w-7 items-center justify-center text-amber-300 transition-opacity md:flex md:h-6 md:w-6 md:group-hover:opacity-0 md:group-focus-within:opacity-0"
                  aria-hidden="true"
                >
                  <Star size="0.75rem" fill="currentColor" />
                </span>
              )}

              <div
                data-background-actions
                className="absolute right-0 top-0 flex items-center gap-0.5 rounded-lg bg-[var(--sidebar)] p-0.5 opacity-100 shadow-sm ring-1 ring-[var(--border)] transition-all md:invisible md:gap-px md:opacity-0 md:group-hover:visible md:group-hover:opacity-100 md:group-focus-within:visible md:group-focus-within:opacity-100"
              >
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteBackground(background)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-accent)] transition-all hover:bg-[var(--marinara-chat-chrome-accent)]/12 focus-visible:bg-[var(--marinara-chat-chrome-accent)]/12 active:scale-90 md:h-5 md:w-5"
                    title={localizeUi("ui.panels.backgroundpicker.deleteBackground")}
                    aria-label={localizeUi("ui.panels.botbrowserpanel.deleteValue1", { value1: title })}
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                )}
                <button
                  type="button"
                  data-background-default-toggle
                  onClick={() => onDefaultChange(isDefaultRoleplay ? DEFAULT_ROLEPLAY_BACKGROUND_URL : background.url)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-all active:scale-90 md:h-5 md:w-5",
                    isDefaultRoleplay
                      ? "text-amber-300"
                      : "text-[var(--marinara-chat-chrome-accent)] hover:bg-[var(--marinara-chat-chrome-accent)]/12",
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
                  <Star size="0.75rem" fill={isDefaultRoleplay ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {background.tags.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (isEditing && areTagsExpanded) setEditingTags(null);
                  toggleBackgroundTags(background.id);
                }}
                className={cn(
                  "mari-chrome-control mari-chrome-control--compact md:!h-4 md:!min-h-4 md:!gap-0.5 md:!rounded-full md:!px-1 md:!py-0 md:!text-[0.5rem] md:[&>svg]:h-2 md:[&>svg]:w-2",
                  areTagsExpanded && "mari-chrome-control--selected",
                )}
                data-background-tags-toggle
                aria-controls={tagsId}
                aria-expanded={areTagsExpanded}
                aria-label={localizeUi(
                  areTagsExpanded
                    ? "ui.panels.backgroundpicker.hideTagsForValue1"
                    : "ui.panels.backgroundpicker.showTagsForValue1",
                  { value1: title },
                )}
              >
                <Tag size="0.625rem" />
                {localizeUi("ui.panels.backgroundpicker.tags")}
                {background.tags.length})
                <ChevronDown
                  size="0.625rem"
                  className={cn("transition-transform duration-200 ease-out", areTagsExpanded && "rotate-180")}
                />
              </button>
            )}
            {isEditable && (
              <button
                type="button"
                data-background-edit-tags
                onClick={() => {
                  setEditingTags(isEditing ? null : background.id);
                  setTagInput("");
                  if (!isEditing) {
                    setExpandedBackgroundTagIds((current) => new Set(current).add(background.id));
                  }
                }}
                className={cn(
                  "rounded-full p-1 opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100",
                  isEditing
                    ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                    : "text-[var(--muted-foreground)]/60 hover:text-[var(--primary)]",
                )}
                title={localizeUi("ui.panels.backgroundpicker.editTags")}
                aria-label={localizeUi("ui.panels.backgroundpicker.editTagsForValue1", { value1: title })}
                aria-pressed={isEditing}
              >
                <Tag size="0.625rem" />
              </button>
            )}
          </div>

          {areTagsExpanded && background.tags.length > 0 && (
            <div id={tagsId} className="mt-1 flex flex-wrap items-center gap-1">
              {background.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-full bg-[var(--secondary)] px-1.5 py-0 text-[0.5625rem] text-[var(--muted-foreground)]"
                >
                  {tag}
                  {isEditing && isEditable && (
                    <button
                      type="button"
                      onClick={() => void removeTag(background.filename, background.tags, tag)}
                      disabled={updateTags.isPending}
                      className="ml-0.5 rounded-full hover:text-[var(--destructive)]"
                      aria-label={localizeUi("ui.panels.backgroundpicker.removeTagValue1", { value1: tag })}
                    >
                      <X size="0.5rem" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {isEditing && isEditable && (
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addTag(background.filename, background.tags);
                  }
                  if (event.key === "Escape") setEditingTags(null);
                  if (event.key === "Escape") event.stopPropagation();
                }}
                placeholder={localizeUi("ui.panels.backgroundpicker.addTag")}
                className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                data-background-tag-input
                autoFocus
                list={datalistId}
              />
              <datalist id={datalistId}>
                {allTags
                  .filter((tag) => !background.tags.includes(tag))
                  .map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
              </datalist>
              <button
                type="button"
                onClick={() => void addTag(background.filename, background.tags)}
                disabled={!tagInput.trim() || updateTags.isPending}
                className={INLINE_ACCENT_BUTTON_CLASS}
              >
                {localizeUi("ui.panels.appearancesettings.add")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGridBackground = (background: BackgroundLibraryItem) => {
    const isSelected = selected === background.url;
    const isDefaultRoleplay = defaultRoleplayBackground === background.url;
    const isUserBackground = background.source !== "game_asset";
    const isEditable = background.editable !== false && isUserBackground;
    const canDelete = background.deletable !== false && isUserBackground;
    const title = getBackgroundLibraryTitle(background);

    return (
      <article
        key={background.id}
        data-background-id={background.id}
        className={cn(
          "group relative min-w-0 overflow-hidden rounded-xl bg-[var(--secondary)]/35 ring-1 transition-all",
          isSelected
            ? "ring-2 ring-[var(--primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
            : "ring-[var(--border)] hover:-translate-y-0.5 hover:ring-[var(--primary)]/45 hover:shadow-lg",
        )}
      >
        <button
          type="button"
          onClick={() => {
            onSelect(isSelected ? null : background.url);
            if (!isSelected) setOpen(false);
          }}
          className="relative block aspect-[16/10] w-full overflow-hidden bg-[var(--background)] text-left"
          aria-label={
            isSelected
              ? localizeUi("ui.panels.backgroundpicker.removeValue1FromThisChat", { value1: title })
              : localizeUi("ui.panels.backgroundpicker.useValue1ForThisChat", { value1: title })
          }
          aria-pressed={isSelected}
        >
          <img
            src={`${background.url}?w=${BACKGROUND_THUMBNAIL_WIDTH}`}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
            loading="lazy"
            decoding="async"
          />
          <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.5625rem] font-medium text-white/90 backdrop-blur-sm">
            {background.source === "game_asset"
              ? localizeUi("ui.panels.backgroundpicker.gameAsset")
              : localizeUi("ui.panels.backgroundpicker.myUpload")}
          </span>
          {isSelected && (
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg">
              <Check size="0.875rem" strokeWidth={3} />
            </span>
          )}
        </button>

        <div className="px-2.5 pb-2.5 pt-2">
          <div className="flex min-w-0 items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-semibold text-[var(--foreground)]" title={title}>
                {title}
              </h3>
              <p className="mt-0.5 truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                {background.label ? background.filename : background.originalName || background.filename}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {isEditable && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("list");
                    setExpandedFolderId(background.folderId);
                    setLabelInput(background.label ?? "");
                    setEditingLabel(background.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title={localizeUi("ui.panels.backgroundpicker.editLabel")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.editLabelForValue1", { value1: title })}
                >
                  <Type size="0.6875rem" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDefaultChange(isDefaultRoleplay ? DEFAULT_ROLEPLAY_BACKGROUND_URL : background.url)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  isDefaultRoleplay
                    ? "bg-amber-300/12 text-amber-300"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-amber-300",
                )}
                title={
                  isDefaultRoleplay
                    ? localizeUi("ui.panels.backgroundpicker.removeAsRoleplayDefault")
                    : localizeUi("ui.panels.backgroundpicker.setAsDefaultForNewRoleplayChats")
                }
                aria-pressed={isDefaultRoleplay}
              >
                <Star size="0.75rem" fill={isDefaultRoleplay ? "currentColor" : "none"} />
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void handleDeleteBackground(background)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/12 hover:text-[var(--destructive)]"
                  title={localizeUi("ui.panels.backgroundpicker.deleteBackground")}
                  aria-label={localizeUi("ui.panels.botbrowserpanel.deleteValue1", { value1: title })}
                >
                  <Trash2 size="0.6875rem" />
                </button>
              )}
            </div>
          </div>
          {background.tags.length > 0 && (
            <div className="mt-2 flex min-w-0 items-center gap-1 overflow-hidden">
              {background.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="max-w-28 truncate rounded-full bg-[var(--background)]/65 px-1.5 py-0.5 text-[0.5rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/60"
                >
                  {tag}
                </span>
              ))}
              {background.tags.length > 2 && (
                <span className="text-[0.5rem] text-[var(--muted-foreground)]">+{background.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="flex items-center gap-3 p-2.5">
          <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--background)] ring-1 ring-[var(--border)]">
            {selected ? (
              <img
                src={`${selected}?w=${BACKGROUND_THUMBNAIL_WIDTH}`}
                alt=""
                className="h-full w-full object-cover"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]/45">
                <Image size="1.25rem" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-[var(--foreground)]">
              {selectedBackground
                ? getBackgroundLibraryTitle(selectedBackground)
                : localizeUi("ui.panels.backgroundpicker.defaultBackground")}
            </div>
            <div className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {selectedBackground?.label
                ? selectedBackground.filename
                : localizeUi("ui.panels.backgroundpicker.value1BackgroundsAvailable", { value1: backgrounds.length })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mari-chrome-control mari-chrome-control--small mari-chrome-control--selected"
              >
                <Image size="0.75rem" />
                {localizeUi("ui.panels.backgroundpicker.browseLibrary")}
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={() => onSelect(null)}
                  className="mari-chrome-control mari-chrome-control--small text-[var(--destructive)]"
                >
                  <X size="0.75rem" />
                  {localizeUi("ui.panels.backgroundpicker.clearSelection")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={localizeUi("ui.panels.backgroundpicker.backgroundLibrary")}
        width="max-w-4xl"
        mobileFullscreen
        panelClassName="sm:h-[min(88dvh,52rem)]"
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

            <div className="flex min-w-0 items-center gap-1.5">
              <label className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                <span className="sr-only">{localizeUi("ui.panels.backgroundpicker.filterByFolder")}</span>
                <select
                  value={folderFilter}
                  onChange={(event) => setFolderFilter(event.target.value)}
                  className="mari-chrome-field h-9 w-full px-2 py-0 text-[0.6875rem]"
                >
                  <option value="all">{localizeUi("ui.panels.backgroundpicker.allFolders")}</option>
                  <option value="unfiled">{localizeUi("ui.panels.backgroundpicker.unfiled")}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="flex shrink-0 rounded-lg bg-[var(--background)]/70 p-0.5 ring-1 ring-[var(--border)]/70"
                role="group"
                aria-label={localizeUi("ui.panels.backgroundpicker.viewMode")}
              >
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-[var(--primary)]/16 text-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                  title={localizeUi("ui.panels.backgroundpicker.gridView")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.gridView")}
                  aria-pressed={viewMode === "grid"}
                >
                  <LayoutGrid size="0.8125rem" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-[var(--primary)]/16 text-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                  title={localizeUi("ui.panels.backgroundpicker.listView")}
                  aria-label={localizeUi("ui.panels.backgroundpicker.listView")}
                  aria-pressed={viewMode === "list"}
                >
                  <List size="0.8125rem" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={createFolder.isPending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                title={localizeUi("ui.panels.backgroundpicker.newFolder")}
                aria-label={localizeUi("ui.panels.backgroundpicker.newFolder")}
              >
                {createFolder.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <FolderPlus size="0.75rem" />
                )}
              </button>
            </div>
          </div>

          {viewMode === "list" && (
            <p className="mari-folder-helper">
              {localizeUi("ui.panels.backgroundpicker.dragAndDropBackgroundsToFoldersDoubleClickOr")}
            </p>
          )}

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
                {localizeUi("ui.panels.backgroundpicker.tags")}
                {allTags.length})
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

          {viewMode === "grid" && backgrounds.length > 0 && visibleBackgrounds.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {visibleBackgrounds.map(renderGridBackground)}
            </div>
          )}

          {viewMode === "list" && backgrounds.length > 0 && visibleBackgrounds.length > 0 && (
            <div
              data-background-folder-root
              onDragOver={(event) => {
                if (draggedBackgroundIdRef.current) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const backgroundId = parseDraggedBackgroundId(
                  event.dataTransfer.getData("application/x-marinara-background-id") ||
                    event.dataTransfer.getData("text/plain"),
                );
                if (backgroundId) assignBackground(backgroundId, null);
              }}
              className="flex flex-col gap-1"
            >
              {folders
                .filter((folder) => folderFilter === "all" || folderFilter === folder.id)
                .map((folder) => {
                  const folderBackgrounds = visibleBackgrounds.filter(
                    (background) => background.folderId === folder.id,
                  );
                  const isExpanded =
                    (folderFilterActive && folderBackgrounds.length > 0) || expandedFolderId === folder.id;
                  const isEditing = editingFolderId === folder.id;
                  const totalFolderItems = backgrounds.filter((background) => background.folderId === folder.id).length;

                  return (
                    <div
                      key={folder.id}
                      data-background-folder-id={folder.id}
                      onDragOver={(event) => {
                        if (draggedBackgroundIdRef.current) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const backgroundId = parseDraggedBackgroundId(
                          event.dataTransfer.getData("application/x-marinara-background-id") ||
                            event.dataTransfer.getData("text/plain"),
                        );
                        if (backgroundId) assignBackground(backgroundId, folder.id);
                      }}
                      className="flex flex-col rounded-lg transition-colors"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        aria-label={localizeUi("ui.panels.agentspanel.value1FolderValue2DoubleTapOrPressF2To", {
                          value1: isExpanded
                            ? localizeUi("ui.panels.ttsconfigcard.collapse")
                            : localizeUi("ui.panels.ttsconfigcard.expand"),
                          value2: folder.name,
                        })}
                        title={localizeUi("ui.panels.backgroundpicker.doubleClickDoubleTapOrPressF2ToRename")}
                        className="group/folder relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--sidebar-accent)]/40"
                        onClick={(event) =>
                          handleFolderRenameGesture(folder.id, event, {
                            onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                            onRename: () => {
                              setEditingFolderId(folder.id);
                              setEditFolderName(folder.name);
                            },
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          handleFolderRenameKeyDown(event, {
                            onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                            onRename: () => {
                              setEditingFolderId(folder.id);
                              setEditFolderName(folder.name);
                            },
                          });
                        }}
                      >
                        <ChevronRight
                          size="0.75rem"
                          className={cn(
                            "mari-chrome-accent-icon mari-accent-animated shrink-0 transition-transform duration-200 ease-out",
                            isExpanded && "rotate-90",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editFolderName}
                              onChange={(event) => setEditFolderName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                                if (event.key === "Escape") {
                                  setEditingFolderId(null);
                                  setEditFolderName("");
                                }
                              }}
                              onClick={(event) => event.stopPropagation()}
                              onBlur={() => commitFolderRename(folder)}
                              className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-medium outline-none ring-1 ring-[var(--marinara-chat-chrome-input-border-focus)]"
                            />
                          ) : (
                            <div className="truncate text-xs font-medium text-[var(--muted-foreground)]">
                              {folder.name}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 pr-8 text-[0.5625rem] text-[var(--muted-foreground)]">
                          {folderFilterActive ? folderBackgrounds.length : totalFolderItems}
                        </span>
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center rounded-lg bg-[var(--sidebar)] px-0.5 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover/folder:opacity-100 max-md:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteFolder(folder, totalFolderItems);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/12 active:scale-90"
                            title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
                            aria-label={localizeUi("ui.panels.backgroundpicker.deleteFolderValue1", {
                              value1: folder.name,
                            })}
                          >
                            <Trash2 size="0.75rem" />
                          </button>
                        </div>
                      </div>

                      <SmoothFolderContent
                        open={isExpanded}
                        className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
                        innerClassName="flex flex-col gap-0.5"
                      >
                        {folderBackgrounds.length === 0 ? (
                          <div className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">
                            {localizeUi("ui.panels.backgroundpicker.dropBackgroundsHere")}
                          </div>
                        ) : (
                          folderBackgrounds.map(renderBackground)
                        )}
                      </SmoothFolderContent>
                    </div>
                  );
                })}

              {(folderFilter === "all" || folderFilter === "unfiled") && visibleRootBackgrounds.map(renderBackground)}
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
