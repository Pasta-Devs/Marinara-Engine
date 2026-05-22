// ──────────────────────────────────────────────
// Chat Gallery — Image grid for per-chat generated images
// ──────────────────────────────────────────────
import { useCallback, useState } from "react";
import { ImagePlus, Paintbrush, Trash2, X, ZoomIn, Download, Sparkles, Pin, Minimize2, Loader2 } from "lucide-react";
import {
  useGalleryImages,
  useUploadGalleryImage,
  useDeleteGalleryImage,
  type ChatImage,
} from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { toast } from "sonner";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";

interface ChatGalleryProps {
  chatId: string;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
}

function formatImageMeta(image: ChatImage) {
  const details: string[] = [];
  if (image.model) details.push(image.model);
  if (image.provider) details.push(image.provider.replace(/_/g, " "));
  if (image.width && image.height) details.push(`${image.width} x ${image.height}`);
  return details.join(" | ");
}

export function ChatGallery({ chatId, onIllustrate }: ChatGalleryProps) {
  const { data: images, isLoading } = useGalleryImages(chatId);
  const upload = useUploadGalleryImage(chatId);
  const remove = useDeleteGalleryImage(chatId);
  const [lightbox, setLightbox] = useState<ChatImage | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isIllustrating = useGalleryStore((s) => s.illustratingChatIds.has(chatId));
  const pinImage = useGalleryStore((s) => s.pinImage);
  const setChatIllustrating = useGalleryStore((s) => s.setChatIllustrating);
  const lightboxPrompt = lightbox?.prompt.trim() ?? "";
  const lightboxMeta = lightbox ? formatImageMeta(lightbox) : "";

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      upload.mutate(files);
    },
    [upload],
  );

  const handleDelete = (id: string) => {
    remove.mutate(id);
    setConfirmDeleteId(null);
    if (lightbox?.id === id) setLightbox(null);
  };

  const handleIllustrate = async () => {
    if (!onIllustrate || useGalleryStore.getState().illustratingChatIds.has(chatId)) return;

    setChatIllustrating(chatId, true);
    try {
      await onIllustrate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setChatIllustrating(chatId, false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Illustrate button */}
      {onIllustrate && (
        <button
          type="button"
          onClick={() => void handleIllustrate()}
          disabled={isIllustrating}
          aria-busy={isIllustrating}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-4 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
        >
          {isIllustrating ? <Loader2 size="1rem" className="animate-spin" /> : <Paintbrush size="1rem" />}
          {isIllustrating ? "Generating image..." : "Illustrate"}
        </button>
      )}

      {isIllustrating && (
        <div
          className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]"
          role="status"
          aria-live="polite"
        >
          AI image generation is running. The new image will appear here when it finishes.
        </div>
      )}

      <ImageUploadDropzone
        label="Upload Images"
        pending={upload.isPending}
        pendingLabel="Uploading…"
        dragLabel="Drop images to upload"
        onFilesSelected={handleUpload}
        icon={<ImagePlus size="1rem" />}
      />

      {/* Loading state */}
      {isLoading && <p className="text-center text-xs text-[var(--muted-foreground)]">Loading gallery…</p>}

      {/* Empty state */}
      {!isLoading && (!images || images.length === 0) && (
        <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted-foreground)]">
          <Sparkles size="1.5rem" className="opacity-40" />
          <p className="text-xs">No images yet</p>
          <p className="text-[0.625rem] opacity-60">Upload images or generate them to build your gallery</p>
        </div>
      )}

      {/* Image grid */}
      {images && images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-transparent transition-all hover:ring-[var(--primary)]/40 hover:shadow-lg"
            >
              <img
                src={img.url}
                alt={img.prompt || "Gallery image"}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                onClick={() => setLightbox(img)}
              />
              {/* Overlay */}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex w-full items-center justify-between p-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setLightbox(img)}
                      aria-label="View image fullscreen"
                      className="rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                      title="View fullscreen"
                    >
                      <ZoomIn size="0.75rem" />
                    </button>
                    <button
                      type="button"
                      onClick={() => pinImage(img)}
                      aria-label="Pin image to chat"
                      className="rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                      title="Pin to chat"
                    >
                      <Pin size="0.75rem" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(img.id)}
                    aria-label="Delete gallery image"
                    className="rounded-md bg-red-500/40 p-1.5 text-white transition-colors hover:bg-red-500/60"
                  >
                    <Trash2 size="0.75rem" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]">
          <div className="mx-4 rounded-xl bg-[var(--background)] p-5 shadow-2xl ring-1 ring-[var(--border)]">
            <p className="mb-4 text-sm font-medium">Delete this image?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs transition-colors hover:bg-[var(--accent)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex min-h-0 max-w-full justify-center">
              <img
                src={lightbox.url}
                alt={lightbox.prompt || "Gallery image"}
                decoding="async"
                className={
                  lightboxPrompt || lightboxMeta
                    ? "max-h-[calc(90vh-10rem)] max-w-full rounded-lg object-contain shadow-2xl"
                    : "max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
                }
              />
              {/* Controls */}
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    pinImage(lightbox);
                    setLightbox(null);
                  }}
                  aria-label="Pin image to chat"
                  className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                  title="Pin to chat"
                >
                  <Minimize2 size="0.875rem" />
                </button>
                <a
                  href={lightbox.url}
                  download
                  aria-label="Download image"
                  className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                >
                  <Download size="0.875rem" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  aria-label="Close image"
                  className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                >
                  <X size="0.875rem" />
                </button>
              </div>
            </div>
            <ImagePromptPanel prompt={lightboxPrompt} meta={lightboxMeta} className="w-full max-w-3xl" />
          </div>
        </div>
      )}
    </div>
  );
}
