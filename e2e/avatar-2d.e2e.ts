// The 2D avatar renderers and setup panels in a real browser, before the base lane mounts them in chats:
// the PNGTuber renderer swaps talk, blink and face pictures (a more specific feeling's own face too), crossfades
// and hops; mesh avatars draw through
// one shared WebGL2 context, load under the server's Content-Security-Policy, reuse their pictures, and fall
// back to the owner's sprites; both redraw when resized; the setup panels save what the user picks, the
// VRM panel still reports a failed import after it closes, and making a mesh avatar starts from the
// full-body neutral sprite (else the neutral one) until the user picks another.
import { expect, test, type Page } from "@playwright/test";
import { meshAvatarFiles, paintPng, solid, zipFiles } from "../scripts/regressions/fixtures/avatar-2d-fixtures.js";
import { serveWithServerCsp } from "./server-csp-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

type Rgb = [number, number, number];
const GRAY: Rgb = [128, 128, 128];
const GREEN: Rgb = [40, 200, 60];
const BLUE: Rgb = [40, 80, 220];
const YELLOW: Rgb = [240, 200, 40];
const PINK: Rgb = [230, 110, 170];
const FEATURES = { lipSync: true, blink: true, idleMotion: false };

/** Serves an owner's sprite list and pictures (50 x 100 solid colours). */
async function routeSprites(page: Page, ownerId: string, sprites: Record<string, Rgb>) {
  const pictures = new Map<string, Buffer>();
  for (const [expression, [r, g, b]] of Object.entries(sprites))
    pictures.set(expression, await paintPng(50, 100, solid(r, g, b)));
  await page.route(`**/api/sprites/${ownerId}`, (route) =>
    route.fulfill({
      json: [...pictures.keys()].map((expression) => ({
        expression,
        filename: `${expression}.png`,
        url: `/api/sprites/${ownerId}/file/${expression}.png`,
      })),
    }),
  );
  await page.route(`**/api/sprites/${ownerId}/file/*`, (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "").replace(
      /\.png$/u,
      "",
    );
    const picture = pictures.get(name);
    return picture ? route.fulfill({ contentType: "image/png", body: picture }) : route.fulfill({ status: 404 });
  });
}

async function openApp(page: Page) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, chibiProfessorMariEnabled: false });
  await page.goto("/");
}

interface PageAvatar {
  renderers: {
    update(frame: unknown, dtMs: number): void;
    resize(w: number, h: number, dpr: number): void;
    setPaused(paused: boolean): void;
    dispose(): void;
  }[];
  canvases: HTMLCanvasElement[];
}
interface MeshProbe {
  /** Canvases that asked for WebGL2. */
  glCanvases: Set<HTMLCanvasElement>;
  /** Width or height changes on those canvases (each one reallocates the drawing buffer). */
  reallocations: number;
  /** Pictures made with `new Image()`, which is how mesh-avatar loads every picture (from blob: URLs). */
  images: HTMLImageElement[];
  violations: string[];
}
declare global {
  interface Window {
    __avatar2d?: PageAvatar;
    __meshProbe?: MeshProbe;
    __meshSourceSprites?: (expressions: string[]) => void;
  }
}

