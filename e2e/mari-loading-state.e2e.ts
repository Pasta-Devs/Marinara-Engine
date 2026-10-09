import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const PROOF_DIR = fileURLToPath(new URL("../.tmp/omnibar-ux/round9/slice-83/", import.meta.url));

/**
 * Slice 83 (item 7): while Professor Mari's chat loads she shows a calm skeleton: her sprite, soft rows,
 * and nothing before ~150 ms. The probe holds her chat request open so the loading state stays on screen.
 */
async function openMariWithSlowLoad(page: Page, theme: "dark" | "light", width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    theme,
  });
  await page.route("**/api/chats/internal/professor-mari**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });
  await page.goto("/");
  // The shortcut is ignored until the app has booted; wait for Home before pressing it.
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible({ timeout: 30_000 });
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+j");
}

for (const [theme, width, height] of [
  ["dark", 1440, 900],
  ["light", 1440, 900],
  ["dark", 390, 844],
  ["light", 390, 844],
] as const) {
  test(`Mari's loading state is a calm skeleton after a short delay (${theme}, ${width})`, async ({ page }) => {
    await openMariWithSlowLoad(page, theme, width, height);
    const loading = page.locator(".mari-loading");
    await expect(loading).toBeVisible({ timeout: 5_000 });
    await expect(loading.locator(".mari-story-sprite")).toBeVisible();
    await expect(loading.locator(".mari-loading__row")).toHaveCount(3);
    // Held back by CSS for 150 ms, so a fast load never flashes it.
    expect(await loading.evaluate((element) => getComputedStyle(element).animationDelay)).toBe("0.15s");
    expect(await loading.evaluate((element) => getComputedStyle(element).animationName)).toBe("mari-loading-reveal");
    mkdirSync(PROOF_DIR, { recursive: true });
    await page.screenshot({ path: `${PROOF_DIR}loading-${theme}-${width}.png` });
  });
}

test("the loading state stays still under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMariWithSlowLoad(page, "light", 390, 844);
  const loading = page.locator(".mari-loading");
  await expect(loading).toBeVisible({ timeout: 5_000 });
  expect(await loading.evaluate((element) => getComputedStyle(element).animationName)).toBe("mari-loading-visibility");
  expect(
    await loading
      .locator(".mari-loading__row")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.screenshot({ path: `${PROOF_DIR}loading-reduced-motion-390.png` });
});
