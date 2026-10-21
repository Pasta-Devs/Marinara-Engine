import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("provider-aware controls narrow to model capabilities while presets omit token limits", async ({
  page,
  request,
}, info) => {
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: "Parameter controls UI fixture",
      provider: "openrouter",
      model: "anthropic/claude-sonnet-4.5",
      baseUrl: "http://127.0.0.1:9/api/v1",
      apiKey: "synthetic-ui-fixture-key",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = await connectionResponse.json();
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Parameter controls UI fixture",
      mode: "conversation",
      characterIds: [],
      connectionId: connection.id,
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = await chatResponse.json();
  const presetResponse = await request.post("/api/prompts", { data: { name: "Provider-less parameters UI fixture" } });
  expect(presetResponse.ok()).toBeTruthy();
  const preset = await presetResponse.json();

  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { conversationSetupComplete: true } });
    await page.route(`**/api/connections/${connection.id}/models`, (route) =>
      route.fulfill({
        json: {
          models: [
            {
              id: connection.model,
              name: "Synthetic Claude Sonnet",
              capabilities: { supportedParameters: ["maxTokens", "reasoningEffort"] },
            },
          ],
        },
      }),
    );
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ chatId, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { chatId: chat.id, appVersion: version },
    );
    await page.goto("/");

    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    await page
      .locator('.mari-chat-settings-drawer [data-chat-settings-section="advanced-parameters"]')
      .getByText("Advanced Parameters", { exact: true })
      .click();

    const parameters = page.locator('[data-chat-settings-section="advanced-parameters"]');
    await expect(parameters.getByRole("textbox", { name: "Max Output Tokens", exact: true })).toBeVisible();
    await expect(parameters.getByRole("textbox", { name: "Temperature", exact: true })).toHaveCount(0);
    await expect(parameters.getByRole("textbox", { name: "Top P", exact: true })).toHaveCount(0);
    await expect(parameters.getByRole("textbox", { name: "Top K", exact: true })).toHaveCount(0);
    await expect(parameters.getByRole("textbox", { name: "Frequency", exact: true })).toHaveCount(0);

    await page.evaluate(async (presetId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openPresetDetail(presetId);
    }, preset.id);
    const editor = page.locator(".mari-editor-shell");
    await expect(editor.locator(".mari-editor-title-input")).toBeVisible();
    const presetParameters = editor.locator('[data-editor-section="parameters"]');
    await expect(presetParameters.getByRole("textbox", { name: "Max Output Tokens", exact: true })).toHaveCount(0);
    await expect(presetParameters.getByRole("textbox", { name: "Temperature", exact: true })).toBeVisible();
    await expect(presetParameters.getByRole("textbox", { name: "Top K", exact: true })).toBeVisible();
    await expect(presetParameters.getByRole("textbox", { name: "Frequency", exact: true })).toBeVisible();
    await info.attach("generation-parameter-controls", {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  } finally {
    await request.delete(`/api/prompts/${preset.id}`);
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/connections/${connection.id}`);
  }
});

test("game chat inherits connection send switches after editing another value and preserves explicit overrides", async ({
  page,
  request,
}, info) => {
  const connections = [];
  let chatId: string | undefined;
  try {
    for (const enabled of [true, false]) {
      const response = await request.post("/api/connections", {
        data: {
          name: `Inherited reasoning ${enabled}`,
          provider: "openai",
          model: "gpt-5.5",
          apiKey: "synthetic-ui-fixture-key",
          baseUrl: "http://127.0.0.1:9/v1",
        },
      });
      expect(response.ok()).toBeTruthy();
      const connection = await response.json();
      connections.push(connection);
      const defaults = await request.put(`/api/connections/${connection.id}/default-parameters`, {
        data: { reasoningEffort: enabled ? "high" : "low", enabledParameters: { reasoningEffort: enabled } },
      });
      expect(defaults.ok()).toBeTruthy();
    }
    const response = await request.post("/api/game/create", {
      data: {
        name: "Inherited reasoning game",
        connectionId: connections[0].id,
        setupConfig: {
          genre: "Fantasy",
          setting: "A quiet valley",
          tone: "Heroic",
          difficulty: "Normal",
          gmMode: "standalone",
          partyCharacterIds: [],
          gameStyle: "classic",
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    const created = await response.json();
    chatId = created.sessionChat.id;
    expect(JSON.parse(created.sessionChat.metadata).chatParameters).toBeUndefined();
    await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { gameSessionStatus: "active", gameIntroPresented: true },
    });
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ id, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { id: chatId!, appVersion: version },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    const parameters = drawer.locator('[data-chat-settings-section="advanced-parameters"]');
    await parameters.getByText("Advanced Parameters", { exact: true }).click();
    const reasoning = parameters.getByRole("checkbox", { name: "Send Reasoning Effort parameter", exact: true });
    await expect(reasoning).toBeChecked();
    const output = parameters.getByRole("textbox", { name: "Max Output Tokens", exact: true });
    await output.fill("12000");
    await output.press("Enter");
    await expect
      .poll(async () => {
        const saved = await (await request.get(`/api/chats/${chatId}`)).json();
        return saved.metadata.chatParameters;
      })
      .toEqual({ maxTokens: 12000 });
    await drawer.getByRole("button", { name: "Connection", exact: true }).click();
    const connectionSelect = drawer
      .locator("select")
      .filter({ has: page.locator(`option[value="${connections[0].id}"]`) })
      .first();
    await connectionSelect.selectOption(connections[1].id);
    await expect(reasoning).not.toBeChecked();
    await connectionSelect.selectOption(connections[0].id);
    await expect(reasoning).toBeChecked();
    await reasoning.locator("..").click();
    await expect(reasoning).not.toBeChecked();
    await connectionSelect.selectOption(connections[1].id);
    await connectionSelect.selectOption(connections[0].id);
    await expect(reasoning).not.toBeChecked();
    await info.attach("game-reasoning-inheritance", {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    for (const connection of connections) await request.delete(`/api/connections/${connection.id}`);
  }
});
