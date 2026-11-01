import { expect, type Locator, type Page } from "@playwright/test";
import { clickTopbarPanel } from "./topbar-navigation.js";

/** Variant D: a Model shows on its Connection's page; the panel search lists every Model first. */
export async function openConnectionsPanelModel(panel: Locator, name: string) {
  await panel.getByRole("searchbox", { name: "Search models and connections" }).fill(name);
  await panel.locator("[data-connection-id]").filter({ hasText: name }).first().click();
}

/**
 * Opens the Connections panel unless it shows. Right after a load the panel can still be on its way, so a click
 * may close it; the retry opens it again.
 */
export async function openConnectionsPanel(page: Page) {
  const panel = page.locator("[data-connections-panel]").filter({ visible: true });
  await expect(async () => {
    if (!(await panel.count())) await clickTopbarPanel(page, "connections");
    await expect(panel.first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

/** A narrow panel keeps the page it showed last; go back to the list first. */
export async function showConnectionsList(page: Page) {
  await openConnectionsPanel(page);
  const back = page.locator("[data-connections-back]").filter({ visible: true });
  if (await back.count()) await back.first().click();
}

/**
 * Variant D: Voice and Speech to text open from their Defaults tile, on the engine's page when it is set up and in
 * the Add window when it is not. Either way the engine's settings card is then on the page.
 */
export async function openDefaultsTile(page: Page, tile: "voice" | "stt") {
  await (await revealDefaultsTile(page, tile)).click();
}

/** Shows a Defaults tile without opening it: unfolds the box and its "more roles" list when needed. */
export async function revealDefaultsTile(page: Page, tile: "voice" | "stt") {
  await openConnectionsPanel(page);
  const tileButton = page.locator(`[data-defaults-tile="${tile}"]`).filter({ visible: true });
  const mainTile = page.locator('[data-defaults-tile="main"]').filter({ visible: true });
  if (!(await tileButton.count())) {
    await showConnectionsList(page);
    // The Defaults box remembers its fold; unfold it only when it is folded.
    if (!(await mainTile.count()))
      await page.locator('[data-connections-row="defaults"]').filter({ visible: true }).click();
  }
  await expect(mainTile).toBeVisible();
  if (!(await tileButton.count())) {
    await page.locator("[data-defaults-unused]").filter({ visible: true }).click();
  }
  await expect(tileButton).toBeVisible();
  return tileButton;
}

export function ttsConfigCard(page: Page) {
  return page.locator('[data-component="TTSConfigCard"]').filter({ visible: true });
}

/** Variant D: a set-up engine has its own page under On this device. */
export async function openDevicePage(page: Page, item: "local-model" | "tts" | "stt") {
  await showConnectionsList(page);
  await page.locator(`[data-connections-row="device:${item}"]`).filter({ visible: true }).click();
}
