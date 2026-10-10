import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Round 9 UX-05: with no model connected, the "How do I connect a model?" Try text must keep the
 * "No model connected yet" row first. Before, the docs search ranked Decision Models above the
 * connection guide and that row vanished as soon as the text was typed.
 */
test("desktop: the no-model Try text keeps the Set up row first", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The omnibar Try row is a desktop keyboard flow here.");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, { hasCompletedOnboarding: true });
  await page.goto("/");
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");

  const search = page.locator('[data-component="GlobalOmnibar"] input').first();
  await search.fill("How do I connect a model?");
  await expect(page.locator('[data-result-id="now:setup-connection"]').first()).toBeVisible();
  await expect(page.locator("[data-command-center-result-row]").first()).toHaveAttribute(
    "data-result-id",
    "now:setup-connection",
  );
});
