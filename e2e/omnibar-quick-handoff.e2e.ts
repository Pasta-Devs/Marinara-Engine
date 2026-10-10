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

async function startFixtureProvider(reply: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((incoming, response) => {
    incoming.on("data", () => undefined);
    incoming.on("end", () => {
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: reply }, finish_reason: null }] })}`,
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1` };
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
