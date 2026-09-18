import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const directed of [false, true]) {
  for (const mode of ["classic", "tactical"] as const) {
    test(`Combat AI ${directed ? "directed" : "legacy"} ${mode} companion control survives accepted state`, async ({
      page,
      request,
    }, testInfo) => {
      test.setTimeout(120000);
      const unit = (id: string, side: "player" | "enemy") => ({
        id,
        name: id,
        side,
        hp: 1000,
        maxHp: 1000,
        mp: 10,
        maxMp: 10,
        attack: 2,
        defense: 20,
        speed: id === "Hero" ? 10000 : id === "Companion" ? 5000 : 5,
        level: 1,
        skills: [],
      });
      const party = [unit("Hero", "player"), unit("Companion", "player")];
      const enemies = [unit("Guard", "enemy")];
      const created = await request.post("/api/game/create", {
        data: {
          name: `Combat AI ${mode}`,
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
            combatDirector: directed,
            gmBossControl: false,
            tacticalBattlefield: { seed: 9 },
          },
        },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const chatId = (await created.json()).sessionChat.id;
      try {
        const started = await request.post("/api/game/combat/tactical/start", {
          data: { chatId, party, enemies, seed: 9 },
        });
        expect(started.ok(), await started.text()).toBeTruthy();
        const tactical = (await started.json()).state;
        const withProfiles = party.map((c) => ({
          ...c,
          tactics: tactical.units.find((u: { id: string }) => u.id === c.id).tactics,
        }));
        const profiledEnemies = enemies.map((c) => ({
          ...c,
          tactics: tactical.units.find((u: { id: string }) => u.id === c.id).tactics,
        }));
        const message = await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: "Hold the ruins. [state: combat]" },
        });
        const patched = await request.patch(`/api/chats/${chatId}/metadata`, {
          data: {
            gameSessionStatus: "active",
            gameIntroPresented: true,
            gameActiveState: "combat",
            gameImageAutoGenerationEnabled: false,
            gameStoryboardAutoIllustrationsEnabled: false,
            gameCombatStyle: mode,
            gameCombatState: {
              party: withProfiles,
              enemies: profiledEnemies,
              itemEffects: [],
              mechanics: [],
              dialogueCues: [],
              startMessageId: (await message.json()).id,
              combatStyle: mode,
            },
            ...(mode === "tactical" ? { gameTacticalCombatSnapshot: tactical } : {}),
          },
        });
        expect(patched.ok(), await patched.text()).toBeTruthy();
        await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
        await seedUIState(page, {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["game"],
          gameInstantTextReveal: true,
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
        const summary = page.locator("summary").filter({ hasText: "Party control and combat styles" });
        await expect(summary).toBeVisible({ timeout: 40000 });
        await summary.click();
        const companion = page.getByRole("combobox", { name: "Controller for Companion", exact: true });
        await expect(companion).toBeEnabled({ timeout: 15000 });
        await expect(page.getByRole("combobox", { name: "Controller for Hero", exact: true })).toBeDisabled();
        await companion.selectOption(mode === "classic" ? "manual" : "ai");
        await expect(companion).toHaveValue(mode === "classic" ? "manual" : "ai");
        await page.screenshot({ path: testInfo.outputPath(`combat-ai-${mode}.png`) });
        if (directed) {
          await summary.click();
          if (mode === "tactical") {
            await page.getByRole("button", { name: "Begin Hero’s turn", exact: true }).click();
          }
          await expect(page.getByRole("button", { name: "Defend", exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Defend", exact: true }).click();
          const readState = async () =>
            (
              await (
                await request.get(
                  `/api/game/combat/director/state?chatId=${chatId}&anchor=${(await message.json()).id}`,
                )
              ).json()
            ).session;
          if (mode === "classic") {
            await expect.poll(async () => (await readState()).actorId).toBe("Companion");
            await expect(page.getByText("Active: Companion", { exact: true })).toBeVisible();
            await page.getByRole("button", { name: "Defend", exact: true }).click();
          }
          await expect.poll(async () => (await readState()).round).toBe(2);
          if (mode === "tactical")
            expect((await readState()).log.some((e: { actorId: string }) => e.actorId === "Companion")).toBeTruthy();
        } else if (mode === "classic") {
          const response = page.waitForResponse((r) => r.url().endsWith("/api/game/combat/round"));
          await page.getByRole("button", { name: "Defend", exact: true }).click();
          // The first command only queues. The companion now chooses its own action.
          await expect(page.getByRole("button", { name: "Defend", exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Defend", exact: true }).click();
          const result = await response;
          expect(result.ok(), await result.text()).toBeTruthy();
          const submitted = result.request().postDataJSON();
          expect(Object.keys(submitted.partyActions).sort()).toEqual(["Companion", "Hero"]);
        } else {
          const response = page.waitForResponse(
            (r) =>
              r.url().endsWith("/api/game/combat/tactical/action") &&
              r.request().postDataJSON().action.type === "endTurn",
          );
          await page.getByRole("button", { name: "End Turn", exact: true }).click();
          const result = await response;
          expect(result.ok(), await result.text()).toBeTruthy();
          const accepted = await result.json();
          expect(accepted.events.some((e: { actorId: string }) => e.actorId === "Companion")).toBeTruthy();
        }
        if (!directed)
          await expect
            .poll(async () => {
              const chat = await (await request.get(`/api/chats/${chatId}`)).json();
              const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
              return mode === "classic"
                ? meta.gameCombatState?.party?.find((u: { id: string }) => u.id === "Companion")?.combatRound
                : meta.gameTacticalCombatSnapshot?.round;
            })
            .toBe(2);
        await page.reload();
        await expect(summary).toBeVisible({ timeout: 40000 });
        await summary.click();
        await expect(companion).toHaveValue(mode === "classic" ? "manual" : "ai");
      } finally {
        await request.delete(`/api/chats/${chatId}`);
      }
    });
  }
}

test("Combat AI generated spell kinds and finite MP survive hydration", async ({ page }) => {
  await page.goto("/");
  const data = await page.evaluate(async () => {
    const module = await import("/src/components/game/GameSurface.tsx" as string);
    const enemy = {
      name: "魔術師",
      hp: 40,
      maxHp: 40,
      attacks: [{ name: "癒し", type: "single-target", kind: "heal", mpCost: 4, power: 1 }],
      statuses: [],
      description: "",
      sprite: "",
    };
    return {
      fallback: module.generatedEnemyToCombatant(enemy, 0, 1),
      explicitZero: module.generatedEnemyToCombatant({ ...enemy, mp: 0, maxMp: 12 }, 0, 1),
    };
  });
  expect(data.fallback.mp).toBeGreaterThan(0);
  expect(data.fallback.skills[0]).toMatchObject({ type: "heal", mpCost: 4 });
  expect(data.explicitZero).toMatchObject({ mp: 0, maxMp: 12 });
});

test("Combat AI Classic items spend only after the accepted action executes", async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  const created = await request.post("/api/chats", {
    data: { name: "Combat item retry proof", mode: "game", characterIds: [] },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const chatId = (await created.json()).id;
  try {
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: testInfo.project.name.includes("desktop") ? "light" : "dark",
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
      timeout: 40000,
    });
    await prepareViteFixtureDependencies(page);
    await page.evaluate(async (id) => {
      const { GameCombatUI } = await import("/src/components/game/GameCombatUI.tsx" as string);
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;inset:0;z-index:99999;background:#111827";
      document.body.append(container);
      const spent = document.createElement("output");
      spent.dataset.testid = "spent-items";
      spent.textContent = "[]";
      document.body.append(spent);
      const items: string[] = [];
      const unit = { hp: 1000, maxHp: 1000, attack: 2, defense: 20, speed: 5, level: 1, skills: [] };
      ReactDOM.createRoot(container).render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(GameCombatUI, {
            chatId: id,
            party: [
              {
                ...unit,
                id: "hero",
                name: "Hero",
                side: "player",
                spellSlots: { "1": 1 },
                skills: [{ id: "mend", name: "Mend", type: "heal", mpCost: 0, power: 1, slotLevel: 1 }],
              },
            ],
            enemies: [{ ...unit, id: "guard", name: "Guard", side: "enemy" }],
            inventoryItems: [{ name: "Potion", quantity: 3 }],
            combatItemEffects: [{ name: "Potion", target: "self", type: "heal", description: "Restore HP" }],
            onCombatEnd: () => {},
            onInventoryItemUsed: (name: string) => {
              items.push(name);
              spent.textContent = JSON.stringify(items);
            },
          }),
        ),
      );
    }, chatId);
    let rejectNext = true,
      skipNext = false;
    await page.route("**/api/game/combat/round", async (route) => {
      if (rejectNext) {
        rejectNext = false;
        await route.fulfill({ status: 400, json: { error: "Injected round rejection" } });
      } else if (skipNext) {
        skipNext = false;
        const payload = route.request().postDataJSON();
        payload.combatants.find((u: { id: string }) => u.id === "hero").statusEffects = [
          { name: "Stunned", modifier: 0, stat: "speed", turnsLeft: 2 },
        ];
        await route.continue({ postData: JSON.stringify(payload) });
      } else await route.continue();
    });
    const usePotion = async () => {
      await page.getByRole("button", { name: "Items", exact: true }).click();
      const response = page.waitForResponse((r) => r.url().endsWith("/api/game/combat/round"));
      await page.getByRole("button", { name: /Potion/ }).click();
      return response;
    };
    expect((await usePotion()).status()).toBe(400);
    await expect(page.getByRole("button", { name: "Defend", exact: true })).toBeVisible();
    const retry = page.waitForResponse((r) => r.url().endsWith("/api/game/combat/round"));
    await page.getByRole("button", { name: "Defend", exact: true }).click();
    expect((await retry).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: "Items", exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("spent-items")).toHaveText("[]");
    expect((await usePotion()).ok()).toBeTruthy();
    await expect(page.getByTestId("spent-items")).toHaveText('["Potion"]');
    await expect(page.getByRole("button", { name: "Items", exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await page.getByRole("button", { name: /Mend/ }).click();
    const cast = page.waitForResponse((r) => r.url().endsWith("/api/game/combat/round"));
    await page.getByRole("button", { name: /^Hero HP/ }).click();
    const castResult = await (await cast).json();
    expect(castResult.combatants.find((u: { id: string }) => u.id === "hero").spellSlots["1"]).toBe(0);
    await expect(page.getByRole("button", { name: "Skills", exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await expect(page.getByRole("button", { name: /Mend/ })).toBeDisabled();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    skipNext = true;
    expect((await usePotion()).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: "Items", exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("spent-items")).toHaveText('["Potion"]');
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
