// The per-agent cards in Chat Settings' Agents section show and save their own settings: each test clicks the real
// control and reads the saved value back through the API.
import { expect, test, type APIRequestContext, type Locator, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chooseOption } from "./select-field.js";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings } from "./chat-settings-tools.js";
import { chooseConnection } from "./connection-picker.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/** The downloadable agents these cards belong to, as the agent catalog would list them. */
const AGENTS = [
  { id: "card-evolution-auditor", name: "Card Evolution Auditor", category: "writer", phase: "post_processing" },
  { id: "continuity", name: "Continuity", category: "writer", phase: "post_processing" },
  { id: "html", name: "HTML", category: "writer", phase: "post_processing" },
  { id: "echo-chamber", name: "Echo Chamber", category: "misc", phase: "post_processing" },
  { id: "lorebook-keeper", name: "Lorebook Keeper", category: "writer", phase: "post_processing" },
  { id: "spotify", name: "Music DJ", category: "misc", phase: "post_processing" },
  { id: "haptic", name: "Haptic", category: "misc", phase: "post_processing" },
  { id: "illustrator", name: "Illustrator", category: "misc", phase: "post_processing" },
  { id: "prose-guardian", name: "Prose Guardian", category: "writer", phase: "post_processing" },
  { id: "knowledge-retrieval", name: "Knowledge Retrieval", category: "writer", phase: "pre_generation" },
  { id: "knowledge-router", name: "Knowledge Router", category: "writer", phase: "pre_generation" },
];

/** A saved agent config, as `/api/agents` returns it, with the prompt templates beyond Default. */
function agentConfig(type: string, promptTemplates: Array<{ id: string; name: string }>) {
  return {
    id: `config-${type}`,
    type,
    name: type,
    description: "",
    phase: "post_processing",
    enabled: "true",
    connectionId: null,
    imagePath: null,
    promptTemplate: "Default prompt.",
    settings: JSON.stringify({
      promptTemplates: promptTemplates.map((template) => ({ ...template, promptTemplate: `${template.name} prompt.` })),
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function readMetadata(request: APIRequestContext, chatId: string) {
  const stored = (await (await request.get(`/api/chats/${chatId}`)).json()) as {
    metadata: string | Record<string, unknown>;
  };
  return typeof stored.metadata === "string"
    ? (JSON.parse(stored.metadata) as Record<string, unknown>)
    : stored.metadata;
}

async function createRoleplayChat(request: APIRequestContext, activeAgentIds: string[], extra = {}) {
  const response = await request.post("/api/chats", {
    data: { name: "Agent cards", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const metadata = { enableAgents: true, activeAgentIds, ...extra };
  expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: metadata })).ok()).toBeTruthy();
  return chat.id;
}

/** A Game chat past its setup, so Chat Settings shows the Game agents. */
async function createGameChat(request: APIRequestContext, extra = {}) {
  const response = await request.post("/api/chats", {
    data: { name: "Agent cards game", mode: "game", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const metadata = {
    gameId: "agent-cards-game",
    gameSessionStatus: "active",
    gameSessionNumber: 1,
    gameIntroPresented: true,
    ...extra,
  };
  expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: metadata })).ok()).toBeTruthy();
  const message = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "The agent card game begins." },
  });
  expect(message.ok()).toBeTruthy();
  return chat.id;
}

type OpenAppOptions = {
  agentConfigs?: unknown[];
  uiState?: Parameters<typeof seedUIState>[1];
  mode?: "conversation" | "roleplay" | "game";
};

async function openApp(page: Page, chatId: string, options: OpenAppOptions = {}) {
  const { agentConfigs = [], uiState = {}, mode = "roleplay" } = options;
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: AGENTS.map((agent) => ({
        ...agent,
        description: `${agent.name} test agent.`,
        author: "Pasta Devs",
        execution: "host",
        enabledByDefault: false,
        modeAllowlist: ["roleplay", "game"],
        defaultPromptTemplate: "Test prompt.",
      })),
    }),
  );
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/agents", (route) => route.fulfill({ json: agentConfigs }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    ...uiState,
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", id);
    },
    { id: chatId, version: APP_VERSION },
  );
  await page.goto("/");
  await expect(page.locator(`[data-chat-mode="${mode}"]`)).toBeVisible();
}

/** Opens Chat Settings with its Agents section expanded. */
async function openAgentsSection(page: Page, mode: "conversation" | "roleplay" | "game" = "roleplay") {
  const settings = await openChatSettings(page);
  const agents = settings.locator(`[data-drawer="${mode}-agents"]`);
  const toggle = agents.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return { settings, agents };
}

