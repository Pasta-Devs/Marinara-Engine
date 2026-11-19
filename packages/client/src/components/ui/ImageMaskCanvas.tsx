import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Eraser, Paintbrush, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export type MaskTool = "brush" | "eraser";

export interface ImageMaskState {
  strokeCount: number;
  hasMask: boolean;
}

export interface ImageMaskCanvasHandle {
  undo: () => void;
  clear: () => void;
}

interface MaskPoint {
  x: number;
  y: number;
}

interface MaskStroke {
  tool: MaskTool;
  radiusRatio: number;
  points: MaskPoint[];
}

export interface ImageMaskCanvasProps {
  src: string;
  alt: string;
  disabled?: boolean;
  tool?: MaskTool;
  brushSizePx?: number;
  hideToolbar?: boolean;
  onMaskChange: (maskDataUrl: string | null) => void;
  onMaskStateChange?: (state: ImageMaskState) => void;
  controlsRef?: RefObject<ImageMaskCanvasHandle | null>;
  className?: string;
}

const MAX_BACKING_SIDE = 2048;
export const DEFAULT_MASK_BRUSH_PX = 48;
export const MIN_MASK_BRUSH_PX = 8;
export const MAX_MASK_BRUSH_PX = 140;
const MAX_ZOOM = 5;
const OVERLAY_TINT = "rgba(96, 165, 250, 0.58)";

const TOOL_BUTTON_CLASS =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const isTopModal = (el: Element | null) => {
  const modals = document.querySelectorAll(".mari-modal");
  return !!el && modals[modals.length - 1] === el.closest(".mari-modal");
};

function drawDot(ctx: CanvasRenderingContext2D, width: number, height: number, point: MaskPoint, radius: number) {
  ctx.beginPath();
  ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  from: MaskPoint,
  to: MaskPoint,
  radius: number,
) {
  ctx.lineWidth = radius * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x * width, from.y * height);
  ctx.lineTo(to.x * width, to.y * height);
  ctx.stroke();
}

function renderStroke(ctx: CanvasRenderingContext2D, width: number, height: number, stroke: MaskStroke) {
  if (stroke.points.length === 0) return;
  const radius = Math.max(1, stroke.radiusRatio * Math.min(width, height));
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.strokeStyle = "rgba(255, 255, 255, 1)";
  drawDot(ctx, width, height, stroke.points[0]!, radius);
  for (let i = 1; i < stroke.points.length; i++) {
    drawSegment(ctx, width, height, stroke.points[i - 1]!, stroke.points[i]!, radius);
  }
  ctx.restore();
}

/**
 * Overlay brush canvas matching an image's fitted aspect box 1:1 with wheel/pinch zoom and pan.
 * Paints a uniform translucent mask and exports a binary white/black PNG for inpainting.
 */
