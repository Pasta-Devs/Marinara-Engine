// Chat Settings sections keep their unsaved edits and save their own changes. The drawer is being split into one
// component per section (#9119): a draft must live in the section's always-mounted wrapper, never in its collapsible
// body, and a moved section must still save what it shows.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

async function createCharacter(request: APIRequestContext, name: string) {
  const response = await request.post("/api/characters", { data: { data: { name, first_mes: "" } } });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function createChat(
  request: APIRequestContext,
  mode: "conversation" | "roleplay" | "game",
  characterIds: string[],
  name = `${mode} Chat Settings state`,
) {
  const response = await request.post("/api/chats", {
    data: { name, mode, characterIds },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  if (mode === "game") {
    const metadata = {
      gameId: "chat-settings-state-game",
      gameSessionStatus: "active",
      gameSessionNumber: 1,
      gameIntroPresented: true,
    };
    expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: metadata })).ok()).toBeTruthy();
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The state test game begins." },
    });
    expect(message.ok()).toBeTruthy();
  }
  return chat.id;
}

async function readMetadata(request: APIRequestContext, chatId: string) {
  const stored = (await (await request.get(`/api/chats/${chatId}`)).json()) as {
    metadata: string | Record<string, unknown>;
  };
  return typeof stored.metadata === "string"
    ? (JSON.parse(stored.metadata) as Record<string, unknown>)
    : stored.metadata;
}

async function readConnectedChatId(request: APIRequestContext, chatId: string) {
  const stored = (await (await request.get(`/api/chats/${chatId}`)).json()) as { connectedChatId?: string | null };
  return stored.connectedChatId ?? null;
}

async function setActiveChat(page: Page, chatId: string) {
  await page.evaluate(async (nextChatId) => {
    const module = (await import("/src/stores/chat.store.ts" as string)) as {
      useChatStore: { getState(): { setActiveChatId(id: string): void } };
    };
    module.useChatStore.getState().setActiveChatId(nextChatId);
  }, chatId);
}

async function openApp(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", id);
    },
    { id: chatId, version: APP_VERSION },
  );
  await page.goto("/");
}

async function setOpen(drawer: Locator, open: boolean) {
  const toggle = drawerToggle(drawer);
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute("aria-expanded")) !== String(open)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", String(open));
}

/** Pops a Chat Settings section out into its own window and returns the section inside it. */
async function popOut(page: Page, drawer: Locator, id: string) {
  await drawer.locator(":scope > .mari-drawer__header [data-drawer-control='pop-out']").click();
  const popped = page.locator(`.mari-window[data-window="drawer:chat-settings:${id}"]`);
  await expect(popped).toHaveAttribute("data-detached", "true");
  return popped.locator(`.mari-drawer[data-drawer="${id}"]`);
}

test("Chat Settings drafts survive collapsing and popping out their section", async ({ page, request }, testInfo) => {
  // Popping out is the desktop window; phones show sections as bubbles.
  const desktop = testInfo.project.name.includes("desktop");
  const characterIds = [await createCharacter(request, "State Ada"), await createCharacter(request, "State Bo")];
  const roleplayId = await createChat(request, "roleplay", characterIds);
  const gameId = await createChat(request, "game", characterIds);
  try {
    await openApp(page, roleplayId);
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    const settings = await openChatSettings(page);

    // Group chat's scenario override: typed, not yet saved by leaving the box.
    const scenarioText = "A harbour town at dusk, typed but not left yet";
    const group = settings.locator('[data-drawer="roleplay-group-chat"]');
    await setOpen(group, true);
    await group.locator(":scope > .mari-drawer__body textarea").first().fill(scenarioText);
    await setOpen(group, false);
    await setOpen(group, true);
    await expect(group.locator(":scope > .mari-drawer__body textarea").first()).toHaveValue(scenarioText);
    if (desktop) {
      const popped = await popOut(page, group, "roleplay-group-chat");
      await expect(popped.locator("textarea").first()).toHaveValue(scenarioText);
    }

    // Game widgets: an added widget stays unsaved until Save Widgets.
    await setActiveChat(page, gameId);
    await expect(page.locator('[data-chat-mode="game"]')).toBeVisible();
    await openChatSettings(page);
    const widgets = settings.locator('[data-drawer="game-widgets"]');
    await setOpen(widgets, true);
    const widgetBody = widgets.locator(":scope > .mari-drawer__body");
    await expect(widgetBody.getByText("No widgets selected.", { exact: true })).toBeVisible();
    await widgetBody.getByRole("button", { name: "Add", exact: true }).click();
    await expect(widgetBody.getByRole("button", { name: "Save Widgets", exact: true })).toBeEnabled();
    await setOpen(widgets, false);
    await setOpen(widgets, true);
    await expect(widgetBody.getByText("No widgets selected.", { exact: true })).toHaveCount(0);
    await expect(widgetBody.getByRole("button", { name: "Save Widgets", exact: true })).toBeEnabled();
    if (desktop) {
      const popped = await popOut(page, widgets, "game-widgets");
      await expect(popped.getByRole("button", { name: "Save Widgets", exact: true })).toBeEnabled();
    }
    // Nothing was saved: the drafts lived only in the sections.
    expect((await readMetadata(request, gameId)).gameWidgetState ?? []).toEqual([]);
  } finally {
    await Promise.all([roleplayId, gameId].map((id) => request.delete(`/api/chats/${id}?force=true`)));
    await Promise.all(characterIds.map((id) => request.delete(`/api/characters/${id}`)));
  }
});

