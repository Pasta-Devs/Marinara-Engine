// ──────────────────────────────────────────────
// Floating windows: geometry math and the stored layout format
//
// Pure helpers shared by the floating-window store and component. Geometry is
// kept in viewport pixels exactly as the user left it; callers clamp it to the
// current viewport when they render, so a window returns to its place when the
// viewport grows again.
// ──────────────────────────────────────────────
import { DRAWER_WINDOW_PREFIX } from "@marinara-engine/shared";
import { BUBBLE_SNAP_GAP_PX, type BubbleRect } from "./window-bubble-snap";
export { getDrawerWindowId } from "@marinara-engine/shared";

export const FLOATING_WINDOW_LAYOUT_VERSION = 1 as const;
/** Gap kept between a window and the viewport edges. */
export const WINDOW_MARGIN_PX = 8;
export const WINDOW_KEYBOARD_STEP_PX = 10;
export const WINDOW_KEYBOARD_LARGE_STEP_PX = 50;

/** "chat-settings", "trackers", or a popped-out drawer: "drawer:<host window id>:<drawer id>". */
export type FloatingWindowId = string;

/** True for the popped-out drawers of one host window. */
export function isHostDrawerWindowId(id: FloatingWindowId, hostId: FloatingWindowId): boolean {
  return id.startsWith(`${DRAWER_WINDOW_PREFIX}${hostId}:`);
}

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowLayout extends WindowGeometry {
  pinned: boolean;
  locked: boolean;
  /** Closed or shown as a small button instead of the window; prevents pinned windows reopening. Older layouts have none. */
  minimized?: boolean;
  /** A toolbar control rendered as a section in Chat Settings instead of its own window/button. */
  docked?: boolean;
  /** Where a minimizable window's bubble sits (its top-left corner, viewport pixels). */
  bubble?: WindowPoint;
}

export interface WindowPoint {
  x: number;
  y: number;
  /** A device-chosen starting slot; moving the button replaces it with an explicit point. */
  automatic?: true;
}

/** A window bubble is a square this size (px), like the chat's toolbar buttons. */
export const WINDOW_BUBBLE_SIZE_PX = 32;
/** Phones draw bubbles a little larger, like their toolbar buttons (the tap area is 44px either way). */
export const PHONE_BUBBLE_SIZE_PX = 36;
/** Room between phone bubbles in their default row, the gap snapping leaves (their 44px tap areas meet). */
export const PHONE_BUBBLE_GAP_PX = 8;

/** Keeps a bubble inside `bounds`, so it can never be lost off-screen. */
export function clampWindowBubble(
  point: WindowPoint,
  bounds: WindowBounds,
  size: number = WINDOW_BUBBLE_SIZE_PX,
): WindowPoint {
  return {
    x: clamp(finiteOr(point.x, bounds.left), bounds.left, bounds.right - size),
    y: clamp(finiteOr(point.y, bounds.top), bounds.top, bounds.bottom - size),
  };
}

/** Temporary visible positions: a closing sidebar restores the saved points, even for locked buttons. */
export function placeWindowBubbles(
  bubbles: ReadonlyMap<string, { point: WindowPoint; bounds: WindowBounds; size: number }>,
): Map<string, WindowPoint> {
  const placed = new Map<string, WindowPoint>();
  const occupied: BubbleRect[] = [];
  const entries = [...bubbles].map(([id, bubble]) => {
    const point = clampWindowBubble(bubble.point, bubble.bounds, bubble.size);
    return {
      id,
      ...bubble,
      clamped: point,
      movable: bubble.point.automatic || point.x !== bubble.point.x || point.y !== bubble.point.y,
    };
  });
  // Keep buttons that still fit exactly where they were. Squeezed buttons find nearby free space.
  entries.sort((a, b) => Number(a.movable) - Number(b.movable) || a.id.localeCompare(b.id));
  for (const { id, clamped, bounds, size, movable } of entries) {
    let next = clamped;
    const free = (candidate: WindowPoint) =>
      occupied.every(
        (other) =>
          candidate.x + size <= other.x ||
          candidate.x >= other.x + other.width ||
          candidate.y + size <= other.y ||
          candidate.y >= other.y + other.height,
      );
    if (movable && !free(next)) {
      // Keep the snapping gap when possible; a tight space should not hide a button just to keep the gap.
      for (const gap of [BUBBLE_SNAP_GAP_PX, 0]) {
        const xs = new Set([clamped.x, bounds.left, bounds.right - size]);
        const ys = new Set([clamped.y, bounds.top, bounds.bottom - size]);
        for (const other of occupied) {
          xs.add(other.x - size - gap);
          xs.add(other.x + other.width + gap);
          ys.add(other.y - size - gap);
          ys.add(other.y + other.height + gap);
        }
        const candidates = [...xs].flatMap((x) => [...ys].map((y) => ({ x, y })));
        const distance = (candidate: WindowPoint) => (candidate.x - clamped.x) ** 2 + (candidate.y - clamped.y) ** 2;
        candidates.sort((a, b) => distance(a) - distance(b));
        const available = candidates.find(
          (candidate) =>
            candidate.x >= bounds.left &&
            candidate.x + size <= bounds.right &&
            candidate.y >= bounds.top &&
            candidate.y + size <= bounds.bottom &&
            free(candidate),
        );
        if (available) {
          next = available;
          break;
        }
      }
    }
    placed.set(id, next);
    occupied.push({ ...next, width: size, height: size });
  }
  return placed;
}

