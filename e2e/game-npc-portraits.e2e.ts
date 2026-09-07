import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const pixel = readFileSync(new URL("../packages/client/public/icon-512.png", import.meta.url));

test("Game NPC portraits survive a same-name library card and reload over LAN", async ({ page, request }) => {
  const created = await request.post("/api/chats", {
    data: { name: "Portrait isolation", mode: "game", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = await created.json();
  let characterId: string | undefined;
  try {
    const character = await request.post("/api/characters", { data: { data: { name: "Guide" } } });
    expect(character.ok()).toBeTruthy();
    characterId = (await character.json()).id;
    const uploaded = await request.post(`/api/characters/${characterId}/avatar`, {
      data: { avatar: pixel.toString("base64"), filename: "unrelated.png" },
    });
    expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
    const avatarUrl = `/api/avatars/npc/${chat.id}/guide.png`;
    const saved = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: chat.id,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        gameNpcs: [
          {
            id: "guide",
            name: "Guide",
            description: "Campaign guide",
            location: "Bridge",
            reputation: 0,
            notes: [],
            avatarUrl: `http://127.0.0.1:7800${avatarUrl}`,
          },
        ],
      },
    });
    expect(saved.ok()).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: {
            role: "assistant",
            content: "[Guide]: The bridge is safe.",
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.route(`**${avatarUrl}*`, (route) => route.fulfill({ contentType: "image/png", body: pixel }));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript(
      ({ id, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { id: chat.id, appVersion: version },
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      gameInstantTextReveal: true,
    });
    await page.goto("/");
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
      await expect(panel).toContainText("The bridge is safe.", { timeout: 30_000 });
      const portrait = panel.locator(`img[src*="${avatarUrl}"]`).first();
      await expect(portrait).toBeVisible();
      await expect
        .poll(() => portrait.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useGameModeStore } = await import("/src/stores/game-mode.store.ts" as string);
            return useGameModeStore.getState().npcs.find((npc: { name: string }) => npc.name === "Guide")?.avatarUrl;
          }),
        )
        .toContain(avatarUrl);
      const stored = await (await request.get(`/api/chats/${chat.id}`)).json();
      const meta = typeof stored.metadata === "string" ? JSON.parse(stored.metadata) : stored.metadata;
      expect(meta.gameNpcs[0].avatarUrl).toBe(avatarUrl);
    }
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            gameNpcs: [
              {
                id: "guide",
                name: "Guide",
                description: "Campaign guide",
                location: "Bridge",
                reputation: 0,
                notes: [],
              },
            ],
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("The bridge is safe.");
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useGameModeStore } = await import("/src/stores/game-mode.store.ts" as string);
          const npc = useGameModeStore.getState().npcs.find((entry: { name: string }) => entry.name === "Guide");
          return npc ? (npc.avatarUrl ?? null) : "not hydrated";
        }),
      )
      .toBeNull();
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
  }
});
