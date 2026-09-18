import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { test, expect, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Roleplay agents can omit chat summaries without changing other modes", async ({ page, request }, info) => {
  const resources: string[] = [];
  const create = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const value = (await response.json()) as { id: string };
    resources.unshift(`${path}/${value.id}`);
    return value;
  };
  try {
    await create("/api/agents", {
      type: "summary-browser-fixture",
      name: "Summary fixture agent",
      phase: "parallel",
      promptTemplate: "Return a short note.",
      settings: { resultType: "context_injection", customCapabilities: {} },
    });
    const chat = await create("/api/chats", { name: "Agent summary setting", mode: "roleplay", characterIds: [] });
    await create(`/api/chats/${chat.id}/messages`, { role: "assistant", content: "The laboratory is quiet." });
    expect(
      (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { enableAgents: false } })).ok(),
    ).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      trackerPanelEnabled: false,
      chibiProfessorMariEnabled: false,
      appAccentPulseMode: false,
      chatSettingsExpandedSections: { "roleplay-agents": true, "game-agents": true, "conversation-agents": true },
      gameInstantTextReveal: true,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    const openSettings = async () => {
      await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setShouldOpenSettings(true);
      });
    };
    const savedSetting = async () => {
      const saved = await (await request.get(`/api/chats/${chat.id}`)).json();
      const metadata = typeof saved.metadata === "string" ? JSON.parse(saved.metadata) : saved.metadata;
      return metadata.attachSummariesToAgents;
    };
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openSettings();
    const section = page.locator('[data-chat-settings-section="roleplay-agents"]');
    const toggle = section.getByLabel("Attach chat summaries", { exact: true });
    await expect(toggle).not.toBeChecked();
    const label = section.getByText("Attach chat summaries", { exact: true });
    await label.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(section.getByLabel("Enable Agents", { exact: true })).not.toBeChecked();
    await page.screenshot({ path: info.outputPath("agent-summary-settings-off.png") });
    await label.click();
    await expect.poll(savedSetting).toBe(true);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openSettings();
    await expect(toggle).toBeChecked();
    await label.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: info.outputPath("agent-summary-settings-on.png") });
    await label.click();
    await expect.poll(savedSetting).toBe(false);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openSettings();
    await expect(toggle).not.toBeChecked();

    await section.getByText("Enable Agents", { exact: true }).click();
    const cost = section.getByText(/tokens of agent instructions/u).locator("../..");
    const helpButton = cost.getByRole("button", { name: "Show help", exact: true });
    const toggleHelp = () => (info.project.name === "desktop-chromium" ? helpButton.click() : helpButton.tap());
    await toggleHelp();
    const help = page.getByText(/^Approximate\. Each call also carries chat context/u);
    await expect(help).toBeVisible();
    await expect(help).toContainText("Smaller models may slow down or fail past");
    await expect(helpButton).toHaveAttribute("aria-expanded", "true");
    const bounds = await help.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    if (info.project.name !== "desktop-chromium") {
      const buttonBounds = await helpButton.boundingBox();
      expect(buttonBounds!.width).toBeGreaterThanOrEqual(44);
      expect(buttonBounds!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: info.outputPath("agent-cost-help.png") });
    await toggleHelp();
    await expect(help).toBeHidden();
    await toggleHelp();
    await expect(help).toBeVisible();
    await section.getByText(/tokens of agent instructions/u).click();
    await expect(help).toBeHidden();

    for (const mode of ["conversation", "game"] as const) {
      const other = await create("/api/chats", { name: `Summary control ${mode}`, mode, characterIds: [] });
      if (mode === "game") {
        expect(
          (
            await request.patch(`/api/chats/${other.id}/metadata`, {
              data: { gameId: other.id, gameSessionStatus: "active", gameIntroPresented: true, enableAgents: false },
            })
          ).ok(),
        ).toBeTruthy();
      }
      await create(`/api/chats/${other.id}/messages`, { role: "assistant", content: `Ready for ${mode} mode.` });
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setShouldOpenSettings(false);
        useChatStore.getState().setActiveChatId(id);
      }, other.id);
      await expect(page.getByText(`Ready for ${mode} mode.`, { exact: true })).toBeVisible();
      await openSettings();
      const otherSection = page.locator(`[data-chat-settings-section="${mode}-agents"]`);
      await expect(otherSection.locator('[role="button"][aria-expanded]').first()).toBeVisible();
      await expect(page.getByLabel("Attach chat summaries", { exact: true })).toHaveCount(0);
    }
  } finally {
    for (const path of resources) await request.delete(path).catch(() => undefined);
  }
});