/** Watches WebGL2 canvases, their reallocations, picture loads and CSP violations from the first script on. */
async function probeMeshAvatars(page: Page) {
  await page.addInitScript(() => {
    const probe: MeshProbe = { glCanvases: new Set(), reallocations: 0, images: [], violations: [] };
    window.__meshProbe = probe;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2") probe.glCanvases.add(this);
      return (getContext as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof getContext;
    for (const side of ["width", "height"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, side)!;
      Object.defineProperty(HTMLCanvasElement.prototype, side, {
        ...descriptor,
        set(this: HTMLCanvasElement, value: number) {
          if (probe.glCanvases.has(this) && value !== descriptor.get!.call(this)) probe.reallocations += 1;
          descriptor.set!.call(this, value);
        },
      });
    }
    window.Image = new Proxy(window.Image, {
      construct(target, args) {
        const image = Reflect.construct(target, args) as HTMLImageElement;
        probe.images.push(image);
        return image;
      },
    });
    document.addEventListener("securitypolicyviolation", (event) =>
      probe.violations.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
}

/** Mounts renderers of one kind on fresh canvases (100 x 200 CSS px unless `sizes` says, ratio 1) and keeps
 *  them on window. Like the stage, it hands them the owner's sprites as the PNGTuber setup until one is saved,
 *  and resolves pictures from the sprite list it fetched. */
async function mountRenderers(
  page: Page,
  module: string,
  ownerId: string,
  kinds: unknown,
  count = 1,
  reducedMotion = false,
  sizes: [number, number][] = [],
) {
  await page.evaluate(
    async ({ module, stageModule, layersModule, ownerId, kinds, count, reducedMotion, features, sizes }) => {
      const { createAvatarRenderer } = (await import(module)) as {
        createAvatarRenderer: () => PageAvatar["renderers"][number] & { mount(options: unknown): Promise<void> };
      };
      const { resolveAvatarImage, withSpriteAvatar } = (await import(stageModule)) as {
        resolveAvatarImage(owner: unknown, config: unknown, sprites: unknown, ref: unknown): string | null;
        withSpriteAvatar(owner: unknown, config: unknown, fromSprites: unknown): unknown;
      };
      const { buildPngtuberLayersFromSprites } = (await import(layersModule)) as {
        buildPngtuberLayersFromSprites(sprites: unknown): unknown;
      };
      const owner = { ownerType: "character", ownerId };
      const sprites = (await (await fetch(`/api/sprites/${ownerId}`)).json()) as unknown[];
      const config = withSpriteAvatar(
        owner,
        {
          version: 1,
          owner,
          enabled: true,
          activeKind: null,
          features,
          kinds,
          updatedAt: "2026-10-13T12:00:00.000Z",
        },
        buildPngtuberLayersFromSprites(sprites),
      );
      const sizeOf = (index: number) => sizes[index] ?? [100, 200];
      const canvases = Array.from({ length: count }, (_, index) => {
        const canvas = document.createElement("canvas");
        const [width, height] = sizeOf(index);
        canvas.style.cssText = `position:fixed;top:0;left:${index * 130}px;width:${width}px;height:${height}px;z-index:99999`;
        document.body.append(canvas);
        return canvas;
      });
      const renderers = canvases.map(() => createAvatarRenderer());
      await Promise.all(
        renderers.map((renderer, index) =>
          renderer.mount({
            owner,
            config,
            canvas: canvases[index],
            resolveImage: (ref: unknown) => resolveAvatarImage(owner, config, sprites, ref),
            reducedMotion,
            signal: new AbortController().signal,
          }),
        ),
      );
      renderers.forEach((renderer, index) => renderer.resize(...sizeOf(index), 1));
      window.__avatar2d = { renderers, canvases };
    },
    {
      module,
      stageModule: STAGE_LOGIC,
      layersModule: PNGTUBER_LAYERS,
      ownerId,
      kinds,
      count,
      reducedMotion,
      features: FEATURES,
      sizes,
    },
  );
}

const quiet = { emotion: "neutral", emotionWeight: 1, viseme: null, mouthOpen: 0, state: "idle" };
const talking = { ...quiet, mouthOpen: 1, state: "talking" };

/** Runs one frame on every renderer (none when `frame` is null) and reads each canvas: the centre colour, the
 *  top of the picture and how many pixels are painted. */
async function step(page: Page, frame: unknown, dtMs: number) {
  return page.evaluate(
    ({ frame, dtMs }) => {
      const avatar = window.__avatar2d!;
      if (frame) for (const renderer of avatar.renderers) renderer.update(frame, dtMs);
      return avatar.canvases.map((canvas) => {
        const context = canvas.getContext("2d")!;
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const at = (x: number, y: number) => [
          ...data.subarray((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 4),
        ];
        let top = -1;
        for (let y = 0; y < canvas.height && top < 0; y += 1) if (at(50, y)[3]! > 0) top = y;
        let painted = 0;
        for (let index = 3; index < data.length; index += 4) if (data[index]! > 0) painted += 1;
        return { centre: at(50, 150), top, painted };
      });
    },
    { frame, dtMs },
  );
}

const PNGTUBER_RENDERER = "/src/features/avatars/renderers/pngtuber/pngtuber-renderer.ts";
const PNGTUBER_LAYERS = "/src/features/avatars/renderers/pngtuber/pngtuber-layers.ts";
const STAGE_LOGIC = "/src/features/avatars/stage/avatar-stage-logic.ts";
const MESH_RENDERER = "/src/features/avatars/renderers/mesh-avatar/mesh-avatar-renderer.ts";

/** Until avatars are mounted in the app, Vite first meets mesh-avatar when a test imports the renderer:
 *  it optimizes the library and reloads the page once. Import the module first and wait out that reload. */
async function loadModule(page: Page, path: string) {
  await page.evaluate((module) => import(module), path).catch(() => undefined);
  await expect
    .poll(
      () =>
        page
          .evaluate((module) => import(module).then(() => document.readyState === "complete"), path)
          .catch(() => false),
      { timeout: 60_000 },
    )
    .toBe(true);
}

const near = (actual: number[] | undefined, expected: number[], tolerance = 3) =>
  !!actual && expected.every((value, index) => Math.abs(actual[index]! - value) <= tolerance);

test("PNGTuber avatars talk, blink, change face and hop from the owner's sprites", async ({ page }) => {
  await routeSprites(page, "e2e-pngtuber", { neutral: GRAY, neutral_talk: GREEN, neutral_blink: BLUE, happy: YELLOW });
  await openApp(page);
  await mountRenderers(page, PNGTUBER_RENDERER, "e2e-pngtuber", {});

  // No setup at all: the sprites are the avatar. The 50 x 100 picture fits 94 x 188 under a 6% hop margin.
  await expect.poll(async () => (await step(page, quiet, 16))[0]).toMatchObject({ centre: [...GRAY, 255], top: 12 });
  await expect.poll(async () => near((await step(page, talking, 16))[0]?.centre, GREEN)).toBe(true);
  // Clocks advance at most 100 ms per frame, so longer waits take several frames.
  for (let index = 0; index < 3; index += 1) await step(page, quiet, 100);
  await step(page, talking, 1);
  const hop = (await step(page, talking, 109))[0]!;
  expect(near(hop.centre, GREEN), "the open mouth shows while hopping").toBe(true);
  expect(hop.top, "the avatar hops by its bounce height").toBeLessThanOrEqual(1);
  await step(page, talking, 100);
  expect((await step(page, talking, 100))[0]!.top, "and lands again").toBe(12);

  // A director-driven blink shows the eyes-closed picture.
  await expect.poll(async () => near((await step(page, { ...quiet, blink: 1 }, 16))[0]?.centre, BLUE)).toBe(true);

  // The exact sprite label wins, and the new face fades in over the old one.
  await expect.poll(async () => near((await step(page, quiet, 16))[0]?.centre, GRAY)).toBe(true);
  const happy = { ...quiet, emotion: "happy", label: "happy" };
  let blended: number[] | undefined;
  await expect
    .poll(async () => {
      await step(page, happy, 0);
      blended = (await step(page, happy, 60))[0]?.centre;
      return near(blended, GRAY);
    })
    .toBe(false);
  expect(near(blended, YELLOW), "half way through the fade the faces mix").toBe(false);
  expect(near((await step(page, happy, 100))[0]?.centre, YELLOW)).toBe(true);
});

test("PNGTuber avatars show a more specific feeling's face when they have one", async ({ page }) => {
  await routeSprites(page, "e2e-feelings", { neutral: GRAY, happy: YELLOW, embarrassed: PINK });
  await openApp(page);
  await mountRenderers(page, PNGTUBER_RENDERER, "e2e-feelings", {});
  const happy = { ...quiet, emotion: "happy" };
  const showing = async (frame: unknown, colour: Rgb) => near((await step(page, frame, 100))[0]?.centre, colour);
  await expect.poll(() => showing(happy, YELLOW)).toBe(true);
  // The sprite named for embarrassment is that feeling's face, inside happy.
  await expect.poll(() => showing({ ...happy, feeling: "embarrassment" }, PINK)).toBe(true);
  await expect.poll(() => showing({ ...happy, feeling: "gratitude" }, YELLOW), "no face of its own").toBe(true);
  await expect
    .poll(() => showing({ ...quiet, emotion: "sad", feeling: "embarrassment" }, GRAY), "a feeling of another emotion")
    .toBe(true);
});

test("PNGTuber avatars do not hop with reduced motion", async ({ page }) => {
  await routeSprites(page, "e2e-still", { neutral: GRAY, neutral_talk: GREEN });
  await openApp(page);
  await mountRenderers(page, PNGTUBER_RENDERER, "e2e-still", {}, 1, true);
  await expect.poll(async () => (await step(page, quiet, 16))[0]?.top).toBe(0);
  await step(page, talking, 1);
  const frames = [];
  for (let index = 0; index < 6; index += 1) frames.push((await step(page, talking, 40))[0]!);
  expect(
    frames.every((frame) => frame.top === 0),
    "the picture stays on the ground",
  ).toBe(true);
  expect(near(frames.at(-1)!.centre, GREEN), "the mouth still moves").toBe(true);
});

/** Serves a mesh avatar file for an owner. */
async function routeMeshAvatar(page: Page, ownerId: string) {
  const archive = zipFiles(await meshAvatarFiles({ sprites: true }));
  await page.route(`**/api/avatar-models/character/${ownerId}/files/mesh-avatar/avatar-e2e.mavatar`, (route) =>
    route.fulfill({ contentType: "application/octet-stream", body: archive }),
  );
  return { "mesh-avatar": { file: "mesh-avatar/avatar-e2e.mavatar", expressionMap: {}, source: "import" } };
}

/** Loads the mesh renderer and says whether this browser has WebGL2 (the probe's own canvas is forgotten). */
async function loadMeshRenderer(page: Page) {
  await loadModule(page, MESH_RENDERER);
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const probe = canvas.getContext("webgl2");
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    window.__meshProbe!.glCanvases.delete(canvas);
    return !!probe;
  });
}

const NO_WEBGL2 = "This browser build has no WebGL2; the fallback test covers it.";

test("mesh avatars share one WebGL2 context and fall back to sprites", async ({ page }) => {
  await probeMeshAvatars(page);
  const kinds = await routeMeshAvatar(page, "e2e-mesh");
  await routeSprites(page, "e2e-mesh", { neutral: GRAY });
  await openApp(page);
  test.skip(!(await loadMeshRenderer(page)), NO_WEBGL2);

  await mountRenderers(page, MESH_RENDERER, "e2e-mesh", kinds, 2);
  const talkingHappy = { ...talking, emotion: "happy", viseme: "aa" };
  await expect
    .poll(async () => (await step(page, talkingHappy, 33)).map((canvas) => canvas.painted > 1000))
    .toEqual([true, true]);
  expect(await page.evaluate(() => window.__meshProbe!.glCanvases.size)).toBe(1);
  // The face is drawn in its skin colour (240, 200, 170), shaded by the runtime.
  const [first] = await step(page, quiet, 33);
  expect(first!.centre[3], "the face is opaque in the middle").toBeGreaterThan(200);

  // A lost context turns every mesh avatar into its owner's sprites.
  await page.evaluate(() => {
    for (const canvas of window.__meshProbe!.glCanvases) {
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    }
  });
  await expect
    .poll(async () => (await step(page, quiet, 16)).map((canvas) => near(canvas.centre, GRAY)))
    .toEqual([true, true]);
});

test("mesh avatars load under the server's CSP and reuse their pictures when mounted again", async ({ page }) => {
  await probeMeshAvatars(page);
  const kinds = await routeMeshAvatar(page, "e2e-csp");
  // No sprites: a fallback would paint nothing, so a painted canvas is the mesh avatar itself.
  await routeSprites(page, "e2e-csp", {});
  await serveWithServerCsp(page);
  await openApp(page);
  test.skip(!(await loadMeshRenderer(page)), NO_WEBGL2);

  const painted = async () => (await step(page, quiet, 33))[0]!.painted > 1000;
  // Only the avatar's own pictures: the home screen loads its own images whenever it gets to them.
  const meshPictures = () =>
    page.evaluate(() => window.__meshProbe!.images.filter((image) => image.src.startsWith("blob:")).length);
  await mountRenderers(page, MESH_RENDERER, "e2e-csp", kinds);
  await expect.poll(painted).toBe(true);
  const firstMount = await meshPictures();
  expect(firstMount, "the avatar's pictures load as images").toBeGreaterThan(5);

  // Chat switches and setup edits mount the same file again: no picture is loaded (or kept) a second time.
  for (let round = 0; round < 3; round += 1) {
    await page.evaluate(() => window.__avatar2d!.renderers.forEach((renderer) => renderer.dispose()));
    await mountRenderers(page, MESH_RENDERER, "e2e-csp", kinds);
    await expect.poll(painted).toBe(true);
  }
  expect(await meshPictures(), "later mounts reuse the pictures").toBe(firstMount);
  expect(await page.evaluate(() => window.__meshProbe!.violations)).toEqual([]);
});

test("mesh avatars of different sizes never reallocate the shared canvas and redraw when resized", async ({ page }) => {
  await probeMeshAvatars(page);
  const kinds = await routeMeshAvatar(page, "e2e-sizes");
  await routeSprites(page, "e2e-sizes", {});
  await openApp(page);
  test.skip(!(await loadMeshRenderer(page)), NO_WEBGL2);

  await mountRenderers(page, MESH_RENDERER, "e2e-sizes", kinds, 2, false, [
    [100, 200],
    [120, 240],
  ]);
  await expect
    .poll(async () => (await step(page, quiet, 33)).map((canvas) => canvas.painted > 1000))
    .toEqual([true, true]);
  const before = await page.evaluate(() => window.__meshProbe!.reallocations);
  const frames = [];
  for (let index = 0; index < 30; index += 1) frames.push(await step(page, talking, 33));
  expect(await page.evaluate(() => window.__meshProbe!.reallocations), "drawing in turn reallocates nothing").toBe(
    before,
  );
  // The smaller avatar is the larger one scaled down: the same share of its canvas is painted.
  const [small, large] = frames.at(-1)!;
  expect(Math.abs(small!.painted / (100 * 200) - large!.painted / (120 * 240))).toBeLessThan(0.02);

  // Resizing clears a canvas; it is drawn again at once, even while paused.
  await page.evaluate(() => {
    for (const renderer of window.__avatar2d!.renderers) {
      renderer.setPaused(true);
      renderer.resize(110, 220, 1);
    }
  });
  expect((await step(page, null, 0)).map((canvas) => canvas.painted > 1000)).toEqual([true, true]);
});

test("PNGTuber avatars redraw at once when resized while paused", async ({ page }) => {
  await routeSprites(page, "e2e-resize", { neutral: GRAY });
  await openApp(page);
  await mountRenderers(page, PNGTUBER_RENDERER, "e2e-resize", {});
  await expect.poll(async () => near((await step(page, quiet, 16))[0]?.centre, GRAY)).toBe(true);
  await page.evaluate(() => {
    const [renderer] = window.__avatar2d!.renderers;
    renderer!.setPaused(true);
    renderer!.resize(110, 220, 1);
  });
  const [resized] = await step(page, null, 0);
  expect(near(resized!.centre, GRAY), "the face is back without another frame").toBe(true);
});

test("mesh avatars show the owner's sprites without WebGL2", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === "webgl2"
        ? null
        : (original as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof original;
  });
  await routeSprites(page, "e2e-nogl", { neutral: GRAY });
  await openApp(page);
  await loadModule(page, MESH_RENDERER);
  const kinds = { "mesh-avatar": { file: "mesh-avatar/avatar-x.mavatar", expressionMap: {}, source: "import" } };
  await mountRenderers(page, MESH_RENDERER, "e2e-nogl", kinds);
  await expect.poll(async () => near((await step(page, quiet, 16))[0]?.centre, GRAY)).toBe(true);
});

/** Mounts a setup panel with its own query client, the way the 2D agent page shows it. */
async function mountPanel(page: Page, module: string, name: string, ownerId: string, config: unknown) {
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async ({ module, name, ownerId, config }) => {
      const url = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(url("react"));
      const { default: ReactDOM } = await import(url("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(url("@tanstack_react-query"));
      const panels = (await import(module)) as Record<string, unknown>;
      const mount = document.createElement("div");
      mount.dataset.avatarPanel = "true";
      mount.style.cssText =
        "position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--background);color:var(--foreground);padding:12px";
      document.body.append(mount);
      const root = ReactDOM.createRoot(mount);
      // Closes the panel the way switching owner or leaving the page does: React unmounts it.
      mount.addEventListener("avatar-panel-close", () => root.unmount(), { once: true });
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(panels[name], {
            owner: { ownerType: "character", ownerId },
            config,
            onChanged: () => {},
          }),
        ),
      );
    },
    { module, name, ownerId, config },
  );
}

