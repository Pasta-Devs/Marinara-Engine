import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    localStorage.setItem(
      "marinara:home:widget-visibility:v2",
      JSON.stringify(["professor", "character", "whats-new", "learn", "community", "clock", "discovery"]),
    );
  }, version);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
});

// Slice 85: press and hold the Home Mari widget to lift her, drag her, and let her spring home.
async function holdWidgetAndDrag(page: Page) {
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  const box = await art.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY - 30, { steps: 6 });
  const figure = page.locator(".mari-hold-figure");
  await expect(figure).toBeVisible();
  await expect(figure.locator(".mari-hold-figure__line")).toHaveText("W-What are you doing? Put me down! (˶>⩊<˶)");
  await expect(art).toHaveCSS("opacity", "0");
  return { figure, art, startX, startY };
}

test("pressing and dragging the Home Mari widget lifts her, then she springs back to her slot", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const { figure, art, startX, startY } = await holdWidgetAndDrag(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath(`mari-hold-held-${testInfo.project.name}.png`) });
  await page.mouse.up();
  await expect(figure).toBeHidden({ timeout: 3_000 });
  await expect(art).toHaveCSS("opacity", "1");
  const back = await art.boundingBox();
  expect(back).not.toBeNull();
  expect(Math.abs(back!.x + back!.width / 2 - startX)).toBeLessThan(40);
  expect(Math.abs(back!.y + back!.height / 2 - startY)).toBeLessThan(260);
});

test("a tap on the Home Mari widget keeps the normal action and never lifts her", async ({ page }) => {
  await page.goto("/");
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  await art.click();
  await expect(page.locator(".mari-hold-figure")).toHaveCount(0);
});

test("a tap on the omnibar door opens Mari and never lifts her", async ({ page, isMobile }) => {
  // The address row is desktop-only; a phone opens Search from the top bar.
  test.skip(isMobile, "desktop address row opens the omnibar");
  await page.goto("/");
  await page.locator('[data-component="HomeBrowserHub.Address"]').click();
  const door = page.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
  await expect(door).toBeVisible({ timeout: 30_000 });
  await door.click();
  await expect(page.locator(".mari-hold-figure")).toHaveCount(0);
});

test("with reduced motion a hold only bounces her in place and shows her line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  const box = (await art.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 30, { steps: 6 });
  await expect(page.locator(".mari-hold-figure__line")).toHaveText("W-What are you doing? Put me down! (˶>⩊<˶)");
  await expect(page.locator(".mari-hold-figure__sprite")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toBeHidden();
});

test("after a drag that ends away from her head, Enter on the door still opens Mari", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop address row opens the omnibar");
  await page.goto("/");
  await page.locator('[data-component="HomeBrowserHub.Address"]').click();
  const door = page.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
  await expect(door).toBeVisible({ timeout: 30_000 });
  const box = (await door.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(120, 600, { steps: 10 });
  await expect(page.locator(".mari-hold-figure")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".mari-hold-figure")).toBeHidden({ timeout: 3_000 });
  await door.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
});
