// The VRM renderer in a real browser, under the server's Content-Security-Policy: a generated (Tripo) model
// keeps the colours of its embedded pictures instead of drawing plain white, and its body moves on its own
// with no idle animation. The model is built in code (scripts/regressions/fixtures/avatar-3d-fixtures.ts).
import { expect, test } from "@playwright/test";
import { generatedVrm, type Rgb } from "../scripts/regressions/fixtures/avatar-3d-fixtures.js";
import { serveWithServerCsp } from "./server-csp-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

const RENDERER = "/src/features/avatars/renderers/vrm/vrm-renderer.ts";
const OWNER_ID = "e2e-vrm-generated";
const COLOUR: Rgb = [200, 60, 40];

interface PageVrm {
  renderer: { update(frame: unknown, dtMs: number): void; dispose(): void };
  canvas: HTMLCanvasElement;
  previous: Uint8ClampedArray | null;
}
declare global {
  interface Window {
    __vrm?: PageVrm;
    __cspViolations?: string[];
  }
}

test("a generated VRM model keeps its colours under the server's CSP and moves with no idle animation", async ({
  page,
}) => {
  const model = await generatedVrm(COLOUR);
  await page.route(`**/api/avatar-models/character/${OWNER_ID}/files/vrm/model.vrm`, (route) =>
    route.fulfill({ contentType: "model/gltf-binary", body: model }),
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript(() => {
    const violations: string[] = [];
    window.__cspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) =>
      violations.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
  await serveWithServerCsp(page);
  await seedUIState(page, { hasCompletedOnboarding: true, chibiProfessorMariEnabled: false });
  await page.goto("/");
  // Vite may optimise three on the first import and reload the page once; wait that out.
  await expect
    .poll(
      () =>
        page
          .evaluate((module) => import(module).then(() => document.readyState === "complete"), RENDERER)
          .catch(() => false),
      { timeout: 60_000 },
    )
    .toBe(true);
  const webgl2 = await page.evaluate(() => {
    const probe = document.createElement("canvas").getContext("webgl2");
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!probe;
  });
  test.skip(!webgl2, "This browser build has no WebGL2.");

  await page.evaluate(
    async ({ module, ownerId }) => {
      const { createAvatarRenderer } = (await import(module)) as {
        createAvatarRenderer: () => PageVrm["renderer"] & { mount(options: unknown): Promise<void> } & {
          resize(width: number, height: number, ratio: number): void;
        };
      };
      const owner = { ownerType: "character", ownerId };
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:fixed;top:0;left:0;width:150px;height:300px;z-index:99999";
      document.body.append(canvas);
      const renderer = createAvatarRenderer();
      await renderer.mount({
        owner,
        config: {
          version: 1,
          owner,
          enabled: true,
          activeKind: "vrm",
          features: { lipSync: true, blink: true, idleMotion: true },
          kinds: {
            vrm: {
              file: "vrm/model.vrm",
              specVersion: "1.0",
              expressionMap: {},
              idleAnimation: null,
              expressionNames: [],
            },
          },
          updatedAt: "2026-10-19T12:00:00.000Z",
        },
        canvas,
        resolveImage: () => null,
        reducedMotion: false,
        signal: new AbortController().signal,
      });
      renderer.resize(150, 300, 1);
      window.__vrm = { renderer, canvas, previous: null };
    },
    { module: RENDERER, ownerId: OWNER_ID },
  );

  /** Runs frames and reads the canvas: how many pixels the model covers, their average colour, and how many
   *  pixels changed since the last read. */
  const run = (frames: number, dtMs: number) =>
    page.evaluate(
      ({ frames, dtMs }) => {
        const vrm = window.__vrm!;
        const idle = { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle" };
        for (let frame = 0; frame < frames; frame += 1) vrm.renderer.update(idle, dtMs);
        const { data } = vrm.canvas.getContext("2d")!.getImageData(0, 0, vrm.canvas.width, vrm.canvas.height);
        const sum = [0, 0, 0];
        let painted = 0;
        let changed = 0;
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3]! > 200) {
            painted += 1;
            for (let channel = 0; channel < 3; channel += 1) sum[channel]! += data[index + channel]!;
          }
          const previous = vrm.previous;
          if (
            previous &&
            [0, 1, 2, 3].some((channel) => Math.abs(previous[index + channel]! - data[index + channel]!) > 24)
          )
            changed += 1;
        }
        vrm.previous = data;
        return { painted, average: sum.map((value) => Math.round(value / Math.max(1, painted))), changed };
      },
      { frames, dtMs },
    );

  const first = await run(1, 16);
  expect(first.painted, "the model is drawn").toBeGreaterThan(1000);
  const [red, green, blue] = first.average;
  // Lighting changes how bright the picture looks, not its hue: the red-orange map stays red, never white.
  expect(red! - Math.max(green!, blue!), `the colour map shows (average ${first.average.join(", ")})`).toBeGreaterThan(
    60,
  );

  // Two seconds later, with no idle animation, the built-in idle motion has moved the body.
  const later = await run(20, 100);
  expect(later.changed, "the body moved on its own").toBeGreaterThan(150);
  expect(await page.evaluate(() => window.__cspViolations), "nothing the page loads breaks its CSP").toEqual([]);
  await page.evaluate(() => window.__vrm?.renderer.dispose());
});
