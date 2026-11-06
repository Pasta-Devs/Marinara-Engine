import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const tags = Array.from({ length: 120 }, (_, index) => `scroll-tag-${String(index).padStart(3, "0")}`);
const wyvernTags = tags.map((tag) => tag.replace("scroll-tag", "wyvern-tag"));

for (const theme of ["dark", "light"] as const) {
  test(`tag picker preserves selection and scroll after reopening in ${theme} mode`, async ({ page }, info) => {
    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentPulseMode: false,
      theme,
    });
    await page.addInitScript((version) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-bot-browser", JSON.stringify({ nsfw: {}, logins: {}, lastSource: "chub" }));
    }, version);
    await page.route("**/api/bot-browser/**", (route) => route.fulfill({ status: 404, json: {} }));
    await page.route("**/api/bot-browser/chub/search?*", (route) =>
      route.fulfill({
        json: {
          data: {
            count: 1,
            nodes: [{ fullPath: "fixture/tag-scroll", name: "Tag scroll fixture", topics: tags, nTokens: 80 }],
          },
        },
      }),
    );
    await page.route("**/api/bot-browser/wyvern/search?*", (route) =>
      route.fulfill({
        json: { results: [{ id: "tag-scroll", name: "Wyvern tag fixture", tags: wyvernTags }], total: 1 },
      }),
    );
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openBotBrowser();
    });
    const browser = page.locator('[data-component="BotBrowserView"]');
    const toggle = browser.getByRole("button", { name: /^Tags(?:\s+\d+)?$/u });
    await toggle.click();
    const search = browser.getByPlaceholder("Search tags", { exact: true });
    const panel = search.locator("xpath=../..");
    const list = panel.locator(":scope > .overflow-y-auto");
    await expect(list.getByText(tags[119]!, { exact: true })).toBeAttached();
    await list.getByText(tags[60]!, { exact: true }).scrollIntoViewIfNeeded();
    await list.getByText(tags[60]!, { exact: true }).locator("..").getByRole("button").first().click();
    await expect(panel.getByText(`+ ${tags[60]}`, { exact: true })).toBeVisible();
    const savedPosition = await list.evaluate((element) => element.scrollTop);
    expect(savedPosition).toBeGreaterThan(500);
    await page.screenshot({ path: info.outputPath("tag-picker-before-close.png") });

    // Both close paths must preserve the same browsing position and selected filter.
    for (const closeWithHeader of [true, false]) {
      if (closeWithHeader) await panel.locator(":scope > div").first().getByRole("button").last().click();
      else await toggle.click();
      await expect(search).toBeHidden();
      await expect(browser.getByRole("button", { name: "Tags 1", exact: true })).toBeVisible();
      await toggle.click();
      await expect(search).toBeVisible();
      await expect(panel.getByText(`+ ${tags[60]}`, { exact: true })).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`tag-picker-reopened-${closeWithHeader ? "header" : "toggle"}.png`),
      });
      await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(savedPosition);
    }

    // A real filter change must still work after the preserved panel is reopened.
    await search.fill(tags[119]!);
    await expect(list.locator("span").filter({ hasText: tags[119]! })).toBeVisible();
    await expect(list.getByText(tags[60]!, { exact: true })).toHaveCount(0);
    await search.clear();
    await expect(list.getByText(tags[60]!, { exact: true })).toBeAttached();

    // A different provider has a different tag list, so it must start at the top.
    await list.getByText(tags[60]!, { exact: true }).scrollIntoViewIfNeeded();
    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
    await browser.getByRole("button", { name: /ChubAI/u }).click();
    await page.getByRole("button", { name: /Wyvern/u }).click();
    await expect(search).toBeHidden();
    // Let the replacement tags arrive while hidden: laying out an empty visible list would mask the bug.
    await expect(list.getByText(wyvernTags[119]!, { exact: true })).toBeAttached();
    await expect(browser.getByRole("button", { name: "Tags", exact: true })).toBeVisible();
    await toggle.click();
    await expect(search).toBeVisible();
    await expect(panel.getByText(`+ ${tags[60]}`, { exact: true })).toHaveCount(0);
    await expect(list.getByText(tags[60]!, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("tag-picker-after-provider-switch.png") });
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
  });
}
