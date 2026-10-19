import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

async function prepare(page: Page, state: Parameters<typeof seedUIState>[1] = {}) {
  // Clear the synced preferences an earlier spec saved on this server, so this browser's seed is what syncs.
  expect((await page.request.put("/api/app-settings/ui", { data: { value: "" } })).ok()).toBeTruthy();
  await seedUIState(
    page,
    { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, ...state },
    "if-missing",
  );
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
}

function seasonalRecords(page: Page) {
  return page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const state = useUIStore.getState();
    return { greeted: state.seasonalGreetingYears, off: state.seasonalThemeOffYears, ready: state.settingsSyncReady };
  });
}

test("the Halloween preview greets, keeps or turns off the theme, and saves nothing", async ({ page }) => {
  // The shared fixture turns seasonal themes off; the preview still wears Halloween.
  await prepare(page);
  await page.goto("/?seasonalPreview=halloween");
  const root = page.locator("html");
  const greeting = page.getByRole("dialog", { name: "Happy Halloween!" });
  const bat = page.locator(".mari-seasonal-home__sky").first();

  await expect(greeting).toBeVisible();
  await expect(root).toHaveAttribute("data-seasonal-theme", "halloween");
  await greeting.getByRole("button", { name: "Keep it" }).click();
  await expect(greeting).toBeHidden();
  await expect(root).toHaveAttribute("data-seasonal-theme", "halloween");
  await expect(bat).toBeVisible();
  await expect(bat).toHaveCSS("pointer-events", "none");
  expect(await seasonalRecords(page)).toMatchObject({ greeted: {}, off: {} });

  // Nothing was saved, so the preview greets again; "Turn it off" takes the costume off at once.
  await page.reload();
  await expect(greeting).toBeVisible();
  await greeting.getByRole("button", { name: "Turn it off" }).click();
  await expect(greeting).toBeHidden();
  await expect(root).not.toHaveAttribute("data-seasonal-theme");
  await expect(bat).toBeHidden();
  expect(await seasonalRecords(page)).toMatchObject({ greeted: {}, off: {} });
});

test("on October 31 Halloween greets once and the Settings toggle takes it off", async ({ page }) => {
  // Noon keeps the browser on October 31 in any CI time zone up to ±11 hours.
  await page.clock.setFixedTime(new Date(2026, 9, 31, 12, 0));
  await prepare(page, { seasonalThemesDisabled: false });
  await page.goto("/");
  const root = page.locator("html");
  const greeting = page.getByRole("dialog", { name: "Happy Halloween!" });

  await expect(greeting).toBeVisible();
  await greeting.getByRole("button", { name: "Keep it" }).click();
  await expect(greeting).toBeHidden();
  await expect(root).toHaveAttribute("data-seasonal-theme", "halloween");
  expect(await seasonalRecords(page)).toMatchObject({ greeted: { halloween: 2026 }, off: {} });

  // Once a year: after a reload the theme stays and the greeting does not come back.
  await page.reload();
  await expect(root).toHaveAttribute("data-seasonal-theme", "halloween");
  await expect.poll(async () => (await seasonalRecords(page)).ready).toBe(true);
  expect(await seasonalRecords(page)).toMatchObject({ greeted: { halloween: 2026 } });
  await page.waitForTimeout(1_000);
  await expect(greeting).toHaveCount(0);

  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().setSettingsTab("general");
    useUIStore.getState().openRightPanel("settings");
  });
  await page.getByText("Disable seasonal ME themes", { exact: true }).click();
  await expect(root).not.toHaveAttribute("data-seasonal-theme");
});
