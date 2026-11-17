// ──────────────────────────────────────────────
// Shared full-screen picture viewer (built on Modal)
// Zoom + pan, optional gallery (arrows, swipe, filmstrip), toolbar and caption slots.
// ──────────────────────────────────────────────
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";

/** The round button every viewer toolbar and arrow uses (44px touch target). */
export const VIEWER_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--sidebar)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:opacity-50";

const MAX_ZOOM = 5;
const DOUBLE_TAP_MS = 300;
const SWIPE_PX = 50;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** False while another Modal (a confirm, a menu sheet) is open on top of the viewer that holds `el`. */
const isTopModal = (el: Element | null) => {
  const modals = document.querySelectorAll(".mari-modal");
  return !!el && modals[modals.length - 1] === el.closest(".mari-modal");
};

interface ZoomStageProps {
  src: string;
  alt: string;
  onZoomChange: (zoomed: boolean) => void;
  /** Horizontal swipe at 1x: `1` for next, `-1` for previous. */
  onSwipe?: (direction: 1 | -1) => void;
  /** A tap on the empty space around the picture. */
  onBackgroundTap: () => void;
}

/** The picture itself: double-tap, wheel and pinch zoom, drag to pan. Remount it (key) to reset the zoom. */
function ZoomStage({ src, alt, onZoomChange, onSwipe, onBackgroundTap }: ZoomStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [smooth, setSmooth] = useState(false);
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    multi: false,
    onImage: false,
    pinchDistance: 0,
    pinchScale: 1,
    lastTap: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const apply = (scale: number, x: number, y: number) => {
    const s = clamp(scale, 1, MAX_ZOOM);
    const img = imgRef.current;
    const limitX = img ? (img.offsetWidth * (s - 1)) / 2 : 0;
    const limitY = img ? (img.offsetHeight * (s - 1)) / 2 : 0;
    const next = s === 1 ? { s, x: 0, y: 0 } : { s, x: clamp(x, -limitX, limitX), y: clamp(y, -limitY, limitY) };
    viewRef.current = next;
    setView(next);
    onZoomChange(s > 1);
  };

  /** Zoom to `scale` keeping the picture point under the screen point (clientX, clientY) still. */
  const zoomAt = (scale: number, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - (rect.left + rect.width / 2);
    const py = clientY - (rect.top + rect.height / 2);
    const { s, x, y } = viewRef.current;
    const k = clamp(scale, 1, MAX_ZOOM) / s;
    apply(scale, px - (px - x) * k, py - (py - y) * k);
  };

  // Wheel needs a non-passive native listener to stop the page scrolling; keys +/-/0 zoom for keyboard users.
  // No deps: re-attached each render so the handlers never go stale.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setSmooth(false);
      zoomAt(viewRef.current.s * Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || isTyping(event.target) || !isTopModal(stage))
        return;
      const rect = stage.getBoundingClientRect();
      const [cx, cy] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
      if (event.key === "+" || event.key === "=") zoomAt(viewRef.current.s * 1.5, cx, cy);
      else if (event.key === "-") zoomAt(viewRef.current.s / 1.5, cx, cy);
      else if (event.key === "0") apply(1, 0, 0);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey);
    };
  });

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    setSmooth(false);
    if (pointers.current.size === 1) {
      Object.assign(g, { startX: event.clientX, startY: event.clientY, moved: false, multi: false });
      g.onImage = event.target === imgRef.current;
    } else if (pointers.current.size === 2) {
      g.multi = true;
      g.pinchDistance = pinchDistance();
      g.pinchScale = viewRef.current.s;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      zoomAt((g.pinchScale * pinchDistance()) / (g.pinchDistance || 1), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
    } else if (pointers.current.size === 1) {
      if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > 8) g.moved = true;
      const { s, x, y } = viewRef.current;
      if (s > 1) apply(s, x + event.clientX - previous.x, y + event.clientY - previous.y);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId) || pointers.current.size > 0) return;
    const g = gesture.current;
    if (g.multi) {
      g.multi = false;
      return;
    }
    if (event.type === "pointercancel") return;
    if (g.moved) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (
        event.pointerType !== "mouse" &&
        viewRef.current.s === 1 &&
        Math.abs(dx) > SWIPE_PX &&
        Math.abs(dx) > Math.abs(dy) * 1.5
      ) {
        onSwipe?.(dx < 0 ? 1 : -1);
      }
      return;
    }
    const doubleTap =
      event.timeStamp - g.lastTap < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - g.lastTapX, event.clientY - g.lastTapY) < 30;
    if (doubleTap) {
      g.lastTap = 0;
      setSmooth(true);
      if (viewRef.current.s > 1) apply(1, 0, 0);
      else zoomAt(2, event.clientX, event.clientY);
      return;
    }
    Object.assign(g, { lastTap: event.timeStamp, lastTapX: event.clientX, lastTapY: event.clientY });
  };

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Close on click, not pointerup: the closing viewer turns pointer-events off, so a click after pointerup would hit the page below.
      onClick={() => !gesture.current.moved && !gesture.current.onImage && onBackgroundTap()}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
        className={cn(
          "max-h-full max-w-full rounded-lg object-contain shadow-2xl",
          smooth && "transition-transform duration-150 motion-reduce:transition-none",
        )}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
      />
    </div>
  );
}

export interface ImageViewerItem {
  url: string;
  alt?: string;
}

