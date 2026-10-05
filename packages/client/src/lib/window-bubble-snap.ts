// ──────────────────────────────────────────────
// Window bubbles: snap a dragged bubble into line with the others
//
// Pure helper shared by minimized windows (and, later, the phone bubbles). On each
// axis a bubble placed beside another lands a consistent gap away; otherwise the
// nearest edge or centre lining up with another bubble's wins.
// ──────────────────────────────────────────────

export interface BubbleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A thin line drawn while a snap is active: vertical at `at` for "x", horizontal for "y". */
export interface SnapGuide {
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

export interface BubbleSnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/** How close (px) an edge or centre must come to snap. */
export const BUBBLE_SNAP_THRESHOLD_PX = 8;
/** The gap left between two bubbles placed side by side. */
export const BUBBLE_SNAP_GAP_PX = 8;

type Axis = "x" | "y";
type Candidate = { delta: number; guide: SnapGuide; gap: boolean };

function span(rect: BubbleRect, axis: Axis) {
  const start = axis === "x" ? rect.x : rect.y;
  const size = axis === "x" ? rect.width : rect.height;
  return { start, centre: start + size / 2, end: start + size };
}

/** Candidates for one axis; `cross` is the other axis, where "beside" is decided. */
function axisCandidates(moving: BubbleRect, other: BubbleRect, axis: Axis, threshold: number, gap: number) {
  const cross: Axis = axis === "x" ? "y" : "x";
  const m = span(moving, axis);
  const o = span(other, axis);
  const mc = span(moving, cross);
  const oc = span(other, cross);
  const guideFrom = Math.min(mc.start, oc.start);
  const guideTo = Math.max(mc.end, oc.end);
  // Overlapping on the other axis (within the threshold) means the bubbles sit in one row or column.
  const beside = mc.start < oc.end + threshold && oc.start < mc.end + threshold;
  const candidates: Candidate[] = [];
  const edges = ["start", "centre", "end"] as const;
  for (const movingEdge of edges) {
    for (const otherEdge of edges) {
      // Side by side, edge-to-edge would make them touch; the gap rule below places them instead.
      if (beside && movingEdge !== otherEdge) continue;
      const delta = o[otherEdge] - m[movingEdge];
      if (Math.abs(delta) <= threshold) {
        candidates.push({ delta, gap: false, guide: { axis, at: o[otherEdge], from: guideFrom, to: guideTo } });
      }
    }
  }
  if (beside) {
    // After the other bubble (to its right, or below it).
    const after = m.start - o.end;
    if (after >= -threshold && after <= gap + threshold) {
      candidates.push({
        delta: o.end + gap - m.start,
        gap: true,
        guide: { axis, at: o.end + gap / 2, from: guideFrom, to: guideTo },
      });
    }
    // Before it (to its left, or above it).
    const before = o.start - m.end;
    if (before >= -threshold && before <= gap + threshold) {
      candidates.push({
        delta: o.start - gap - m.end,
        gap: true,
        guide: { axis, at: o.start - gap / 2, from: guideFrom, to: guideTo },
      });
    }
  }
  return candidates;
}

/** Placing a bubble beside another is the stronger intent, so a gap match beats any edge or centre match. */
function nearest(all: Candidate[]): Candidate | null {
  const gaps = all.filter((candidate) => candidate.gap);
  const candidates = gaps.length > 0 ? gaps : all;
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (!best || Math.abs(candidate.delta) < Math.abs(best.delta)) best = candidate;
  }
  return best;
}

/**
 * Where a dragged bubble lands once snapped to the `others`, and the guides to draw. Each axis snaps on
 * its own; with nothing within `threshold`, the bubble stays where it was dropped.
 */
export function snapBubble(
  moving: BubbleRect,
  others: readonly BubbleRect[],
  { threshold = BUBBLE_SNAP_THRESHOLD_PX, gap = BUBBLE_SNAP_GAP_PX }: { threshold?: number; gap?: number } = {},
): BubbleSnapResult {
  const snapX = nearest(others.flatMap((other) => axisCandidates(moving, other, "x", threshold, gap)));
  const snapY = nearest(others.flatMap((other) => axisCandidates(moving, other, "y", threshold, gap)));
  return {
    x: moving.x + (snapX?.delta ?? 0),
    y: moving.y + (snapY?.delta ?? 0),
    guides: [snapX?.guide, snapY?.guide].filter((guide): guide is SnapGuide => !!guide),
  };
}
