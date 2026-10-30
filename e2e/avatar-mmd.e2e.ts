// Actual API import/storage plus the shipped renderer: synthetic geometry and pictures, no model/provider calls.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AvatarConfig, AvatarOwnerRef } from "@marinara-engine/shared";
import { mmdPmx, mmdVmd } from "../scripts/regressions/fixtures/avatar-mmd-fixtures.js";
import { paintPng, solid, zipFiles } from "../scripts/regressions/fixtures/avatar-2d-fixtures.js";
import { serveWithServerCsp } from "./server-csp-fixture.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

// Keep the controlled package registry visible after reload: a production PWA worker bypasses page.route.
test.use({ serviceWorkers: "block" });

const MODULE = process.env.MMD_RENDERER_URL ?? "/src/features/avatars/renderers/mmd/mmd-renderer.ts";
const APP_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
interface Probe {
  renderer: {
    update(frame: unknown, dtMs: number): void;
    resize(width: number, height: number, ratio: number): void;
    setFraming(framing: string): void;
    setPaused(paused: boolean): void;
    mount(options: unknown): Promise<void>;
    dispose(): void;
  };
  canvas: HTMLCanvasElement;
  previous: Uint8ClampedArray | null;
}
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
declare global {
  interface Window {
    __mmd?: Probe;
    __mmdCsp?: string[];
    __mmdRaf?: { pending: Set<number>; executed: number };
  }
}
async function prepare(page: Page, { blank = false, setup = false } = {}) {
  await isolateSyncedUISettings(page);
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chibiProfessorMariEnabled: false,
      theme: "light",
      ...(setup ? { agentDetailId: "3d-avatars" } : {}),
    },
    "if-missing",
  );
  await page.addInitScript((version) => {
    localStorage.setItem("marinara:whats-new:seen-version", version);
    window.__mmdCsp = [];
    const raf = { pending: new Set<number>(), executed: 0 };
    window.__mmdRaf = raf;
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        raf.pending.delete(id);
        raf.executed += 1;
        callback.call(window, time);
      });
      raf.pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      raf.pending.delete(id);
      cancel(id);
    };
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__mmdCsp!.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  }, APP_VERSION);
  await serveWithServerCsp(page, blank ? "<!doctype html><html><body></body></html>" : undefined);
}
async function bundle(motion = true) {
  return zipFiles(
    new Map([
      ["モデル/model.pmx", mmdPmx({ texture: "..\\textures\\顔.png" })],
      ["textures/顔.png", await paintPng(16, 16, solid(245, 40, 20))],
      ["__MACOSX/モデル/._model.pmx", Buffer.from("ignored model metadata")],
      ["__MACOSX/textures/._顔.png", Buffer.from("ignored texture metadata")],
      ...(motion
        ? [
            ["motion.vmd", mmdVmd()] as [string, Buffer],
            ["__MACOSX/._motion.vmd", Buffer.from("ignored motion metadata")] as [string, Buffer],
          ]
        : []),
    ]),
  );
}
async function importModel(request: APIRequestContext, owner: AvatarOwnerRef, bytes: Buffer) {
  const response = await request.post(`/api/avatar-models/${owner.ownerType}/${owner.ownerId}/import`, {
    multipart: { kind: "mmd", file: { name: "model.zip", mimeType: "application/zip", buffer: bytes } },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { config: AvatarConfig }).config;
}
async function mount(
  page: Page,
  owner: AvatarOwnerRef,
  config: AvatarConfig,
  idleMotion: boolean,
  reducedMotion = false,
) {
  await page.evaluate(
    async ({ module, owner, config, idleMotion, reducedMotion }) => {
      window.__mmd?.renderer.dispose();
      window.__mmd?.canvas.remove();
      const { createAvatarRenderer } = (await import(module)) as { createAvatarRenderer(): Probe["renderer"] };
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:fixed;top:10px;left:10px;width:180px;height:320px;z-index:99999";
      document.body.append(canvas);
      const renderer = createAvatarRenderer();
      await renderer.mount({
        owner,
        config: { ...config, features: { lipSync: true, blink: false, idleMotion } },
        canvas,
        resolveImage: () => null,
        reducedMotion,
        signal: new AbortController().signal,
      });
      renderer.setFraming("full-body");
      renderer.resize(180, 320, 1);
      window.__mmd = { renderer, canvas, previous: null };
    },
    { module: MODULE, owner, config, idleMotion, reducedMotion },
  );
}
async function draw(page: Page, emotion: "neutral" | "happy", frames = 1) {
  return page.evaluate(
    ({ emotion, frames }) => {
      const probe = window.__mmd!;
      for (let index = 0; index < frames; index += 1)
        probe.renderer.update(
          { emotion, emotionWeight: emotion === "happy" ? 1 : 0, viseme: null, mouthOpen: 0, state: "idle" },
          100,
        );
      const { data } = probe.canvas.getContext("2d")!.getImageData(0, 0, probe.canvas.width, probe.canvas.height);
      let painted = 0;
      let changed = 0;
      const channels = [0, 0, 0];
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3]! > 200) {
          painted += 1;
          for (let channel = 0; channel < 3; channel += 1) channels[channel]! += data[index + channel]!;
        }
        if (
          probe.previous &&
          [0, 1, 2, 3].some((channel) => Math.abs(data[index + channel]! - probe.previous![index + channel]!) > 16)
        )
          changed += 1;
      }
      probe.previous = data;
      return { painted, changed, average: channels.map((sum) => sum / Math.max(1, painted)) };
    },
    { emotion, frames },
  );
}

