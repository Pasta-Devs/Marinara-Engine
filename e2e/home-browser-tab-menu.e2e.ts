import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

// Enough experiences to overflow a phone's tab row, like a user with every experience installed.
const EXPERIENCES = [
  ["menu-gacha", "Gacha Forge"],
  ["noodle", "Noodle"],
  ["menu-ramen", "Ramen Shop"],
  ["menu-bow", "Bow Studio"],
  ["menu-sparkle", "Sparkle"],
  ["menu-garden", "Garden"],
  ["menu-observatory", "Observatory"],
  ["menu-story", "Story Writer"],
] as const;

const fixtureClient = (id: string) => `
customElements.define('marinara-capability-${id}', class extends HTMLElement {
  connectedCallback() { this.textContent = 'Fixture ${id}'; }
});`;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.removeItem("marinara:home:noodle-refresh-seen:v1");
  }, appVersion);
  // A Noodle refresh the user has not seen yet: its badge must survive the fold.
  await page.route("**/api/noodle/refresh-indicator", (route) =>
    route.fulfill({ json: { marker: "refresh-fixture:2026-10-26T09:00:00.000Z" } }),
  );
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({
      json: EXPERIENCES.map(([id, label]) => ({
        id,
        version: "1.0.0",
        status: "active",
        readiness: "ready",
        legacy: false,
        manifest: {
          schemaVersion: 1,
          id,
          name: label,
          version: "1.0.0",
          engine: { min: "2.5.1", maxExclusive: "4.0.0" },
          kind: ["agent"],
          entrypoints: { client: "client.js" },
          contributions: { slots: ["home-browser-tab"], homeBrowserTab: { label } },
          files: [],
          permissions: ["ui"],
          restartRequired: true,
        },
      })),
    }),
  );
  await page.route(/\/api\/capability-packages\/(menu-[a-z]+|noodle)\/client\?/u, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: fixtureClient(new URL(route.request().url()).pathname.split("/")[3]!),
    }),
  );
});

async function tabRow(page: Page) {
  const tablist = page.getByRole("tablist", { name: "Home destinations" });
  const trigger = page.getByRole("button", { name: "Show all experiences" });
  const fit = await tablist.evaluate((list) => ({
    overflow: list.scrollWidth - list.clientWidth,
    triggerInside: Boolean(list.querySelector('[data-component="HomeBrowserHub.TabMenuTrigger"]')),
  }));
  return { tablist, trigger, ...fit };
}

test("tabs that do not fit fold into a menu, and Home stays a tab", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  // A phone held upright, or a narrow desktop window: the row cannot hold every tab.
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 900, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Home" })).toHaveAttribute("aria-selected", "true");

  // Measure only once the installed experiences have rendered and folded.
  await expect(page.getByRole("button", { name: "Show all experiences" })).toBeVisible();
  let row = await tabRow(page);
  await expect(row.tablist.getByRole("tab")).toHaveCount(1);
  expect(row.overflow).toBeLessThanOrEqual(1);
  expect(row.triggerInside).toBe(false);
  await expect(row.trigger).toHaveAccessibleDescription("1 new timeline refresh");
  await page.screenshot({ path: testInfo.outputPath("01-folded-home.png") });

  await row.trigger.click();
  await expect(row.trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator('[data-component="HomeBrowserHub.TabMenu"]');
  await expect(menu.getByRole("button")).toContainText(["Professor", ...EXPERIENCES.map(([, label]) => label)]);
  await expect(menu.getByRole("button", { name: "Noodle 1 new timeline refresh" })).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("02-menu-open.png") });

  await menu.getByRole("button", { name: "Story Writer" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Story Writer" })).toHaveAttribute("aria-selected", "true");
  // The picked entry is gone with the menu; focus lands on the tab it opened, not on the page.
  await expect(page.getByRole("tab", { name: "Story Writer" })).toBeFocused();
  await expect(page.locator("marinara-capability-menu-story")).toBeVisible();
  // The open experience keeps its tab beside Home, so the row says where you are.
  row = await tabRow(page);
  await expect(row.tablist.getByRole("tab")).toHaveCount(2);
  await expect(row.tablist.getByRole("tab", { name: "Home" })).toBeVisible();
  await expect(row.tablist.getByRole("tab", { name: "Story Writer" })).toBeVisible();
  expect(row.overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("03-story-writer-open.png") });

  await row.trigger.click();
  await expect(menu.getByRole("button", { name: "Story Writer" })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await page.getByRole("tab", { name: "Home" }).click();
  await expect(page.getByRole("tab", { name: "Home" })).toHaveAttribute("aria-selected", "true");
  await expect(row.tablist.getByRole("tab")).toHaveCount(1);

  // Room for every tab (a phone turned sideways, a wide window): the full row returns and the menu goes.
  await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1920, height: 1000 });
  await expect(row.trigger).toHaveCount(0);
  await expect(row.tablist.getByRole("tab")).toHaveCount(2 + EXPERIENCES.length);
  row = await tabRow(page);
  expect(row.overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("04-all-tabs-fit.png") });

  // And folds again once the room is gone.
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 900, height: 800 });
  await expect(row.trigger).toBeVisible();
  await expect(row.tablist.getByRole("tab")).toHaveCount(1);
});

test("the tab menu opens under the tab row, alone, and keeps keyboard focus", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 900, height: 800 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Show all experiences" });
  const menu = page.locator('[data-component="HomeBrowserHub.TabMenu"]');
  await expect(trigger).toBeVisible();

  // The entries follow their trigger in keyboard order, and the menu hangs right under the tab row
  // (on desktop, above the address and bookmark rows).
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.waitForTimeout(250);
  const rowBox = (await page.locator(".mari-home-browser-tab-row").boundingBox())!;
  const menuGap = (await menu.boundingBox())!.y - (rowBox.y + rowBox.height);
  expect(menuGap).toBeGreaterThanOrEqual(0);
  expect(menuGap).toBeLessThanOrEqual(10);
  expect(await trigger.evaluate((button) => button.nextElementSibling?.getAttribute("data-component"))).toBe(
    "HomeBrowserHub.TabMenu",
  );
  await menu.getByRole("button", { name: "Professor" }).focus();
  await page.screenshot({ path: testInfo.outputPath("05-menu-under-row.png") });

  // Escape from an entry hands focus back to the trigger.
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Picking an entry with the keyboard focuses the tab it opened.
  await page.keyboard.press("Enter");
  await menu.getByRole("button", { name: "Garden" }).focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Garden" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Garden" })).toBeFocused();

  if (mobile) {
    // A phone's Home has both header menus; opening one closes the other.
    await page.getByRole("tab", { name: "Home" }).click();
    const bookmarksTrigger = page.getByRole("button", { name: "Open bookmarks", exact: true });
    const bookmarks = page.locator('[data-component="HomeBrowserHub.MobileBookmarksMenu"]');
    await bookmarksTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(bookmarks).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(bookmarks).toHaveCount(0);
    await bookmarksTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(bookmarks).toBeVisible();
    await expect(menu).toHaveCount(0);
  }
});