/** The Chat Settings button's default place: the top-right slot of the chat area. */
export function getTopRightBubblePoint(bounds: WindowBounds, size: number): WindowPoint {
  return { x: bounds.right - size, y: bounds.top };
}

/**
 * Controls fill the right half of the chat and wrap below, leaving room for Game's map on the left.
 * The first top-right slot belongs to Chat Settings; control `slot` 0 starts just to its left.
 */
export function getBubbleRowSlot(
  bounds: WindowBounds,
  slot: number,
  { right = bounds.right, size, gap }: { right?: number; size: number; gap: number },
): WindowPoint {
  const step = size + gap;
  const leftLimit = Math.round((bounds.left + bounds.right - size) / 2) + size + PHONE_BUBBLE_GAP_PX;
  const perRow = Math.max(1, Math.floor((right - leftLimit + gap) / step));
  const position = slot + 1;
  return {
    x: right - size - (position % perRow) * step,
    y: bounds.top + Math.floor(position / perRow) * step,
  };
}

/** A phone bubble's default place: a row along the top of the chat, where its toolbar and menu buttons were. */
export function getPhoneBubbleSlot(bounds: WindowBounds, slot: number, size = PHONE_BUBBLE_SIZE_PX): WindowPoint {
  return getBubbleRowSlot(bounds, slot, { size, gap: PHONE_BUBBLE_GAP_PX });
}

/** Saved with each chat (`chat.metadata.windowLayout`) and in chat settings profiles. */
export interface WindowLayoutSnapshot {
  version: typeof FLOATING_WINDOW_LAYOUT_VERSION;
  windows: Record<FloatingWindowId, WindowLayout>;
  /** Drawers popped out into their own windows (their window ids). Older snapshots have none. */
  detached?: FloatingWindowId[];
  /** Where each bubble sits on a phone, apart from the computer's places. Older snapshots have none. */
  phoneBubbles?: Record<FloatingWindowId, WindowPoint>;
  /** Buttons with no window layout of their own (the Chat Settings button) on a computer. Older snapshots have none. */
  bubbles?: Record<FloatingWindowId, WindowPoint>;
}

/** The area a window may occupy, with the margin already applied. */
export interface WindowBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface WindowSizeLimits {
  minWidth: number;
  minHeight: number;
}

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const RESIZE_EDGES: readonly ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const MAX_STORED_COORDINATE = 100_000;
const MAX_WINDOW_ID_LENGTH = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Keeps a window inside `bounds`. When the bounds are smaller than the minimum
 * size, the minimum wins and the window sits at the top-left corner, so its
 * title bar and controls stay reachable.
 */
export function clampWindowGeometry(
  geometry: WindowGeometry,
  bounds: WindowBounds,
  limits: WindowSizeLimits,
): WindowGeometry {
  const availableWidth = Math.max(0, bounds.right - bounds.left);
  const availableHeight = Math.max(0, bounds.bottom - bounds.top);
  const width = Math.max(limits.minWidth, Math.min(finiteOr(geometry.width, limits.minWidth), availableWidth));
  const height = Math.max(limits.minHeight, Math.min(finiteOr(geometry.height, limits.minHeight), availableHeight));
  return {
    x: clamp(finiteOr(geometry.x, bounds.left), bounds.left, bounds.right - width),
    y: clamp(finiteOr(geometry.y, bounds.top), bounds.top, bounds.bottom - height),
    width,
    height,
  };
}

export function moveWindowGeometry(
  start: WindowGeometry,
  dx: number,
  dy: number,
  bounds: WindowBounds,
  limits: WindowSizeLimits,
): WindowGeometry {
  return clampWindowGeometry({ ...start, x: start.x + dx, y: start.y + dy }, bounds, limits);
}