test("PMX imports its bundled texture and Japanese morph, then VMD moves its saved model under server CSP", async ({
  page,
  request,
}, info) => {
  const response = await request.post("/api/characters", { data: { data: { name: "Synthetic MMD" } } });
  expect(response.ok()).toBeTruthy();
  const owner = { ownerType: "character", ownerId: ((await response.json()) as { id: string }).id } as const;
  try {
    const config = await importModel(request, owner, await bundle());
    expect(config.kinds.mmd?.expressionMap.happy?.target).toBe("笑い");
    expect(config.kinds.mmd?.idleAnimation).toBeTruthy();
    await prepare(page, { blank: true });
    await page.goto("/");
    const outsideCatalogue = {
      ...config,
      kinds: { ...config.kinds, mmd: { ...config.kinds.mmd!, expressionNames: ["other-face"] } },
    };
    await mount(page, owner, outsideCatalogue, false);
    expect(await page.evaluate(() => window.__mmdRaf!.pending.size), "the modern renderer's own RAF is stopped").toBe(
      0,
    );
    const neutral = await draw(page, "neutral");
    expect(neutral.painted, "the PMX actually draws pixels").toBeGreaterThan(1000);
    expect(
      neutral.average[0]! - Math.max(neutral.average[1]!, neutral.average[2]!),
      "the authenticated red texture is visible",
    ).toBeGreaterThan(40);
    expect(
      (await draw(page, "happy", 20)).changed,
      "a valid configured Japanese face still moves outside the offered catalogue",
    ).toBeGreaterThan(50);
    await page.evaluate(() => window.__mmd!.renderer.setPaused(true));
    expect((await draw(page, "neutral", 20)).changed, "a paused stage draws no frames").toBe(0);
    expect(
      await page.evaluate(() => window.__mmdRaf!.pending.size),
      "pause does not leave a hidden renderer loop",
    ).toBe(0);
    await page.evaluate(() => window.__mmd!.renderer.setPaused(false));
    expect((await draw(page, "neutral", 20)).changed).toBeGreaterThan(50);
    await page.screenshot({ path: info.outputPath("mmd-textured-model.png") });
    await mount(page, owner, config, true);
    await draw(page, "neutral");
    expect((await draw(page, "neutral", 5)).changed, "the uploaded VMD actually moves bone pixels").toBeGreaterThan(50);
    await mount(page, owner, config, true, true);
    await draw(page, "neutral");
    expect((await draw(page, "neutral", 20)).changed, "reduced motion does not advance VMD or idle sway").toBe(0);
    expect((await draw(page, "happy", 20)).changed, "reduced motion retains expressions").toBeGreaterThan(50);
    expect(await page.evaluate(() => window.__mmdRaf!.pending.size), "reduced motion remains driven by the stage").toBe(
      0,
    );
    expect(await page.evaluate(() => window.__mmdCsp)).toEqual([]);
    await page.evaluate(() => window.__mmd!.renderer.dispose());
    expect(await page.evaluate(() => window.__mmdRaf!.pending.size), "dispose retains no RAF").toBe(0);
    await page.reload();
    const saved = await request.get(`/api/avatar-models/character/${owner.ownerId}`);
    expect(await saved.json()).toEqual(config);
    await mount(page, owner, config, false);
    expect((await draw(page, "neutral")).painted).toBeGreaterThan(1000);
  } finally {
    await page.evaluate(() => window.__mmd?.renderer.dispose()).catch(() => undefined);
    await request.delete(`/api/characters/${owner.ownerId}`);
  }
});

