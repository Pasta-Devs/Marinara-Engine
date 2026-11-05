import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Open a ConnectionSelect trigger and choose the saved Model `id` in its "Model for …" picker (#8456). The picker
 * shows one account's Models at a time, and a narrow one opens on a single pane, so this opens each account pane in
 * turn until the row shows.
 */
export async function chooseConnection(page: Page, trigger: Locator, id: string) {
  await trigger.click();
  const dialog = page.getByRole("dialog").filter({ has: page.locator("[data-switcher-accounts]") });
  await expect(dialog).toBeVisible();
  const row = dialog.locator(`[data-switcher-entry="${id}"]`).filter({ visible: true });
  const back = dialog.locator("[data-switcher-back]").filter({ visible: true });
  const panes = dialog.locator("[data-switcher-pane]");
  await expect(async () => {
    if (await row.count()) return;
    for (let index = 0; index < (await panes.count()); index += 1) {
      if (await back.count()) await back.first().click();
      // A Model with no account is listed beside the panes, which a narrow picker shows only after Back.
      if (await row.count()) return;
      await panes.nth(index).click();
      if (await row.count()) return;
    }
    throw new Error(`No "${id}" row in the model picker`);
  }).toPass({ timeout: 15_000 });
  await row.last().click();
  await expect(dialog).toHaveCount(0);
}