/** Moves the dragged edge(s) only; the opposite edges stay where they are. */
export function resizeWindowGeometry(
  start: WindowGeometry,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  bounds: WindowBounds,
  limits: WindowSizeLimits,
): WindowGeometry {
  const from = clampWindowGeometry(start, bounds, limits);
  const right = from.x + from.width;
  const bottom = from.y + from.height;
  let { x, y, width, height } = from;
  if (edge.includes("e")) width = clamp(from.width + dx, limits.minWidth, bounds.right - from.x);
  if (edge.includes("w")) {
    x = clamp(from.x + dx, bounds.left, right - limits.minWidth);
    width = right - x;
  }
  if (edge.includes("s")) height = clamp(from.height + dy, limits.minHeight, bounds.bottom - from.y);
  if (edge.includes("n")) {
    y = clamp(from.y + dy, bounds.top, bottom - limits.minHeight);
    height = bottom - y;
  }
  return clampWindowGeometry({ x, y, width, height }, bounds, limits);
}

function readStoredLayout(value: unknown): WindowLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const numbers = [source.x, source.y, source.width, source.height];
  if (!numbers.every((entry) => typeof entry === "number" && Number.isFinite(entry))) return null;
  const [x, y, width, height] = numbers as number[];
  if (width! <= 0 || height! <= 0) return null;
  if (numbers.some((entry) => Math.abs(entry as number) > MAX_STORED_COORDINATE)) return null;
  if (typeof source.pinned !== "boolean" || typeof source.locked !== "boolean") return null;
  const layout: WindowLayout = {
    x: x!,
    y: y!,
    width: width!,
    height: height!,
    pinned: source.pinned,
    locked: source.locked,
  };
  // Optional (added after version 1 shipped): a bad value is dropped, the rest of the layout kept.
  if (typeof source.minimized === "boolean") layout.minimized = source.minimized;
  if (typeof source.docked === "boolean") layout.docked = source.docked;
  const bubble = readStoredPoint(source.bubble);
  if (bubble) layout.bubble = bubble;
  return layout;
}

function readStoredPoint(value: unknown): WindowPoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { x, y, automatic } = value as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(x) > MAX_STORED_COORDINATE || Math.abs(y) > MAX_STORED_COORDINATE) return null;
  return { x, y, ...(automatic === true ? { automatic: true as const } : {}) };
}

/**
 * Reads a stored layout snapshot. It never throws: a missing, corrupt or
 * older-version value gives an empty snapshot, and invalid entries are dropped.
 */
export function parseWindowLayoutSnapshot(raw: unknown): WindowLayoutSnapshot {
  const empty: WindowLayoutSnapshot = { version: FLOATING_WINDOW_LAYOUT_VERSION, windows: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const source = raw as {
    version?: unknown;
    windows?: unknown;
    detached?: unknown;
    phoneBubbles?: unknown;
    bubbles?: unknown;
  };
  if (source.version !== FLOATING_WINDOW_LAYOUT_VERSION) return empty;
  if (!source.windows || typeof source.windows !== "object" || Array.isArray(source.windows)) return empty;
  const windows: Record<FloatingWindowId, WindowLayout> = {};
  for (const [id, value] of Object.entries(source.windows as Record<string, unknown>)) {
    if (!isStoredWindowId(id)) continue;
    const layout = readStoredLayout(value);
    if (layout) windows[id] = layout;
  }
  // A migrated drawer may not have been opened yet; its bubble chooses a place on first render.
  const detached = Array.isArray(source.detached)
    ? (source.detached as unknown[]).filter(
        (id, index, list): id is FloatingWindowId =>
          isStoredWindowId(id) && id.startsWith(DRAWER_WINDOW_PREFIX) && list.indexOf(id) === index,
      )
    : [];
  return toWindowLayoutSnapshot(
    windows,
    detached,
    readStoredPoints(source.phoneBubbles),
    readStoredPoints(source.bubbles),
  );
}

function readStoredPoints(value: unknown): Record<FloatingWindowId, WindowPoint> {
  const points: Record<FloatingWindowId, WindowPoint> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return points;
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    const point = isStoredWindowId(id) ? readStoredPoint(entry) : null;
    if (point) points[id] = point;
  }
  return points;
}

function isStoredWindowId(id: unknown): id is FloatingWindowId {
  return typeof id === "string" && id.length > 0 && id.length <= MAX_WINDOW_ID_LENGTH;
}

