import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { openGame, savedInventory, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * Charges over time (#6888), on screen. In a Gravewatch game Bram wears a bound dawn bell rung empty:
 * its details say what brings its charges back and what may break it, and standing Bram down from the
 * vigil on his sheet rings it full again, written to the saved bag with the sheet.
 */

test("a rest on the sheet brings a bell's charges back", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"));
  doc.id = "gravewatch-charges-e2e";
  await withImports(request, async (cleanup) => {
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: JSON.stringify(doc) } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const rulesetId = (await imported.json()).rulesetId as string;
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    const characterId = ((await character.json()) as { id: string }).id;
    const created = await request.post("/api/chats", {
      data: { name: "Dawn bell", mode: "game", characterIds: [characterId] },
    });
    expect(created.ok()).toBeTruthy();
    const chatId = ((await created.json()) as { id: string }).id;
    cleanup.push({ chatId, rulesetId, anchor: "" });
    try {
      const sheet = { v: 1, build: { abilities: { sinew: 1, nerve: 1, warmth: 1 }, fields: {}, lists: {} } };
      const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: {
          gameId: "ruleset-charges-e2e",
          gameSessionStatus: "active",
          gameIntroPresented: true,
          gameRuleset: { id: rulesetId, version: 1, packageId: null, options: {} },
          gamePartyCharacterIds: [characterId],
          gameCharacterCards: [
            { name: "Ada", rulesetSheet: sheet },
            { name: "Bram", rulesetSheet: sheet },
          ],
          gameInventory: [
            {
              id: "st-bell",
              name: "Dawn bell",
              quantity: 1,
              item: "kit/dawn-bell",
              holder: "Bram",
              equipped: true,
              bound: true,
              charges: 0,
            },
          ],
        },
      });
      expect(meta.ok(), await meta.text()).toBeTruthy();
      const said = await request.post(`/api/chats/${chatId}/messages`, {
        data: { role: "assistant", content: "Dawn greys the graves. The watch is over." },
      });
      expect(said.ok()).toBeTruthy();
      const state = await request.patch(`/api/chats/${chatId}/game-state`, {
        data: { manual: true, location: "The old plots", rulesetLive: {} },
      });
      expect(state.ok(), await state.text()).toBeTruthy();

      await openGame(page, chatId);
      await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Dawn greys", {
        timeout: 30_000,
      });
      await inventoryButton(page).click({ timeout: 30_000 });
      await page.getByRole("button", { name: /^Dawn bell/ }).click();
      await expect(
        page.getByText(
          "Use (Act): Steel save of 7 negates it, Rattled, spends 1 of 3 charges, regains all on Stand down from the vigil, breaks on a 1 on a d20 when emptied",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.getByText("0 of 3 charges left", { exact: true })).toBeVisible();
      await page.getByRole("heading", { name: "Inventory", exact: true }).locator("xpath=../../button").click();

      // Bram stands down from the vigil on his own sheet.
      const portrait = page
        .getByTitle("Bram - Click to open character sheet", { exact: true })
        .filter({ visible: true });
      const members = page
        .locator('.mari-window-bubble[data-window="control:character-profiles"]')
        .filter({ visible: true });
      await expect(portrait.or(members).first()).toBeVisible({ timeout: 30_000 });
      if (await members.isVisible()) await members.click();
      await portrait.first().click();
      let rests = 0;
      page.on("request", (r) => {
        if (r.url().endsWith("/api/game/inventory/rest")) rests += 1;
      });
      const rested = page.waitForResponse((r) => r.url().endsWith("/api/game/inventory/rest"));
      // A double click is one rest: the buttons wait for the Engine's answer.
      await page.getByRole("button", { name: "Stand down from the vigil for Bram", exact: true }).dblclick();
      const answer = await rested;
      expect(answer.ok(), await answer.text()).toBeTruthy();
      await expect(page.getByRole("status").filter({ hasText: "Dawn bell 3/3 charges" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("ruleset-rest-recharge.png"), fullPage: true });
      await expect
        .poll(async () => {
          const bell = (await savedInventory(request, chatId)).find((stack) => stack.id === "st-bell");
          return bell ? (bell.charges ?? "full") : "gone";
        })
        .toBe("full");
      expect(rests).toBe(1);
    } finally {
      await request.delete(`/api/characters/${characterId}`);
    }
  });
});
