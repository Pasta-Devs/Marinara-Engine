import { expect, type Page } from "@playwright/test";

/**
 * Use the same panel action through desktop navigation or the phone More menu. `"chats"` is the Chats toggle, which a
 * phone also lists first in the More menu.
 */
export async function clickTopbarPanel(page: Page, panel: string, action: "click" | "tap" = "click") {
  const direct = page.locator(
    panel === "chats" ? '[data-component="TopBar"] [data-tour="sidebar-toggle"]' : `[data-tour="panel-${panel}"]`,
  );
  const more = page.locator("[data-topbar-more]");
  await expect(direct.or(more).filter({ visible: true })).toHaveCount(1);
  if (await direct.isVisible()) {
    await direct[action]();
    return;
  }
  await expect(more).toBeVisible();
  if ((await more.getAttribute("aria-expanded")) !== "true") await more[action]();
  await page.locator(`[role="menuitem"][data-topbar-panel="${panel}"]`)[action]();
}

/** Toggle the Chats sidebar from the top bar, or from the phone More menu where Chats lives there. */
export const clickTopbarChats = (page: Page, action: "click" | "tap" = "click") =>
  clickTopbarPanel(page, "chats", action);
