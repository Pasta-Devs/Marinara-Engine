import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("folder rename owns Escape while nested folder actions close the panel", async ({ page }, testInfo) => {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await page.route("**/api/characters/groups/list", (route) =>
    route.fulfill({
      json: [
        {
          id: "escape-folder",
          name: "Keep this folder",
          description: "",
          characterIds: "[]",
          avatarPath: null,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await page.goto("/");
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Characters", exact: true }).click();
  } else {
    await page.locator('[data-tour="panel-characters"]').click();
  }
  const panel = page.locator('[data-component="RightPanel"]');
  const folder = panel.locator('[data-character-folder-id="escape-folder"]');
  const header = folder.getByRole("button", { name: /Keep this folder/u }).first();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await header.press("F2");
  const rename = folder.getByRole("textbox");
  await rename.fill("");
  await rename.press("Escape");
  await expect(rename).toHaveCount(0);
  await expect(page.locator('[data-tour="panel-characters"]')).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toBeVisible();
  await expect(folder.getByText("Keep this folder", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("empty-folder-rename-panel-retained.png") });
  await header.press("Enter");
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await folder.getByRole("button", { name: "Delete folder", exact: true }).press("Escape");
  await expect(page.locator('[data-tour="panel-characters"]')).toHaveAttribute("aria-pressed", "false");
  await expect(panel).not.toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("expanded-folder-escape-panel-closed.png") });
});

test("shell panel focus returns to its opener and profile import is keyboard reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "This proof covers the desktop top-bar panel toggles.");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
  });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await page.goto("/");

  const settingsToggle = page.locator('[data-tour="panel-settings"]');
  await settingsToggle.click();
  const panel = page.locator('[data-component="RightPanel"]');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => document.activeElement === element)).toBe(true);

  await page.getByRole("tab", { name: "Imports", exact: true }).click();
  const importProfile = page.getByRole("button", { name: "Import Profile (JSON/ZIP)", exact: true });
  await expect(importProfile).toBeVisible();
  const hiddenInput = page.locator('input[type="file"][accept=".json,.zip,application/json,application/zip"]');
  await expect(hiddenInput).toHaveAttribute("aria-hidden", "true");
  await expect(hiddenInput).toHaveAttribute("tabindex", "-1");
  await expect(importProfile).toBeEnabled();
  await importProfile.focus();
  await expect.poll(() => importProfile.evaluate((element) => document.activeElement === element)).toBe(true);
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const fileChooser = await fileChooserPromise;
  expect(fileChooser.isMultiple()).toBe(false);
  await fileChooser.setFiles([]);

  await page.keyboard.press("Escape");
  await expect(settingsToggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => settingsToggle.evaluate((element) => document.activeElement === element)).toBe(true);

  const sidebarToggle = page.locator('[data-tour="sidebar-toggle"]');
  await sidebarToggle.click();
  const sidebar = page.locator('[data-component="ChatSidebar"]');
  const search = sidebar.getByRole("textbox", { name: "Search conversations", exact: true });
  await search.fill("no matching chat");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(sidebar).toBeVisible();
  await search.press("Escape");
  await expect(sidebarToggle).toHaveAttribute("aria-pressed", "false");
  await expect(sidebarToggle).toBeFocused();
});

test("chat sidebar keeps loading while initial requests retry", async ({ page }) => {
  let attempts = 0;
  let finishRetry: () => void = () => undefined;
  const retryPending = new Promise<void>((resolve) => {
    finishRetry = resolve;
  });
  await page.route(/\/api\/chats(?:\?.*)?$/, async (route) => {
    attempts++;
    if (attempts <= 2) return route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
    await retryPending;
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: true, rightPanelOpen: false });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  try {
    await page.goto("/");
    await expect.poll(() => attempts).toBeGreaterThanOrEqual(3);
    const sidebar = page.locator('[data-component="ChatSidebar"]');
    await expect(sidebar.getByRole("status")).toBeVisible();
    await expect(sidebar.getByRole("alert")).toHaveCount(0);
    finishRetry();
    await expect(sidebar.getByRole("status")).toHaveCount(0);
    const activity = sidebar.getByRole("textbox", { name: "Custom activity", exact: true });
    await activity.fill("");
    await activity.press("Escape");
    await expect(page.locator('[data-tour="sidebar-toggle"]')).toHaveAttribute("aria-pressed", "true");
    const search = sidebar.getByRole("textbox", { name: "Search conversations", exact: true });
    await search.fill("unmatched search");
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(sidebar).toBeVisible();
    await search.press("Escape");
    await expect(page.locator('[data-tour="sidebar-toggle"]')).toHaveAttribute("aria-pressed", "false");
  } finally {
    finishRetry();
  }
});
