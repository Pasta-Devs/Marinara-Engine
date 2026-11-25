import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useMatchMedia } from "../../../hooks/use-match-media";
import {
  clampMariFloatRect,
  drawnMariFloatRect,
  mariFloatZoneAt,
  mariFloatZoneRect,
  resizeMariFloatRect,
  startMariFloatRect,
  unsnapMariFloatRect,
  type MariFloatEdge,
  type MariFloatRect,
  type MariFloatView,
  type MariFloatZone,
} from "../../../lib/mari-float-layout";
import { useUIStore } from "../../../stores/ui.store";

/** Presses on these inside her header are clicks, not the start of a move. */
const HEADER_CONTROLS = "button, a, input, textarea, select, label, [role='tab'], [role='slider'], [contenteditable]";
/** A press has to travel this far before it moves her, so a click on the header stays a click. */
const DRAG_THRESHOLD_PX = 4;
const EDGES: MariFloatEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const readView = (): MariFloatView => ({ width: window.innerWidth, height: window.innerHeight });

function writeRect(panel: HTMLElement | null, rect: MariFloatRect) {
  if (!panel) return;
  panel.style.setProperty("--mari-float-left", `${rect.left}px`);
  panel.style.setProperty("--mari-float-top", `${rect.top}px`);
  panel.style.setProperty("--mari-float-width", `${rect.width}px`);
  panel.style.setProperty("--mari-float-height", `${rect.height}px`);
}

function clearRect(panel: HTMLElement | null) {
  for (const name of ["left", "top", "width", "height"]) panel?.style.removeProperty(`--mari-float-${name}`);
}

/**
 * Prof. Mari's floating window (#9818): on a computer, "Float" turns her centred, blurred window into one with no
 * backdrop that stays open while the app beside her is used. It is dragged by its header, resized from its edges,
 * and snaps to the left half, the right half or the whole screen when dropped at that edge. The editor companion
 * (use-mari-companion) wins while it is docked: that is its own place for her.
 */
export function useMariFloat(mariSurface: boolean, companion: boolean, panelRef: RefObject<HTMLElement | null>) {
  const desktop = useMatchMedia("(min-width: 1024px)");
  const floating = useUIStore((s) => s.mariFloating);
  const rect = useUIStore((s) => s.mariFloatRect);
  const zone = useUIStore((s) => s.mariFloatZone);
  const available = mariSurface && desktop && !companion;
  const active = available && floating;
  const [view, setView] = useState(readView);
  // The zone a drag would drop her into, shown as an outline under her.
  const [preview, setPreview] = useState<MariFloatZone | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!active) return;
    const onResize = () => setView(readView());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);

  const drawn = drawnMariFloatRect(rect, zone, view, remPx());
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;
  const { left, top, width, height } = drawn;
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!active) return clearRect(panel);
    writeRect(panel, { left, top, width, height });
  }, [active, left, top, width, height, panelRef]);

  /** Runs one pointer gesture on `handle`; `onMove` returns the rectangle to draw, `onEnd` commits it. */
  const track = (
    event: PointerEvent<HTMLElement>,
    onMove: (move: globalThis.PointerEvent) => MariFloatRect | null,
    onEnd: (last: MariFloatRect | null, up: globalThis.PointerEvent) => void,
  ) => {
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    let last: MariFloatRect | null = null;
    const move = (next: globalThis.PointerEvent) => {
      const rect = onMove(next);
      if (!rect) return;
      if (!last) setDragging(true);
      last = rect;
      writeRect(panelRef.current, rect);
    };
    const end = (up: globalThis.PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setDragging(false);
      setPreview(null);
      if (up.type === "pointercancel" || !last) {
        writeRect(panelRef.current, drawnRef.current);
        return;
      }
      onEnd(last, up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const onHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!active || event.button !== 0 || (event.target as Element).closest(HEADER_CONTROLS)) return;
    // No text selection or focus change while she is moved.
    event.preventDefault();
    const view = readView();
    const start = drawnRef.current;
    const ui = useUIStore.getState();
    const startX = event.clientX;
    const startY = event.clientY;
    // A snapped window leaves its zone at its free size, still under the pointer.
    const origin = ui.mariFloatZone
      ? clampMariFloatRect(
          unsnapMariFloatRect(ui.mariFloatRect ?? startMariFloatRect(view, remPx()), start, { x: startX, y: startY }),
          view,
        )
      : start;
    let target: MariFloatZone | null = null;
    let moved = false;
    track(
      event,
      (move) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return null;
        moved = true;
        target = mariFloatZoneAt(move.clientX, move.clientY, view);
        setPreview(target);
        return clampMariFloatRect({ ...origin, left: origin.left + dx, top: origin.top + dy }, view);
      },
      (last) => {
        // Dropped in a zone, she keeps the free place she was dragged from for when she leaves it again.
        if (target) ui.setMariFloatPlace(ui.mariFloatZone ? (ui.mariFloatRect ?? origin) : start, target);
        else if (last) ui.setMariFloatPlace(last, null);
      },
    );
  };

  const onResizePointerDown = (edge: MariFloatEdge) => (event: PointerEvent<HTMLElement>) => {
    if (!active || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const view = readView();
    // Resizing a snapped window unsnaps it at the zone's rectangle.
    const start = drawnRef.current;
    const startX = event.clientX;
    const startY = event.clientY;
    track(
      event,
      (move) => resizeMariFloatRect(start, edge, move.clientX - startX, move.clientY - startY, view),
      (last) => useUIStore.getState().setMariFloatPlace(last, null),
    );
  };

  const toggle = () => {
    const ui = useUIStore.getState();
    ui.setMariFloating(!ui.mariFloating);
  };

  return {
    available,
    active,
    zone,
    dragging,
    preview: active && preview ? mariFloatZoneRect(preview, view) : null,
    onHeaderPointerDown,
    onResizePointerDown,
    toggle,
  };
}

/** The eight edge and corner grips of her floating window. Mouse and pen only; Dock back is the keyboard's way out. */
export function MariFloatResizeHandles({
  onResizePointerDown,
}: {
  onResizePointerDown: (edge: MariFloatEdge) => (event: PointerEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {EDGES.map((edge) => (
        <div
          key={edge}
          aria-hidden="true"
          title={t("omnibar.float.resize", "Drag to resize Prof. Mari")}
          data-edge={edge}
          className="mari-float-resize"
          onPointerDown={onResizePointerDown(edge)}
        />
      ))}
    </>
  );
}
