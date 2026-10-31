import type { Locator, Page } from "@playwright/test";

/** Open a ConnectionSelect trigger and choose a row; null picks the default row. */
export async function chooseConnection(page: Page, trigger: Locator, id: string | null) {
  await trigger.click();
  await page
    .getByRole("dialog", { name: "Choose a model" })
    .locator(`[data-picker-value="${id ?? "default"}"]`)
    .click();
}