export function toWindowLayoutSnapshot(
  windows: Record<FloatingWindowId, WindowLayout>,
  detached: FloatingWindowId[] = [],
  phoneBubbles: Record<FloatingWindowId, WindowPoint> = {},
  bubbles: Record<FloatingWindowId, WindowPoint> = {},
): WindowLayoutSnapshot {
  const snapshot: WindowLayoutSnapshot = { version: FLOATING_WINDOW_LAYOUT_VERSION, windows };
  if (detached.length > 0) snapshot.detached = detached;
  if (Object.keys(phoneBubbles).length > 0) snapshot.phoneBubbles = phoneBubbles;
  if (Object.keys(bubbles).length > 0) snapshot.bubbles = bubbles;
  return snapshot;
}

/** True when a snapshot holds nothing, so the chat can store no layout at all. */
export function isEmptyWindowLayoutSnapshot(snapshot: WindowLayoutSnapshot): boolean {
  return (
    Object.keys(snapshot.windows).length === 0 &&
    !snapshot.detached?.length &&
    Object.keys(snapshot.phoneBubbles ?? {}).length === 0 &&
    Object.keys(snapshot.bubbles ?? {}).length === 0
  );
}

/** One string per layout, so two snapshots compare equal whatever order their fields were written in. */
export function serializeWindowLayoutSnapshot(raw: unknown): string {
  return JSON.stringify(parseWindowLayoutSnapshot(raw));
}

const DETACHED_GAP_PX = 12;

/**
 * Where a drawer popped out with its button opens: beside its host window (left first, then right),
 * level with where the drawer was. With no room on either side it overlaps the host, a little offset.
 */
export function placeDetachedDrawer(
  source: WindowGeometry,
  host: WindowGeometry | null,
  size: { width: number; height: number },
  bounds: WindowBounds,
  limits: WindowSizeLimits,
  otherWindows: WindowGeometry[] = [],
): WindowGeometry {
  const { width, height } = size;
  let x = source.x + 24;
  if (host && host.x - DETACHED_GAP_PX - width >= bounds.left) x = host.x - DETACHED_GAP_PX - width;
  else if (host && host.x + host.width + DETACHED_GAP_PX + width <= bounds.right) {
    x = host.x + host.width + DETACHED_GAP_PX;
  }
  const initial = clampWindowGeometry({ x, y: source.y, width, height }, bounds, limits);
  const overlaps = (candidate: WindowGeometry) =>
    otherWindows.some(
      (other) =>
        candidate.x < other.x + other.width &&
        candidate.x + candidate.width > other.x &&
        candidate.y < other.y + other.height &&
        candidate.y + candidate.height > other.y,
    );
  if (!overlaps(initial)) return initial;
  // When room is tight, cascade title bars instead of opening windows directly on top of each other.
  const candidates = [initial];
  for (let step = 1; step <= otherWindows.length + 1; step++) {
    for (const direction of [1, -1]) {
      const candidate = clampWindowGeometry(
        { ...initial, x: initial.x + direction * step * 24, y: initial.y + direction * step * 24 },
        bounds,
        limits,
      );
      if (!overlaps(candidate)) return candidate;
      candidates.push(candidate);
    }
  }
  return (
    candidates.find((candidate) =>
      otherWindows.every((other) => Math.abs(candidate.x - other.x) >= 20 || Math.abs(candidate.y - other.y) >= 20),
    ) ?? initial
  );
}

const BUBBLE_WINDOW_GAP_PX = 8;

/**
 * Where a minimizable window opens from its bubble: below it and lined up with its right edge (left
 * edge near the left side). Shorten the window to fit below; use above only when its minimum height cannot fit.
 */
export function placeWindowBesideBubble(
  size: { width: number; height: number },
  bubble: WindowPoint,
  bounds: WindowBounds,
  limits: WindowSizeLimits,
  bubbleSize = WINDOW_BUBBLE_SIZE_PX,
): WindowGeometry {
  const { width } = size;
  const alignRight = bubble.x + bubbleSize - width;
  const x = alignRight >= bounds.left ? alignRight : bubble.x;
  const below = bubble.y + bubbleSize + BUBBLE_WINDOW_GAP_PX;
  const belowSpace = bounds.bottom - below;
  const fitsBelow = belowSpace >= Math.min(limits.minHeight, bounds.bottom - bounds.top);
  const height = fitsBelow ? Math.min(size.height, belowSpace) : size.height;
  const y = fitsBelow ? below : bubble.y - BUBBLE_WINDOW_GAP_PX - height;
  return clampWindowGeometry({ x, y, width, height }, bounds, limits);
}
