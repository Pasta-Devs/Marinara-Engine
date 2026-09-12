import Fastify from "../packages/server/node_modules/fastify/fastify.js";
import {
  androidLocalAuthHook,
  androidLocalAuthRoutes,
  androidLocalLoginRoute,
  androidLocalAuthTesting,
} from "../packages/server/src/middleware/android-local-auth.js";
import { securityHeadersHook } from "../packages/server/src/middleware/security-headers.js";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const record = (value: any): any => (typeof value === "string" ? JSON.parse(value) : (value ?? {}));
async function fixture(request: APIRequestContext) {
  const resources: string[] = [];
  return {
    async create(path: string, data: unknown) {
      const response = await request.post(`/api/${path}`, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const result = await response.json();
      resources.unshift(`/api/${path}/${result.id}`);
      return result;
    },
    cleanup: async () => {
      for (const path of resources) await request.delete(path);
    },
  };
}
async function openChat(page: Page, chatId: string) {
  page.setDefaultTimeout(10_000);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: "dark",
    chatHelpSeenModes: ["roleplay", "conversation", "game"],
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
}
async function settings(page: Page) {
  await page.evaluate(async () => {
    const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
    useChatStore.getState().setShouldOpenSettings(true);
  });
}

test("effective parameter sources and preset edits survive saved chat overrides", async ({
  page,
  request,
}, testInfo) => {
  const f = await fixture(request);
  try {
    const connection = await f.create("connections", {
      name: "Parameter layers",
      provider: "custom",
      model: "fixture",
      baseUrl: "http://127.0.0.1:9/v1",
      defaultParameters: { maxTokens: 6144 },
    });
    await request.put(`/api/connections/${connection.id}/default-parameters`, { data: { maxTokens: 6144 } });
    const preset = await f.create("prompts", {
      name: "Visible preset parameters",
      parameters: { maxTokens: 8192, temperature: 0.4 },
    });
    const chat = await f.create("chats", {
      name: "Parameter source proof",
      mode: "roleplay",
      connectionId: connection.id,
      promptPresetId: preset.id,
      characterIds: [],
    });
    const patch = async (data: unknown) =>
      expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data })).ok()).toBeTruthy();
    const preview = async () => {
      const response = await request.post("/api/generate/parameters", {
        data: { connectionId: connection.id, chatId: chat.id },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return (await response.json()).parameters;
    };
    await patch({ chatParameters: { maxTokens: 16384, enabledParameters: { temperature: true } } });
    expect((await preview()).maxTokens).toMatchObject({ value: 16384, source: "chat", enabled: true });
    expect((await preview()).temperature).toMatchObject({ value: 0.4, source: "preset", enabled: true });
    await openChat(page, chat.id);
    await settings(page);
    const advanced = page.locator('[data-chat-settings-section="advanced-parameters"]');
    let releasePreview!: () => void;
    const previewGate = new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    await page.route("**/api/generate/parameters", async (route) => {
      await previewGate;
      await route.continue();
    });
    await advanced.getByText("Advanced Parameters", { exact: true }).click();
    const temperature = advanced.getByRole("textbox", { name: "Temperature", exact: true });
    await expect(temperature).toBeDisabled();
    await expect(advanced.getByRole("button", { name: "Save as Connection Default", exact: true })).toBeDisabled();
    const temporaryDefault = await temperature.inputValue();
    expect(temporaryDefault).not.toBe("0.4");
    releasePreview();
    await expect(advanced.getByText("Effective: 16384 · this chat", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("parameter-sources.png"), fullPage: true });
    await expect(temperature).toBeEnabled();
    await expect(temperature).toHaveValue("0.4");
    await temperature.fill(temporaryDefault);
    await temperature.blur();
    await expect
      .poll(
        async () =>
          record((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).chatParameters.temperature,
      )
      .toBe(Number(temporaryDefault));
    await advanced.getByRole("textbox", { name: "Max Output Tokens", exact: true }).fill("12288");
    await advanced.getByRole("textbox", { name: "Max Output Tokens", exact: true }).blur();
    await expect(advanced.getByText("Effective: 12288 · this chat", { exact: true })).toBeVisible();
    await patch({ sceneStatus: "active" });
    expect((await preview()).maxTokens).toMatchObject({ value: 8192, source: "scene" });
    await patch({ sceneStatus: "inactive" });
    await request.patch(`/api/connections/${connection.id}`, { data: { maxTokensOverride: 16 } });
    expect((await preview()).maxTokens).toMatchObject({ value: 16, source: "outputCap" });
    await request.patch(`/api/connections/${connection.id}`, { data: { maxTokensOverride: null } });
    await patch({ chatParameters: { enabledParameters: { temperature: false } } });
    expect((await preview()).maxTokens).toMatchObject({ value: 6144, source: "connection" });
    expect((await preview()).temperature).toMatchObject({ enabled: false, source: "chat" });
    await page.getByRole("button", { name: "Close chat settings", exact: true }).click();
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openPresetDetail(id);
    }, preset.id);
    const editor = page.locator(".mari-editor-shell");
    const parameters = editor.locator('[data-editor-section="parameters"]');
    await parameters.getByRole("textbox", { name: "Max Output Tokens", exact: true }).fill("9000");
    await parameters.getByRole("textbox", { name: "Max Output Tokens", exact: true }).blur();
    await editor.locator(".mari-editor-header .mari-editor-action--primary").click();
    await expect
      .poll(async () => record((await (await request.get(`/api/prompts/${preset.id}`)).json()).parameters).maxTokens)
      .toBe(9000);
    await parameters.screenshot({ path: testInfo.outputPath("preset-parameters.png") });
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
      useUIStore.getState().setTheme("light");
    }, connection.id);
    await expect(page.getByText("Effective: 6144 · from connection", { exact: true })).toBeVisible();
    await page.getByText("Effective: 6144 · from connection", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("connection-parameters-light.png"), fullPage: true });
  } finally {
    await f.cleanup();
  }
});

