import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { crc32 } from "node:zlib";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const cardName = "Download regression card";

for (const authoredSummary of [true, false]) {
  test(`import as Persona preserves downloaded dialogue and ${authoredSummary ? "authored summary" : "an absent summary"}`, async ({
    page,
    request,
  }, info) => {
    const name = `Persona card ${authoredSummary ? "summary" : "no summary"} ${info.testId}`;
    const description = "A full card description that must never become the metadata summary.";
    const summary = authoredSummary ? "  An authored metadata summary from the downloaded card.\n" : "";
    const dialogue = " \n<START>\n{{char}}: Observe the stars, {{user}}.\n{{user}}: I will record every result.\n  ";
    const avatar = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlfsAAAAASUVORK5CYII=",
      "base64",
    );
    const json = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name,
        description,
        ...(authoredSummary ? { summary } : {}),
        mes_example: dialogue,
        personality: "Curious and careful.",
        scenario: "An observatory.",
        creator: "Fixture author",
        tags: [],
        extensions: {
          cardFieldAlternatives: [
            {
              id: "imported-description",
              field: "description",
              value: "An alternate authored description.",
              chatIds: ["foreign-chat"],
            },
            { id: "imported-appearance", field: "appearance", value: "", chatIds: ["foreign-chat", "another-chat"] },
          ],
        },
      },
    };
    const metadata = Buffer.from(`chara\0${Buffer.from(JSON.stringify(json)).toString("base64")}`);
    const portableAlternatives = [
      {
        id: "imported-description",
        field: "description",
        value: "An alternate authored description.",
        chatIds: [],
      },
      { id: "imported-appearance", field: "appearance", value: "", chatIds: [] },
    ];
    const chunk = Buffer.alloc(metadata.length + 12);
    chunk.writeUInt32BE(metadata.length);
    chunk.write("tEXt", 4, "ascii");
    metadata.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
    const png = Buffer.concat([avatar.subarray(0, 33), chunk, avatar.subarray(33)]);
    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentPulseMode: false,
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    // The external source is fully synthetic; persona creation and persistence use the real server.
    await page.route("**/api/bot-browser/**", (route) =>
      route.fulfill({ status: 404, json: { error: "No external fixture route" } }),
    );
    await page.route("**/api/bot-browser/chub/search?*", (route) =>
      route.fulfill({
        json: {
          data: {
            count: 1,
            nodes: [
              {
                fullPath: "fixture/persona-import",
                name,
                tagline: "A listing blurb is not an authored summary.",
                topics: [],
                nTokens: 80,
              },
            ],
          },
        },
      }),
    );
    await page.route("**/api/bot-browser/chub/character/fixture/persona-import", (route) =>
      route.fulfill({
        json: {
          data: {
            node: {
              definition: {
                personality: description,
              },
            },
          },
        },
      }),
    );
    await page.route("**/api/bot-browser/chub/avatar/fixture/persona-import", (route) =>
      route.fulfill({ contentType: "image/png", body: avatar }),
    );
    await page.route("**/api/bot-browser/chub/download/fixture/persona-import", (route) =>
      route.fulfill({ contentType: "image/png", body: png }),
    );
    let posted: Record<string, unknown> | undefined;
    await page.route("**/api/characters/personas", async (route) => {
      if (route.request().method() === "POST") posted = route.request().postDataJSON() as Record<string, unknown>;
      await route.continue();
    });
    let personaId: string | undefined;
    try {
      await page.goto("/");
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openBotBrowser();
      });
      const browser = page.locator('[data-component="BotBrowserView"]');
      await browser.getByRole("button", { name: new RegExp(name, "u") }).click();
      await browser.getByRole("button", { name: "Import", exact: true }).click();
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/characters/personas" && response.request().method() === "POST",
      );
      await page
        .locator('[data-component="BotBrowserImportDialog"]')
        .getByRole("button", { name: /Import as Persona/u })
        .click();
      const response = await responsePromise;
      expect(response.ok(), await response.text()).toBeTruthy();
      personaId = ((await response.json()) as { id: string }).id;
      expect(posted).toMatchObject({ name, summary, mes_example: dialogue });
      expect(posted?.cardFieldAlternatives).toEqual(portableAlternatives);
      const saved = await request.get(`/api/characters/personas/${personaId}`);
      expect(saved.ok()).toBeTruthy();
      expect(await saved.json()).toMatchObject({ name, description, summary, mes_example: dialogue });
      expect((await saved.json()).cardFieldAlternatives).toEqual(portableAlternatives);
    } finally {
      if (personaId) await request.delete(`/api/characters/personas/${personaId}`);
    }
  });
}

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
  const characterTavern = page.getByRole("button", { name: /CharacterTavern.*Unavailable/u });
  await expect(characterTavern).toBeVisible();
  // Every source name starts at the same x, whatever glyph its icon is (ChubAI uses ✦), and the
  // Unavailable label sits under the name, fully inside the menu, even on a phone (#7525).
  const menu = characterTavern.locator("xpath=..");
  const nameLefts = await menu.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const name = Array.from(button.querySelectorAll("span")).find(
        (span) =>
          !span.children.length && /\p{L}{3}/u.test(span.textContent ?? "") && span.textContent !== "Unavailable",
      );
      return name ? Math.round(name.getBoundingClientRect().left) : -1;
    }),
  );
  expect(nameLefts.length).toBeGreaterThan(5);
  expect(new Set(nameLefts).size).toBe(1);
  await characterTavern.scrollIntoViewIfNeeded();
  const nameBox = await characterTavern.getByText("CharacterTavern", { exact: true }).boundingBox();
  const badgeBox = await characterTavern.getByText("Unavailable", { exact: true }).boundingBox();
  const menuBox = await menu.boundingBox();
  expect(nameBox && badgeBox && menuBox).toBeTruthy();
  expect(badgeBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 1);
  expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(menuBox!.x + menuBox!.width);
  expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(menuBox!.y + menuBox!.height);
  await testInfo.attach("source-menu", { body: await menu.screenshot(), contentType: "image/png" });
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