test("Personas are chosen per chat and Conversation names match that choice", async ({ page, request }, info) => {
  const resources: string[] = [];
  const create = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const value = (await response.json()) as { id: string };
    resources.unshift(`${path}/${value.id}`);
    return value;
  };
  try {
    const alice = await create("/api/characters/personas", {
      name: "Alice Persona",
      description: "A careful explorer.",
    });
    const bobPersona = await create("/api/characters/personas", { name: "Bob Persona" });
    const bob = await create("/api/characters", { data: { name: "Bob Character" } });
    const chat = await create("/api/chats", {
      name: "Explicit persona identity",
      mode: "conversation",
      personaId: alice.id,
      characterIds: [bob.id],
    });
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: { gameSetupConfig: { personaId: alice.id } },
        })
      ).ok(),
    ).toBeTruthy();
    const historicalMessage = await create(`/api/chats/${chat.id}/messages`, {
      role: "user",
      content: "Recorded by {{user}}.",
      extra: { personaSnapshot: { personaId: alice.id, name: "Alice Persona" } },
    });
    const message = await create(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      characterId: bob.id,
      content: "Hello {{user}}. I am {{char}}.",
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay"],
      trackerPanelEnabled: false,
      chibiProfessorMariEnabled: false,
      appAccentPulseMode: false,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const messageRow = page.locator(`[data-message-id="${message.id}"]`);
    await expect(messageRow).toContainText("I am Bob Character.");
    await page.screenshot({ path: info.outputPath("conversation-persona-identity.png") });
    const renderedGreeting = await messageRow.innerText();

    await page.locator('[data-tour="panel-personas"]').click();
    const panel = page.locator('[data-component="RightPanel"]');
    const aliceRow = page.locator('[data-touch-drag-card="persona"]').filter({ hasText: "Alice Persona" });
    await expect(aliceRow).toBeVisible();
    if (info.project.name === "desktop-chromium") await aliceRow.hover();
    await expect(page.locator('[data-touch-drag-card="persona"]').last()).toHaveCSS("opacity", "1");
    await page.screenshot({ path: info.outputPath("personas-panel.png") });
    const globalControls = await panel.getByRole("button", { name: /^(Set as active|Active|Inactive)$/u }).count();
    await page
      .locator('[data-component="PersonaLibraryActions"]')
      .getByRole("button", { name: "Open Library", exact: true })
      .click();
    const library = page.locator('[data-component="CharacterLibraryView"]');
    await expect(library.getByRole("heading", { name: "Browse your personas" })).toBeVisible();
    await expect(library.getByText("Alice Persona", { exact: true }).first()).toBeVisible();
    const activeBadges = await library.getByText("Active", { exact: true }).count();
    await page.screenshot({ path: info.outputPath("personas-library.png") });
    expect.soft(globalControls).toBe(0);
    expect.soft(activeBadges).toBe(0);
    expect(renderedGreeting).toContain("Hello Alice Persona. I am Bob Character.");
    await library.getByTitle("Close library").click();
    if (await aliceRow.isVisible()) await page.locator('[data-tour="panel-personas"]').click();
    const composer = page.locator("textarea[data-chat-composer]");
    await expect(composer).toBeVisible();
    const openPersonas = async (currentName: string) => {
      if (info.project.name === "desktop-chromium") {
        await page.getByTitle(currentName, { exact: true }).click();
        return page.getByRole("menu", { name: "Personas", exact: true });
      }
      await page.getByTitle("Quick Switcher", { exact: true }).click();
      const picker = page.locator(".fixed[data-chat-floating-panel]");
      await picker.getByRole("button", { name: "Personas", exact: true }).click();
      return picker;
    };
    const picker = await openPersonas("Alice Persona");
    await picker.getByRole("button", { name: /Ungrouped/u }).click();
    await page.getByRole("button", { name: /Bob Persona/u }).click();
    await expect
      .poll(async () => (await (await request.get(`/api/chats/${chat.id}`)).json()).personaId)
      .toBe(bobPersona.id);
    await expect(messageRow).toContainText("Hello Bob Persona. I am Bob Character.");
    await expect(messageRow.getByText("Bob Character", { exact: true })).toBeVisible();
    const historicalRow = page.locator(`[data-message-id="${historicalMessage.id}"]`);
    await expect(historicalRow).toContainText("Recorded by Alice Persona.");
    await expect(historicalRow.getByText("Alice Persona", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("historical-persona-identity.png") });
    await openPersonas("Bob Persona");
    await page.getByRole("button", { name: /None.*No persona selected/u }).click();
    await expect.poll(async () => (await (await request.get(`/api/chats/${chat.id}`)).json()).personaId).toBeNull();
    await expect(messageRow).toContainText("Hello User. I am Bob Character.");
    await composer.fill("/send I am {{user}}.");
    await composer.press("Enter");
    await expect(page.locator('[data-message-role="user"]').last()).toContainText("I am User.");
    await page.reload();
    await expect(messageRow).toContainText("Hello User. I am Bob Character.");
    await expect(messageRow.getByText("Bob Character", { exact: true })).toBeVisible();
    await expect(historicalRow).toContainText("Recorded by Alice Persona.");
    await expect(historicalRow.getByText("Alice Persona", { exact: true })).toBeVisible();
    await expect(
      page.getByTitle(info.project.name === "desktop-chromium" ? "Quick Persona Switcher" : "Quick Switcher", {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    for (const path of resources) await request.delete(path).catch(() => undefined);
  }
});

test("Roleplay scene controls keep readable Chroma surfaces over chat text", async ({ page, request }, testInfo) => {
  const chatIds: string[] = [];
  try {
    const origin = await (
      await request.post("/api/chats", {
        data: { name: "Scene controls origin", mode: "conversation", characterIds: [] },
      })
    ).json();
    chatIds.push(origin.id);
    const scene = await (
      await request.post("/api/chats", { data: { name: "Scene controls fixture", mode: "roleplay", characterIds: [] } })
    ).json();
    chatIds.push(scene.id);
    expect(
      (
        await request.patch(`/api/chats/${scene.id}/metadata`, {
          data: { sceneStatus: "active", sceneOriginChatId: origin.id },
        })
      ).ok(),
    ).toBeTruthy();
    await request.post(`/api/chats/${scene.id}/messages`, {
      data: {
        role: "assistant",
        content: Array(12)
          .fill(
            "The city lights shimmer beyond the laboratory windows. Notes and instruments cover the table as the conversation continues.",
          )
          .join("\n\n"),
      },
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
      appAccentPulseMode: false,
      theme: "dark",
      appAccentColor: "#14b8a6",
      chatChromeTextColor: "#99f6e4",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: scene.id, version },
    );
    await page.goto("/");
    const back = page.getByRole("button", { name: "Back to conversation", exact: true });
    const bar = back.locator("..");
    const discard = bar.getByRole("button", { name: "Discard", exact: true });
    const convert = bar.getByRole("button", { name: "Convert", exact: true });
    for (const theme of ["dark", "light"] as const) {
      const color = theme === "dark" ? "#99f6e4" : "#115e59";
      await page.evaluate(
        async ({ theme, color }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
          useUIStore.getState().setChatChromeTextColor(color);
        },
        { theme, color },
      );
      await expect(back).toBeVisible();
      await expect(discard).toBeVisible();
      await expect(convert).toBeVisible();
      // Wait for the existing theme transition before comparing the settled Chroma colors.
      for (const button of [back, bar.getByRole("button", { name: "End Scene", exact: true }), discard, convert]) {
        await expect(button).toHaveCSS("color", theme === "dark" ? "rgb(153, 246, 228)" : "rgb(17, 94, 89)");
      }
      await page.screenshot({ path: testInfo.outputPath(`scene-controls-${theme}.png`) });
      const appearance = await bar.locator("button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            background: style.backgroundColor,
            border: style.border,
            left: rect.left,
            right: rect.right,
          };
        }),
      );
      expect(appearance).toHaveLength(4);
      for (const button of appearance) {
        expect(button.background).toBe(appearance[0]!.background);
        expect(button.background).not.toBe("rgba(0, 0, 0, 0)");
        expect(button.border).toBe(appearance[0]!.border);
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      await discard.click();
      await expect(bar.getByText("Discard scene?", { exact: true })).toBeVisible();
      await bar.getByRole("button", { name: "No", exact: true }).click();
      await expect(discard).toBeVisible();
      await convert.click();
      const confirmation = page.getByRole("dialog", {
        name: "Convert this scene into a standalone roleplay?",
        exact: true,
      });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  } finally {
    await page.close();
    for (const id of chatIds.reverse()) await request.delete(`/api/chats/${id}?force=true`).catch(() => undefined);
  }
});