test("MMD reopens its blink and keeps smaller shared draws visible after a larger avatar", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/characters", { data: { data: { name: "MMD blink and shared canvas" } } });
  expect(response.ok()).toBeTruthy();
  const owner = { ownerType: "character", ownerId: ((await response.json()) as { id: string }).id } as const;
  try {
    const saved = await importModel(request, owner, await bundle(false));
    const config = {
      ...saved,
      kinds: {
        ...saved.kinds,
        mmd: {
          ...saved.kinds.mmd!,
          expressionMap: { blink: { target: "笑い", source: "user" as const, confidence: 1 } },
        },
      },
    };
    await prepare(page, { blank: true });
    await page.goto("/");
    await mount(page, owner, config, false);
    const blink = await page.evaluate(() => {
      const { renderer, canvas } = window.__mmd!;
      const pixels = () => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      const frame = { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle" };
      renderer.update({ ...frame, blink: 0 }, 100);
      const open = pixels();
      renderer.update({ ...frame, blink: 1 }, 100);
      const closed = pixels();
      renderer.update({ ...frame, blink: 0 }, 100);
      const reopened = pixels();
      return {
        changed: closed.reduce((count, value, index) => count + (Math.abs(value - open[index]!) > 16 ? 1 : 0), 0),
        reopened: reopened.every((value, index) => value === open[index]),
      };
    });
    expect(blink.changed, "the blink target actually changes model pixels").toBeGreaterThan(50);
    expect(blink.reopened, "the closed target returns to its original open pixels").toBe(true);
    const shared = await page.evaluate(
      async ({ module, owner, config }) => {
        const first = window.__mmd!;
        const { createAvatarRenderer } = (await import(module)) as { createAvatarRenderer(): Probe["renderer"] };
        const second = createAvatarRenderer();
        const canvas = document.createElement("canvas");
        const frame = { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle", blink: 0 };
        const pixels = (target: HTMLCanvasElement) =>
          target.getContext("2d")!.getImageData(0, 0, target.width, target.height).data;
        const painted = (data: Uint8ClampedArray) =>
          data.filter((value, index) => index % 4 === 3 && value > 200).length;
        const compare = (reference: Uint8ClampedArray, actual: Uint8ClampedArray) => {
          const mask = (data: Uint8ClampedArray, index: number) =>
            data[index + 3]! > 200 && data[index]! > Math.max(data[index + 1]!, data[index + 2]!) + 40;
          let maskDifferences = 0,
            colorDifferences = 0;
          for (let index = 0; index < reference.length; index += 4) {
            if (mask(reference, index) !== mask(actual, index)) maskDifferences += 1;
            // Framebuffer resizing can round a few antialias channels; the solid-color mask must remain exact.
            if ([0, 1, 2, 3].some((channel) => Math.abs(reference[index + channel]! - actual[index + channel]!) > 16))
              colorDifferences += 1;
          }
          return { maskDifferences, colorDifferences };
        };
        // The initial shared surface is 320px high: this reference fills its complete height.
        first.renderer.resize(120, 320, 1);
        first.renderer.update(frame, 100);
        const reference = pixels(first.canvas);
        first.renderer.update(frame, 100);
        const repeated = pixels(first.canvas);
        first.renderer.resize(240, 640, 1);
        first.renderer.update(frame, 100);
        first.renderer.resize(120, 320, 1);
        first.renderer.update(frame, 100);
        const resized = pixels(first.canvas);
        first.renderer.resize(240, 640, 1);
        try {
          await second.mount({
            owner,
            config,
            canvas,
            resolveImage: () => null,
            reducedMotion: true,
            signal: new AbortController().signal,
          });
          second.setFraming("full-body");
          second.resize(120, 320, 1);
          first.renderer.update(frame, 100);
          second.update(frame, 100);
          const peer = pixels(canvas);
          second.dispose();
          first.renderer.update(frame, 100);
          return {
            reference: painted(reference),
            repeatedMatches: repeated.every((value, index) => value === reference[index]),
            resized: compare(reference, resized),
            peer: compare(reference, peer),
            retained: painted(pixels(first.canvas)),
          };
        } finally {
          second.dispose();
        }
      },
      { module: MODULE, owner, config },
    );
    expect(shared.reference).toBeGreaterThan(1000);
    expect(shared.repeatedMatches, "the fixed frame is stable before any shared-size change").toBe(true);
    expect(shared.resized, "shrinking preserves the original mask and colors").toEqual({
      maskDifferences: 0,
      colorDifferences: 0,
    });
    expect(shared.peer, "a smaller peer preserves the original mask and colors").toEqual({
      maskDifferences: 0,
      colorDifferences: 0,
    });
    expect(shared.retained, "disposing its peer keeps the large renderer alive").toBeGreaterThan(1000);
    expect(await page.evaluate(() => window.__mmdRaf!.pending.size)).toBe(0);
    expect(await page.evaluate(() => window.__mmdCsp)).toEqual([]);
  } finally {
    await page.evaluate(() => window.__mmd?.renderer.dispose()).catch(() => undefined);
    await request.delete(`/api/characters/${owner.ownerId}`);
  }
});

const AGENT = {
  id: "3d-avatars",
  packageId: "3d-avatars",
  name: "3D Avatars",
  description: "3D avatars for characters and personas.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  execution: "host",
  defaultPromptTemplate: "",
};
const PACKAGE = {
  id: "3d-avatars",
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  readinessError: null,
  error: null,
  legacy: false,
  installedAt: "2026-10-13T00:00:00.000Z",
  manifest: {
    schemaVersion: 2,
    id: "3d-avatars",
    name: "3D Avatars",
    version: "1.0.0",
    description: "3D avatars.",
    engine: { min: "2.5.0", maxExclusive: "4.0.0" },
    capabilityApi: { major: 1, minor: 73 },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  },
};

test("MMD setup imports, maps and removes model-specific motion for character and persona without changing VRM", async ({
  page,
  request,
}, info) => {
  const character = await request.post("/api/characters", { data: { data: { name: "MMD setup character" } } });
  const persona = await request.post("/api/characters/personas", { data: { name: "MMD setup persona" } });
  expect(character.ok()).toBeTruthy();
  expect(persona.ok()).toBeTruthy();
  const characterId = ((await character.json()) as { id: string }).id;
  const personaId = ((await persona.json()) as { id: string }).id;
  try {
    await prepare(page, { setup: true });
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [PACKAGE] }));
    await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [AGENT] }));
    await page.goto("/");
    const setup = page.locator('[data-avatar-setup="3d-avatars"]');
    await expect(setup).toBeVisible();
    for (const [ownerType, ownerId] of [
      ["character", characterId],
      ["persona", personaId],
    ] as const) {
      await setup.getByLabel("Character or persona").selectOption(`${ownerType}:${ownerId}`);
      await setup.getByRole("radio", { name: /^MMD PMX model/u }).check();
      const panel = setup.locator("[data-avatar-mmd-setup]");
      await expect(panel.getByRole("button", { name: "Import PMX or ZIP", exact: true })).toBeVisible();
      await panel
        .locator('input[accept=".pmx,.zip"]')
        .setInputFiles({ name: "fixture.zip", mimeType: "application/zip", buffer: await bundle(false) });
      await expect(panel.getByRole("button", { name: "Replace PMX model", exact: true })).toBeVisible();
      await expect(panel.getByLabel("Happy", { exact: true })).toHaveValue("笑い");
      await panel.getByLabel("Happy", { exact: true }).selectOption("");
      await expect
        .poll(
          async () =>
            ((await (await request.get(`/api/avatar-models/${ownerType}/${ownerId}`)).json()) as AvatarConfig).kinds.mmd
              ?.expressionMap.happy?.target,
        )
        .toBeNull();
      await panel.getByLabel("Happy", { exact: true }).selectOption("笑い");
      await expect
        .poll(
          async () =>
            ((await (await request.get(`/api/avatar-models/${ownerType}/${ownerId}`)).json()) as AvatarConfig).kinds.mmd
              ?.expressionMap.happy?.target,
        )
        .toBe("笑い");
      await panel
        .locator('input[accept=".vmd"]')
        .setInputFiles({ name: "idle.vmd", mimeType: "application/octet-stream", buffer: mmdVmd() });
      await expect(panel.getByText("Your VMD motion", { exact: true })).toBeVisible();
      await panel.getByRole("button", { name: "Remove VMD motion", exact: true }).click();
      await expect(panel.getByRole("button", { name: "Add VMD motion", exact: true })).toBeVisible();
      for (const theme of ["light", "dark"] as const) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
          await clickTopbarPanel(page, "settings");
          await page.getByRole("tab", { name: "Appearance", exact: true }).click();
          await page.locator("#settings-control-theme-mode select").selectOption(theme);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await clickTopbarPanel(page, "settings");
          if (!(await setup.isVisible())) {
            await clickTopbarPanel(page, "agents");
            await page.getByRole("button", { name: /^3D Avatars\b/u }).click();
            await expect(setup).toBeVisible();
          }
          await page.reload();
          await setup.getByLabel("Character or persona").selectOption(`${ownerType}:${ownerId}`);
          await setup.getByRole("radio", { name: /^MMD PMX model/u }).check();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const preview = setup.getByRole("img", { name: "Preview", exact: true });
        await preview.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            preview.evaluate((canvas: HTMLCanvasElement) =>
              canvas
                .getContext("2d")!
                .getImageData(0, 0, canvas.width, canvas.height)
                .data.some((value, index) => index % 4 === 3 && value > 0),
            ),
          )
          .toBe(true);
        await page.screenshot({ path: info.outputPath(`mmd-${ownerType}-${theme}.png`) });
        await panel.getByRole("button", { name: "Replace PMX model", exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`mmd-${ownerType}-${theme}-controls.png`) });
      }
      const dimensions = await panel.getByRole("button").evaluateAll((buttons) =>
        buttons.map((button) => ({
          height: button.getBoundingClientRect().height,
          width: button.getBoundingClientRect().width,
        })),
      );
      expect(dimensions.every((box) => box.height >= 44 && box.width >= 44)).toBe(true);
      await setup.getByRole("radio", { name: /^VRM model/u }).check();
      await expect(setup.getByRole("button", { name: "Import VRM", exact: true })).toBeVisible();
      await expect(setup.getByRole("button", { name: "Read the guide", exact: true })).toBeVisible();
    }
  } finally {
    await request.delete(`/api/characters/${characterId}`);
    await request.delete(`/api/characters/personas/${personaId}`);
  }
});