test("Chat Settings saves the chat's lorebook choices", async ({ page, request }) => {
  const stamp = `Lore ${Date.now()}`;
  const characterId = await createCharacter(request, "Lore Keeper");
  const chatId = await createChat(request, "roleplay", [characterId]);
  const createBook = async (name: string, extra: Record<string, unknown> = {}) => {
    const response = await request.post("/api/lorebooks", { data: { name, ...extra } });
    expect(response.ok()).toBeTruthy();
    return ((await response.json()) as { id: string }).id;
  };
  const pinnedA = await createBook(`${stamp} Alpha`);
  const pinnedB = await createBook(`${stamp} Beta`);
  // Linked to the chat's character, so it is active without being pinned and can be disabled for this chat.
  const linked = await createBook(`${stamp} Linked`, { characterIds: [characterId] });
  try {
    await openApp(page, chatId);
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    const settings = await openChatSettings(page);
    const lorebooks = settings.locator('[data-drawer="lorebooks"]');
    await setOpen(lorebooks, true);
    const body = lorebooks.locator(":scope > .mari-drawer__body");
    const row = (name: string) => body.locator(`div:has(> div > span:text-is("${name}"))`);

    // Two quick picks both land: each toggle reads the latest saved list, not a stale copy.
    await body.getByRole("button", { name: "Add Lorebook", exact: true }).click();
    await page.getByPlaceholder("Search lorebooks…").fill(stamp);
    await page.locator(`[data-pick-row][title="${stamp} Alpha"]`).click();
    await page.locator(`[data-pick-row][title="${stamp} Beta"]`).click();
    await expect
      .poll(async () => [...((await readMetadata(request, chatId)).activeLorebookIds as string[])].sort())
      .toEqual([pinnedA, pinnedB].sort());
    await page.keyboard.press("Escape");

    await row(`${stamp} Alpha`).getByRole("button", { name: "Remove from chat", exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).activeLorebookIds).toEqual([pinnedB]);

    await row(`${stamp} Linked`).getByRole("button", { name: "Disable in this chat", exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).excludedLorebookIds).toEqual([linked]);
    await row(`${stamp} Linked`).getByRole("button", { name: "Enable in this chat", exact: true }).click();
    await expect.poll(async () => (await readMetadata(request, chatId)).excludedLorebookIds).toEqual([]);
    // Disabling and enabling leaves the pinned list alone.
    expect((await readMetadata(request, chatId)).activeLorebookIds).toEqual([pinnedB]);

    const budget = body.locator('input[inputmode="numeric"]');
    await budget.fill("1234");
    await budget.press("Tab");
    await expect.poll(async () => (await readMetadata(request, chatId)).lorebookTokenBudget).toBe(1234);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
    await Promise.all([pinnedA, pinnedB, linked].map((id) => request.delete(`/api/lorebooks/${id}`)));
    await request.delete(`/api/characters/${characterId}`);
  }
});

