import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { seedUIState } from "./ui-state-fixture.js";

// #7688: an image pinned from the gallery keeps the place and size it was given across a reload,
// and a locked pin cannot be moved or resized until it is unlocked.

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const requireServer = createRequire(new URL("../packages/server/package.json", import.meta.url));
const sharp = requireServer("sharp");
const PINS_KEY = "marinara-pinned-gallery-images";

async function openChat(page: Page, chatId: string, pin: Record<string, unknown>) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, appVersion, key, pinned }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      // Pinned once, like the gallery's Pin button; a reload must keep whatever the page saved since.
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([pinned]));
    },
    { id: chatId, appVersion: version, key: PINS_KEY, pinned: pin },
  );
  await page.goto("/");
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x / 2, from.y + by.y / 2, { steps: 4 });
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 4 });
  await page.mouse.up();
}

function expectSameBox(actual: { x: number; y: number; width: number; height: number }, expected: typeof actual) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(1);
}

test("a pinned gallery image keeps its place and size after a reload, and a locked one stays put", async ({
  page,
  request,
}, testInfo) => {
  const created = await request.post("/api/chats", {
    data: { name: "Pinned image layout proof", mode: "roleplay", characterIds: [], connectionId: "synthetic" },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  try {
    const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#7c2d12" } })
      .png()
      .toBuffer();
    const upload = await request.post(`/api/gallery/${chat.id}/upload`, {
      multipart: {
        prompt: "Pinned layout proof",
        width: "600",
        height: "400",
        file: { name: "pinned.png", mimeType: "image/png", buffer: png },
      },
    });
    expect(upload.ok()).toBeTruthy();
    const listed = await request.get(`/api/gallery/${chat.id}`);
    expect(listed.ok()).toBeTruthy();
    const [image] = (await listed.json()) as Record<string, unknown>[];
    expect(image).toBeTruthy();

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openChat(page, chat.id, { ...image, kind: "image" });

    const pinned = page.getByLabel("Pinned gallery image. Drag to move.", { exact: true });
    // The first page a fresh dev server serves can take longer than the default wait.
    await expect(pinned).toBeVisible({ timeout: 30_000 });
    const start = await box(pinned);

    // Move it near the top-left corner, then make it smaller from its corner handle.
    await drag(
      page,
      { x: start.x + start.width / 2, y: start.y + start.height / 2 },
      { x: 16 - start.x, y: 140 - start.y },
    );
    const moved = await box(pinned);
    expect(Math.abs(moved.x - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.y - 140)).toBeLessThanOrEqual(1);
    const handle = page.getByLabel("Resize pinned image", { exact: true });
    const corner = await box(handle);
    await drag(page, { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, { x: -90, y: -90 });
    let arranged = await box(pinned);
    expect(arranged.width).toBeLessThan(moved.width - 40);
    expect(Math.abs(arranged.width / arranged.height - 1.5)).toBeLessThan(0.02);

    await page.reload();
    await expect(pinned).toBeVisible();
    expectSameBox(await box(pinned), arranged);

    // A narrower window (a phone's keyboard or rotation) shrinks the pin to fit. Moving it there keeps the size
    // it was given, so it grows back when the window does.
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: Math.round(arranged.width * 0.8) + 16, height: viewport.height });
    await expect.poll(async () => (await box(pinned)).width).toBeLessThan(arranged.width - 10);
    const squeezed = await box(pinned);
    await drag(page, { x: squeezed.x + squeezed.width / 2, y: squeezed.y + squeezed.height / 2 }, { x: 0, y: 30 });
    await page.setViewportSize(viewport);
    await expect.poll(async () => Math.round((await box(pinned)).width)).toBe(Math.round(arranged.width));
    const regrown = await box(pinned);
    expect(Math.abs(regrown.y - (squeezed.y + 30))).toBeLessThanOrEqual(1);
    expect(Math.abs(regrown.height - arranged.height)).toBeLessThanOrEqual(1);
    arranged = regrown;

    // Lock it: dragging the image or looking for its resize handle does nothing now.
    const lock = page.getByRole("button", { name: "Lock pinned image", exact: true });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    const locked = page.getByLabel("Pinned gallery image. Locked in place.", { exact: true });
    await expect(locked).toBeVisible();
    await expect(handle).toHaveCount(0);
    await drag(page, { x: arranged.x + arranged.width / 2, y: arranged.y + arranged.height / 2 }, { x: 120, y: 90 });
    expectSameBox(await box(locked), arranged);

    await page.reload();
    await expect(locked).toBeVisible();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    await expect(handle).toHaveCount(0);
    await drag(page, { x: arranged.x + arranged.width / 2, y: arranged.y + arranged.height / 2 }, { x: 120, y: 90 });
    expectSameBox(await box(locked), arranged);
    await testInfo.attach("locked-pin", {
      body: await page.screenshot({ path: testInfo.outputPath("locked-pin.png") }),
      contentType: "image/png",
    });

    // Unlocked, it moves again.
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "false");
    await expect(handle).toHaveCount(1);
    await drag(page, { x: arranged.x + arranged.width / 2, y: arranged.y + arranged.height / 2 }, { x: 0, y: 60 });
    expect(Math.abs((await box(pinned)).y - (arranged.y + 60))).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