test("the PNGTuber setup saves the owner's sprites, a chosen face and an imported save", async ({ page }) => {
  await routeSprites(page, "e2e-panel", { neutral: GRAY, neutral_talk: GREEN, happy: YELLOW });
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/avatar-models/character/e2e-panel", (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({ json: {} });
  });
  let upload = "";
  await page.route("**/api/avatar-models/character/e2e-panel/import", (route) => {
    upload = route.request().postData() ?? "";
    return route.fulfill({
      json: { kind: "pngtuber", config: {}, detected: {}, warnings: ["Animated layers show only their first frame."] },
    });
  });
  await openApp(page);
  await mountPanel(
    page,
    "/src/features/avatars/renderers/pngtuber/PngtuberSetupPanel.tsx",
    "PngtuberSetupPanel",
    "e2e-panel",
    null,
  );
  const panel = page.locator("[data-avatar-panel]");

  await expect(panel.locator("[data-avatar-face]")).toHaveCount(2);
  await expect(panel.locator('[data-avatar-face="neutral"]')).toContainText("Talk");
  await expect(panel.locator('[data-avatar-face="happy"] img')).toHaveJSProperty("naturalWidth", 50);
  await panel.getByRole("button", { name: "Use my sprites" }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({
    activeKind: "pngtuber",
    kinds: {
      pngtuber: {
        source: "sprites",
        layers: { neutral: { base: { source: "sprite", label: "neutral" }, mouthOpen: { label: "neutral_talk" } } },
      },
    },
  });

  await panel.locator('[data-avatar-feeling="happy"]').selectOption("neutral");
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1]).toMatchObject({
    kinds: { pngtuber: { expressionMap: { happy: { target: "neutral", source: "user", confidence: 1 } } } },
  });

  // The extra feelings wait under "More feelings", each on its main feeling's face until one is picked.
  const embarrassment = panel.locator('[data-avatar-feeling="embarrassment"]');
  await expect(embarrassment).toBeHidden();
  await panel.locator("[data-avatar-more-feelings] > summary").click();
  await expect(embarrassment).toHaveValue("");
  await expect(embarrassment.locator("option").first()).toHaveText("Uses Happy's face");
  await expect(panel.locator("[data-avatar-more-feelings] select")).toHaveCount(23);
  await embarrassment.selectOption("happy");
  await expect.poll(() => saved.length).toBe(3);
  expect(saved[2]).toMatchObject({
    kinds: { pngtuber: { feelingMap: { embarrassment: { target: "happy", source: "user", confidence: 1 } } } },
  });

  await panel.locator('[data-avatar-import="pngtuber"]').setInputFiles({
    name: "avatar.save",
    mimeType: "application/octet-stream",
    buffer: Buffer.from('{"0":{}}'),
  });
  await expect(panel.getByRole("status")).toContainText("Animated layers show only their first frame.");
  expect(upload).toContain('name="kind"');
  expect(upload).toContain('filename="avatar.save"');
});

