import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Round 9 UX-02: after Mari's pane opens, keyboard focus sits in her window. Before, the search pane hid the
 * focused field and focus fell to <body>, so Escape never reached the omnibar and nothing closed.
 */
test.beforeEach(async () => {
  await acquireMariThreadLock();
});

test.afterEach(() => {
  releaseMariThreadLock();
});

test("desktop: opening Mari focuses her window, and Escape from the page goes back", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard focus contract is a desktop concern.");

  const connection = await request.post("/api/connections", {
    data: {
      name: `Focus keyboard fixture ${Date.now().toString(36)}`,
      provider: "custom",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "fixture",
      model: "fixture",
      maxContext: 65536,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = ((await connection.json()) as { id: string }).id;
  // The connection is removed again: a later spec on the same server (omnibar-no-model-try) needs none.
  try {
    const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    expect(mariChat.ok()).toBeTruthy();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, { hasCompletedOnboarding: true });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");

    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(mariPane).toHaveAttribute("aria-hidden", "false");
    const focusInMari = () =>
      page.evaluate(() => !!document.activeElement?.closest('[data-component="GlobalOmnibar.Mari"]'));
    await expect.poll(focusInMari).toBe(true);

    // Focus lost to the page (as after a card action removes its button): Escape still leaves her window.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Escape");
    await expect(mariPane).toHaveAttribute("aria-hidden", "true");
  } finally {
    await request.delete(`/api/connections/${connectionId}`);
  }
});
