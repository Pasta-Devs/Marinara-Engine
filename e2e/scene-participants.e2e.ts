import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["light", "dark"] as const) {
  test(`Scene setup chooses participants without changing Conversation defaults (${theme})`, async ({
    page,
    request,
  }, info) => {
    const characters: Array<{ id: string }> = [];
    for (const name of ["Alice", "Bob", "Charlie"]) {
      characters.push(await (await request.post("/api/characters", { data: { data: { name } } })).json());
    }
    const persona = await (await request.post("/api/characters/personas", { data: { name: "Scene visitor" } })).json();
    const origin = await (
      await request.post("/api/chats", {
        data: {
          name: "Participant selection",
          mode: "conversation",
          characterIds: characters.map((c) => c.id),
        },
      })
    ).json();
    let sceneId: string | undefined;
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay"],
        sidebarOpen: false,
        rightPanelOpen: false,
        theme,
      });
      await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
      let selection: { participantCharacterIds: string[]; personaId: string } | undefined;
      await page.route("**/api/scene/plan", (route) => {
        selection = route.request().postDataJSON().promptPreferences;
        return route.fulfill({
          json: {
            plan: {
              name: "Scene: Library",
              description: "A quiet library.",
              scenario: "Find a book.",
              firstMessage: "Welcome.",
              background: null,
              characterIds: [characters[2]!.id],
              systemPrompt: "Write a scene.",
              rating: "sfw",
              relationshipHistory: "Friends.",
              participationGuide: "Explore.",
            },
          },
        });
      });
      await page.goto("/");
      await page.evaluate(async (chatId) => {
        const { startSceneWithPromptPreferences } = await import("/src/lib/scene-generation.ts" as string);
        void startSceneWithPromptPreferences({ chatId, prompt: "Visit a library" });
      }, origin.id);
      const setup = page.getByRole("dialog", { name: "Scene Prompt Setup", exact: true });
      const automatic = setup.getByRole("checkbox", { name: "Let the scene planner choose characters" });
      await expect(automatic).toBeEnabled();
      await automatic.uncheck();
      await setup.getByRole("checkbox", { name: "Charlie", exact: true }).uncheck();
      await setup.getByRole("checkbox", { name: "Alice", exact: true }).uncheck();
      await setup.getByRole("checkbox", { name: "Bob", exact: true }).uncheck();
      const plan = setup.getByRole("button", { name: "Plan Scene", exact: true });
      await expect(plan).toBeDisabled();
      await setup.getByRole("checkbox", { name: "Alice", exact: true }).check();
      await setup.getByRole("checkbox", { name: "Bob", exact: true }).check();
      await setup.getByRole("combobox", { name: "Scene persona", exact: true }).selectOption(persona.id);
      await page.screenshot({ path: info.outputPath(`scene-participants-${theme}.png`) });
      const created = page.waitForResponse(
        (response) => response.url().endsWith("/api/scene/create") && response.request().method() === "POST",
      );
      await plan.click();
      const response = await created;
      expect(response.ok()).toBeTruthy();
      sceneId = (await response.json()).chatId;
      expect(selection!.participantCharacterIds).toEqual([characters[0]!.id, characters[1]!.id]);
      expect(selection!.personaId).toBe(persona.id);
      const scene = await (await request.get(`/api/chats/${sceneId}`)).json();
      expect(scene.characterIds).toEqual(selection!.participantCharacterIds);
      expect(scene.personaId).toBe(persona.id);
      const source = await (await request.get(`/api/chats/${origin.id}`)).json();
      expect(source.characterIds).toHaveLength(3);
      expect(source.personaId).toBeNull();
      const saved = await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return useUIStore.getState().scenePromptPreferences;
      });
      expect(saved).not.toHaveProperty("participantCharacterIds");
      expect(saved).not.toHaveProperty("personaId");
    } finally {
      await page.close();
      if (sceneId) await request.delete(`/api/chats/${sceneId}?force=true`);
      await request.delete(`/api/chats/${origin.id}?force=true`);
      for (const c of characters) await request.delete(`/api/characters/${c.id}`);
      await request.delete(`/api/characters/personas/${persona.id}`);
    }
  });
}

