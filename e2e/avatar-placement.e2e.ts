import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { tripoMadeVrm } from "../scripts/regressions/fixtures/avatar-3d-fixtures.js";
import { seedUIState } from "./ui-state-fixture.js";

// Maintainer decision (2026-10-19): avatars have no Arrange button, Done button or size control on the chat. Chat
// Settings → Agents → Avatars picks an avatar, sizes it, frames a 3D one (Portrait, Half body, Full body), and turns
// Arrange on and off; while it is on, 2D and 3D avatars drag with a mouse or a finger and move with the arrow
// keys. The layout is saved for the chat on this device and comes back after a reload.
const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;
const AGENTS = [
  { id: "2d-avatars", name: "2D Avatars" },
  { id: "3d-avatars", name: "3D Avatars" },
].map(({ id, name }) => ({
  agent: {
    id,
    packageId: id,
    name,
    description: `${name} for characters and personas.`,
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    execution: "host",
    defaultPromptTemplate: "",
  },
  installed: {
    id,
    version: "1.0.0",
    status: "active",
    readiness: "ready",
    readinessError: null,
    error: null,
    legacy: false,
    installedAt: "2026-10-19T00:00:00.000Z",
    manifest: {
      schemaVersion: 2,
      id,
      name,
      version: "1.0.0",
      description: `${name} for characters and personas.`,
      engine: { min: "2.5.0", maxExclusive: "4.0.0" },
      capabilityApi: { major: 1, minor: 73 },
      kind: ["agent"],
      entrypoints: { agents: "agents.json" },
      files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
      permissions: ["ui"],
      restartRequired: false,
    },
  },
}));

/** Rows of the canvas that hold any drawn pixel. */
function drawnRows(canvas: Locator) {
  return canvas.evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext("2d");
    const { width, height } = node;
    if (!context || !width || !height) return { top: -1, bottom: -1, height };
    const data = context.getImageData(0, 0, width, height).data;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3]! > 8) {
          if (top < 0) top = y;
          bottom = y;
          break;
        }
      }
    }
    return { top, bottom, height };
  });
}

/** Device pixels per CSS pixel of the canvas, and what the avatar budget allows on this screen. */
function sharpness(canvas: Locator) {
  return canvas.evaluate((node: HTMLCanvasElement) => {
    const phone = matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    return {
      ratio: node.width / node.getBoundingClientRect().width,
      allowed: Math.min(devicePixelRatio, phone ? 1.5 : 2),
    };
  });
}

/** A point on the canvas that the canvas itself receives (another avatar may overlap it). */
async function grabPoint(canvas: Locator) {
  const point = await canvas.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]) {
        const x = rect.left + rect.width * fx;
        const y = rect.top + rect.height * fy;
        if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
        if (document.elementFromPoint(x, y) === node) return { x, y };
      }
    }
    return null;
  });
  expect(point, "part of the avatar can be grabbed").not.toBeNull();
  return point!;
}

const left = (avatar: Locator) => avatar.evaluate((node: HTMLElement) => Number.parseFloat(node.style.left));
const place = (avatar: Locator) =>
  avatar.evaluate((node: HTMLElement) => ({ left: node.style.left, top: node.style.top }));

async function drag(page: Page, avatar: Locator, canvas: Locator, dx: number, dy: number, mobile: string | null) {
  const start = await grabPoint(canvas);
  const original = await left(avatar);
  if (mobile === "chromium") {
    const touch = await page.context().newCDPSession(page);
    try {
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      await expect(avatar).toHaveCSS("z-index", "40");
      for (let step = 1; step <= 8; step += 1) {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start.x + (dx * step) / 8, y: start.y + (dy * step) / 8 }],
        });
      }
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await touch.detach();
    }
  } else if (mobile) {
    // Tap uses the emulated touchscreen/hit test; the following browser pointer events exercise a held touch,
    // which Playwright's cross-browser touchscreen API does not expose.
    await page.touchscreen.tap(start.x, start.y);
    await canvas.dispatchEvent("pointerdown", {
      clientX: start.x,
      clientY: start.y,
      pointerId: 7,
      pointerType: "touch",
      button: 0,
    });
    await page.evaluate(
      ({ x, y }) => {
        window.dispatchEvent(
          new PointerEvent("pointermove", { pointerId: 7, pointerType: "touch", clientX: x, clientY: y }),
        );
        window.dispatchEvent(
          new PointerEvent("pointerup", { pointerId: 7, pointerType: "touch", clientX: x, clientY: y }),
        );
      },
      { x: start.x + dx, y: start.y + dy },
    );
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
    await page.mouse.up();
  }
  await expect.poll(() => left(avatar)).not.toBe(original);
}

