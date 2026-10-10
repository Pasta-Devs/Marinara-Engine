import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Slice 84: "Continue with Prof. Mari" on a quick answer starts a new Mari chat named after the question,
 * and the open Mari chat is left as it was.
 */

const QUESTION = "why are my replies so short";

async function startFixtureProvider(
  reply: string,
  streaming = false,
): Promise<{ server: Server; baseUrl: string; readonly cancelledStreams: number }> {
  let cancelledStreams = 0;
  const server = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      if (incoming.method === "GET") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as {
        stream?: boolean;
        messages?: Array<{ role: string; content: string }>;
      };
      const content = body.messages?.some(
        (message) =>
          message.role === "system" && typeof message.content === "string" && message.content.includes('"commands"'),
      )
        ? JSON.stringify({ say: "I can help with your reply length.", stop: true, commands: [] })
        : reply;
      // The local workspace uses its JSON command protocol; quick answers use SSE.
      if (!body.stream) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({ say: "I can help with your reply length.", stop: true, commands: [] }),
                },
                finish_reason: "stop",
              },
            ],
          }),
        );
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      if (streaming) {
        let index = 0;
        let completed = false;
        const timer = setInterval(() => {
          if (index < content.length) {
            response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: content[index++] } }] })}\n\n`);
          } else {
            clearInterval(timer);
            completed = true;
            response.end("data: [DONE]\n\n");
          }
        }, 2);
        response.on("close", () => {
          clearInterval(timer);
          if (!completed) cancelledStreams++;
        });
        return;
      }
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    get cancelledStreams() {
      return cancelledStreams;
    },
  };
}

async function prepareClient(page: Page, connectionId: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Quick answers are off by default, and an earlier test's synced settings would win over this seed.
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    omnibarAsideEnabled: true,
    omnibarAsideConnectionId: connectionId,
    omnibarAsideDelayMs: 1_000,
  });
}

test.beforeEach(async ({ request }) => {
  await acquireMariThreadLock();
  const existing = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
    id: string;
  }>;
  await Promise.all(
    existing.map((chat) =>
      request.delete(`/api/chats/internal/professor-mari/chats/${chat.id}`).catch(() => undefined),
    ),
  );
});

test("quick answer streaming keeps omnibar updates within the browser frame budget", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Render counts and pointer movement are covered on desktop.");
  const reply = "Raise **Max Tokens** in Chat Settings. ".repeat(40);
  const fixture = await startFixtureProvider(reply, true);
  let connectionId: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const response = await request.post("/api/connections", {
      data: {
        name: "Streaming quick answer",
        provider: "custom",
        baseUrl: fixture.baseUrl,
        apiKey: "fixture",
        model: "fixture",
      },
    });
    expect(response.ok()).toBeTruthy();
    connectionId = ((await response.json()) as { id: string }).id;
    await prepareClient(page, connectionId);
    // Count actual dialog renders in the development fixture, including renders
    // whose DOM output is identical. No timing threshold depends on host speed.
    await page.route("**/src/components/layout/GlobalOmnibar.tsx", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const declaration = "function GlobalOmnibarDialog({ onClose }) {";
      expect(source).toContain(declaration);
      await route.fulfill({
        response,
        body: source.replace(declaration, `${declaration}\nwindow.__quickRenders = (window.__quickRenders ?? 0) + 1;`),
      });
    });
    await page.route("**/src/components/layout/omnibar/use-omnibar-screen-context.ts", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const build = "return createOmnibarContext({";
      expect(source).toContain(build);
      await route.fulfill({
        response,
        body: source.replace(build, `window.__quickContextBuilds = (window.__quickContextBuilds ?? 0) + 1;\n${build}`),
      });
    });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+k");
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill(QUESTION);
    const aside = omnibar.locator('[data-component="GlobalOmnibar.Aside"]');
    await expect(aside).toContainText("Raise", { timeout: 15_000 });
    const instrumentation = await page.evaluate(() => ({
      renders: (window as typeof window & { __quickRenders: number }).__quickRenders,
      contextBuilds: (window as typeof window & { __quickContextBuilds: number }).__quickContextBuilds,
    }));
    expect(instrumentation.renders).toBeGreaterThan(0);
    expect(instrumentation.contextBuilds).toBeGreaterThan(0);
    await page.evaluate(() => {
      const counters = window as typeof window & {
        __quickRenders: number;
        __quickFrames: number;
        __quickCounting: boolean;
        __quickContextBuilds: number;
      };
      counters.__quickRenders = 0;
      counters.__quickFrames = 0;
      counters.__quickCounting = true;
      counters.__quickContextBuilds = 0;
      const frame = () => {
        if (!counters.__quickCounting) return;
        counters.__quickFrames++;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await expect(aside.getByRole("button", { name: "Answer again" })).toBeEnabled();
    await expect(aside).toContainText(reply.replace(/\*\*/g, "").trim());
    const counts = await page.evaluate(() => {
      const counters = window as typeof window & {
        __quickRenders: number;
        __quickFrames: number;
        __quickCounting: boolean;
        __quickContextBuilds: number;
      };
      counters.__quickCounting = false;
      return {
        renders: counters.__quickRenders,
        frames: counters.__quickFrames,
        contextBuilds: counters.__quickContextBuilds,
      };
    });
    console.log("Quick answer frame budget", counts);
    // StrictMode calls each render twice in the development browser fixture.
    expect.soft(counts.renders).toBeLessThanOrEqual(counts.frames * 2 + 12);
    expect.soft(counts.contextBuilds).toBe(0);
    const askRow = omnibar.locator('[data-result-id="ask-professor-mari"]').getByRole("button").first();
    await askRow.hover();
    const box = await askRow.boundingBox();
    expect(box).not.toBeNull();
    const beforeHover = await page.evaluate(
      () => (window as typeof window & { __quickRenders: number }).__quickRenders,
    );
    await page.mouse.move(box!.x + box!.width / 2 + 10, box!.y + box!.height / 2, { steps: 20 });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    const afterHover = await page.evaluate(() => (window as typeof window & { __quickRenders: number }).__quickRenders);
    console.log("Selected-row hover renders", afterHover - beforeHover);
    expect.soft(afterHover - beforeHover).toBeLessThanOrEqual(2);
    await askRow.click();
    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toContainText("Raise", { timeout: 20_000 });
    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toContainText(
      "I can help with your reply length.",
    );
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: testInfo.outputPath(`quick-row-${width}.png`) });
    }
    await page.keyboard.press("Control+j");
    await expect(omnibar.getByRole("searchbox", { name: "Search Marinara" })).toBeVisible();
    const cancelledBeforeRetry = fixture.cancelledStreams;
    await aside.getByRole("button", { name: "Answer again" }).click();
    await expect(aside).toContainText("Raise");
    await expect(aside.getByRole("button", { name: "Answer again", includeHidden: true })).toBeDisabled();
    await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("dark mode");
    await expect(aside).toHaveCount(0);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await expect(aside).toHaveCount(0);
    await expect.poll(() => fixture.cancelledStreams).toBeGreaterThan(cancelledBeforeRetry);
    await expect(omnibar).toContainText("Dark");
    expect(errors).toEqual([]);
  } finally {
    if (connectionId) await request.delete(`/api/connections/${connectionId}`);
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
  }
});

test.afterEach(() => {
  releaseMariThreadLock();
});

test("Continue with Mari on a quick answer opens a new Mari chat named after the question", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard shortcut is covered on desktop.");

  const fixture = await startFixtureProvider("Raise **Max Tokens** in Chat Settings.");
  let connectionId: string | undefined;
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: `Quick handoff fixture ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: fixture.baseUrl,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;

    await prepareClient(page, connectionId);
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+k");

    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill(QUESTION);
    const aside = omnibar.locator('[data-component="GlobalOmnibar.Aside"]');
    await expect(aside).toContainText("Raise", { timeout: 15_000 });
    await aside.getByRole("button", { name: "Continue with Prof. Mari" }).click();

    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
    const chats = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
      name: string;
    }>;
    expect(chats.map((chat) => chat.name)).toContain(QUESTION);
  } finally {
    // A later spec on the same server (omnibar-no-model-try) needs no connection.
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
  }
});