test("updating a PNGTuber setup from sprites keeps the faces the user chose for every feeling", async ({ page }) => {
  await routeSprites(page, "e2e-refresh", { neutral: GRAY, happy: YELLOW, scared: BLUE, laughing: PINK });
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/avatar-models/character/e2e-refresh", (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({ json: {} });
  });
  await openApp(page);
  const sprite = (label: string) => ({ base: { source: "sprite", label } });
  const user = (target: string | null) => ({ target, source: "user", confidence: 1 });
  await mountPanel(
    page,
    "/src/features/avatars/renderers/pngtuber/PngtuberSetupPanel.tsx",
    "PngtuberSetupPanel",
    "e2e-refresh",
    {
      version: 1,
      owner: { ownerType: "character", ownerId: "e2e-refresh" },
      enabled: true,
      activeKind: "pngtuber",
      features: FEATURES,
      kinds: {
        pngtuber: {
          layers: { neutral: sprite("neutral"), happy: sprite("happy") },
          expressionMap: { happy: user("neutral") },
          feelingMap: { fear: user(null), amusement: user("happy") },
          motion: { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4.5 },
          source: "sprites",
        },
      },
      updatedAt: "2026-10-15T12:00:00.000Z",
    },
  );
  const panel = page.locator("[data-avatar-panel]");
  await panel.getByRole("button", { name: "Update from sprites" }).click();
  await expect.poll(() => saved.length).toBe(1);
  // The new scared and laughing sprites would take fear and amusement; the user's choices stay.
  expect(saved[0]).toMatchObject({
    kinds: {
      pngtuber: {
        expressionMap: { happy: user("neutral") },
        feelingMap: { fear: user(null), amusement: user("happy") },
      },
    },
  });
  expect(Object.keys((saved[0] as { kinds: { pngtuber: { layers: object } } }).kinds.pngtuber.layers)).toContain(
    "scared",
  );
});

