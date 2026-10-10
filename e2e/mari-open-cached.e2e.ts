import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const TURNS = 24;
const NEWEST = `Last line of step ${TURNS - 1}.`;
const MESSAGES = /\/api\/chats\/[^/]+\/messages\?limit=80$/;

/**
 * Opening Professor Mari's long chat was slower than staging: the omnibar unmounts her pane on close,
 * so each open fetched and rendered the thread from nothing, and her messages waited for the arrival
 * routing's Chats list. A reopen now draws the thread she showed last at once (the fetch only refreshes
 * it), the first open fetches her messages beside the routing, and she lands on the newest turn even
 * when the older turns (skipped off screen) are much taller than their estimate.
 */
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

async function closeOmnibar(page: Page) {
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  for (let i = 0; i < 4 && (await omnibar.count()) > 0; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  await expect(omnibar).toHaveCount(0);
}

test("a long Mari chat opens at its newest turn and reopens at once", async ({ page, request }) => {
  test.setTimeout(90_000);
  const restart = await request.post("/api/chats/internal/professor-mari/restart?name=Long%20replies");
  expect(restart.ok(), await restart.text()).toBeTruthy();
  const chatId = ((await restart.json()) as { id: string }).id;
  try {
    const t0 = Date.parse("2026-09-01T10:00:00Z");
    for (let i = 0; i < TURNS; i += 1) {
      const user = await request.post(`/api/chats/${chatId}/messages`, {
        data: {
          role: "user",
          content: `Improve character ${i}.`,
          characterId: null,
          createdAt: new Date(t0 + i * 60_000).toISOString(),
        },
      });
      expect(user.ok(), await user.text()).toBeTruthy();
      // Replies far taller than the 8rem estimate an older turn has while it is skipped off screen.
      const body = Array.from(
        { length: 10 },
        (_, k) => `Paragraph ${k} of step ${i}: a clearer voice and a tighter scenario.`,
      );
      const reply = await request.post(`/api/chats/${chatId}/messages`, {
        data: {
          role: "assistant",
          content: [...body, `Last line of step ${i}.`].join("\n\n"),
          characterId: "professor-mari",
          createdAt: new Date(t0 + i * 60_000 + 30_000).toISOString(),
        },
      });
      expect(reply.ok(), await reply.text()).toBeTruthy();
    }

    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });

    // First open: her messages load beside the routing's Chats list, not after it.
    let messagesRequestedAt = 0;
    let chatsListAnsweredAt = 0;
    page.on("request", (req) => {
      if (MESSAGES.test(req.url()) && !messagesRequestedAt) messagesRequestedAt = Date.now();
    });
    await page.route("**/api/chats/internal/professor-mari/chats", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
      chatsListAnsweredAt = Date.now();
    });
    await page.keyboard.press("Control+j");
    const pane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(pane.getByText(NEWEST)).toBeInViewport({ timeout: 20_000 });
    expect(messagesRequestedAt, "the messages were requested").toBeGreaterThan(0);
    expect(messagesRequestedAt, "the messages did not wait for the Chats list").toBeLessThan(chatsListAnsweredAt);
    await page.unroute("**/api/chats/internal/professor-mari/chats");
    // Still at the newest turn once the older turns near the bottom took their real height.
    await page.waitForTimeout(600);
    await expect(pane.getByText(NEWEST)).toBeInViewport();

    // Reopen: the cached thread draws at once; the refresh is held back and is not needed to show it.
    await closeOmnibar(page);
    await page.route(MESSAGES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await route.continue().catch(() => undefined);
    });
    await page.keyboard.press("Control+j");
    await expect(pane.getByText(NEWEST)).toBeInViewport({ timeout: 2_500 });
    await expect(pane.locator('.mari-transcript-stack[data-history="loading"]')).toHaveCount(0);
    // No skeleton to cross-fade from, so the cached thread does not fade in again.
    await expect(pane.locator(".mari-transcript-stack")).not.toHaveAttribute("data-arrive", /.*/);
    await page.unroute(MESSAGES);
  } finally {
    await request.delete(`/api/chats/internal/professor-mari/chats/${chatId}`).catch(() => undefined);
  }
});
