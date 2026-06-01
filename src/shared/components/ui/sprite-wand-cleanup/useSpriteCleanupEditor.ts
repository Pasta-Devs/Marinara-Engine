import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { applyBrushLine, applyBrushStamp } from "./sprite-cleanup-brush";
import { getErrorMessage } from "../../../lib/error-message";
import { canvasPointFromClient, loadImageToCanvas } from "./sprite-cleanup-canvas";
import {
  brushActionLabels,
  clampZoom,
  cleanupToolToBrushMode,
  createBrushStrokeOptions,
  DEFAULT_BLUR_STRENGTH,
  DEFAULT_BRUSH_COLOR,
  DEFAULT_BRUSH_HARDNESS,
  DEFAULT_BRUSH_OPACITY,
  DEFAULT_BRUSH_SIZE,
  DEFAULT_CLEAN_EDGE_GUARD,
  DEFAULT_CLEAN_FEATHER,
  DEFAULT_CLEAN_TOLERANCE,
  DEFAULT_TOLERANCE,
  DEFAULT_WAND_FEATHER,
  DEFAULT_WAND_SOFTNESS,
  DEFAULT_WAND_STRONG,
  imageDataEquals,
  MAX_HISTORY,
  rgbaToHex,
  STRONG_WAND_EDGE_GUARD,
  STRONG_WAND_EXPAND,
  WAND_EDGE_GUARD,
  WAND_EXPAND,
  type BrushGesture,
  type BrushToolMode,
  type CleanupTool,
  type HoverPoint,
  type PanGesture,
  type PreviewBackground,
} from "./sprite-cleanup-model";
import { cloneImageData, formatRgba, rgbaAt } from "./sprite-cleanup-pixels";
import type { CanvasPoint, WandResult } from "./sprite-cleanup-types";
import { removeWandSelection } from "./sprite-cleanup-wand";

interface UseSpriteCleanupEditorOptions {
  imageUrl: string;
  applying: boolean;
  onApply: (cleanedDataUrl: string) => Promise<void> | void;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;

  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "color", "radio", "range", "reset", "submit"].includes(target.type);
  }

  return false;
}

