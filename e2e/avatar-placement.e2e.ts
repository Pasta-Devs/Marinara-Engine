import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { tripoMadeVrm } from "../scripts/regressions/fixtures/avatar-3d-fixtures.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;
const agent = {
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
const installed = {
  id: agent.id,
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  readinessError: null,
  error: null,
  legacy: false,
  installedAt: "2026-10-19T00:00:00.000Z",
  manifest: {
    schemaVersion: 2,
    id: agent.id,
    name: agent.name,
    version: "1.0.0",
    description: agent.description,
    engine: { min: "2.5.0", maxExclusive: "4.0.0" },
    capabilityApi: { major: 1, minor: 73 },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  },
};

for (const mode of ["roleplay", "game"] as const) {
  test(`an uploaded VRM can be moved, resized and restored in ${mode} without Expressions`, async ({
    page,
    request,
    isMobile,
    browserName,
  }, info) => {
    test.setTimeout(120_000);
    const created = await request.post("/api/characters", { data: { data: { name: "Maukie" } } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const character = (await created.json()) as { id: string };
    let chatId: string | undefined;
    try {
      const imported = await request.post(`/api/avatar-models/character/${character.id}/import`, {
        multipart: {
          kind: "vrm",
          file: { name: "uploaded.vrm", mimeType: "model/gltf-binary", buffer: tripoMadeVrm() },
        },
      });
      expect(imported.ok(), await imported.text()).toBeTruthy();
      const createdChat = await request.post("/api/chats", {
        data: { name: `Uploaded VRM ${mode}`, mode, characterIds: [character.id] },
      });
      expect(createdChat.ok(), await createdChat.text()).toBeTruthy();
      chatId = ((await createdChat.json()) as { id: string }).id;
      const saved = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: {
          enableAgents: true,
          activeAgentIds: ["3d-avatars"],
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
      await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [installed] }));
      await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [agent] }));
      await page.route("**/api/avatar-models", async (route) => {
        const response = await route.fetch();
        const rows = (await response.json()) as Array<{ owner: { ownerId: string } }>;
        await route.fulfill({ response, json: rows.filter((row) => row.owner.ownerId === character.id) });
      });
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay", "game"],
        trackerPanelEnabled: false,
        trackerPanelOpen: false,
        gameInstantTextReveal: true,
        gameMiddleMouseNav: mode === "game",
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
      const avatar = stage.locator(`[data-avatar-owner="${character.id}"]`);
      const canvas = avatar.getByRole("img", { name: "Maukie's avatar" });
      const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
      if (mode === "game") await expect(narration).toContainText("The workshop is quiet.");
      await expect(avatar).toHaveAttribute("data-avatar-kind", "vrm", { timeout: 60_000 });
      await expect
        .poll(() =>
          canvas.evaluate((node: HTMLCanvasElement) => {
            const context = node.getContext("2d");
            if (!context || !node.width || !node.height) return false;
            return context
              .getImageData(0, 0, node.width, node.height)
              .data.some((value, index) => index % 4 === 3 && value > 0);
          }),
        )
        .toBe(true);
      await page.screenshot({ path: info.outputPath(`${mode}-before.png`) });
      const arrange = page.getByRole("button", { name: "Arrange avatars", exact: true });
      if (isMobile) await arrange.tap();
      else await arrange.click();
      const before = await canvas.boundingBox();
      expect(before).not.toBeNull();
      const originalLeft = await avatar.evaluate((node: HTMLElement) => node.style.left);
      const start = { x: before!.x + before!.width / 2, y: before!.y + before!.height / 2 };
      if (isMobile && browserName === "chromium") {
        const touch = await page.context().newCDPSession(page);
        try {
          await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
          await expect(avatar).toHaveCSS("z-index", "40");
          for (let step = 1; step <= 8; step += 1) {
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x: start.x + (45 * step) / 8, y: start.y - (35 * step) / 8 }],
            });
          }
          await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } finally {
          await touch.detach();
        }
      } else if (isMobile) {
        // Tap uses the emulated touchscreen/hit test; the following browser pointer events exercise a
        // held touch, which Playwright's cross-browser touchscreen API does not expose.
        await canvas.tap();
        await canvas.dispatchEvent("pointerdown", {
          ...start,
          clientX: start.x,
          clientY: start.y,
          pointerId: 7,
          pointerType: "touch",
          button: 0,
        });
        await page.evaluate(({ x, y }) => {
          window.dispatchEvent(
            new PointerEvent("pointermove", { pointerId: 7, pointerType: "touch", clientX: x + 45, clientY: y - 35 }),
          );
          window.dispatchEvent(
            new PointerEvent("pointerup", { pointerId: 7, pointerType: "touch", clientX: x + 45, clientY: y - 35 }),
          );
        }, start);
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 45, start.y - 35, { steps: 8 });
        await page.mouse.up();
      }
      await expect.poll(() => avatar.evaluate((node: HTMLElement) => node.style.left)).not.toBe(originalLeft);
      const draggedLeft = await avatar.evaluate((node: HTMLElement) => Number.parseFloat(node.style.left));
      await canvas.focus();
      await canvas.press("ArrowLeft");
      await expect
        .poll(() => avatar.evaluate((node: HTMLElement) => Number.parseFloat(node.style.left)))
        .toBeLessThan(draggedLeft);
      if (mode === "game") {
        // The click released over the moving canvas must not reach Game's capture-phase background navigation.
        await expect(narration).toContainText("The workshop is quiet.");
        await expect(narration).not.toContainText("A bell rings outside.");
      }
      const moved = await avatar.evaluate((node: HTMLElement) => ({ left: node.style.left, top: node.style.top }));
      const size = page.getByRole("slider", { name: "Maukie's avatar size" });
      await size.focus();
      await size.press("Home");
      for (let step = 0; step < 13; step += 1) await size.press("ArrowRight");
      await expect(size).toHaveValue("0.7");
      await expect.poll(async () => (await canvas.boundingBox())!.height).toBeLessThan(before!.height * 0.8);
      const resized = await canvas.boundingBox();
      await page.screenshot({ path: info.outputPath(`${mode}-arranging.png`) });
      await avatar.getByRole("button", { name: "Finish placing avatar" }).click();
      await expect(avatar).toHaveCSS("pointer-events", "none");
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
        expect(background, "Done restores background navigation outside the avatar controls").not.toBeNull();
        if (isMobile) await page.touchscreen.tap(background!.x, background!.y);
        else await page.mouse.click(background!.x, background!.y);
        await expect(narration).toContainText("A bell rings outside.");
      }
      await page.reload();
      await expect(avatar).toHaveAttribute("data-avatar-kind", "vrm", { timeout: 60_000 });
      await expect
        .poll(() => avatar.evaluate((node: HTMLElement) => ({ left: node.style.left, top: node.style.top })))
        .toEqual(moved);
      await expect.poll(async () => Math.round((await canvas.boundingBox())!.height)).toBe(Math.round(resized!.height));
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme("light");
      });
      await page.getByRole("button", { name: "Arrange avatars", exact: true }).click();
      await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
      const controlHeight = await page.evaluate(
        () => `${Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.75}px`,
      );
      await expect(size).toHaveCSS("height", controlHeight);
      await expect.poll(() => size.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await expect
        .poll(() =>
          size.evaluate((node) => {
            const style = getComputedStyle(node);
            const accent = style.getPropertyValue("--marinara-chat-chrome-accent").trim();
            return ["--range-thumb-color", "--range-fill-color"].every(
              (property) => style.getPropertyValue(property).trim() === accent,
            );
          }),
        )
        .toBe(true);
      await page.screenshot({ path: info.outputPath(`${mode}-${isMobile ? "phone" : "desktop"}-restored.png`) });
    } finally {
      if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
      await request.delete(`/api/avatar-models/character/${character.id}`).catch(() => undefined);
      await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
    }
  });
}
