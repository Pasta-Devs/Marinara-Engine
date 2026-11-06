// GLB and FBX avatars through the real server and the shipped renderer, under the server's Content-Security-Policy:
// a plain GLB rig (Mixamo bone names, a colour map and four blend shapes, built in code from the Tripo fixture)
// imports, shows its matched bones and faces in 3D Avatars setup, draws in its own colours, moves on its own, and
// opens its mouth through its viseme blend shape. A rig whose bone names say nothing is refused in setup, in plain
// words that stay on the page.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AvatarConfig } from "@marinara-engine/shared";
import { plainGlb, unnamedRigGlb } from "../scripts/regressions/fixtures/avatar-glb-fbx-fixtures.js";
import { chooseCharacter, runName } from "./character-picker.js";
import { serveWithServerCsp } from "./server-csp-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

const RENDERER = process.env.GLB_FBX_RENDERER_URL ?? "/src/features/avatars/renderers/glb-fbx/glb-fbx-renderer.ts";
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const FIRST_LOAD_TIMEOUT_MS = 30_000;

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

interface PageModel {
  renderer: {
    mount(options: unknown): Promise<void>;
    resize(width: number, height: number, ratio: number): void;
    update(frame: unknown, dtMs: number): void;
    dispose(): void;
  };
  canvas: HTMLCanvasElement;
  previous: Uint8ClampedArray | null;
}
declare global {
  interface Window {
    __glbFbx?: PageModel;
    __cspViolations?: string[];
  }
}

async function openSetup(page: Page, owner: { id: string; name: string }) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [PACKAGE] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [AGENT] }));
  await page.route("**/api/avatar-models", async (route) => {
    const response = await route.fetch();
    const owners = (await response.json()) as Array<{ owner: { ownerId: string } }>;
    await route.fulfill({ response, json: owners.filter((summary) => summary.owner.ownerId === owner.id) });
  });
  await page.addInitScript((appVersion) => {
    const violations: string[] = [];
    window.__cspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) =>
      violations.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    localStorage.removeItem("marinara-active-chat-id");
  }, APP_VERSION);
  await serveWithServerCsp(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    trackerPanelEnabled: false,
    trackerPanelOpen: false,
    chibiProfessorMariEnabled: false,
    agentDetailId: "3d-avatars",
  });
  await page.goto("/");
  const setup = page.locator('[data-avatar-setup="3d-avatars"]');
  await expect(setup).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
  await chooseCharacter(page, setup.getByLabel("Character or persona"), "Personas", owner.name);
  return setup;
}