export function useSpriteCleanupEditor({ imageUrl, applying, onApply }: UseSpriteCleanupEditorOptions) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<ImageData | null>(null);
  const currentImageRef = useRef<ImageData | null>(null);
  const brushGestureRef = useRef<BrushGesture | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);

  const [tool, setTool] = useState<CleanupTool>("wand");
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>("dark");
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [wandStrong, setWandStrong] = useState(DEFAULT_WAND_STRONG);
  const [wandSoftness, setWandSoftness] = useState(DEFAULT_WAND_SOFTNESS);
  const [wandFeather, setWandFeather] = useState(DEFAULT_WAND_FEATHER);
  const [cleanTolerance, setCleanTolerance] = useState(DEFAULT_CLEAN_TOLERANCE);
  const [cleanEdgeGuard, setCleanEdgeGuard] = useState(DEFAULT_CLEAN_EDGE_GUARD);
  const [cleanFeather, setCleanFeather] = useState(DEFAULT_CLEAN_FEATHER);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [brushHardness, setBrushHardness] = useState(DEFAULT_BRUSH_HARDNESS);
  const [brushOpacity, setBrushOpacity] = useState(DEFAULT_BRUSH_OPACITY);
  const [brushToolMode, setBrushToolMode] = useState<BrushToolMode>("paint");
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
  const [pickingBrushColor, setPickingBrushColor] = useState(false);
  const [blurStrength, setBlurStrength] = useState(DEFAULT_BLUR_STRENGTH);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);
  const [history, setHistoryState] = useState<ImageData[]>([]);
  const [redoHistory, setRedoHistoryState] = useState<ImageData[]>([]);
  // Keep history synchronous for repeated undo/redo clicks before React re-renders.
  const historyRef = useRef<ImageData[]>([]);
  const redoHistoryRef = useRef<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const setHistory = useCallback((update: ImageData[] | ((prev: ImageData[]) => ImageData[])) => {
    const next = typeof update === "function" ? update(historyRef.current) : update;
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  const setRedoHistory = useCallback((update: ImageData[] | ((prev: ImageData[]) => ImageData[])) => {
    const next = typeof update === "function" ? update(redoHistoryRef.current) : update;
    redoHistoryRef.current = next;
    setRedoHistoryState(next);
  }, []);

  const putCurrentImage = useCallback(() => {
    const canvas = canvasRef.current;
    const imageData = currentImageRef.current;
    if (!canvas || !imageData) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.putImageData(imageData, 0, 0);
  }, []);

  const restoreImageData = useCallback(
    (imageData: ImageData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const next = cloneImageData(imageData);
      canvas.width = next.width;
      canvas.height = next.height;
      currentImageRef.current = next;
      setCanvasSize({ width: next.width, height: next.height });
      putCurrentImage();
    },
    [putCurrentImage],
  );

  const fitCanvasToStage = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || canvas.width <= 0 || canvas.height <= 0) return;

    const availableWidth = Math.max(1, stage.clientWidth - 32);
    const availableHeight = Math.max(1, stage.clientHeight - 32);
    const nextZoom = Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height);
    setZoom(clampZoom(nextZoom));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frameId: number | null = null;

    setLoading(true);
    setError(null);
    setStatus(null);
    setHasChanges(false);
    setHistory([]);
    setRedoHistory([]);
    setHoverPoint(null);
    setIsPanning(false);
    setPickingBrushColor(false);
    setZoom(1);
    originalImageRef.current = null;
    currentImageRef.current = null;

    const loadWhenCanvasMounts = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        frameId = requestAnimationFrame(loadWhenCanvasMounts);
        return;
      }

      loadImageToCanvas(imageUrl, canvas)
        .then((imageData) => {
          if (cancelled) return;
          originalImageRef.current = cloneImageData(imageData);
          restoreImageData(imageData);
          setLoading(false);
          requestAnimationFrame(fitCanvasToStage);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(getErrorMessage(err, "Sprite image could not be loaded"));
          setLoading(false);
        });
    };

    frameId = requestAnimationFrame(loadWhenCanvasMounts);

    return () => {
      cancelled = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [fitCanvasToStage, imageUrl, restoreImageData, setHistory, setRedoHistory]);

  const updateHoverPoint = useCallback((event: PointerEvent<HTMLCanvasElement>): CanvasPoint | null => {
    const point = canvasPointFromClient(canvasRef.current, event.clientX, event.clientY);
    const imageData = currentImageRef.current;

    if (!point || !imageData) {
      setHoverPoint(null);
      return null;
    }

    setHoverPoint({ ...point, color: rgbaAt(imageData, point) });
    return point;
  }, []);

  const pushHistory = useCallback(
    (snapshot: ImageData) => {
      setRedoHistory([]);
      setHistory((prev) => [...prev.slice(Math.max(0, prev.length - MAX_HISTORY + 1)), snapshot]);
    },
    [setHistory, setRedoHistory],
  );

  const pushRedoHistory = useCallback(
    (snapshot: ImageData) => {
      setRedoHistory((prev) => [...prev.slice(Math.max(0, prev.length - MAX_HISTORY + 1)), snapshot]);
    },
    [setRedoHistory],
  );

  const applyWandAtPoint = useCallback(
    (point: CanvasPoint) => {
      const current = currentImageRef.current;
      if (!current) return;

      const before = cloneImageData(current);
      const next = cloneImageData(current);
      const selectionTolerance = wandStrong ? Math.min(224, Math.round(tolerance * 1.55)) : tolerance;
      const result: WandResult = removeWandSelection(next, point.x, point.y, selectionTolerance, {
        neighborMode: wandStrong ? "all" : "cardinal",
        edgeGuard: wandStrong ? STRONG_WAND_EDGE_GUARD : WAND_EDGE_GUARD,
        expand: wandStrong ? STRONG_WAND_EXPAND : WAND_EXPAND,
        softness: wandSoftness,
        feather: wandFeather,
      });

      if (result.removed === 0) {
        setStatus("No opaque pixels selected");
        return;
      }

      pushHistory(before);
      currentImageRef.current = next;
      putCurrentImage();
      setHasChanges(true);
      const modeLabel = `${wandStrong ? "strong " : ""}wand (${wandSoftness}% softness, ${wandFeather}% feather)`;
      setStatus(`${result.removed.toLocaleString()} px removed with ${modeLabel} from ${formatRgba(result.target)}`);
      setError(null);
    },
    [pushHistory, putCurrentImage, tolerance, wandFeather, wandSoftness, wandStrong],
  );

  const commitBrushGesture = useCallback(
    (canvas: HTMLCanvasElement | null, pointerId: number) => {
      const gesture = brushGestureRef.current;
      if (!gesture || gesture.pointerId !== pointerId) return;

      brushGestureRef.current = null;
      if (canvas?.hasPointerCapture(gesture.pointerId)) {
        canvas.releasePointerCapture(gesture.pointerId);
      }

      if (gesture.changedPixels === 0) {
        setStatus("No pixels changed");
        return;
      }

      pushHistory(gesture.before);
      setHasChanges(true);
      const actionLabel = brushActionLabels[gesture.options.mode];
      setStatus(`${gesture.changedPixels.toLocaleString()} px ${actionLabel}`);
      setError(null);
    },
    [pushHistory],
  );

  const commitPanGesture = useCallback((target: Element | null, pointerId: number) => {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;

    panGestureRef.current = null;
    setIsPanning(false);
    if (target?.hasPointerCapture(gesture.pointerId)) {
      target.releasePointerCapture(gesture.pointerId);
    }
  }, []);

  const beginPanGesture = useCallback((event: PointerEvent<HTMLElement>) => {
    const stage = stageRef.current;
    if (!stage) return false;

    panGestureRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: stage.scrollLeft,
      startScrollTop: stage.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    setStatus("Panning");
    return true;
  }, []);

  const updatePanGesture = useCallback((event: PointerEvent<HTMLElement>) => {
    const panGesture = panGestureRef.current;
    if (!panGesture || panGesture.pointerId !== event.pointerId) return false;

    const stage = stageRef.current;
    if (stage) {
      stage.scrollLeft = panGesture.startScrollLeft - (event.clientX - panGesture.startClientX);
      stage.scrollTop = panGesture.startScrollTop - (event.clientY - panGesture.startClientY);
    }
    return true;
  }, []);

  const handleCanvasPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (loading || applying) return;

      const isPrimaryButton = event.button === 0;
      const isMiddleButton = event.button === 1;
      if (!isPrimaryButton && !isMiddleButton) return;

      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (brushGestureRef.current || panGestureRef.current) return;

      if (tool === "pan" || isMiddleButton) {
        beginPanGesture(event);
        return;
      }

      const point = updateHoverPoint(event);
      if (!point) return;

      const current = currentImageRef.current;
      if (tool === "brush" && brushToolMode === "paint" && pickingBrushColor) {
        if (!current) return;

        const sampledColor = rgbaAt(current, point);
        setBrushColor(rgbaToHex(sampledColor));
        setPickingBrushColor(false);
        setStatus(`Brush color picked: ${formatRgba(sampledColor)}`);
        setError(null);
        return;
      }

      if (tool === "wand") {
        applyWandAtPoint(point);
        return;
      }

      if (!current) return;

      const mode = cleanupToolToBrushMode(tool, brushToolMode);
      if (!mode) return;

      const radius = Math.max(1, brushSize / 2);
      const brushOptions = createBrushStrokeOptions({
        mode,
        radius,
        brushHardness,
        brushOpacity,
        blurStrength,
        cleanTarget: rgbaAt(current, point),
        cleanTolerance,
        cleanEdgeGuard,
        cleanFeather,
        brushColor,
      });
      const before = cloneImageData(current);
      const changedPixels = applyBrushStamp(current, originalImageRef.current, point.x, point.y, brushOptions);
      putCurrentImage();

      brushGestureRef.current = {
        pointerId: event.pointerId,
        before,
        lastPoint: point,
        changedPixels,
        options: brushOptions,
        interrupted: false,
      };
      canvas.setPointerCapture(event.pointerId);
    },
    [
      applyWandAtPoint,
      applying,
      blurStrength,
      brushColor,
      brushHardness,
      brushOpacity,
      brushSize,
      brushToolMode,
      cleanEdgeGuard,
      cleanFeather,
      cleanTolerance,
      loading,
      pickingBrushColor,
      putCurrentImage,
      tool,
      updateHoverPoint,
      beginPanGesture,
    ],
  );

  const handleStagePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (loading || applying || event.button !== 1) return;
      if (brushGestureRef.current || panGestureRef.current) return;

      event.preventDefault();
      beginPanGesture(event);
    },
    [applying, beginPanGesture, loading],
  );

  const handleStagePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      updatePanGesture(event);
    },
    [updatePanGesture],
  );

  const handleStagePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      commitPanGesture(event.currentTarget, event.pointerId);
    },
    [commitPanGesture],
  );

  const handleStagePointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      commitPanGesture(event.currentTarget, event.pointerId);
    },
    [commitPanGesture],
  );

  const handleStageAuxClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button === 1) event.preventDefault();
  }, []);

  const handleCanvasPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (updatePanGesture(event)) {
        return;
      }

      const brushGesture = brushGestureRef.current;
      const current = currentImageRef.current;
      if (brushGesture && brushGesture.pointerId !== event.pointerId) return;

      const point = updateHoverPoint(event);
      if (!brushGesture || !current) return;

      if (!point) {
        brushGesture.interrupted = true;
        return;
      }

      if (brushGesture.interrupted) {
        brushGesture.changedPixels += applyBrushStamp(
          current,
          originalImageRef.current,
          point.x,
          point.y,
          brushGesture.options,
        );
        brushGesture.lastPoint = point;
        brushGesture.interrupted = false;
        putCurrentImage();
        return;
      }

      brushGesture.changedPixels += applyBrushLine(
        current,
        originalImageRef.current,
        brushGesture.lastPoint,
        point,
        brushGesture.options,
      );
      brushGesture.lastPoint = point;
      putCurrentImage();
    },
    [putCurrentImage, updateHoverPoint, updatePanGesture],
  );

  const handleCanvasPointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      commitBrushGesture(event.currentTarget, event.pointerId);
      commitPanGesture(event.currentTarget, event.pointerId);
    },
    [commitBrushGesture, commitPanGesture],
  );

  const handleCanvasPointerCancel = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      commitBrushGesture(event.currentTarget, event.pointerId);
      commitPanGesture(event.currentTarget, event.pointerId);
    },
    [commitBrushGesture, commitPanGesture],
  );

  const handleCanvasPointerLeave = useCallback(() => {
    setHoverPoint(null);
  }, []);

  const handleUndo = useCallback(() => {
    const previous = historyRef.current[historyRef.current.length - 1];
    const current = currentImageRef.current;
    if (!previous || !current) return;

    setHistory(historyRef.current.slice(0, -1));
    pushRedoHistory(cloneImageData(current));
    restoreImageData(previous);
    setHasChanges(!imageDataEquals(previous, originalImageRef.current));
    setStatus("Undo applied");
    setError(null);
  }, [pushRedoHistory, restoreImageData, setHistory]);

  const handleRedo = useCallback(() => {
    const next = redoHistoryRef.current[redoHistoryRef.current.length - 1];
    const current = currentImageRef.current;
    if (!next || !current) return;

    setRedoHistory(redoHistoryRef.current.slice(0, -1));
    setHistory((prev) => [...prev.slice(Math.max(0, prev.length - MAX_HISTORY + 1)), cloneImageData(current)]);
    restoreImageData(next);
    setHasChanges(!imageDataEquals(next, originalImageRef.current));
    setStatus("Redo applied");
    setError(null);
  }, [restoreImageData, setHistory, setRedoHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (loading || applying || isTextEntryTarget(event.target)) return;
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);

      if (wantsUndo && historyRef.current.length > 0) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (wantsRedo && redoHistoryRef.current.length > 0) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applying, handleRedo, handleUndo, loading]);

  const handleReset = useCallback(() => {
    if (!originalImageRef.current) return;
    restoreImageData(originalImageRef.current);
    setHistory([]);
    setRedoHistory([]);
    setHasChanges(false);
    setStatus("Reset");
    setError(null);
  }, [restoreImageData, setHistory, setRedoHistory]);

  const handleResetWandDefaults = useCallback(() => {
    setTolerance(DEFAULT_TOLERANCE);
    setWandStrong(DEFAULT_WAND_STRONG);
    setWandSoftness(DEFAULT_WAND_SOFTNESS);
    setWandFeather(DEFAULT_WAND_FEATHER);
    setStatus("Wand settings reset");
    setError(null);
  }, []);

  const handleSelectTool = useCallback((nextTool: CleanupTool) => {
    setTool(nextTool);
    if (nextTool !== "brush") {
      setPickingBrushColor(false);
    }
  }, []);

  const handleSelectBrushToolMode = useCallback((nextMode: BrushToolMode) => {
    setBrushToolMode(nextMode);
    if (nextMode !== "paint") {
      setPickingBrushColor(false);
    }
  }, []);

  const handleToggleBrushColorPicker = useCallback(() => {
    setPickingBrushColor((value) => {
      const next = !value;
      setStatus(next ? "Click the sprite to pick a brush color" : "Brush color picker canceled");
      setError(null);
      return next;
    });
  }, []);

  const handleBrushColorChange = useCallback((nextColor: string) => {
    setBrushColor(nextColor);
    setPickingBrushColor(false);
  }, []);

  const handleApply = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setError(null);
      await onApply(canvas.toDataURL("image/png"));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save sprite cleanup"));
    }
  }, [onApply]);

  const handleStageWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((value) => clampZoom(value * factor));
  }, []);

  const zoomIn = useCallback(() => setZoom((value) => clampZoom(value * 1.25)), []);
  const zoomOut = useCallback(() => setZoom((value) => clampZoom(value / 1.25)), []);

  const canvasDisplayStyle = useMemo<CSSProperties>(
    () => ({
      width: canvasSize.width > 0 ? `${canvasSize.width * zoom}px` : undefined,
      height: canvasSize.height > 0 ? `${canvasSize.height * zoom}px` : undefined,
      imageRendering: zoom >= 2 ? "pixelated" : "auto",
    }),
    [canvasSize.height, canvasSize.width, zoom],
  );
  const activeBrushMode = cleanupToolToBrushMode(tool, brushToolMode);

  const reticleStyle = useMemo<CSSProperties | null>(() => {
    if (!hoverPoint) return null;
    const diameter = activeBrushMode && !pickingBrushColor ? Math.max(8, brushSize * zoom) : Math.max(12, 12 * zoom);
    return {
      width: `${diameter}px`,
      height: `${diameter}px`,
      left: `${(hoverPoint.x + 0.5) * zoom}px`,
      top: `${(hoverPoint.y + 0.5) * zoom}px`,
      transform: "translate(-50%, -50%)",
    };
  }, [activeBrushMode, brushSize, hoverPoint, pickingBrushColor, zoom]);

  const cursorClass = isPanning
    ? "cursor-grabbing"
    : tool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : tool === "wand" || pickingBrushColor
        ? "cursor-crosshair"
        : "cursor-none";

  const hoverReadout = hoverPoint
    ? `x ${hoverPoint.x}, y ${hoverPoint.y} · ${formatRgba(hoverPoint.color)}`
    : "Move over the sprite to sample pixels";

  return {
    stageRef,
    canvasRef,
    controls: {
      tool,
      activeBrushMode,
      brushToolMode,
      pickingBrushColor,
      previewBackground,
      loading,
      applying,
      zoom,
      tolerance,
      wandStrong,
      wandSoftness,
      wandFeather,
      brushSize,
      cleanTolerance,
      cleanEdgeGuard,
      cleanFeather,
      brushColor,
      brushOpacity,
      brushHardness,
      blurStrength,
      onSelectTool: handleSelectTool,
      onZoomOut: zoomOut,
      onFitCanvasToStage: fitCanvasToStage,
      onZoomIn: zoomIn,
      onResetWandDefaults: handleResetWandDefaults,
      onToleranceChange: setTolerance,
      onWandStrongChange: setWandStrong,
      onWandSoftnessChange: setWandSoftness,
      onWandFeatherChange: setWandFeather,
      onBrushSizeChange: setBrushSize,
      onSelectBrushToolMode: handleSelectBrushToolMode,
      onCleanToleranceChange: setCleanTolerance,
      onCleanEdgeGuardChange: setCleanEdgeGuard,
      onCleanFeatherChange: setCleanFeather,
      onBrushColorChange: handleBrushColorChange,
      onToggleBrushColorPicker: handleToggleBrushColorPicker,
      onBrushOpacityChange: setBrushOpacity,
      onBrushHardnessChange: setBrushHardness,
      onBlurStrengthChange: setBlurStrength,
      onPreviewBackgroundChange: setPreviewBackground,
    },
    loading,
    error,
    status,
    hasChanges,
    canUndo: history.length > 0,
    canRedo: redoHistory.length > 0,
    hoverReadout,
    canvasDisplayStyle,
    reticleStyle,
    cursorClass,
    handleStageWheel,
    handleStagePointerDown,
    handleStagePointerMove,
    handleStagePointerUp,
    handleStagePointerCancel,
    handleStageAuxClick,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCanvasPointerCancel,
    handleCanvasPointerLeave,
    handleUndo,
    handleRedo,
    handleReset,
    handleApply,
  };
}