test("a saved PNGTuber setup offers sprites made since, named after a feeling too, for every feeling", async ({
  page,
}) => {
  // Older sprites in the saved setup, and new faces named after feelings made since.
  await routeSprites(page, "e2e-new-faces", {
    smirk: GRAY,
    laughing: PINK,
    neutral: BLUE,
    happy: YELLOW,
    happy_talk: GREEN,
    fear: GREEN,
  });
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/avatar-models/character/e2e-new-faces", (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({ json: {} });
  });
  await openApp(page);
  const sprite = (label: string) => ({ base: { source: "sprite", label } });
  const user = (target: string | null) => ({ target, source: "user", confidence: 1 });
  await mountPanel(
    page,
    "/src/features/avatars/renderers/pngtuber/PngtuberSetupPanel.tsx",
    "PngtuberSetupPanel",
    "e2e-new-faces",
    {
      version: 1,
      owner: { ownerType: "character", ownerId: "e2e-new-faces" },
      enabled: true,
      activeKind: "pngtuber",
      features: FEATURES,
      kinds: {
        pngtuber: {
          layers: { smirk: sprite("smirk"), laughing: sprite("laughing") },
          expressionMap: {
            neutral: user("smirk"),
            happy: { target: "laughing", source: "sprite-label", confidence: 1 },
          },
          motion: { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4.5 },
          source: "sprites",
        },
      },
      updatedAt: "2026-10-19T11:23:58.232Z",
    },
  );
  const panel = page.locator("[data-avatar-panel]");

  // Faces lists the new sprites, never their talk pictures.
  await expect(panel.locator("[data-avatar-face]")).toHaveCount(5);
  await expect(panel.locator('[data-avatar-face="happy"]')).toContainText("Talk");
  await expect(panel.locator('[data-avatar-face="happy_talk"]')).toHaveCount(0);
  const happy = panel.locator('[data-avatar-feeling="happy"]');
  await expect(happy).toHaveValue("laughing");
  await expect(happy.locator("option")).toHaveText(["Resting face", "smirk", "laughing", "neutral", "happy", "fear"]);

  // Choosing a new face adds it to the setup with its talk picture; the old faces stay.
  await happy.selectOption("happy");
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({
    kinds: {
      pngtuber: {
        layers: {
          smirk: sprite("smirk"),
          laughing: sprite("laughing"),
          happy: { base: { source: "sprite", label: "happy" }, mouthOpen: { source: "sprite", label: "happy_talk" } },
        },
        expressionMap: { neutral: user("smirk"), happy: user("happy") },
      },
    },
  });
  expect(Object.keys((saved[0] as { kinds: { pngtuber: { layers: object } } }).kinds.pngtuber.layers)).toEqual([
    "smirk",
    "laughing",
    "happy",
  ]);

  // The extra feelings offer them too.
  await panel.locator("[data-avatar-more-feelings] > summary").click();
  await panel.locator('[data-avatar-feeling="fear"]').selectOption("fear");
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1]).toMatchObject({
    kinds: { pngtuber: { layers: { fear: sprite("fear") }, feelingMap: { fear: user("fear") } } },
  });
});

