import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { inventoryButton } from "./game-inventory-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * Wearing and carrying a ruleset's items (#6801): an item added in the shared view goes to whoever can
 * carry it, each bag shows its load and slots, an item is put on with Equipped, a stack dragged onto
 * one in a full bag stays put, and a bound cursed item stays bound. Each run imports the example
 * rulesets under ids of its own and removes them after.
 */
function example(file: string, id: string, edit: (doc: Record<string, any>) => void = () => {}): string {
  const doc = JSON.parse(readFileSync(new URL(`../docs/examples/rulesets/${file}.json`, import.meta.url), "utf8"));
  doc.id = id;
  edit(doc);
  return JSON.stringify(doc);
}

async function seedGame(
  request: APIRequestContext,
  rulesetId: string,
  cards: unknown[],
  partyCharacterIds: string[],
): Promise<string> {
  const created = await request.post("/api/chats", {
    data: { name: "Wearing and carrying", mode: "game", characterIds: partyCharacterIds },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: {
      gameId: `ruleset-wearing-${rulesetId}`,
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameRuleset: { id: rulesetId, version: 1, packageId: null, options: {} },
      gamePartyCharacterIds: partyCharacterIds,
      gameCharacterCards: cards,
      gameInventory: [],
    },
  });
  expect(meta.ok(), await meta.text()).toBeTruthy();
  const saved = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "The caravan waits at the outfitter's stall." },
  });
  expect(saved.ok()).toBeTruthy();
  return chat.id;
}

async function openGame(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
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
}

async function openInventory(page: Page, chatId: string) {
  await openGame(page, chatId);
  await inventoryButton(page).click({ timeout: 30000 });
}

