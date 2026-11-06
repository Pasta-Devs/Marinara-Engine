import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { clickTopbarPanel } from "./topbar-navigation.js";

/**
 * The shared test server keeps what earlier specs made. Hides the items `path` (such as "/api/connections") lists
 * now from the page's GETs of it, so the page shows only what the spec adds next.
 */
export async function hideExistingItems(page: Page, request: APIRequestContext, path: string) {
  const items = (await (await request.get(path)).json()) as Array<{ id: string }>;
  const hidden = new Set(items.map((item) => item.id));
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== "GET" || new URL(route.request().url()).pathname !== path) {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const body = ((await response.json()) as Array<{ id: string }>).filter((item) => !hidden.has(item.id));
    await route.fulfill({ response, json: body });
  });
  return { items, hidden };
}

/** Variant D: a Model shows on its Connection's page; the panel search lists every Model first. */
export async function openConnectionsPanelModel(panel: Locator, name: string) {
  await panel.getByRole("searchbox", { name: "Search models and accounts" }).fill(name);
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
 * Opens an engine's settings card. Speech to text opens from its Defaults tile: on the engine's page when it is set
 * up, in the Add window when it is not. The Voice tile picks the voice Model instead (#8456), so "voice" opens the
 * Text to Speech settings in the Add window (On this device › Text to speech), which every voice source has.
 */
export async function openDefaultsTile(page: Page, tile: "voice" | "stt") {
  if (tile === "voice") {
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection({ category: "device", item: "tts" });
    });
    return;
  }
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
