import assert from "node:assert/strict";
import { withCssPaintAlpha } from "../../packages/client/src/lib/css-colors.ts";

// The paint helper asks the browser's parser whether a gradient stop is a color. These cases use
// plain colors and hex stops, so a permissive stand-in keeps the check runnable outside a browser.
globalThis.CSS = { supports: () => true } as unknown as typeof CSS;

/** The alpha part of the `rgb(from <color> r g b / <alpha>)` paint, without the color it reads. */
const alphaExpression = (paint: string) => paint.slice(paint.indexOf("/ ") + 2, paint.lastIndexOf(")"));

// #9063: a card's saved Message Box Color renders at its own alpha times the Roleplay opacity slider.
// Before the fix the slider wrote `${chatFontOpacity / 100}` over that alpha, so `rgba(255, 255, 255,
// 0.25)` — the "extract colors from avatar" default — ignored the 0.25 and hex `#FFFFFF40` did not.
for (const authored of ["rgba(255, 255, 255, 0.25)", "#FFFFFF40"]) {
  assert.equal(alphaExpression(withCssPaintAlpha(authored, "0.9")), "calc(alpha * 0.9)");
}
assert.equal(
  alphaExpression(withCssPaintAlpha("rgba(255, 255, 255, 0.25)", "0.9")),
  alphaExpression(withCssPaintAlpha("#FFFFFF40", "0.9")),
  "rgba() and an 8-digit hex carrying the same alpha must scale identically",
);

// The slider at zero still resolves to a fully transparent paint.
assert.equal(
  withCssPaintAlpha("rgba(255, 255, 255, 0.25)", "0"),
  "rgb(from rgba(255, 255, 255, 0.25) r g b / calc(alpha * 0))",
);

// A color without alpha is alpha 1, so multiplying leaves the slider in sole control of an opaque paint.
assert.equal(withCssPaintAlpha("rgb(10, 20, 30)", "0.5"), "rgb(from rgb(10, 20, 30) r g b / calc(alpha * 0.5))");

// Every gradient stop is scaled, and directions, interpolation spaces and positions stay as written.
assert.equal(
  withCssPaintAlpha("linear-gradient(135deg, rgba(20, 40, 60, 0.1) 0% 10%, #aabbcc88 100%)", "0.5"),
  "linear-gradient(135deg, rgb(from rgba(20, 40, 60, 0.1) r g b / calc(alpha * 0.5)) 0% 10%, rgb(from #aabbcc88 r g b / calc(alpha * 0.5)) 100%)",
);
assert.equal(
  withCssPaintAlpha("linear-gradient(red, blue), linear-gradient(rgba(0, 128, 0, 0.1), yellow)", "0.5"),
  "linear-gradient(rgb(from red r g b / calc(alpha * 0.5)), rgb(from blue r g b / calc(alpha * 0.5))), linear-gradient(rgb(from rgba(0, 128, 0, 0.1) r g b / calc(alpha * 0.5)), rgb(from yellow r g b / calc(alpha * 0.5)))",
);

console.log("roleplay bubble authored alpha: ok");
