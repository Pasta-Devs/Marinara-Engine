import assert from "node:assert/strict";
import {
  clampMariFloatRect,
  drawnMariFloatRect,
  MARI_FLOAT_GAP_PX,
  MARI_FLOAT_MIN_HEIGHT_PX,
  MARI_FLOAT_MIN_WIDTH_PX,
  mariFloatZoneAt,
  mariFloatZoneRect,
  normalizeMariFloatRect,
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

// 2. The zones: halves with a gap between them, and the whole screen.
{
  const gap = MARI_FLOAT_GAP_PX;
  const left = mariFloatZoneRect("left", view);
  const right = mariFloatZoneRect("right", view);
  assert.equal(left.left, gap);
  assert.equal(right.left + right.width, 1440 - gap);
  assert.ok(right.left - (left.left + left.width) >= gap, "a gap between the halves");
  assert.deepEqual(mariFloatZoneRect("max", view), {
    left: gap,
    top: gap,
    width: 1440 - 2 * gap,
    height: 900 - 2 * gap,
  });
  // A zone wins over the free rectangle.
  assert.deepEqual(drawnMariFloatRect({ left: 5, top: 5, width: 400, height: 400 }, "right", view, rem), right);
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
  const snapped = mariFloatZoneRect("left", view);
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
