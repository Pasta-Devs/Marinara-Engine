// ──────────────────────────────────────────────
// AvatarCropWidget — square crop selector for circle avatars
// ──────────────────────────────────────────────
// The user drags a square selection over the source image to pick exactly which
// region becomes the avatar. The crop is stored as a region of the SOURCE image
// (normalized to source dimensions), so the original avatar file is never
// rewritten — Roleplay full-image side panels keep showing the untouched portrait.
//
// Render contract (`getAvatarCropStyle` in `lib/utils.ts`): a saved AvatarCrop
// produces an absolutely-positioned `<img>` inside an `overflow:hidden;
// position:relative` container, sized so the crop rectangle maps onto the
// container's full area. Square-in-source-pixels crops survive any source aspect
// ratio without distortion.
import { useEffect, useRef, useState } from "react";
import { Crop, Maximize2, RotateCcw, X } from "lucide-react";
import { type AvatarCrop, type LegacyAvatarCrop, getAvatarCropStyle, isLegacyAvatarCrop } from "../../lib/utils";

interface CropPx {
  x: number;
  y: number;
  size: number;
}

type DragHandle = "pan" | "tl" | "tr" | "bl" | "br";

export interface AvatarCropWidgetProps {
  /** Image URL or data URL to crop. */
  src: string;
  alt: string;
  /** Currently saved crop. Pass null when none has been set. */
  crop: AvatarCrop | LegacyAvatarCrop | null;
  /** Fired on every change (drag, corner resize, reset). Always emits the
   *  current AvatarCrop shape. */
  onChange: (next: AvatarCrop) => void;
}

const MIN_CROP_PX = 24;
const MAX_DISPLAY_W = 360;
const MAX_DISPLAY_H = 360;

