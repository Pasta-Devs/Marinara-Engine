// The per-agent cards in Chat Settings' Agents section show and save their own settings. The drawer is being split
// into one component per card (#9119), so each card is covered here before it moves.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings } from "./chat-settings-tools.js";

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
  mode?: "roleplay" | "game";
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

/** Opens Chat Settings' Agents section and returns the named agent's card, expanded. */
async function openAgentCard(page: Page, chatId: string, agentId: string) {
  const settings = await openChatSettings(page);
  const agents = settings.locator('[data-drawer="roleplay-agents"]');
  const toggle = agents.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
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
    const hold = (card: typeof continuity) => card.getByRole("checkbox", { name: /^Hold Message Until Rewrite/u });
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
    const prompt = card
      .locator("label")
      .filter({ hasText: /^Prompt/iu })
      .locator("select");
    await expect(prompt).toHaveValue("default");
    await prompt.selectOption("crowd");
    await expect
      .poll(async () => (await readMetadata(request, chatId)).agentPromptTemplateIds)
      .toEqual({ "echo-chamber": "crowd" });
    // Picking Default again clears the chat's choice instead of storing it.
    await prompt.selectOption("default");
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

    await card
      .locator("label")
      .filter({ hasText: /^Target Lorebook/u })
      .locator("select")
      .selectOption(book.id);
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
  card: Locator,
  read: () => Promise<Record<string, unknown>>,
  keys: { sourceType: string; playlistId: string; playlistName: string; artist: string },
  followedLabel: string,
) {
  const source = card
    .locator("label")
    .filter({ hasText: /^Spotify source/u })
    .locator("select");
  await source.selectOption("playlist");
  await expect.poll(async () => (await read())[keys.sourceType]).toBe("playlist");

  const playlist = card
    .locator("label")
    .filter({ hasText: /^Playlist/u })
    .locator("select");
  await expect(playlist.locator("option")).toHaveText(["Choose playlist...", "Road trip (12)", followedLabel]);
  await playlist.selectOption("pl-road");
  await expect.poll(async () => (await read())[keys.playlistId]).toBe("pl-road");
  expect((await read())[keys.playlistName]).toBe("Road trip");

  // Switching to Artist drops the playlist, and the artist saves when the box loses focus.
  await source.selectOption("artist");
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
    const expandMusicDj = agents.getByRole("button", { name: "Expand Music DJ", exact: true });
    if (await expandMusicDj.count()) await expandMusicDj.click();
    await exerciseSpotifySource(
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

    await card
      .locator("label")
      .filter({ hasText: /^Images Per Generation/u })
      .locator("select")
      .selectOption("2");
    await expect.poll(async () => (await readMetadata(request, chatId)).illustratorImagesPerGeneration).toBe(2);

    // The built-in style profiles are always listed after the "use default" choice.
    const style = card
      .locator("label")
      .filter({ hasText: /^Image Style/u })
      .locator("select");
    await expect(style).toHaveValue("");
    await style.selectOption({ index: 1 });
    const chosenStyle = await style.inputValue();
    expect(chosenStyle).not.toBe("");
    await expect.poll(async () => (await readMetadata(request, chatId)).imageStyleProfileId).toBe(chosenStyle);
    await style.selectOption("");
    await expect.poll(async () => (await readMetadata(request, chatId)).imageStyleProfileId ?? null).toBeNull();
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});