test("Roleplay line volume stays on screen and touch reveal preserves action colors", async ({
  page,
  request,
}, testInfo) => {
  let characterId = "";
  let chatId = "";
  try {
    const character = await (
      await request.post("/api/characters", { data: { data: { name: "Volume fixture" } } })
    ).json();
    characterId = character.id;
    const chat = await (
      await request.post("/api/chats", {
        data: { name: "Roleplay volume controls", mode: "roleplay", characterIds: [character.id] },
      })
    ).json();
    chatId = chat.id;
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: character.id, content: "The volume control should stay within reach." },
      })
    ).json();
    const config = await (await request.get("/api/tts/config")).json();
    await page.route("**/api/tts/config", (route) => route.fulfill({ json: { ...config, enabled: true } }));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
      appAccentPulseMode: false,
      theme: "dark",
      chatChromeTextColor: "#14b8a6",
      ttsLineVolume: 75,
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const row = page.locator(`[data-message-id="${message.id}"]`);
    const copy = row.getByRole("button", { name: "Copy", exact: true });
    const volume = row.getByRole("button", { name: /^Line volume: \d+%$/u });
    const actions = row.locator(".mari-message-actions");
    const actionAppearance = () =>
      actions.locator("button").evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          return {
            label: element.getAttribute("aria-label"),
            color: style.color,
            background: style.backgroundColor,
            shadow: style.boxShadow,
          };
        }),
      );
    await row.scrollIntoViewIfNeeded();
    await expect(volume).toBeAttached();
    const beforeReveal = await actionAppearance();
    if (testInfo.project.use.hasTouch) await row.getByText("The volume control should stay within reach.").tap();
    else await row.hover();
    await expect(actions).toHaveCSS("opacity", "1");
    await expect.poll(actionAppearance).toEqual(beforeReveal);
    await expect(copy).toHaveCSS("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)");
    await expect(row).toHaveCSS("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)");

    for (const direction of ["ltr", "rtl"] as const) {
      await page.evaluate(
        async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        },
        direction === "ltr" ? "dark" : "light",
      );
      await row.evaluate((element, direction) => {
        element.setAttribute("dir", direction);
      }, direction);
      if (testInfo.project.use.hasTouch) await volume.tap();
      else await volume.click();
      const panel = page.getByRole("dialog", { name: "Line volume", exact: true });
      await expect(panel).toBeVisible();
      const bounds = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: innerWidth,
          height: innerHeight,
        };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.width);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
      const slider = panel.getByRole("slider", { name: "Line volume", exact: true });
      await expect(slider).toBeFocused();
      await slider.press("Home");
      await slider.press("ArrowRight");
      await expect(slider).toHaveValue("1");
      await expect(volume).toHaveAttribute("aria-label", "Line volume: 1%");
      await page.screenshot({ path: testInfo.outputPath(`line-volume-${direction}.png`) });
      await slider.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(volume).toBeFocused();
      await expect(actions).toHaveCSS("opacity", "1");
      await expect(copy).toHaveCSS("color", beforeReveal.find((button) => button.label === "Copy")!.color);
    }
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    if (characterId) await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
  }
});

