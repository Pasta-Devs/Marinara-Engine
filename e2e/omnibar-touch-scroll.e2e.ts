import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * User report: after a tapped Search result opened a record, Search could not be scrolled by touch the next
 * time it opened. Real touches go through CDP, so the browser's own touch scrolling runs: open by the
 * pull-down, scroll, tap a character, reopen, scroll again, and the page behind still scrolls after close.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function touchInput(cdp: CDPSession) {
  const send = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  return {
    async swipe(x: number, fromY: number, toY: number, steps = 12) {
      await send("touchStart", x, fromY);
      for (let step = 1; step <= steps; step += 1) {
        await send("touchMove", x, fromY + ((toY - fromY) * step) / steps);
        await sleep(16);
      }
      await send("touchEnd", x, toY);
    },
    async tap(x: number, y: number) {
      await send("touchStart", x, y);
      await sleep(60);
      await send("touchEnd", x, y);
    },
  };
}

async function openByPull(page: Page, touch: ReturnType<typeof touchInput>) {
  const bar = (await page.locator('[data-component="TopBar"]').boundingBox())!;
  const y = bar.y + bar.height / 2;
  await touch.swipe(bar.x + bar.width * 0.25, y, y + 300, 20);
  await expect(page.locator('[data-component="GlobalOmnibar"]')).toBeVisible();
}

/** Swipes up over the result list and returns how far it scrolled. */
async function swipeResults(page: Page, touch: ReturnType<typeof touchInput>) {
  const list = page.locator('[data-component="GlobalOmnibar.Results"]');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const box = (await list.boundingBox())!;
  const before = await list.evaluate((node) => node.scrollTop);
  await touch.swipe(box.x + box.width / 2, box.y + box.height * 0.8, box.y + box.height * 0.2);
  await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(before + 20);
}

test("Search still scrolls by touch after a tapped result opened a record", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "real touch scrolling goes through Chromium's CDP");
  const ids: string[] = [];
  for (let index = 0; index < 24; index += 1) {
    const created = await request.post("/api/characters", {
      data: { data: { name: `Touch Scroll ${String(index).padStart(2, "0")}`, description: "A row to scroll past." } },
    });
    expect(created.ok()).toBeTruthy();
    ids.push(((await created.json()) as { id: string }).id);
  }
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.goto("/");
    const touch = touchInput(await page.context().newCDPSession(page));
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    const search = omnibar.getByRole("searchbox", { name: "Search Marinara" });

    await openByPull(page, touch);
    await search.fill("touch scroll");
    await expect(omnibar.locator('[data-result-id^="character:"]')).toHaveCount(24);
    await swipeResults(page, touch);

    // Tap a character row in view: Search closes and the character opens.
    const list = (await omnibar.locator('[data-component="GlobalOmnibar.Results"]').boundingBox())!;
    await touch.tap(list.x + 120, list.y + list.height / 2);
    await expect(omnibar).toBeHidden();

    await openByPull(page, touch);
    await search.fill("touch scroll");
    await expect(omnibar.locator('[data-result-id^="character:"]')).toHaveCount(24);
    await swipeResults(page, touch);

    // Closed again, the page behind still scrolls by touch.
    const close = (await omnibar.getByRole("button", { name: "Close", exact: true }).boundingBox())!;
    await touch.tap(close.x + close.width / 2, close.y + close.height / 2);
    await expect(omnibar).toBeHidden();
    const scroller = await page.evaluateHandle(
      () =>
        [...document.querySelectorAll<HTMLElement>("*")].find((node) => {
          const style = getComputedStyle(node);
          return (
            /(auto|scroll)/u.test(style.overflowY) &&
            node.scrollHeight > node.clientHeight + 80 &&
            node.getBoundingClientRect().height > 200
          );
        }) ?? null,
    );
    const element = scroller.asElement();
    if (element) {
      const box = (await element.boundingBox())!;
      const before = await element.evaluate((node) => node.scrollTop);
      await touch.swipe(box.x + box.width / 2, box.y + box.height * 0.8, box.y + box.height * 0.3);
      await expect.poll(() => element.evaluate((node) => node.scrollTop)).toBeGreaterThan(before + 20);
    }
  } finally {
    await Promise.all(ids.map((id) => request.delete(`/api/characters/${id}`).catch(() => undefined)));
  }
});
