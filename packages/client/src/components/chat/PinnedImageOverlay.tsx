// ──────────────────────────────────────────────
// Pinned Image Overlay — Draggable/resizable floating images in the chat area
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { Move, Download, X } from "lucide-react";
import { useGalleryStore } from "../../stores/gallery.store";
import type { ChatImage } from "../../hooks/use-gallery";

function PinnedImageViewer({ image, onClose }: { image: ChatImage; onClose: () => void }) {
  const isMobile = window.innerWidth < 640;
  const initSize = isMobile ? Math.min(window.innerWidth - 32, window.innerHeight * 0.5) : 400;
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState({ w: initSize, h: initSize });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Center on mount
  useEffect(() => {
    const s = isMobile ? Math.min(window.innerWidth - 32, window.innerHeight * 0.5) : 400;
    setPos({ x: Math.max(16, (window.innerWidth - s) / 2), y: Math.max(16, (window.innerHeight - s) / 2) });
  }, [isMobile]);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(0, Math.min(dragRef.current.origX + dx, window.innerWidth - 48));
    const newY = Math.max(0, Math.min(dragRef.current.origY + dy, window.innerHeight - 48));
    setPos({ x: newX, y: newY });
  }, []);

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size],
  );

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    setSize({
      w: Math.max(150, Math.min(resizeRef.current.origW + dx, window.innerWidth - 16)),
      h: Math.max(150, Math.min(resizeRef.current.origH + dy, window.innerHeight - 16)),
    });
  }, []);

  const onResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  return (
    <div
      className="fixed z-[110] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex shrink-0 cursor-grab items-center gap-2 rounded-t-xl border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5 active:cursor-grabbing select-none touch-none"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <Move size="0.875rem" className="text-[var(--muted-foreground)]" />
        <span className="flex-1 truncate text-[0.6875rem] font-medium">{image.prompt || "Gallery Image"}</span>
        <a
          href={image.url}
          download
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size="0.75rem" />
        </a>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
        >
          <X size="0.75rem" />
        </button>
      </div>
      {/* Image content */}
      <div className="relative flex-1 overflow-hidden rounded-b-xl">
        <img
          src={image.url}
          alt={image.prompt || "Gallery image"}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize touch-none"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
      >
        <svg viewBox="0 0 16 16" className="h-full w-full text-[var(--muted-foreground)]/40">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" />
        </svg>
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
      {visibleImages.map((img) => (
        <PinnedImageViewer key={img.id} image={img} onClose={() => unpinImage(img.id)} />
      ))}
    </>
  );
}
