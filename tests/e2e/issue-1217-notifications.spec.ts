import { expect, test } from "@playwright/test";

test("settings shows conversation native notification opt-in", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('button[aria-label="Settings"]')
    .first()
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  await page.getByRole("button", { name: "Appearance" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });

  await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Native notifications")).toBeVisible();
});
