// ──────────────────────────────────────────────
// Pinned Image Overlay — Draggable floating gallery media in the chat area
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Film, GripHorizontal, X } from "lucide-react";
import { useGalleryStore } from "../../stores/gallery.store";
import type { PinnedGalleryMedia } from "../../stores/gallery.store";
import { cn } from "../../lib/utils";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";
import { useGalleryImages, useSceneVideos } from "../../hooks/use-gallery";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";

const EMPTY_SCENE_VIDEOS: GeneratedSceneVideo[] = [];

function getViewport() {
  return {
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  };
}

function getMediaAspect(media: PinnedGalleryMedia) {
  if (media.kind === "video") return media.aspectRatio === "9:16" ? 9 / 16 : 16 / 9;
  return media.width && media.height && media.width > 0 && media.height > 0 ? media.width / media.height : 1;
}

function getInitialSizeForAspect(aspect: number) {
  const viewport = getViewport();
  const isMobile = viewport.width < 640;
  const maxWidth = isMobile ? viewport.width - 32 : Math.min(460, viewport.width * 0.36);
  const maxHeight = isMobile ? viewport.height * 0.54 : viewport.height * 0.62;
  let width = Math.min(maxWidth, maxHeight * aspect);
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  return { w: Math.max(160, width), h: Math.max(120, height) };
}

function getInitialSize(media: PinnedGalleryMedia) {
  return getInitialSizeForAspect(getMediaAspect(media));
}

function clampPosition(pos: { x: number; y: number }, size: { w: number; h: number }) {
  const viewport = getViewport();
  return {
    x: Math.max(8, Math.min(pos.x, viewport.width - size.w - 8)),
    y: Math.max(8, Math.min(pos.y, viewport.height - size.h - 8)),
  };
}

function clampSizeToViewport(width: number, aspect: number, pos: { x: number; y: number }) {
  const viewport = getViewport();
  const minWidth = viewport.width < 640 ? 120 : 160;
  const minHeight = viewport.width < 640 ? 90 : 120;
  const maxWidth = Math.max(minWidth, viewport.width - pos.x - 8);
  const maxHeight = Math.max(minHeight, viewport.height - pos.y - 8);
  const maxAspectWidth = maxHeight * aspect;
  const nextWidth = Math.max(minWidth, Math.min(width, maxWidth, maxAspectWidth));
  const nextHeight = Math.max(minHeight, nextWidth / aspect);
  return { w: nextWidth, h: nextHeight };
}

function shouldIgnoreDragTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("button,a,video,[data-gallery-media-no-drag]");
}

function getPinnedMediaLabel(media: PinnedGalleryMedia) {
  if (media.kind === "video") return media.prompt || "Scene video";
  return media.prompt || "Gallery image";
}

function PinnedMediaViewer({
  media,
  onClose,
  offsetIndex,
}: {
  media: PinnedGalleryMedia;
  onClose: () => void;
  offsetIndex: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  const initialSize = getInitialSize(media);
  const [pos, setPos] = useState(() =>
    clampPosition(
      {
        x: (getViewport().width - initialSize.w) / 2 + offsetIndex * 24,
        y: (getViewport().height - initialSize.h) / 2 + offsetIndex * 24,
      },
      initialSize,
    ),
  );
  const [size, setSize] = useState(initialSize);
  const [touchControlsVisible, setTouchControlsVisible] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    aspect: number;
  } | null>(null);
  const touchControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTouchControls = useCallback(() => {
    setTouchControlsVisible(true);
    if (touchControlsTimerRef.current) clearTimeout(touchControlsTimerRef.current);
    touchControlsTimerRef.current = setTimeout(() => setTouchControlsVisible(false), 2600);
  }, []);

  useEffect(() => {
    const recomputeFrame = () => {
      const nextSize = getInitialSize(media);
      setSize(nextSize);
      setPos((current) => clampPosition(current, nextSize));
    };
    recomputeFrame();
    window.addEventListener("resize", recomputeFrame);
    return () => window.removeEventListener("resize", recomputeFrame);
  }, [media]);

  useEffect(
    () => () => {
      if (touchControlsTimerRef.current) clearTimeout(touchControlsTimerRef.current);
    },
    [],
  );

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (shouldIgnoreDragTarget(e.target)) return;
      e.preventDefault();
      if (e.pointerType !== "mouse") showTouchControls();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos, showTouchControls],
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos(clampPosition({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }, size));
    },
    [size],
  );

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.pointerType !== "mouse") showTouchControls();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: size.w,
        origH: size.h,
        aspect: size.w / size.h,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [showTouchControls, size],
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      const widthFromHorizontal = resizeRef.current.origW + dx;
      const widthFromVertical = (resizeRef.current.origH + dy) * resizeRef.current.aspect;
      setSize(clampSizeToViewport(Math.max(widthFromHorizontal, widthFromVertical), resizeRef.current.aspect, pos));
    },
    [pos],
  );

  const onResizeEnd = useCallback((e: React.PointerEvent) => {
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (media.kind !== "image" || (media.width && media.height)) return;
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (!naturalWidth || !naturalHeight) return;
      const nextSize = getInitialSizeForAspect(naturalWidth / naturalHeight);
      setSize(nextSize);
      setPos((current) => clampPosition(current, nextSize));
    },
    [media],
  );
  const controlsVisibilityClass = touchControlsVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100";

  return (
    <div
      className="group fixed z-[20] cursor-grab select-none touch-none active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      aria-label={localizeUi("ui.chat.pinnedmediaviewer.pinnedValue1DragToMove", {
        value1:
          media.kind === "video"
            ? localizeUi("ui.chat.pinnedmediaviewer.sceneVideo")
            : localizeUi("ui.chat.pinnedmediaviewer.galleryImage"),
      })}
    >
      <div className="relative h-full w-full">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            getChatToolbarButtonClass({
              compact: true,
              sizeClassName: "h-7 w-7",
              className: "absolute -right-2 -top-2 z-10 shadow-lg transition-opacity duration-150",
            }),
            controlsVisibilityClass,
          )}
          aria-label={localizeUi("ui.chat.pinnedmediaviewer.dismissPinnedValue1", {
            value1:
              media.kind === "video"
                ? localizeUi("ui.ui.spritegenerationmodal.video")
                : localizeUi("ui.ui.spritegenerationmodal.image"),
          })}
        >
          <X size="0.875rem" />
        </button>
        {media.kind === "video" ? (
          <>
            <div
              className={cn(
                "absolute left-2 top-2 z-10 flex max-w-[calc(100%-4rem)] cursor-grab items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-[0.625rem] font-medium text-white shadow-lg backdrop-blur-sm active:cursor-grabbing",
                controlsVisibilityClass,
              )}
              onPointerDown={onDragStart}
              aria-label={localizeUi("ui.chat.pinnedmediaviewer.dragPinnedVideo")}
            >
              <GripHorizontal size="0.75rem" className="shrink-0" />
              <Film size="0.75rem" className="shrink-0" />
              <span className="truncate">{getPinnedMediaLabel(media)}</span>
            </div>
            <video
              src={media.url}
              controls
              muted
              playsInline
              loop
              className="h-full w-full touch-auto cursor-auto rounded-lg bg-black object-contain shadow-2xl"
              data-gallery-media-no-drag
            />
          </>
        ) : (
          <img
            src={media.url}
            alt={getPinnedMediaLabel(media)}
            className="h-full w-full rounded-lg object-contain shadow-2xl"
            draggable={false}
            onLoad={handleImageLoad}
          />
        )}
        <div
          className={cn(
            "absolute -bottom-2 -right-2 z-10 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] shadow-lg transition-all duration-150 hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-95",
            controlsVisibilityClass,
          )}
          aria-label={localizeUi("ui.chat.pinnedmediaviewer.resizePinnedValue1", {
            value1:
              media.kind === "video"
                ? localizeUi("ui.ui.spritegenerationmodal.video")
                : localizeUi("ui.ui.spritegenerationmodal.image"),
          })}
          tabIndex={0}
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
        >
          <span className="h-2.5 w-2.5 rounded-br-sm border-b-2 border-r-2 border-current" />
        </div>
      </div>
    </div>
  );
}

