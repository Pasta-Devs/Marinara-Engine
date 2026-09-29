import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { DirectedCombatView } from "../packages/shared/src/features/combat-director.js";
import { inventoryButton } from "./game-inventory-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * Weapons as items (#6855), on screen: an Ember Roads game whose traveller holds a hand axe and
 * carries a hunting bow on her back. The axe's details say what it does as a weapon, and a ruleset
 * fight offers it as an attack, swung with her Brawn, while the bow, only carried, offers nothing.
 * She has no weapon row on her sheet, so the axe on the menu is the item.
 */
test("a held weapon's details say its attack, and a ruleset fight offers it", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = "ember-weapons-e2e";
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
    const created = await request.post("/api/game/create", {
      data: {
        name: "Weapons as items",
        setupConfig: {
          genre: "Fantasy",
          setting: "The road",
          tone: "Adventure",
          difficulty: "normal",
          playerGoals: "Get through",
          gmMode: "standalone",
          rating: "sfw",
          partyCharacterIds: [],
          combatStyle: "classic",
          combatDirector: true,
          gmBossControl: false,
          ruleset: { id: rulesetId, version: 1, packageId: null, options: {} },
        },
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    chatId = (await created.json()).sessionChat.id;
    // Three Brawn and six Toughness make thirteen Grit. Nothing on her gear list: the axe she swings
    // is the one in her hands.
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        gameStoryboardAutoIllustrationsEnabled: false,
        enableAgents: false,
        gameCharacterCards: [
          {
            name: "Juno",
            rulesetSheet: {
              v: 1,
              build: { abilities: { brawn: 3, wits: 0, heart: 0 }, fields: { toughness: 6 }, lists: {} },
            },
          },
        ],
        gameInventory: [
          { id: "st-axe", name: "Hand axe", quantity: 1, item: "outfitter/hand-axe", equipped: true },
          { id: "st-bow", name: "Hunting bow", quantity: 1, item: "outfitter/hunting-bow" },
        ],
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    const seeded = await request.patch(`/api/chats/${chatId}/game-state`, {
      data: { manual: true, location: "The road", rulesetLive: { juno: { pools: { grit: { value: 13 } } } } },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();
    const message = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "Wings beat in the dark ahead of the lantern." },
    });
    expect(message.ok(), await message.text()).toBeTruthy();
    const anchor = (await message.json()).id as string;

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
      weatherEffects: false,
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
    await expect(narration).toContainText("Wings beat in the dark", { timeout: 30_000 });

    // The axe says what it does as a weapon.
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: "Hand axe, worn", exact: true }).click();
    await expect(
      page.getByText("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Reach 2 paces, Range 10 to 20 paces", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-weapon-details.png") });

    // A ruleset fight against a cinder-moth out of the bestiary.
    const juno = {
      id: "juno",
      name: "Juno",
      side: "player",
      hp: 40,
      maxHp: 40,
      attack: 8,
      defense: 4,
      speed: 5,
      level: 2,
    };
    const moth = {
      id: "moth",
      name: "Cinder-moth",
      side: "enemy",
      hp: 12,
      maxHp: 12,
      attack: 5,
      defense: 4,
      speed: 6,
      level: 1,
      creature: "road_trouble/cinder-moth",
    };
    const start = await request.post("/api/game/combat/director/start", {
      data: { chatId, anchor, style: "ruleset", party: [juno], enemies: [moth] },
    });
    expect(start.ok(), await start.text()).toBeTruthy();
    const session: DirectedCombatView = (await start.json()).session;
    expect(session.style).toBe("ruleset");
    const combat = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameActiveState: "combat",
        gameCombatState: {
          party: [juno],
          enemies: [moth],
          itemEffects: [],
          mechanics: [],
          dialogueCues: [],
          startMessageId: anchor,
          combatStyle: "classic",
        },
      },
    });
    expect(combat.ok(), await combat.text()).toBeTruthy();
    await page.goto("/");

    // The axe she holds is on the menu; the bow on her back is not.
    const axe = page.getByRole("button", { name: /Hand axe/ });
    await expect(axe).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Hunting bow/ })).toHaveCount(0);
    await axe.click();
    const target = page.getByRole("button", { name: /Cinder-moth/ });
    await expect(target).toBeVisible();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    await target.click();
    const swung = await response;
    expect(swung.ok(), await swung.text()).toBeTruthy();
    // Two six-sided dice and her Brawn, against the moth's Guard.
    const fight = page.getByRole("region", { name: "Combat decisions" });
    await expect(
      fight.getByText(/^Juno attacks Cinder-moth with Hand axe: \d+ \(\d+ \+ \d+\) \+ 3 = \d+ against Guard 5, a/u),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-weapon-fight.png"), fullPage: true });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
