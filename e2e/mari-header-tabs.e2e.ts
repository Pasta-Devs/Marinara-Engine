import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Slice 83 (item 4): Mari's destination row is a tablist. Arrow keys, Home and End move and select a tab, and
 * only one tab is in the tab order. The look changed, the geometry did not, so this spec checks roles and keys.
 */
test("Mari's destinations are a tablist with roving tab stops and arrow-key selection", async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
  });
  await page.goto("/");
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+j");

  const tablist = page.locator('[data-component="GlobalOmnibar"]').getByRole("tablist");
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(tabs.nth(0)).toHaveAccessibleName("Skills");
  await expect(tabs.nth(3)).toHaveAccessibleName("Chats");

  // No destination is selected yet: the first tab is the one tab stop.
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "-1");
  // The panel that the selected tab opens takes focus when it mounts; let that happen before the keys.
  await expect(page.locator(".mari-side-head button:visible").first()).toBeFocused();
  // The panel the selected tab shows is the one tabpanel, labelled by that tab.
  await expect(page.getByRole("tabpanel", { name: "Memories", exact: true })).toHaveAttribute(
    "aria-labelledby",
    "mari-tab-memories",
  );

  // Arrows move focus and the one tab stop with it; selection is Enter or Space (the click).
  await tabs.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");
});
