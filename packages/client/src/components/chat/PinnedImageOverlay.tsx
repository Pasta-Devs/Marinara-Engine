// ──────────────────────────────────────────────
// Pinned Image Overlay — Draggable floating gallery media in the chat area
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Film, GripHorizontal, Lock, Unlock, X } from "lucide-react";
import { useGalleryStore } from "../../stores/gallery.store";
import type { PinnedGalleryMedia, PinnedMediaLayout } from "../../stores/gallery.store";
import { cn } from "../../lib/utils";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";
import { useGalleryImages, useSceneVideos } from "../../hooks/use-gallery";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";

const EMPTY_SCENE_VIDEOS: GeneratedSceneVideo[] = [];

type Frame = { x: number; y: number; w: number; h: number };

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

function clampPosition(pos: { x: number; y: number }, size: { w: number; h: number }, viewport = getViewport()) {
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

/** Where a pin shows: shrunk to fit (same shape) and kept on screen. The saved frame is left as the user set it,
 *  so the pin goes back there when the window grows again. */
function fitFrameToViewport(frame: Frame, viewport: { width: number; height: number }): Frame {
  const scale = Math.min(1, (viewport.width - 16) / frame.w, (viewport.height - 16) / frame.h);
  const size = { w: frame.w * scale, h: frame.h * scale };
  return { ...clampPosition(frame, size, viewport), ...size };
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
  onLayoutChange,
}: {
  media: PinnedGalleryMedia;
  onClose: () => void;
  offsetIndex: number;
  /** Pins save where they sit and can be locked; the one-shot viewer passes nothing. */
  onLayoutChange?: (layout: PinnedMediaLayout) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const savedLayout = onLayoutChange ? media.layout : undefined;
  const locked = !!savedLayout?.locked;
  const [frame, setFrame] = useState<Frame>(() => {
    if (savedLayout) return { x: savedLayout.x, y: savedLayout.y, w: savedLayout.w, h: savedLayout.h };
    const size = getInitialSize(media);
    const viewport = getViewport();
    const pos = clampPosition(
      {
        x: (viewport.width - size.w) / 2 + offsetIndex * 24,
        y: (viewport.height - size.h) / 2 + offsetIndex * 24,
      },
      size,
    );
    return { ...pos, ...size };
  });
  const [viewport, setViewport] = useState(getViewport);
  // The one-shot viewer keeps its place when it moves on to newer media, but takes that media's size.
  const [frameMediaId, setFrameMediaId] = useState(media.id);
  if (frameMediaId !== media.id) {
    setFrameMediaId(media.id);
    setFrame((current) => ({ ...current, ...getInitialSize(media) }));
  }
  const shown = useMemo(() => fitFrameToViewport(frame, viewport), [frame, viewport]);
  const [touchControlsVisible, setTouchControlsVisible] = useState(false);
  // A drag moves what is shown but keeps the saved size, so a pin shrunk by a small window grows back later.
  const dragRef = useRef<{ startX: number; startY: number; origin: Frame; saved: Frame; frame: Frame } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origin: Frame; frame: Frame } | null>(null);
  const touchControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaNoun =
    media.kind === "video"
      ? localizeUi("ui.ui.spritegenerationmodal.video")
      : localizeUi("ui.ui.spritegenerationmodal.image");

  const showTouchControls = useCallback(() => {
    setTouchControlsVisible(true);
    if (touchControlsTimerRef.current) clearTimeout(touchControlsTimerRef.current);
    touchControlsTimerRef.current = setTimeout(() => setTouchControlsVisible(false), 2600);
  }, []);

  useEffect(() => {
    const onResize = () => setViewport(getViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(
    () => () => {
      if (touchControlsTimerRef.current) clearTimeout(touchControlsTimerRef.current);
    },
    [],
  );

  const saveLayout = useCallback(
    (next: Frame, nextLocked: boolean) => {
      onLayoutChange?.(nextLocked ? { ...next, locked: true } : next);
    },
    [onLayoutChange],
  );

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (shouldIgnoreDragTarget(e.target)) return;
      e.preventDefault();
      if (e.pointerType !== "mouse") showTouchControls();
      if (locked) return;
      dragRef.current = { startX: e.clientX, startY: e.clientY, origin: shown, saved: frame, frame };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [frame, locked, shown, showTouchControls],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { origin } = drag;
    const pos = clampPosition({ x: origin.x + e.clientX - drag.startX, y: origin.y + e.clientY - drag.startY }, origin);
    drag.frame = { ...drag.saved, ...pos };
    setFrame(drag.frame);
  }, []);

  const onDragEnd = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (drag && drag.frame !== drag.saved) saveLayout(drag.frame, locked);
    },
    [locked, saveLayout],
  );

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.pointerType !== "mouse") showTouchControls();
      resizeRef.current = { startX: e.clientX, startY: e.clientY, origin: shown, frame: shown };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [showTouchControls, shown],
  );

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (!resize) return;
    e.preventDefault();
    e.stopPropagation();
    const { origin } = resize;
    const aspect = origin.w / origin.h;
    const widthFromHorizontal = origin.w + e.clientX - resize.startX;
    const widthFromVertical = (origin.h + e.clientY - resize.startY) * aspect;
    resize.frame = {
      ...origin,
      ...clampSizeToViewport(Math.max(widthFromHorizontal, widthFromVertical), aspect, origin),
    };
    setFrame(resize.frame);
  }, []);

  const onResizeEnd = useCallback(
    (e: React.PointerEvent) => {
      const resize = resizeRef.current;
      resizeRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (resize && resize.frame !== resize.origin) saveLayout(resize.frame, locked);
    },
    [locked, saveLayout],
  );

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (media.kind !== "image" || (media.width && media.height) || savedLayout) return;
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (!naturalWidth || !naturalHeight) return;
      setFrame((current) => ({ ...current, ...getInitialSizeForAspect(naturalWidth / naturalHeight) }));
    },
    [media, savedLayout],
  );
  const controlsVisibilityClass = touchControlsVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100";

  return (
    <div
      className={cn("group fixed z-[20] select-none touch-none", !locked && "cursor-grab active:cursor-grabbing")}
      style={{ left: shown.x, top: shown.y, width: shown.w, height: shown.h }}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      aria-label={localizeUi(
        locked ? "ui.chat.pinnedmediaviewer.pinnedMediaLocked" : "ui.chat.pinnedmediaviewer.pinnedValue1DragToMove",
        {
          value1:
            media.kind === "video"
              ? localizeUi("ui.chat.pinnedmediaviewer.sceneVideo")
              : localizeUi("ui.chat.pinnedmediaviewer.galleryImage"),
        },
      )}
    >
      <div className="relative h-full w-full">
        {onLayoutChange && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              saveLayout(frame, !locked);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
              getChatToolbarButtonClass({
                active: locked,
                compact: true,
                sizeClassName: "h-7 w-7",
                className: "absolute -top-2 right-6 z-10 shadow-lg transition-opacity duration-150",
              }),
              controlsVisibilityClass,
            )}
            aria-pressed={locked}
            aria-label={localizeUi("ui.chat.pinnedmediaviewer.lockPinnedMedia", { value1: mediaNoun })}
            title={localizeUi(locked ? "ui.chat.pinnedmediaviewer.unlockHint" : "ui.chat.pinnedmediaviewer.lockHint", {
              value1: mediaNoun,
            })}
          >
            {locked ? <Lock size="0.875rem" /> : <Unlock size="0.875rem" />}
          </button>
        )}
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
          aria-label={localizeUi("ui.chat.pinnedmediaviewer.dismissPinnedValue1", { value1: mediaNoun })}
        >
          <X size="0.875rem" />
        </button>
        {media.kind === "video" ? (
          <>
            <div
              className={cn(
                "absolute left-2 top-2 z-10 flex max-w-[calc(100%-4rem)] items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-[0.625rem] font-medium text-white shadow-lg backdrop-blur-sm",
                !locked && "cursor-grab active:cursor-grabbing",
                controlsVisibilityClass,
              )}
              onPointerDown={onDragStart}
              aria-label={locked ? undefined : localizeUi("ui.chat.pinnedmediaviewer.dragPinnedVideo")}
            >
              {!locked && <GripHorizontal size="0.75rem" className="shrink-0" />}
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
        {!locked && (
          <div
            className={cn(
              "absolute -bottom-2 -right-2 z-10 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] shadow-lg transition-all duration-150 hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-95",
              controlsVisibilityClass,
            )}
            aria-label={localizeUi("ui.chat.pinnedmediaviewer.resizePinnedValue1", { value1: mediaNoun })}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
          >
            <span className="h-2.5 w-2.5 rounded-br-sm border-b-2 border-r-2 border-current" />
          </div>
        )}
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
  const setPinnedLayout = useGalleryStore((s) => s.setPinnedLayout);
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
          onLayoutChange={media.id === activeViewer?.id ? undefined : (layout) => setPinnedLayout(media.id, layout)}
        />
      ))}
    </>
  );
}
