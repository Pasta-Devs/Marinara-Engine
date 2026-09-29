import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * What an item does in a fight (#6857), on screen: a Gravewatch game whose warden wears the widow's
 * ring and the Dawn bell, both bound. The ring's details say it costs a die on attacks, and the bell's
 * that it helps Ward and keeps its bearer from being rattled, in the same localized lines as what an
 * item does to a check.
 */
test("an item's details say what it does in a fight", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"));
  doc.id = "gravewatch-armor-e2e";
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId = "";
  let rulesetId = "";
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: JSON.stringify(doc) } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId as string;
    const chat = await request.post("/api/chats", {
      data: { name: "Armor in a fight", mode: "game", characterIds: [] },
    });
    expect(chat.ok()).toBeTruthy();
    chatId = (await chat.json()).id;
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: chatId,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameRuleset: { id: rulesetId, version: 1, packageId: null, options: {} },
        gameCharacterCards: [
          {
            name: "Ada",
            rulesetSheet: { v: 1, build: { abilities: { sinew: 2, nerve: 3, warmth: 2 }, fields: {}, lists: {} } },
          },
        ],
        gameInventory: [
          { id: "st-ring", name: "Widow's ring", quantity: 1, item: "kit/widows-ring", equipped: true, bound: true },
          { id: "st-bell", name: "Dawn bell", quantity: 1, item: "kit/dawn-bell", equipped: true, bound: true },
        ],
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: "The lych-gate creaks in the wind off the barrows." },
        })
      ).ok(),
    ).toBeTruthy();

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
    });
    await page.addInitScript(
      ({ id, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { id: chatId, appVersion: version },
    );
    await page.goto("/");
    const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(narration).toContainText("The lych-gate creaks", { timeout: 30_000 });

    await inventoryButton(page).click({ timeout: 30_000 });
    await page
      .getByRole("button", { name: /^Widow's ring/ })
      .first()
      .click();
    await expect(page.getByText("While worn: -1 on attacks", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: /^Dawn bell/ })
      .first()
      .click();
    await expect(page.getByText("While worn: +1 on checks (Ward); immune to Rattled", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-armor-details.png") });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
