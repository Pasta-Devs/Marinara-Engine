// ──────────────────────────────────────────────
// Chat Gallery — Image grid for per-chat generated images
// ──────────────────────────────────────────────
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Paintbrush, Trash2, X, Download, Sparkles, Pin, Loader2, Images, Search } from "lucide-react";
import {
  useChatAssetBrowser,
  useGalleryImages,
  useUploadGalleryImage,
  useDeleteGalleryImage,
  type ChatAssetBrowserItem,
  type ChatImage,
} from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import { toast } from "sonner";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { buildCardAssetMarkdown, dispatchCardAssetInsert } from "../../lib/card-asset-links";
import { ChatImageLightbox, getChatImageDownloadName } from "./ChatImageLightbox";

interface ChatGalleryProps {
  chatId: string;
  mode?: string;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
}

function formatAssetKind(asset: ChatAssetBrowserItem) {
  if (asset.kind === "chat-gallery") return "Chat gallery";
  if (asset.kind === "character-gallery") return "Character gallery";
  if (asset.kind === "persona-gallery") return "Persona gallery";
  return "Sprite";
}

function getAssetMeta(asset: ChatAssetBrowserItem) {
  const details = [asset.ownerName, formatAssetKind(asset)];
  if (asset.width && asset.height) details.push(`${asset.width} x ${asset.height}`);
  return details.join(" | ");
}

export function ChatGallery({ chatId, mode, onIllustrate }: ChatGalleryProps) {
  const { data: images, isLoading } = useGalleryImages(chatId);
  const upload = useUploadGalleryImage(chatId);
  const remove = useDeleteGalleryImage(chatId);
  const [lightbox, setLightbox] = useState<ChatImage | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [assetBrowserOpen, setAssetBrowserOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const isIllustrating = useGalleryStore((s) => s.illustratingChatIds.has(chatId));
  const pinImage = useGalleryStore((s) => s.pinImage);
  const setChatIllustrating = useGalleryStore((s) => s.setChatIllustrating);
  const canBrowseAssets = mode === "roleplay";
  const { data: assetItems, isLoading: assetsLoading } = useChatAssetBrowser(chatId, canBrowseAssets && assetBrowserOpen);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    const items = assetItems ?? [];
    if (!query) return items;
    return items.filter((asset) =>
      [asset.name, asset.ownerName, asset.prompt, formatAssetKind(asset)].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [assetItems, assetSearch]);

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

  const handlePinImage = useCallback(
    (image: ChatImage) => {
      pinImage({ ...image, chatId });
    },
    [chatId, pinImage],
  );

  const handleInsertAsset = useCallback(
    (asset: ChatAssetBrowserItem) => {
      const label = asset.prompt.trim() || asset.name;
      dispatchCardAssetInsert(buildCardAssetMarkdown(label, asset.cardUrl), chatId);
      toast.success("Image link inserted.");
      setAssetBrowserOpen(false);
    },
    [chatId],
  );

  return (
    <>
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

        {canBrowseAssets && (
          <button
            type="button"
            onClick={() => setAssetBrowserOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--secondary)] px-4 py-3 text-xs font-medium text-[var(--foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <Images size="1rem" />
            Browse Images
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
                className="group relative overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-transparent transition-all hover:ring-[var(--primary)]/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--primary)]"
              >
                <button
                  type="button"
                  onClick={() => setLightbox(img)}
                  className="block w-full"
                  aria-label="Open gallery image"
                >
                  <img
                    src={img.url}
                    alt={img.prompt || "Gallery image"}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
                {/* Overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                  <div className="flex w-full items-center justify-between p-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handlePinImage(img)}
                        aria-label="Pin image to chat"
                        className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                        title="Pin to chat"
                      >
                        <Pin size="0.75rem" />
                      </button>
                      <a
                        href={img.url}
                        download={getChatImageDownloadName(img)}
                        aria-label="Download gallery image"
                        className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                        title="Download image"
                      >
                        <Download size="0.75rem" />
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(img.id)}
                      aria-label="Delete gallery image"
                      className="pointer-events-auto rounded-md bg-red-500/40 p-1.5 text-white transition-colors hover:bg-red-500/60"
                    >
                      <Trash2 size="0.75rem" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset browser */}
      {portalRoot &&
        assetBrowserOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]">
            <div className="flex max-h-[88vh] w-[min(58rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl bg-[var(--background)] shadow-2xl ring-1 ring-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Images size="1rem" className="text-[var(--muted-foreground)]" />
                  Browse Images
                </h3>
                <button
                  type="button"
                  onClick={() => setAssetBrowserOpen(false)}
                  aria-label="Close image browser"
                  className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                >
                  <X size="1rem" />
                </button>
              </div>

              <div className="border-b border-[var(--border)] p-3">
                <label className="relative block">
                  <Search
                    size="0.875rem"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    type="search"
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search images"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {assetsLoading && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted-foreground)]">
                    <Loader2 size="1rem" className="animate-spin" />
                    Loading images…
                  </div>
                )}

                {!assetsLoading && filteredAssets.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-10 text-[var(--muted-foreground)]">
                    <Images size="1.5rem" className="opacity-45" />
                    <p className="text-xs">No images found</p>
                  </div>
                )}

                {!assetsLoading && filteredAssets.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleInsertAsset(asset)}
                        className="group overflow-hidden rounded-lg bg-[var(--secondary)] text-left ring-1 ring-[var(--border)] transition-all hover:ring-[var(--primary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        aria-label={`Insert ${asset.name}`}
                      >
                        <img
                          src={asset.url}
                          alt={asset.prompt || asset.name}
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <span className="block space-y-1 p-2">
                          <span className="block truncate text-xs font-medium text-[var(--foreground)]">
                            {asset.prompt || asset.name}
                          </span>
                          <span className="block truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                            {getAssetMeta(asset)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          portalRoot,
        )}

      {/* Delete confirmation */}
      {portalRoot &&
        confirmDeleteId &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]">
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
          </div>,
          portalRoot,
        )}

      {/* Lightbox */}
      {lightbox && (
        <ChatImageLightbox image={lightbox} onPin={handlePinImage} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
