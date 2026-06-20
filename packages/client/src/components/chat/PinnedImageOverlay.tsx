// ──────────────────────────────────────────────
// Pinned Image Overlay — Draggable floating images in the chat area
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { useGalleryStore } from "../../stores/gallery.store";
import type { ChatImage } from "../../hooks/use-gallery";
import { cn } from "../../lib/utils";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";

function getViewport() {
  return {
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  };
}

function getImageAspect(image: ChatImage) {
  return image.width && image.height && image.width > 0 && image.height > 0 ? image.width / image.height : 1;
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

function getInitialSize(image: ChatImage) {
  return getInitialSizeForAspect(getImageAspect(image));
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

function PinnedImageViewer({
  image,
  onClose,
  offsetIndex,
}: {
  image: ChatImage;
  onClose: () => void;
  offsetIndex: number;
}) {
  const initialSize = getInitialSize(image);
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
    const handleResize = () => {
      const nextSize = getInitialSize(image);
      setSize(nextSize);
      setPos((current) => clampPosition(current, nextSize));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [image]);

  useEffect(
    () => () => {
      if (touchControlsTimerRef.current) clearTimeout(touchControlsTimerRef.current);
    },
    [],
  );

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
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
      if (image.width && image.height) return;
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (!naturalWidth || !naturalHeight) return;
      const nextSize = getInitialSizeForAspect(naturalWidth / naturalHeight);
      setSize(nextSize);
      setPos((current) => clampPosition(current, nextSize));
    },
    [image.height, image.width],
  );
  const controlsVisibilityClass = touchControlsVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div
      className="group fixed z-[110] cursor-grab select-none touch-none active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      aria-label="Pinned gallery image. Drag to move."
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
          aria-label="Dismiss pinned image"
        >
          <X size="0.875rem" />
        </button>
        <img
          src={image.url}
          alt={image.prompt || "Gallery image"}
          className="h-full w-full rounded-lg object-contain shadow-2xl"
          draggable={false}
          onLoad={handleImageLoad}
        />
        <div
          className={cn(
            "absolute -bottom-2 -right-2 z-10 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] shadow-lg transition-all duration-150 hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-95",
            controlsVisibilityClass,
          )}
          aria-label="Resize pinned image"
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

/** Renders pinned gallery images for the active chat as floating overlays. */
export function PinnedImageOverlay({ activeChatId }: { activeChatId: string | null | undefined }) {
  const pinnedImages = useGalleryStore((s) => s.pinnedImages);
  const unpinImage = useGalleryStore((s) => s.unpinImage);

  const visibleImages = pinnedImages.filter((img) => img.chatId === activeChatId);

  if (visibleImages.length === 0) return null;

  return (
    <>
      {visibleImages.map((img, index) => (
        <PinnedImageViewer key={img.id} image={img} offsetIndex={index} onClose={() => unpinImage(img.id)} />
      ))}
    </>
  );
}
