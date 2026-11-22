// Back on phones and tablets in the new layout (QC panel Nov 22): it goes up one level the way you came and never
// leaves Marinara while something other than Home is on screen; turning a tablet keeps an open editor.
// Chromium's Android emulation sets the touch flag (`main.tsx`), so these run in mobile-chromium; the iPad checks
// themselves live in ipad-touch.e2e.ts (WebKit).
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const LANDSCAPE = { width: 1280, height: 800 };
const PORTRAIT = { width: 800, height: 1280 };

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Android touch emulation runs in mobile-chromium.");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    chatSettingsMoveTipDismissed: true,
  });
  // The phone and Library tours can open over a page a moment after it shows; they aren't what these tests check.
  await page.addLocatorHandler(
    page.getByRole("button", { name: /^(Skip Tutorial|Got it|I know this, skip)$/ }),
    (button) => button.click(),
  );
  await page.addInitScript((version) => {
    localStorage.setItem("marinara:whats-new:seen-version", version);
  }, APP_VERSION);
});

/** How many of the app's back entries sit above the page's own entry (0: back leaves). */
function backDepth(page: Page) {
  return page.evaluate(() => {
    const value = (history.state as Record<string, unknown> | null)?.marinaraOverlay;
    return typeof value === "number" ? value : 0;
  });
}

async function pressBack(page: Page) {
  const before = await backDepth(page);
  expect(before, "back would leave the app here").toBeGreaterThan(0);
  await page.evaluate(() => history.back());
  await expect.poll(() => backDepth(page)).toBeLessThan(before);
}

/** Opens the app and lets the phone tour show and be skipped first: skipping it later would close the page it covers. */
async function openApp(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip Tutorial" });
  await skip.waitFor({ timeout: 4000 }).catch(() => {});
  if (await skip.isVisible()) await skip.click();
  await expect(skip).toBeHidden();
}

async function makeCharacter(page: Page, name: string) {
  const response = await page.request.post("/api/characters", { data: { data: { name } }, failOnStatusCode: true });
  return ((await response.json()) as { id: string }).id;
}

test.describe("tablet held sideways (desktop shell on a touch screen)", () => {
  test.use({ viewport: LANDSCAPE });

  test("back from a Library page goes to Home, then leaves", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-component="OverhaulSidePane"]')).toBeVisible();
    expect(await backDepth(page)).toBe(0);
    const pane = page.locator('[data-component="OverhaulSidePane"]');
    await pane
      .getByRole("tab", { name: "Library" })
      .or(pane.getByRole("button", { name: "Library", exact: true }))
      .first()
      .tap();
    await pane.getByRole("button", { name: "Settings profiles" }).first().tap();
    await expect.poll(() => backDepth(page)).toBe(1);
    await pressBack(page);
    expect(await backDepth(page)).toBe(0);
  });

  test("turning to portrait and back keeps an open editor and its draft", async ({ page }) => {
    const name = `Rotate keeper ${Date.now()}`;
    const id = await makeCharacter(page, name);
    try {
      await page.goto("/");
      const pane = page.locator('[data-component="OverhaulSidePane"]');
      await pane
        .getByRole("tab", { name: "Library" })
        .or(pane.getByRole("button", { name: "Library", exact: true }))
        .first()
        .tap();
      await pane.getByRole("button", { name: "Characters" }).first().tap();
      await page.getByText(name, { exact: true }).first().tap();
      const nameField = page.locator("textarea:visible").first();
      await nameField.fill("draft-xyz");
      for (const size of [PORTRAIT, LANDSCAPE]) {
        await page.setViewportSize(size);
        await expect(page.locator("textarea:visible").first()).toHaveValue("draft-xyz");
      }
    } finally {
      await page.request.delete(`/api/characters/${id}`);
    }
  });
});

test.describe("phone", () => {
  test("a section picked from the Library list comes back to the list", async ({ page }) => {
    const name = `List return ${Date.now()}`;
    const id = await makeCharacter(page, name);
    try {
      await openApp(page);
      await page.getByRole("button", { name: "Library", exact: true }).tap();
      const sidePage = page.locator(".ovm-sidepage");
      await sidePage
        .getByRole("tab", { name: "Library" })
        .or(sidePage.getByRole("button", { name: "Library", exact: true }))
        .first()
        .tap();
      await page.locator(".ovm-stack-menu__row", { hasText: "Characters" }).tap();
      await page.getByText(name, { exact: true }).first().tap();
      await expect.poll(() => backDepth(page)).toBe(3);

      await pressBack(page); // the character → Characters
      await expect(page.locator(".ovm-stack-menu__row", { hasText: "Characters" })).toBeHidden();
      await pressBack(page); // Characters → the Library list
      await expect(page.locator(".ovm-stack-menu__row", { hasText: "Characters" })).toBeVisible();
      await pressBack(page); // the list → Home
      expect(await backDepth(page)).toBe(0);
    } finally {
      await page.request.delete(`/api/characters/${id}`);
    }
  });

  // QC Nov 22: one back from an editor over Characters left the app. Each page on the stack keeps its own entry, so
  // a press while a save is still in flight, and the press after it, both stay inside Marinara.
  test("back while an editor saves, then back again, never leaves the app", async ({ page }) => {
    const name = `Save in flight ${Date.now()}`;
    const id = await makeCharacter(page, name);
    try {
      await openApp(page);
      await page.getByRole("button", { name: "Library", exact: true }).tap();
      const sidePage = page.locator(".ovm-sidepage");
      await sidePage
        .getByRole("tab", { name: "Library" })
        .or(sidePage.getByRole("button", { name: "Library", exact: true }))
        .first()
        .tap();
      await page.locator(".ovm-stack-menu__row", { hasText: "Characters" }).tap();
      await page.getByText(name, { exact: true }).first().tap();
      await page.locator("textarea:visible").first().fill(`${name} edited`);
      // Hold the save so the back presses land while it is in flight.
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(`**/api/characters/${id}`, async (route) => {
        if (route.request().method() === "GET") return route.continue();
        await held;
        await route.continue();
      });
      await page.getByRole("button", { name: "Save", exact: true }).tap();
      await pressBack(page);
      release();
      await pressBack(page);
      // Characters is closed and the Library list is back; nothing has left the app.
      await expect(page.locator(".ovm-stack-menu__row", { hasText: "Characters" })).toBeVisible();
      expect(await backDepth(page)).toBeGreaterThan(0);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.request.delete(`/api/characters/${id}`);
    }
  });
});
