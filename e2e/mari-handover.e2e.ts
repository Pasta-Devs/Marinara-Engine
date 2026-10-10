import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/** Each sprite sheet takes this long to arrive: a cold cache on a slow link. */
const SHEET_DELAY_MS = 300;
/** Her sheet, drawn and decoded. */
const SHEET_ONLY = '[data-mari-sheet="ready"]';
/** Her sheet, or any picture of her on screen (the omnibar head, the Home card). */
const ANY_MARI = `${SHEET_ONLY}, [data-component="GlobalOmnibar.ProfessorMariButton"] img, [data-home-professor-art] img`;

test.beforeEach(async () => {
  await acquireMariThreadLock();
});

test.afterEach(() => {
  releaseMariThreadLock();
});

/** A model that takes the request and never answers, so her run stays in its working state. */
async function startSilentProvider() {
  const server: Server = createServer(() => undefined);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Records, on every animation frame, whether a Mari matching `selector` is on screen. */
async function startFrameSampler(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __mariFrames: number[]; __mariRaf: number };
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const inView =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight;
      if (!inView || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0)
        return false;
      return el instanceof HTMLImageElement ? el.complete && el.naturalWidth > 0 : true;
    };
    w.__mariFrames = [];
    (w as unknown as { __mariStart: number }).__mariStart = performance.now();
    const tick = () => {
      w.__mariFrames.push(Array.from(document.querySelectorAll(sel)).some(visible) ? 1 : 0);
      w.__mariRaf = requestAnimationFrame(tick);
    };
    w.__mariRaf = requestAnimationFrame(tick);
  }, selector);
}

async function stopFrameSampler(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __mariFrames: number[]; __mariRaf: number };
    cancelAnimationFrame(w.__mariRaf);
    const ms = performance.now() - (w as unknown as { __mariStart: number }).__mariStart;
    return {
      frames: w.__mariFrames.length,
      blank: w.__mariFrames.filter((frame) => frame === 0).length,
      fps: Math.round((w.__mariFrames.length * 1000) / ms),
    };
  });
}

async function openMariWithFixture(
  page: Page,
  request: APIRequestContext,
  baseUrl: string,
  width: number,
  height: number,
) {
  const connection = await request.post("/api/connections", {
    data: {
      name: `Hand-over fixture ${Date.now().toString(36)}`,
      provider: "custom",
      baseUrl,
      apiKey: "fixture",
      model: "fixture",
      maxContext: 65536,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = ((await connection.json()) as { id: string }).id;
  await page.setViewportSize({ width, height });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await page.route("**/sprites/mari/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SHEET_DELAY_MS));
    await route.continue();
  });
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
  await page.goto("/");
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  return connectionId;
}

async function cleanUp(request: APIRequestContext, connectionId: string) {
  const threads = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
    id: string;
  }>;
  for (const thread of threads)
    await request.delete(`/api/chats/internal/professor-mari/chats/${thread.id}`).catch(() => undefined);
  await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
}

for (const [label, width, height] of [
  ["390", 390, 844],
  ["1440", 1440, 900],
] as const) {
  test(`${label}: Mari stays on screen in every frame from her empty home, through Enter, to her working line`, async ({
    page,
    request,
  }) => {
    const provider = await startSilentProvider();
    const connectionId = await openMariWithFixture(page, request, provider.baseUrl, width, height);
    try {
      await page.keyboard.press("Control+j");
      const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
      const composer = mariPane.locator("textarea:visible");
      await expect(composer).toBeVisible();
      // Her empty home is up once her sheet is decoded; the frames before that are the page loading.
      await expect(mariPane.locator(SHEET_ONLY).first()).toBeVisible({ timeout: 30_000 });

      await startFrameSampler(page, SHEET_ONLY);
      await composer.fill("Hello there");
      await composer.press("Enter");
      await expect(mariPane.locator(".mari-live-work__sprite")).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(800);
      const sampled = await stopFrameSampler(page);
      console.log(`HANDOVER ${label} frames=${sampled.frames} fps=${sampled.fps} blank=${sampled.blank}`);
      expect(sampled.frames, "enough frames were sampled to judge the hand-over").toBeGreaterThan(5);
      expect(sampled.blank, "no frame without Mari from her empty home to her working line").toBe(0);
    } finally {
      await cleanUp(request, connectionId);
      await provider.close();
    }
  });
}

test("desktop: opening and closing Mari's window never shows a frame without Mari", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The window is opened with Ctrl+J on desktop.");
  const provider = await startSilentProvider();
  const connectionId = await openMariWithFixture(page, request, provider.baseUrl, 1440, 900);
  try {
    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(page.locator(ANY_MARI).first()).toBeVisible({ timeout: 30_000 });

    await startFrameSampler(page, ANY_MARI);
    await page.keyboard.press("Control+j");
    await expect(mariPane).toHaveAttribute("aria-hidden", "false");
    await expect(mariPane.locator(SHEET_ONLY).first()).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");
    await expect(mariPane).toHaveAttribute("aria-hidden", "true");
    await page.waitForTimeout(500);
    const sampled = await stopFrameSampler(page);
    console.log(`HANDOVER open-close frames=${sampled.frames} fps=${sampled.fps} blank=${sampled.blank}`);
    expect(sampled.frames, "enough frames were sampled to judge the open and close").toBeGreaterThan(5);
    expect(sampled.blank, "Mari is on screen through the open and the close").toBe(0);
  } finally {
    await cleanUp(request, connectionId);
    await provider.close();
  }
});
