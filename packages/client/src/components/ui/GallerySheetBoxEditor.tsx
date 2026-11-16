// ──────────────────────────────────────────────
// GallerySheetBoxEditor — recut one sticker / emoji by placing a box on the
// whole (background-free) sheet: drag the box, pull its corners, or draw a
// new box around the sticker. Everything inside the box becomes the picture.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Crop, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { GallerySheetBox } from "../../lib/gallery-sheet-cut";

type Drag =
  | { mode: "move"; pointerId: number; offsetX: number; offsetY: number }
  | { mode: "resize"; pointerId: number; anchorX: number; anchorY: number }
  | { mode: "draw"; pointerId: number; anchorX: number; anchorY: number; moved: boolean };

const CORNERS = [
  { key: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { key: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { key: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { key: "se", x: 1, y: 1, cursor: "nwse-resize" },
] as const;

// The same light/dark check as the tiles, so the see-through sheet reads as cut out in every theme.
const CHECKER_STYLE = {
  backgroundImage: "repeating-conic-gradient(rgb(128 128 128 / 0.22) 0% 25%, transparent 0% 50%)",
  backgroundSize: "16px 16px",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function GallerySheetBoxEditor({
  sheet,
  sheetSize,
  initialBox,
  title,
  onApply,
  onClose,
}: {
  sheet: string;
  sheetSize: { width: number; height: number };
  initialBox: GallerySheetBox;
  title: string;
  onApply: (box: GallerySheetBox) => Promise<void> | void;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { width: sheetWidth, height: sheetHeight } = sheetSize;
  const minSide = Math.max(8, Math.round(Math.min(sheetWidth, sheetHeight) * 0.03));
  const [box, setBox] = useState<GallerySheetBox>(initialBox);
  const [applying, setApplying] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  /** A pointer position in sheet pixels. */
  const toSheet = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      return {
        x: clamp(((event.clientX - rect.left) / rect.width) * sheetWidth, 0, sheetWidth),
        y: clamp(((event.clientY - rect.top) / rect.height) * sheetHeight, 0, sheetHeight),
      };
    },
    [sheetWidth, sheetHeight],
  );

  /** The box spanned by a fixed corner and the pointer, kept at least `minSide` and on the sheet. */
  const spanBox = useCallback(
    (anchorX: number, anchorY: number, x: number, y: number): GallerySheetBox => {
      let left = Math.min(anchorX, x);
      let top = Math.min(anchorY, y);
      let right = Math.max(anchorX, x);
      let bottom = Math.max(anchorY, y);
      if (right - left < minSide) {
        if (x < anchorX) left = Math.max(0, anchorX - minSide);
        else right = Math.min(sheetWidth, anchorX + minSide);
        if (right - left < minSide) left = Math.max(0, right - minSide);
      }
      if (bottom - top < minSide) {
        if (y < anchorY) top = Math.max(0, anchorY - minSide);
        else bottom = Math.min(sheetHeight, anchorY + minSide);
        if (bottom - top < minSide) top = Math.max(0, bottom - minSide);
      }
      return { x: left, y: top, width: right - left, height: bottom - top };
    },
    [minSide, sheetWidth, sheetHeight],
  );

  const startDrag = (event: ReactPointerEvent<HTMLElement>, drag: Drag) => {
    if (applying) return;
    event.preventDefault();
    event.stopPropagation();
    frameRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = drag;
  };

  const onFramePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = toSheet(event);
    startDrag(event, { mode: "draw", pointerId: event.pointerId, anchorX: point.x, anchorY: point.y, moved: false });
  };

  const onBoxPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = toSheet(event);
    startDrag(event, { mode: "move", pointerId: event.pointerId, offsetX: point.x - box.x, offsetY: point.y - box.y });
  };

  const onCornerPointerDown = (event: ReactPointerEvent<HTMLSpanElement>, cornerX: number, cornerY: number) => {
    // Resizing keeps the opposite corner where it is.
    startDrag(event, {
      mode: "resize",
      pointerId: event.pointerId,
      anchorX: cornerX === 0 ? box.x + box.width : box.x,
      anchorY: cornerY === 0 ? box.y + box.height : box.y,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = toSheet(event);
    if (drag.mode === "move") {
      setBox((current) => ({
        ...current,
        x: clamp(point.x - drag.offsetX, 0, sheetWidth - current.width),
        y: clamp(point.y - drag.offsetY, 0, sheetHeight - current.height),
      }));
      return;
    }
    if (drag.mode === "draw" && !drag.moved) {
      // A tap shouldn't throw the box away: only start a new one once the pointer travels.
      if (Math.hypot(point.x - drag.anchorX, point.y - drag.anchorY) < minSide / 2) return;
      drag.moved = true;
    }
    setBox(spanBox(drag.anchorX, drag.anchorY, point.x, point.y));
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (frameRef.current?.hasPointerCapture(event.pointerId)) frameRef.current.releasePointerCapture(event.pointerId);
    if (drag.mode === "draw" && !drag.moved) {
      // A tap outside the box moves the box there, centred on the tap.
      const point = toSheet(event);
      setBox((current) => ({
        ...current,
        x: clamp(point.x - current.width / 2, 0, sheetWidth - current.width),
        y: clamp(point.y - current.height / 2, 0, sheetHeight - current.height),
      }));
    }
  };

  const apply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await onApply({
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
    } finally {
      setApplying(false);
    }
  };

  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <div
      ref={rootRef}
      className="select-none space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
      data-gallery-sheet-box-editor=""
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
          <Crop size="0.875rem" className="shrink-0 text-[var(--primary)]" />
          <span className="truncate">{title}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={applying}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors max-sm:h-9 max-sm:w-9 [@media(hover:hover)]:hover:bg-[var(--accent)] [@media(hover:hover)]:hover:text-[var(--foreground)]"
          aria-label={localizeUi("capabilities.actions.close")}
          title={localizeUi("capabilities.actions.close")}
        >
          <X size="0.875rem" />
        </button>
      </div>
      <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] max-sm:text-[13px]">
        {localizeUi("ui.ui.gallerysheetcells.boxHint")}
      </p>

      <div className="flex justify-center">
        <div
          ref={frameRef}
          className="relative w-fit touch-none select-none overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
          style={CHECKER_STYLE}
          onPointerDown={onFramePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <img
            src={sheet}
            alt=""
            draggable={false}
            className="pointer-events-none block max-h-[min(60vh,32rem)] max-w-full"
          />
          <div
            role="presentation"
            onPointerDown={onBoxPointerDown}
            className="absolute cursor-move outline outline-2 outline-[var(--primary)]"
            style={{
              left: percent(box.x, sheetWidth),
              top: percent(box.y, sheetHeight),
              width: percent(box.width, sheetWidth),
              height: percent(box.height, sheetHeight),
              // Dim everything outside the box.
              boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.5)",
            }}
          >
            {CORNERS.map((corner) => (
              <span
                key={corner.key}
                onPointerDown={(event) => onCornerPointerDown(event, corner.x, corner.y)}
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center max-sm:h-10 max-sm:w-10 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
                style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%`, cursor: corner.cursor }}
              >
                <span className="h-3 w-3 rounded-sm bg-[var(--primary)] ring-2 ring-white/90" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
          {Math.round(box.width)} × {Math.round(box.height)}
        </span>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={applying}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] transition-opacity disabled:opacity-50 max-sm:min-h-11 [@media(hover:hover)]:hover:opacity-90"
        >
          <Check size="0.8125rem" />
          {localizeUi("ui.ui.gallerysheetcells.useBox")}
        </button>
      </div>
    </div>
  );
}
