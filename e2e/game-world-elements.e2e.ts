import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { WORLD_STARTER_KITS, parseWorldKit } from "@marinara-engine/shared";
import type { DirectedCombatView } from "../packages/shared/src/features/combat-director.js";
import { openGame } from "./game-ruleset-fight-fixture.js";

/**
 * Elements in the setting's own words (worldgen W6c), on screen. A wuxia game's fight marks an aura in
 * the colour the kit gives that phase, and a special maneuver tells the Game Master the setting's own
 * five phases to name, never the classic or anyone else's elements.
 */

/** A plain combatant, the same on every side. */
const fighter = (id: string, side: "player" | "enemy") => ({
  id,
  name: id,
  side,
  hp: 30,
  maxHp: 30,
  attack: 5,
  defense: 5,
  speed: 5,
  level: 1,
  skills: [],
});

/** The player's message to the Game Master, captured; the Game Master's answer, when given, is stored
 *  as its turn. */
async function captureSent(page: Page, answer?: () => Promise<unknown>): Promise<() => string | null> {
  let sent: string | null = null;
  await page.route("**/api/generate", async (route) => {
    sent = JSON.stringify(route.request().postDataJSON());
    await answer?.();
    await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done"}\n\n' });
  });
  return () => sent;
}

test("a wuxia fight marks an aura in the phase's own colour and names its five phases to the Game Master", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "wuxia_xianxia")!);
  if (!parsed.ok) throw new Error(parsed.issues.join("; "));
  const created = await request.post("/api/game/create", {
    data: {
      name: "Five phases",
      setupConfig: {
        worldKit: parsed.kit,
        genre: "Wuxia",
        setting: "A river of sects",
        tone: "Adventure",
        difficulty: "normal",
        playerGoals: "Hold the ford",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        combatStyle: "classic",
        combatDirector: false,
        gmBossControl: false,
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const chatId = (await created.json()).sessionChat.id as string;
  try {
    const message = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "The river bandit raises his blade. [state: combat]" },
    });
    expect(message.ok()).toBeTruthy();
    const patched = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameActiveState: "combat",
        gameImageAutoGenerationEnabled: false,
        gameStoryboardAutoIllustrationsEnabled: false,
        gameCombatStyle: "classic",
        gameCombatState: {
          party: [fighter("Hero", "player")],
          enemies: [
            { ...fighter("River Bandit", "enemy"), elementAura: { element: "water", gauge: 1, sourceId: "gm" } },
          ],
          itemEffects: [],
          mechanics: [],
          dialogueCues: [],
          startMessageId: (await message.json()).id,
          combatStyle: "classic",
        },
      },
    });
    expect(patched.ok(), await patched.text()).toBeTruthy();
    // The Game Master answers with an element in the setting's own word, which the screen reads as
    // that phase (Earth), never the classic alias the word once meant ("geo").
    const sent = await captureSent(page, () =>
      request.post(`/api/chats/${chatId}/messages`, {
        data: {
          role: "assistant",
          content: 'The ford heaves under him. [element_attack: element="Earth" target="Hero"]',
        },
      }),
    );
    await openGame(page, chatId);

    // The aura wears the kit's own colour for Water (#1e90ff), not the generic grey an unknown word gets.
    const aura = page.locator('[title="water aura (gauge: 1)"]').first();
    await expect(aura).toBeVisible({ timeout: 40_000 });
    await expect(aura).toHaveCSS("color", "rgb(30, 144, 255)");
    await page.screenshot({ path: testInfo.outputPath("wuxia-aura.png") });

    // A special maneuver names the setting's five phases to the Game Master.
    await page.getByRole("button", { name: "Special", exact: true }).first().click();
    await page
      .getByPlaceholder("I kick sand into the Ruin Guard's cracked lens, trying to blind it for a round.")
      .fill("I turn the river against him.");
    await page.getByRole("button", { name: "Ask GM", exact: true }).click();
    await expect.poll(sent, { timeout: 30_000 }).toContain("I turn the river against him.");
    expect(sent()).toContain('[element_attack: element=\\"wood|fire|earth|metal|water\\" target=\\"Exact Name\\"]');
    expect(sent()).not.toContain("pyro|hydro");
    const earth = page.locator('[title="earth aura (gauge: 1)"]').first();
    await expect(earth).toBeVisible({ timeout: 30_000 });
    await expect(earth).toHaveCSS("color", "rgb(160, 82, 45)");
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

