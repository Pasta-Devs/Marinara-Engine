import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Download, Trash2, Upload, X } from "lucide-react";

import { ImageUploadDropzone } from "../../../../shared/components/ui/ImageUploadDropzone";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import {
  type CharacterGalleryImage,
  useCharacterGalleryImages,
  useDeleteCharacterGalleryImage,
  useUploadCharacterGalleryImage,
} from "../hooks/use-characters";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterGalleryTab({ characterId, characterName }: { characterId: string; characterName?: string }) {
  const { data: images, isLoading } = useCharacterGalleryImages(characterId);
  const upload = useUploadCharacterGalleryImage(characterId);
  const remove = useDeleteCharacterGalleryImage(characterId);
  const [lightbox, setLightbox] = useState<CharacterGalleryImage | null>(null);
  const lightboxDialogRef = useRef<HTMLDivElement>(null);
  const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxPreviousFocusRef = useRef<HTMLElement | null>(null);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    lightboxPreviousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lightboxCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = lightboxDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previousFocus = lightboxPreviousFocusRef.current;
      lightboxPreviousFocusRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [closeLightbox, lightbox]);

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      upload.mutate(files, {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to upload character gallery images.");
        },
      });
    },
    [upload],
  );

  const handleDelete = useCallback(
    async (image: CharacterGalleryImage) => {
      if (
        !(await showConfirmDialog({
          title: "Delete Character Image",
          message: "Delete this character gallery image?",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }
      remove.mutate(image.id);
      if (lightbox?.id === image.id) setLightbox(null);
    },
    [lightbox?.id, remove],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Character Gallery"
        subtitle="Keep reference art, alternate outfits, and other character images attached to this character even if chats get deleted."
      />

      <ImageUploadDropzone
        label="Upload Character Images"
        pending={upload.isPending}
        pendingLabel="Uploading…"
        dragLabel="Drop character images to upload"
        onFilesSelected={handleUpload}
        icon={<Upload size="1rem" />}
        className="w-full"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer aspect-square rounded-xl" />
          ))}
        </div>
      ) : images && images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
            >
              <button
                type="button"
                className="block aspect-square w-full bg-[var(--secondary)]"
                onClick={() => setLightbox(image)}
              >
                <img
                  src={image.url}
                  alt={image.prompt || characterName || "Character image"}
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                <span className="max-w-[8rem] truncate text-[0.6875rem] font-medium text-white/85">
                  {new Date(image.createdAt).toLocaleDateString()}
                </span>
                <div className="flex gap-1">
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
                    onClick={() => void handleDelete(image)}
                    className="rounded-lg bg-red-500/35 p-1.5 text-white transition-colors hover:bg-red-500/55"
                    title="Delete"
                  >
                    <Trash2 size="0.75rem" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Camera size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No character images yet</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              Upload images here to keep them tied to {characterName || "this character"} instead of a specific chat.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
        <h4 className="mb-1.5 text-xs font-semibold">How this differs from chat gallery</h4>
        <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <li>• These images belong to the character, so deleting a chat does not remove them.</li>
          <li>• Use this for reference sheets, outfit variants, or imported ST-style character image packs.</li>
          <li>• Chat gallery is still best for scene-specific illustrations and generated message attachments.</li>
        </ul>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.prompt || characterName || "Character image preview"}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
          onClick={closeLightbox}
        >
          <div
            ref={lightboxDialogRef}
            tabIndex={-1}
            className="relative max-h-[90vh] max-w-[90vw] w-[min(90vw,90vh)]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.prompt || characterName || "Character image"}
              className="max-h-[85vh] w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <a
                href={lightbox.url}
                download
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              >
                <Download size="0.875rem" />
              </a>
              <button
                ref={lightboxCloseButtonRef}
                type="button"
                onClick={closeLightbox}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
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
