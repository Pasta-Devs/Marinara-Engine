import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Pin, X } from "lucide-react";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";
import type { ChatImage } from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import {
  downloadUrlToDevice,
  prepareImageSave,
  savePreparedImageToDevice,
  shouldUseIosImageShare,
  type PreparedImageSave,
} from "../../lib/file-download";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";

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
  onPin?: (image: ChatImage) => void;
  onClose: () => void;
}

export function ChatImageLightbox({
  image,
  alt,
  pinEnabled = true,
  downloadEnabled = true,
  onPin,
  onClose,
}: ChatImageLightboxProps) {
  const { t: localizeUi } = useUiTranslation();
  const pinImage = useGalleryStore((s) => s.pinImage);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const prompt = image.prompt.trim();
  const meta = formatChatImageMeta(image);
  const downloadName = getChatImageDownloadName(image);
  const useIosShare = shouldUseIosImageShare();
  const [preparedImage, setPreparedImage] = useState<PreparedImageSave | null>(null);
  const currentPreparedImage =
    preparedImage?.url === image.url && preparedImage.filename === downloadName ? preparedImage : null;

  const handleDownload = () => {
    const save = useIosShare
      ? currentPreparedImage
        ? savePreparedImageToDevice(currentPreparedImage)
        : Promise.resolve()
      : downloadUrlToDevice(image.url, downloadName);
    void save.catch(() => toast.error(localizeUi("ui.chat.chatgallery.downloadFailed")));
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!downloadEnabled || !useIosShare) return;
    let active = true;
    void prepareImageSave(image.url, downloadName)
      .then((prepared) => {
        if (active) setPreparedImage(prepared);
      })
      .catch(() => {
        if (active) toast.error(localizeUi("ui.chat.chatgallery.downloadFailed"));
      });
    return () => {
      active = false;
    };
  }, [downloadEnabled, downloadName, image.url, localizeUi, useIosShare]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      data-chat-floating-panel
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label={localizeUi("ui.chat.chatimagelightbox.imagePreview")}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
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
          <img
            src={image.url}
            alt={alt || image.prompt || "Gallery image"}
            decoding="async"
            className={
              prompt || meta
                ? "max-h-[calc(90vh-10rem)] max-w-full rounded-lg object-contain shadow-2xl"
                : "max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
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
            {downloadEnabled && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={useIosShare && !currentPreparedImage}
                aria-label={localizeUi("ui.chat.chatgallery.downloadImage")}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80 disabled:opacity-50"
              >
                <Download size="0.875rem" />
              </button>
            )}
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
        <ImagePromptPanel prompt={prompt} meta={meta} className="w-full max-w-3xl" />
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
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
