import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "../../hooks/use-backdrop-dismiss";
import { Download, Pin, RefreshCw, X } from "lucide-react";
import { parseChatImageGenerationRecord, type GeneratedSceneVideo } from "@marinara-engine/shared";
import { useGalleryImages, type ChatImage } from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import { ImageDownloadButton } from "../ui/ImageDownloadButton";
import { cn } from "../../lib/utils";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { ImageRegeneratePanel } from "./ImageRegeneratePanel";
import { useTranslation as useUiTranslation } from "react-i18next";

export function formatChatImageMeta(image: Pick<ChatImage, "model" | "provider" | "width" | "height">) {
  const details: string[] = [];
  if (image.model) details.push(image.model);
  if (image.provider) details.push(image.provider.replace(/_/g, " "));
  if (image.width && image.height) details.push(`${image.width} x ${image.height}`);
  return details.join(" | ");
}

export function getChatImageDownloadName(image: Pick<ChatImage, "filePath" | "url" | "id">) {
  const fromPath = image.filePath.split(/[\\/]/).pop();
  if (fromPath) return fromPath;
  const fromUrl = image.url.split("?")[0]?.split("/").pop();
  return fromUrl || `gallery-${image.id}.png`;
}

export function formatSceneVideoMeta(
  video: Pick<GeneratedSceneVideo, "model" | "provider" | "durationSeconds" | "aspectRatio">,
) {
  const details: string[] = [];
  if (video.model) details.push(video.model);
  if (video.provider) details.push(video.provider.replace(/_/g, " "));
  details.push(`${video.durationSeconds}s`);
  details.push(video.aspectRatio);
  return details.join(" | ");
}

export function getSceneVideoDownloadName(video: Pick<GeneratedSceneVideo, "filePath" | "url" | "id">) {
  const fromPath = video.filePath.split(/[\\/]/).pop();
  if (fromPath) return fromPath;
  const fromUrl = video.url.split("?")[0]?.split("/").pop();
  return fromUrl || `scene-video-${video.id}.mp4`;
}

const IMAGE_ACTION_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--sidebar)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:opacity-50";

interface ChatImageLightboxProps {
  image: ChatImage;
  alt?: string;
  pinEnabled?: boolean;
  downloadEnabled?: boolean;
  /**
   * Offer Regenerate (#7767). Only for images backed by a chat gallery row; `messageId` names the
   * message the image was opened from.
   */
  regenerate?: { messageId?: string };
  onPin?: (image: ChatImage) => void;
  onClose: () => void;
}

