import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

test("Golden (once unlocked) and Safari Prof. Mari are selectable and survive reload", async ({ page }, testInfo) => {
  const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      // R12: Golden needs 100 h of play time; this test is about selection, so it starts unlocked.
      mariUnlockedPackIds: ["golden"],
    },
    "if-missing",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (/\/sprites\/mari\/(golden|safari)\//.test(response.url()) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto("/");
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  const packs = omnibar.getByRole("radiogroup", { name: "Professor Mari appearance" });
  await expect(packs.getByRole("radio")).toHaveCount(4);
  const golden = packs.getByRole("radio", { name: /^Golden Prof\. Mari/ });
  await expect(golden).toBeEnabled();
  await packs.locator('label[data-pack="golden"]').click();
  await expect(golden).toBeChecked();
  const safari = packs.getByRole("radio", { name: /^Safari Prof\. Mari/ });
  await expect(safari).toBeEnabled();
  await packs.locator('label[data-pack="safari"]').click();
  await expect(safari).toBeChecked();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await safari.scrollIntoViewIfNeeded();
    await expect(safari).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`mari-packs-${width}.png`) });
  }
  await page.reload();
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
  await expect(omnibar.locator('img[src^="/sprites/mari/safari/portrait-idle.webp?v="]').first()).toBeVisible();
  await expect(omnibar.locator('img[src^="/sprites/mari/safari/portrait-idle.webp?v="]').first()).toHaveJSProperty(
    "naturalWidth",
    512,
  );
  await omnibar.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  await expect(safari).toBeChecked();
  await packs.locator('label[data-pack="golden"]').click();
  await page.reload();
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
  await expect(omnibar.locator('img[src^="/sprites/mari/golden/portrait-idle.webp?v="]').first()).toBeVisible();
  await expect(omnibar.locator('img[src^="/sprites/mari/golden/portrait-idle.webp?v="]').first()).toHaveJSProperty(
    "naturalWidth",
    512,
  );
  await omnibar.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  await expect(golden).toBeChecked();
  await packs.locator('label[data-pack="basic"]').click();
  await expect(packs.getByRole("radio", { name: /^Basic/ })).toBeChecked();
  expect(errors).toEqual([]);
});
