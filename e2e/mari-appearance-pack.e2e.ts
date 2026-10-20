import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

async function openOmnibar(page: Page) {
  const shortcut = await page.evaluate(async () => {
    const { isApplePlatform } = await import("/src/lib/command-center.ts" as string);
    return isApplePlatform() ? "Meta+k" : "Control+k";
  });
  await page.keyboard.press(shortcut);
}

test("Golden (once unlocked) and Safari Prof. Mari are selectable and survive reload", async ({ page }, testInfo) => {
  // The mobile projects share a server; clear its prior settings before this browser seeds an unlocked pack.
  expect((await page.request.put("/api/app-settings/ui", { data: { value: "" } })).ok()).toBeTruthy();
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
  // Outside every dated pack's window, so the grid lists exactly the four undated packs.
  await page.clock.setFixedTime(new Date("2026-06-15T12:00:00"));
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
  await openOmnibar(page);
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
  await openOmnibar(page);
  await expect(omnibar.locator('img[src^="/sprites/mari/safari/portrait-idle.webp?v="]').first()).toBeVisible();
  await expect(omnibar.locator('img[src^="/sprites/mari/safari/portrait-idle.webp?v="]').first()).toHaveJSProperty(
    "naturalWidth",
    512,
  );
  await omnibar.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  await expect(safari).toBeChecked();
  await packs.locator('label[data-pack="golden"]').click();
  // The fixed clock gives every edit the same timestamp, so let the server save this pick before reloading.
  await expect
    .poll(async () => {
      const { value } = await (await page.request.get("/api/app-settings/ui")).json();
      return JSON.parse(value || "{}").mariAppearancePackId;
    })
    .toBe("golden");
  await page.reload();
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await openOmnibar(page);
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

/** Home with seasonal looks on unless `state` says otherwise; returns Home's portrait of one pack. */
async function openSeasonalHome(page: Page, state: Parameters<typeof seedUIState>[1], url = "/") {
  const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  // Settings synced by earlier tests would override the seeded ones.
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  // The fixture turns seasonal looks off; these tests are about them, so they turn them back on. Seeded once, so a
  // reload keeps what the test did.
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      seasonalThemesDisabled: false,
      ...state,
    },
    "if-missing",
  );
  await page.goto(url);
  return (pack: string) =>
    page
      .locator('[data-component="HomeBrowserHub.ProfessorWidget"]')
      .locator(`img[src^="/sprites/mari/${pack}/portrait-idle.webp?v="]`);
}

const storedUI = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("marinara-engine-ui")!).state as Record<string, unknown>);

// Noon keeps the browser on October 31, inside Halloween, in any CI time zone up to ±11 hours.
const HALLOWEEN_NOON = new Date(2026, 9, 31, 12, 0);

test("a dated pack follows its seasonal theme and toggle, and another pick wins while it is worn", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-30T12:00:00"));
  // The Halloween theme shares the window; its greeting would cover the page.
  const homePortrait = await openSeasonalHome(page, { seasonalGreetingYears: { halloween: 2026 } });
  await expect(homePortrait("raccoon")).toHaveJSProperty("naturalWidth", 512);

  // Settings → Disable seasonal ME themes takes the costume off with the theme; switching back puts it on again.
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().setSettingsTab("general");
    useUIStore.getState().openRightPanel("settings");
  });
  const seasonalToggle = page.getByText("Disable seasonal ME themes", { exact: true });
  await seasonalToggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-seasonal-theme");
  await expect(homePortrait("basic")).toHaveCount(1);
  await expect(homePortrait("raccoon")).toHaveCount(0);
  await seasonalToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-seasonal-theme", "halloween");
  await expect(homePortrait("raccoon")).toHaveCount(1);
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().closeRightPanel();
  });

  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  const packs = omnibar.getByRole("radiogroup", { name: "Professor Mari appearance" });
  await expect(packs.getByRole("radio")).toHaveCount(5);
  await expect(packs.getByRole("radio", { name: /^Feral Raccoon Prof\. Mari/ })).toBeChecked();
  await packs.locator('label[data-pack="safari"]').click();
  await expect(packs.getByRole("radio", { name: /^Safari Prof\. Mari/ })).toBeChecked();
  await expect.poll(async () => (await storedUI(page)).mariSeasonOptOut).toBe("raccoon-2026");
  expect((await storedUI(page)).mariAppearancePackId).toBe("safari");
});

test("the Halloween greeting's Turn it off takes Professor Mari's costume off for this year", async ({ page }) => {
  await page.clock.setFixedTime(HALLOWEEN_NOON);
  const homePortrait = await openSeasonalHome(page, {});
  const greeting = page.getByRole("dialog", { name: "Happy Halloween!" });
  await expect(greeting).toBeVisible();
  await expect(homePortrait("raccoon")).toHaveJSProperty("naturalWidth", 512);
  await greeting.getByRole("button", { name: "Turn it off" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-seasonal-theme");
  await expect(homePortrait("basic")).toHaveCount(1);
  await expect(homePortrait("raccoon")).toHaveCount(0);
  await expect.poll(async () => (await storedUI(page)).seasonalThemeOffYears).toEqual({ halloween: 2026 });

  // Recorded for this year, so the costume stays off after a reload.
  await page.reload();
  await expect(homePortrait("basic")).toHaveCount(1);
  await expect(homePortrait("raccoon")).toHaveCount(0);
  await expect(greeting).toHaveCount(0);
});

test("the Halloween preview dresses Professor Mari up, and nothing done in it is saved", async ({ page }) => {
  // A June day with seasonal looks switched off: only the preview can bring the costume.
  await page.clock.setFixedTime(new Date(2026, 5, 15, 12, 0));
  const homePortrait = await openSeasonalHome(page, { seasonalThemesDisabled: true }, "/?seasonalPreview=halloween");
  const greeting = page.getByRole("dialog", { name: "Happy Halloween!" });
  await expect(greeting).toBeVisible();
  await expect(homePortrait("raccoon")).toHaveJSProperty("naturalWidth", 512);
  await greeting.getByRole("button", { name: "Keep it" }).click();
  await expect(greeting).toBeHidden();

  // Picking another outfit in the preview works there, but never opts out of the real Halloween.
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  const packs = omnibar.getByRole("radiogroup", { name: "Professor Mari appearance" });
  await expect(packs.getByRole("radio")).toHaveCount(5);
  await expect(packs.getByRole("radio", { name: /^Feral Raccoon Prof\. Mari/ })).toBeChecked();
  await packs.locator('label[data-pack="safari"]').click();
  await expect(packs.getByRole("radio", { name: /^Safari Prof\. Mari/ })).toBeChecked();
  await expect.poll(async () => (await storedUI(page)).mariAppearancePackId).toBe("safari");
  expect((await storedUI(page)).mariSeasonOptOut).toBe("");

  // A fresh preview dresses her again; its own Turn it off undresses her and records nothing.
  await page.reload();
  await expect(greeting).toBeVisible();
  await expect(homePortrait("raccoon")).toHaveJSProperty("naturalWidth", 512);
  await greeting.getByRole("button", { name: "Turn it off" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-seasonal-theme");
  await expect(homePortrait("safari")).toHaveCount(1);
  await expect(homePortrait("raccoon")).toHaveCount(0);
  await page.reload();
  await expect(greeting).toBeVisible();
  const stored = await storedUI(page);
  expect(stored.seasonalThemeOffYears).toEqual({});
  expect(stored.seasonalGreetingYears ?? {}).toEqual({});
  expect(stored.mariSeasonOptOut).toBe("");
});
