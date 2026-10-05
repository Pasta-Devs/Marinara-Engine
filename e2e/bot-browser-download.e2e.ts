import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const cardName = "Download regression card";

// Browser translators replace React's text nodes with their own markup.
async function translateButton(button: Locator) {
  await button.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.trim()) nodes.push(walker.currentNode as Text);
    }
    for (const node of nodes) {
      const translation = document.createElement("font");
      translation.textContent = node.textContent;
      node.replaceWith(translation);
    }
    if (!nodes.length) throw new Error("Missing action label to translate");
  });
}

for (const action of ["Import", "Download as PNG"] as const) {
  test(`first and repeated ${action} survive translated action labels`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentPulseMode: false,
      theme: action === "Import" ? "dark" : "light",
    });
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }, version);
    await page.route("**/api/bot-browser/chub/search?*", (route) =>
      route.fulfill({ json: { data: { count: 0, nodes: [] } } }),
    );
    await page.route("**/api/bot-browser/wyvern/search?*", (route) =>
      route.fulfill({
        json: {
          total: 1,
          results: [{ id: "download-proof", name: cardName, avatar: "fixture", tags: [], rating: "none" }],
        },
      }),
    );
    await page.route("**/api/bot-browser/wyvern/avatar/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlfsAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.route("**/api/bot-browser/wyvern/character/download-proof", (route) =>
      route.fulfill({ json: { name: cardName, description: "A character for the download regression." } }),
    );
    let imports = 0;
    await page.route("**/api/import/st-character", (route) => {
      imports++;
      return route.fulfill({ json: { success: true, name: cardName } });
    });

    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openBotBrowser();
    });
    const browser = page.locator('[data-component="BotBrowserView"]');
    await browser.getByRole("button", { name: /ChubAI/u }).click();
    await page.getByRole("button", { name: /Wyvern/u }).click();
    await browser.getByRole("button", { name: new RegExp(cardName, "u") }).click();
    const button = browser.getByRole("button", { name: action, exact: true });
    await expect(button).toBeVisible();

    for (let attempt = 0; attempt < 2; attempt++) {
      await translateButton(button);
      if (action === "Import") {
        await button.click();
        const dialog = page.locator('[data-component="BotBrowserImportDialog"]');
        await dialog.getByRole("button", { name: /Import as Character/u }).click();
        await expect(page.getByRole("dialog", { name: "Import Card", exact: true })).toBeHidden();
        expect(imports).toBe(attempt + 1);
      } else {
        const downloadPromise = page.waitForEvent("download");
        await button.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe("Download_regression_card.png");
        expect(await download.failure()).toBeNull();
      }
      await expect(button).toBeEnabled();
      await expect(page.getByText("Marinara hit a recoverable UI error.")).toHaveCount(0);
      expect(errors).toEqual([]);
    }
    const screenshot = testInfo.outputPath("character-download-after.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("character-download-after", { path: screenshot, contentType: "image/png" });
  });
}

test("CharacterTavern explains it is unavailable without contacting the site", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const characterTavernRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/chartavern|character-tavern\.com/u.test(request.url())) characterTavernRequests.push(request.url());
  });
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    // Browser state left behind by a CharacterTavern login before the integration was removed.
    localStorage.setItem(
      "marinara-bot-browser",
      JSON.stringify({ nsfw: { chartavern: true }, logins: { chartavern: true }, lastSource: "chartavern" }),
    );
  }, version);
  // Hold the opening ChubAI search so it finishes after the user has switched source.
  let releaseChubSearch = () => {};
  const chubSearchReleased = new Promise<void>((resolve) => (releaseChubSearch = resolve));
  await page.route("**/api/bot-browser/chub/search?*", async (route) => {
    await chubSearchReleased;
    await route.fulfill({ json: { data: { count: 4321, nodes: [] } } });
  });
  await page.route("**/api/bot-browser/wyvern/search?*", (route) => route.fulfill({ json: { results: [], total: 0 } }));
  const openCardBrowser = () =>
    page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openBotBrowser();
    });

  await page.goto("/");
  await openCardBrowser();
  const browser = page.locator('[data-component="BotBrowserView"]');
  const header = browser.locator("header");
  await browser.getByRole("button", { name: /ChubAI/u }).click();
  const wyvernSearch = page.waitForResponse("**/api/bot-browser/wyvern/search?*");
  await page.getByRole("button", { name: /Wyvern/u }).click();
  await wyvernSearch;
  const staleChubSearch = page.waitForResponse("**/api/bot-browser/chub/search?*");
  releaseChubSearch();
  await staleChubSearch;
  await page.waitForTimeout(300);
  await expect(header).toContainText("Browsing Wyvern");
  await expect(header).not.toContainText("4,321");

  await browser.getByRole("button", { name: /Wyvern/u }).click();
  await expect(page.getByRole("button", { name: /CharacterTavern.*Unavailable/u })).toBeVisible();
  await page.getByRole("button", { name: /CharacterTavern/u }).click();

  const notice = browser.locator('[data-component="BotBrowserProviderUnavailable"]');
  await expect(notice).toContainText("CharacterTavern can't be browsed here for now");
  await expect(notice).toContainText("Browsing may return if CharacterTavern offers API access.");
  await expect(notice.getByRole("link", { name: "Open CharacterTavern" })).toHaveAttribute(
    "href",
    "https://character-tavern.com",
  );
  await expect(browser.getByPlaceholder("Search characters")).toHaveCount(0);
  await expect(browser.getByRole("button", { name: "Log In" })).toHaveCount(0);
  await expect(header).not.toContainText("Browsing CharacterTavern");
  const screenshot = testInfo.outputPath("chartavern-unavailable.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("chartavern-unavailable", { path: screenshot, contentType: "image/png" });

  await notice.getByRole("button", { name: "Import Character" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import Character", exact: true });
  await expect(importDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(importDialog).toBeHidden();

  // The source choice is not saved, so a reload returns to the default site instead of a blank page.
  await page.reload();
  await openCardBrowser();
  await expect(browser.getByRole("button", { name: /ChubAI/u })).toBeVisible();
  await expect(browser.getByPlaceholder("Search characters")).toBeVisible();
  await expect(page.getByText(/CharacterTavern session expired/u)).toHaveCount(0);
  expect(characterTavernRequests).toEqual([]);
  expect(errors).toEqual([]);
});
