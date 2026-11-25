/**
 * Where Prof. Mari's floating window sits (#9818). Pure, so the regression can drive it without a DOM.
 *
 * A float has a free rectangle (dragged and resized by hand) and, optionally, a snap zone. While a zone is
 * set, the zone decides the drawn rectangle and the free one is kept for when she is dragged out of it.
 * The side zones dock her like a sidebar: full height, flush with the screen edge, and the app makes room for her
 * (AppShell). The top zone fills the screen below the app's top bar, which stays in view.
 */

export type MariFloatZone = "left" | "right" | "max";

/** Where she is docked right now, for the app shell to make room: published while her pane shows in a side zone. */
export interface MariFloatDock {
  side: "left" | "right";
  width: number;
}

export interface MariFloatRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MariFloatView {
  width: number;
  height: number;
  /** The bottom of the app's top bar: the top zone starts below it. */
  top?: number;
}

/** Room kept between her window and the screen edge, and between two halves. */
export const MARI_FLOAT_GAP_PX = 12;
/**
 * How close to an edge the pointer has to be for that edge's zone. Windows snaps when the cursor hits the screen
 * edge, where it stops; in a browser the pointer runs on past the page, so the band is wider (about 1cm at 96dpi,
 * a little over GTK's 20px Aero Snap edge region).
 */
export const MARI_FLOAT_EDGE_PX = 36;
/** Smallest window: her header, tabs and composer still fit. */
export const MARI_FLOAT_MIN_WIDTH_PX = 352;
export const MARI_FLOAT_MIN_HEIGHT_PX = 320;
/** Today's centred window, which a first float starts from: 44rem wide, 48rem tall, 10vh from the top. */
const START_WIDTH_REM = 44;
const START_HEIGHT_REM = 48;
/** A side dock's width until she is resized there: about the Chats sidebar's. */
export const MARI_FLOAT_DOCK_DEFAULT_REM = 28;
/** The top zone's distance below the top bar. */
const MAX_TOP_GAP_PX = 6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function isMariFloatZone(value: unknown): value is MariFloatZone {
  return value === "left" || value === "right" || value === "max";
}

export function normalizeMariFloatRect(value: unknown): MariFloatRect | null {
  if (!value || typeof value !== "object") return null;
  const { left, top, width, height } = value as Record<string, unknown>;
  const numbers = [left, top, width, height];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { left: left as number, top: top as number, width: width as number, height: height as number };
}

/** The first float opens where the centred window was. */
export function startMariFloatRect(view: MariFloatView, remPx: number): MariFloatRect {
  const width = Math.min(START_WIDTH_REM * remPx, view.width - 2 * MARI_FLOAT_GAP_PX);
  const height = Math.min(START_HEIGHT_REM * remPx, view.height * 0.87);
  return clampMariFloatRect(
    { left: (view.width - width) / 2, top: Math.round(view.height * 0.1), width, height },
    view,
  );
}

