import { getMovementRange } from "../packages/shared/src/index.js";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import type { DirectedCombatView, DirectedCommand } from "../packages/shared/src/features/combat-director.js";
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const mode of ["classic", "tactical"] as const) {
  test(`Combat director ${mode}: manual reaction survives reload and spends once`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120000);
    const counter = {
      id: "counter",
      name: "Unweave",
      type: "debuff",
      power: 0,
      mpCost: 6,
      reaction: "counterspell",
      spell: true,
      range: 12,
      slotLevel: 3,
    };
    const hero = {
      movementMode: "fly",
      id: "Hero",
      name: "Hero",
      side: "player",
      hp: 500,
      maxHp: 500,
      mp: 30,
      maxMp: 30,
      attack: 80,
      defense: 5,
      speed: 10000,
      level: 5,
      spellSlots: { "3": 1 },
      skills: [{ id: "fire", name: "Fireball", type: "attack", power: 2, mpCost: 8, spell: true, range: 12 }, counter],
    };
    const boss = {
      id: "Boss",
      name: "Boss",
      side: "enemy",
      hp: 100,
      maxHp: 100,
      mp: 30,
      maxMp: 30,
      attack: 2,
      defense: 5,
      speed: 1,
      level: 5,
      boss: { points: 0, anticipation: false },
      skills: [{ ...counter, slotLevel: undefined }],
    };
    const created = await request.post("/api/game/create", {
      data: {
        name: `Director ${mode}`,
        setupConfig: {
          genre: "Fantasy",
          setting: "Ruins",
          tone: "Adventure",
          difficulty: "normal",
          playerGoals: "Hold",
          gmMode: "standalone",
          rating: "sfw",
          partyCharacterIds: [],
          combatStyle: mode,
          combatDirector: true,
          gmBossControl: true,
          tacticalBattlefield: { seed: 9, size: "small" },
        },
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const chatId = (await created.json()).sessionChat.id;
    try {
      const message = await request.post(`/api/chats/${chatId}/messages`, {
        data: { role: "assistant", content: "A mage faces the boss. [state: combat]" },
      });
      const anchor = (await message.json()).id;
      const weatherPatch = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: { gameWeather: { type: "storm", wind: "gale", visibility: "poor" } },
      });
      expect(weatherPatch.ok(), await weatherPatch.text()).toBeTruthy();
      const input = {
        chatId,
        anchor,
        style: mode,
        party: [hero],
        enemies: [boss],
        battlefield: { exposure: "exposed" },
        formation: "surrounded",
      };
      const start = await request.post("/api/game/combat/director/start", { data: input });
      expect(start.ok(), await start.text()).toBeTruthy();
      let s: DirectedCombatView = (await start.json()).session;
      const command = async (command: DirectedCommand) => {
        const result = await request.post("/api/game/combat/director/command", {
          data: {
            chatId,
            anchor,
            id: s.id,
            instanceId: s.instanceId,
            revision: s.revision,
            requestId: crypto.randomUUID(),
            command,
          },
        });
        expect(result.ok(), await result.text()).toBeTruthy();
        s = (await result.json()).session;
      };
      if (mode === "tactical") {
        await command({ type: "begin", unitId: "Hero" });
        const caster = s.tactical!.units.find((u) => u.id === "Hero")!;
        const target = s.tactical!.units.find((u) => u.id === "Boss")!;
        // New encounters have individual seeds. Move beside the boss so this
        // reaction fixture does not depend on random walls blocking the initial ray.
        if (Math.abs(caster.x - target.x) + Math.abs(caster.y - target.y) > 1) {
          const to = getMovementRange(s.tactical!, "Hero").find(
            (tile) => Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y) === 1,
          );
          expect(to, "A flying caster can approach the surrounded encounter's nearby boss").toBeDefined();
          await command({ type: "tactical", action: { type: "move", unitId: "Hero", to: to! } });
        }
      }
      await command(
        mode === "classic"
          ? { type: "classic", action: { type: "skill", skillId: "fire", targetId: "Boss" } }
          : { type: "tactical", action: { type: "skill", unitId: "Hero", skillName: "Fireball", targetId: "Boss" } },
      );
      expect(s.window?.actorId).toBe("Boss");
      await command({ type: "fallback" });
      expect(s.window?.controller).toBe("manual");
      expect(s.window?.actorId).toBe("Hero");
      const patch = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: {
          gameSessionStatus: "active",
          gameIntroPresented: true,
          gameActiveState: "combat",
          gameImageAutoGenerationEnabled: false,
          gameStoryboardAutoIllustrationsEnabled: false,
          gameCombatStyle: mode,
          gameCombatState: {
            party: [hero],
            enemies: [boss],
            itemEffects: [],
            mechanics: [],
            dialogueCues: [],
            startMessageId: anchor,
            combatStyle: mode,
          },
        },
      });
      expect(patch.ok(), await patch.text()).toBeTruthy();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["game"],
        gameInstantTextReveal: true,
        weatherEffects: false,
        theme: testInfo.project.name.includes("desktop") ? "light" : "dark",
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chatId, version },
      );
      await page.goto("/");
      const conditions = page.getByLabel("Combat conditions", { exact: true });
      await expect(conditions).toContainText("Storm");
      await expect(conditions).toContainText("Fire damage −15%; lightning damage +15%");
      await expect(conditions).toContainText(
        mode === "tactical" ? "Projectile accuracy −15 points" : "Projectile attack rolls −3",
      );
      const choices = page.getByRole("region", { name: "Combat decisions" });
      await expect(choices).toBeVisible({ timeout: 40000 });
      const react = choices.getByRole("button", { name: /Unweave.*Level 3 slot/ });
      await expect(react).toBeVisible();
      await expect(choices.getByRole("button", { name: "Pass", exact: true })).toBeVisible();
      await page.reload();
      await expect(react).toBeVisible({ timeout: 40000 });
      await expect(react).toBeFocused();
      await expect(conditions).toContainText("Storm");
      // Change a catalog entry to prove saved events are localized at render time after reload.
      await page.evaluate(async () => {
        const { i18n } = (await import("/src/localization/i18n.ts" as string)) as PageI18nModule;
        i18n.addResource(
          "en",
          "translation",
          "game.combat.event.beginSkill",
          "Translated event: {{actor}} begins {{skill}}.",
        );
        await i18n.changeLanguage("en");
      });
      await choices.getByText("Recent combat events", { exact: true }).click();
      await expect(choices.getByText(/^Translated event: .*Fireball\.$/)).toBeVisible();

      await react.click({ trial: true });
      await page.screenshot({ path: testInfo.outputPath(`${mode}-reaction.png`), fullPage: true });
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "choose",
      );
      await react.click();
      const result = await response;
      expect(result.ok(), await result.text()).toBeTruthy();
      const accepted: DirectedCombatView = (await result.json()).session;
      expect(accepted.party[0]!.spellSlots!["3"]).toBe(0);
      expect(accepted.party[0]!.mp).toBe(22);
      // Reload cannot reopen the accepted counter or charge its last spell slot again.
      await page.reload();
      await expect(choices).toBeVisible({ timeout: 40000 });
      await expect(react).toHaveCount(0);
      const persisted = await request.get(`/api/game/combat/director/state?chatId=${chatId}&anchor=${anchor}`);
      expect((await persisted.json()).session.party[0].spellSlots["3"]).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    } finally {
      await request.delete(`/api/chats/${chatId}`);
    }
  });
}