test("Saved nameless custom tracker rows do not crash Roleplay on open or reload", async ({
  page,
  request,
  isMobile,
}, info) => {
  const chat = await (
    await request.post("/api/chats", { data: { name: "Legacy blank tracker", mode: "roleplay" } })
  ).json();
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["custom-tracker"] },
    });
    const saved = await request.patch(`/api/chats/${chat.id}/game-state`, {
      data: {
        manual: true,
        playerStats: {
          stats: [],
          attributes: null,
          skills: {},
          inventory: [],
          activeQuests: [],
          status: "",
          customTrackerFields: [{}, { name: "Health", value: "Fine" }],
        },
      },
    });
    expect(saved.ok()).toBeTruthy();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      chatHelpSeenModes: ["roleplay"],
      sidebarOpen: false,
      rightPanelOpen: false,
      trackerPanelEnabled: false,
      theme: "dark",
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { chatId: chat.id, version },
    );
    await page.goto("/");
    const tracker = page.getByRole("button", { name: isMobile ? "Tracker" : "Health: Fine", exact: true });
    await expect(tracker).toBeVisible();
    await tracker.click();
    await expect(page.getByRole("button", { name: "Health", exact: true })).toBeVisible();
    await page.reload();
    await expect(tracker).toBeVisible();
    await tracker.click();
    await expect(page.getByRole("button", { name: "Health", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath("saved-blank-tracker.png") });
  } finally {
    await page.close();
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("Scene setup waits for character names and resets choices for a different Conversation", async ({
  page,
  request,
}) => {
  const chars: Array<{ id: string }> = [];
  const chats: Array<{ id: string }> = [];
  try {
    for (const name of ["Alice", "Bob"]) {
      const character = await (await request.post("/api/characters", { data: { data: { name } } })).json();
      chars.push(character);
      chats.push(
        await (
          await request.post("/api/chats", { data: { name, mode: "conversation", characterIds: [character.id] } })
        ).json(),
      );
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    let releaseNames!: () => void;
    const namesGate = new Promise<void>((resolve) => {
      releaseNames = resolve;
    });
    await page.route("**/api/characters/summaries", async (route) => {
      await namesGate;
      await route.fulfill({ status: 500, json: { error: "fixture unavailable" } });
    });
    await page.goto("/");
    const openSetup = (chatId: string) =>
      page.evaluate(async (chatId) => {
        const { requestScenePromptPreferences } = await import("/src/lib/scene-generation.ts" as string);
        void requestScenePromptPreferences(undefined, chatId);
      }, chatId);
    await openSetup(chats[0]!.id);
    const setup = page.getByRole("dialog", { name: "Scene Prompt Setup", exact: true });
    const automatic = setup.getByRole("checkbox", { name: "Let the scene planner choose characters" });
    const plan = setup.getByRole("button", { name: "Plan Scene", exact: true });
    await expect(automatic).toBeEnabled();
    await automatic.uncheck();
    await expect(plan).toBeDisabled();
    releaseNames();
    await expect(setup.getByText("Characters could not be loaded. Close scene setup and try again.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(plan).toBeDisabled();
    await automatic.check();
    await expect(plan).toBeEnabled();
    await setup.getByRole("combobox", { name: "Scene persona" }).selectOption("");
    await page.unroute("**/api/characters/summaries");
    await openSetup(chats[1]!.id);
    await expect(automatic).toBeChecked();
    await expect(setup.getByRole("combobox", { name: "Scene persona" })).toHaveValue("source");
    await expect(automatic).toBeEnabled();
    await automatic.uncheck();
    await expect(setup.getByRole("checkbox", { name: "Bob", exact: true })).toBeChecked();
    await expect(setup.getByRole("checkbox", { name: "Alice", exact: true })).toHaveCount(0);
    await expect(plan).toBeEnabled();
  } finally {
    await page.close();
    for (const chat of chats) await request.delete(`/api/chats/${chat.id}?force=true`);
    for (const character of chars) await request.delete(`/api/characters/${character.id}`);
  }
});
