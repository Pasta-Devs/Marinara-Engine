import type { CSSProperties, MouseEventHandler, PointerEventHandler, RefObject, WheelEventHandler } from "react";
import { Loader2 } from "lucide-react";
import { previewBackgroundStyles, type PreviewBackground } from "./sprite-cleanup-model";

interface SpriteCleanupCanvasStageProps {
  label: string;
  previewBackground: PreviewBackground;
  pickingBrushColor: boolean;
  loading: boolean;
  cursorClass: string;
  canvasDisplayStyle: CSSProperties;
  reticleStyle: CSSProperties | null;
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStageWheel: WheelEventHandler<HTMLDivElement>;
  onStagePointerDown: PointerEventHandler<HTMLDivElement>;
  onStagePointerMove: PointerEventHandler<HTMLDivElement>;
  onStagePointerUp: PointerEventHandler<HTMLDivElement>;
  onStagePointerCancel: PointerEventHandler<HTMLDivElement>;
  onStageAuxClick: MouseEventHandler<HTMLDivElement>;
  onCanvasPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onCanvasPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onCanvasPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onCanvasPointerCancel: PointerEventHandler<HTMLCanvasElement>;
  onCanvasPointerLeave: () => void;
}

export function SpriteCleanupCanvasStage({
  label,
  previewBackground,
  pickingBrushColor,
  loading,
  cursorClass,
  canvasDisplayStyle,
  reticleStyle,
  stageRef,
  canvasRef,
  onStageWheel,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onStagePointerCancel,
  onStageAuxClick,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerCancel,
  onCanvasPointerLeave,
}: SpriteCleanupCanvasStageProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={stageRef}
        onWheel={onStageWheel}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerCancel}
        onAuxClick={onStageAuxClick}
        className="relative flex h-full min-h-0 items-start justify-start overflow-auto rounded-xl border border-[var(--border)] p-3"
        style={previewBackgroundStyles[previewBackground]}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/60">
            <Loader2 size="1.5rem" className="animate-spin text-[var(--primary)]" />
          </div>
        )}
        <div
          className="relative mx-auto my-auto shrink-0 rounded-lg shadow-xl shadow-black/30"
          style={{
            width: canvasDisplayStyle.width,
            height: canvasDisplayStyle.height,
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerCancel}
            onPointerLeave={onCanvasPointerLeave}
            className={`block rounded-lg [touch-action:none] ${cursorClass}`}
            style={canvasDisplayStyle}
            aria-label={`Wand cleanup canvas for ${label}`}
            title={pickingBrushColor ? "Pick brush color" : "Edit sprite transparency"}
          />
          {reticleStyle && !loading && (
            <span
              className="pointer-events-none absolute rounded-full border border-[var(--primary)] shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_0_14px_rgba(255,179,217,0.35)]"
              style={reticleStyle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
