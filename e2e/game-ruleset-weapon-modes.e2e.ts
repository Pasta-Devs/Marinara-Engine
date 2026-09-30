import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { openGame, savedInventory, seedFight, startFight, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * Fire modes and off-hand attacks (#6875), on screen. In an Ember Roads game Juno's hunting bow says
 * it can loose a volley, the fight menu asks how it is used, and a volley takes two arrows out of the
 * saved inventory. In a Gravewatch game Ada holds a silver nail in each hand: once the first has
 * struck, the other is offered on the quick budget as her off hand. A fight names each by the item
 * it is, whatever the player calls the stack, so the second is "Silver coffin nail, off hand".
 */

test("a bow asks how it is used, and a volley shoots two arrows", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = "ember-modes-e2e";
  // The moth is slow and sturdy tonight, so Juno's turn is the first and the fight outlasts it.
  const trouble = doc.catalogs.find((catalog: { id: string }) => catalog.id === "road_trouble");
  const moth = trouble.entries.find((entry: { id: string }) => entry.id === "cinder-moth").creature;
  moth.initiativeModifier = -20;
  moth.health = 40;
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Volley", genre: "Fantasy", setting: "The road", tone: "Adventure" },
      {
        gameCharacterCards: [
          {
            name: "Juno",
            rulesetSheet: {
              v: 1,
              build: { abilities: { brawn: 1, wits: 3, heart: 0 }, fields: { toughness: 6 }, lists: {} },
            },
          },
        ],
        gameInventory: [
          { id: "st-bow", name: "Hunting bow", quantity: 1, item: "outfitter/hunting-bow", equipped: true },
          { id: "st-arrows", name: "Arrows", quantity: 4, item: "outfitter/arrows" },
        ],
      },
      { juno: { pools: { grit: { value: 11 } } } },
      "Wings beat in the dark ahead of the lantern.",
    );
    cleanup.push(seeded);
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Wings beat", {
      timeout: 30_000,
    });
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: "Hunting bow, worn", exact: true }).click();
    await expect(page.getByText("Modes: Volley (2 shots, -2 to hit, up to 2 targets)", { exact: true })).toBeVisible();

    await startFight(request, seeded, "Juno", {
      id: "moth",
      name: "Cinder-moth",
      creature: "road_trouble/cinder-moth",
    });
    await page.goto("/");
    const bow = page.getByRole("button", { name: /^Hunting bow/ });
    await expect(bow).toBeVisible({ timeout: 60_000 });
    await bow.click();
    await expect(page.getByText("How is Hunting bow used?")).toBeVisible();
    await expect(page.getByRole("button", { name: /^As it is/ })).toBeVisible();
    const volley = page.getByRole("button", { name: /^Volley/ });
    await expect(volley).toContainText("up to 2 targets");
    await page.screenshot({ path: testInfo.outputPath("ruleset-modes-step.png"), fullPage: true });
    await volley.click();
    await expect(page.getByText("Choose up to 2 targets for Hunting bow, then confirm.")).toBeVisible();
    await page.getByRole("button", { name: /Cinder-moth/ }).click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    await page.getByRole("button", { name: "Confirm 1" }).click();
    const loosed = await response;
    expect(loosed.ok(), await loosed.text()).toBeTruthy();
    expect(loosed.request().postDataJSON().command.mode).toBe("volley");
    const fight = page.getByRole("region", { name: "Combat decisions" });
    await expect(fight.getByText(/^Juno attacks Cinder-moth with Hunting bow \(Volley\): /u)).toBeVisible();
    await expect(fight.getByText("Hunting bow (Volley): 2 left to shoot.", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-modes-volley.png"), fullPage: true });
    await expect
      .poll(
        async () => (await savedInventory(request, seeded.chatId)).find((stack) => stack.id === "st-arrows")?.quantity,
      )
      .toBe(2);
  });
});

test("a nail in the other hand strikes on the quick budget after the first", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"));
  doc.id = "gravewatch-offhand-e2e";
  const night = doc.catalogs.find((catalog: { id: string }) => catalog.id === "night");
  const rats = night.entries.find((entry: { id: string }) => entry.id === "grave-rats").creature;
  rats.initiativeModifier = -20;
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Two nails", genre: "Horror", setting: "The old plots", tone: "Grim" },
      {
        gameCharacterCards: [
          {
            name: "Ada",
            rulesetSheet: { v: 1, build: { abilities: { sinew: 2, nerve: 3, warmth: 2 }, fields: {}, lists: {} } },
          },
        ],
        gameInventory: [
          { id: "st-nail", name: "Silver coffin nail", quantity: 1, item: "kit/silver-nail", equipped: true },
          {
            id: "st-left",
            name: "Silver coffin nail",
            nickname: "Left nail",
            quantity: 1,
            item: "kit/silver-nail",
            equipped: true,
          },
        ],
      },
      {},
      "Something stirs between the graves.",
    );
    cleanup.push(seeded);
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Something stirs", {
      timeout: 30_000,
    });
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Left nail/ }).click();
    await expect(
      page.getByText("Off hand (Quick), Marked for 2 rounds when a hit deals 2 or more", { exact: true }),
    ).toBeVisible();

    await startFight(request, seeded, "Ada", { id: "rats", name: "Grave-rat swarm", creature: "night/grave-rats" });
    await page.goto("/");
    // Nothing in the off hand until the first nail has struck.
    const first = page.getByRole("button", { name: /^Silver coffin nail/ }).first();
    await expect(first).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /off hand/ })).toHaveCount(0);
    await first.click();
    const struck = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    await page.getByRole("button", { name: /Grave-rat swarm/ }).click();
    expect((await struck).ok()).toBeTruthy();
    const offHand = page.getByRole("button", { name: /^Silver coffin nail, off hand/ });
    await expect(offHand).toHaveCount(1);
    await expect(offHand).toContainText("Spends Quick");
    await page.screenshot({ path: testInfo.outputPath("ruleset-offhand-menu.png"), fullPage: true });
    await offHand.click();
    const second = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    await page.getByRole("button", { name: /Grave-rat swarm/ }).click();
    const answered = await second;
    expect(answered.ok(), await answered.text()).toBeTruthy();
    expect(answered.request().postDataJSON().command.optionId).toMatch(/^offhand:/);
    const fight = page.getByRole("region", { name: "Combat decisions" });
    await expect(offHand).toHaveCount(0, { timeout: 30_000 });
    await expect(fight.getByText(/^Ada attacks Grave-rat swarm with Silver coffin nail: /u)).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("ruleset-offhand-struck.png"), fullPage: true });
  });
});