test("the VRM setup still reports a rejected import after the panel closes", async ({ page }) => {
  let answer!: () => void;
  const closed = new Promise<void>((resolve) => (answer = resolve));
  let uploads = 0;
  await page.route("**/api/avatar-models/character/e2e-vrm-panel/import", async (route) => {
    uploads += 1;
    await closed;
    await route.fulfill({ status: 400, json: { error: "This file is not a VRM model." } });
  });
  await openApp(page);
  await mountPanel(
    page,
    "/src/features/avatars/renderers/vrm/VrmSetupPanel.tsx",
    "VrmSetupPanel",
    "e2e-vrm-panel",
    null,
  );
  const panel = page.locator("[data-avatar-panel]");
  await panel.locator('input[type="file"]').setInputFiles({
    name: "model.vrm",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from("glTF"),
  });
  await expect.poll(() => uploads).toBe(1);
  await panel.evaluate((mount) => mount.dispatchEvent(new Event("avatar-panel-close")));
  await expect(panel.locator("button")).toHaveCount(0);
  answer();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "This file is not a VRM model." })).toBeVisible();
});

test("the mesh avatar setup imports a file and saves the look for a feeling", async ({ page }) => {
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/avatar-models/character/e2e-mesh-panel", (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({ json: {} });
  });
  await openApp(page);
  const config = {
    version: 1,
    owner: { ownerType: "character", ownerId: "e2e-mesh-panel" },
    enabled: true,
    activeKind: "mesh-avatar",
    features: FEATURES,
    kinds: {
      "mesh-avatar": {
        file: "mesh-avatar/avatar-e2e.mavatar",
        expressionMap: { aa: { target: "a", source: "preset", confidence: 1 } },
        source: "import",
      },
    },
    updatedAt: "2026-10-13T12:00:00.000Z",
  };
  await mountPanel(
    page,
    "/src/features/avatars/renderers/mesh-avatar/MeshAvatarSetupPanel.tsx",
    "MeshAvatarSetupPanel",
    "e2e-mesh-panel",
    config,
  );
  const panel = page.locator("[data-avatar-panel]");
  await expect(panel.locator("[data-avatar-mesh-status]")).toHaveText("Ready. It has drawn mouth shapes for talking.");
  await expect(panel.getByRole("button", { name: "Replace file" })).toBeVisible();
  await panel.locator('[data-avatar-feeling="relaxed"]').selectOption({ label: "Shy" });
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({
    kinds: { "mesh-avatar": { expressionMap: { relaxed: { target: "shy", source: "user", confidence: 1 } } } },
  });
});

