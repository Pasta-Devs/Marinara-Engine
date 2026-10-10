import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Slice 83 (item 6): Mari's top-bar pill ("Done", "Failed") and the run timer live on the server, so a
 * reload keeps them. The pill clears only when her window shows that run (the seen marker). A scripted
 * fake model runs the real workspace loop; each round can hold its answer, or fail with an HTTP error.
 */
type FixtureRound = { delayMs: number; status?: number; action?: Record<string, unknown> };

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

async function startFixtureProvider(rounds: FixtureRound[]) {
  const queue = [...rounds];
  const provider: Server = createServer((incoming, response) => {
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
      return;
    }
    incoming.resume();
    const round = queue.shift() ?? { delayMs: 0, action: { say: "Done.", commands: [], stop: true } };
    setTimeout(() => {
      if (round.status) {
        response.writeHead(round.status, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "fixture failure" } }));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(round.action) }, finish_reason: null }] })}`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    }, round.delayMs);
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
  return { provider, url: `http://127.0.0.1:${address.port}/v1` };
}

async function openMari(page: Page, request: APIRequestContext, url: string) {
  const connection = await request.post("/api/connections", {
    data: {
      name: `Run pill fixture ${Date.now().toString(36)}`,
      provider: "custom",
      baseUrl: url,
      apiKey: "fixture",
      model: "fixture",
      maxContext: 65536,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = ((await connection.json()) as { id: string }).id;
  const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
  expect(mariChat.ok(), await mariChat.text()).toBeTruthy();
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    reduceAmbientEffects: true,
  });
  return connectionId;
}

async function bootAndOpenMari(page: Page) {
  await page.goto("/");
  // The shortcut is ignored until the app has booted; wait for Home before pressing it.
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible({ timeout: 30_000 });
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+j");
  await expect(page.locator('[data-component="GlobalOmnibar.Mari"]').locator("textarea:visible")).toBeVisible();
}

async function closeMari(page: Page) {
  await page
    .locator('[data-component="GlobalOmnibar"]')
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
  await expect(page.locator('[data-component="GlobalOmnibar"]')).toBeHidden();
}

const pill = (page: Page) => page.locator('[data-component="TopBar.MariStatus"]');

test("Done stays across a reload until Mari opens that run", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "One pill run on desktop is enough proof.");
  test.setTimeout(120_000);
  const { provider, url } = await startFixtureProvider([
    { delayMs: 4_000, action: { say: "Here is your answer.", commands: [], stop: true } },
  ]);
  let connectionId = "";
  try {
    connectionId = await openMari(page, request, url);
    await bootAndOpenMari(page);
    await page.locator('[data-component="GlobalOmnibar.Mari"]').locator("textarea:visible").fill("Say hello");
    await page.keyboard.press("Control+Enter");
    // Close her window while the run is still going, so the result is one nobody has seen.
    await expect(page.locator('.mari-work-timeline[data-active="true"]')).toBeVisible();
    await closeMari(page);
    await expect(pill(page)).toHaveAttribute("data-state", "finished", { timeout: 60_000 });

    await page.reload();
    await expect(pill(page)).toHaveAttribute("data-state", "finished", { timeout: 30_000 });

    // Opening her window on the run marks it seen; the pill clears and stays clear after a reload.
    await page.locator('[data-component="TopBar.MariStatus"]').click();
    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]').locator("textarea:visible")).toBeVisible();
    await expect(page.getByText("Here is your answer.")).toBeVisible();
    await closeMari(page);
    await expect(pill(page)).toHaveCount(0);
    await page.reload();
    await expect(pill(page)).toHaveCount(0, { timeout: 30_000 });
  } finally {
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    provider.close();
  }
});

test("Failed stays across a reload until Mari opens that run", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "One pill run on desktop is enough proof.");
  test.setTimeout(120_000);
  const { provider, url } = await startFixtureProvider([{ delayMs: 3_000, status: 400 }]);
  let connectionId = "";
  try {
    connectionId = await openMari(page, request, url);
    await bootAndOpenMari(page);
    await page.locator('[data-component="GlobalOmnibar.Mari"]').locator("textarea:visible").fill("Fail please");
    await page.keyboard.press("Control+Enter");
    await closeMari(page);
    await expect(pill(page)).toHaveAttribute("data-state", "error", { timeout: 60_000 });

    await page.reload();
    await expect(pill(page)).toHaveAttribute("data-state", "error", { timeout: 30_000 });

    await pill(page).click();
    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]').locator("textarea:visible")).toBeVisible();
    await closeMari(page);
    await expect(pill(page)).toHaveCount(0);
    await page.reload();
    await expect(pill(page)).toHaveCount(0, { timeout: 30_000 });
  } finally {
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    provider.close();
  }
});

test("the live timer resumes from the run's start after a reload", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "One live run on desktop is enough proof.");
  test.setTimeout(120_000);
  const { provider, url } = await startFixtureProvider([
    { delayMs: 25_000, action: { say: "Finished at last.", commands: [], stop: true } },
  ]);
  let connectionId = "";
  try {
    connectionId = await openMari(page, request, url);
    await bootAndOpenMari(page);
    await page.locator('[data-component="GlobalOmnibar.Mari"]').locator("textarea:visible").fill("Take your time");
    await page.keyboard.press("Control+Enter");
    await expect(page.locator('.mari-work-timeline[data-active="true"]')).toBeVisible();
    // Let the run age for a few seconds before the reload, so a restarted timer would read near zero.
    await page.waitForTimeout(4_000);

    await page.reload();
    await bootAndOpenMari(page);
    const elapsed = page.getByLabel(/s elapsed$/);
    await expect(elapsed.first()).toBeVisible({ timeout: 20_000 });
    const label = (await elapsed.first().getAttribute("aria-label")) ?? "0s elapsed";
    const seconds = Number.parseInt(label, 10);
    expect(seconds, `timer after reload reads "${label}"`).toBeGreaterThanOrEqual(3);
  } finally {
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    provider.close();
  }
});