async function pick(page: Page, names: string[]) {
  await page.getByRole("button", { name: "From the ruleset", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add items from the ruleset" });
  for (const name of names) await picker.getByRole("checkbox", { name, exact: true }).check();
  await picker.getByRole("button", { name: names.length === 1 ? "Add 1 item" : `Add ${names.length} items` }).click();
  await expect(picker).toBeHidden();
}

test("a ruleset's items are placed by who can carry them, worn with Equipped, and a cursed one stays bound", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  const chats: string[] = [];
  const rulesets: string[] = [];
  let characterId: string | undefined;
  const importRuleset = async (definition: string) => {
    const imported = await request.post("/api/game-rulesets/import", { data: { definition } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const rulesetId = (await imported.json()).rulesetId as string;
    rulesets.push(rulesetId);
    return rulesetId;
  };
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;

    // Ember Roads: a traveller carries 6 + Brawn before the road slows them, 12 at most. The first card
    // is the player's (Brawn 0, so 6); Bram's Brawn is 3 (9).
    const sheet = (brawn: number) => ({
      v: 1,
      build: { abilities: { brawn, wits: 0, heart: 0 }, fields: {}, lists: {} },
    });
    const roadId = await seedGame(
      request,
      await importRuleset(example("ember-roads", "ember-wearing-e2e")),
      [
        { name: "Ada", rulesetSheet: sheet(0) },
        { name: "Bram", rulesetSheet: sheet(3) },
      ],
      [characterId],
    );
    chats.push(roadId);
    const savedInventory = async () => {
      const row = await (await request.get(`/api/chats/${roadId}`)).json();
      const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      return (
        metadata.gameInventory as Array<{ name: string; quantity: number; holder?: string; equipped?: boolean }>
      ).map((stack) => `${stack.name} ${stack.quantity} ${stack.holder ?? "player"}${stack.equipped ? " worn" : ""}`);
    };
    await openInventory(page, roadId);
    const slot = (label: string) => page.getByRole("button", { name: label, exact: true });
    const tab = (name: string) => page.getByRole("button", { name: `${name}'s things`, exact: true });

    // The shared view shows each bag's load against what its bearer carries without strain.
    await expect(page.getByText("Bram: 0/9", { exact: true })).toBeVisible();
    // The bow and the coat fit the player (Bulk 2 + 3 of 6), added in the catalog's order...
    await pick(page, ["Leather coat", "Hunting bow"]);
    await expect.poll(savedInventory).toEqual(["Hunting bow 1 player", "Leather coat 1 player"]);
    // ...and a second coat does not, so it goes to Bram.
    await pick(page, ["Leather coat"]);
    await expect.poll(savedInventory).toEqual(["Hunting bow 1 player", "Leather coat 1 player", "Leather coat 1 Bram"]);
    await expect(page.getByText("Bram gained Leather coat!", { exact: true })).toBeVisible();
    await expect(page.getByText("Bram: 3/9", { exact: true })).toBeVisible();

    // In the player's own bag: its load and slots, and Equipped puts an item on.
    await page.getByRole("button", { name: "All", exact: true }).click();
    const playerTab = page.getByRole("button", { name: /'s things$/ }).first();
    await playerTab.click();
    await expect(page.getByText("Load 5/6, at most 12", { exact: true })).toBeVisible();
    await expect(page.getByText("Body 0/1", { exact: true })).toBeVisible();
    await slot("Leather coat").click();
    await page.getByRole("button", { name: "Equipped", exact: true }).click();
    await expect(page.getByRole("button", { name: "Equipped", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(slot("Leather coat, worn")).toBeVisible();
    await expect(page.getByText("Body 1/1", { exact: true })).toBeVisible();
    await slot("Hunting bow").click();
    await page.getByRole("button", { name: "Equipped", exact: true }).click();
    await expect(page.getByText("Hands 2/2", { exact: true })).toBeVisible();
    await expect
      .poll(savedInventory)
      .toEqual(["Hunting bow 1 player worn", "Leather coat 1 player worn", "Leather coat 1 Bram"]);
    await page.screenshot({ path: testInfo.outputPath("ruleset-wearing.png") });
    await expect(tab("Bram")).toBeVisible();

    // Dragging a stack onto one in somebody else's bag hands it over, so it is held to what they can
    // carry, like Give: Bram's coat and nine arrows are his twelve, and two more arrows are refused.
    const row = await (await request.get(`/api/chats/${roadId}`)).json();
    const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    const arrows = { name: "Arrows", item: "outfitter/arrows" };
    const heavier = await request.patch(`/api/chats/${roadId}/metadata`, {
      data: {
        gameInventory: [
          ...metadata.gameInventory,
          { ...arrows, id: "st-bram-arrows", quantity: 9, holder: "Bram" },
          { ...arrows, id: "st-my-arrows", quantity: 2 },
        ],
      },
    });
    expect(heavier.ok(), await heavier.text()).toBeTruthy();
    await page.reload();
    await inventoryButton(page).click({ timeout: 30000 });
    await page.getByRole("button", { name: "All", exact: true }).click();
    const from = await page.getByRole("button", { name: /^Arrows x2, carried by / }).boundingBox();
    const onto = await slot("Arrows x9, carried by Bram").boundingBox();
    expect(from && onto).toBeTruthy();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + from!.height / 2, { steps: 4 });
    await page.mouse.move(onto!.x + onto!.width / 2, onto!.y + onto!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByText("Bram cannot carry Arrows.", { exact: true })).toBeVisible();
    await expect
      .poll(savedInventory)
      .toEqual([
        "Hunting bow 1 player worn",
        "Leather coat 1 player worn",
        "Leather coat 1 Bram",
        "Arrows 9 Bram",
        "Arrows 2 player",
      ]);

    // Gravewatch: the Widow's ring binds and is cursed. Bound, it says so, and the player cannot
    // unbind it. On a page of its own, so the first page's start-up script cannot reopen the first game.
    const watchId = await seedGame(
      request,
      await importRuleset(example("gravewatch", "gravewatch-wearing-e2e")),
      [
        {
          name: "Ada",
          rulesetSheet: { v: 1, build: { abilities: { sinew: 1, nerve: 1, warmth: 1 }, fields: {}, lists: {} } },
        },
      ],
      [],
    );
    chats.push(watchId);
    const watchPage = await page.context().newPage();
    await openInventory(watchPage, watchId);
    await watchPage.getByLabel("Name of the item to add", { exact: true }).fill("Widow's ring");
    await watchPage.getByRole("button", { name: "Add", exact: true }).click();
    const bound = watchPage.getByRole("button", { name: "Bound", exact: true });
    await bound.click();
    await expect(bound).toHaveAttribute("aria-pressed", "true");
    await expect(watchPage.getByRole("button", { name: "Widow's ring, Bound", exact: true })).toBeVisible();
    await expect(watchPage.getByText("Cursed: it stays bound.", { exact: true })).toBeVisible();
    // Ada's Nerve is 1: the screen reads the same sheet for the player as the server does.
    await expect(watchPage.getByText("Bound 1/1", { exact: true })).toBeVisible();
    await bound.click();
    await expect(
      watchPage.getByText("Widow's ring is cursed and stays with whoever it is bound to.", { exact: true }),
    ).toBeVisible();
    await expect(bound).toHaveAttribute("aria-pressed", "true");
    await watchPage.screenshot({ path: testInfo.outputPath("ruleset-binding.png") });
    await watchPage.close();
  } finally {
    for (const id of chats) await request.delete(`/api/chats/${id}`);
    for (const id of rulesets) {
      await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(id)}&force=true`);
    }
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});

test("a worn item counts on the in-game sheet, and one in the pack does not", async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId: string | undefined;
  let rulesetId: string | undefined;
  let characterId: string | undefined;
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", {
      data: { definition: example("ember-roads", "ember-sheet-items-e2e") },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId as string;
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;
    const sheet = { v: 1, build: { abilities: { brawn: 0, wits: 0, heart: 0 }, fields: {}, lists: {} } };
    chatId = await seedGame(
      request,
      rulesetId,
      [
        { name: "Ada", rulesetSheet: sheet },
        { name: "Bram", rulesetSheet: sheet },
      ],
      [characterId],
    );
    // Bram carries a leather coat, rolled up in his pack. Guard on Ember Roads is 6 + Wits, and the
    // armor worn adds its own.
    const seeded = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameInventory: [
          { id: "st-bram-coat", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat", holder: "Bram" },
        ],
      },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();

    // The sheet's summary card: its label, then its number.
    const guard = () => page.getByText("Guard", { exact: true }).locator("xpath=following-sibling::span[1]");
    const closeSheet = page.getByRole("button", { name: "Close character sheet", exact: true });
    // Both layouts open party portraits from the shared Character Profiles button.
    const openBramsSheet = async () => {
      const portrait = page
        .getByTitle("Bram - Click to open character sheet", { exact: true })
        .filter({ visible: true });
      const members = page
        .locator('.mari-window-bubble[data-window="control:character-profiles"]')
        .filter({ visible: true });
      await expect(portrait.or(members).first()).toBeVisible({ timeout: 30000 });
      if (await members.isVisible()) await members.click();
      await portrait.first().click();
      await expect(guard()).toBeVisible();
    };
    await openGame(page, chatId);
    await openBramsSheet();
    await expect(guard()).toHaveText("6");
    await closeSheet.click();
    await expect(guard()).toBeHidden();

    // He puts it on in the inventory, and his sheet reads it.
    await inventoryButton(page).click({ timeout: 30000 });
    await page.getByRole("button", { name: "Bram's things", exact: true }).click();
    await page.getByRole("button", { name: "Leather coat", exact: true }).click();
    await page.getByRole("button", { name: "Equipped", exact: true }).click();
    await expect(page.getByRole("button", { name: "Leather coat, worn", exact: true })).toBeVisible();
    // The inventory's close button is its header's only button, and shows only an icon.
    await page.getByRole("heading", { name: "Inventory", exact: true }).locator("xpath=../../button").click();
    await openBramsSheet();
    await expect(guard()).toHaveText("7");
    await page.screenshot({ path: testInfo.outputPath("ruleset-sheet-worn-guard.png") });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});

test("an item that sets an ability changes the sheet, and an item's details say what it asks", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  const chats: string[] = [];
  const rulesets: string[] = [];
  let characterId: string | undefined;
  const importRuleset = async (definition: string) => {
    const imported = await request.post("/api/game-rulesets/import", { data: { definition } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const rulesetId = (await imported.json()).rulesetId as string;
    rulesets.push(rulesetId);
    return rulesetId;
  };
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;

    // Ember Roads: Bram's Brawn is 0, and the ox-hide gauntlets he wears set it to at least 2.
    const sheet = { v: 1, build: { abilities: { brawn: 0, wits: 0, heart: 0 }, fields: {}, lists: {} } };
    const roadId = await seedGame(
      request,
      await importRuleset(example("ember-roads", "ember-abilities-e2e")),
      [
        { name: "Ada", rulesetSheet: sheet },
        { name: "Bram", rulesetSheet: sheet },
      ],
      [characterId],
    );
    chats.push(roadId);
    const seeded = await request.patch(`/api/chats/${roadId}/metadata`, {
      data: {
        gameInventory: [
          {
            id: "st-gauntlets",
            name: "Ox-hide gauntlets",
            quantity: 1,
            item: "outfitter/ox-hide-gauntlets",
            holder: "Bram",
            equipped: true,
          },
        ],
      },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();
    await openGame(page, roadId);
    const portrait = page.getByTitle("Bram - Click to open character sheet", { exact: true }).filter({ visible: true });
    const members = page
      .locator('.mari-window-bubble[data-window="control:character-profiles"]')
      .filter({ visible: true });
    await expect(portrait.or(members).first()).toBeVisible({ timeout: 30000 });
    if (await members.isVisible()) await members.click();
    await portrait.first().click();
    await expect(page.getByTitle("Brawn", { exact: true }).locator("span").nth(1)).toHaveText("+2");
    await page.screenshot({ path: testInfo.outputPath("ruleset-sheet-ability-from-item.png") });
    await page.getByRole("button", { name: "Close character sheet", exact: true }).click();
    await inventoryButton(page).click({ timeout: 30000 });
    await page.getByRole("button", { name: "Bram's things", exact: true }).click();
    await page.getByRole("button", { name: "Ox-hide gauntlets, worn", exact: true }).click();
    await expect(page.getByText("While worn: Brawn at least 2", { exact: true })).toBeVisible();

    // Gravewatch: the grave spade asks for Sinew 3, and its details say what falling short costs. This
    // copy also asks for a Sinew modifier and for items carried, which are named as such.
    const otherwise = { modifiers: [{ to: "checks", skills: ["dig"], flat: -1 }] };
    const watchId = await seedGame(
      request,
      await importRuleset(
        example("gravewatch", "gravewatch-requires-e2e", (doc) => {
          const spade = doc.catalogs
            .find((catalog: { holds?: string }) => catalog.holds === "items")
            .entries.find((entry: { id: string }) => entry.id === "grave-spade");
          spade.item.requires.push(
            { value: { abilityMod: "sinew" }, atLeast: 1, otherwise },
            { value: { itemStat: { from: "carried", pick: "count", tag: "silver" } }, atLeast: 1, otherwise },
            { value: { itemStat: { from: "all", pick: "count" } }, atLeast: 2, otherwise },
          );
        }),
      ),
      [
        {
          name: "Ada",
          rulesetSheet: { v: 1, build: { abilities: { sinew: 2, nerve: 2, warmth: 2 }, fields: {}, lists: {} } },
        },
      ],
      [],
    );
    chats.push(watchId);
    const watchPage = await page.context().newPage();
    await openInventory(watchPage, watchId);
    await watchPage.getByLabel("Name of the item to add", { exact: true }).fill("Grave spade");
    await watchPage.getByRole("button", { name: "Add", exact: true }).click();
    for (const line of [
      "Needs Sinew 3, otherwise: -1 on checks (Dig)",
      "Needs Sinew modifier 1, otherwise: -1 on checks (Dig)",
      "Needs Silver items 1, otherwise: -1 on checks (Dig)",
      "Needs items 2, otherwise: -1 on checks (Dig)",
    ]) {
      await expect(watchPage.getByText(line, { exact: true })).toBeVisible();
    }
    await watchPage.close();
  } finally {
    for (const id of chats) await request.delete(`/api/chats/${id}`);
    for (const id of rulesets) {
      await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(id)}&force=true`);
    }
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
