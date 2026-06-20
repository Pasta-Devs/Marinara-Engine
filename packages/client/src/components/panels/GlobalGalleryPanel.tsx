// ──────────────────────────────────────────────
// Panel: Global Gallery — profile-wide images + flat folders
// ──────────────────────────────────────────────
import { useCallback, useMemo, useState } from "react";
import { Upload, Download, Trash2, X, FolderPlus, Check, Folder } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { CustomEmojiTagButton } from "../ui/CustomEmojiTagButton";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import {
  useGlobalGalleryImages,
  useGalleryFolders,
  useUploadGlobalGalleryImages,
  useDeleteGlobalGalleryImage,
  useMoveGlobalGalleryImage,
  useTagGlobalGalleryImage,
  useCreateGalleryFolder,
  useRenameGalleryFolder,
  useDeleteGalleryFolder,
  type GlobalGalleryImage,
} from "../../hooks/use-global-gallery";

type SortMode = "newest" | "oldest";
type FolderFilter = "all" | "unfiled" | string;

export function GlobalGalleryPanel() {
  const { data: images, isLoading } = useGlobalGalleryImages();
  const { data: folders } = useGalleryFolders();
  const upload = useUploadGlobalGalleryImages();
  const removeImage = useDeleteGlobalGalleryImage();
  const moveImage = useMoveGlobalGalleryImage();
  const tag = useTagGlobalGalleryImage();
  const createFolder = useCreateGalleryFolder();
  const renameFolder = useRenameGalleryFolder();
  const deleteFolder = useDeleteGalleryFolder();

  const [activeFolder, setActiveFolder] = useState<FolderFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [lightbox, setLightbox] = useState<GlobalGalleryImage | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dragImageId, setDragImageId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<FolderFilter | null>(null);
  const handleFolderRenameGesture = useFolderRenameGesture();

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>();
    let unfiled = 0;
    for (const img of images ?? []) {
      if (img.folderId) byFolder.set(img.folderId, (byFolder.get(img.folderId) ?? 0) + 1);
      else unfiled += 1;
    }
    return { byFolder, unfiled, total: images?.length ?? 0 };
  }, [images]);

  const visibleImages = useMemo(() => {
    let list = images ?? [];
    if (activeFolder === "unfiled") list = list.filter((img) => !img.folderId);
    else if (activeFolder !== "all") list = list.filter((img) => img.folderId === activeFolder);
    return [...list].sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [images, activeFolder, sort]);

  // Uploads land in the active folder; in All / Unfiled views they go to root.
  const uploadFolderId = activeFolder !== "all" && activeFolder !== "unfiled" ? activeFolder : null;
  const activeFolderObj = folders?.find((f) => f.id === activeFolder) ?? null;

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      upload.mutate({ files, folderId: uploadFolderId }, { onError: (err) => toast.error(err.message) });
    },
    [upload, uploadFolderId],
  );

  const handleDeleteImage = useCallback(
    async (image: GlobalGalleryImage) => {
      if (
        !(await showConfirmDialog({
          title: "Delete Image",
          message: "Delete this gallery image?",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }
      removeImage.mutate(image.id, {
        onSuccess: () => {
          if (lightbox?.id === image.id) setLightbox(null);
        },
        onError: (err) => toast.error(err.message),
      });
    },
    [lightbox?.id, removeImage],
  );

  const handleMove = useCallback(
    (imageId: string, folderId: string | null) => {
      moveImage.mutate(
        { id: imageId, folderId },
        {
          onSuccess: () => {
            setLightbox((current) => (current?.id === imageId ? { ...current, folderId } : current));
          },
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [moveImage],
  );

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder.mutate(name, {
      onSuccess: () => {
        setNewFolderName("");
        setCreatingFolder(false);
      },
      onError: (err) => toast.error(err.message),
    });
  }, [createFolder, newFolderName]);

  const handleRenameFolder = useCallback(() => {
    if (!activeFolderObj) return;
    const name = renameValue.trim();
    if (!name || name === activeFolderObj.name) {
      setRenaming(false);
      return;
    }
    renameFolder.mutate(
      { id: activeFolderObj.id, name },
      { onSuccess: () => setRenaming(false), onError: (err) => toast.error(err.message) },
    );
  }, [activeFolderObj, renameFolder, renameValue]);

  const handleDeleteFolder = useCallback(async () => {
    if (!activeFolderObj) return;
    const count = counts.byFolder.get(activeFolderObj.id) ?? 0;
    if (
      !(await confirmNonEmptyFolderDelete(count, {
        title: "Delete Folder",
        message: `Delete "${activeFolderObj.name}"? Its ${count} image${
          count === 1 ? "" : "s"
        } will move to Unfiled.`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    deleteFolder.mutate(activeFolderObj.id, {
      onSuccess: () => setActiveFolder("all"),
      onError: (err) => toast.error(err.message),
    });
  }, [activeFolderObj, counts.byFolder, deleteFolder]);

  const onDropToFolder = useCallback(
    (folderId: string | null) => {
      if (dragImageId) handleMove(dragImageId, folderId);
      setDragImageId(null);
      setDragOverFolder(null);
    },
    [dragImageId, handleMove],
  );

  const chip = (key: FolderFilter, label: string, count: number, dropTarget: boolean, renamable = false) => (
    <button
      key={key}
      type="button"
      onClick={(event) => {
        if (!renamable) {
          setActiveFolder(key);
          return;
        }
        handleFolderRenameGesture(key, event, {
          onSingleClick: () => setActiveFolder(key),
          onRename: () => {
            setActiveFolder(key);
            setRenameValue(label);
            setRenaming(true);
          },
        });
      }}
      onKeyDown={
        renamable
          ? (event) =>
              handleFolderRenameKeyDown(event, {
                onSingleClick: () => setActiveFolder(key),
                onRename: () => {
                  setActiveFolder(key);
                  setRenameValue(label);
                  setRenaming(true);
                },
              })
          : undefined
      }
      aria-label={renamable ? `${label}. Press F2 to rename.` : label}
      title={renamable ? `${label}. Double-click or press F2 to rename.` : undefined}
      onDragOver={dropTarget ? (e) => e.preventDefault() : undefined}
      onDragEnter={dropTarget ? () => setDragOverFolder(key) : undefined}
      onDragLeave={dropTarget ? () => setDragOverFolder((cur) => (cur === key ? null : cur)) : undefined}
      onDrop={dropTarget ? () => onDropToFolder(key === "unfiled" ? null : key) : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        activeFolder === key
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]",
        dropTarget && dragOverFolder === key && "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--card)]",
      )}
    >
      {label}
      <span className="text-[0.625rem] opacity-60">{count}</span>
    </button>
  );

  return (
    <div className="space-y-4 p-4">
      {/* Sort */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--muted-foreground)]">
          {counts.total} image{counts.total === 1 ? "" : "s"}
        </span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* Folder chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chip("all", "All", counts.total, false)}
        {chip("unfiled", "Unfiled", counts.unfiled, true)}
        {folders?.map((folder) => chip(folder.id, folder.name, counts.byFolder.get(folder.id) ?? 0, true, true))}
        {creatingFolder ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }
              }}
              placeholder="Folder name"
              className="w-28 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              className="rounded-full p-1 text-[var(--primary)] hover:bg-[var(--accent)]"
              title="Create"
            >
              <Check size="0.75rem" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingFolder(false);
                setNewFolderName("");
              }}
              className="rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              title="Cancel"
            >
              <X size="0.75rem" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
          >
            <FolderPlus size="0.75rem" />
            New
          </button>
        )}
      </div>

      {/* Active folder actions */}
      {activeFolderObj && (
        <div className="flex items-center gap-2">
          {renaming ? (
            <>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameFolder();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="w-40 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={handleRenameFolder}
                className="rounded-lg p-1.5 text-[var(--primary)] hover:bg-[var(--accent)]"
                title="Save"
              >
                <Check size="0.75rem" />
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                title="Cancel"
              >
                <X size="0.75rem" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleDeleteFolder()}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            >
              <Trash2 size="0.75rem" />
              Delete folder
            </button>
          )}
        </div>
      )}

      <ImageUploadDropzone
        label={activeFolderObj ? `Upload to "${activeFolderObj.name}"` : "Upload Images"}
        pending={upload.isPending}
        pendingLabel="Uploading…"
        dragLabel="Drop images to upload"
        onFilesSelected={handleUpload}
        icon={<Upload size="1rem" />}
        className="w-full"
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer aspect-square rounded-xl" />
          ))}
        </div>
      ) : visibleImages.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
          {visibleImages.map((image) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => setDragImageId(image.id)}
              onDragEnd={() => {
                setDragImageId(null);
                setDragOverFolder(null);
              }}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md",
                dragImageId === image.id && "opacity-50",
              )}
            >
              <CustomEmojiTagButton
                image={image}
                onApply={(patch) => tag.mutate({ imageId: image.id, patch }, { onError: (err) => toast.error(err.message) })}
              />
              <button
                type="button"
                className="block aspect-square w-full bg-[var(--secondary)]"
                onClick={() => setLightbox(image)}
              >
                <img src={image.url} alt={image.prompt || "Gallery image"} className="h-full w-full object-cover" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                <a
                  href={image.url}
                  download
                  className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size="0.75rem" />
                </a>
                <button
                  type="button"
                  onClick={() => void handleDeleteImage(image)}
                  className="rounded-lg bg-red-500/35 p-1.5 text-white transition-colors hover:bg-red-500/55"
                  title="Delete"
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Folder size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {activeFolder === "all" ? "No images yet" : "Nothing in this folder"}
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] w-[min(90vw,90vh)] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.prompt || "Gallery image"}
              className="max-h-[80vh] w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-center gap-2">
              <select
                value={lightbox.folderId ?? ""}
                onChange={(e) => handleMove(lightbox.id, e.target.value || null)}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--foreground)]"
              >
                <option value="">Unfiled</option>
                {folders?.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <a
                href={lightbox.url}
                download
                className="rounded-lg bg-[var(--card)] p-2 text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                title="Download"
              >
                <Download size="0.875rem" />
              </a>
              <button
                type="button"
                onClick={() => void handleDeleteImage(lightbox)}
                className="rounded-lg bg-[var(--card)] p-2 text-[var(--destructive)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--destructive)]/10"
                title="Delete"
              >
                <Trash2 size="0.875rem" />
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-lg bg-[var(--card)] p-2 text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                title="Close"
              >
                <X size="0.875rem" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