for (const mode of ["roleplay", "game"] as const) {
  test(`2D and 3D avatars are arranged, resized and framed from Chat Settings in ${mode}`, async ({
    page,
    request,
    isMobile,
    browserName,
  }, info) => {
    test.setTimeout(180_000);
    const mobile = isMobile ? browserName : null;
    const characters: Array<{ id: string }> = [];
    for (const name of ["Maukie", "Pip"]) {
      const created = await request.post("/api/characters", { data: { data: { name } } });
      expect(created.ok(), await created.text()).toBeTruthy();
      characters.push((await created.json()) as { id: string });
    }
    const [maukie, pip] = characters as [{ id: string }, { id: string }];
    let chatId: string | undefined;
    try {
      const imported = await request.post(`/api/avatar-models/character/${maukie.id}/import`, {
        multipart: {
          kind: "vrm",
          file: { name: "uploaded.vrm", mimeType: "model/gltf-binary", buffer: tripoMadeVrm() },
        },
      });
      expect(imported.ok(), await imported.text()).toBeTruthy();
      const createdChat = await request.post("/api/chats", {
        data: { name: `Avatar layout ${mode}`, mode, characterIds: [maukie.id, pip.id] },
      });
      expect(createdChat.ok(), await createdChat.text()).toBeTruthy();
      chatId = ((await createdChat.json()) as { id: string }).id;
      const saved = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: {
          enableAgents: true,
          activeAgentIds: ["2d-avatars", "3d-avatars"],
          ...(mode === "game" ? { gameId: chatId, gameSessionStatus: "active", gameIntroPresented: true } : {}),
        },
      });
      expect(saved.ok(), await saved.text()).toBeTruthy();
      const message = await request.post(`/api/chats/${chatId}/messages`, {
        data: {
          role: "assistant",
          content: mode === "game" ? "The workshop is quiet.\n\nA bell rings outside." : "The workshop is quiet.",
        },
      });
      expect(message.ok()).toBeTruthy();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.route("**/api/capability-packages/installed", (route) =>
        route.fulfill({ json: AGENTS.map(({ installed }) => installed) }),
      );
      await page.route("**/api/capability-packages/agents", (route) =>
        route.fulfill({ json: AGENTS.map(({ agent }) => agent) }),
      );
      await page.route("**/api/avatar-models", async (route) => {
        const response = await route.fetch();
        const rows = (await response.json()) as Array<{ owner: { ownerId: string } }>;
        await route.fulfill({ response, json: rows.filter((row) => row.owner.ownerId === maukie.id) });
      });
      // Pip's expression sprites make a 2D (PNGTuber) avatar.
      await page.route(`**/api/sprites/${pip.id}`, (route) =>
        route.fulfill({
          json: ["neutral", "neutral_talk", "happy"].map((expression) => ({
            expression,
            filename: `${expression}.png`,
            url: "/sprites/avatar-demo/base.png",
          })),
        }),
      );
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay", "game"],
        trackerPanelEnabled: false,
        trackerPanelOpen: false,
        gameInstantTextReveal: true,
        gameMiddleMouseNav: mode === "game",
        chatSettingsExpandedSections: { [`${mode}-agents`]: true },
      });
      await page.addInitScript(
        ({ chatId, version }) => {
          localStorage.setItem("marinara-active-chat-id", chatId);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { chatId, version },
      );
      await page.goto("/");
      const stage = page.locator("[data-avatar-stage]");
      const vrm = stage.locator(`[data-avatar-owner="${maukie.id}"]`);
      const vrmCanvas = vrm.getByRole("img", { name: "Maukie's avatar" });
      const png = stage.locator(`[data-avatar-owner="${pip.id}"]`);
      const pngCanvas = png.getByRole("img", { name: "Pip's avatar" });
      const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
      if (mode === "game") await expect(narration).toContainText("The workshop is quiet.");
      await expect(vrm).toHaveAttribute("data-avatar-kind", "vrm", { timeout: 60_000 });
      await expect(png).toHaveAttribute("data-avatar-kind", "pngtuber", { timeout: 60_000 });
      for (const canvas of [vrmCanvas, pngCanvas]) {
        await expect.poll(async () => (await drawnRows(canvas)).top, { timeout: 30_000 }).toBeGreaterThanOrEqual(0);
      }
      await page.screenshot({ path: info.outputPath(`${mode}-before.png`) });

      // Nothing on the chat arranges avatars, and they leave clicks to the chat.
      await expect(page.getByRole("button", { name: /arrange/i })).toHaveCount(0);
      await expect(page.locator("[data-avatar-controls]")).toHaveCount(0);
      await expect(stage.getByRole("button")).toHaveCount(0);
      await expect(vrm).toHaveCSS("pointer-events", "none");
      await expect(png).toHaveCSS("pointer-events", "none");
      // Portrait, the default, cuts the model off at the bottom of a desktop's 3:4 box (a phone's narrower box
      // already shows more of the body).
      if (!isMobile) {
        const { height } = await drawnRows(vrmCanvas);
        await expect.poll(async () => (await drawnRows(vrmCanvas)).bottom).toBe(height - 1);
      }

      const drawer = page.locator(".mari-chat-settings-drawer");
      const avatars = drawer.locator(`#chat-settings-agent-menu-${chatId}-avatars`);
      const openAvatars = async () => {
        await page.locator("[data-chat-settings-button]").filter({ visible: true }).first().click();
        const agents = drawer.locator(`[data-chat-settings-section="${mode}-agents"]`);
        const header = agents.getByRole("button", { name: "Agents", exact: true });
        await expect(header).toBeVisible();
        if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
        await avatars.evaluate((element) => element.scrollIntoView({ block: "center" }));
        await expect(avatars.getByRole("combobox", { name: "Avatar" })).toBeVisible();
      };
      const closeDrawer = async () => {
        await drawer.getByRole("button", { name: "Close Chat Settings" }).first().click();
        await expect(drawer).toHaveCount(0);
      };
      const pick = (ownerId: string) => avatars.getByRole("combobox", { name: "Avatar" }).selectOption(ownerId);
      const framing = (name: string) => avatars.getByRole("button", { name, exact: true });

      await openAvatars();
      // Framing is for 3D avatars only.
      await pick(pip.id);
      await expect(framing("Full body")).toHaveCount(0);
      await pick(maukie.id);
      await expect(framing("Portrait")).toHaveAttribute("aria-pressed", "true");
      await framing("Full body").click();
      await expect(framing("Full body")).toHaveAttribute("aria-pressed", "true");
      // Full body shows the whole model: its head and its feet are inside the canvas, with room to spare.
      await expect
        .poll(async () => {
          const rows = await drawnRows(vrmCanvas);
          return rows.top > 0 && rows.bottom < rows.height - 4;
        })
        .toBe(true);

      // The size slider resizes both kinds, and the 3D canvas redraws at its new size instead of stretching.
      const heights = { vrm: (await vrmCanvas.boundingBox())!.height, png: (await pngCanvas.boundingBox())!.height };
      for (const [ownerId, name] of [
        [maukie.id, "Maukie"],
        [pip.id, "Pip"],
      ] as const) {
        await pick(ownerId);
        const size = avatars.getByRole("slider", { name: `${name}'s avatar size` });
        await size.focus();
        await size.press("Home");
        for (let step = 0; step < 13; step += 1) await size.press("ArrowRight");
        await expect(size).toHaveValue("70");
      }
      await expect.poll(async () => (await vrmCanvas.boundingBox())!.height).toBeLessThan(heights.vrm * 0.8);
      await expect.poll(async () => (await pngCanvas.boundingBox())!.height).toBeLessThan(heights.png * 0.8);
      await expect
        .poll(async () => {
          const { ratio, allowed } = await sharpness(vrmCanvas);
          return Math.abs(ratio - allowed) < 0.02;
        })
        .toBe(true);
      await page.screenshot({ path: info.outputPath(`${mode}-${isMobile ? "phone" : "desktop"}-drawer.png`) });

      // Arrange, from the drawer: avatars drag with a mouse or a finger and move with the arrow keys.
      await avatars.getByRole("button", { name: "Arrange", exact: true }).click();
      await expect(avatars.getByRole("button", { name: "Done", exact: true })).toHaveAttribute("aria-pressed", "true");
      await closeDrawer();
      await expect(vrm).toHaveCSS("pointer-events", "auto");
      await expect(page.getByRole("button", { name: /finish placing|^done$|arrange/i })).toHaveCount(0);
      await drag(page, png, pngCanvas, isMobile ? 100 : 45, -35, mobile);
      await drag(page, vrm, vrmCanvas, 45, -35, mobile);
      const draggedLeft = await left(vrm);
      await vrmCanvas.focus();
      await vrmCanvas.press("ArrowLeft");
      await expect.poll(() => left(vrm)).toBeLessThan(draggedLeft);
      if (mode === "game") {
        // The release over the moving canvas must not reach Game's capture-phase background navigation.
        await expect(narration).toContainText("The workshop is quiet.");
        await expect(narration).not.toContainText("A bell rings outside.");
      }
      await page.screenshot({ path: info.outputPath(`${mode}-${isMobile ? "phone" : "desktop"}-arranging.png`) });
      // Native held-key repeats must accumulate before any DOM reads or the drawer's Done.
      const beforeRepeats = await left(vrm);
      const repeatCount = 20;
      await vrmCanvas.focus();
      for (let repeat = 0; repeat < repeatCount; repeat += 1) await page.keyboard.down("ArrowRight");
      await page.keyboard.up("ArrowRight");

      // Done, from the drawer: avatars stay put and clicks go to the chat again.
      await openAvatars();
      await avatars.getByRole("button", { name: "Done", exact: true }).click();
      await expect(avatars.getByRole("button", { name: "Arrange", exact: true })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await closeDrawer();
      await expect(vrm).toHaveCSS("pointer-events", "none");
      await expect(png).toHaveCSS("pointer-events", "none");
      await expect.poll(() => left(vrm)).toBeCloseTo(beforeRepeats + repeatCount, 5);
      const moved = { vrm: await place(vrm), png: await place(png) };
      const resized = {
        vrm: Math.round((await vrmCanvas.boundingBox())!.height),
        png: Math.round((await pngCanvas.boundingBox())!.height),
      };
      if (mode === "game") {
        await expect(narration).toContainText("The workshop is quiet.");
        const background = await page.evaluate(() => {
          const skip =
            'button,a,input,textarea,select,label,[role],[data-radix-popper-content-wrapper],[data-game-skip-bg-nav="true"]';
          for (let y = 80; y < innerHeight - 80; y += 20) {
            for (let x = 40; x < innerWidth - 40; x += 40) {
              const target = document.elementFromPoint(x, y);
              if (target && !target.closest(skip)) return { x, y };
            }
          }
          return null;
        });
        expect(background, "Done restores background navigation outside the avatars").not.toBeNull();
        if (isMobile) await page.touchscreen.tap(background!.x, background!.y);
        else await page.mouse.click(background!.x, background!.y);
        await expect(narration).toContainText("A bell rings outside.");
      }

      // Places, sizes and framing come back after a reload.
      await page.reload();
      await expect(vrm).toHaveAttribute("data-avatar-kind", "vrm", { timeout: 60_000 });
      await expect(png).toHaveAttribute("data-avatar-kind", "pngtuber", { timeout: 60_000 });
      await expect.poll(() => place(vrm)).toEqual(moved.vrm);
      await expect.poll(() => place(png)).toEqual(moved.png);
      await expect.poll(async () => Math.round((await vrmCanvas.boundingBox())!.height)).toBe(resized.vrm);
      await expect.poll(async () => Math.round((await pngCanvas.boundingBox())!.height)).toBe(resized.png);
      await expect
        .poll(async () => {
          const rows = await drawnRows(vrmCanvas);
          return rows.top > 0 && rows.bottom >= 0 && rows.bottom < rows.height - 4;
        })
        .toBe(true);
      await expect(vrm).toHaveCSS("pointer-events", "none");
      await expect(page.getByRole("button", { name: /arrange/i })).toHaveCount(0);
      await openAvatars();
      await pick(maukie.id);
      await expect(framing("Full body")).toHaveAttribute("aria-pressed", "true");
      await expect(avatars.getByRole("slider", { name: "Maukie's avatar size" })).toHaveValue("70");
      await page.screenshot({ path: info.outputPath(`${mode}-${isMobile ? "phone" : "desktop"}-restored.png`) });
    } finally {
      if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
      await request.delete(`/api/avatar-models/character/${maukie.id}`).catch(() => undefined);
      for (const character of characters)
        await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
    }
  });
}
