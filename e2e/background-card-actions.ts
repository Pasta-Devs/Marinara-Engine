import { test, type Locator, type Page } from "@playwright/test";

/** Phones show a background card's actions in its More actions menu instead of as separate buttons. */
export async function openBackgroundCardMenu(page: Page, card: Locator): Promise<Locator> {
  await card.getByRole("button", { name: "More actions", exact: true }).click();
  return page.getByRole("menu");
}

/** Run a background card's action: its own button on a computer, the item in the card's menu on a phone. */
export async function chooseBackgroundCardAction(page: Page, card: Locator, button: Locator, menuItem: string) {
  if (!test.info().project.name.includes("mobile")) return button.click();
  const menu = await openBackgroundCardMenu(page, card);
  await menu.getByRole("menuitem", { name: menuItem, exact: true }).click();
}
