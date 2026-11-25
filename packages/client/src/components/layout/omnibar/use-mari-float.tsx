import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
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

/** The zone outline grows out of her window into the zone (and back), like Windows Snap; CSS transitions it. */
function writePreview(preview: HTMLElement | null, rect: MariFloatRect, shown: boolean) {
  if (!preview) return;
  writeRect(preview, rect);
  preview.dataset.shown = shown ? "true" : "false";
}

/** How long a dropped window glides into its place (matches the CSS transition). */
const SETTLE_MS = 200;

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
  // The outline of the zone a drag would drop her into, drawn under her. Moved by hand, never by React state.
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // A layout effect: a window resized while she was docked must not paint one frame at the old size on Float.
  useLayoutEffect(() => {
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

  // One gesture at a time: a second press (another finger, a pen) while one runs is ignored.
  const gestureRef = useRef(false);

  /** Runs one pointer gesture on `handle`; `onMove` returns the rectangle to draw, `onEnd` commits it. */
  const track = (
    event: PointerEvent<HTMLElement>,
    onMove: (move: globalThis.PointerEvent) => MariFloatRect | null,
    onEnd: (last: MariFloatRect) => void,
  ) => {
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    gestureRef.current = true;
    handle.setPointerCapture(pointerId);
    let last: MariFloatRect | null = null;
    const move = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      const rect = onMove(next);
      if (!rect) return;
      if (!last) setDragging(true);
      last = rect;
      writeRect(panelRef.current, rect);
    };
    const end = (up: Event) => {
      if (up instanceof globalThis.PointerEvent && up.pointerId !== pointerId) return;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      handle.removeEventListener("lostpointercapture", end);
      gestureRef.current = false;
      // Moves are coalesced per frame, so the release point can be past the last move: take it into account.
      const final = up.type === "pointerup" && last ? (onMove(up as globalThis.PointerEvent) ?? last) : null;
      setDragging(false);
      if (final) onEnd(final);
      // Draw what the store now says. A drop into the zone she was already in changes nothing the layout
      // effect watches, so without this she would stay where the drag left her. She glides there.
      const ui = useUIStore.getState();
      const settled = drawnMariFloatRect(ui.mariFloatRect, ui.mariFloatZone, readView(), remPx());
      const panel = panelRef.current;
      if (panel) {
        panel.dataset.floatSettling = "true";
        window.setTimeout(() => delete panel.dataset.floatSettling, SETTLE_MS + 50);
      }
      writeRect(panel, settled);
      // The outline melts into where she landed.
      writePreview(previewRef.current, settled, false);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    // Capture can be lost without a pointerup (the window loses focus mid-drag): end the gesture there too.
    handle.addEventListener("lostpointercapture", end);
  };

  const onHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!active || gestureRef.current || event.button !== 0 || (event.target as Element).closest(HEADER_CONTROLS))
      return;
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
        const next = clampMariFloatRect({ ...origin, left: origin.left + dx, top: origin.top + dy }, view);
        // Outside a zone the hidden outline rides along with her, so the next zone grows out of her window.
        writePreview(previewRef.current, target ? mariFloatZoneRect(target, view) : next, target !== null);
        return next;
      },
      (last) => {
        // Dropped in a zone, she keeps the free place she was dragged from for when she leaves it again.
        if (target) ui.setMariFloatPlace(ui.mariFloatZone ? (ui.mariFloatRect ?? origin) : start, target);
        else ui.setMariFloatPlace(last, null);
      },
    );
  };

  const onResizePointerDown = (edge: MariFloatEdge) => (event: PointerEvent<HTMLElement>) => {
    if (!active || gestureRef.current || event.button !== 0) return;
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
    previewRef,
    onHeaderPointerDown,
    onResizePointerDown,
    toggle,
  };
}

/**
 * The eight edge and corner grips of her floating window. Near an edge an accent line shows it can be dragged;
 * near a corner, a corner grip like the chat windows' one. Mouse and pen only; Dock back is the keyboard's way out.
 */
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
        >
          {edge.length === 2 ? <span className="mari-float-resize__grip" /> : null}
        </div>
      ))}
    </>
  );
}