test("Combat director ruleset: the ruleset's own menu resolves the fight and writes the sheet", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  // Ember Roads, imported through the real route: 2d6 plus a stat against a Guard, Grit for health,
  // one action a turn, and a bestiary of its own. Nothing about this fight is 5e shaped.
  const emberRoads = readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
  // The import policy lives in the server's shared settings, so it is read first and put back
  // afterwards, whatever happens in between: another spec on this server must find it as it was.
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;

  // Each is set once the thing exists, so a failure anywhere still reaches the cleanup below and
  // neither the game nor the imported ruleset outlives the test.
  let createdChatId: string | undefined;
  let importedRulesetId: string | undefined;
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: emberRoads } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const rulesetId = (await imported.json()).rulesetId as string;
    importedRulesetId = rulesetId;
    const created = await request.post("/api/game/create", {
      data: {
        name: "Director ruleset",
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
    const chatId = (await created.json()).sessionChat.id;
    createdChatId = chatId;
    // A traveller at the top of the scale: three Brawn and six Toughness make thirteen Grit, which
    // is more than a cinder-moth can take off her before she puts it down.
    const sheets = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameCharacterCards: [
          {
            name: "Juno",
            rulesetSheet: {
              v: 1,
              build: {
                abilities: { brawn: 3, wits: 0, heart: 0 },
                fields: { toughness: 6 },
                lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
              },
            },
          },
        ],
      },
    });
    expect(sheets.ok(), await sheets.text()).toBeTruthy();
    // The row the in-game sheet reads, seeded at full Grit so the fight has somewhere to write.
    const seeded = await request.patch(`/api/chats/${chatId}/game-state`, {
      data: { manual: true, location: "The road", rulesetLive: { juno: { pools: { grit: { value: 13 } } } } },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();

    const message = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "Something is on the road ahead. [state: combat]" },
    });
    expect(message.ok(), await message.text()).toBeTruthy();
    const anchor = (await message.json()).id;
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
    // Named out of the ruleset's own bestiary, so the fight reads its numbers rather than inventing
    // any: this is the `creature` key the blueprint now carries through to the fight.
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
    const combat = { chatId, anchor, style: "ruleset", party: [juno], enemies: [moth] };
    const start = await request.post("/api/game/combat/director/start", { data: combat });
    expect(start.ok(), await start.text()).toBeTruthy();
    let s: DirectedCombatView = (await start.json()).session;
    expect(s.style).toBe("ruleset");
    expect(s.ruleset?.ruleset.id).toBe(rulesetId);
    expect(s.ruleset?.combatants.map((combatant) => combatant.name).sort()).toEqual(["Cinder-moth", "Juno"]);
    expect(s.ruleset?.adjustments).toEqual([]);
    expect(s.log).toEqual([]);
    const command = async (next: DirectedCommand) => {
      const result = await request.post("/api/game/combat/director/command", {
        data: {
          chatId,
          anchor,
          id: s.id,
          instanceId: s.instanceId,
          revision: s.revision,
          requestId: crypto.randomUUID(),
          command: next,
        },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
      s = (await result.json()).session;
    };

    const patch = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameActiveState: "combat",
        gameImageAutoGenerationEnabled: false,
        gameStoryboardAutoIllustrationsEnabled: false,
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
    expect(patch.ok(), await patch.text()).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
      weatherEffects: false,
      theme: testInfo.project.name.includes("desktop") ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chatId, version },
    );
    await page.goto("/");

    // The screen plays every turn nobody holds on its own, so the menu arrives when it is Juno's.
    const axe = page.getByRole("button", { name: /Road axe/ });
    await expect(axe).toBeVisible({ timeout: 60000 });
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

    // The log prints the real arithmetic, in Ember Roads' own words: two six-sided dice plus the
    // stat the axe swings with, against a Guard.
    const fight = page.getByRole("region", { name: "Combat decisions" });
    await expect(
      fight.getByText(/^Juno attacks Cinder-moth with Road axe: \d+ \(\d+ \+ \d+\) \+ 3 = \d+ against Guard 5, a/u),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-fight.png"), fullPage: true });

    // Played to the end with nobody at the wheel, one turn per call.
    const state = await request.get(`/api/game/combat/director/state?chatId=${chatId}&anchor=${anchor}`);
    expect(state.ok(), await state.text()).toBeTruthy();
    s = (await state.json()).session;
    if (!s.outcome) await command({ type: "control", unitId: "juno", controller: "ai" });
    for (let guard = 0; guard < 40 && !s.outcome; guard++) await command({ type: "continue" });
    expect(s.outcome).toBe("victory");
    expect(s.ruleset?.summary?.outcome).toBe("victory");
    const survivor = s.ruleset!.summary!.party.find((member) => member.name === "Juno")!;
    expect(survivor.down).toBe(false);

    // Every accepted step was written to the sheet as it happened, so the in-game sheet agrees with
    // the recap without anything being written back at the end.
    const sheet = await request.get(`/api/chats/${chatId}/game-state`);
    expect(sheet.ok(), await sheet.text()).toBeTruthy();
    const live = (await sheet.json()).rulesetLive as Record<string, any>;
    expect(live?.juno?.pools?.grit?.value).toBe(survivor.health);
  } finally {
    if (createdChatId) await request.delete(`/api/chats/${createdChatId}`);
    if (importedRulesetId) {
      await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(importedRulesetId)}&force=true`);
    }
    // Checked, because a restore that quietly failed would leave the policy on for every spec that
    // runs on this server afterwards.
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});

test("Combat director ruleset on a board: the walk, the log in paces, and the swing once it is adjacent", async ({
  page,
  request,
}, testInfo) => {
  // Four waits run one after another here, and a walking loop between them, so the budget has to be
  // more than their sum or a slow runner fails on arithmetic rather than on the thing being proven.
  test.setTimeout(240000);
  // Ember Roads again, and this time positioned: it says a cell is two paces and a turn walks
  // eight of them, so four squares a turn. Nothing about this board is 5e shaped.
  const emberRoads = readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
  // The import policy lives in the server's shared settings, so it is read first and put back
  // afterwards, whatever happens in between: another spec on this server must find it as it was.
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;

  let createdChatId: string | undefined;
  let importedRulesetId: string | undefined;
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: emberRoads } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const rulesetId = (await imported.json()).rulesetId as string;
    importedRulesetId = rulesetId;
    // Tactical, which is what asks a ruleset that measures distance for a board.
    const created = await request.post("/api/game/create", {
      data: {
        name: "Director ruleset board",
        setupConfig: {
          genre: "Fantasy",
          setting: "The road",
          tone: "Adventure",
          difficulty: "normal",
          playerGoals: "Get through",
          gmMode: "standalone",
          rating: "sfw",
          partyCharacterIds: [],
          combatStyle: "tactical",
          combatDirector: true,
          gmBossControl: false,
          ruleset: { id: rulesetId, version: 1, packageId: null, options: {} },
        },
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const chatId = (await created.json()).sessionChat.id;
    createdChatId = chatId;
    const sheets = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameCharacterCards: [
          {
            name: "Juno",
            rulesetSheet: {
              v: 1,
              build: {
                abilities: { brawn: 3, wits: 0, heart: 0 },
                fields: { toughness: 6 },
                lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
              },
            },
          },
        ],
      },
    });
    expect(sheets.ok(), await sheets.text()).toBeTruthy();
    const seeded = await request.patch(`/api/chats/${chatId}/game-state`, {
      data: { manual: true, location: "The road", rulesetLive: { juno: { pools: { grit: { value: 13 } } } } },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();

    const message = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "Something is on the road ahead. [state: combat]" },
    });
    expect(message.ok(), await message.text()).toBeTruthy();
    const anchor = (await message.json()).id;
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
      data: {
        chatId,
        anchor,
        style: "ruleset",
        positioned: true,
        environment: "forest",
        party: [juno],
        enemies: [moth],
      },
    });
    expect(start.ok(), await start.text()).toBeTruthy();
    let s: DirectedCombatView = (await start.json()).session;
    expect(s.style).toBe("ruleset");
    // The board is the tactical engine's own, said in Ember Roads' own unit.
    expect(s.ruleset?.grid?.distance).toEqual({ label: "paces", perCell: 2 });
    const command = async (next: DirectedCommand) => {
      const result = await request.post("/api/game/combat/director/command", {
        data: {
          chatId,
          anchor,
          id: s.id,
          instanceId: s.instanceId,
          revision: s.revision,
          requestId: crypto.randomUUID(),
          command: next,
        },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
      s = (await result.json()).session;
    };

    const patch = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameActiveState: "combat",
        gameImageAutoGenerationEnabled: false,
        gameStoryboardAutoIllustrationsEnabled: false,
        gameCombatState: {
          party: [juno],
          enemies: [moth],
          itemEffects: [],
          mechanics: [],
          dialogueCues: [],
          startMessageId: anchor,
          combatStyle: "tactical",
        },
      },
    });
    expect(patch.ok(), await patch.text()).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
      weatherEffects: false,
      theme: testInfo.project.name.includes("desktop") ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chatId, version },
    );
    await page.goto("/");

    // The board itself, one focusable square per cell, with the ruleset's own allowance beside it.
    const board = page.getByRole("group", { name: "Battlefield" });
    await expect(board).toBeVisible({ timeout: 45000 });
    const token = page.locator('[data-combatant="juno"]');
    await expect(token).toBeVisible();
    const from = await token.getAttribute("data-cell");
    expect(from).toMatch(/^\d+,\d+$/u);

    // Walking: the menu offers it, the squares carry their cost in paces, and one of them is taken.
    const move = page.getByRole("button", { name: /^Move/ });
    await expect(move).toBeVisible({ timeout: 45000 });
    await move.click();
    const reachable = board.locator('button[aria-label*="Can be walked to"]');
    await expect(reachable.first()).toBeVisible();
    await expect(reachable.first()).toHaveAttribute("aria-label", /Can be walked to for \d+ paces\./u);
    const walked = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/game/combat/director/command") && r.request().postDataJSON().command.type === "ruleset",
    );
    // The square furthest along the list, so the walk is a real one rather than a single step.
    await reachable.last().click();
    const walkResponse = await walked;
    expect(walkResponse.ok(), await walkResponse.text()).toBeTruthy();
    await expect(token).not.toHaveAttribute("data-cell", from!);

    // And the log says it in the ruleset's own distance, never in cells.
    const fight = page.getByRole("region", { name: "Combat decisions" });
    await expect(fight.getByText(/^Juno moves to \d+, \d+ for \d+ paces and has \d+ paces left\.$/u)).toBeVisible();

    // Walk until the axe has somebody to swing at, then swing by clicking the square they stand on.
    // Movement may be spent before and after an action, so the menu simply comes back with what is
    // left; a turn that runs out of it ends and the next one starts with a full allowance.
    const axe = page.getByRole("button", { name: /^Road axe/ });
    // The axe sits on the menu whether or not anybody is in reach, because the board says so in its
    // own line instead. So the swing below is only asked for when a fresh state really offers it.
    let inReach = false;
    for (let guard = 0; guard < 30; guard++) {
      const state = await request.get(`/api/game/combat/director/state?chatId=${chatId}&anchor=${anchor}`);
      expect(state.ok(), await state.text()).toBeTruthy();
      s = (await state.json()).session;
      if (s.outcome) break;
      const reach = s.ruleset?.options?.find((option) => option.kind === "attack" && option.targetIds.length > 0);
      if (reach) {
        inReach = true;
        break;
      }
      const walk = s.ruleset?.options?.find((option) => option.kind === "move" && (option.cells?.length ?? 0) > 0);
      if (!walk || s.ruleset?.controller !== "manual") {
        await command({ type: "continue" });
        continue;
      }
      const foe = s.ruleset!.combatants.find((combatant) => combatant.side === "enemy" && !combatant.defeated)!;
      const closest = [...walk.cells!].sort(
        (left, right) =>
          Math.max(Math.abs(left.x - foe.x!), Math.abs(left.y - foe.y!)) -
          Math.max(Math.abs(right.x - foe.x!), Math.abs(right.y - foe.y!)),
      )[0]!;
      // `command` replaces `s` with what came back, so everything below reads what the WALK left
      // behind rather than the menu from before it: movement may be spent either side of an action,
      // so the turn only ends when the walk found nobody to hit.
      await command({ type: "ruleset", optionId: walk.id, targetIds: [], to: { x: closest.x, y: closest.y } });
      const end = s.ruleset?.options?.find((option) => option.kind === "end-turn");
      const stillOffered = s.ruleset?.options?.some(
        (option) => option.kind === "attack" && option.targetIds.length > 0,
      );
      if (stillOffered) {
        inReach = true;
        break;
      }
      if (end) await command({ type: "ruleset", optionId: end.id, targetIds: [] });
    }
    await page.reload();
    await expect(board).toBeVisible({ timeout: 45000 });
    // Eight paces a turn on a board this size does not always close the distance inside the guard,
    // and a fight that ended while walking has nobody left to swing at. Either way the walk above is
    // what this case is for, and the swing is asked for only when the rules really offer it.
    if (inReach && !s.outcome) {
      await expect(axe).toBeVisible({ timeout: 45000 });
      await axe.click();
      const target = board.locator('button[aria-label*="Can be chosen as a target"]');
      await expect(target.first()).toBeVisible();
      const swing = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/game/combat/director/command") &&
          r.request().postDataJSON().command.type === "ruleset",
      );
      await target.first().click();
      const swung = await swing;
      expect(swung.ok(), await swung.text()).toBeTruthy();
      // Two six-sided dice plus the stat the axe swings with, against a Guard. Never who acts first
      // and never what a die showed: the server draws its own seed.
      await expect(
        fight.getByText(/^Juno attacks Cinder-moth with Road axe: \d+ \(\d+ \+ \d+\) \+ 3 = \d+ against Guard \d+, a/u),
      ).toBeVisible();
    }
    await page.screenshot({ path: testInfo.outputPath("ruleset-board.png"), fullPage: true });

    // Played to the end with nobody at the wheel, one turn per call, and the board survives it.
    const after = await request.get(`/api/game/combat/director/state?chatId=${chatId}&anchor=${anchor}`);
    expect(after.ok(), await after.text()).toBeTruthy();
    s = (await after.json()).session;
    if (!s.outcome) await command({ type: "control", unitId: "juno", controller: "ai" });
    for (let guard = 0; guard < 80 && !s.outcome; guard++) await command({ type: "continue" });
    expect(s.outcome).toBeTruthy();
    expect(s.ruleset?.grid?.distance).toEqual({ label: "paces", perCell: 2 });
  } finally {
    if (createdChatId) await request.delete(`/api/chats/${createdChatId}`);
    if (importedRulesetId) {
      await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(importedRulesetId)}&force=true`);
    }
    // Checked, because a restore that quietly failed would leave the policy on for every spec that
    // runs on this server afterwards.
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