export function AvatarCropWidget({ src, alt, crop, onChange }: AvatarCropWidgetProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgRect, setImgRect] = useState<{ w: number; h: number } | null>(null);
  const [cropPx, setCropPx] = useState<CropPx | null>(null);
  const [showFullView, setShowFullView] = useState(false);

  const dragRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startCrop: CropPx;
  } | null>(null);

  // Initialize / reinitialize when source changes
  useEffect(() => {
    setImgRect(null);
    setCropPx(null);
  }, [src]);

  // Cached images are the dominant case in practice (the persona/character
  // panel just rendered a thumbnail of the same URL), and the browser fires
  // the `load` event so quickly that React's onLoad listener can miss it
  // even with `key={src}` forcing a remount. After every render, if the IMG
  // is already complete and we haven't initialized yet, run handleImgLoad
  // ourselves. The `imgRect == null` guard makes this a no-op once initialized.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && imgRect === null) {
      handleImgLoad();
    }
  });

  // Re-sync the local overlay when the parent's `crop` prop changes for the
  // SAME source (e.g. parent reloaded form data, or the saved crop arrived
  // late after initial mount). Without this, late-arriving crop data would be
  // silently replaced by the default centered max-square on first interaction.
  // Skip while a drag is in flight so the user's in-progress edit isn't wiped
  // by their own onChange roundtrip — the drag handler keeps cropPx in sync
  // during the drag, and the parent's crop already mirrors that.
  useEffect(() => {
    if (!imgRect || dragRef.current) return;
    const { w, h } = imgRect;
    if (crop && !isLegacyAvatarCrop(crop)) {
      const size = clamp(crop.srcWidth * w, MIN_CROP_PX, Math.min(w, h));
      setCropPx({
        x: clamp(crop.srcX * w, 0, w - size),
        y: clamp(crop.srcY * h, 0, h - size),
        size,
      });
      return;
    }
    // No saved crop: default to centered max-square.
    const size = Math.min(w, h);
    setCropPx({ x: (w - size) / 2, y: (h - size) / 2, size });
  }, [crop, imgRect]);

  const emitFromPx = (px: CropPx, w: number, h: number) => {
    onChange({
      srcX: px.x / w,
      srcY: px.y / h,
      srcWidth: px.size / w,
      srcHeight: px.size / h,
    });
  };

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    // Compute display dimensions: fit inside MAX_DISPLAY_W x MAX_DISPLAY_H,
    // never upscale past natural size. Canvas matches these dims so cropPx
    // coords are also image-pixel coords (in the displayed scale).
    const natW = img.naturalWidth || 1;
    const natH = img.naturalHeight || 1;
    const scale = Math.min(MAX_DISPLAY_W / natW, MAX_DISPLAY_H / natH, 1);
    const w = natW * scale;
    const h = natH * scale;
    setImgRect({ w, h });

    let initial: CropPx;
    if (crop && !isLegacyAvatarCrop(crop)) {
      initial = {
        x: crop.srcX * w,
        y: crop.srcY * h,
        // srcWidth and srcHeight refer to the same square in source pixels by
        // design, so scaling either one through the displayed dim gives the
        // same value. Trust srcWidth as canonical.
        size: crop.srcWidth * w,
      };
    } else {
      const size = Math.min(w, h);
      initial = { x: (w - size) / 2, y: (h - size) / 2, size };
    }
    setCropPx(initial);
    // Intentionally DO NOT emit on init: opening the editor on an existing
    // avatar shouldn't dirty the form. The first actual drag / corner-resize /
    // reset is what commits the (possibly identical) value upstream. Live
    // preview still reads cropPx so it stays in sync with the overlay.
  };

  const onPointerDown = (e: React.PointerEvent, handle: DragHandle) => {
    if (!cropPx || !imgRect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropPx },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !imgRect) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const W = imgRect.w;
    const H = imgRect.h;
    const start = d.startCrop;
    let next: CropPx;

    if (d.handle === "pan") {
      next = {
        size: start.size,
        x: clamp(start.x + dx, 0, W - start.size),
        y: clamp(start.y + dy, 0, H - start.size),
      };
    } else {
      // Corner resize, square-locked. The opposite corner is the anchor; the
      // dragged corner moves freely; the new size is the smaller of the two
      // available dimensions so the square always fits inside the canvas.
      const startTL = { x: start.x, y: start.y };
      const startBR = { x: start.x + start.size, y: start.y + start.size };
      next = resizeCorner(d.handle, startTL, startBR, dx, dy, W, H);
    }

    setCropPx(next);
    emitFromPx(next, W, H);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const reset = () => {
    if (!imgRect) return;
    const size = Math.min(imgRect.w, imgRect.h);
    const next: CropPx = { x: (imgRect.w - size) / 2, y: (imgRect.h - size) / 2, size };
    setCropPx(next);
    emitFromPx(next, imgRect.w, imgRect.h);
  };

  // Live preview reads cropPx (instant) rather than the saved crop prop, so the
  // preview stays in sync with the overlay even between onChange ticks.
  const previewCrop: AvatarCrop | LegacyAvatarCrop | null =
    crop && isLegacyAvatarCrop(crop)
      ? crop
      : imgRect && cropPx
        ? {
            srcX: cropPx.x / imgRect.w,
            srcY: cropPx.y / imgRect.h,
            srcWidth: cropPx.size / imgRect.w,
            srcHeight: cropPx.size / imgRect.h,
          }
        : null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          <Crop size="0.75rem" /> Avatar Crop
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowFullView(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            title="Open full image"
          >
            <Maximize2 size="0.625rem" /> Full image
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            title="Reset to centered max-square crop"
          >
            <RotateCcw size="0.625rem" /> Reset
          </button>
        </div>
      </div>
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        Drag the square to pan, the corners to resize. The avatar shows exactly the region inside the square.
      </p>

      <div className="flex gap-4 max-md:flex-col max-md:items-center">
        {/* Crop canvas — sized to fit the displayed image exactly so overlay
            coords are also image coords. */}
        <div
          className="relative overflow-hidden rounded-lg bg-black/40 select-none"
          style={{
            width: imgRect?.w ?? MAX_DISPLAY_W,
            height: imgRect?.h ?? MAX_DISPLAY_H,
          }}
        >
          {/* key={src} forces remount when the source changes (e.g. switching
              between personas/characters in the editor). Without this, only the
              `src` attribute updates on the existing element, and if the new
              image is already in browser cache the `load` event never fires for
              React's onLoad listener — so `handleImgLoad` doesn't run and the
              crop overlay never initializes. */}
          <img
            key={src}
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={handleImgLoad}
            draggable={false}
            className="block h-full w-full"
            style={{ objectFit: "fill" }}
          />
          {cropPx && imgRect && (
            <div
              className="absolute touch-none"
              style={{
                left: cropPx.x,
                top: cropPx.y,
                width: cropPx.size,
                height: cropPx.size,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                outline: "2px solid white",
                cursor: "move",
              }}
              onPointerDown={(e) => onPointerDown(e, "pan")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <CornerHandle
                pos="tl"
                onPointerDown={(e) => onPointerDown(e, "tl")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
              <CornerHandle
                pos="tr"
                onPointerDown={(e) => onPointerDown(e, "tr")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
              <CornerHandle
                pos="bl"
                onPointerDown={(e) => onPointerDown(e, "bl")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
              <CornerHandle
                pos="br"
                onPointerDown={(e) => onPointerDown(e, "br")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            </div>
          )}
        </div>

        {/* Live preview — circle avatar at typical sidebar size */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">Preview</span>
          <div className="relative h-24 w-24 overflow-hidden rounded-full bg-black/20 ring-2 ring-[var(--border)]">
            <img src={src} alt={alt} className="h-full w-full object-cover" style={getAvatarCropStyle(previewCrop)} />
          </div>
        </div>
      </div>

      {showFullView && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setShowFullView(false)}
        >
          <img src={src} alt={alt} className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
          <button
            onClick={() => setShowFullView(false)}
            className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          >
            <X size="1rem" />
          </button>
        </div>
      )}
    </div>
  );
}

function CornerHandle({
  pos,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 14,
    height: 14,
    background: "white",
    border: "1px solid black",
    borderRadius: 2,
  };
  const cursorByPos = { tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize" } as const;
  const positionByPos: Record<typeof pos, React.CSSProperties> = {
    tl: { top: -8, left: -8 },
    tr: { top: -8, right: -8 },
    bl: { bottom: -8, left: -8 },
    br: { bottom: -8, right: -8 },
  };
  return (
    <div
      style={{ ...base, ...positionByPos[pos], cursor: cursorByPos[pos] }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function resizeCorner(
  handle: Exclude<DragHandle, "pan">,
  startTL: { x: number; y: number },
  startBR: { x: number; y: number },
  dx: number,
  dy: number,
  W: number,
  H: number,
): CropPx {
  // Each corner anchors the OPPOSITE corner and moves freely. The square's new
  // size is the smaller of the two distances from anchor to dragged-pointer
  // (so the square stays inside the canvas), then clamped to canvas bounds and
  // a minimum size.
  if (handle === "br") {
    const px = startBR.x + dx;
    const py = startBR.y + dy;
    const size = clamp(Math.min(px - startTL.x, py - startTL.y), MIN_CROP_PX, Math.min(W - startTL.x, H - startTL.y));
    return { x: startTL.x, y: startTL.y, size };
  }
  if (handle === "tl") {
    const px = startTL.x + dx;
    const py = startTL.y + dy;
    const size = clamp(Math.min(startBR.x - px, startBR.y - py), MIN_CROP_PX, Math.min(startBR.x, startBR.y));
    return { x: startBR.x - size, y: startBR.y - size, size };
  }
  if (handle === "tr") {
    const anchor = { x: startTL.x, y: startBR.y };
    const px = startBR.x + dx;
    const py = startTL.y + dy;
    const size = clamp(Math.min(px - anchor.x, anchor.y - py), MIN_CROP_PX, Math.min(W - anchor.x, anchor.y));
    return { x: anchor.x, y: anchor.y - size, size };
  }
  // bl
  const anchor = { x: startBR.x, y: startTL.y };
  const px = startTL.x + dx;
  const py = startBR.y + dy;
  const size = clamp(Math.min(anchor.x - px, py - anchor.y), MIN_CROP_PX, Math.min(anchor.x, H - anchor.y));
  return { x: anchor.x - size, y: anchor.y, size };
}
