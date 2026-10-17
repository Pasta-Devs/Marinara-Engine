import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "../../hooks/use-backdrop-dismiss";
import { Download, Pin, RefreshCw, X } from "lucide-react";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";
import type { ChatImage } from "../../hooks/use-gallery";
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
  const backdropDismiss = useBackdropDismiss(onClose);
  const pinImage = useGalleryStore((s) => s.pinImage);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // A regeneration swaps in the new image so the user sees the result right away.
  const [image, setImage] = useState(initialImage);
  const [editing, setEditing] = useState(false);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const prompt = image.prompt.trim();
  const meta = formatChatImageMeta(image);
  const downloadName = getChatImageDownloadName(image);
  // Nothing to re-send for an upload without a prompt.
  const canRegenerate = !!regenerate && (!!prompt || !!image.generation);
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
      aria-label={localizeUi("ui.chat.chatimagelightbox.imagePreview")}
      tabIndex={-1}
      {...backdropDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          // Leave the editor first so a stray Escape does not throw away edits.
          if (editing) setEditing(false);
          else onClose();
        }
      }}
    >
      <div
        className={cn(
          "flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2",
          editing && "overflow-y-auto",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-0 max-w-full shrink-0 justify-center">
          <img
            src={image.url}
            alt={alt || image.prompt || "Gallery image"}
            decoding="async"
            className={cn(
              "max-w-full rounded-lg object-contain shadow-2xl",
              editing ? "max-h-[38vh]" : prompt || meta ? "max-h-[calc(90vh-10rem)]" : "max-h-[85vh]",
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
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                title={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
              >
                <RefreshCw size="0.875rem" />
              </button>
            )}
            {pinEnabled && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onPin) onPin(image);
                  else pinImage(image);
                  onClose();
                }}
                aria-label={localizeUi("ui.chat.chatgallery.pinImageToChat")}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                title={localizeUi("ui.chat.chatgallery.pinToChat")}
              >
                <Pin size="0.875rem" />
              </button>
            )}
            {downloadEnabled && <ImageDownloadButton url={image.url} filename={downloadName} />}
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              aria-label={localizeUi("ui.chat.chatimagelightbox.closeImage")}
              className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <X size="0.875rem" />
            </button>
          </div>
        </div>
        {editing && canRegenerate ? (
          <ImageRegeneratePanel
            image={image}
            messageId={regenerate?.messageId}
            onCancel={() => setEditing(false)}
            onRegenerated={(next) => {
              setImage(next);
              setEditing(false);
            }}
            className="w-full max-w-3xl shrink-0"
          />
        ) : (
          <ImagePromptPanel prompt={prompt} meta={meta} className="w-full max-w-3xl" />
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
