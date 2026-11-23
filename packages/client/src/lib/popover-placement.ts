// ──────────────────────────────────────────────
// Where a `Popover` sits next to its anchor
//
// Pure maths, kept apart from the component so a regression can check it without a browser. All values are
// viewport (CSS pixel) coordinates, the frame `position: fixed` and `getBoundingClientRect()` use.
// ──────────────────────────────────────────────

/** Gap kept between a popover and the window's edge. */
export const POPOVER_WINDOW_PADDING = 8;

export interface PopoverPlacementInput {
  /** The anchor's bounding rect. */
  anchor: { top: number; bottom: number; left: number; right: number; width: number };
  /** The panel's measured width and natural height (already capped by the caller's own max-height). */
  width: number;
  height: number;
  /** The visible part of the window: on a phone, pinch zoom and the keyboard shrink it. */
  view: { top: number; left: number; bottom: number; right: number };
  /** The whole page's width (the layout viewport), used when the panel is wider than the visible part. */
  pageWidth: number;
  side: "top" | "bottom";
  align: "start" | "center" | "end";
  gap: number;
}

export interface PopoverPlacement {
  top: number;
  left: number;
  /** The room left for the panel; it scrolls inside when its content is taller. */
  maxHeight: number;
}

export function placePopover({
  anchor: a,
  width,
  height,
  view,
  pageWidth,
  side,
  align,
  gap,
}: PopoverPlacementInput): PopoverPlacement {
  const pad = POPOVER_WINDOW_PADDING;
  const below = view.bottom - a.bottom - gap - pad;
  const above = a.top - view.top - gap - pad;
  const useTop = side === "top" ? height <= above || above > below : height > below && above > below;
  const top = Math.max(
    view.top + pad,
    Math.min(useTop ? a.top - gap - Math.min(height, Math.max(0, above)) : a.bottom + gap, view.bottom - pad),
  );
  // The room left below the clamped top, so an anchor scrolled out of view can't stretch the panel past the edge.
  const maxHeight = Math.max(0, Math.min(useTop ? above : below, view.bottom - pad - top));

  const preferredLeft =
    align === "end" ? a.right - width : align === "center" ? a.left + a.width / 2 - width / 2 : a.left;
  // A panel wider than the zoomed-in view is clamped to the whole page instead, so panning reaches its far edge
  // rather than dragging the panel along.
  const fitsView = width <= view.right - view.left - pad * 2;
  const minLeft = fitsView ? view.left : 0;
  const maxRight = fitsView ? view.right : pageWidth;
  const left = Math.max(minLeft + pad, Math.min(preferredLeft, maxRight - pad - width));

  return { top, left, maxHeight };
}
