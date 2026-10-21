import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { mockUILanguagePacks } from "./ui-language-fixtures.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test.beforeEach(async ({ page }) => {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    appAccentPulseMode: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({ json: { schemaVersion: 1, generatedAt: "2026-10-21T00:00:00.000Z", packages: [] } }),
  );
});

test("soup/language picker searches native names and English names with keyboard selection", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const packs = await mockUILanguagePacks(page);
  await page.goto("/");
  await clickTopbarPanel(page, "settings");
  const trigger = page.locator("#settings-control-language-select");
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const search = page.getByRole("combobox", { name: "Search languages" });
  const popup = page.locator("[data-language-picker-portal]");
  await expect(search).toBeFocused();
  await expect(popup.getByRole("option")).toHaveCount(12);
  await expect(popup.getByRole("option", { name: "English", exact: true })).toHaveAttribute("aria-selected", "true");
  await testInfo.attach("language-picker-open", { body: await page.screenshot(), contentType: "image/png" });
  const box = (await popup.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  await search.fill("zzzz");
  await expect(popup.getByRole("status")).toHaveText("No languages found. Try another name.");
  await expect(popup.getByRole("status")).toBeInViewport({ ratio: 1 });
  await testInfo.attach("language-picker-empty", {
    body: await page.screenshot({ path: testInfo.outputPath("language-picker-empty.png") }),
    contentType: "image/png",
  });
  if (!testInfo.project.name.includes("mobile")) {
    const constraint = await page.addStyleTag({
      content: "[data-language-picker-portal] { max-height: 100px !important; }",
    });
    await popup.hover();
    await page.mouse.wheel(0, 40);
    await expect(popup.getByRole("status")).toBeInViewport({ ratio: 1 });
    await constraint.evaluate((element) => {
      element.parentNode?.removeChild(element);
    });
  }
  await page.keyboard.press("Enter");
  expect(packs.downloads).toEqual([]);
  await search.fill("japanese");
  await expect(popup.getByRole("option")).toHaveCount(1);
  await expect(popup.getByRole("option")).toContainText("日本語");
  await search.fill("portugues");
  await expect(popup.getByRole("option")).toHaveCount(1);
  await expect(popup.getByRole("option")).toContainText("Português");
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Shift+Tab");
  await expect(popup).toHaveCount(0);
  await expect(page.locator("#settings-control-language").getByRole("button").first()).toBeFocused();

  await trigger.click();
  await page.goBack();
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(search).toHaveValue("");
  await search.fill("polish");
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("data-value", "pl");
  await expect(trigger).toContainText("Polski");
  expect(packs.downloads).toEqual(["pl"]);
  await expect(popup).toHaveCount(0);
  await trigger.click();
  await expect(popup.getByRole("option", { selected: true })).toContainText("Polski");
  await page.keyboard.press("Tab");
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh language pack", exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test("soup/documentation picker stages a language without switching or downloading a pack", async ({ page }) => {
  const writes: string[] = [];
  await page.route("**/api/docs/language", async (route) => {
    if (route.request().method() !== "GET") writes.push(route.request().method());
    await route.fulfill({
      json: {
        active: "en",
        configured: true,
        install: null,
        integrity: { ok: true },
        available: [
          { code: "en", label: "English", englishLabel: "English", installed: true, translated: 10, total: 10 },
          { code: "de", label: "Deutsch", englishLabel: "German", installed: false, translated: 0, total: 10 },
        ],
      },
    });
  });
  await page.goto("/");
  await clickTopbarPanel(page, "settings");
  const trigger = page.locator("#settings-docs-language-select");
  await trigger.click();
  await page.getByRole("combobox", { name: "Search languages" }).fill("german");
  await page.getByRole("option", { name: /Deutsch/ }).click();
  await expect(trigger).toContainText("Deutsch");
  await expect(page.getByRole("button", { name: "Download & Replace", exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test("soup/onboarding language picker closes on Escape without ending the tutorial", async ({ page }) => {
  await seedUIState(page, { hasCompletedOnboarding: false, rightPanelOpen: false, sidebarOpen: false });
  await page.goto("/");
  const tour = page.locator('[data-component="OnboardingTutorial.Card"]');
  const trigger = page.locator("#onboarding-docs-language");
  await expect(tour).toBeVisible();
  for (let step = 0; step < 30 && !(await trigger.isVisible()); step++) {
    const previousTitle = await tour.getAttribute("aria-label");
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    await expect(tour).not.toHaveAttribute("aria-label", previousTitle!);
  }
  await expect(trigger).toBeVisible();
  await trigger.click();
  const search = page.getByRole("combobox", { name: "Search languages" });
  await expect(search).toBeFocused();
  await search.fill("english");
  await expect(page.getByRole("option", { name: "English", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-language-picker-portal]")).toHaveCount(0);
  await expect(tour).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("[data-language-picker-portal]")).toHaveCount(0);
  await expect(tour.getByRole("button", { name: "Documentation", exact: true })).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-language-picker-portal]")).toHaveCount(0);
  await expect(tour.getByRole("button", { name: "Skip", exact: true })).toBeFocused();
});

test("soup/language picker fits phone, tablet and desktop in both visual themes", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The viewport and theme matrix is covered on desktop.");
  await mockUILanguagePacks(page);
  await page.goto("/");
  await clickTopbarPanel(page, "settings");
  for (const visualTheme of ["default", "sillytavern"] as const) {
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(
        async ({ visualTheme, theme }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setVisualTheme(visualTheme);
          useUIStore.getState().setTheme(theme);
          useUIStore.getState().setChatChromeTextColor("#9d75db");
        },
        { visualTheme, theme },
      );
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const trigger = page.locator("#settings-control-language-select");
        await trigger.click();
        const popup = page.locator("[data-language-picker-portal]");
        await expect(popup).toBeVisible();
        await expect(popup).toHaveCSS("color", await trigger.evaluate((element) => getComputedStyle(element).color));
        const tokens = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          return [style.getPropertyValue("--foreground"), style.getPropertyValue("--muted-foreground")];
        };
        expect(await popup.evaluate(tokens)).toEqual(await trigger.evaluate(tokens));
        const screenshotPath = testInfo.outputPath(`language-picker-${visualTheme}-${theme}-${width}.png`);
        await testInfo.attach(`language-picker-${visualTheme}-${theme}-${width}`, {
          body: await page.screenshot({ path: screenshotPath }),
          contentType: "image/png",
        });
        const box = (await popup.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(1000);
        await page.keyboard.press("Escape");
      }
    }
  }
});