test("Translator defaults wait for edits, survive reload, and apply only to future chats", async ({
  page,
  request,
}, testInfo) => {
  const settingsPath = "/api/app-settings/translator-defaults";
  const previousDefaults = await (await request.get(settingsPath)).json();
  const chatIds: string[] = [];
  let connectionId = "";
  let releaseMetadata: (() => void) | undefined;
  const readMetadata = async (id: string) => {
    const chat = await (await request.get(`/api/chats/${id}`)).json();
    return typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
  };
  const createChat = async (mode: "conversation" | "roleplay" | "game", name: string) => {
    const response = await request.post("/api/chats", { data: { name, mode, characterIds: [] } });
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    chatIds.push(chat.id);
    return chat;
  };
  const openSettings = async (chatId: string) => {
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, chatId);
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    await expect(page.locator('.mari-chat-settings-drawer [data-chat-settings-section="translation"]')).toBeVisible();
  };
  try {
    expect((await request.put(settingsPath, { data: { value: "" } })).ok()).toBeTruthy();
    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: "Translator defaults fixture",
        provider: "custom",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "synthetic-translator-key",
        model: "translator-fixture",
      },
    });
    expect(connectionResponse.ok()).toBeTruthy();
    connectionId = (await connectionResponse.json()).id;
    const origin = await createChat("conversation", "Translator defaults origin");
    const existing = await createChat("roleplay", "Existing translator settings");
    const expected = {
      translationProvider: "ai",
      translationConnectionId: connectionId,
      translationInputTargetLang: "Japanese",
      translationOutputTargetLang: "Polish",
      translationInputPrompt: "Translate the outgoing draft into {{targetLanguage}}.",
      translationOutputPrompt: "Translate the newest response into {{targetLanguage}}.",
      autoTranslate: true,
      translateInput: true,
      showInputTranslateButton: true,
      translationDisplayOnly: true,
    };
    expect(
      (
        await request.patch(`/api/chats/${origin.id}/metadata`, {
          data: { ...expected, translationOutputPrompt: "An older translation prompt.", userNote: "Origin only" },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.patch(`/api/chats/${existing.id}/metadata`, {
          data: { translationProvider: "google", translationOutputTargetLang: "de", autoTranslate: false },
        })
      ).ok(),
    ).toBeTruthy();
    const existingMetadata = await readMetadata(existing.id);
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      chatSettingsExpandedSections: { translation: true },
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: origin.id, version },
    );
    await page.goto("/");
    await openSettings(origin.id);
    const section = page.locator('.mari-chat-settings-drawer [data-chat-settings-section="translation"]');
    const save = section.getByRole("button", { name: "Save translator defaults", exact: true });
    const forget = section.getByRole("button", { name: "Forget saved defaults", exact: true });
    const incomingPrompt = section.locator("textarea").nth(1);
    await expect(incomingPrompt).toHaveValue("An older translation prompt.");
    let heldPatch = false;
    const metadataGate = new Promise<void>((resolve) => (releaseMetadata = resolve));
    await page.route(`**/api/chats/${origin.id}/metadata`, async (route) => {
      if (route.request().method() === "PATCH") {
        heldPatch = true;
        await metadataGate;
      }
      await route.continue();
    });
    await incomingPrompt.fill(expected.translationOutputPrompt);
    await expect.poll(() => heldPatch).toBe(true);
    await save.click();
    await expect(section.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
    // Hold the real autosave before persistence: Save must not capture the older prompt.
    expect((await (await request.get(settingsPath)).json()).value).toBe("");
    releaseMetadata!();
    await expect(save).toBeEnabled();
    await expect
      .poll(async () => JSON.parse((await (await request.get(settingsPath)).json()).value || "{}"))
      .toEqual(expected);
    expect(await readMetadata(existing.id)).toEqual(existingMetadata);
    await forget.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("translator-defaults-saved.png") });

    await page.reload();
    await openSettings(origin.id);
    await expect(forget).toBeEnabled();
    await expect(section.getByRole("combobox").first()).toHaveValue("ai");
    await expect(section.getByRole("combobox").nth(1)).toHaveValue(connectionId);
    await expect(incomingPrompt).toHaveValue(expected.translationOutputPrompt);
    const inheritedChatIds: string[] = [];
    let gameChatId = "";
    for (const mode of ["conversation", "roleplay", "game"] as const) {
      const chat = await createChat(mode, `Inherited translator ${mode}`);
      inheritedChatIds.push(chat.id);
      const metadata = await readMetadata(chat.id);
      expect(metadata).toMatchObject(expected);
      expect(metadata).not.toHaveProperty("userNote");
      if (mode === "game") gameChatId = chat.id;
    }

    await page.locator(".mari-chat-settings-drawer").getByRole("button", { name: "Close Chat Settings" }).click();
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, gameChatId);
    const wizard = page.locator('[data-component="GameSetupWizard"]');
    await expect(wizard).toBeVisible();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(wizard.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await expect(wizard.getByRole("checkbox", { name: "Auto-Translate Responses", exact: true })).toBeChecked();
    await expect(wizard.getByLabel("My Language", { exact: false })).toHaveValue("Polish");

    await openSettings(origin.id);
    await forget.click();
    await expect.poll(async () => (await (await request.get(settingsPath)).json()).value).toBe("");
    for (const id of inheritedChatIds) expect(await readMetadata(id)).toMatchObject(expected);
    expect(await readMetadata(existing.id)).toEqual(existingMetadata);
    for (const mode of ["conversation", "roleplay", "game"] as const) {
      const chat = await createChat(mode, `Forgotten translator ${mode}`);
      const metadata = await readMetadata(chat.id);
      for (const key of Object.keys(expected)) expect(metadata).not.toHaveProperty(key);
    }
  } finally {
    releaseMetadata?.();
    await page.close();
    for (const id of chatIds.reverse()) await request.delete(`/api/chats/${id}?force=true`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    await request.put(settingsPath, { data: { value: previousDefaults.value ?? "" } });
  }
});

