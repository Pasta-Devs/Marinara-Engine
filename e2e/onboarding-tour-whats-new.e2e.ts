import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Round 9 UX-34: the tour ends straight into What's New. A new user who finishes the tour has just met this
 * release, so the release notes must not open right after it.
 */
const SHOT_DIR = new URL("../.tmp/omnibar-ux/round10/shots/", import.meta.url);

test("UX-34: finishing the tour does not open What's New straight after", async ({ page }, testInfo) => {
  const width = testInfo.project.name.includes("mobile") ? 390 : 1440;
  await page.setViewportSize(width === 390 ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await seedUIState(page, { hasCompletedOnboarding: false, rightPanelOpen: false, sidebarOpen: false });
  await page.goto("/");

  const tour = page.locator('[data-component="OnboardingTutorial.Card"]');
  await expect(tour).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);

  // The tour marked this release as seen, so What's New stays closed.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("marinara:whats-new:seen-version")))
    .toBe(APP_VERSION);
  await expect(page.getByRole("dialog", { name: /What's New|updated/i })).toHaveCount(0);
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: new URL(`UX-34-${width}.png`, SHOT_DIR).pathname });
});
