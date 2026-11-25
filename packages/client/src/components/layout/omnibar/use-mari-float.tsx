import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useMatchMedia } from "../../../hooks/use-match-media";
import {
  clampMariFloatRect,
  drawnMariFloatRect,
  MARI_FLOAT_EDGE_PX,
  mariFloatDockWidth,
  mariFloatZoneAt,
  mariFloatZoneRect,
  resizeMariFloatDock,
  resizeMariFloatRect,
  startMariFloatRect,
  unsnapMariFloatRect,
  type MariFloatEdge,
  type MariFloatRect,
  type MariFloatView,
  type MariFloatZone,
} from "../../../lib/mari-float-layout";
import { useUIStore } from "../../../stores/ui.store";
import { WindowResizeGrip, isWindowResizeCorner } from "../../ui/WindowResizeGrip";
import { mariCompanionDockRect } from "./use-mari-companion";

/** Presses on these inside her header are clicks, not the start of a move. */
const HEADER_CONTROLS = "button, a, input, textarea, select, label, [role='tab'], [role='slider'], [contenteditable]";
/** A press has to travel this far before it moves her, so a click on the header stays a click. */
const DRAG_THRESHOLD_PX = 4;
const EDGES: MariFloatEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
/** The viewport, and the bottom of the app's top bar, which the whole-screen zone stays below. */
const readView = (): MariFloatView => ({
  width: window.innerWidth,
  height: window.innerHeight,
  top: document.querySelector('[data-component="TopBar"]')?.getBoundingClientRect().bottom ?? 0,
});
/** The app shell's room for her side dock (AppShell). A dock resize moves it by hand; the store commits on release. */
const dockSpace = () => document.querySelector<HTMLElement>('[data-component="MariDockSpace"]');

/**
 * Her rectangle goes on the omnibar overlay, not on her panel: the panel and the frame of resize handles beside it
 * (outside the panel, which clips its rounded corners) both read it from there.
 */
const hostOf = (panelRef: RefObject<HTMLElement | null>) => panelRef.current?.parentElement ?? null;

function writeRect(panel: HTMLElement | null, rect: MariFloatRect) {
  if (!panel) return;
  panel.style.setProperty("--mari-float-left", `${rect.left}px`);
  panel.style.setProperty("--mari-float-top", `${rect.top}px`);
  panel.style.setProperty("--mari-float-width", `${rect.width}px`);
  panel.style.setProperty("--mari-float-height", `${rect.height}px`);
}

/** How long the outline takes to fade (matches the CSS transition); it stays put meanwhile. */
const PREVIEW_FADE_MS = 120;

/**
 * The zone outline grows out of her window into the zone, like Windows Snap (CSS transitions it while shown).
 * Leaving the zone, it fades where it is instead of shrinking back across the screen; once faded it rides along
 * with her, hidden, so the next zone grows out of her window again.
 */
function writePreview(preview: HTMLElement | null, rect: MariFloatRect, shown: boolean) {
  if (!preview) return;
  if (!shown) {
    if (preview.dataset.shown === "true") {
      preview.dataset.shown = "false";
      preview.dataset.hiddenAt = String(performance.now());
      return;
    }
    if (performance.now() - Number(preview.dataset.hiddenAt ?? 0) < PREVIEW_FADE_MS) return;
  }
  writeRect(preview, rect);
  preview.dataset.shown = shown ? "true" : "false";
}