test("single random choices can be overridden and greetings resolve choices without losing names", async ({
  page,
  request,
}, testInfo) => {
  const f = await fixture(request);
  try {
    const preset = await f.create("prompts", { name: "Greeting choices" });
    expect(
      (
        await request.post(`/api/prompts/${preset.id}/variables`, {
          data: {
            variableName: "genre",
            question: "Choose the genre",
            randomPick: true,
            multiSelect: false,
            options: [
              { id: "a", label: "Mystery", value: "a mystery" },
              { id: "b", label: "Adventure", value: "an adventure" },
            ],
          },
        })
      ).ok(),
    ).toBeTruthy();
    const character = await f.create("characters", {
      data: { name: "Aster", first_mes: "{{char}} invites {{user}} into {{genre}}." },
    });
    const persona = await f.create("characters/personas", { name: "Mari", description: "Greeting persona" });
    const chat = await f.create("chats", {
      name: "Greeting variables",
      mode: "roleplay",
      characterIds: [character.id],
      personaId: persona.id,
      promptPresetId: preset.id,
    });
    expect(
      (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", characterId: character.id, content: "{{char}} invites {{user}} into {{genre}}." },
        })
      ).ok(),
    ).toBeTruthy();
    await openChat(page, chat.id);
    await settings(page);
    await page.locator(".mari-chat-settings-drawer").getByText("Prompt Preset", { exact: true }).click();
    const editVariables = page.getByRole("button", { name: "Edit preset variables", exact: true });
    await editVariables.click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByText("Choose the genre", { exact: true })).toBeVisible();
    const initiallySelected = modal.getByRole("button", { pressed: true });
    await expect(initiallySelected).toHaveCount(1);
    const initialChoice = await initiallySelected.innerText();
    await modal.getByRole("button", { name: /Confirm/ }).click();
    const firstSaved = record((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).presetChoices.genre;
    expect(initialChoice).toContain(firstSaved);
    await editVariables.click();
    await expect(modal.getByRole("button", { pressed: true })).toContainText(firstSaved);

    await modal.getByRole("button", { name: /^Adventure\b/ }).click();
    await modal.getByRole("button", { name: /Confirm/ }).click();
    await expect(page.getByText("Aster invites Mari into an adventure.", { exact: false }).first()).toBeVisible();
    const saved = record((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).presetChoices;
    expect(saved.genre).toBe("an adventure");
    const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
    expect(messages.at(-1).content).toBe("{{char}} invites {{user}} into {{genre}}.");
    await editVariables.click();
    await expect(modal.getByRole("button", { name: /^Adventure\b/ })).toBeVisible();
    await modal.getByRole("button", { name: /^Mystery\b/ }).click();
    await modal.getByRole("button", { name: /Confirm/ }).click();
    await expect(page.getByText("Aster invites Mari into a mystery.", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Close chat settings", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("greeting-variables.png"), fullPage: true });

    // Isolate the real picker from chat navigation, which closes the drawer.
    // Its props must also be safe when a caller keeps it mounted across chats.
    const nextChat = await f.create("chats", {
      name: "Second greeting chat",
      mode: "roleplay",
      promptPresetId: preset.id,
      characterIds: [character.id],
    });
    await page.evaluate(
      async ({ chatId, presetId }) => {
        const { ChoiceSelectionModal } = await import("/src/components/presets/ChoiceSelectionModal.tsx" as string);
        const dependencyUrl = (name: string) =>
          performance
            .getEntriesByType("resource")
            .find((entry) => new URL(entry.name).pathname.endsWith(`/deps/${name}.js`))!.name;
        const { default: React } = await import(dependencyUrl("react"));
        const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
        const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
        const client = new QueryClient();
        const container = document.createElement("div");
        document.body.append(container);
        const root = ReactDOM.createRoot(container);
        const render = (id: string) =>
          root.render(
            React.createElement(
              QueryClientProvider,
              { client },
              React.createElement(ChoiceSelectionModal, {
                open: true,
                onClose: () => {},
                presetId,
                chatId: id,
                existingChoices: { genre: "a mystery" },
              }),
            ),
          );
        render(chatId);
        window.addEventListener("sweep-choice-chat", (event) => render((event as CustomEvent<string>).detail));
      },
      { chatId: chat.id, presetId: preset.id },
    );
    await modal.getByRole("button", { name: /^Adventure\b/ }).click();
    await page.evaluate(
      (id) => window.dispatchEvent(new CustomEvent("sweep-choice-chat", { detail: id })),
      nextChat.id,
    );
    await expect(modal.getByRole("button", { pressed: true })).toContainText("Mystery");
    await modal.getByRole("button", { name: /Confirm/ }).click();
    await expect
      .poll(
        async () =>
          record((await (await request.get(`/api/chats/${nextChat.id}`)).json()).metadata).presetChoices?.genre,
      )
      .toBe("a mystery");
  } finally {
    await f.cleanup();
  }
});

test("blank local models run agent retries and manual Illustrator prompts", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Provider-wire proof does not depend on a viewport.");
  const f = await fixture(request);
  const calls: any[] = [];
  const provider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push(body);
    const illustrator = JSON.stringify(body.messages).includes("illustrator");
    const content = illustrator
      ? JSON.stringify({
          prompt: "2girls, forest",
          characters: ["Aster", "Briar"],
          characterPrompts: [
            { name: "Aster", prompt: "girl, red hair" },
            { name: "Briar", prompt: "girl, blue hair" },
          ],
        })
      : JSON.stringify({ combatActive: false, combatants: [] });
    if (body.stream) {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
    } else {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }));
    }
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing local fixture port");
    const connection = await f.create("connections", {
      name: "Default loaded model",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "",
      apiKey: "",
    });
    const image = await f.create("connections", {
      name: "NovelAI caption fixture",
      provider: "custom",
      baseUrl: "https://image.novelai.net",
      model: "nai-diffusion-5-full",
      apiKey: "synthetic",
      imageService: "novelai",
      imageGenerationSource: "novelai",
    });
    const characters = [];
    for (const name of ["Aster", "Briar"]) characters.push(await f.create("characters", { data: { name } }));
    const chat = await f.create("chats", {
      name: "Local retry proof",
      mode: "roleplay",
      connectionId: connection.id,
      characterIds: characters.map((c) => c.id),
    });
    for (const type of ["combat", "illustrator"])
      await f.create("agents", {
        type,
        name: type,
        phase: "post_processing",
        connectionId: connection.id,
        promptTemplate: `${type} fixture: return JSON.`,
        settings: {
          runInterval: 0,
          enabledTools: [],
          imageConnectionId: image.id,
          customCapabilities: { edit_trackers: true, trigger_image_generation: true },
        },
      });
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["combat", "illustrator"], enableTools: false },
    });
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "Aster and Briar enter the forest." },
    });
    const tracker = await request.post("/api/generate/retry-agents", {
      data: { chatId: chat.id, agentTypes: ["combat"], streaming: false },
    });
    expect(tracker.ok(), await tracker.text()).toBeTruthy();
    expect(calls.length, await tracker.text()).toBeGreaterThan(0);
    expect(calls.at(-1).model).toBe("");
    calls.length = 0;
    const illustration = await request.post("/api/generate/retry-agents", {
      data: {
        chatId: chat.id,
        agentTypes: ["illustrator"],
        streaming: false,
        illustratorRetryTargets: ["illustration"],
        reviewImagePromptsBeforeSend: true,
      },
    });
    expect(illustration.ok(), await illustration.text()).toBeTruthy();
    expect(calls.length, await illustration.text()).toBeGreaterThan(0);
    expect(calls.at(-1).model).toBe("");
    expect(JSON.stringify(calls.at(-1).messages)).toContain("characterPrompts");
    expect(await illustration.text()).toContain("red hair");
    expect(await illustration.text()).toContain("blue hair");
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: false, chatParameters: { maxTokens: 16384 } },
    });
    await request.patch(`/api/connections/${connection.id}`, { data: { maxTokensOverride: 16 } });
    const preview = await request.post("/api/generate/parameters", {
      data: { chatId: chat.id, connectionId: connection.id },
    });
    const effective = (await preview.json()).parameters.maxTokens;
    expect(effective).toMatchObject({ value: 16, source: "outputCap" });
    calls.length = 0;
    const generation = await request.post("/api/generate", {
      data: { chatId: chat.id, connectionId: connection.id, userMessage: "Continue the scene.", streaming: false },
    });
    expect(generation.ok(), await generation.text()).toBeTruthy();
    expect(calls.length, await generation.text()).toBeGreaterThan(0);
    expect(calls.at(-1).max_tokens ?? calls.at(-1).max_completion_tokens).toBe(effective.value);
  } finally {
    await f.cleanup();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

test("Android browser handoff signs in without typing a secret and clears the one-use link", async ({
  page,
  request,
}, testInfo) => {
  // Keep server-only dependency types in the server TypeScript project.
  const { csrfProtectionHook } = await import("../packages/server/src/middleware/csrf-protection.js" as string);
  const previousSecret = process.env.MARINARA_ANDROID_SECRET;
  const secret = "11".repeat(32);
  process.env.MARINARA_ANDROID_SECRET = secret;
  androidLocalAuthTesting.clear();
  const app = Fastify();
  app.addHook("onRequest", securityHeadersHook);
  app.addHook("onRequest", csrfProtectionHook);
  app.addHook("onRequest", androidLocalAuthHook);
  await app.register(androidLocalAuthRoutes, { prefix: "/api/android-auth" });
  await androidLocalLoginRoute(app);
  app.get("/", async (_req, reply) => reply.type("text/html").send("<h1>Marinara browser authenticated</h1>"));
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  try {
    await page.goto(`${origin}/android-login`);
    await expect(page.getByRole("heading", { name: "Authenticate this local browser" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("android-browser-login.png") });
    const clientNonce = "22".repeat(32);
    const challenge = await (
      await request.post(`${origin}/api/android-auth/challenge`, { data: { clientNonce } })
    ).json();
    const response = await request.post(`${origin}/api/android-auth/session`, {
      data: {
        clientNonce,
        serverNonce: challenge.serverNonce,
        browser: true,
        proof: androidLocalAuthTesting.hmac(secret, `client:${clientNonce}:${challenge.serverNonce}`),
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const { browserTicket } = await response.json();
    expect(browserTicket).not.toBe(secret);
    await page.goto(`${origin}/android-login#ticket=${browserTicket}`);
    await expect(page.getByRole("heading", { name: "Marinara browser authenticated" })).toBeVisible();
    expect(page.url()).toBe(`${origin}/`);
    const cookie = (await page.context().cookies(origin)).find((cookie) => cookie.name === "MarinaraAndroidSession");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
    expect(cookie?.value).not.toBe(secret);
    const replay = await request.post(`${origin}/api/android-auth/browser-session`, {
      data: { ticket: browserTicket },
      maxRedirects: 0,
    });
    expect(replay.status()).toBe(401);
  } finally {
    await app.close();
    androidLocalAuthTesting.clear();
    if (previousSecret === undefined) delete process.env.MARINARA_ANDROID_SECRET;
    else process.env.MARINARA_ANDROID_SECRET = previousSecret;
  }
});

test("compatible JSON and PNG cards round-trip identity fields without changing the native card", async ({
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Import/export proof does not depend on a viewport.");
  const f = await fixture(request);
  const importedIds: string[] = [];
  try {
    const data = {
      name: "Export identity fixture",
      description: "Original description {{char}}.",
      extensions: {
        backstory: "Hidden {{user}} backstory.",
        appearance: "Silver hair, red eyes.",
        unrelated: "keep me",
      },
    };
    const character = await f.create("characters", { data });
    const nativeBefore = await (await request.get(`/api/characters/${character.id}/export`)).json();
    const json = await (await request.get(`/api/characters/${character.id}/export?format=compatible`)).json();
    expect(json.data.description).toContain(data.extensions.backstory);
    expect(json.data.description).toContain(data.extensions.appearance);
    expect(json.data.extensions).not.toHaveProperty("backstory");
    expect(json.data.extensions).not.toHaveProperty("appearance");
    expect(json.data.extensions.unrelated).toBe("keep me");
    const png = await request.get(`/api/characters/${character.id}/export-png`);
    expect(png.ok(), await png.text()).toBeTruthy();
    const imports = [
      await request.post("/api/import/st-character", { data: json }),
      await request.post("/api/import/st-character", {
        multipart: { file: { name: "fixture.png", mimeType: "image/png", buffer: await png.body() } },
      }),
    ];
    for (const response of imports) {
      const imported = await response.json();
      expect(imported.success, JSON.stringify(imported)).toBe(true);
      importedIds.push(imported.characterId);
      const exported = await (
        await request.get(`/api/characters/${imported.characterId}/export?format=compatible`)
      ).json();
      expect(exported.data.description).toBe(json.data.description);
      expect(exported.data.extensions.unrelated).toBe("keep me");
    }
    const nativeAfter = await (await request.get(`/api/characters/${character.id}/export`)).json();
    expect(nativeAfter.data).toEqual(nativeBefore.data);
  } finally {
    for (const id of importedIds) await request.delete(`/api/characters/${id}`);
    await f.cleanup();
  }
});
