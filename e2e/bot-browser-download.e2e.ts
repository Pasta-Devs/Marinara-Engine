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
    await translateButton(button);

    for (let attempt = 0; attempt < 2; attempt++) {
      if (action === "Import") {
        await button.click();
        const dialog = page.locator('[data-component="BotBrowserImportDialog"]');
        await dialog.getByRole("button", { name: /Import as Character/u }).click();
        await expect(dialog).toBeHidden();
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
    await testInfo.attach("character-download-after", { body: await page.screenshot(), contentType: "image/png" });
  });
}
