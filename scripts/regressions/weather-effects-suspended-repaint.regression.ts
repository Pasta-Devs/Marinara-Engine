// Adapted from luma-inibitor's community patch linked in #5814.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveWeatherRenderConfig } from "../../packages/client/src/lib/weather-renderer.js";

let drawCalls = 0;
const context = new Proxy({} as Record<string, unknown>, {
  get(target, key: string) {
    if (key in target) return target[key];
    return () => {
      drawCalls += 1;
      if (key.startsWith("create")) return { addColorStop() {} };
    };
  },
});
const canvas = { width: 0, height: 0, getContext: () => context };
const posted: unknown[] = [];
const worker = {
  postMessage: (message: unknown) => posted.push(message),
  onmessage: null as ((event: { data: unknown }) => void) | null,
};
Object.assign(globalThis, { self: worker });
await import("../../packages/client/src/workers/weather-effects.worker.js");
assert.deepEqual(posted, [{ type: "ready" }]);
const send = (data: unknown) => worker.onmessage?.({ data });

try {
  send({
    type: "init",
    canvas,
    config: resolveWeatherRenderConfig("rain", "night"),
    showCelestial: true,
    width: 390,
    height: 844,
    scale: 1,
  });
  assert.ok(drawCalls > 0, "initial scene is painted");
  send({ type: "visibility", hidden: true });
  drawCalls = 0;
  send({ type: "resize", width: 390, height: 420, scale: 1 });
  assert.equal(canvas.height, 420);
  assert.ok(drawCalls > 2, "paused resize redraws the scene after clearing its bitmap");
  const pausedDraws = drawCalls;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(drawCalls, pausedDraws, "forced repaint does not resume the animation loop");
  send({ type: "visibility", hidden: false });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(drawCalls > pausedDraws, "unpausing resumes animation");
} finally {
  send({ type: "visibility", hidden: true });
}

const fallback = readFileSync(
  new URL("../../packages/client/src/components/chat/WeatherEffects.tsx", import.meta.url),
  "utf8",
);
assert.match(
  fallback,
  /if \(document.hidden \|\| pausedRef.current\) \{\s*resizePending = true;\s*return;/,
  "fallback preserves its frozen bitmap instead of clearing it",
);
assert.match(fallback, /if \(resizePending\) resize\(\);/, "deferred fallback resize is applied when it resumes");
console.log("weather-effects suspended repaint regression passed");