/** Renders pinned gallery media for the active chat as floating overlays. */
export function PinnedImageOverlay({
  activeChatId,
  includeSceneVideos = false,
}: {
  activeChatId: string | null | undefined;
  includeSceneVideos?: boolean;
}) {
  const pinnedMedia = useGalleryStore((s) => s.pinnedImages);
  const viewerMedia = useGalleryStore((s) => s.viewerMedia);
  const latestViewerChatId = useGalleryStore((s) => s.latestViewerChatId);
  const syncLatestViewer = useGalleryStore((s) => s.syncLatestViewer);
  const unpinImage = useGalleryStore((s) => s.unpinImage);
  const clearViewerMedia = useGalleryStore((s) => s.clearViewerMedia);

  const latestViewerActive = !!activeChatId && latestViewerChatId === activeChatId;
  const viewerChatId = latestViewerActive && activeChatId ? activeChatId : undefined;
  const galleryImagesQuery = useGalleryImages(viewerChatId);
  const sceneVideosQuery = useSceneVideos(viewerChatId, latestViewerActive && includeSceneVideos);
  const latestMedia = useMemo<PinnedGalleryMedia | null>(() => {
    if (!latestViewerActive) return null;
    const imageMedia = (galleryImagesQuery.data ?? []).map((image) => ({ ...image, kind: "image" as const }));
    const videoMedia = (sceneVideosQuery.data ?? EMPTY_SCENE_VIDEOS).map((video) => ({
      ...video,
      kind: "video" as const,
    }));
    return [...imageMedia, ...videoMedia].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
  }, [galleryImagesQuery.data, latestViewerActive, sceneVideosQuery.data]);

  useEffect(() => {
    if (!latestViewerActive || !latestMedia) return;
    syncLatestViewer(latestMedia);
  }, [latestMedia, latestViewerActive, syncLatestViewer]);

  const activeViewer = viewerMedia?.chatId === activeChatId ? viewerMedia : null;
  const visiblePinnedMedia = pinnedMedia.filter(
    (media) => media.chatId === activeChatId && media.id !== activeViewer?.id,
  );
  const visibleMedia = activeViewer ? [activeViewer, ...visiblePinnedMedia] : visiblePinnedMedia;
  const activeViewerKey =
    latestViewerActive && activeViewer ? `${activeChatId}:latest-viewer` : `${activeViewer?.id ?? "viewer"}:viewer`;

  if (visibleMedia.length === 0) return null;

  return (
    <>
      {visibleMedia.map((media, index) => (
        <PinnedMediaViewer
          key={media.id === activeViewer?.id ? activeViewerKey : `${media.id}:pin`}
          media={media}
          offsetIndex={index}
          onClose={() => (media.id === activeViewer?.id ? clearViewerMedia() : unpinImage(media.id))}
        />
      ))}
    </>
  );
}