test("making a mesh avatar preselects the full-body neutral sprite, else the neutral one, and keeps the user's pick", async ({
  page,
}) => {
  let generationRequests = 0;
  await page.route("**/api/avatar-generation/**", (route) => {
    generationRequests += 1;
    return route.fulfill({ status: 500, json: { error: "Not in this test." } });
  });
  await openApp(page);
  await prepareViteFixtureDependencies(page);
  // The section as the generation panel shows it, drawn again with each new sprite list.
  await page.evaluate(async () => {
    const url = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(url("react"));
    const { default: ReactDOM } = await import(url("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(url("@tanstack_react-query"));
    const { MeshAvatarSection } = await import("/src/features/avatars/generation/MeshAvatarSection.tsx" as string);
    const mount = document.createElement("div");
    mount.dataset.avatarPanel = "true";
    mount.style.cssText =
      "position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--background);color:var(--foreground);padding:12px";
    document.body.append(mount);
    const root = ReactDOM.createRoot(mount);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const owner = { ownerType: "character", ownerId: "e2e-mesh-source" };
    const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    window.__meshSourceSprites = (expressions) =>
      root.render(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(MeshAvatarSection, {
            owner,
            sprites: expressions.map((expression) => ({ expression, filename: `${expression}.png`, url: PIXEL })),
            languageConnections: [],
            onChanged: () => {},
          }),
        ),
      );
    window.__meshSourceSprites([]);
  });
  const panel = page.locator("[data-avatar-panel]");
  const picked = panel.getByRole("group", { name: "Sprite to use" }).getByRole("button", { pressed: true });
  const make = panel.getByRole("button", { name: "Make mesh avatar" });
  const showSprites = (expressions: string[]) =>
    page.evaluate((list) => window.__meshSourceSprites?.(list), expressions);

  // Sprites arrive after the section opens, and the preselection follows the list until the user picks.
  await expect(picked).toHaveCount(0);
  await expect(make).toBeDisabled();
  await showSprites(["happy", "neutral", "full_neutral"]);
  await expect(picked).toHaveText(["full neutral"]);
  await expect(make).toBeEnabled();
  await showSprites(["happy", "neutral", "Full Neutral"]);
  await expect(picked).toHaveText(["Full Neutral"]);
  await showSprites(["happy", "neutral"]);
  await expect(picked).toHaveText(["neutral"]);
  await showSprites(["happy"]);
  await expect(picked).toHaveCount(0);
  await expect(make).toBeDisabled();

  // The user's pick stays when the list changes; a pick that leaves the list falls back to the preselection.
  await showSprites(["happy", "neutral", "full_neutral"]);
  await expect(picked).toHaveText(["full neutral"]);
  await panel.getByRole("button", { name: "happy" }).click();
  await expect(picked).toHaveText(["happy"]);
  await showSprites(["happy", "neutral", "full_neutral", "sad"]);
  await expect(picked).toHaveText(["happy"]);
  await showSprites(["neutral", "full_neutral", "sad"]);
  await expect(picked).toHaveText(["full neutral"]);
  await expect(make).toBeEnabled();
  // Clearing the choice is kept too.
  await panel.getByRole("button", { name: "full neutral" }).click();
  await expect(picked).toHaveCount(0);
  await expect(make).toBeDisabled();
  await showSprites(["happy", "neutral", "full_neutral"]);
  await expect(picked).toHaveCount(0);
  // Choosing a sprite never starts making the avatar.
  expect(generationRequests).toBe(0);
});
