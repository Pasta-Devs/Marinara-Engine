import { useCallback, useEffect, useState } from "react";
import { Crop, Loader2, RotateCcw, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

interface SpriteFrameAdjustments {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

type SpriteFrameAdjustmentKey = keyof SpriteFrameAdjustments;

interface SpriteFrameEditorProps {
  imageUrl: string;
  label: string;
  applying?: boolean;
  onApply: (croppedDataUrl: string) => Promise<void> | void;
  onClose: () => void;
}

const DEFAULT_FRAME_ADJUSTMENTS: SpriteFrameAdjustments = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const FRAME_CONTROLS: Array<{ key: SpriteFrameAdjustmentKey; label: string }> = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

const MAX_SINGLE_EDGE_CROP = 80;
const MAX_PAIR_CROP = 90;

function percentToPixels(size: number, value: number): number {
  return Math.round((size * value) / 100);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(MAX_SINGLE_EDGE_CROP, Number.isFinite(value) ? value : 0));
}

export function cropSpriteDataUrl(dataUrl: string, frame: SpriteFrameAdjustments): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const cropLeft = percentToPixels(width, frame.left);
      const cropRight = percentToPixels(width, frame.right);
      const cropTop = percentToPixels(height, frame.top);
      const cropBottom = percentToPixels(height, frame.bottom);
      const outputWidth = width - cropLeft - cropRight;
      const outputHeight = height - cropTop - cropBottom;

      if (outputWidth <= 0 || outputHeight <= 0) {
        reject(new Error("Frame settings leave no usable sprite area"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is unavailable"));
        return;
      }

      ctx.drawImage(image, cropLeft, cropTop, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Sprite image could not be loaded"));
    image.src = dataUrl;
  });
}

export function SpriteFrameEditor({ imageUrl, label, applying = false, onApply, onClose }: SpriteFrameEditorProps) {
  const { t: localizeUi } = useUiTranslation();
  const [frame, setFrame] = useState<SpriteFrameAdjustments>(DEFAULT_FRAME_ADJUSTMENTS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFrame(DEFAULT_FRAME_ADJUSTMENTS);
    setPreviewUrl(null);
    setError(null);
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;
    cropSpriteDataUrl(imageUrl, frame)
      .then((preview) => {
        if (!cancelled) {
          setPreviewUrl(preview);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setPreviewUrl(imageUrl);
          setError(err?.message || "Frame preview failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [frame, imageUrl]);

  const handleFrameChange = useCallback((key: SpriteFrameAdjustmentKey, value: number) => {
    setFrame((prev) => {
      const next = { ...prev, [key]: clampPercent(value) };

      if (key === "left" || key === "right") {
        const opposite = key === "left" ? "right" : "left";
        const overflow = next.left + next.right - MAX_PAIR_CROP;
        if (overflow > 0) next[opposite] = Math.max(0, next[opposite] - overflow);
      } else {
        const opposite = key === "top" ? "bottom" : "top";
        const overflow = next.top + next.bottom - MAX_PAIR_CROP;
        if (overflow > 0) next[opposite] = Math.max(0, next[opposite] - overflow);
      }

      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    setError(null);
    try {
      await onApply(await cropSpriteDataUrl(imageUrl, frame));
    } catch (err: any) {
      setError(err?.message || "Failed to frame sprite");
    }
  }, [frame, imageUrl, onApply]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start gap-4 max-sm:flex-col">
        <div className="aspect-square w-36 shrink-0 overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-[var(--border)] max-sm:w-full">
          <img src={previewUrl ?? imageUrl} alt={label} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
              <Crop size="0.875rem" className="shrink-0 text-[var(--primary)]" />
              <span className="truncate capitalize">
                {localizeUi("ui.characters.spritestab.frame")} {label}
              </span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label={localizeUi("ui.ui.spriteframeeditor.closeFrameEditor")}
              title={localizeUi("capabilities.actions.close")}
            >
              <X size="0.875rem" />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {FRAME_CONTROLS.map(({ key, label: controlLabel }) => (
              <label key={key} className="flex items-center gap-2 text-[0.6875rem]">
                <span className="w-12 shrink-0 text-[var(--foreground)]">{controlLabel}</span>
                <input
                  type="range"
                  min={0}
                  max={MAX_SINGLE_EDGE_CROP}
                  step={0.5}
                  value={frame[key]}
                  onChange={(e) => handleFrameChange(key, Number(e.target.value))}
                  className="min-w-0 flex-1 accent-[var(--primary)]"
                />
                <span className="w-12 text-right tabular-nums text-[var(--muted-foreground)]">
                  {frame[key].toFixed(1)}%
                </span>
              </label>
            ))}
          </div>

          {error && <p className="text-[0.6875rem] text-[var(--destructive)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFrame(DEFAULT_FRAME_ADJUSTMENTS)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)]"
            >
              <RotateCcw size="0.75rem" />
              {localizeUi("ui.characters.charactercliptrimmodal.reset")}
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {applying ? <Loader2 size="0.75rem" className="animate-spin" /> : <Crop size="0.75rem" />}
              {localizeUi("ui.ui.spriteframeeditor.applyFrame")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