interface ImageViewerProps {
  /** Names the dialog for screen readers. */
  title: string;
  onClose: () => void;
  /** The X button; defaults to `onClose`. Lets Escape step back out of a sub-panel while the X still closes the viewer. */
  onCloseButton?: () => void;
  /** Blocks every way of closing (Escape, back, tap outside, the X) while work runs. */
  closeDisabled?: boolean;
  /** Label of the close button; defaults to "Close image". */
  closeLabel?: string;
  /** Open above Professor Mari's window (the omnibar layer). */
  overMari?: boolean;
  /** The picture to show, zoomable. Ignored when `media` is set. */
  src?: string;
  alt?: string;
  /** Replaces the picture, for example a `<video>`. No zoom or swipe. */
  media?: ReactNode;
  /** Gallery pictures. With more than one: counter, arrows, ← →, swipe and filmstrip. */
  items?: ImageViewerItem[];
  /** Index of the shown gallery picture; pair with `onIndexChange`. */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Buttons in the top-right toolbar, left of Close. */
  actions?: ReactNode;
  /** Caption area under the picture (prompt, file info, ...). */
  children?: ReactNode;
  /** Lets the owner put focus back on Close after its own panels close. */
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function ImageViewer({
  title,
  onClose,
  onCloseButton,
  closeDisabled = false,
  closeLabel,
  overMari = false,
  src,
  alt,
  media,
  items,
  index = 0,
  onIndexChange,
  actions,
  children,
  closeButtonRef,
}: ImageViewerProps) {
  const { t } = useTranslation();
  const ownCloseRef = useRef<HTMLButtonElement>(null);
  const closeRef = closeButtonRef ?? ownCloseRef;
  // Keyed by picture so a swap (gallery step, regenerate) never leaves the arrows stuck off.
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);
  const filmstripSelectedRef = useRef<HTMLButtonElement>(null);

  const count = items?.length ?? 0;
  const gallery = !media && count > 1;
  const current = gallery ? items![clamp(index, 0, count - 1)]! : null;
  const shownSrc = current?.url ?? src ?? "";
  const shownAlt = current?.alt ?? alt ?? "";
  const zoomed = zoomedSrc === shownSrc;

  const go = (target: number) => {
    if (!gallery || zoomed || target < 0 || target >= count) return;
    onIndexChange?.(target);
  };

  useEffect(() => {
    if (!gallery) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target) || !isTopModal(closeRef.current)) return;
      if (event.key === "ArrowLeft") go(index - 1);
      else if (event.key === "ArrowRight") go(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    // Follows the CSS scroll-behavior, so reduced motion jumps instead of gliding.
    filmstripSelectedRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index, gallery]);

  const arrowClass = cn(VIEWER_BUTTON_CLASS, "absolute top-1/2 z-10 -translate-y-1/2");

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      hideHeader
      fadeOnly
      mobileFullscreen
      pullToClose={false}
      backdrop="dark"
      layer={overMari ? "omnibar" : "default"}
      chatFloatingPanel
      closeDisabled={closeDisabled}
      initialFocusRef={closeRef}
      width="max-w-none"
      panelClassName="sm:!h-full sm:!max-h-full !rounded-none !border-0 !bg-transparent ![box-shadow:none] !backdrop-blur-none"
      contentClassName="!flex !flex-col !overflow-hidden !p-0"
    >
      <div className="relative min-h-0 flex-1">
        {media ? (
          <div
            className="flex size-full items-center justify-center p-2"
            onClick={(event) => event.target === event.currentTarget && !closeDisabled && onClose()}
          >
            {media}
          </div>
        ) : (
          <ZoomStage
            key={shownSrc}
            src={shownSrc}
            alt={shownAlt}
            onZoomChange={(isZoomed) => setZoomedSrc(isZoomed ? shownSrc : null)}
            onSwipe={gallery ? (direction) => go(index + direction) : undefined}
            onBackgroundTap={() => !closeDisabled && onClose()}
          />
        )}
        {gallery && (
          <span
            role="status"
            className="absolute left-2 top-2 z-10 rounded-lg bg-black/60 px-2.5 py-1.5 text-sm tabular-nums text-white"
          >
            {t("ui.imageviewer.position", { current: index + 1, total: count })}
          </span>
        )}
        {gallery && (
          <>
            <button
              type="button"
              className={cn(arrowClass, "left-2")}
              onClick={() => go(index - 1)}
              disabled={zoomed || index <= 0}
              aria-label={t("ui.imageviewer.previousImage")}
            >
              <ChevronLeft size="1.25rem" />
            </button>
            <button
              type="button"
              className={cn(arrowClass, "right-2")}
              onClick={() => go(index + 1)}
              disabled={zoomed || index >= count - 1}
              aria-label={t("ui.imageviewer.nextImage")}
            >
              <ChevronRight size="1.25rem" />
            </button>
          </>
        )}
        <div className="absolute right-2 top-2 z-10 flex gap-2">
          {actions}
          <button
            type="button"
            ref={closeRef}
            onClick={onCloseButton ?? onClose}
            disabled={closeDisabled}
            aria-label={closeLabel ?? t("ui.chat.chatimagelightbox.closeImage")}
            className={VIEWER_BUTTON_CLASS}
          >
            <X size="0.875rem" />
          </button>
        </div>
      </div>
      {children && (
        <div className="mx-auto max-h-[45dvh] w-full max-w-3xl shrink-0 overflow-y-auto px-3 pb-2">{children}</div>
      )}
      {gallery && (
        <div className="flex shrink-0 justify-start gap-2 overflow-x-auto px-3 py-2 motion-safe:scroll-smooth sm:justify-center">
          {items!.map((item, i) => (
            <button
              key={`${i}-${item.url}`}
              type="button"
              ref={i === index ? filmstripSelectedRef : undefined}
              onClick={() => go(i)}
              disabled={zoomed}
              aria-label={t("ui.imageviewer.showImageValue1", { value1: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "size-12 shrink-0 overflow-hidden rounded-md opacity-70 outline-offset-2 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--ring)]",
                i === index && "opacity-100 ring-2 ring-white",
              )}
            >
              <img
                src={item.url}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
