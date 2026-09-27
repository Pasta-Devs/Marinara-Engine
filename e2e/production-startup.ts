import { expect, test } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";

test("the production frontend mounts and survives a reload without startup errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator('script[type="module"][src^="/assets/"]')).toHaveCount(1);
  await expect(page.locator('[data-component="TopBar"]'), errors.join("\n")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  expect(errors).toEqual([]);
});
