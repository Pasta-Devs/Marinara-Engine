import { useEffect, useRef, useState } from "react";
import { Download, Pin, RefreshCw } from "lucide-react";
import { parseChatImageGenerationRecord, type GeneratedSceneVideo } from "@marinara-engine/shared";
import { useGalleryImages, type ChatImage } from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import { ImageDownloadButton } from "../ui/ImageDownloadButton";
import { ImageViewer, VIEWER_BUTTON_CLASS } from "../ui/ImageViewer";
import { cn } from "../../lib/utils";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { ImageRegeneratePanel, type ImageRegenerator } from "./ImageRegeneratePanel";
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
  /** Other pictures of the same set. With more than one, the viewer gets arrows, swipe, a counter and a filmstrip. */
  images?: ChatImage[];
  alt?: string;
  pinEnabled?: boolean;
  downloadEnabled?: boolean;
  /**
   * Offer Regenerate (#7767). Only for images backed by a chat gallery row; `messageId` names the
   * message the image was opened from.
   */
  regenerate?: { messageId?: string };
  /** Where Regenerate sends the draft when the image isn't a chat gallery row (Professor Mari's, #9387). */
  regenerator?: ImageRegenerator;
  /** Shown after the model, provider and size, e.g. the style profile that shaped the prompt. */
  extraMeta?: string;
  /** Opened from Professor Mari's window: the viewer joins her layer (the omnibar layer), above her window. */
  overMari?: boolean;
  onPin?: (image: ChatImage) => void;
  onClose: () => void;
}

export function ChatImageLightbox({
  image: initialImage,
  images,
  alt,
  pinEnabled = true,
  downloadEnabled = true,
  regenerate,
  regenerator,
  extraMeta,
  overMari = false,
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
  // Lightweight message and storyboard images omit the generation record. Resolve
  // it once here so viewing and editing use the same saved request.
  const needsGalleryRow = !!regenerate && activeImage.generation === undefined;
  const gallery = useGalleryImages(needsGalleryRow ? activeImage.chatId : undefined);
  const galleryRow = needsGalleryRow ? gallery.data?.find((row) => row.id === activeImage.id) : undefined;
  const image = galleryRow ?? activeImage;
  const record = parseChatImageGenerationRecord(image.generation);
  const prompt = record?.prompt ?? image.prompt;
  const meta = [formatChatImageMeta(image), extraMeta].filter(Boolean).join(" | ");
  const downloadName = getChatImageDownloadName(image);
  const loadingDetails = needsGalleryRow && gallery.isFetching && !gallery.data;
  const detailsFailed = needsGalleryRow && gallery.isError && !gallery.data;
  // Nothing to re-send for an upload without a prompt.
  const canRegenerate = !!regenerate && !loadingDetails && !detailsFailed && !!prompt.trim();
  const galleryIndex = images?.findIndex((item) => item.id === activeImage.id) ?? -1;

  // Close is disabled while a regeneration runs, and the panel closes before `busy` clears: wait for
  // both, or focus falls to the page.
  useEffect(() => {
    if (!editing && !busy) closeButtonRef.current?.focus();
  }, [editing, busy]);

  return (
    <ImageViewer
      title={localizeUi("ui.chat.chatimagelightbox.imagePreview")}
      // Escape, back and outside taps first leave the regenerate panel, then the viewer.
      onClose={() => (editing ? setEditing(false) : onClose())}
      onCloseButton={onClose}
      closeDisabled={busy}
      closeLabel={localizeUi("ui.chat.chatimagelightbox.closeImage")}
      closeButtonRef={closeButtonRef}
      overMari={overMari}
      src={image.url}
      alt={alt ?? localizeUi("ui.chat.conversationmessagelightbox.expandedImage")}
      items={
        images && galleryIndex >= 0 && !editing && !busy
          ? images.map((item) => ({
              url: item.url,
              alt: item.prompt || localizeUi("ui.chat.conversationmessagelightbox.expandedImage"),
            }))
          : undefined
      }
      index={galleryIndex}
      onIndexChange={(next) => images && setImage(images[next]!)}
      actions={
        <>
          {canRegenerate && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
              className={VIEWER_BUTTON_CLASS}
              title={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
            >
              <RefreshCw size="0.875rem" />
            </button>
          )}
          {pinEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (onPin) onPin(image);
                else pinImage(image);
                onClose();
              }}
              aria-label={localizeUi("ui.chat.chatgallery.pinImageToChat")}
              className={VIEWER_BUTTON_CLASS}
              title={localizeUi("ui.chat.chatgallery.pinToChat")}
            >
              <Pin size="0.875rem" />
            </button>
          )}
          {downloadEnabled && (
            <ImageDownloadButton url={image.url} filename={downloadName} className={VIEWER_BUTTON_CLASS} />
          )}
        </>
      }
    >
      {editing && canRegenerate ? (
        <ImageRegeneratePanel
          key={image.id}
          image={image}
          regenerator={regenerator}
          record={record}
          messageId={regenerate.messageId}
          onBusyChange={setBusy}
          onCancel={() => setEditing(false)}
          onRegenerated={(next) => {
            setImage(next);
            setEditing(false);
          }}
        />
      ) : loadingDetails ? (
        <p
          role="status"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--sidebar)] px-4 py-3 text-sm text-[var(--foreground)]"
        >
          {localizeUi("ui.chat.chatimagelightbox.loadingPrompt")}
        </p>
      ) : (
        <>
          {detailsFailed && (
            <button
              type="button"
              className={cn(VIEWER_BUTTON_CLASS, "w-auto px-3")}
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
          />
        </>
      )}
    </ImageViewer>
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

  return (
    <ImageViewer
      title={localizeUi("ui.chat.chatvideolightbox.videoPreview")}
      onClose={onClose}
      closeLabel={localizeUi("ui.chat.chatvideolightbox.closeVideo")}
      media={
        <video
          src={video.url}
          controls
          muted
          playsInline
          autoPlay
          className="max-h-full max-w-full rounded-lg bg-black object-contain shadow-2xl"
        />
      }
      actions={
        <>
          {pinEnabled && (
            <button
              type="button"
              onClick={() => {
                if (onPin) onPin(video);
                else pinVideo(video);
                onClose();
              }}
              aria-label={localizeUi("ui.chat.chatgallery.pinVideoToChat")}
              className={VIEWER_BUTTON_CLASS}
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
              className={VIEWER_BUTTON_CLASS}
            >
              <Download size="0.875rem" />
            </a>
          )}
        </>
      }
    >
      <ImagePromptPanel prompt={video.prompt.trim()} meta={formatSceneVideoMeta(video)} />
    </ImageViewer>
  );
}
