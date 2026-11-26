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

/** The panel's search box shows from this many Models (#9758). */
export const PANEL_SEARCH_MIN_MODELS = 8;

/**
 * Checks the panel's search box against the Models the panel holds: visible from 8, absent below. Returns the box
 * when it shows, else null. `container` is the Connections panel or a sidebar that holds it.
 */
export async function panelSearch(container: Locator) {
  const panel = container.locator(":scope[data-connections-panel], [data-connections-panel]");
  await expect(panel).toHaveAttribute("data-connections-models", /^\d+$/u);
  const models = Number(await panel.getAttribute("data-connections-models"));
  const search = panel.getByRole("searchbox", { name: "Search models and accounts" });
  if (models >= PANEL_SEARCH_MIN_MODELS) {
    await expect(search).toBeVisible();
    return search;
  }
  await expect(search).toHaveCount(0);
  return null;
}

/** Variant D: a Model shows on its Connection's page; the panel search lists every Model first, when it shows. */
export async function openConnectionsPanelModel(panel: Locator, name: string) {
  await (await panelSearch(panel))?.fill(name);
  await panel.locator("[data-connection-id]").filter({ hasText: name }).first().click();
}

/** Opens the Jobs page from the summary at the top of the Connections panel, unless it shows already. */
export async function openJobsPage(page: Page) {
  await openConnectionsPanel(page);
  const jobsPage = page.locator("[data-connections-jobs-page]").filter({ visible: true });
  if (!(await jobsPage.count())) {
    await showConnectionsList(page);
    await page.locator("[data-connections-jobs-open]").filter({ visible: true }).first().click();
  }
  await expect(jobsPage).toBeVisible();
  return jobsPage;
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
 * Voice job's settings window from its gear, which shows the Text to Speech settings whether voice is on or off.
 */
export async function openDefaultsTile(page: Page, tile: "voice" | "stt") {
  if (tile === "voice") {
    await openJobSettings(page, "voice");
    return;
  }
  await (await revealDefaultsTile(page, tile)).click();
}

/** Shows a job's row (or chip) on the Jobs page without opening it. */
export async function revealDefaultsTile(page: Page, tile: "voice" | "stt") {
  const jobsPage = await openJobsPage(page);
  const tileButton = jobsPage.locator(`[data-defaults-tile="${tile}"]`);
  await expect(tileButton).toBeVisible();
  return tileButton;
}

export function ttsConfigCard(page: Page) {
  return page.locator('[data-component="TTSConfigCard"]').filter({ visible: true });
}

/** Opens a job's settings window from its gear on the Jobs page. */
export async function openJobSettings(page: Page, job: string) {
  const role = (await openJobsPage(page)).locator(`[data-defaults-role="${job}"]`);
  await role.scrollIntoViewIfNeeded();
  await role.getByRole("button", { name: / settings$/ }).click();
  return page.getByRole("dialog");
}
