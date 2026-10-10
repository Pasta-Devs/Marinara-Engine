import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
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
const REPLY = "Here is the plan for your three characters.";

test.beforeEach(async () => {
  await acquireMariThreadLock();
});

test.afterEach(() => {
  releaseMariThreadLock();
});

/** A model that answers with the reply, or refuses the key when `fail` is set. */
async function startProvider() {
  const state = { fail: false };
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (state.fail) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Invalid API key" } }));
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { stream?: boolean };
      // Professor Mari's workspace protocol: one JSON object, with the reply in `say` and `stop` set.
      const content = JSON.stringify({ say: REPLY, stop: true, commands: [] });
      if (body.stream) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    state,
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
    const w = window as unknown as { __mariFrames: number[]; __mariRaf: number; __mariStart: number };
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
      return inView && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
    };
    w.__mariFrames = [];
    w.__mariStart = performance.now();
    const tick = () => {
      w.__mariFrames.push(Array.from(document.querySelectorAll(sel)).some(visible) ? 1 : 0);
      w.__mariRaf = requestAnimationFrame(tick);
    };
    w.__mariRaf = requestAnimationFrame(tick);
  }, selector);
}

async function stopFrameSampler(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __mariFrames: number[]; __mariRaf: number; __mariStart: number };
    cancelAnimationFrame(w.__mariRaf);
    const ms = performance.now() - w.__mariStart;
    return {
      frames: w.__mariFrames.length,
      blank: w.__mariFrames.filter((frame) => frame === 0).length,
      fps: Math.round((w.__mariFrames.length * 1000) / ms),
    };
  });
}

async function openMariWithProvider(
  page: Page,
  request: APIRequestContext,
  baseUrl: string,
  width: number,
  height: number,
) {
  const connection = await request.post("/api/connections", {
    data: {
      name: `Error hand-over fixture ${Date.now().toString(36)}`,
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

/** Opens her window and waits until her sheet is drawn, so the frames sampled later start with her on screen. */
async function openWindowWithMari(page: Page) {
  await page.keyboard.press("Control+j");
  const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
  await expect(mariPane.locator(SHEET_ONLY).first()).toBeVisible({ timeout: 30_000 });
  return mariPane;
}

async function sendText(mariPane: ReturnType<Page["locator"]>, text: string) {
  const composer = mariPane.locator("textarea:visible");
  await expect(composer).toBeVisible();
  await composer.fill(text);
  await composer.press("Enter");
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
  test(`${label}: a failed run keeps Mari beside the error card, with no frame without her`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      label === "390" ? !testInfo.project.name.startsWith("mobile") : !testInfo.project.name.startsWith("desktop"),
      "390 runs on the phone emulation, 1440 on the desktop project.",
    );
    const provider = await startProvider();
    provider.state.fail = true;
    const connectionId = await openMariWithProvider(page, request, provider.baseUrl, width, height);
    try {
      const pane = await openWindowWithMari(page);
      await startFrameSampler(page, SHEET_ONLY);
      await sendText(pane, "Plan three characters");
      const card = pane.locator('[data-component="HomeProfessorMariChat.RunError"]');
      await expect(card).toBeVisible({ timeout: 30_000 });
      const row = pane.locator(".mari-run-error-row");
      await expect(row.locator('.mari-story-sprite[data-state="retry"]')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(600);
      const sampled = await stopFrameSampler(page);
      await page.screenshot({ path: `.tmp/omnibar-ux/round9/proof-11/error-${label}.png` });
      console.log(`HANDOVER11 error ${label} frames=${sampled.frames} fps=${sampled.fps} blank=${sampled.blank}`);
      expect(sampled.frames, "enough frames were sampled to judge the error hand-over").toBeGreaterThan(5);
      expect(sampled.blank, "no frame without Mari from her working line to the error card").toBe(0);
    } finally {
      await cleanUp(request, connectionId);
      await provider.close();
    }
  });

  test(`${label}: a finished run hands her from the live line to her resting pose with no blank frame`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      label === "390" ? !testInfo.project.name.startsWith("mobile") : !testInfo.project.name.startsWith("desktop"),
      "390 runs on the phone emulation, 1440 on the desktop project.",
    );
    const provider = await startProvider();
    const connectionId = await openMariWithProvider(page, request, provider.baseUrl, width, height);
    try {
      const pane = await openWindowWithMari(page);
      await startFrameSampler(page, SHEET_ONLY);
      await sendText(pane, "Plan three characters");
      await expect(pane.locator(".mari-answer", { hasText: REPLY })).toBeVisible({ timeout: 30_000 });
      await expect(pane.locator(".mari-answer__sprite")).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(600);
      const sampled = await stopFrameSampler(page);
      console.log(`HANDOVER11 done ${label} frames=${sampled.frames} fps=${sampled.fps} blank=${sampled.blank}`);
      expect(sampled.frames, "enough frames were sampled to judge the done hand-over").toBeGreaterThan(5);
      expect(sampled.blank, "no frame without Mari from her live line to her resting pose").toBe(0);
    } finally {
      await cleanUp(request, connectionId);
      await provider.close();
    }
  });
}
