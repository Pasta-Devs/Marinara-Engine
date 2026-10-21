import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const guidanceSelector = '[data-component="ProfessorMari.ConnectionGuidance"]';
const contextRecommendation = "I'd recommend 32k tokens as the practical minimum for me, with 64k preferred.";
const tierRecommendations = [
  "16k: tight; only for short questions and small edits.",
  "32k: a reasonable starting point for everyday use.",
  "64k: more room for character cards, lorebooks, tool results, and longer tasks.",
  "128k: useful for extensive work, but unnecessary as a minimum.",
];

test.beforeEach(() => acquireMariThreadLock());
test.afterEach(() => releaseMariThreadLock());

for (const theme of ["dark", "light"] as const) {
  test(`Mari explains connection and context choices before setup and in her picker (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    let availableConnections: unknown[] = [];
    let connectionId = "";
    let chatId = "";
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/connections", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: availableConnections }) : route.continue(),
    );
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    // Her connection is a server setting now.
    await page.route("**/api/app-settings/feature-model-connections", (route) =>
      route.fulfill({
        json: {
          mariConnectionId: null,
          omnibarAsideConnectionId: null,
          impersonateConnectionId: null,
          visionConnectionId: null,
        },
      }),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme,
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    const openMari = async () => {
      await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible();
      await page.getByRole("button", { name: "Ask Professor Mari", exact: true }).click();
    };
    const pane = page.locator('[data-component="GlobalOmnibar.Mari"]:not([aria-hidden="true"])');
    try {
      const chat = await request.get("/api/chats/internal/professor-mari");
      expect(chat.ok()).toBeTruthy();
      chatId = (await chat.json()).id;
      await page.goto("/");
      await openMari();
      const transcriptGuidance = pane
        .locator('[data-component="HomeProfessorMariChat.Transcript"]')
        .locator(guidanceSelector);
      await expect(transcriptGuidance).toBeVisible();
      await expect(transcriptGuidance).toContainText('clicking the "chains" icon in the input box below');
      await expect(transcriptGuidance).toContainText(contextRecommendation);
      await expect(transcriptGuidance.locator("li")).toHaveCount(4);
      await expect(transcriptGuidance.locator("li")).toHaveText(tierRecommendations);
      await transcriptGuidance
        .getByText("128k: useful for extensive work, but unnecessary as a minimum.", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`guidance-start-${theme}.png`) });
      await pane.getByRole("button", { name: "Select connection", exact: true }).click();
      const picker = pane.locator(".mari-connection-picker");
      await expect(picker.getByRole("button", { name: "Add a connection" })).toBeVisible();
      await expect(picker.locator(guidanceSelector)).toContainText(contextRecommendation);
      await expect(picker.locator(guidanceSelector).locator("li")).toHaveText(tierRecommendations);
      await expect(picker.locator(guidanceSelector)).not.toContainText('clicking the "chains" icon');
      await picker
        .locator(guidanceSelector)
        .getByText("128k: useful for extensive work, but unnecessary as a minimum.", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`guidance-picker-${theme}.png`) });

      const created = await request.post("/api/connections", {
        data: {
          name: "Mari guidance fixture",
          provider: "custom",
          baseUrl: "http://127.0.0.1:9/v1",
          model: "fixture",
          maxContext: 65536,
        },
      });
      expect(created.ok()).toBeTruthy();
      const connection = await created.json();
      connectionId = connection.id;
      availableConnections = [connection];
      await page.reload();
      await openMari();
      await expect(pane.getByRole("button", { name: "Connection: Mari guidance fixture", exact: true })).toBeVisible();
      await expect(
        pane.locator('[data-component="HomeProfessorMariChat.Transcript"]').locator(guidanceSelector),
      ).toHaveCount(0);
      await pane.getByRole("button", { name: "Connection: Mari guidance fixture", exact: true }).click();
      await expect(picker.locator(guidanceSelector)).toContainText(contextRecommendation);
      await expect(picker.locator(guidanceSelector).locator("li")).toHaveText(tierRecommendations);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      expect(errors).toEqual([]);
    } finally {
      if (chatId) await request.delete(`/api/chats/internal/professor-mari/chats/${chatId}`);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`);
    }
  });
}
