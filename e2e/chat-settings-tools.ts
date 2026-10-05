// Chat Branches, Chat Summary, Active Context, Author's Notes, Agent activity and Gallery are Chat Settings
// drawers, including Search messages under Profile setup (#7034). These helpers reach them from the chat
// button: a movable window on desktop, a sheet on phones.
import { expect, type Locator, type Page } from "@playwright/test";

export type ChatSettingsTool =
  | "chat-branches"
  | "chat-summary"
  | "active-context"
  | "author-notes"
  | "agent-activity"
  | "gallery"
  | "message-search";

export function chatSettingsWindow(page: Page) {
  return page.locator('[data-window="chat-settings"]');
}

/** Opens Chat Settings for the open chat from the topbar, or returns it when it is already open. */
export async function openChatSettings(page: Page): Promise<Locator> {
  const settings = chatSettingsWindow(page);
  if (await settings.isVisible()) return settings;
  await page.locator("[data-chat-settings-button]").click();
  await expect(settings.locator("[data-chat-settings-section]").first()).toBeVisible();
  return settings;
}

async function expand(drawer: Locator) {
  const header = drawer.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

/** The drawer for a chat tool in Chat Settings (its id starts with the chat mode). Agent activity sits below Agents. */
export function chatSettingsDrawer(page: Page, tool: ChatSettingsTool | "agents") {
  return chatSettingsWindow(page).locator(`[data-drawer$="-${tool}"]`).first();
}

/** Opens Chat Settings, expands a chat tool's drawer and returns it. */
export async function openChatSettingsTool(page: Page, tool: ChatSettingsTool): Promise<Locator> {
  await openChatSettings(page);
  const drawer = chatSettingsDrawer(page, tool);
  await drawer.scrollIntoViewIfNeeded();
  await expand(drawer);
  return drawer;
}

/** The Search messages section under Profile setup. */
export async function openChatMessageSearch(page: Page): Promise<Locator> {
  const drawer = await openChatSettingsTool(page, "message-search");
  const search = drawer.locator("[data-chat-message-search]");
  await expect(search).toBeVisible();
  return search;
}

/** Reset View: the icon in the Chat Settings title bar, then Reset in its confirmation. */
export async function resetChatView(page: Page) {
  await chatSettingsWindow(page).locator('[data-chat-settings-control="reset-view"]').click();
  const dialog = page.getByRole("dialog", { name: "Are you sure you want to reset the view?" });
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** Closes Chat Settings with its own close control (a pinned window closes too). */
export async function closeChatSettings(page: Page) {
  const settings = chatSettingsWindow(page);
  if (!(await settings.isVisible())) return;
  await settings.locator('[data-window-control="close"]').click();
  await expect(settings).toHaveCount(0);
}
