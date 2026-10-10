import assert from "node:assert/strict";
import {
  pullCircleTarget,
  pullOnScreenX,
  pullOpenThreshold,
  pullSheetBase,
  pullSheetPath,
} from "../../packages/client/src/lib/pull-to-open.js";

// The pull sheet's outline must never cross itself: on a wide desktop bar the pinch once pulled the
// waist's handles past the middle and the two sides crossed into an X before the sheet let go.
type Point = [number, number];

/** The outline as a polygon: bar edge, both sides as cubics, the circle's lower arc between them. */
function outline(d: string, cx: number, cy: number, rx: number, ry: number) {
  const tokens = d.match(/[MLCAZ]|-?\d*\.?\d+/g)!;
  const points: Point[] = [];
  const sides: Point[][] = [];
  let i = 0;
  let command = "";
  let current: Point = [0, 0];
  const next = (): Point => [Number(tokens[i++]), Number(tokens[i++])];
  while (i < tokens.length) {
    if (/[MLCAZ]/.test(tokens[i])) command = tokens[i++];
    if (command === "Z") break;
    if (command === "M" || command === "L") {
      current = next();
      points.push(current);
    } else if (command === "C") {
      const [a, b, c, e] = [current, next(), next(), next()];
      const side: Point[] = [];
      for (let s = 1; s <= 16; s++) {
        const t = s / 16;
        const u = 1 - t;
        const at = (k: 0 | 1) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * e[k];
        side.push([at(0), at(1)]);
      }
      points.push(...side);
      sides.push(side);
      current = e;
    } else if (command === "A") {
      i += 5;
      const e = next();
      const from = Math.atan2((current[1] - cy) / ry, (current[0] - cx) / rx);
      const to = Math.atan2((e[1] - cy) / ry, (e[0] - cx) / rx);
      for (let s = 1; s <= 16; s++) {
        const angle = from + ((to - from) * s) / 16;
        points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
      }
      current = e;
    }
  }
  // Right side = the two cubics before the arc, left side = the two after it.
  return { points, right: [...sides[0], ...sides[1]], left: [...sides[2], ...sides[3]] };
}

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function selfCrossing(points: Point[]) {
  const n = points.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [a, b, c, e] = [points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]];
      if (cross(a, b, c) * cross(a, b, e) < -1e-6 && cross(c, e, a) * cross(c, e, b) < -1e-6) return [i, j];
    }
  return null;
}

let checked = 0;
for (let width = 320; width <= 2560; width += 160) {
  const threshold = pullOpenThreshold(width < 800 ? 844 : 1080);
  for (let pull = 0; pull <= 1.3; pull += 0.05) {
    const circle = pullCircleTarget(pull * threshold, pull);
    for (const [sag, pop] of [
      [0, 0],
      [1, 0.6],
      [0, -0.6],
    ]) {
      const rx = circle.radius * (1 + 0.06 * pop);
      const ry = circle.radius * (1 - 0.05 * pop);
      const cy = circle.centerY;
      // The base spring trails the target, so test every width between the circle's and the target's.
      for (const baseShare of [0, 0.5, 1]) {
        const base = Math.max(rx + 4, pullSheetBase(circle.radius, pull * baseShare, width));
        for (const cx of [width / 2, pullOnScreenX(0, rx, width)]) {
          for (const pinch of [0, 0.25, 0.5, 0.75, 0.9, 0.97, 1]) {
            const { d } = pullSheetPath({ cx, cy, rx, ry, base, sag, pinch });
            const { points, right, left } = outline(d, cx, cy, rx, ry);
            const where = `width ${width}, pull ${pull.toFixed(2)}, base ${base.toFixed(0)}, cx ${cx}, pinch ${pinch}, sag ${sag}, pop ${pop}`;
            assert.equal(selfCrossing(points), null, `the sheet crosses itself (${where})`);
            // Each side stays on its own side of the circle's middle (0.1 px: the path is rounded).
            assert.ok(
              Math.min(...right.map(([x]) => x)) >= cx - 0.1,
              `the right side reaches past the middle (${where})`,
            );
            assert.ok(
              Math.max(...left.map(([x]) => x)) <= cx + 0.1,
              `the left side reaches past the middle (${where})`,
            );
            checked++;
          }
        }
      }
    }
  }
}
assert.ok(checked > 10_000);
