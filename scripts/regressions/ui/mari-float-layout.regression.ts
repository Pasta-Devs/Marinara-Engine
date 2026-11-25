import assert from "node:assert/strict";
import {
  clampMariFloatRect,
  drawnMariFloatRect,
  MARI_FLOAT_DOCK_DEFAULT_REM,
  MARI_FLOAT_GAP_PX,
  MARI_FLOAT_MIN_HEIGHT_PX,
  MARI_FLOAT_MIN_WIDTH_PX,
  mariFloatDockWidth,
  mariFloatZoneAt,
  mariFloatZoneRect,
  normalizeMariFloatRect,
  resizeMariFloatDock,
  resizeMariFloatRect,
  startMariFloatRect,
  unsnapMariFloatRect,
} from "../../../packages/client/src/lib/mari-float-layout";

// #9818: where Prof. Mari's floating window sits, snaps and resizes.
const view = { width: 1440, height: 900 };
const rem = 16;

// 1. The first float opens where the centred window was: 44rem wide, 48rem capped to 87% tall, 10% down.
{
  const start = startMariFloatRect(view, rem);
  assert.equal(start.width, 704);
  assert.equal(start.height, 768);
  assert.equal(start.left, Math.round((1440 - 704) / 2));
  assert.equal(start.top, 90);
  // A short screen caps her at 87% of its height.
  assert.equal(startMariFloatRect({ width: 1440, height: 700 }, rem).height, Math.round(700 * 0.87));
  assert.deepEqual(drawnMariFloatRect(null, null, view, rem), start);
}

// 2. The zones: side docks flush with their edge at the dock width, the whole screen below the top bar.
{
  const gap = MARI_FLOAT_GAP_PX;
  const dock = mariFloatDockWidth(null, view, rem);
  assert.equal(dock, MARI_FLOAT_DOCK_DEFAULT_REM * rem);
  const left = mariFloatZoneRect("left", view, dock);
  const right = mariFloatZoneRect("right", view, dock);
  assert.deepEqual(left, { left: 0, top: 0, width: dock, height: 900 });
  assert.deepEqual(right, { left: 1440 - dock, top: 0, width: dock, height: 900 });
  assert.deepEqual(mariFloatZoneRect("max", view, dock), {
    left: gap,
    top: gap,
    width: 1440 - 2 * gap,
    height: 900 - 2 * gap,
  });
  // With a top bar, the whole-screen zone starts just below it, so the bar stays in view.
  const max = mariFloatZoneRect("max", { ...view, top: 48 }, dock);
  assert.equal(max.top, 54);
  assert.equal(max.top + max.height, 900 - gap);
  // A zone wins over the free rectangle; a saved dock width is used.
  assert.deepEqual(drawnMariFloatRect({ left: 5, top: 5, width: 400, height: 400 }, "right", view, rem), right);
  assert.equal(drawnMariFloatRect(null, "left", view, rem, 500).width, 500);
  // A dock never goes below her minimum or past half the screen.
  assert.equal(mariFloatDockWidth(100, view, rem), MARI_FLOAT_MIN_WIDTH_PX);
  assert.equal(mariFloatDockWidth(5000, view, rem), 720);
  // Its inner edge: the left dock grows rightwards, the right one leftwards.
  assert.equal(resizeMariFloatDock(448, "left", 40, view), 488);
  assert.equal(resizeMariFloatDock(448, "right", 40, view), 408);
  assert.equal(resizeMariFloatDock(448, "left", 9000, view), 720);
}

// 3. Which edge a drop lands on; the top edge wins in a corner, the middle is free.
{
  assert.equal(mariFloatZoneAt(0, 400, view), "left");
  assert.equal(mariFloatZoneAt(1439, 400, view), "right");
  assert.equal(mariFloatZoneAt(700, 0, view), "max");
  assert.equal(mariFloatZoneAt(0, 0, view), "max");
  assert.equal(mariFloatZoneAt(700, 400, view), null);
}

// 4. A free window stays on screen and shrinks with a smaller screen, never below the minimum.
{
  assert.deepEqual(clampMariFloatRect({ left: 1300, top: 800, width: 500, height: 400 }, view), {
    left: 940,
    top: 500,
    width: 500,
    height: 400,
  });
  const small = clampMariFloatRect({ left: 0, top: 0, width: 2000, height: 2000 }, { width: 1024, height: 700 });
  assert.equal(small.width, 1024);
  assert.equal(small.height, 700);
  const tiny = clampMariFloatRect({ left: 0, top: 0, width: 10, height: 10 }, view);
  assert.equal(tiny.width, MARI_FLOAT_MIN_WIDTH_PX);
  assert.equal(tiny.height, MARI_FLOAT_MIN_HEIGHT_PX);
}

// 5. Leaving a zone restores the free size under the pointer, at the share of the width it was grabbed at.
{
  const snapped = mariFloatZoneRect("left", view, 448);
  const free = { left: 300, top: 200, width: 600, height: 500 };
  const pointer = { x: snapped.left + snapped.width / 4, y: snapped.top + 20 };
  const out = unsnapMariFloatRect(free, snapped, pointer);
  assert.equal(out.width, 600);
  assert.equal(out.height, 500);
  assert.equal(out.left, pointer.x - 150);
  assert.equal(out.top, snapped.top);
}

// 6. Resizing from each side keeps the opposite edge fixed and stops at the minimum and the screen.
{
  const start = { left: 400, top: 200, width: 600, height: 500 };
  assert.deepEqual(resizeMariFloatRect(start, "se", 100, 50, view), { left: 400, top: 200, width: 700, height: 550 });
  const west = resizeMariFloatRect(start, "w", 1000, 0, view);
  assert.equal(west.width, MARI_FLOAT_MIN_WIDTH_PX);
  assert.equal(west.left + west.width, 1000, "the right edge stays put");
  const north = resizeMariFloatRect(start, "n", 0, -500, view);
  assert.equal(north.top, 0);
  assert.equal(north.top + north.height, 700, "the bottom edge stays put");
  assert.equal(resizeMariFloatRect(start, "e", 5000, 0, view).width, 1440 - 400);
}

// 7. Stored places: a broken one is dropped rather than trusted.
{
  assert.deepEqual(normalizeMariFloatRect({ left: 1, top: 2, width: 3, height: 4 }), {
    left: 1,
    top: 2,
    width: 3,
    height: 4,
  });
  assert.equal(normalizeMariFloatRect({ left: 1, top: 2, width: "3", height: 4 }), null);
  assert.equal(normalizeMariFloatRect(null), null);
}

console.log("mari-float-layout regression passed");
