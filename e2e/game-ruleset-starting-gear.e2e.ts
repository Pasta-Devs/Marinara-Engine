import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { inventoryButton } from "./game-inventory-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * Starting gear (P1-6, Capability API 1.78): a ruleset's gear taken into a bag from the inventory, on
 * the player's word only. The dialog lists the gear, asks each choice and each pick, says what it
 * weighs against what the bearer can carry, and takes it whole; each kind of gear once. Each run
 * imports Ember Roads under its own id and removes it afterwards.
 */
function emberWithGear(id: string): string {
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = id;
  doc.items.startingGear = [
    {
      id: "traveller",
      label: "Traveller",
      group: "calling",
      summary: "What a traveller sets out with.",
      lines: [
        { coins: "mark", count: 5 },
        { item: "outfitter/road-rations", count: 3 },
      ],
      choices: [
        {
          label: "Weapon",
          options: [
            { label: "A hand axe", lines: [{ item: "outfitter/hand-axe" }] },
            { label: "A hunting bow", lines: [{ item: "outfitter/hunting-bow" }] },
          ],
        },
        {
          label: "Protection",
          options: [
            { label: "A leather coat", lines: [{ item: "outfitter/leather-coat", equip: true }] },
            { label: "A second weapon", lines: [{ oneOf: ["outfitter/hand-axe", "outfitter/boar-spear"] }] },
          ],
        },
      ],
    },
    { id: "pilgrim", label: "Pilgrim", group: "background", lines: [{ name: "Lucky charm" }] },
  ];
  return JSON.stringify(doc);
}

async function seedGame(request: APIRequestContext, rulesetId: string) {
  const created = await request.post("/api/chats", { data: { name: "Starting gear", mode: "game", characterIds: [] } });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: {
      gameId: `starting-gear-${rulesetId}`,
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameRuleset: { id: rulesetId, version: 1, packageId: null, options: {} },
      gameInventory: [],
    },
  });
  expect(meta.ok(), await meta.text()).toBeTruthy();
  const saved = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "The road starts at the gate." },
  });
  expect(saved.ok()).toBeTruthy();
  return chat.id;
}

async function openInventory(page: Page, chatId: string) {
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
  await inventoryButton(page).click({ timeout: 30000 });
}

test("starting gear is taken into the bag on the player's word, with its choices, once for each kind", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId = "";
  let rulesetId = "";
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", {
      data: { definition: emberWithGear(`ember-gear-${testInfo.project.name}`) },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId as string;
    chatId = await seedGame(request, rulesetId);
    const metadata = async () => {
      const row = await (await request.get(`/api/chats/${chatId}`)).json();
      return (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) as Record<string, any>;
    };
    await openInventory(page, chatId);
    const slot = (label: string) => page.getByRole("button", { name: label, exact: true });
    // The nudge toast carries a button of the same name; the one in the bag is the one under test.
    const gearButton = page
      .getByRole("button", { name: "Starting gear", exact: true })
      .and(page.locator(":not([data-sonner-toast] *)"));

    // Nothing is in the bag until the player asks.
    await expect(slot("Hand axe")).toHaveCount(0);
    await gearButton.click();
    const dialog = page.getByRole("dialog", { name: "Starting gear" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /Traveller/ }).check();
    const take = dialog.getByRole("button", { name: "Take Traveller", exact: true });
    // Every choice needs an option, and every list a pick.
    await expect(take).toBeDisabled();
    // An option shows how many it gives beside its name, which is read with it.
    await dialog.getByRole("radio", { name: /^A hand axe( \d+)?$/ }).check();
    await dialog.getByRole("radio", { name: /^A second weapon( \d+)?$/ }).check();
    await expect(take).toBeDisabled();
    const pick = dialog.getByRole("combobox", { name: "Pick one", exact: true });
    await pick.selectOption({ label: "Boar spear" });
    // Another option's lists are its own: switching away and back clears the pick.
    await dialog.getByRole("radio", { name: /^A leather coat( \d+)?$/ }).check();
    await dialog.getByRole("radio", { name: /^A second weapon( \d+)?$/ }).check();
    await expect(pick).toHaveValue("");
    await expect(take).toBeDisabled();
    await pick.selectOption({ label: "Boar spear" });
    // What it weighs, against what the player can still carry.
    await expect(dialog.getByText(/^Weighs 6\.05; .* can carry 12 more\.$/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("starting-gear-dialog.png") });
    await take.click();
    await expect(dialog).toBeHidden();
    await expect(slot("Hand axe")).toBeVisible();
    await expect(slot("Boar spear")).toBeVisible();
    await expect(slot("Road rations x3")).toBeVisible();
    await expect.poll(async () => (await metadata()).gameStartingGearTaken).toEqual({ "": ["traveller"] });

    // The calling's gear is taken; the background's is still there to take.
    await gearButton.click();
    await expect(dialog.getByText("Taken", { exact: true })).toBeVisible();
    await dialog.getByRole("radio", { name: /Pilgrim/ }).check();
    await dialog.getByRole("button", { name: "Take Pilgrim", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(slot("Lucky charm")).toBeVisible();
    await expect(page.getByRole("button", { name: "Starting gear (taken)", exact: true })).toBeVisible();
    const saved = await metadata();
    expect(saved.gameStartingGearTaken).toEqual({ "": ["traveller", "pilgrim"] });
    expect(
      (saved.gameJournal.entries as Array<{ title: string }>)
        .map((entry) => entry.title)
        .filter((title) => title.startsWith("Starting gear")),
    ).toEqual(["Starting gear: Traveller", "Starting gear: Pilgrim"]);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
