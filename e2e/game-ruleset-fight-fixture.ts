import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { DirectedCombatView } from "../packages/shared/src/features/combat-director.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/** A Game Mode game on an imported ruleset, a ruleset fight started in it, and the page opened on it:
 *  what the item specs for weapons in a fight share. */

export interface Seeded {
  chatId: string;
  rulesetId: string;
  anchor: string;
}

export async function seedFight(
  request: APIRequestContext,
  doc: Record<string, any>,
  game: { name: string; genre: string; setting: string; tone: string },
  metadata: Record<string, unknown>,
  live: Record<string, unknown>,
  opening: string,
): Promise<Seeded> {
  const imported = await request.post("/api/game-rulesets/import", { data: { definition: JSON.stringify(doc) } });
  expect(imported.ok(), await imported.text()).toBeTruthy();
  const rulesetId = (await imported.json()).rulesetId as string;
  const created = await request.post("/api/game/create", {
    data: {
      name: game.name,
      setupConfig: {
        genre: game.genre,
        setting: game.setting,
        tone: game.tone,
        difficulty: "normal",
        playerGoals: "Get through",
        gmMode: "standalone",
        rating: "sfw",
        partyCharacterIds: [],
        combatStyle: "classic",
        combatDirector: true,
        gmBossControl: false,
        ruleset: { id: rulesetId, version: doc.version ?? 1, packageId: null, options: {} },
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const chatId = (await created.json()).sessionChat.id as string;
  const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
    data: {
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameImageAutoGenerationEnabled: false,
      gameStoryboardAutoIllustrationsEnabled: false,
      enableAgents: false,
      ...metadata,
    },
  });
  expect(meta.ok(), await meta.text()).toBeTruthy();
  const seeded = await request.patch(`/api/chats/${chatId}/game-state`, {
    data: { manual: true, location: game.setting, rulesetLive: live },
  });
  expect(seeded.ok(), await seeded.text()).toBeTruthy();
  const message = await request.post(`/api/chats/${chatId}/messages`, {
    data: { role: "assistant", content: opening },
  });
  expect(message.ok(), await message.text()).toBeTruthy();
  return { chatId, rulesetId, anchor: (await message.json()).id as string };
}

export async function startFight(
  request: APIRequestContext,
  seeded: Seeded,
  member: string,
  enemy: { id: string; name: string; creature: string },
): Promise<void> {
  const party = {
    id: member.toLowerCase(),
    name: member,
    side: "player",
    hp: 40,
    maxHp: 40,
    attack: 8,
    defense: 4,
    speed: 5,
    level: 2,
  };
  const foe = { ...enemy, side: "enemy", hp: 12, maxHp: 12, attack: 5, defense: 4, speed: 6, level: 1 };
  const start = await request.post("/api/game/combat/director/start", {
    data: { chatId: seeded.chatId, anchor: seeded.anchor, style: "ruleset", party: [party], enemies: [foe] },
  });
  expect(start.ok(), await start.text()).toBeTruthy();
  const session: DirectedCombatView = (await start.json()).session;
  expect(session.style).toBe("ruleset");
  expect(session.ruleset?.order[0], `${member} acts first, so a turn of theirs is reached`).toBe(party.id);
  const combat = await request.patch(`/api/chats/${seeded.chatId}/metadata`, {
    data: {
      gameActiveState: "combat",
      gameCombatState: {
        party: [party],
        enemies: [foe],
        itemEffects: [],
        mechanics: [],
        dialogueCues: [],
        startMessageId: seeded.anchor,
        combatStyle: "classic",
      },
    },
  });
  expect(combat.ok(), await combat.text()).toBeTruthy();
}

export async function openGame(page: Page, chatId: string): Promise<void> {
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
}

export async function savedInventory(request: APIRequestContext, chatId: string) {
  const row = await (await request.get(`/api/chats/${chatId}`)).json();
  const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
  return metadata.gameInventory as Array<{ id: string; quantity: number; loaded?: number; charges?: number }>;
}

/** Imports on for the length of one test, and back to how they were. */
export async function withImports(
  request: APIRequestContext,
  run: (cleanup: Seeded[]) => Promise<void>,
): Promise<void> {
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  const cleanup: Seeded[] = [];
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    await run(cleanup);
  } finally {
    for (const seeded of cleanup) {
      await request.delete(`/api/chats/${seeded.chatId}`);
      await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(seeded.rulesetId)}&force=true`);
    }
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
}