test("MMD missing assets and an aborted load release the renderer without stale pixels", async ({ page, request }) => {
  const response = await request.post("/api/characters", { data: { data: { name: "MMD disposal" } } });
  const owner = { ownerType: "character", ownerId: ((await response.json()) as { id: string }).id } as const;
  try {
    const config = await importModel(request, owner, await bundle(false));
    await prepare(page);
    await page.goto("/");
    const texture = Object.values(config.kinds.mmd!.texturePaths)[0]!;
    await page.route(`**/api/avatar-models/character/${owner.ownerId}/files/${texture}`, (route) =>
      route.fulfill({ status: 404 }),
    );
    const failed = await page.evaluate(
      async ({ module, owner, config }) => {
        const { createAvatarRenderer } = (await import(module)) as { createAvatarRenderer(): Probe["renderer"] };
        const renderer = createAvatarRenderer();
        const canvas = document.createElement("canvas");
        try {
          await renderer.mount({
            owner,
            config,
            canvas,
            resolveImage: () => null,
            reducedMotion: false,
            signal: new AbortController().signal,
          });
          return false;
        } catch {
          return canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data[3] === 0;
        } finally {
          renderer.dispose();
        }
      },
      { module: MODULE, owner, config },
    );
    expect(failed, "a deleted texture fails closed").toBe(true);
    await page.unroute(`**/api/avatar-models/character/${owner.ownerId}/files/${texture}`);
    const held = barrier();
    let entered = false;
    const handled = barrier();
    await page.route(`**/api/avatar-models/character/${owner.ownerId}/files/mmd/model.pmx`, async (route) => {
      entered = true;
      await held.promise;
      await route.continue().catch(() => undefined);
      handled.resolve();
    });
    await page.evaluate(
      ({ module, owner, config }) => {
        (window as unknown as { __abortedMount: Promise<boolean> }).__abortedMount = (async () => {
          const { createAvatarRenderer } = (await import(module)) as { createAvatarRenderer(): Probe["renderer"] };
          const renderer = createAvatarRenderer();
          const canvas = document.createElement("canvas");
          const abort = new AbortController();
          (window as unknown as { __abortMmd: () => void }).__abortMmd = () => {
            abort.abort();
            renderer.dispose();
          };
          try {
            await renderer.mount({
              owner,
              config,
              canvas,
              resolveImage: () => null,
              reducedMotion: false,
              signal: abort.signal,
            });
            return false;
          } catch (error) {
            return error instanceof DOMException && error.name === "AbortError";
          } finally {
            renderer.dispose();
          }
        })();
      },
      { module: MODULE, owner, config },
    );
    await expect.poll(() => entered).toBe(true);
    await page.evaluate(() => (window as unknown as { __abortMmd(): void }).__abortMmd());
    held.resolve();
    await handled.promise;
    expect(await page.evaluate(() => (window as unknown as { __abortedMount: Promise<boolean> }).__abortedMount)).toBe(
      true,
    );
    await page.unroute(`**/api/avatar-models/character/${owner.ownerId}/files/mmd/model.pmx`);
    // A fresh owner mount still works after the failed/aborted instances released the shared renderer.
    await mount(page, owner, config, false);
    expect((await draw(page, "neutral")).painted).toBeGreaterThan(1000);
    expect(await page.evaluate(() => window.__mmdCsp)).toEqual([]);
  } finally {
    await page.evaluate(() => window.__mmd?.renderer.dispose()).catch(() => undefined);
    await request.delete(`/api/characters/${owner.ownerId}`);
  }
});

