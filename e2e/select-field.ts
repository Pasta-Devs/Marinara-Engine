import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Pick `label` in a shared Select (#9400), the app's replacement for a native <select>. The trigger is a
 * role="combobox" button whose aria-label also titles the picker window (a popover on desktop, a sheet on a phone),
 * and its `data-value` holds the picked value, so `toHaveAttribute("data-value", …)` replaces `toHaveValue`.
 * Use this where a spec called `selectOption` on the old native select.
 */
export async function chooseOption(page: Page, trigger: Locator, label: string) {
  const title = await trigger.getAttribute("aria-label");
  await trigger.click();
  const picker = page.getByRole("dialog", { name: title ?? undefined, exact: true });
  await picker
    .locator("[data-pick-row]")
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
    .click();
  await expect(picker).toHaveCount(0);
}

/** Open a shared Select, read its option labels in order, and close it again (a native select's `option` list). */
export async function pickerLabels(page: Page, trigger: Locator): Promise<string[]> {
  const title = await trigger.getAttribute("aria-label");
  await trigger.click();
  const picker = page.getByRole("dialog", { name: title ?? undefined, exact: true });
  const rows = picker.locator("[data-pick-row]");
  await expect(rows.first()).toBeVisible();
  const labels = (await rows.allInnerTexts()).map((label) => label.trim());
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  return labels;
}