/** Opens Chat Settings' Agents section and returns the named agent's card, expanded. */
async function openAgentCard(
  page: Page,
  chatId: string,
  agentId: string,
  mode: "conversation" | "roleplay" | "game" = "roleplay",
) {
  const { settings, agents } = await openAgentsSection(page, mode);
  const card = agents.locator(`#chat-settings-agent-menu-${chatId}-${agentId}`.replace(/[^a-zA-Z0-9_#-]/g, "-"));
  await card.scrollIntoViewIfNeeded();
  const cardToggle = card.locator("[aria-expanded]").first();
  if ((await cardToggle.getAttribute("aria-expanded")) !== "true") await cardToggle.click();
  return { settings, card };
}

async function readAgentDetailId(page: Page) {
  return page.evaluate(async () => {
    const module = (await import("/src/stores/ui.store.ts" as string)) as {
      useUIStore: { getState(): { agentDetailId: string | null } };
    };
    return module.useUIStore.getState().agentDetailId;
  });
}

test("Card Evolution Auditor's card closes Chat Settings and opens the auditor's setup", async ({ page, request }) => {
  const chatId = await createRoleplayChat(request, ["card-evolution-auditor"]);
  try {
    await openApp(page, chatId);
    const { settings, card } = await openAgentCard(page, chatId, "card-evolution-auditor");
    await card.getByRole("button", { name: "Open Auditor Setup", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect.poll(() => readAgentDetailId(page)).toBe("card-evolution-auditor");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Continuity and HTML share one Hold Message Until Rewrite switch", async ({ page, request }) => {
  const chatId = await createRoleplayChat(request, ["continuity", "html"], { proseGuardianHoldForRewrite: false });
  try {
    await openApp(page, chatId);
    const { card: continuity } = await openAgentCard(page, chatId, "continuity");
    const { card: html } = await openAgentCard(page, chatId, "html");
    const hold = (card: typeof continuity) => card.getByRole("switch", { name: /^Hold Message Until Rewrite/u });
    await expect(hold(continuity)).not.toBeChecked();
    await expect(hold(html)).not.toBeChecked();

    await continuity.getByText("Hold Message Until Rewrite", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).proseGuardianHoldForRewrite).toBe(true);
    await expect(hold(html)).toBeChecked();

    await html.getByText("Hold Message Until Rewrite", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).proseGuardianHoldForRewrite).toBe(false);
    await expect(hold(continuity)).not.toBeChecked();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Echo Chamber's card picks its prompt for this chat and opens its setup", async ({ page, request }) => {
  const chatId = await createRoleplayChat(request, ["echo-chamber"]);
  try {
    await openApp(page, chatId, { agentConfigs: [agentConfig("echo-chamber", [{ id: "crowd", name: "Crowd" }])] });
    const { settings, card } = await openAgentCard(page, chatId, "echo-chamber");
    const prompt = card.getByRole("combobox", { name: "Prompt", exact: true });
    await expect(prompt).toHaveAttribute("data-value", "default");
    await chooseOption(page, prompt, "Crowd");
    await expect
      .poll(async () => (await readMetadata(request, chatId)).agentPromptTemplateIds)
      .toEqual({ "echo-chamber": "crowd" });
    // Picking Default again clears the chat's choice instead of storing it.
    await chooseOption(page, prompt, "Default");
    await expect.poll(async () => (await readMetadata(request, chatId)).agentPromptTemplateIds).toEqual({});

    await card.getByRole("button", { name: "Open Setup", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect.poll(() => readAgentDetailId(page)).toBe("echo-chamber");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Lorebook Keeper's card saves its target and read-behind, and starts a backfill", async ({ page, request }) => {
  const bookResponse = await request.post("/api/lorebooks", { data: { name: `Keeper target ${Date.now()}` } });
  expect(bookResponse.ok()).toBeTruthy();
  const book = (await bookResponse.json()) as { id: string; name: string };
  const chatId = await createRoleplayChat(request, ["lorebook-keeper"]);
  const backfills: unknown[] = [];
  // The backfill streams from the server; only the request it sends matters here.
  await page.route("**/api/generate/retry-agents", async (route) => {
    backfills.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
  try {
    await openApp(page, chatId);
    const { card } = await openAgentCard(page, chatId, "lorebook-keeper");

    await chooseOption(page, card.getByRole("combobox", { name: "Target Lorebook", exact: true }), book.name);
    await expect.poll(async () => (await readMetadata(request, chatId)).lorebookKeeperTargetLorebookId).toBe(book.id);

    const readBehind = card
      .locator("label")
      .filter({ hasText: /^Read Behind/u })
      .locator("input");
    await readBehind.fill("7");
    await expect.poll(async () => (await readMetadata(request, chatId)).lorebookKeeperReadBehindMessages).toBe(7);

    await card.getByRole("button", { name: "Backfill Unprocessed", exact: true }).click();
    await expect
      .poll(() => backfills)
      .toContainEqual(
        expect.objectContaining({ chatId, agentTypes: ["lorebook-keeper"], lorebookKeeperBackfill: true }),
      );
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
    await request.delete(`/api/lorebooks/${book.id}`);
  }
});

const SPOTIFY_PLAYLISTS = [
  { id: "pl-road", name: "Road trip", uri: "spotify:playlist:pl-road", trackCount: 12, owned: true },
  { id: "pl-shared", name: "Shared mix", uri: "spotify:playlist:pl-shared", trackCount: null, owned: false },
];

/** Walks Music DJ's Spotify source, playlist and artist, reading back the keys that mode saves under. */
async function exerciseSpotifySource(
  page: Page,
  card: Locator,
  read: () => Promise<Record<string, unknown>>,
  keys: { sourceType: string; playlistId: string; playlistName: string; artist: string },
  followedLabel: string,
) {
  const source = card.getByRole("combobox", { name: /^Spotify source$/iu });
  await chooseOption(page, source, "Playlist");
  await expect.poll(async () => (await read())[keys.sourceType]).toBe("playlist");

  const playlist = card.getByRole("combobox", { name: "Playlist", exact: true });
  await playlist.click();
  await expect(page.getByRole("dialog", { name: "Playlist", exact: true }).locator("[data-pick-row]")).toHaveText([
    "Choose playlist...",
    "Road trip (12)",
    followedLabel,
  ]);
  await page.keyboard.press("Escape");
  await chooseOption(page, playlist, "Road trip (12)");
  await expect.poll(async () => (await read())[keys.playlistId]).toBe("pl-road");
  expect((await read())[keys.playlistName]).toBe("Road trip");

  // Switching to Artist drops the playlist, and the artist saves when the box loses focus.
  await chooseOption(page, source, "Artist");
  await expect.poll(async () => (await read())[keys.sourceType]).toBe("artist");
  expect((await read())[keys.playlistId]).toBeNull();
  const artist = card
    .locator("label")
    .filter({ hasText: /^Artist/u })
    .locator("input");
  await artist.fill("HOYO-MiX");
  await artist.blur();
  await expect.poll(async () => (await read())[keys.artist]).toBe("HOYO-MiX");
}

test("Music DJ's Spotify source saves per chat in Roleplay and Game", async ({ page, request }) => {
  const roleplayId = await createRoleplayChat(request, ["spotify"]);
  const gameId = await createGameChat(request, { gameUseMusicDj: true });
  await page.route("**/api/spotify/playlists**", (route) => route.fulfill({ json: { playlists: SPOTIFY_PLAYLISTS } }));
  try {
    await openApp(page, roleplayId, { uiState: { musicPlayerSource: "spotify" } });
    const { card: roleplayCard } = await openAgentCard(page, roleplayId, "spotify");
    await exerciseSpotifySource(
      page,
      roleplayCard,
      () => readMetadata(request, roleplayId),
      {
        sourceType: "spotifySourceType",
        playlistId: "spotifyPlaylistId",
        playlistName: "spotifyPlaylistName",
        artist: "spotifyArtist",
      },
      "Shared mix (followed, unavailable)",
    );

    await page.evaluate(async (id) => {
      const module = (await import("/src/stores/chat.store.ts" as string)) as {
        useChatStore: { getState(): { setActiveChatId(id: string): void } };
      };
      module.useChatStore.getState().setActiveChatId(id);
    }, gameId);
    await expect(page.locator('[data-chat-mode="game"]')).toBeVisible();
    const settings = await openChatSettings(page);
    const agents = settings.locator('[data-drawer="game-agents"]');
    const toggle = agents.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
    await toggle.scrollIntoViewIfNeeded();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    // Wait for the card's toggle in either state, so a late render can't skip the expand.
    const musicDjToggle = agents.getByRole("button", { name: /^(Expand|Collapse) Music DJ$/u });
    await expect(musicDjToggle).toBeVisible();
    if ((await musicDjToggle.getAttribute("aria-expanded")) !== "true") await musicDjToggle.click();
    await expect(musicDjToggle).toHaveAttribute("aria-expanded", "true");
    await exerciseSpotifySource(
      page,
      agents,
      () => readMetadata(request, gameId),
      {
        sourceType: "gameSpotifySourceType",
        playlistId: "gameSpotifyPlaylistId",
        playlistName: "gameSpotifyPlaylistName",
        artist: "gameSpotifyArtist",
      },
      "Shared mix (followed, unavailable)",
    );
  } finally {
    await request.delete(`/api/chats/${roleplayId}?force=true`);
    await request.delete(`/api/chats/${gameId}?force=true`);
  }
});

test("the Haptic card turns touch cues on and saves their sensitivity and incidental contact", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["haptic"]);
  try {
    await openApp(page, chatId);
    const { card } = await openAgentCard(page, chatId, "haptic");
    // The sensitivity and contact controls only appear once touch cues are on.
    await expect(card.getByText("Touch sensitivity", { exact: true })).toHaveCount(0);
    await card.getByText("Haptic Feedback", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).enableHapticFeedback).toBe(true);

    await card.getByRole("button", { name: "Intense", exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).hapticSensitivity).toBe("intense");
    await expect(card.getByRole("button", { name: "Intense", exact: true })).toHaveAttribute("aria-pressed", "true");

    await card.getByText("Incidental contact", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).hapticIncidentalContact).toBe(true);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Illustrator's card saves this chat's run intervals and images per generation, and resets them", async ({
  page,
  request,
}) => {
  // Pictures and clips shows both the image and the video Run Interval.
  const chatId = await createRoleplayChat(request, ["illustrator"], { illustratorVideoMode: "pictures_and_clips" });
  try {
    await openApp(page, chatId);
    const { card } = await openAgentCard(page, chatId, "illustrator");
    // The field's label holds its input; the label's parent also holds its default status and reset button.
    const interval = (label: string) =>
      card
        .locator("label")
        .filter({ hasText: new RegExp(`^${label}`, "u") })
        .locator("xpath=..");

    for (const [label, key, value] of [
      ["Image Run Interval", "illustratorRunInterval", 3],
      ["Video Run Interval", "illustratorVideoRunInterval", 4],
    ] as const) {
      const field = interval(label);
      await expect(field.getByText("Using agent default", { exact: true })).toBeVisible();
      const input = field.locator("input");
      await input.fill(String(value));
      await input.blur();
      await expect.poll(async () => (await readMetadata(request, chatId))[key]).toBe(value);
      await field.getByRole("button", { name: "Use agent default", exact: true }).click();
      await expect.poll(async () => (await readMetadata(request, chatId))[key] ?? null).toBeNull();
    }

    await chooseOption(page, card.getByRole("combobox", { name: "Images Per Generation", exact: true }), "2");
    await expect.poll(async () => (await readMetadata(request, chatId)).illustratorImagesPerGeneration).toBe(2);

    // The built-in style profiles are always listed after the "use default" choice.
    const style = card.getByRole("combobox", { name: "Image Style", exact: true });
    await expect(style).toHaveAttribute("data-value", "");
    await style.click();
    await page.getByRole("dialog", { name: "Image Style", exact: true }).locator("[data-pick-row]").nth(1).click();
    const chosenStyle = (await style.getAttribute("data-value")) ?? "";
    expect(chosenStyle).not.toBe("");
    await expect.poll(async () => (await readMetadata(request, chatId)).imageStyleProfileId).toBe(chosenStyle);
    await chooseOption(page, style, "Use default style from Style Profiles in Advanced settings");
    await expect.poll(async () => (await readMetadata(request, chatId)).imageStyleProfileId ?? null).toBeNull();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Conversation's Commands card turns single commands and all commands off", async ({ page, request }) => {
  const response = await request.post("/api/chats", {
    data: { name: "Agent cards conversation", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chatId = ((await response.json()) as { id: string }).id;
  try {
    await openApp(page, chatId, { mode: "conversation" });
    const { card } = await openAgentCard(page, chatId, "conversation-commands", "conversation");
    // Memories needs no extra agent, so it's always offered.
    await card.getByText("Memories", { exact: true }).click();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).conversationCommandToggles)
      .toMatchObject({ memory: false });

    // The card's title is also "Commands", so reach the switch through its checkbox's label.
    await card.getByRole("switch", { name: /^Commands/u }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).characterCommands).toBe(false);
    await expect(card.getByText("Memories", { exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

async function createConversationChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Agent cards conversation", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

/** Saves a connection that no test calls, for the model pickers to list. */
async function createConnection(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.post("/api/connections", {
    data: {
      name: `Agent cards ${data.provider} ${Date.now()}`,
      apiKey: "fixture",
      baseUrl: "http://127.0.0.1:9",
      ...data,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

test("Conversation's Illustrator card turns selfies on and saves their models and resolution", async ({
  page,
  request,
}) => {
  const chatId = await createConversationChat(request);
  const imageId = await createConnection(request, {
    provider: "image_generation",
    imageGenerationSource: "openai",
    imageService: "openai",
    model: "gpt-image-1",
  });
  const textId = await createConnection(request, { provider: "custom", model: "prompt-writer" });
  try {
    await openApp(page, chatId, { mode: "conversation" });
    const { card } = await openAgentCard(page, chatId, "illustrator", "conversation");
    const selfieModel = card
      .locator("label")
      .filter({ hasText: /^Selfie model/u })
      .locator('[aria-haspopup="dialog"]');
    await expect(selfieModel).toHaveCount(0);

    await card.getByText("Generated Selfies", { exact: true }).click();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).conversationCommandToggles)
      .toMatchObject({ selfie: true });

    await chooseConnection(page, selfieModel, imageId);
    await expect.poll(async () => (await readMetadata(request, chatId)).imageGenConnectionId).toBe(imageId);

    const promptModel = card.locator('div:has(> span:text-is("Prompt Model")) > [aria-haspopup="dialog"]');
    await chooseConnection(page, promptModel, textId);
    await expect.poll(async () => (await readMetadata(request, chatId)).illustratorPromptConnectionId).toBe(textId);

    // The resolution buttons show once a selfie model is picked.
    await card.getByRole("button", { name: "768x1024", exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).selfieResolution).toBe("768x1024");

    await card.getByText("Generated Selfies", { exact: true }).click();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).conversationCommandToggles)
      .toMatchObject({ selfie: false });
    await expect(selfieModel).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
    await request.delete(`/api/connections/${imageId}`);
    await request.delete(`/api/connections/${textId}`);
  }
});

test("Conversation's Illustrator card saves video messages, their first frame and the reference scopes", async ({
  page,
  request,
}) => {
  const chatId = await createConversationChat(request);
  const videoId = await createConnection(request, {
    provider: "video_generation",
    videoGenerationSource: "openrouter",
    videoService: "openrouter",
    model: "fixture/video",
  });
  try {
    await openApp(page, chatId, { mode: "conversation" });
    const { card } = await openAgentCard(page, chatId, "illustrator", "conversation");

    await card.getByText("Generated Videos", { exact: true }).click();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).conversationCommandToggles)
      .toMatchObject({ video: true });

    await chooseConnection(
      page,
      card
        .locator("label")
        .filter({ hasText: /^Video model/u })
        .locator('[aria-haspopup="dialog"]'),
      videoId,
    );
    await expect.poll(async () => (await readMetadata(request, chatId)).sceneVideoConnectionId).toBe(videoId);

    await chooseOption(page, card.getByRole("combobox", { name: "First frame", exact: true }), "Avatar or sprite");
    await expect.poll(async () => (await readMetadata(request, chatId)).sceneVideoFirstFrame).toBe("avatar");

    // Each scope saves one switch for pictures and one for videos.
    const scope = (label: string) => card.getByRole("combobox", { name: label, exact: true });
    await chooseOption(page, scope("Send Avatar References"), "Images only");
    await expect
      .poll(async () => {
        const metadata = await readMetadata(request, chatId);
        return [metadata.selfieUseAvatarReferences, metadata.selfieVideoUseAvatarReferences];
      })
      .toEqual([true, false]);
    await chooseOption(page, scope("Attach Card Appearance"), "Videos only");
    await expect
      .poll(async () => {
        const metadata = await readMetadata(request, chatId);
        return [metadata.selfieIncludeCharacterAppearance, metadata.selfieVideoIncludeCharacterAppearance];
      })
      .toEqual([false, true]);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
    await request.delete(`/api/connections/${videoId}`);
  }
});

test("Conversation's schedule preferences in Agents save as the global preference and show as active", async ({
  page,
  request,
}) => {
  const chatId = await createConversationChat(request);
  try {
    await openApp(page, chatId, { mode: "conversation" });
    const settings = await openChatSettings(page);
    const agents = settings.locator('[data-drawer="conversation-agents"]');
    const toggle = agents.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
    await toggle.scrollIntoViewIfNeeded();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    const preferences = agents
      .locator("label")
      .filter({ hasText: /^Schedule Generation Preferences/iu })
      .locator("textarea");
    await preferences.fill("Everyone sleeps before midnight.");
    await expect(agents.getByText('"Everyone sleeps before midnight."', { exact: true })).toBeVisible();
    // It's an app-wide setting, kept in the UI store rather than the chat.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const module = (await import("/src/stores/ui.store.ts" as string)) as {
            useUIStore: { getState(): { scheduleGenerationPreferences: string } };
          };
          return module.useUIStore.getState().scheduleGenerationPreferences;
        }),
      )
      .toBe("Everyone sleeps before midnight.");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Chat Settings stays open when Prose Guardian's unsaved text fails to save on close", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["prose-guardian"]);
  let failedSaves = 0;
  // Only Prose Guardian's saves fail, so another metadata save during the test can't change the count.
  const failSaves = async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (route.request().method() !== "PATCH" || !Object.keys(body ?? {}).some((key) => key.startsWith("proseGuardian")))
      return route.fallback();
    failedSaves += 1;
    await route.fulfill({ status: 500, json: { error: "Save failed" } });
  };
  try {
    await openApp(page, chatId);
    const { settings, card } = await openAgentCard(page, chatId, "prose-guardian");
    const banned = card.getByRole("textbox", { name: "Banned Words", exact: true });
    await banned.fill("ozone, velvet");

    await page.route(`**/api/chats/${chatId}/metadata`, failSaves);
    // A real click blurs the field first, and its own save could change the stored text before the close runs.
    // Dispatching the click leaves the blur to the close itself, so the close's save of the drafts is what fails.
    await settings.locator('[data-window-control="close"]').dispatchEvent("click");
    // One failed save from the field's blur, one from the close.
    await expect.poll(() => failedSaves).toBe(2);
    await expect(page.getByText("Failed to save Prose Guardian changes.", { exact: true }).first()).toBeVisible();
    await expect(settings).toBeVisible();
    // What was typed is still there to save again.
    await expect(banned).toHaveValue("ozone, velvet");

    await page.unroute(`**/api/chats/${chatId}/metadata`, failSaves);
    const close = settings.locator('[data-window-control="close"]');
    // The first close may still be finishing, and a click while one runs is ignored, so click until it closes.
    await expect(async () => {
      await close.click();
      await expect(settings).toHaveCount(0, { timeout: 2_000 });
    }).toPass();
    expect((await readMetadata(request, chatId)).proseGuardianBannedWords).toBe("ozone, velvet");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Prose Guardian keeps its typed text when the save it started on leaving the field fails as Chat Settings closes", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["prose-guardian"]);
  let failedSaves = 0;
  // Prose Guardian's saves fail, slowly, so the field's own save is still running when the close checks for unsaved text.
  const failSaves = async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (route.request().method() !== "PATCH" || !Object.keys(body ?? {}).some((key) => key.startsWith("proseGuardian")))
      return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ status: 500, json: { error: "Save failed" } });
    failedSaves += 1;
  };
  try {
    await openApp(page, chatId);
    const { settings, card } = await openAgentCard(page, chatId, "prose-guardian");
    const avoid = card.getByRole("textbox", { name: "Remove From Writing", exact: true });
    await avoid.fill("Purple prose.");

    await page.route(`**/api/chats/${chatId}/metadata`, failSaves);
    // A real click: leaving the field starts its save, then the close runs while that save is in flight.
    const close = settings.locator('[data-window-control="close"]');
    await close.click();
    // The field's save fails while the close waits on it.
    await expect.poll(() => failedSaves, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText("Failed to save Prose Guardian changes.", { exact: true }).first()).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(avoid).toHaveValue("Purple prose.");

    await page.unroute(`**/api/chats/${chatId}/metadata`, failSaves);
    // The first close may still be finishing, and a click while one runs is ignored, so click until it closes.
    await expect(async () => {
      await close.click();
      await expect(settings).toHaveCount(0, { timeout: 2_000 });
    }).toPass();
    expect((await readMetadata(request, chatId)).proseGuardianAvoidInstructions).toBe("Purple prose.");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Chat Settings stays open when one Prose Guardian box's save fails and another box's text saves on close", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["prose-guardian"]);
  // Only saves that carry Remove From Writing fail, slowly; Banned Words on its own saves fine.
  const failAvoidSaves = async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (route.request().method() !== "PATCH" || !Object.hasOwn(body ?? {}, "proseGuardianAvoidInstructions"))
      return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ status: 500, json: { error: "Save failed" } });
  };
  try {
    await openApp(page, chatId);
    const { settings, card } = await openAgentCard(page, chatId, "prose-guardian");
    const avoid = card.getByRole("textbox", { name: "Remove From Writing", exact: true });
    const banned = card.getByRole("textbox", { name: "Banned Words", exact: true });
    await page.route(`**/api/chats/${chatId}/metadata`, failAvoidSaves);

    await avoid.fill("Purple prose.");
    // Moving to Banned Words starts Remove From Writing's own save, which will fail.
    const avoidSave = page.waitForRequest(
      (saveRequest) =>
        saveRequest.method() === "PATCH" &&
        Object.hasOwn(saveRequest.postDataJSON() ?? {}, "proseGuardianAvoidInstructions"),
    );
    await banned.fill("ozone, velvet");
    await avoidSave;
    await settings.locator('[data-window-control="close"]').click();
    await expect(page.getByText("Failed to save Prose Guardian changes.", { exact: true }).first()).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(avoid).toHaveValue("Purple prose.");

    await page.unroute(`**/api/chats/${chatId}/metadata`, failAvoidSaves);
    const close = settings.locator('[data-window-control="close"]');
    // The first close may still be finishing, and a click while one runs is ignored, so click until it closes.
    await expect(async () => {
      await close.click();
      await expect(settings).toHaveCount(0, { timeout: 2_000 });
    }).toPass();
    const metadata = await readMetadata(request, chatId);
    expect(metadata.proseGuardianAvoidInstructions).toBe("Purple prose.");
    expect(metadata.proseGuardianBannedWords).toBe("ozone, velvet");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Chat Settings closes while saves fail once Prose Guardian's typed text is taken back", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["prose-guardian"], { proseGuardianBannedWords: "ozone" });
  const failSaves = (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (route.request().method() !== "PATCH" || !Object.keys(body ?? {}).some((key) => key.startsWith("proseGuardian")))
      return route.fallback();
    return route.fulfill({ status: 500, json: { error: "Save failed" } });
  };
  try {
    await openApp(page, chatId);
    const { settings, card } = await openAgentCard(page, chatId, "prose-guardian");
    const banned = card.getByRole("textbox", { name: "Banned Words", exact: true });
    await page.route(`**/api/chats/${chatId}/metadata`, failSaves);
    await banned.fill("ozone, velvet");
    await banned.blur();
    await expect(page.getByText("Failed to save Prose Guardian changes.", { exact: true }).first()).toBeVisible();
    await expect(banned).toHaveValue("ozone, velvet");

    // With saves still failing, putting the saved text back leaves nothing to save, so Chat Settings can close.
    await banned.fill("ozone");
    await settings.locator('[data-window-control="close"]').click();
    await expect(settings).toHaveCount(0);
  } finally {
    await page.unroute(`**/api/chats/${chatId}/metadata`, failSaves);
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

/** Collects the bodies of this chat's metadata saves, for keys a later save can't change on the server. */
function recordMetadataSaves(page: Page, chatId: string) {
  const saves: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().endsWith(`/api/chats/${chatId}/metadata`)) {
      saves.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  return saves;
}

test("Prose Guardian's card saves its writing instructions on blur and its own Hold switch", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["prose-guardian"], { proseGuardianHoldForRewrite: false });
  try {
    await openApp(page, chatId);
    const { card } = await openAgentCard(page, chatId, "prose-guardian");
    // Each field saves when it loses focus; closing Chat Settings would also save them, so stay open.
    for (const [label, key, text] of [
      ["Remove From Writing", "proseGuardianAvoidInstructions", "Purple prose and ozone."],
      ["Prefer In Writing", "proseGuardianStyleInstructions", "Short, plain sentences."],
    ] as const) {
      const field = card.getByRole("textbox", { name: label, exact: true });
      await field.fill(text);
      await field.blur();
      await expect.poll(async () => (await readMetadata(request, chatId))[key]).toBe(text);
    }

    await card.getByText("Hold Message Until Rewrite", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).proseGuardianHoldForRewrite).toBe(true);
    await expect(card.getByRole("switch", { name: /^Hold Message Until Rewrite/u })).toBeChecked();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Knowledge Retrieval and Knowledge Router each save their own source settings", async ({ page, request }) => {
  const chatId = await createRoleplayChat(request, ["knowledge-retrieval", "knowledge-router"]);
  try {
    await openApp(page, chatId);
    const { card: retrieval } = await openAgentCard(page, chatId, "knowledge-retrieval");
    const { card: router } = await openAgentCard(page, chatId, "knowledge-router");
    const useActive = (card: Locator) => card.getByRole("switch", { name: /^Use chat-active lorebooks/u });
    const initial = await useActive(retrieval).isChecked();
    await expect(useActive(router)).toBeChecked({ checked: initial });
    const sources = async () =>
      ((await readMetadata(request, chatId)).knowledgeAgentSources ?? {}) as Record<
        string,
        { useChatActiveLorebooks?: boolean }
      >;

    await retrieval.getByText("Use chat-active lorebooks", { exact: true }).click();
    await expect.poll(async () => (await sources())["knowledge-retrieval"]?.useChatActiveLorebooks).toBe(!initial);
    expect(await sources()).not.toHaveProperty("knowledge-router");
    await expect(useActive(router)).toBeChecked({ checked: initial });

    await router.getByText("Use chat-active lorebooks", { exact: true }).click();
    await expect.poll(async () => (await sources())["knowledge-router"]?.useChatActiveLorebooks).toBe(!initial);
    expect((await sources())["knowledge-retrieval"]?.useChatActiveLorebooks).toBe(!initial);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Roleplay's Illustrator card saves what it makes, the first frame, both reference scopes and backgrounds", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, ["illustrator"], {
    illustratorIncludeCharacterAppearance: false,
    illustratorVideoIncludeCharacterAppearance: false,
    illustratorUseAvatarReferences: false,
    illustratorVideoUseAvatarReferences: false,
    illustratorAutoBackgroundsEnabled: false,
  });
  try {
    await openApp(page, chatId);
    const { card } = await openAgentCard(page, chatId, "illustrator");
    const select = (label: string) => card.getByRole("combobox", { name: label, exact: true });

    await chooseOption(page, select("Illustrator makes"), "Clips only");
    await expect.poll(async () => (await readMetadata(request, chatId)).illustratorVideoMode).toBe("clips_only");

    await chooseOption(page, select("First frame"), "New Illustrator picture, then animate it");
    await expect.poll(async () => (await readMetadata(request, chatId)).sceneVideoFirstFrame).toBe("picture");

    // Each scope saves one switch for pictures and one for videos.
    await chooseOption(page, select("Attach Card Appearance"), "Images only");
    await expect
      .poll(async () => {
        const metadata = await readMetadata(request, chatId);
        return [metadata.illustratorIncludeCharacterAppearance, metadata.illustratorVideoIncludeCharacterAppearance];
      })
      .toEqual([true, false]);
    await chooseOption(page, select("Send Avatar References"), "Videos only");
    await expect
      .poll(async () => {
        const metadata = await readMetadata(request, chatId);
        return [metadata.illustratorUseAvatarReferences, metadata.illustratorVideoUseAvatarReferences];
      })
      .toEqual([false, true]);

    await card.getByText("Generate Scene Backgrounds", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).illustratorAutoBackgroundsEnabled).toBe(true);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Roleplay's Review Agent Outputs switch in Trackers Control saves, and Agent Suite opens", async ({
  page,
  request,
}) => {
  const chatId = await createRoleplayChat(request, []);
  try {
    await openApp(page, chatId);
    const { agents } = await openAgentsSection(page);
    const control = agents.locator("[data-trackers-control]");
    await control.getByRole("button", { name: "Expand Trackers Control", exact: true }).click();
    await control.getByText("Review Agent Outputs", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).agentWriteApprovalRequired).toBe(true);
    await control.getByText("Review Agent Outputs", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).agentWriteApprovalRequired).toBe(false);

    await agents.getByRole("button", { name: /^Agent Suite/u }).click();
    await expect(page.getByRole("dialog", { name: "Agent Suite", exact: true })).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Game's Review Agent Outputs switch saves", async ({ page, request }) => {
  const chatId = await createGameChat(request);
  try {
    await openApp(page, chatId, { mode: "game" });
    const { agents } = await openAgentsSection(page, "game");
    const review = agents.getByRole("switch", { name: /^Review Agent Outputs/u });
    await expect(review).not.toBeChecked();
    await agents.getByText("Review Agent Outputs", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).agentWriteApprovalRequired).toBe(true);
    await expect(review).toBeChecked();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Game's agent list turns a catalog agent on and off for the game", async ({ page, request }) => {
  const chatId = await createGameChat(request, { enableAgents: true, activeAgentIds: ["html"] });
  const saves = recordMetadataSaves(page, chatId);
  try {
    await openApp(page, chatId, { mode: "game" });
    const { agents } = await openAgentsSection(page, "game");
    const entry = agents.locator('[data-chat-agent-entry="echo-chamber"]');
    const toggle = entry.getByRole("switch", { name: /^Echo Chamber/u });
    await expect(toggle).not.toBeChecked();

    await entry.getByText("Echo Chamber", { exact: true }).click();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).activeAgentIds)
      .toEqual(["html", "echo-chamber"]);
    // Turning one on also turns agents on for the game; the seeded value already is, so check what was sent.
    expect(
      saves.find((save) => Array.isArray(save.activeAgentIds) && save.activeAgentIds.includes("echo-chamber")),
    ).toMatchObject({ enableAgents: true, activeAgentIds: ["html", "echo-chamber"] });
    await expect(toggle).toBeChecked();

    await entry.getByText("Echo Chamber", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).activeAgentIds).toEqual(["html"]);
    await expect(toggle).not.toBeChecked();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Game's Illustrator card turns on, keeps the campaign style with the setup, and saves scene instructions", async ({
  page,
  request,
}) => {
  const chatId = await createGameChat(request, {
    gameSetupConfig: { useCampaignArtStyle: false, artStylePrompt: "Ink wash", genre: "mystery" },
  });
  try {
    await openApp(page, chatId, { mode: "game" });
    const { card } = await openAgentCard(page, chatId, "illustrator", "game");
    // The image settings only show once the game may request images.
    await expect(card.getByText("Use Campaign Art Style", { exact: true })).toHaveCount(0);
    await card.getByText("Game Illustrator", { exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).enableSpriteGeneration).toBe(true);

    await card.getByText("Use Campaign Art Style", { exact: true }).click();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).gameSetupConfig)
      .toEqual({ useCampaignArtStyle: true, artStylePrompt: "Ink wash", genre: "mystery" });

    const instructions = card.getByRole("textbox", { name: "Scene image instructions", exact: true });
    await instructions.fill("Dottore's mask covers his eyes.");
    await instructions.blur();
    await expect
      .poll(async () => (await readMetadata(request, chatId)).gameImagePromptInstructions)
      .toBe("Dottore's mask covers his eyes.");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});