export function ImageMaskCanvas({
  src,
  alt,
  disabled = false,
  tool,
  brushSizePx,
  hideToolbar = false,
  onMaskChange,
  onMaskStateChange,
  controlsRef,
  className,
}: ImageMaskCanvasProps) {
  const { t } = useUiTranslation();
  const sizeSliderId = useId();
  const stageHostRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const alphaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<MaskStroke[]>([]);
  const activeStrokeRef = useRef<MaskStroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const onMaskChangeRef = useRef(onMaskChange);

  const [hostSize, setHostSize] = useState<{ width: number; height: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [internalTool, setInternalTool] = useState<MaskTool>("brush");
  const [internalBrushSizePx, setInternalBrushSizePx] = useState(DEFAULT_MASK_BRUSH_PX);
  const [strokeCount, setStrokeCount] = useState(0);
  const [hasMask, setHasMask] = useState(false);

  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const interactionRef = useRef<"idle" | "paint" | "pan" | "pinch">("idle");
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef({ dist: 1, s0: 1, imgX: 0, imgY: 0 });

  const activeTool = tool ?? internalTool;
  const activeBrushSizePx = brushSizePx ?? internalBrushSizePx;

  useEffect(() => {
    onMaskChangeRef.current = onMaskChange;
  }, [onMaskChange]);

  useEffect(() => {
    onMaskStateChange?.({ strokeCount, hasMask });
  }, [strokeCount, hasMask, onMaskStateChange]);

  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setHostSize((prev) =>
        prev && Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }, [src]);

  const backingSize = useMemo(() => {
    if (!naturalSize) return null;
    const maxSide = Math.max(naturalSize.width, naturalSize.height);
    const cap = maxSide > MAX_BACKING_SIDE ? MAX_BACKING_SIDE / maxSide : 1;
    return {
      width: Math.max(1, Math.round(naturalSize.width * cap)),
      height: Math.max(1, Math.round(naturalSize.height * cap)),
    };
  }, [naturalSize]);

  const fittedSize = useMemo(() => {
    if (!naturalSize || !hostSize || hostSize.width <= 0 || hostSize.height <= 0) return null;
    const scale = Math.min(hostSize.width / naturalSize.width, hostSize.height / naturalSize.height);
    return {
      width: Math.max(1, Math.floor(naturalSize.width * scale)),
      height: Math.max(1, Math.floor(naturalSize.height * scale)),
    };
  }, [hostSize, naturalSize]);

  const fittedSizeRef = useRef(fittedSize);
  fittedSizeRef.current = fittedSize;

  const applyView = useCallback((scale: number, x: number, y: number) => {
    const s = clamp(scale, 1, MAX_ZOOM);
    const box = fittedSizeRef.current;
    const limitX = box ? (box.width * (s - 1)) / 2 : 0;
    const limitY = box ? (box.height * (s - 1)) / 2 : 0;
    const next = s <= 1.001 ? { s: 1, x: 0, y: 0 } : { s, x: clamp(x, -limitX, limitX), y: clamp(y, -limitY, limitY) };
    viewRef.current = next;
    setView(next);
  }, []);

  const zoomAt = useCallback(
    (scale: number, clientX: number, clientY: number) => {
      const rect = stageHostRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = clientX - (rect.left + rect.width / 2);
      const py = clientY - (rect.top + rect.height / 2);
      const { s, x, y } = viewRef.current;
      const nextS = clamp(scale, 1, MAX_ZOOM);
      const k = nextS / s;
      applyView(nextS, px - (px - x) * k, py - (py - y) * k);
    },
    [applyView],
  );

  useEffect(() => {
    applyView(viewRef.current.s, viewRef.current.x, viewRef.current.y);
  }, [fittedSize, applyView]);

  useEffect(() => {
    applyView(1, 0, 0);
  }, [src, applyView]);

  useEffect(() => {
    const stage = stageHostRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      zoomAt(viewRef.current.s * Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || isTyping(event.target) || !isTopModal(stage))
        return;
      if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (!spaceHeldRef.current) {
          spaceHeldRef.current = true;
          setSpaceHeld(true);
        }
        return;
      }
      const rect = stage.getBoundingClientRect();
      const [cx, cy] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
      if (event.key === "+" || event.key === "=") zoomAt(viewRef.current.s * 1.5, cx, cy);
      else if (event.key === "-") zoomAt(viewRef.current.s / 1.5, cx, cy);
      else if (event.key === "0") applyView(1, 0, 0);
    };
    const clearSpace = () => {
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") clearSpace();
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearSpace);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearSpace);
    };
  }, [applyView, zoomAt]);

  const compositeVisible = useCallback(() => {
    const visible = canvasRef.current;
    const alpha = alphaCanvasRef.current;
    if (!visible || !alpha) return;
    const ctx = visible.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, visible.width, visible.height);
    ctx.drawImage(alpha, 0, 0, visible.width, visible.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = OVERLAY_TINT;
    ctx.fillRect(0, 0, visible.width, visible.height);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const rebuildFromStrokes = useCallback(() => {
    const alpha = alphaCanvasRef.current;
    if (!alpha) return;
    const ctx = alpha.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, alpha.width, alpha.height);
    for (const stroke of strokesRef.current) {
      renderStroke(ctx, alpha.width, alpha.height, stroke);
    }
    compositeVisible();
  }, [compositeVisible]);

  const exportMask = useCallback(() => {
    const alpha = alphaCanvasRef.current;
    if (!alpha) {
      setHasMask(false);
      onMaskChangeRef.current(null);
      return;
    }
    const alphaCtx = alpha.getContext("2d", { willReadFrequently: true });
    if (!alphaCtx) return;

    const width = alpha.width;
    const height = alpha.height;
    const srcData = alphaCtx.getImageData(0, 0, width, height).data;

    let exportCanvas = exportCanvasRef.current;
    if (!exportCanvas || exportCanvas.width !== width || exportCanvas.height !== height) {
      exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      exportCanvasRef.current = exportCanvas;
    }
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    const out = exportCtx.createImageData(width, height);
    const outData = out.data;
    let painted = false;
    for (let i = 0; i < srcData.length; i += 4) {
      if (srcData[i + 3]! > 0) {
        outData[i] = 255;
        outData[i + 1] = 255;
        outData[i + 2] = 255;
        outData[i + 3] = 255;
        painted = true;
      } else {
        outData[i] = 0;
        outData[i + 1] = 0;
        outData[i + 2] = 0;
        outData[i + 3] = 255;
      }
    }

    setHasMask(painted);
    if (!painted) {
      onMaskChangeRef.current(null);
      return;
    }
    exportCtx.putImageData(out, 0, 0);
    onMaskChangeRef.current(exportCanvas.toDataURL("image/png"));
  }, []);

  useEffect(() => {
    const visible = canvasRef.current;
    if (!visible || !backingSize) return;
    if (visible.width !== backingSize.width || visible.height !== backingSize.height) {
      visible.width = backingSize.width;
      visible.height = backingSize.height;
    }
    let alpha = alphaCanvasRef.current;
    if (!alpha) {
      alpha = document.createElement("canvas");
      alphaCanvasRef.current = alpha;
    }
    if (alpha.width !== backingSize.width || alpha.height !== backingSize.height) {
      alpha.width = backingSize.width;
      alpha.height = backingSize.height;
    }
    rebuildFromStrokes();
  }, [backingSize, rebuildFromStrokes]);

  const toCanvasPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number): MaskPoint => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0,
      y: rect.height > 0 ? Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)) : 0,
    };
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.target instanceof Element && event.target.closest("button")) return;

    const stage = event.currentTarget;
    stage.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      if (activeStrokeRef.current) {
        activeStrokeRef.current = null;
        activePointerIdRef.current = null;
        rebuildFromStrokes();
      }
      interactionRef.current = "pinch";
      setIsPanning(false);
      panLastRef.current = null;

      const [a, b] = [...pointersRef.current.values()];
      const midX = (a!.x + b!.x) / 2;
      const midY = (a!.y + b!.y) / 2;
      const dist = Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y));
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      pinchRef.current = {
        dist,
        s0: viewRef.current.s,
        imgX: (midX - cx - viewRef.current.x) / viewRef.current.s,
        imgY: (midY - cy - viewRef.current.y) / viewRef.current.s,
      };
      return;
    }

    if (pointersRef.current.size !== 1) return;

    const wantsPan =
      event.pointerType === "mouse" &&
      (event.button === 1 || event.button === 2 || (event.button === 0 && spaceHeldRef.current));
    if (wantsPan && viewRef.current.s > 1) {
      interactionRef.current = "pan";
      panLastRef.current = { x: event.clientX, y: event.clientY };
      setIsPanning(true);
      return;
    }

    const canvas = canvasRef.current;
    if (disabled || !backingSize || event.button > 0 || !canvas || event.target !== canvas) return;

    const rect = canvas.getBoundingClientRect();
    const minSide = Math.max(1, Math.min(rect.width, rect.height));
    const radiusRatio = activeBrushSizePx / 2 / minSide;
    const point = toCanvasPoint(canvas, event.clientX, event.clientY);
    const stroke: MaskStroke = { tool: activeTool, radiusRatio, points: [point] };

    interactionRef.current = "paint";
    activePointerIdRef.current = event.pointerId;
    activeStrokeRef.current = stroke;

    const alpha = alphaCanvasRef.current;
    const ctx = alpha?.getContext("2d");
    if (alpha && ctx) {
      const radius = Math.max(1, stroke.radiusRatio * Math.min(alpha.width, alpha.height));
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      drawDot(ctx, alpha.width, alpha.height, point, radius);
      ctx.restore();
      compositeVisible();
    }
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (interactionRef.current === "pinch" && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const midX = (a!.x + b!.x) / 2;
      const midY = (a!.y + b!.y) / 2;
      const dist = Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y));
      const rect = event.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nextS = clamp(pinchRef.current.s0 * (dist / pinchRef.current.dist), 1, MAX_ZOOM);
      applyView(nextS, midX - cx - pinchRef.current.imgX * nextS, midY - cy - pinchRef.current.imgY * nextS);
      return;
    }

    if (interactionRef.current === "pan" && panLastRef.current) {
      const dx = event.clientX - panLastRef.current.x;
      const dy = event.clientY - panLastRef.current.y;
      panLastRef.current = { x: event.clientX, y: event.clientY };
      applyView(viewRef.current.s, viewRef.current.x + dx, viewRef.current.y + dy);
      return;
    }

    const stroke = activeStrokeRef.current;
    const canvas = canvasRef.current;
    if (interactionRef.current !== "paint" || !stroke || activePointerIdRef.current !== event.pointerId || !canvas)
      return;

    const point = toCanvasPoint(canvas, event.clientX, event.clientY);
    const prev = stroke.points[stroke.points.length - 1]!;
    stroke.points.push(point);

    const alpha = alphaCanvasRef.current;
    const ctx = alpha?.getContext("2d");
    if (alpha && ctx) {
      const radius = Math.max(1, stroke.radiusRatio * Math.min(alpha.width, alpha.height));
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      drawSegment(ctx, alpha.width, alpha.height, prev, point, radius);
      ctx.restore();
      compositeVisible();
    }
  };

  const finishStagePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointersRef.current.delete(event.pointerId);

    const stroke = activeStrokeRef.current;
    if (interactionRef.current === "paint" && stroke && activePointerIdRef.current === event.pointerId) {
      activeStrokeRef.current = null;
      activePointerIdRef.current = null;
      interactionRef.current = "idle";
      strokesRef.current.push(stroke);
      setStrokeCount(strokesRef.current.length);
      exportMask();
      return;
    }

    if (interactionRef.current === "pan") {
      panLastRef.current = null;
      setIsPanning(false);
      interactionRef.current = "idle";
      return;
    }

    if (interactionRef.current === "pinch" && pointersRef.current.size === 0) {
      interactionRef.current = "idle";
    }
  };

  const handleUndo = useCallback(() => {
    if (disabled || strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    rebuildFromStrokes();
    exportMask();
  }, [disabled, exportMask, rebuildFromStrokes]);

  const handleClear = useCallback(() => {
    if (disabled || (strokesRef.current.length === 0 && !hasMask)) return;
    strokesRef.current = [];
    setStrokeCount(0);
    setHasMask(false);
    rebuildFromStrokes();
    onMaskChangeRef.current(null);
  }, [disabled, hasMask, rebuildFromStrokes]);

  useImperativeHandle(
    controlsRef,
    () => ({
      undo: handleUndo,
      clear: handleClear,
    }),
    [handleClear, handleUndo],
  );

  return (
    <div
      className={cn(
        "flex size-full min-h-0 flex-col items-center justify-center overflow-hidden",
        !hideToolbar && "gap-2",
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        ref={stageHostRef}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={finishStagePointer}
        onPointerCancel={finishStagePointer}
        onContextMenu={(event) => event.preventDefault()}
        className="relative min-h-0 w-full flex-1 touch-none select-none overflow-hidden"
      >
        {view.s > 1.01 && (
          <button
            type="button"
            onClick={() => applyView(1, 0, 0)}
            aria-label={t("ui.imagemaskcanvas.resetZoom")}
            title={t("ui.imagemaskcanvas.resetZoom")}
            className="absolute left-2 top-2 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--sidebar)]/90 px-2.5 text-xs font-medium tabular-nums text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            <RotateCcw size="0.875rem" aria-hidden />
            {t("ui.imagemaskcanvas.zoomLevel", { scale: view.s.toFixed(1) })}
          </button>
        )}
        <div
          className={cn(
            "absolute left-1/2 top-1/2 origin-center overflow-hidden rounded-lg shadow-2xl",
            !fittedSize && "max-h-full max-w-full",
          )}
          style={{
            ...(fittedSize ?? {}),
            transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.s})`,
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(event) =>
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            className="block size-full select-none object-contain"
          />
          <canvas
            ref={canvasRef}
            aria-label={t("ui.imagemaskcanvas.canvasLabel")}
            className={cn(
              "absolute inset-0 size-full touch-none",
              disabled
                ? "cursor-not-allowed opacity-70"
                : isPanning
                  ? "cursor-grabbing"
                  : spaceHeld && view.s > 1
                    ? "cursor-grab"
                    : "cursor-crosshair",
            )}
          />
        </div>
      </div>

      {!hideToolbar && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar)]/95 px-2.5 py-1.5 text-xs text-[var(--foreground)] shadow-lg">
          <button
            type="button"
            onClick={() => setInternalTool("brush")}
            aria-pressed={activeTool === "brush"}
            disabled={disabled}
            className={cn(
              TOOL_BUTTON_CLASS,
              activeTool === "brush"
                ? "border-[var(--primary)] bg-[var(--primary)]/15 font-semibold text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Paintbrush size="0.875rem" aria-hidden />
            {t("ui.imagemaskcanvas.brush")}
          </button>
          <button
            type="button"
            onClick={() => setInternalTool("eraser")}
            aria-pressed={activeTool === "eraser"}
            disabled={disabled}
            className={cn(
              TOOL_BUTTON_CLASS,
              activeTool === "eraser"
                ? "border-[var(--primary)] bg-[var(--primary)]/15 font-semibold text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Eraser size="0.875rem" aria-hidden />
            {t("ui.imagemaskcanvas.eraser")}
          </button>

          <label
            htmlFor={sizeSliderId}
            className="flex min-h-11 items-center gap-2 px-1 text-xs text-[var(--muted-foreground)] sm:border-l sm:border-[var(--border)] sm:pl-2.5"
          >
            <span className="shrink-0">{t("ui.imagemaskcanvas.brushSize")}</span>
            <input
              id={sizeSliderId}
              type="range"
              min={MIN_MASK_BRUSH_PX}
              max={MAX_MASK_BRUSH_PX}
              step={2}
              value={activeBrushSizePx}
              disabled={disabled}
              onChange={(event) => setInternalBrushSizePx(Number(event.target.value))}
              className="w-24 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
            />
            <span className="w-11 text-right tabular-nums text-[var(--foreground)]">
              {t("ui.imagemaskcanvas.brushSizeValue", { size: activeBrushSizePx })}
            </span>
          </label>

          <button
            type="button"
            onClick={handleUndo}
            disabled={disabled || strokeCount === 0}
            aria-label={t("ui.imagemaskcanvas.undo")}
            title={t("ui.imagemaskcanvas.undo")}
            className={cn(
              TOOL_BUTTON_CLASS,
              "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]",
            )}
          >
            <Undo2 size="0.875rem" aria-hidden />
            <span className="max-sm:sr-only">{t("ui.imagemaskcanvas.undo")}</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || (!hasMask && strokeCount === 0)}
            aria-label={t("ui.imagemaskcanvas.clear")}
            title={t("ui.imagemaskcanvas.clear")}
            className={cn(
              TOOL_BUTTON_CLASS,
              "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]",
            )}
          >
            <Trash2 size="0.875rem" aria-hidden />
            <span className="max-sm:sr-only">{t("ui.imagemaskcanvas.clear")}</span>
          </button>

          <span
            role="status"
            className={cn(
              "rounded-md border px-2 py-1 text-[0.7rem] font-medium",
              hasMask
                ? "border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)]",
            )}
          >
            {t(hasMask ? "ui.imagemaskcanvas.modeInpainting" : "ui.imagemaskcanvas.modeImg2Img")}
          </span>
        </div>
      )}
    </div>
  );
}
