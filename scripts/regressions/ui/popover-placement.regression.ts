// Where a Popover sits next to its anchor (soup step 7, #9623).
//
// `placePopover` is the maths behind `ui/Popover`. It must:
//   - flip above the anchor when there is no room below, and sit `gap` from it;
//   - keep a panel inside the visible window when its anchor has scrolled out of view, with the room below the
//     clamped top as its max height, so a tall panel stops at the bottom edge;
//   - clamp a panel to the visible part of a zoomed-in window, unless it is wider than that part, then to the page,
//     so panning reaches its far edge instead of dragging it along.
import assert from "node:assert/strict";
import { placePopover, POPOVER_WINDOW_PADDING as PAD } from "../../../packages/client/src/lib/popover-placement.js";

const view = { top: 0, left: 0, bottom: 800, right: 1000 };
const anchorAt = (top: number, left = 100, height = 20, width = 40) => ({
  top,
  bottom: top + height,
  left,
  right: left + width,
  width,
});
const base = { view, pageWidth: 1000, side: "bottom" as const, align: "start" as const, gap: 6 };

// ── 1. Room below: it opens below, `gap` under the anchor ──
{
  const p = placePopover({ ...base, anchor: anchorAt(100), width: 200, height: 150 });
  assert.equal(p.top, 126, "Opens gap below the anchor");
  assert.equal(p.left, 100, "Starts at the anchor's left edge");
  assert.equal(p.maxHeight, 800 - 120 - 6 - PAD, "Max height is the room below");
}

// ── 2. No room below: it flips above, its bottom edge gap above the anchor ──
{
  const p = placePopover({ ...base, anchor: anchorAt(700), width: 200, height: 150 });
  assert.equal(p.top + 150, 700 - 6, "Flipped panel ends gap above the anchor");
}

// ── 3. An anchor scrolled out of view above: a tall panel stays inside the window ──
{
  const p = placePopover({ ...base, anchor: anchorAt(-60), width: 200, height: 810 });
  assert.equal(p.top, PAD, "Top clamped to the window's padding");
  assert.ok(p.top + p.maxHeight <= view.bottom - PAD, "A tall panel's bottom stops at the window's edge");
}

// ── 4. Zoomed in: a panel that fits the visible part stays inside it ──
{
  const zoomed = { top: 0, left: 300, bottom: 400, right: 600 };
  const p = placePopover({ ...base, view: zoomed, anchor: anchorAt(100, 550), width: 200, height: 100 });
  assert.equal(p.left, 600 - PAD - 200, "Clamped to the visible part's right edge");
}

// ── 5. Zoomed in: a panel wider than the visible part is clamped to the page, so it holds still while panning ──
{
  const placeAt = (left: number) =>
    placePopover({
      ...base,
      view: { top: 0, left, bottom: 400, right: left + 200 },
      anchor: anchorAt(100, 350),
      width: 280,
      height: 100,
    }).left;
  assert.equal(placeAt(300), 350, "Sits at its anchor");
  assert.equal(placeAt(400), 350, "Panning doesn't drag it along, so its far edge comes into view");
}

console.log("popover-placement: ok");