test("MMD decodes a bundled TGA map and toon ramp without a CSP-blocked fetch", async ({ page, request }) => {
  const response = await request.post("/api/characters", { data: { data: { name: "MMD TGA" } } });
  expect(response.ok()).toBeTruthy();
  const owner = { ownerType: "character", ownerId: ((await response.json()) as { id: string }).id } as const;
  try {
    const tga = Buffer.alloc(18 + 8 * 8 * 3);
    tga[2] = 2;
    tga.writeUInt16LE(8, 12);
    tga.writeUInt16LE(8, 14);
    tga[16] = 24;
    for (let offset = 18; offset < tga.length; offset += 3) {
      tga[offset] = 20;
      tga[offset + 1] = 40;
      tga[offset + 2] = 245;
    }
    const config = await importModel(
      request,
      owner,
      zipFiles(
        new Map([
          ["model.pmx", mmdPmx({ texture: "face.tga", toonTexture: true })],
          ["face.tga", tga],
        ]),
      ),
    );
    await prepare(page);
    await page.goto("/");
    await mount(page, owner, config, false);
    const drawn = await draw(page, "neutral");
    expect(drawn.painted).toBeGreaterThan(1000);
    expect(drawn.average[0]! - Math.max(drawn.average[1]!, drawn.average[2]!)).toBeGreaterThan(40);
    expect(await page.evaluate(() => window.__mmdCsp)).toEqual([]);
  } finally {
    await page.evaluate(() => window.__mmd?.renderer.dispose()).catch(() => undefined);
    await request.delete(`/api/characters/${owner.ownerId}`);
  }
});
