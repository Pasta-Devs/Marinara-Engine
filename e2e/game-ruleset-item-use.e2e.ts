import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { openGame, savedInventory, seedFight, startFight, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * Using items in a fight (#6880), on screen. In an Ember Roads game a hurt Juno carries two
 * poultices: their details say what using one does, the fight menu offers one under Items, and
 * pressing it on herself takes one out of the saved inventory. In a Gravewatch game Ada wears a bound
 * dawn bell with two of its three charges left: ringing it at the rats spends one, and the saved
 * stack keeps the count.
 */

test("a poultice is used from the Items group and is gone from the bag", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = "ember-item-use-e2e";
  // The moth is slow and sturdy tonight, so Juno's turn is the first and the fight outlasts it.
  const trouble = doc.catalogs.find((catalog: { id: string }) => catalog.id === "road_trouble");
  const moth = trouble.entries.find((entry: { id: string }) => entry.id === "cinder-moth").creature;
  moth.initiativeModifier = -20;
  moth.health = 40;
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Poultice", genre: "Fantasy", setting: "The road", tone: "Adventure" },
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
        gameInventory: [{ id: "st-poultice", name: "Poultice", quantity: 2, item: "outfitter/poultice" }],
      },
      { juno: { pools: { grit: { value: 2 } } } },
      "Wings beat in the dark ahead of the lantern.",
    );
    cleanup.push(seeded);
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Wings beat", {
      timeout: 30_000,
    });
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Poultice/ }).click();
    await expect(page.getByText("Use (Action): heals 1d4 + 1, range 0 paces, used up", { exact: true })).toBeVisible();

    await startFight(request, seeded, "Juno", {
      id: "moth",
      name: "Cinder-moth",
      creature: "road_trouble/cinder-moth",
    });
    await page.goto("/");
    const fight = page.getByRole("region", { name: "Combat decisions" });
    const poultice = page.getByRole("region", { name: "Items" }).getByRole("button", { name: /^Poultice/ });
    await expect(poultice).toBeVisible({ timeout: 60_000 });
    await expect(poultice).toContainText("2 left");
    await page.screenshot({ path: testInfo.outputPath("ruleset-item-use-menu.png"), fullPage: true });
    await poultice.click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    await page.getByRole("button", { name: /^Juno\b/ }).click();
    const used = await response;
    expect(used.ok(), await used.text()).toBeTruthy();
    expect(used.request().postDataJSON().command.optionId).toBe("use:0");
    await expect(fight.getByText("Poultice: 1 of 2 left.", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-item-used.png"), fullPage: true });
    await expect
      .poll(
        async () =>
          (await savedInventory(request, seeded.chatId)).find((stack) => stack.id === "st-poultice")?.quantity,
      )
      .toBe(1);
  });
});

test("a bound bell spends a charge and the bag keeps the count", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"));
  doc.id = "gravewatch-item-use-e2e";
  const night = doc.catalogs.find((catalog: { id: string }) => catalog.id === "night");
  const rats = night.entries.find((entry: { id: string }) => entry.id === "grave-rats").creature;
  rats.initiativeModifier = -20;
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Dawn bell", genre: "Horror", setting: "The old plots", tone: "Grim" },
      {
        gameCharacterCards: [
          {
            name: "Ada",
            rulesetSheet: { v: 1, build: { abilities: { sinew: 2, nerve: 3, warmth: 2 }, fields: {}, lists: {} } },
          },
        ],
        gameInventory: [
          {
            id: "st-bell",
            name: "Dawn bell",
            quantity: 1,
            item: "kit/dawn-bell",
            equipped: true,
            bound: true,
            charges: 2,
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
    await page.getByRole("button", { name: /^Dawn bell/ }).click();
    await expect(
      page.getByText("Use (Act): Steel save of 7 negates it, Rattled, 1 of 3 charges", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("2 of 3 charges left", { exact: true })).toBeVisible();

    await startFight(request, seeded, "Ada", { id: "rats", name: "Grave-rat swarm", creature: "night/grave-rats" });
    await page.goto("/");
    const fight = page.getByRole("region", { name: "Combat decisions" });
    const bell = page.getByRole("region", { name: "Items" }).getByRole("button", { name: /^Dawn bell/ });
    await expect(bell).toBeVisible({ timeout: 60_000 });
    await expect(bell).toContainText("2 left");
    await bell.click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    await page.getByRole("button", { name: /Grave-rat swarm/ }).click();
    const rung = await response;
    expect(rung.ok(), await rung.text()).toBeTruthy();
    await expect(fight.getByText("Dawn bell: 1 of 3 left.", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-item-charges.png"), fullPage: true });
    await expect
      .poll(async () => (await savedInventory(request, seeded.chatId)).find((stack) => stack.id === "st-bell")?.charges)
      .toBe(1);
  });
});