test("a plain GLB rig imports, maps its bones and faces, and draws, moves and talks", async ({
  page,
  request,
}, info) => {
  const name = runName("Rigged GLB");
  const characterResponse = await request.post("/api/characters", { data: { data: { name } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  try {
    const imported = await request.post(`/api/avatar-models/character/${character.id}/import`, {
      multipart: {
        kind: "glb-fbx",
        file: { name: "Hero.glb", mimeType: "model/gltf-binary", buffer: plainGlb() },
      },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const { config } = (await imported.json()) as { config: AvatarConfig };
    expect(config.activeKind).toBe("glb-fbx");

    // Setup shows what the import matched.
    const setup = await openSetup(page, { id: character.id, name });
    const panel = setup.locator("[data-avatar-glb-fbx-setup]");
    await expect(panel.locator("[data-glb-fbx-bones]")).toHaveText("GLB model: 22 of 22 body bones matched.", {
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    await expect(panel.getByLabel("Mouth: A", { exact: true })).toHaveValue("viseme_aa");
    await expect(panel.getByLabel("Blink", { exact: true })).toHaveValue("eyeBlink");
    await expect(setup.getByRole("radio", { name: /GLB or FBX model/u })).toBeChecked();
    await expect(setup.getByText("The preview couldn't load this avatar.")).toHaveCount(0);
    await panel.screenshot({ path: info.outputPath("glb-fbx-setup.png"), animations: "disabled" });

    const webgl2 = await page.evaluate(() => {
      const probe = document.createElement("canvas").getContext("webgl2");
      probe?.getExtension("WEBGL_lose_context")?.loseContext();
      return !!probe;
    });
    test.skip(!webgl2, "This browser build has no WebGL2.");

    // The preview draws the model.
    const preview = setup.getByRole("img", { name: "Preview" });
    await preview.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          preview.evaluate((canvas: HTMLCanvasElement) => {
            const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width || 1, canvas.height || 1);
            let painted = 0;
            for (let index = 3; index < data.length; index += 4) if (data[index]! > 200) painted += 1;
            return painted;
          }),
        { timeout: FIRST_LOAD_TIMEOUT_MS },
      )
      .toBeGreaterThan(500);
    await setup.screenshot({ path: info.outputPath("glb-fbx-preview.png"), animations: "disabled" });

    // The shipped renderer, mounted with the stored setup: colours, idle motion and the mouth.
    const mount = (idleMotion: boolean) =>
      page.evaluate(
        async ({ module, config, idleMotion }) => {
          window.__glbFbx?.renderer.dispose();
          window.__glbFbx?.canvas.remove();
          const { createAvatarRenderer } = (await import(module)) as {
            createAvatarRenderer: () => PageModel["renderer"];
          };
          const canvas = document.createElement("canvas");
          canvas.style.cssText = "position:fixed;top:0;left:0;width:150px;height:300px;z-index:99999";
          document.body.append(canvas);
          const renderer = createAvatarRenderer();
          await renderer.mount({
            owner: config.owner,
            config: { ...config, features: { lipSync: true, blink: true, idleMotion } },
            canvas,
            resolveImage: () => null,
            reducedMotion: false,
            signal: new AbortController().signal,
          });
          renderer.resize(150, 300, 1);
          window.__glbFbx = { renderer, canvas, previous: null };
        },
        { module: RENDERER, config, idleMotion },
      );
    /** Runs frames and reads the canvas: how many pixels the model covers, their average colour, and how many
     *  pixels changed since the last read. */
    const run = (frames: number, dtMs: number, talking = false) =>
      page.evaluate(
        ({ frames, dtMs, talking }) => {
          const model = window.__glbFbx!;
          const frame = talking
            ? { emotion: "neutral", emotionWeight: 0, viseme: "aa", mouthOpen: 1, state: "talking" }
            : { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle" };
          for (let step = 0; step < frames; step += 1) model.renderer.update(frame, dtMs);
          const { data } = model.canvas.getContext("2d")!.getImageData(0, 0, model.canvas.width, model.canvas.height);
          const sum = [0, 0, 0];
          let painted = 0;
          let changed = 0;
          for (let index = 0; index < data.length; index += 4) {
            if (data[index + 3]! > 200) {
              painted += 1;
              for (let channel = 0; channel < 3; channel += 1) sum[channel]! += data[index + channel]!;
            }
            const previous = model.previous;
            if (
              previous &&
              [0, 1, 2, 3].some((channel) => Math.abs(previous[index + channel]! - data[index + channel]!) > 24)
            )
              changed += 1;
          }
          model.previous = data;
          return { painted, average: sum.map((value) => Math.round(value / Math.max(1, painted))), changed };
        },
        { frames, dtMs, talking },
      );

    await mount(true);
    const first = await run(1, 16);
    expect(first.painted, "the model is drawn").toBeGreaterThan(1000);
    // Lighting changes how bright the red-orange colour map looks, not its hue: never white or black.
    const [red, green, blue] = first.average;
    expect(
      red! - Math.max(green!, blue!),
      `the colour map shows (average ${first.average.join(", ")})`,
    ).toBeGreaterThan(60);
    const later = await run(20, 100);
    expect(later.changed, "the body moved on its own").toBeGreaterThan(150);

    // With idle motion off the body stands still, so only the mouth blend shape can move the picture.
    await mount(false);
    await run(5, 50);
    expect((await run(5, 50)).changed, "the model stands still").toBeLessThan(20);
    expect((await run(10, 50, true)).changed, "talking moves the viseme blend shape").toBeGreaterThan(300);
    expect(await page.evaluate(() => window.__cspViolations), "nothing the page loads breaks its CSP").toEqual([]);
    await page.evaluate(() => window.__glbFbx?.renderer.dispose());
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("a rig whose bones can't be matched is refused in setup, in plain words", async ({ page, request }, info) => {
  const name = runName("Unrigged GLB");
  const characterResponse = await request.post("/api/characters", { data: { data: { name } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  try {
    const setup = await openSetup(page, { id: character.id, name });
    await setup.getByRole("radio", { name: /GLB or FBX model/u }).check();
    const importButton = setup.getByRole("button", { name: "Import GLB or FBX", exact: true });
    await expect(importButton).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), importButton.click()]);
    expect(await chooser.element().getAttribute("accept")).toBe(".glb,.fbx");
    await chooser.setFiles({ name: "Blob.glb", mimeType: "model/gltf-binary", buffer: unnamedRigGlb() });
    const refusal = setup.locator("[data-glb-fbx-refusal]");
    await expect(refusal).toContainText(
      "This model's skeleton can't be matched to a human body: it has no hips, spine, head, left upper arm, left lower arm, right upper arm or right lower arm bone that avatars recognise.",
    );
    await expect(refusal).toHaveAttribute("role", "alert");
    await setup.screenshot({ path: info.outputPath("glb-fbx-refused.png"), animations: "disabled" });
    const saved = await request.get(`/api/avatar-models/character/${character.id}`);
    expect(await saved.json(), "nothing was stored").toBeNull();
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});
