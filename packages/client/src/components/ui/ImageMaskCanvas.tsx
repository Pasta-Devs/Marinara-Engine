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
import { Eraser, Paintbrush, Trash2, Undo2 } from "lucide-react";
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
const OVERLAY_TINT = "rgba(96, 165, 250, 0.58)";

const TOOL_BUTTON_CLASS =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45";

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
 * Overlay brush canvas matching an image's fitted aspect box 1:1.
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    if (disabled || !backingSize || event.button > 0) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const minSide = Math.max(1, Math.min(rect.width, rect.height));
    const radiusRatio = activeBrushSizePx / 2 / minSide;
    const point = toCanvasPoint(canvas, event.clientX, event.clientY);
    const stroke: MaskStroke = { tool: activeTool, radiusRatio, points: [point] };

    activePointerIdRef.current = event.pointerId;
    activeStrokeRef.current = stroke;
    canvas.setPointerCapture?.(event.pointerId);

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

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerIdRef.current !== event.pointerId) return;
    const point = toCanvasPoint(event.currentTarget, event.clientX, event.clientY);
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

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    const stroke = activeStrokeRef.current;
    if (!stroke || activePointerIdRef.current !== event.pointerId) return;
    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    strokesRef.current.push(stroke);
    setStrokeCount(strokesRef.current.length);
    exportMask();
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
      <div ref={stageHostRef} className="relative min-h-0 w-full flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg shadow-2xl",
            !fittedSize && "max-h-full max-w-full",
          )}
          style={fittedSize ?? undefined}
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
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            className={cn(
              "absolute inset-0 size-full touch-none",
              disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair",
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