test("Game translation follows changed narration and remains manually accessible", async ({ page, request }) => {
  page.setDefaultTimeout(10_000);
  const chat = await (
    await request.post("/api/chats", { data: { name: "Translation sweep", mode: "game", characterIds: [] } })
  ).json();
  const chatIds: string[] = [chat.id];
  try {
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            gameId: chat.id,
            gameSessionStatus: "active",
            gameIntroPresented: true,
            gameImageAutoGenerationEnabled: false,
            translationOutputTargetLang: "pl",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The bridge is safe." },
      })
    ).json();
    const requested: string[] = [];
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.targetLanguage).toBe("pl");
      requested.push(body.text);
      await route.fulfill({
        json: {
          translatedText: body.text.includes("Note:")
            ? "[Note: Zapisana wiadomość.]"
            : body.text.includes("river")
              ? "Rzeka jest głęboka."
              : "Most jest bezpieczny.",
        },
      });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      chibiProfessorMariEnabled: false,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(panel).toContainText("The bridge is safe.");
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(panel).toContainText("Most jest bezpieczny.");
    const extra = async () => {
      const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
      const row = messages.find((entry: { id: string }) => entry.id === message.id);
      return typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra;
    };
    await expect.poll(async () => (await extra()).translationSource).toBe("The bridge is safe.");
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/messages/${message.id}`, { data: { content: "The river is deep." } })
      ).ok(),
    ).toBeTruthy();
    expect(
      (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: true } })).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(panel).toContainText("The river is deep.");
    await expect(panel).toContainText("Rzeka jest głęboka.");
    await expect(panel).not.toContainText("Most jest bezpieczny.");
    await expect.poll(async () => (await extra()).translationSource).toBe("The river is deep.");
    expect(requested).toEqual(["The bridge is safe.", "The river is deep."]);
    await panel.getByRole("button", { name: "Hide translation", exact: true }).click();
    await expect(panel).not.toContainText("Rzeka jest głęboka.");
    await expect.poll(async () => (await extra()).translationHidden).toBe(true);
    await page.reload();
    await expect(panel).toContainText("The river is deep.");
    await expect(panel).not.toContainText("Rzeka jest głęboka.");
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(panel).toContainText("Rzeka jest głęboka.");
    expect(requested).toEqual(["The bridge is safe.", "The river is deep.", "The river is deep."]);

    const otherChat = await (
      await request.post("/api/chats", { data: { name: "Other translation chat", mode: "game", characterIds: [] } })
    ).json();
    chatIds.push(otherChat.id);
    await request.patch(`/api/chats/${otherChat.id}/metadata`, {
      data: {
        gameId: otherChat.id,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
      },
    });
    await request.post(`/api/chats/${otherChat.id}/messages`, {
      data: { role: "assistant", content: "A different story." },
    });
    let releasePersistedTranslation: (() => Promise<void>) | undefined;
    await page.route(`**/api/chats/${chat.id}/messages/${message.id}/extra`, async (route) => {
      if (route.request().postDataJSON().translation !== "Opóźnione tłumaczenie.") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      // The server has saved the result, but the inactive chat's query cache is still stale.
      releasePersistedTranslation = () => route.fulfill({ response });
    });
    let pendingTranslation: Route | undefined;
    await page.route(
      "**/api/translate",
      (route) => {
        pendingTranslation = route;
      },
      { times: 1 },
    );
    await panel.getByRole("button", { name: "Hide translation", exact: true }).click();
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect.poll(() => Boolean(pendingTranslation)).toBe(true);
    const switchChat = async (id: string) => {
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setActiveChatId(id);
      }, id);
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
            return useTranslationStore.getState().config.chatId;
          }),
        )
        .toBe(id);
    };
    await switchChat(otherChat.id);
    await expect(panel).toContainText("A different story.");
    await pendingTranslation!.fulfill({ json: { translatedText: "Opóźnione tłumaczenie." } });
    await expect.poll(() => Boolean(releasePersistedTranslation)).toBe(true);
    await expect.poll(async () => (await extra()).translation).toBe("Opóźnione tłumaczenie.");
    expect(
      await page.evaluate(async (id) => {
        const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
        const state = useTranslationStore.getState();
        return {
          translation: state.translations[id],
          source: state.translationSources[id],
          translating: state.translating[id],
        };
      }, message.id),
    ).toEqual({ translation: undefined, source: undefined, translating: undefined });
    await switchChat(chat.id);
    await expect(panel).toContainText("The river is deep.");
    await releasePersistedTranslation!();
    await expect(panel).toContainText("Opóźnione tłumaczenie.");
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: false } });
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "[Note: A written message.]" },
    });
    await page.reload();
    await expect(panel).toContainText("You find a note...");
    await page.locator("div.fixed.inset-y-0").filter({ hasText: "A written message." }).getByRole("button").click();
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(panel).toContainText("Zapisana wiadomość.");
  } finally {
    await Promise.all(chatIds.map((id) => request.delete(`/api/chats/${id}`)));
  }
});

for (const mode of ["conversation", "roleplay", "game"] as const) {
  test(`${mode} automatic translation survives navigation and evicted chat settings`, async ({ page, request }) => {
    const chat = await (
      await request.post("/api/chats", { data: { name: "Background translation fixture", mode, characterIds: [] } })
    ).json();
    const metadata = {
      autoTranslate: true,
      enableAgents: false,
      translationProvider: "ai",
      translationOutputTargetLang: "pl",
      translationConnectionId: "origin-connection",
      translationOutputPrompt: "Translate the originating story.",
    };
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: metadata });
    let pendingGeneration: Route | undefined;
    const translations: Array<Record<string, unknown>> = [];
    await page.route("**/api/generate", (route) => {
      pendingGeneration = route;
    });
    await page.route("**/api/translate", (route) => {
      translations.push(route.request().postDataJSON());
      return route.fulfill({ json: { translatedText: "Gotowe tłumaczenie." } });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      streamingSpeed: 100,
    });
    await page.addInitScript((version) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
    }, version);
    try {
      await page.goto("/");
      // The real hooks run under an isolated QueryClient so eviction can be
      // deterministic, without waiting for the inactive cache's five-minute GC.
      await prepareViteFixtureDependencies(page);
      await page.evaluate(
        async ({ chat, metadata }) => {
          const { useGenerate } = await import("/src/hooks/use-generate.ts" as string);
          const { useTranslate } = await import("/src/hooks/use-translate.ts" as string);
          const { chatKeys } = await import("/src/hooks/use-chats.ts" as string);
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
          const { trackChatMetadataSave } = await import("/src/lib/chat-metadata-save-barrier.ts" as string);
          const dependencyUrl = window.__viteFixtureDependencyUrl;
          const { default: React } = await import(dependencyUrl("react"));
          const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
          const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
          const origin = { ...chat, metadata };
          const config = {
            chatId: chat.id,
            provider: "ai",
            inputTargetLanguage: "en",
            outputTargetLanguage: "pl",
            connectionId: "origin-connection",
            outputSystemPrompt: "Translate the originating story.",
          };
          let generated: Promise<unknown> | undefined;
          let releaseMetadataSave: (() => void) | undefined;
          let root: ReturnType<typeof ReactDOM.createRoot> | undefined;
          const container = document.createElement("div");
          container.style.cssText = "position:fixed;inset:0;z-index:99999;background:#16151c;color:white;padding:24px";
          document.body.append(container);
          function GenerationView() {
            const { generate } = useGenerate();
            const { translations } = useTranslate();
            return React.createElement(
              "div",
              null,
              React.createElement(
                "button",
                {
                  onClick: () => {
                    generated = generate({ chatId: chat.id, connectionId: null });
                  },
                },
                "Generate translation fixture",
              ),
              React.createElement(
                "output",
                { "data-testid": "translation-fixture-output" },
                Object.values(translations).join(" "),
              ),
            );
          }
          const mount = () => {
            root = ReactDOM.createRoot(container);
            root.render(React.createElement(QueryClientProvider, { client }, React.createElement(GenerationView)));
          };
          (window as any).translationFixture = {
            reset(pendingSettings: boolean, languageMetadata?: Record<string, unknown>) {
              root?.unmount();
              root = undefined;
              const configuredOrigin = { ...origin, metadata: { ...metadata, ...languageMetadata } };
              const initialChat = pendingSettings
                ? { ...origin, metadata: { ...metadata, autoTranslate: false } }
                : configuredOrigin;
              useChatStore.getState().setActiveChatId(null);
              useChatStore.getState().setActiveChat(initialChat);
              useTranslationStore.getState().clearAll();
              useTranslationStore.getState().setConfig(config);
              client.setQueryData(chatKeys.detail(chat.id), initialChat);
              client.setQueryData(chatKeys.messages(chat.id), { pages: [[]], pageParams: [undefined] });
              if (pendingSettings) {
                void trackChatMetadataSave(
                  chat.id,
                  () =>
                    new Promise<void>((resolve) => {
                      releaseMetadataSave = () => {
                        client.setQueryData(chatKeys.detail(chat.id), origin);
                        useChatStore.getState().setActiveChat(origin);
                        resolve();
                      };
                    }),
                );
              }
              mount();
            },
            finishSettingsSave: () => releaseMetadataSave?.(),
            leave(evict: boolean) {
              root?.unmount();
              root = undefined;
              container.textContent = "Browsing another page";
              useChatStore.getState().setActiveChat(null);
              useTranslationStore.getState().clearAll();
              useTranslationStore.getState().setConfig({
                ...config,
                chatId: "another-chat",
                provider: "google",
                outputTargetLanguage: "de",
                connectionId: undefined,
              });
              if (evict) client.removeQueries({ queryKey: chatKeys.detail(chat.id), exact: true });
            },
            settled: () => generated,
            cached(id: string) {
              const data = client.getQueryData(chatKeys.messages(chat.id));
              return data?.pages.flat().find((row: { id: string }) => row.id === id)?.extra;
            },
            showSaved() {
              useTranslationStore.getState().setConfig(config);
              useTranslationStore
                .getState()
                .seedFromMessages(client.getQueryData(chatKeys.messages(chat.id))?.pages.flat() ?? []);
              mount();
            },
            cleanup() {
              root?.unmount();
              client.clear();
              container.remove();
              useChatStore.getState().setActiveChat(null);
            },
          };
        },
        { chat, metadata },
      );
      const languageMetadata: Record<string, Record<string, unknown>> = {
        "malformed-legacy": {
          translationTargetLang: 42,
          translationInputTargetLang: null,
          translationOutputTargetLang: false,
        },
        "malformed-input": {
          translationTargetLang: " pl ",
          translationInputTargetLang: {},
          translationOutputTargetLang: "",
        },
        "malformed-output": {
          translationTargetLang: " pl ",
          translationInputTargetLang: " en ",
          translationOutputTargetLang: 17,
        },
      };
      const scenarios = [
        "visible",
        "evicted",
        "another-chat",
        "pending-settings",
        "malformed-legacy",
        "malformed-input",
        "malformed-output",
      ] as const;
      for (const scenario of scenarios) {
        const navigated = scenario === "evicted" || scenario === "another-chat";
        pendingGeneration = undefined;
        await page.evaluate(({ pending, language }) => (window as any).translationFixture.reset(pending, language), {
          pending: scenario === "pending-settings",
          language: languageMetadata[scenario],
        });
        await page.getByRole("button", { name: "Generate translation fixture", exact: true }).click();
        if (scenario === "pending-settings") {
          // Observe a bounded quiet interval while the metadata save is still held.
          await page.waitForTimeout(1_000);
          expect(pendingGeneration).toBeUndefined();
          await page.evaluate(() => (window as any).translationFixture.finishSettingsSave());
        }
        await expect.poll(() => Boolean(pendingGeneration)).toBe(true);
        if (navigated) {
          await page.evaluate((evict) => (window as any).translationFixture.leave(evict), scenario === "evicted");
          await expect(page.getByRole("button", { name: "Generate translation fixture", exact: true })).toHaveCount(0);
        }
        const source = `The ${scenario} story continues.`;
        const saved = await (
          await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content: source } })
        ).json();
        await pendingGeneration!.fulfill({
          contentType: "text/event-stream",
          body: [
            { type: "token", data: source },
            { type: "message_saved", data: saved },
            { type: "done", data: {} },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
        });
        await page.evaluate(() => (window as any).translationFixture.settled());
        await expect.poll(() => translations.length).toBe(scenarios.indexOf(scenario) + 1);
        expect(translations.at(-1)).toMatchObject({
          text: source,
          provider: "ai",
          targetLanguage: scenario === "malformed-legacy" ? "en" : "pl",
          connectionId: "origin-connection",
          systemPrompt: metadata.translationOutputPrompt,
        });
        await expect
          .poll(async () => {
            const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
            const extra = messages.find((row: { id: string }) => row.id === saved.id).extra;
            return typeof extra === "string" ? JSON.parse(extra).translation : extra.translation;
          })
          .toBe("Gotowe tłumaczenie.");
        if (navigated) {
          await expect
            .poll(() => page.evaluate((id) => (window as any).translationFixture.cached(id)?.translation, saved.id))
            .toBe("Gotowe tłumaczenie.");
          expect(
            await page.evaluate(async (id) => {
              const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
              return useTranslationStore.getState().translations[id];
            }, saved.id),
          ).toBeUndefined();
          await page.evaluate(() => (window as any).translationFixture.showSaved());
        }
        await expect(page.getByTestId("translation-fixture-output")).toContainText("Gotowe tłumaczenie.");
      }
    } finally {
      await page.evaluate(() => (window as any).translationFixture?.cleanup()).catch(() => {});
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

test("Notification position is selectable, moves errors, and survives reload", async ({ page }) => {
  page.setDefaultTimeout(10_000);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      chibiProfessorMariEnabled: false,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "settings",
      settingsTab: "general",
    },
    "if-missing",
  );
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: /Notification position/ });
  await page.getByPlaceholder("Search settings").fill("notification position");
  await page
    .locator(".mari-settings-search-header button")
    .filter({ hasText: "Notification position" })
    .first()
    .click();
  await expect(selector).toBeFocused();
  await expect(selector).toHaveValue("top");
  await selector.selectOption("bottom");
  const error = async () => {
    await prepareViteFixtureDependencies(page, "/src/App.tsx");
    await page.evaluate(async () => {
      const { toast } = await import(window.__viteFixtureDependencyUrl("sonner"));
      toast.error("Notification position fixture", { duration: Infinity });
    });
  };
  await error();
  await expect(page.locator('[data-sonner-toaster][data-y-position="bottom"]')).toContainText(
    "Notification position fixture",
  );
  await page.reload();
  await expect(selector).toHaveValue("bottom");
  await error();
  await expect(page.locator('[data-sonner-toaster][data-y-position="bottom"] [data-sonner-toast]')).toBeVisible();
  await selector.selectOption("top");
  await expect(page.locator('[data-sonner-toaster][data-y-position="top"] [data-sonner-toast]')).toBeVisible();
});

test("Conversation reactions stay beside their message when actions reveal", async ({ page, request }, info) => {
  let chatId = "";
  let characterId = "";
  try {
    const character = await request.post("/api/characters", { data: { data: { name: "Visitor" } } });
    expect(character.ok()).toBeTruthy();
    characterId = (await character.json()).id;
    const response = await request.post("/api/chats", {
      data: { name: "Stable conversation reactions", mode: "conversation", characterIds: [characterId] },
    });
    expect(response.ok()).toBeTruthy();
    chatId = (await response.json()).id;
    const messages: { id: string; role: string; content: string; emoji: string }[] = [];
    for (const [role, emoji] of [
      ["user", "🧪"],
      ["assistant", "📚"],
    ] as const) {
      const content = `A short ${role} message about the laboratory.`;
      const created = await request.post(`/api/chats/${chatId}/messages`, {
        data: { role, content, extra: { reactions: [{ emoji, by: ["user"] }] } },
      });
      expect(created.ok()).toBeTruthy();
      messages.push({ id: (await created.json()).id, role, content, emoji });
    }
    const grouped = await request.post(`/api/chats/${chatId}/messages`, {
      data: {
        role: "assistant",
        characterId,
        content: '<speaker="Visitor">A grouped laboratory reply.</speaker>',
        extra: { reactions: [{ emoji: "🔬", by: ["user"] }] },
      },
    });
    expect(grouped.ok()).toBeTruthy();
    messages.push({
      id: (await grouped.json()).id,
      role: "grouped",
      content: "A grouped laboratory reply.",
      emoji: "🔬",
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation"],
      trackerPanelEnabled: false,
      chibiProfessorMariEnabled: false,
      appAccentPulseMode: false,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chatId, version },
    );
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    for (const style of ["classic", "bubble"] as const) {
      await page.evaluate(async (value) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setConversationMessageStyle(value);
      }, style);
      for (const message of messages) {
        const row = page.locator(`[data-message-id="${message.id}"]`).first();
        const text = row.getByText(message.content, { exact: true });
        const reactions = page.locator(".mari-message-reactions-row").filter({ hasText: message.emoji });
        await text.scrollIntoViewIfNeeded();
        await page.locator("textarea[data-chat-composer]").focus();
        await page.mouse.move(1, 1);
        const measure = () =>
          reactions.evaluate((element, id) => {
            const message = document.querySelector(`[data-message-id="${id}"]`)!;
            const content =
              message.querySelector('[data-component="ConversationMessage.Content"]') ??
              message.querySelector("[data-card-css]")!;
            const contentBox = content.getBoundingClientRect();
            const swipes = message.querySelector(".mari-message-swipes")?.getBoundingClientRect();
            const reactionBox = element.getBoundingClientRect();
            return { gap: reactionBox.top - Math.max(contentBox.bottom, swipes?.bottom ?? 0), x: reactionBox.x };
          }, message.id);
        const before = await measure();
        await page.screenshot({ path: info.outputPath(`reactions-${style}-${message.role}-hidden.png`) });
        expect(before.gap).toBeLessThanOrEqual(12);
        if (info.project.name === "desktop-chromium") await text.hover();
        else await text.tap();
        await expect(row.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
        await expect.poll(async () => Math.abs((await measure()).gap - before.gap)).toBeLessThanOrEqual(1);
        expect(Math.abs((await measure()).x - before.x)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: info.outputPath(`reactions-${style}-${message.role}-shown.png`) });
        if (info.project.name !== "desktop-chromium") {
          await text.tap();
          await page.locator("textarea[data-chat-composer]").tap();
          await expect(row.getByRole("button", { name: "Copy", exact: true })).toBeHidden();
        }
      }
    }
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    if (characterId) await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
  }
});