// A setting's battlefields (worldgen W6d): a cyberpunk rooftop is laid out as open ground, and the
// board's tiles go by the setting's words.
test("a cyberpunk rooftop fight is laid out as open ground and its tiles go by the setting's words", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "cyberpunk")!);
  if (!parsed.ok) throw new Error(parsed.issues.join("; "));
  const created = await request.post("/api/game/create", {
    data: {
      name: "Rooftop",
      setupConfig: {
        worldKit: parsed.kit,
        genre: "Cyberpunk",
        setting: "A megacity",
        tone: "Gritty",
        difficulty: "normal",
        playerGoals: "Get the data",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        combatStyle: "tactical",
        combatDirector: false,
        gmBossControl: false,
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const chatId = (await created.json()).sessionChat.id as string;
  try {
    const message = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "The fixer's crew spreads across the rooftop. [state: combat]" },
    });
    expect(message.ok()).toBeTruthy();
    const patched = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameActiveState: "combat",
        gameImageAutoGenerationEnabled: false,
        gameStoryboardAutoIllustrationsEnabled: false,
        gameCombatStyle: "tactical",
        gameCombatState: {
          party: [fighter("Hero", "player")],
          enemies: [fighter("Fixer", "enemy")],
          itemEffects: [],
          mechanics: [],
          dialogueCues: [],
          startMessageId: (await message.json()).id,
          combatStyle: "tactical",
          sceneEnvironmentType: "Rooftop",
        },
      },
    });
    expect(patched.ok(), await patched.text()).toBeTruthy();
    const started = page.waitForResponse((response) => response.url().endsWith("/api/game/combat/tactical/start"));
    await openGame(page, chatId);
    const answer = await started;
    expect(answer.ok(), await answer.text()).toBeTruthy();
    expect(((await answer.json()) as { state: { environment?: string } }).state.environment).toBe("plains");
    // Open ground is this setting's word for the board's open tiles; the engine's own never shows.
    await expect(page.getByRole("button", { name: /^Open ground, row \d+, column \d+$/ }).first()).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByRole("button", { name: /^Plains, row \d+, column \d+$/ })).toHaveCount(0);
    // And a tile's card says it the same way.
    await page
      .getByRole("button", { name: /^Open ground, row \d+, column \d+$/ })
      .first()
      .click();
    await expect(page.getByText("Open ground", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("cyberpunk-rooftop.png") });
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

/** A cyberpunk game run by the combat director, its fight started at a scene in the setting's words
 *  and on screen. */
