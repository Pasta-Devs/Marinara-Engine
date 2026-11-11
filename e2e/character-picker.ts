import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Open a CharacterSelect trigger (#8763) and pick `name` in its window. The window is a popover on desktop and a
 * sheet on a phone, both a dialog named `title` ("Characters", "Personas" or the field's own title) with a search box
 * and [data-pick-row] rows. A single pick closes it; a multiple pick stays open and adds its count to the title, so
 * Escape closes it (the popover and the phone sheet both listen).
 */
export async function chooseCharacter(page: Page, trigger: Locator, title: string, name: string) {
  await trigger.click();
  const picker = page.getByRole("dialog", { name: title, exact: true });
  await picker.getByRole("searchbox").fill(name);
  await picker.locator("[data-pick-row]").filter({ hasText: name }).first().click();
  // After a multiple pick the title reads "Characters · 1", so look for either name.
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const open = page.getByRole("dialog", { name: new RegExp(`^${escaped}( · \\d+)?$`) });
  if (await open.isVisible()) await page.keyboard.press("Escape");
  await expect(open).toHaveCount(0);
}

/**
 * The picker finds characters by name, so a test names its characters per run, keeping another run's characters on
 * the same server out of the pick.
 */
export const runName = (name: string) => `${name} ${Date.now().toString(36)}`;