// Connected chats differs by mode: Conversation links to a Roleplay or Game chat and has Cross-Chat Awareness,
// Roleplay shows the linked conversation and has Allow character DMs, and Game can start the link from its side.
test("Chat Settings links and unlinks chats from every mode", async ({ page, request }) => {
  const modeSwitches = async (section: Locator) => ({
    crossChat: await section.getByRole("checkbox", { name: /^Cross-Chat Awareness/u }).count(),
    dms: await section.getByRole("checkbox", { name: /^Allow character DMs/u }).count(),
  });
  const stamp = `Link ${Date.now()}`;
  const characterId = await createCharacter(request, "Link Keeper");
  const conversationId = await createChat(request, "conversation", [characterId], `${stamp} Talk`);
  const roleplayId = await createChat(request, "roleplay", [characterId], `${stamp} Quest`);
  const gameId = await createChat(request, "game", [characterId], `${stamp} Campaign`);
  // An already-linked pair: neither picker may offer them.
  const spareTalkId = await createChat(request, "conversation", [characterId], `${stamp} Spare Talk`);
  const spareQuestId = await createChat(request, "roleplay", [characterId], `${stamp} Spare Quest`);
  const pair = await request.post(`/api/chats/${spareTalkId}/connect`, { data: { targetChatId: spareQuestId } });
  expect(pair.ok()).toBeTruthy();
  try {
    await openApp(page, conversationId);
    await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
    const settings = await openChatSettings(page);

    // Conversation → Roleplay.
    const conversation = settings.locator('[data-drawer="conversation-connected-chats"]');
    await setOpen(conversation, true);
    expect(await modeSwitches(conversation)).toEqual({ crossChat: 1, dms: 0 });
    await conversation.getByRole("button", { name: "Link to Roleplay or Game" }).click();
    const search = conversation.getByPlaceholder("Search roleplay or game chats");
    // The search narrows the list: the Game chat drops out while only the Roleplay chat's name matches.
    await search.fill(`${stamp} Quest`);
    await expect(conversation.getByRole("button", { name: `${stamp} Quest`, exact: true })).toBeVisible();
    await expect(conversation.getByRole("button", { name: `${stamp} Campaign`, exact: true })).toHaveCount(0);
    await search.fill(stamp);
    const questOption = conversation.getByRole("button", { name: `${stamp} Quest`, exact: true });
    await expect(questOption, "the picker lists the Roleplay chat").toBeVisible();
    await expect(conversation.getByRole("button", { name: `${stamp} Campaign`, exact: true })).toBeVisible();
    for (const hidden of ["Talk", "Spare Talk", "Spare Quest"]) {
      await expect(
        conversation.getByRole("button", { name: `${stamp} ${hidden}`, exact: true }),
        `the Conversation picker leaves out ${hidden}: itself, other conversations and linked chats`,
      ).toHaveCount(0);
    }
    await questOption.click();
    await expect.poll(() => readConnectedChatId(request, conversationId)).toBe(roleplayId);
    await expect(conversation.getByText(`${stamp} Quest`, { exact: true })).toBeVisible();

    // The Roleplay chat shows the conversation and can unlink it.
    await setActiveChat(page, roleplayId);
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    await openChatSettings(page);
    const roleplay = settings.locator('[data-drawer="roleplay-connected-chats"]');
    await setOpen(roleplay, true);
    await expect(roleplay.getByText(`${stamp} Talk`, { exact: true })).toBeVisible();
    expect(await modeSwitches(roleplay)).toEqual({ crossChat: 0, dms: 1 });
    // Notes from Conversation shows only while a conversation is linked.
    const notes = settings.locator('[data-drawer="conversation-notes"]');
    await expect(notes).toBeVisible();
    await roleplay.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect.poll(() => readConnectedChatId(request, roleplayId)).toBeNull();
    await expect.poll(() => readConnectedChatId(request, conversationId)).toBeNull();
    await expect(notes).toHaveCount(0);
    // An unlinked Roleplay chat can't start a link itself: it explains instead of offering a picker.
    await expect(roleplay.getByText(/^No OOC conversation is linked\./u)).toBeVisible();
    await expect(roleplay.getByRole("button", { name: /^Link to/u })).toHaveCount(0);

    // Game → Conversation, from the unlinked variant; then the linked variant unlinks it.
    await setActiveChat(page, gameId);
    await expect(page.locator('[data-chat-mode="game"]')).toBeVisible();
    await openChatSettings(page);
    const game = settings.locator('[data-drawer="game-connected-chats"]');
    await setOpen(game, true);
    expect(await modeSwitches(game)).toEqual({ crossChat: 0, dms: 0 });
    await game.getByRole("button", { name: "Link to Conversation" }).click();
    await game.getByPlaceholder("Search conversation chats").fill(stamp);
    const talkOption = game.getByRole("button", { name: `${stamp} Talk`, exact: true });
    await expect(talkOption, "the Game picker lists the Conversation chat").toBeVisible();
    for (const hidden of ["Quest", "Spare Talk", "Spare Quest"]) {
      await expect(
        game.getByRole("button", { name: `${stamp} ${hidden}`, exact: true }),
        `the Game picker leaves out ${hidden}: Roleplay chats and linked chats`,
      ).toHaveCount(0);
    }
    await talkOption.click();
    await expect.poll(() => readConnectedChatId(request, gameId)).toBe(conversationId);
    // The section re-renders as linking lands, so retry until it shows the linked chat.
    await expect(async () => {
      await setOpen(game, true);
      await expect(game.getByText(`${stamp} Talk`, { exact: true })).toBeVisible({ timeout: 2000 });
    }).toPass();
    await game.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect.poll(() => readConnectedChatId(request, gameId)).toBeNull();
  } finally {
    await Promise.all(
      [conversationId, roleplayId, gameId, spareTalkId, spareQuestId].map((id) =>
        request.delete(`/api/chats/${id}?force=true`),
      ),
    );
    await request.delete(`/api/characters/${characterId}`);
  }
});