/** Keeps a free window on screen and at least the minimum size, shrinking it when the screen got smaller. */
export function clampMariFloatRect(rect: MariFloatRect, view: MariFloatView): MariFloatRect {
  const width = clamp(rect.width, Math.min(MARI_FLOAT_MIN_WIDTH_PX, view.width), view.width);
  const height = clamp(rect.height, Math.min(MARI_FLOAT_MIN_HEIGHT_PX, view.height), view.height);
  return {
    left: Math.round(clamp(rect.left, 0, view.width - width)),
    top: Math.round(clamp(rect.top, 0, view.height - height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** A side dock's width: the saved one (or the default), at least her minimum and at most half the screen. */
export function mariFloatDockWidth(saved: number | null, view: MariFloatView, remPx: number): number {
  const width = saved ?? MARI_FLOAT_DOCK_DEFAULT_REM * remPx;
  const max = Math.floor(view.width / 2);
  return Math.round(clamp(width, Math.min(MARI_FLOAT_MIN_WIDTH_PX, max), max));
}

/** A zone's rectangle; `dockWidth` is the side dock's width (mariFloatDockWidth). */
export function mariFloatZoneRect(zone: MariFloatZone, view: MariFloatView, dockWidth: number): MariFloatRect {
  const gap = MARI_FLOAT_GAP_PX;
  if (zone === "max") {
    const top = view.top ? Math.round(view.top + MAX_TOP_GAP_PX) : gap;
    return { left: gap, top, width: view.width - 2 * gap, height: Math.max(0, view.height - top - gap) };
  }
  return { left: zone === "left" ? 0 : view.width - dockWidth, top: 0, width: dockWidth, height: view.height };
}

/** Dragging a side dock's inner edge by dx: the left dock grows to the right, the right one to the left. */
export function resizeMariFloatDock(start: number, side: "left" | "right", dx: number, view: MariFloatView): number {
  return Math.round(
    clamp(side === "left" ? start + dx : start - dx, MARI_FLOAT_MIN_WIDTH_PX, Math.floor(view.width / 2)),
  );
}

/**
 * The zone a drag would land in with the pointer here; the top edge wins in the corners. `allowTop` is false until
 * the pointer has been below the top band during this drag: her header can start inside it (docked, or full screen),
 * and a sideways pull must not fill the screen.
 */
export function mariFloatZoneAt(x: number, y: number, view: MariFloatView, allowTop = true): MariFloatZone | null {
  if (allowTop && y <= MARI_FLOAT_EDGE_PX) return "max";
  if (x <= MARI_FLOAT_EDGE_PX) return "left";
  if (x >= view.width - 1 - MARI_FLOAT_EDGE_PX) return "right";
  return null;
}

/** The rectangle she is drawn at. */
export function drawnMariFloatRect(
  rect: MariFloatRect | null,
  zone: MariFloatZone | null,
  view: MariFloatView,
  remPx: number,
  dockWidth: number | null = null,
): MariFloatRect {
  if (zone) return mariFloatZoneRect(zone, view, mariFloatDockWidth(dockWidth, view, remPx));
  return rect ? clampMariFloatRect(rect, view) : startMariFloatRect(view, remPx);
}

/**
 * Dragging a snapped window out of its zone gives it back its free size, under the pointer at the same share of
 * its width it was grabbed at, like a snapped window in Windows.
 */
export function unsnapMariFloatRect(
  free: MariFloatRect,
  snapped: MariFloatRect,
  pointer: { x: number; y: number },
): MariFloatRect {
  const share = snapped.width > 0 ? (pointer.x - snapped.left) / snapped.width : 0.5;
  return {
    ...free,
    left: pointer.x - share * free.width,
    // The header stays under the pointer: same distance from the top as when it was grabbed.
    top: snapped.top,
  };
}

export type MariFloatEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** A resize from `edge` by (dx, dy), never smaller than the minimum and never past the screen. */
export function resizeMariFloatRect(
  start: MariFloatRect,
  edge: MariFloatEdge,
  dx: number,
  dy: number,
  view: MariFloatView,
): MariFloatRect {
  let { left, top, width, height } = start;
  const right = left + width;
  const bottom = top + height;
  if (edge.includes("e")) {
    width = clamp(width + dx, Math.min(MARI_FLOAT_MIN_WIDTH_PX, view.width - left), view.width - left);
  }
  if (edge.includes("s")) {
    height = clamp(height + dy, Math.min(MARI_FLOAT_MIN_HEIGHT_PX, view.height - top), view.height - top);
  }
  if (edge.includes("w")) {
    left = clamp(left + dx, 0, right - MARI_FLOAT_MIN_WIDTH_PX);
    width = right - left;
  }
  if (edge.includes("n")) {
    top = clamp(top + dy, 0, bottom - MARI_FLOAT_MIN_HEIGHT_PX);
    height = bottom - top;
  }
  return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) };
}
