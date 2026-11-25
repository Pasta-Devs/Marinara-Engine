/**
 * Where Prof. Mari's floating window sits (#9818). Pure, so the regression can drive it without a DOM.
 *
 * A float has a free rectangle (dragged and resized by hand) and, optionally, a snap zone. While a zone is
 * set, the zone decides the drawn rectangle and the free one is kept for when she is dragged out of it.
 */

export type MariFloatZone = "left" | "right" | "max";

export interface MariFloatRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MariFloatView {
  width: number;
  height: number;
}

/** Room kept between her window and the screen edge, and between two halves. */
export const MARI_FLOAT_GAP_PX = 12;
/** How close to an edge the pointer has to be for that edge's zone. */
export const MARI_FLOAT_EDGE_PX = 16;
/** Smallest window: her header, tabs and composer still fit. */
export const MARI_FLOAT_MIN_WIDTH_PX = 352;
export const MARI_FLOAT_MIN_HEIGHT_PX = 320;
/** Today's centred window, which a first float starts from: 44rem wide, 48rem tall, 10vh from the top. */
const START_WIDTH_REM = 44;
const START_HEIGHT_REM = 48;

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

export function mariFloatZoneRect(zone: MariFloatZone, view: MariFloatView): MariFloatRect {
  const gap = MARI_FLOAT_GAP_PX;
  const height = view.height - 2 * gap;
  if (zone === "max") return { left: gap, top: gap, width: view.width - 2 * gap, height };
  const width = Math.floor((view.width - 3 * gap) / 2);
  return { left: zone === "left" ? gap : view.width - gap - width, top: gap, width, height };
}

/** The zone a drag would land in with the pointer here; the top edge wins in the corners. */
export function mariFloatZoneAt(x: number, y: number, view: MariFloatView): MariFloatZone | null {
  if (y <= MARI_FLOAT_EDGE_PX) return "max";
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
): MariFloatRect {
  if (zone) return mariFloatZoneRect(zone, view);
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
  if (edge.includes("e")) width = clamp(width + dx, MARI_FLOAT_MIN_WIDTH_PX, view.width - left);
  if (edge.includes("s")) height = clamp(height + dy, MARI_FLOAT_MIN_HEIGHT_PX, view.height - top);
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