export function ChatImageLightbox({
  image: initialImage,
  alt,
  pinEnabled = true,
  downloadEnabled = true,
  regenerate,
  onPin,
  onClose,
}: ChatImageLightboxProps) {
  const { t: localizeUi } = useUiTranslation();
  const pinImage = useGalleryStore((s) => s.pinImage);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // A regeneration swaps in the new image so the user sees the result right away.
  const [activeImage, setImage] = useState(initialImage);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const backdropDismiss = useBackdropDismiss(onClose, busy);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  // Lightweight message and storyboard images omit the generation record. Resolve
  // it once here so viewing and editing use the same saved request.
  const needsGalleryRow = !!regenerate && activeImage.generation === undefined;
  const gallery = useGalleryImages(needsGalleryRow ? activeImage.chatId : undefined);
  const galleryRow = needsGalleryRow ? gallery.data?.find((row) => row.id === activeImage.id) : undefined;
  const image = galleryRow ?? activeImage;
  const record = parseChatImageGenerationRecord(image.generation);
  const prompt = record?.prompt ?? image.prompt;
  const meta = formatChatImageMeta(image);
  const downloadName = getChatImageDownloadName(image);
  const loadingDetails = needsGalleryRow && gallery.isFetching && !gallery.data;
  const detailsFailed = needsGalleryRow && gallery.isError && !gallery.data;
  const hasDetails = !!(loadingDetails || detailsFailed || prompt.trim() || meta || record);
  // Nothing to re-send for an upload without a prompt.
  const canRegenerate = !!regenerate && !loadingDetails && !detailsFailed && !!prompt.trim();
  useEffect(() => {
    if (!editing) closeButtonRef.current?.focus();
  }, [editing]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      data-chat-floating-panel
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label={localizeUi("ui.chat.chatimagelightbox.imagePreview")}
      tabIndex={-1}
      {...backdropDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && event.currentTarget.contains(event.target as Node)) {
          event.stopPropagation();
          if (busy) return;
          if (editing) setEditing(false);
          else onClose();
        }
      }}
    >
      <div
        className="flex max-h-[92dvh] w-[min(94vw,64rem)] flex-col items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-0 max-w-full shrink-0 justify-center">
          <img
            src={image.url}
            alt={alt || localizeUi("ui.chat.conversationmessagelightbox.expandedImage")}
            decoding="async"
            className={cn(
              "max-w-full rounded-lg object-contain shadow-2xl",
              editing ? "max-h-[34dvh]" : hasDetails ? "max-h-[60dvh]" : "max-h-[85dvh]",
            )}
          />
          <div className="absolute right-2 top-2 flex gap-2">
            {canRegenerate && !editing && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setEditing(true);
                }}
                aria-label={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
                className={IMAGE_ACTION_CLASS}
                title={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
              >
                <RefreshCw size="0.875rem" />
              </button>
            )}
            {pinEnabled && (
              <button
                type="button"
                disabled={busy}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onPin) onPin(image);
                  else pinImage(image);
                  onClose();
                }}
                aria-label={localizeUi("ui.chat.chatgallery.pinImageToChat")}
                className={IMAGE_ACTION_CLASS}
                title={localizeUi("ui.chat.chatgallery.pinToChat")}
              >
                <Pin size="0.875rem" />
              </button>
            )}
            {downloadEnabled && (
              <ImageDownloadButton url={image.url} filename={downloadName} className={IMAGE_ACTION_CLASS} />
            )}
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              disabled={busy}
              aria-label={localizeUi("ui.chat.chatimagelightbox.closeImage")}
              className={IMAGE_ACTION_CLASS}
            >
              <X size="0.875rem" />
            </button>
          </div>
        </div>
        {editing && canRegenerate ? (
          <ImageRegeneratePanel
            key={image.id}
            image={image}
            record={record}
            messageId={regenerate?.messageId}
            onBusyChange={setBusy}
            onCancel={() => setEditing(false)}
            onRegenerated={(next) => {
              setImage(next);
              setEditing(false);
            }}
            className="w-full max-w-3xl"
          />
        ) : loadingDetails ? (
          <p
            role="status"
            className="w-full max-w-3xl rounded-xl bg-[var(--sidebar)] px-4 py-3 text-sm text-[var(--foreground)]"
          >
            {localizeUi("ui.chat.chatimagelightbox.loadingPrompt")}
          </p>
        ) : (
          <>
            {detailsFailed && (
              <button
                type="button"
                className={cn(IMAGE_ACTION_CLASS, "w-auto px-3")}
                onClick={() => void gallery.refetch()}
              >
                {localizeUi("ui.chat.chatimagelightbox.retryPrompt")}
              </button>
            )}
            <ImagePromptPanel
              prompt={prompt}
              negativePrompt={record?.negativePrompt}
              characterPrompts={record?.characterPrompts}
              meta={meta}
              className="w-full max-w-3xl"
            />
          </>
        )}
      </div>
    </div>,
    portalRoot,
  );
}

interface ChatVideoLightboxProps {
  video: GeneratedSceneVideo;
  pinEnabled?: boolean;
  downloadEnabled?: boolean;
  onPin?: (video: GeneratedSceneVideo) => void;
  onClose: () => void;
}

export function ChatVideoLightbox({
  video,
  pinEnabled = true,
  downloadEnabled = true,
  onPin,
  onClose,
}: ChatVideoLightboxProps) {
  const { t: localizeUi } = useUiTranslation();
  const backdropDismiss = useBackdropDismiss(onClose);
  const pinVideo = useGalleryStore((s) => s.pinVideo);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const prompt = video.prompt.trim();
  const meta = formatSceneVideoMeta(video);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  if (!portalRoot) return null;

  return createPortal(
    <div
      data-chat-floating-panel
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label={localizeUi("ui.chat.chatvideolightbox.videoPreview")}
      tabIndex={-1}
      {...backdropDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-0 max-w-full justify-center">
          <video
            src={video.url}
            controls
            muted
            playsInline
            autoPlay
            className={
              prompt || meta
                ? "max-h-[calc(90vh-10rem)] max-w-full rounded-lg bg-black object-contain shadow-2xl"
                : "max-h-[85vh] max-w-full rounded-lg bg-black object-contain shadow-2xl"
            }
          />
          <div className="absolute right-2 top-2 flex gap-2">
            {pinEnabled && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onPin) onPin(video);
                  else pinVideo(video);
                  onClose();
                }}
                aria-label={localizeUi("ui.chat.chatgallery.pinVideoToChat")}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                title={localizeUi("ui.chat.chatgallery.pinToChat")}
              >
                <Pin size="0.875rem" />
              </button>
            )}
            {downloadEnabled && (
              <a
                href={video.url}
                download={getSceneVideoDownloadName(video)}
                aria-label={localizeUi("ui.chat.chatgallery.downloadVideo")}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              >
                <Download size="0.875rem" />
              </a>
            )}
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              aria-label={localizeUi("ui.chat.chatvideolightbox.closeVideo")}
              className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <X size="0.875rem" />
            </button>
          </div>
        </div>
        <ImagePromptPanel prompt={prompt} meta={meta} className="w-full max-w-3xl" />
      </div>
    </div>,
    portalRoot,
  );
}
