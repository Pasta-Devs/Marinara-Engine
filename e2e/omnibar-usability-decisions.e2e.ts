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

/** Escape steps out of her window, then closes the omnibar; repeat until it is gone. */
async function closeOmnibar(page: Page, omnibar: ReturnType<Page["locator"]>) {
  await expect
    .poll(async () => {
      await page.keyboard.press("Escape");
      return omnibar.count();
    })
    .toBe(0);
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
  await closeOmnibar(page, omnibar);

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

test("UX-22: Ctrl+J carries a question into Professor Mari, and opens her empty for other text", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Professor Mari hand-off is covered on desktop.");
  const width = 1440;
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  const composer = omnibar.locator('[data-component="GlobalOmnibar.Mari"] textarea:visible');

  await openOmnibar(page);
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("lorebook");
  await page.keyboard.press("Control+j");
  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toHaveAttribute("aria-hidden", "false");
  await expect(composer).toHaveValue("");
  await omnibar.screenshot({ path: shotPath("UX-22-empty", width) });

  await closeOmnibar(page, omnibar);

  await openOmnibar(page);
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("why is my lorebook empty");
  await page.keyboard.press("Control+j");
  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toHaveAttribute("aria-hidden", "false");
  await expect(composer).toHaveValue("why is my lorebook empty");
  await omnibar.screenshot({ path: shotPath("UX-22-question", width) });
});

test("UX-31: the working glow is a low band about 40 px tall and faint", async ({ page }, testInfo) => {
  const width = testInfo.project.name.includes("mobile") ? 390 : 1440;
  // A stand-in window with the working glow, so the proof measures the shipped stylesheet at this width.
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "ux31-glow";
    box.style.cssText = "position:fixed;inset:0;overflow:hidden;background:#15121a;z-index:2147483647";
    const band = document.createElement("div");
    band.className = "mari-workspace-glow-band";
    band.dataset.working = "true";
    band.style.cssText = "position:absolute;inset:0";
    box.append(band);
    document.body.append(box);
  });
  const band = page.locator("#ux31-glow .mari-workspace-glow-band");
  const measure = () =>
    band.evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      return {
        riseAboveBottom: parseFloat(style.height) + parseFloat(style.bottom),
        opacity: parseFloat(style.opacity),
      };
    });
  // The colour fade takes 0.6 s; wait for the working opacity to settle before measuring.
  await expect.poll(async () => (await measure()).opacity).toBeCloseTo(0.4, 1);
  const metrics = await measure();
  expect(metrics.riseAboveBottom).toBeLessThanOrEqual(44);
  await page.locator("#ux31-glow").screenshot({ path: shotPath("UX-31", width) });
});

test("UX-32: the search field has no filter syntax in its hint, and touch rows show no Enter hint", async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name.includes("mobile") ? 390 : 1440;
  const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
  await expect(input).not.toHaveAttribute("placeholder", /faq:|msg:|char:/u);
  await input.fill("lorebook");
  await expect(omnibar.locator("[data-command-center-result-row]").first()).toBeVisible();

  // The Enter hint is a keyboard cue: visible with a fine pointer, hidden for a touch user.
  const enterHints = omnibar.locator("svg.lucide-corner-down-left:visible");
  if (touch) await expect(enterHints).toHaveCount(0);
  else await expect.poll(() => enterHints.count()).toBeGreaterThan(0);
  await omnibar.screenshot({ path: shotPath("UX-32", width) });
});

test("UX-14: a returning user's Continue row is the top row, not a Try example", async ({ page, request }, testInfo) => {
  const width = testInfo.project.name.includes("mobile") ? 390 : 1440;
  const name = `UX14 continue ${Date.now().toString(36)}`;
  // A connection clears the "No model connected yet" row, which is a `now` row and rightly leads.
  const connection = await request.post("/api/connections", {
    data: {
      name: `UX14 fixture ${Date.now().toString(36)}`,
      provider: "custom",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "fixture",
      model: "fixture",
      maxContext: 65536,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = ((await connection.json()) as { id: string }).id;
  const created = await request.post("/api/chats", { data: { name, mode: "roleplay", characterIds: [] } });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  try {
    await page.reload();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    // Enter opens the top row, so the first row in the list is the one a returning user lands on.
    const topRow = omnibar.locator("[data-command-center-result-row]").first();
    await expect(topRow).toContainText(name);
    await omnibar.screenshot({ path: shotPath("UX-14", width) });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/connections/${connectionId}`);
  }
});

test("UX-16: top-bar buttons are 44 px on a touch screen and the top bar still fits", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The 44 px touch target is a phone concern.");
  const width = 390;
  const topBar = page.locator('[data-component="TopBar"]');
  await expect(topBar).toBeVisible();
  const chats = topBar.getByRole("button", { name: "Chats", exact: true });
  await expect(chats).toBeVisible();
  const box = await chats.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  // Nothing in the bar is pushed off the phone width.
  const overflow = await topBar.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await topBar.screenshot({ path: shotPath("UX-16", width) });
});
