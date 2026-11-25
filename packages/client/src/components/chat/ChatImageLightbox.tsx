import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Pin, RefreshCw, Trash2 } from "lucide-react";
import {
  groupChatImageVariants,
  parseChatImageGenerationRecord,
  type GeneratedSceneVideo,
} from "@marinara-engine/shared";
import { toast } from "sonner";
import { useGalleryImages, type ChatImage } from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import { ImageDownloadButton } from "../ui/ImageDownloadButton";
import {
  DEFAULT_MASK_BRUSH_PX,
  ImageMaskCanvas,
  type ImageMaskCanvasHandle,
  type ImageMaskState,
  type MaskTool,
} from "../ui/ImageMaskCanvas";
import { ImageViewer, VIEWER_BUTTON_CLASS } from "../ui/ImageViewer";
import { cn } from "../../lib/utils";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { useSelectChatImageVersion } from "../../hooks/use-regenerate-chat-image";
import { ChatImageDeleteDialog } from "./ChatImageDeleteDialog";
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

const EMPTY_MASK_STATE: ImageMaskState = { strokeCount: 0, hasMask: false, isDrawing: false };

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
  /** Owner-specific actions follow the currently displayed result. */
  actions?: (image: ChatImage) => ReactNode;
  /** Actions for a saved result while its editing panel remains open. */
  editActions?: (image: ChatImage, busy: boolean) => ReactNode;
  interactionDisabled?: boolean;
  onSelectVersion?: (image: ChatImage) => Promise<ChatImage>;
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
  actions,
  editActions,
  interactionDisabled = false,
  onSelectVersion,
  onClose,
}: ChatImageLightboxProps) {
  const { t: localizeUi } = useUiTranslation();
  const pinImage = useGalleryStore((s) => s.pinImage);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // A regeneration swaps in the new image so the user sees the result right away.
  const [activeImage, setImage] = useState(initialImage);
  const [editing, setEditing] = useState(false);
  const [editSurfaceActive, setEditSurfaceActive] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [maskTool, setMaskTool] = useState<MaskTool>("brush");
  const [maskBrushSize, setMaskBrushSize] = useState(DEFAULT_MASK_BRUSH_PX);
  const [maskState, setMaskState] = useState<ImageMaskState>(EMPTY_MASK_STATE);
  const maskControlsRef = useRef<ImageMaskCanvasHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selectingVersion = useRef(false);
  const [selectionPending, setSelectionPending] = useState(false);
  const selectVersion = useSelectChatImageVersion(activeImage.chatId);

  const resetMask = useCallback((options?: { resetToolAndBrush?: boolean }) => {
    setMaskDataUrl(null);
    setMaskState(EMPTY_MASK_STATE);
    if (options?.resetToolAndBrush) {
      setMaskTool("brush");
      setMaskBrushSize(DEFAULT_MASK_BRUSH_PX);
    }
  }, []);

  const closeEditing = () => {
    setEditing(false);
    setEditSurfaceActive(false);
    resetMask({ resetToolAndBrush: true });
  };

  const handleEditSurfaceChange = useCallback(
    (active: boolean) => {
      setEditSurfaceActive(active);
      if (!active) resetMask({ resetToolAndBrush: true });
    },
    [resetMask],
  );
  // Lightweight message and storyboard images omit the generation record. Resolve
  // it once here so viewing and editing use the same saved request.
  const chatGallery = !!regenerate && !regenerator;
  const needsGalleryRow = chatGallery && activeImage.generation === undefined;
  const gallery = useGalleryImages(chatGallery ? activeImage.chatId : undefined);
  const galleryRow = chatGallery ? gallery.data?.find((row) => row.id === activeImage.id) : undefined;
  const image = activeImage.generation === undefined ? (galleryRow ?? activeImage) : activeImage;
  const record = parseChatImageGenerationRecord(image.generation);
  const prompt = record?.prompt ?? image.prompt;
  const meta = [formatChatImageMeta(image), extraMeta].filter(Boolean).join(" | ");
  const downloadName = getChatImageDownloadName(image);
  const loadingDetails = needsGalleryRow && gallery.isFetching && !gallery.data;
  const detailsFailed = needsGalleryRow && gallery.isError && !gallery.data;
  // Entity adapters can start from a blank prompt; ordinary chat uploads need one to resend.
  const canRegenerate = !!regenerate && !loadingDetails && !detailsFailed && (!!prompt.trim() || !!regenerator);
  const rows = new Map(
    (images ?? (chatGallery ? gallery.data : undefined) ?? [activeImage]).map((row) => [row.id, row]),
  );
  if (chatGallery) for (const row of gallery.data ?? []) rows.set(row.id, row);
  rows.set(image.id, image);
  // Fetching saved versions must not turn a message preview into the entire chat gallery.
  const suppliedIds = new Set([...(images ?? []).map((row) => row.id), activeImage.id]);
  const stacks = groupChatImageVariants([...rows.values()]).filter((group) =>
    group.versions.some((row) => suppliedIds.has(row.id)),
  );
  const galleryIndex = stacks.findIndex((stack) => stack.versions.some((row) => row.id === image.id));
  const stack = stacks[galleryIndex];
  const versionIndex = stack?.versions.findIndex((row) => row.id === image.id) ?? 0;
  const galleryImages = stacks.map((group) => (group === stack ? image : group.selected));
  const navigating = selectionPending || selectVersion.isPending;
  // Name the picture by its prompt, as `items` below does once a gallery has two or more (#9099 lost this).
  const imageAlt = alt ?? (prompt || localizeUi("ui.chat.conversationmessagelightbox.expandedImage"));

  // Close is disabled while a regeneration runs, and the panel closes before `busy` clears: wait for
  // both, or focus falls to the page.
  useEffect(() => {
    if (!editing && !busy) closeButtonRef.current?.focus();
  }, [editing, busy]);

  return (
    <>
      <ImageViewer
        title={localizeUi("ui.chat.chatimagelightbox.imagePreview")}
        // Escape, back and outside taps first leave the regenerate panel, then the viewer.
        onClose={() => (editing ? closeEditing() : onClose())}
        onCloseButton={onClose}
        closeDisabled={busy || navigating || interactionDisabled}
        closeLabel={localizeUi("ui.chat.chatimagelightbox.closeImage")}
        closeButtonRef={closeButtonRef}
        overMari={overMari}
        src={image.url}
        alt={imageAlt}
        childrenMaxHeightClass={
          editing ? "max-h-[64%] [@media(max-height:520px)]:max-h-[82%] sm:max-h-[48%]" : undefined
        }
        pictureActions={editing ? editActions?.(image, busy || interactionDisabled) : undefined}
        media={
          editing && editSurfaceActive ? (
            <ImageMaskCanvas
              key={image.id}
              src={image.url}
              alt={imageAlt}
              disabled={busy || interactionDisabled}
              tool={maskTool}
              brushSizePx={maskBrushSize}
              hideToolbar
              onBackdropClick={busy || interactionDisabled ? undefined : closeEditing}
              onMaskChange={setMaskDataUrl}
              onMaskStateChange={setMaskState}
              controlsRef={maskControlsRef}
            />
          ) : undefined
        }
        items={
          galleryIndex >= 0 && !editing && !busy && !interactionDisabled
            ? galleryImages.map((item) => ({
                url: item.url,
                alt: item.prompt || localizeUi("ui.chat.conversationmessagelightbox.expandedImage"),
              }))
            : undefined
        }
        index={galleryIndex}
        versions={
          (chatGallery || onSelectVersion) && stack
            ? {
                index: versionIndex,
                count: stack.versions.length,
                disabled:
                  busy || navigating || interactionDisabled || maskState.hasMask || Boolean(maskState.isDrawing),
                onIndexChange: (next) => {
                  const target = stack.versions[next];
                  if (
                    !target ||
                    selectingVersion.current ||
                    navigating ||
                    busy ||
                    interactionDisabled ||
                    maskState.hasMask ||
                    maskState.isDrawing
                  )
                    return;
                  selectingVersion.current = true;
                  setSelectionPending(true);
                  void (
                    onSelectVersion
                      ? onSelectVersion(target)
                      : selectVersion.mutateAsync(target).then((result) => result.image)
                  )
                    .then((result) => setImage(result))
                    .catch((error) =>
                      toast.error(
                        error instanceof Error ? error.message : localizeUi("chat.imageVersions.selectFailed"),
                      ),
                    )
                    .finally(() => {
                      selectingVersion.current = false;
                      setSelectionPending(false);
                    });
                },
              }
            : undefined
        }
        onIndexChange={(next) => {
          if (!galleryImages[next]) return;
          setImage(galleryImages[next]);
          setEditSurfaceActive(false);
          resetMask({ resetToolAndBrush: true });
        }}
        actions={
          <>
            {!editing && actions?.(image)}
            {chatGallery && !editing && (
              <button
                type="button"
                disabled={busy || navigating}
                className={VIEWER_BUTTON_CLASS}
                aria-label={localizeUi("chat.imageVersions.deleteTitle")}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size="0.875rem" />
              </button>
            )}
            {canRegenerate && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy || navigating || interactionDisabled}
                aria-label={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
                className={VIEWER_BUTTON_CLASS}
                title={localizeUi("ui.chat.chatimagelightbox.regenerateImage")}
              >
                <RefreshCw size="0.875rem" />
              </button>
            )}
            {pinEnabled && !editing && (
              <button
                type="button"
                disabled={busy || navigating}
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
            {downloadEnabled && !editing && (
              <ImageDownloadButton url={image.url} filename={downloadName} className={VIEWER_BUTTON_CLASS} />
            )}
          </>
        }
      >
        {editing && canRegenerate ? (
          <ImageRegeneratePanel
            image={image}
            regenerator={regenerator}
            record={record}
            messageId={regenerate.messageId}
            maskDataUrl={maskDataUrl}
            maskControls={{
              tool: maskTool,
              onToolChange: setMaskTool,
              brushSizePx: maskBrushSize,
              onBrushSizeChange: setMaskBrushSize,
              strokeCount: maskState.strokeCount,
              hasMask: maskState.hasMask,
              isDrawing: Boolean(maskState.isDrawing),
              onInvert: () => maskControlsRef.current?.invert(),
              onUndo: () => maskControlsRef.current?.undo(),
              onClear: () => maskControlsRef.current?.clear(),
            }}
            onEditSurfaceChange={handleEditSurfaceChange}
            onBusyChange={setBusy}
            onCancel={closeEditing}
            disabled={interactionDisabled}
            onRegenerated={(next) => {
              setImage(next);
              resetMask();
              maskControlsRef.current?.clear();
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
      {deleting && (
        <ChatImageDeleteDialog
          image={image}
          versionIds={stack?.versions.map((row) => row.id) ?? [image.id]}
          index={versionIndex}
          onClose={() => setDeleting(false)}
          onDeleted={(result) => {
            setDeleting(false);
            const selected = stack?.versions.find((row) => row.id === result.selectedImageId);
            if (selected) setImage(selected);
            else onClose();
          }}
        />
      )}
    </>
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