test("Game's Music DJ and Lorebook Keeper cards turn on and save the music player", async ({ page, request }) => {
  const chatId = await createGameChat(request);
  await page.route("**/api/spotify/playlists**", (route) => route.fulfill({ json: { playlists: SPOTIFY_PLAYLISTS } }));
  try {
    await openApp(page, chatId, { mode: "game", uiState: { musicPlayerSource: "youtube" } });
    const { agents } = await openAgentsSection(page, "game");
    // "Music DJ" is also the card's title, so reach the switch through its checkbox's label.
    const musicDj = agents.getByRole("switch", { name: /^Music DJ/u });
    await expect(musicDj).not.toBeChecked();
    await musicDj.click();
    await expect
      .poll(async () => {
        const metadata = await readMetadata(request, chatId);
        return [metadata.gameUseMusicDj, metadata.gameUseSpotifyMusic, metadata.enableAgents, metadata.activeAgentIds];
      })
      .toEqual([true, false, true, ["spotify"]]);
    await expect(musicDj).toBeChecked();

    // The player is an app-wide choice the buttons show; with Music DJ on, the game also records whether it uses
    // Spotify.
    const spotify = agents.getByRole("button", { name: "Spotify", exact: true });
    await expect(spotify).toHaveAttribute("aria-pressed", "false");
    await spotify.click();
    await expect(spotify).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await readMetadata(request, chatId)).gameUseSpotifyMusic).toBe(true);

    const keeper = agents.getByText("Game Session Keeper", { exact: true });
    await keeper.click();
    await expect.poll(async () => (await readMetadata(request, chatId)).gameLorebookKeeperEnabled).toBe(true);
    await keeper.click();
    await expect.poll(async () => (await readMetadata(request, chatId)).gameLorebookKeeperEnabled).toBe(false);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});