async function directedCyberpunkFight(
  request: APIRequestContext,
  options: {
    scene: string;
    style: "tactical" | "ruleset";
    party: Record<string, unknown>;
    enemy: Record<string, unknown>;
    setup?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
): Promise<{ chatId: string; session: DirectedCombatView }> {
  const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "cyberpunk")!);
  if (!parsed.ok) throw new Error(parsed.issues.join("; "));
  const created = await request.post("/api/game/create", {
    data: {
      name: "Directed megacity",
      setupConfig: {
        worldKit: parsed.kit,
        genre: "Cyberpunk",
        setting: "A megacity",
        tone: "Gritty",
        difficulty: "normal",
        playerGoals: "Get the data",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        combatStyle: "tactical",
        combatDirector: true,
        gmBossControl: false,
        ...options.setup,
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const chatId = (await created.json()).sessionChat.id as string;
  if (options.metadata) {
    const patched = await request.patch(`/api/chats/${chatId}/metadata`, { data: options.metadata });
    expect(patched.ok(), await patched.text()).toBeTruthy();
  }
  const message = await request.post(`/api/chats/${chatId}/messages`, {
    data: { role: "assistant", content: "The crew spreads out. [state: combat]" },
  });
  expect(message.ok()).toBeTruthy();
  const anchor = (await message.json()).id as string;
  const start = await request.post("/api/game/combat/director/start", {
    data: {
      chatId,
      anchor,
      style: options.style,
      ...(options.style === "ruleset" ? { positioned: true } : {}),
      environment: options.scene,
      party: [options.party],
      enemies: [options.enemy],
    },
  });
  expect(start.ok(), await start.text()).toBeTruthy();
  const combat = await request.patch(`/api/chats/${chatId}/metadata`, {
    data: {
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameActiveState: "combat",
      gameImageAutoGenerationEnabled: false,
      gameStoryboardAutoIllustrationsEnabled: false,
      gameCombatStyle: "tactical",
      gameCombatState: {
        party: [options.party],
        enemies: [options.enemy],
        itemEffects: [],
        mechanics: [],
        dialogueCues: [],
        startMessageId: anchor,
        combatStyle: "tactical",
        sceneEnvironmentType: options.scene,
      },
    },
  });
  expect(combat.ok(), await combat.text()).toBeTruthy();
  return { chatId, session: (await start.json()).session as DirectedCombatView };
}

test("a directed rooftop fight names its tiles in the setting's words", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { chatId, session } = await directedCyberpunkFight(request, {
    scene: "Rooftop",
    style: "tactical",
    party: fighter("Hero", "player"),
    enemy: fighter("Fixer", "enemy"),
  });
  try {
    expect(session.tactical?.environment).toBe("plains");
    await openGame(page, chatId);
    await expect(page.getByRole("button", { name: /^Open ground, row \d+, column \d+$/ }).first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByRole("button", { name: /^Plains, row \d+, column \d+$/ })).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

test("a ruleset board in a megablock corridor wears the corridor's dungeon colours", async ({ page, request }) => {
  test.setTimeout(150_000);
  // Ember Roads measures distance, so a tactical game fights it on a board.
  const emberRoads = readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId: string | undefined;
  let rulesetId: string | undefined;
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: emberRoads } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId as string;
    const fight = await directedCyberpunkFight(request, {
      scene: "Megablock corridor",
      style: "ruleset",
      setup: { ruleset: { id: rulesetId, version: 1, packageId: null, options: {} } },
      metadata: {
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
      party: { ...fighter("Juno", "player"), id: "juno" },
      enemy: { ...fighter("Cinder-moth", "enemy"), id: "moth", creature: "road_trouble/cinder-moth" },
    });
    chatId = fight.chatId;
    expect(fight.session.ruleset?.grid).toBeTruthy();
    await openGame(page, chatId);
    await expect(page.getByRole("region", { name: "Combat decisions" })).toBeVisible({ timeout: 45_000 });
    // A phone shows the board on a tab of its own beside the turn's options.
    const boardTab = page.getByRole("tab", { name: "Board", exact: true });
    const board = page.getByRole("group", { name: "Battlefield" });
    // The phone picks its tab again when the first turn arrives, so ask until the board stays.
    await expect(async () => {
      if (await boardTab.isVisible()) await boardTab.click();
      await expect(board).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 45_000 });
    // Every square is coloured from the dungeon palette the corridor is laid out like, never the plain one.
    const dungeon = ["#3d3a42", "#34413a", "#4a4550", "#4c4652", "#274a5c", "#1a1820"].map((hex) =>
      [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(","),
    );
    const colours = await board
      .locator('button[aria-label^="Cell "]')
      .evaluateAll((cells) =>
        cells.map((cell) => (getComputedStyle(cell).backgroundColor.match(/\d+/g) ?? []).slice(0, 3).join(",")),
      );
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(dungeon).toContain(colour);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