/** How far her companion panel has to be pulled before it tears off into a floating window: a deliberate pull. */
const TEAR_OFF_PX = 72;
/** How much of that pull the panel shows before it tears, as resistance. */
const TEAR_OFF_GIVE = 0.3;

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
export function useMariFloat(
  mariSurface: boolean,
  companion: boolean,
  companionAvailable: boolean,
  panelRef: RefObject<HTMLElement | null>,
) {
  const desktop = useMatchMedia("(min-width: 1024px)");
  const floating = useUIStore((s) => s.mariFloating);
  const rect = useUIStore((s) => s.mariFloatRect);
  const zone = useUIStore((s) => s.mariFloatZone);
  const dockWidth = useUIStore((s) => s.mariFloatDockWidth);
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

  const drawn = drawnMariFloatRect(rect, zone, view, remPx(), dockWidth);
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;
  const { left, top, width, height } = drawn;
  useLayoutEffect(() => {
    const host = hostOf(panelRef);
    if (!active) return clearRect(host);
    writeRect(host, { left, top, width, height });
  }, [active, left, top, width, height, panelRef]);

  // Docked at a side, the app makes room for her like a third sidebar (AppShell reads this). Cleared whenever her
  // pane stops showing (search, close, companion, a narrow window), so the app never stays pushed with nothing there.
  const dockSide = active && (zone === "left" || zone === "right") ? zone : null;
  useLayoutEffect(() => {
    if (!dockSide) return;
    useUIStore.getState().setMariFloatDock({ side: dockSide, width });
    return () => useUIStore.getState().setMariFloatDock(null);
  }, [dockSide, width]);

  // One gesture at a time: a second press (another finger, a pen) while one runs is ignored.
  const gestureRef = useRef(false);
  // A gesture can outlive floating (Ctrl+K to Search mid-drag): its end must not reserve the dock again.
  const activeRef = useRef(active);
  activeRef.current = active;

  /**
   * Runs one pointer gesture on `handle`; `onMove` returns the rectangle to draw, `onEnd` commits it. A gesture
   * that ends without a release that moved her (cancelled, capture lost, a click) calls `onCancel` instead.
   */
  const track = (
    event: PointerEvent<HTMLElement>,
    onMove: (move: globalThis.PointerEvent) => MariFloatRect | null,
    onEnd: (last: MariFloatRect) => void,
    onCancel?: () => void,
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
      writeRect(hostOf(panelRef), rect);
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
      else onCancel?.();
      // Draw what the store now says. A drop into the zone she was already in changes nothing the layout
      // effect watches, so without this she would stay where the drag left her. She glides there.
      const ui = useUIStore.getState();
      const settled = drawnMariFloatRect(
        ui.mariFloatRect,
        ui.mariFloatZone,
        readView(),
        remPx(),
        ui.mariFloatDockWidth,
      );
      const host = hostOf(panelRef);
      if (host) {
        host.dataset.floatSettling = "true";
        window.setTimeout(() => delete host.dataset.floatSettling, SETTLE_MS + 50);
      }
      writeRect(host, settled);
      // The outline melts into where she landed.
      writePreview(previewRef.current, settled, false);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    // Capture can be lost without a pointerup (the window loses focus mid-drag): end the gesture there too.
    handle.addEventListener("lostpointercapture", end);
  };

  /** Beside an editor (desktop), her header pulls her out of the companion panel into a floating window. */
  const companionPanel = companion && desktop;

  const onHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !(active || companionPanel) ||
      gestureRef.current ||
      event.button !== 0 ||
      (event.target as Element).closest(HEADER_CONTROLS)
    )
      return;
    // No text selection or focus change while she is moved.
    event.preventDefault();
    const view = readView();
    const ui = useUIStore.getState();
    const startX = event.clientX;
    const startY = event.clientY;
    const panel = panelRef.current;
    // The companion panel: drawn where it is; it has to tear off before she moves.
    const tearing = !active && panel !== null;
    let torn = !tearing;
    const companionRect = panel?.getBoundingClientRect();
    const start: MariFloatRect =
      tearing && companionRect
        ? {
            left: companionRect.left,
            top: companionRect.top,
            width: companionRect.width,
            height: companionRect.height,
          }
        : drawnRef.current;
    // A snapped (or companion) window leaves its place at its free size, still under the pointer.
    const origin =
      ui.mariFloatZone || tearing
        ? clampMariFloatRect(
            unsnapMariFloatRect(ui.mariFloatRect ?? startMariFloatRect(view, remPx()), start, {
              x: startX,
              y: startY,
            }),
            view,
          )
        : start;
    // Leaving a side dock gives the app its room back at once, not on release.
    const fromDock = active && (ui.mariFloatZone === "left" || ui.mariFloatZone === "right");
    const releaseGive = () => panel?.style.removeProperty("translate");
    if (tearing) {
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        event.currentTarget.addEventListener(type, releaseGive, { once: true });
    }
    let target: MariFloatZone | null = null;
    let moved = false;
    // The top zone arms once the pointer has been below its band (mariFloatZoneAt).
    let topArmed = startY > MARI_FLOAT_EDGE_PX;
    track(
      event,
      (move) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (!torn) {
          // Resistance first: the panel gives a little; past the pull she tears off and floats under the pointer.
          if (Math.hypot(dx, dy) < TEAR_OFF_PX) {
            panel?.style.setProperty("translate", `${dx * TEAR_OFF_GIVE}px ${dy * TEAR_OFF_GIVE}px`);
            return null;
          }
          torn = true;
          releaseGive();
          const store = useUIStore.getState();
          store.setMariFloatPlace(origin, null);
          store.setMariFloating(true);
          store.setMariCompanionDocked(false);
        }
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return null;
        if (!moved && fromDock) useUIStore.getState().setMariFloatDock(null);
        moved = true;
        if (move.clientY > MARI_FLOAT_EDGE_PX) topArmed = true;
        target = mariFloatZoneAt(move.clientX, move.clientY, view, topArmed);
        const next = clampMariFloatRect({ ...origin, left: origin.left + dx, top: origin.top + dy }, view);
        // Outside a zone the hidden outline rides along with her, so the next zone grows out of her window.
        const dock = mariFloatDockWidth(ui.mariFloatDockWidth, view, remPx());
        // Beside an editor the left edge is the companion's place: preview the companion panel, below the editor's
        // header, not a full-height dock.
        const zoneRect =
          target === "left" && companionAvailable
            ? (mariCompanionDockRect() ?? mariFloatZoneRect(target, view, dock))
            : target
              ? mariFloatZoneRect(target, view, dock)
              : next;
        writePreview(previewRef.current, zoneRect, target !== null);
        return next;
      },
      (last) => {
        // Beside an editor the left edge is the companion's place: she docks there as the companion instead.
        if (target === "left" && companionAvailable) {
          ui.setMariCompanionDocked(true);
          return;
        }
        // Dropped in a zone, she keeps the free place she was dragged from for when she leaves it again.
        const free = tearing ? origin : ui.mariFloatZone ? (ui.mariFloatRect ?? origin) : start;
        if (target) ui.setMariFloatPlace(free, target);
        else ui.setMariFloatPlace(last, null);
        // Back into a side dock (the same one too, which changes nothing the publishing effect watches): the app
        // makes room again.
        if ((target === "left" || target === "right") && activeRef.current) {
          ui.setMariFloatDock({ side: target, width: mariFloatDockWidth(ui.mariFloatDockWidth, view, remPx()) });
        }
      },
      () => {
        // A cancelled drag out of a dock leaves her docked: the app gets its room back.
        const now = useUIStore.getState();
        if (moved && fromDock && activeRef.current && (now.mariFloatZone === "left" || now.mariFloatZone === "right")) {
          now.setMariFloatDock({
            side: now.mariFloatZone,
            width: mariFloatDockWidth(now.mariFloatDockWidth, view, remPx()),
          });
        }
      },
    );
  };

  const onResizePointerDown = (edge: MariFloatEdge) => (event: PointerEvent<HTMLElement>) => {
    if (!active || gestureRef.current || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const view = readView();
    const start = drawnRef.current;
    const startX = event.clientX;
    const startY = event.clientY;
    const side = useUIStore.getState().mariFloatZone;
    // Docked, only her inner edge resizes her, and the app's room for her follows it without its slide.
    if (side === "left" || side === "right") {
      const space = dockSpace();
      if (space) space.style.transition = "none";
      track(
        event,
        (move) => {
          const width = resizeMariFloatDock(start.width, side, move.clientX - startX, view);
          if (space) space.style.width = `${width}px`;
          return mariFloatZoneRect(side, view, width);
        },
        (last) => {
          // The width stays as drawn: the next render writes the same value. Only the slide comes back.
          useUIStore.getState().setMariFloatDockWidth(last.width);
          window.setTimeout(() => space?.style.removeProperty("transition"), SETTLE_MS);
        },
        () => {
          // Cancelled: the room goes back to the saved width (React would not rewrite an unchanged value).
          if (!space) return;
          space.style.width = `${mariFloatDockWidth(useUIStore.getState().mariFloatDockWidth, view, remPx())}px`;
          space.style.removeProperty("transition");
        },
      );
      return;
    }
    // Resizing a snapped window unsnaps it at the zone's rectangle.
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
    /** Where she floats (or would), in viewport pixels. */
    drawn,
    zone,
    dragging,
    previewRef,
    onHeaderPointerDown,
    onResizePointerDown,
    toggle,
  };
}

/**
 * The eight edge and corner handles of her floating window, the chat windows' ones (FloatingWindow), in a frame
 * laid over her panel so they can sit on its border. Near an edge an accent line shows; near a corner, the shared
 * corner grip. Mouse and pen only; Dock back is the keyboard's way out.
 */
export function MariFloatResizeHandles({
  onResizePointerDown,
}: {
  onResizePointerDown: (edge: MariFloatEdge) => (event: PointerEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div aria-hidden="true" className="mari-float-frame">
      {EDGES.map((edge) => (
        <div
          key={edge}
          title={t("omnibar.float.resize", "Drag to resize Prof. Mari")}
          data-edge={edge}
          className="mari-window__resize-handle"
          onPointerDown={onResizePointerDown(edge)}
        >
          {isWindowResizeCorner(edge) ? <WindowResizeGrip corner={edge} /> : null}
        </div>
      ))}
    </div>
  );
}
