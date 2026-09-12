// Adapted from luma-inibitor's community patch linked in #5814.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  createWeatherParticle,
  resolveWeatherRenderConfig,
  type WeatherParticle,
} from "../../packages/client/src/lib/weather-renderer.js";

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
// Execute the component's fallback lifecycle with browser boundaries stubbed.
const fallbackStart = fallback.indexOf('    const ctx = canvas.getContext("2d");');
const fallbackEnd = fallback.indexOf("  }, [config, shouldDrawCelestial");
assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart, "fallback lifecycle remains extractable");
const constants = fallback.slice(
  fallback.indexOf("const MAX_CANVAS_DPR"),
  fallback.indexOf("interface WeatherEffectsProps"),
);
const fallbackLifecycle = stripTypeScriptTypes(
  `(() => { ${constants}\n${fallback.slice(fallbackStart, fallbackEnd)} })()`,
);

for (const suspendedBy of ["paused", "hidden"]) {
  for (const scale of [1, 0.5]) {
    const width = 1920 / scale;
    const height = 1080 / scale;
    const creationSizes: Array<[number, number]> = [];
    let scheduledFrames = 0;
    const sandbox = {
      canvas: {
        width: 300,
        height: 150,
        getContext: () => ({ setTransform() {} }),
        parentElement: { getBoundingClientRect: () => ({ width, height }) },
      },
      document: { hidden: suspendedBy === "hidden", addEventListener() {}, removeEventListener() {} },
      window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} },
      pausedRef: { current: suspendedBy === "paused" },
      particlesRef: { current: [] as WeatherParticle[] },
      frameRef: { current: 0 },
      resumeFallbackRef: { current: null as (() => void) | null },
      config: resolveWeatherRenderConfig("clear", "night"),
      createWeatherParticle: (...args: Parameters<typeof createWeatherParticle>) => {
        creationSizes.push([args[1], args[2]]);
        return createWeatherParticle(...args);
      },
      requestAnimationFrame: () => ++scheduledFrames,
      cancelAnimationFrame() {},
    };
    const cleanup = runInNewContext(fallbackLifecycle, sandbox) as () => void;
    try {
      const initialParticles = sandbox.particlesRef.current;
      const initialTypes = Array.from(initialParticles, (particle) => particle.type);
      assert.equal(initialParticles.length, sandbox.config.count + 10 + 18, "all configured particle types initialize");
      assert.ok(
        creationSizes.every(([w, h]) => w === 300 && h === 150),
        "suspended mount uses the default bitmap",
      );
      sandbox.resumeFallbackRef.current?.();
      assert.deepEqual([sandbox.canvas.width, sandbox.canvas.height], [300, 150], "suspension keeps the bitmap intact");
      assert.equal(scheduledFrames, 0, "suspended mounts do not schedule animation");

      sandbox.document.hidden = false;
      sandbox.pausedRef.current = false;
      sandbox.resumeFallbackRef.current?.();
      assert.deepEqual(
        [sandbox.canvas.width, sandbox.canvas.height],
        [1920, 1080],
        "resume applies the deferred resize",
      );
      assert.equal(
        creationSizes.length,
        initialParticles.length * 2,
        "resume recreates every incorrectly placed particle",
      );
      assert.ok(
        creationSizes.slice(initialParticles.length).every(([w, h]) => w === width && h === height),
        "recreated particles use CSS dimensions, including when the bitmap scale is reduced",
      );
      assert.deepEqual(
        Array.from(sandbox.particlesRef.current, (particle) => particle.type),
        initialTypes,
        "resize preserves particle type order and counts, including fireflies and stars",
      );
      assert.ok(
        sandbox.particlesRef.current.every((particle, index) => particle !== initialParticles[index]),
        "resume replaces stale particle positions",
      );
      assert.equal(scheduledFrames, 1, "resume starts one animation loop");
      sandbox.resumeFallbackRef.current?.();
      assert.equal(creationSizes.length, initialParticles.length * 2, "repeated resume preserves the rebuilt scene");
      assert.equal(scheduledFrames, 1, "repeated resume does not duplicate the animation loop");
    } finally {
      cleanup();
    }
  }
}
console.log("weather-effects suspended repaint regression passed");
