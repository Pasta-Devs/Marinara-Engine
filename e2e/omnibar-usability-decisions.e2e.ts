import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Round 9 usability decisions (follow-ups item 8). Each test saves its proof screenshot under
 * `.tmp/omnibar-ux/round10/shots/`, named by UX id and the project's width (390 or 1440).
 */
const SHOT_DIR = new URL("../.tmp/omnibar-ux/round10/shots/", import.meta.url);

async function prepareClient(page: Page) {
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
  });
}

async function openOmnibar(page: Page) {
  // The shortcut needs page focus, which a fresh load or reload does not have.
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
}

function shotPath(id: string, width: number) {
  mkdirSync(SHOT_DIR, { recursive: true });
  return new URL(`${id}-${width}.png`, SHOT_DIR).pathname;
}

test.beforeEach(async ({ page, request }) => {
  const resetUiSettings = await request.put("/api/app-settings/ui", { data: { value: "" } });
  expect(resetUiSettings.ok()).toBeTruthy();
  await prepareClient(page);
  await page.goto("/");
});

test("UX-35: a question handed to Professor Mari does not come back when the omnibar reopens", async ({
  page,
}, testInfo) => {
  // Mari's hand-off is covered on desktop (command-palette.e2e.ts uses the same rule); a phone run is not needed for this logic.
  test.skip(!testInfo.project.name.includes("desktop"), "Professor Mari hand-off is covered on desktop.");
  const width = 1440;
  await openOmnibar(page);

  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
  await input.fill("why is my lorebook empty");
  await omnibar.locator('[data-result-id="ask-professor-mari"]').click();
  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toHaveAttribute("aria-hidden", "false");

  // Leave her window, then close the omnibar. The handed-off question must not survive the close.
  await expect
    .poll(async () => {
      await page.keyboard.press("Escape");
      return omnibar.count();
    })
    .toBe(0);

  await openOmnibar(page);
  await expect(input).toHaveValue("");
  await omnibar.screenshot({ path: shotPath("UX-35", width) });
});

test("UX-11: the bar under Professor Mari has no Review or Return button", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Professor Mari hand-off is covered on desktop.");
  const width = 1440;
  await openOmnibar(page);

  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("why is my lorebook empty");
  await omnibar.locator('[data-result-id="ask-professor-mari"]').click();
  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toHaveAttribute("aria-hidden", "false");

  // The receipt cards and the header's back arrow cover review and return, so the bar is gone.
  await expect(omnibar.locator('[data-component="GlobalOmnibar.CompletionActions"]')).toHaveCount(0);
  await expect(omnibar.getByRole("button", { name: "Return to results", exact: true })).toHaveCount(0);
  await omnibar.screenshot({ path: shotPath("UX-11", width) });
});
