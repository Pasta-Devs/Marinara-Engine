// Chat Settings shows the same sections, in the same order, in each chat mode, and each drawer section opens with
// content and no page error (the settings profiles bar isn't a drawer, so it is only listed). It guards the drawer split into one component per section (#9119, and the plan in
// .github/plans/chat-settings-drawer-split.md). It covers the sections this fixture turns on; sections that need other
// data (multiplayer, card field alternatives, scene instructions, a connected chat) need their own tests.
// A section added or removed on purpose updates its mode's list below. A renamed id is a real change: the id keys
// each person's remembered open and popped-out state, so a rename resets it.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsWindow, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

type ChatMode = "conversation" | "roleplay" | "game";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

// For a chat with two characters, one of them with a regex script of its own.
const EXPECTED_SECTIONS: Record<ChatMode, string[]> = {
  conversation: [
    "settings-profiles",
    "conversation-message-search",
    "chat-name",
    "conversation-chat-branches",
    "connection",
    "conversation-prompt",
    "advanced-parameters",
    "conversation-persona",
    "conversation-characters",
    "conversation-group-chat",
    "conversation-scoped-regex",
    "conversation-chat-variables",
    "conversation-connected-chats",
    "lorebooks",
    "conversation-active-context",
    "conversation-agents",
    "conversation-gallery",
    "conversation-memory-recall",
    "function-calling",
    "translation",
    "conversation-autonomous-messaging",
    "conversation-automatic-summarization",
  ],
  roleplay: [
    "settings-profiles",
    "roleplay-message-search",
    "chat-name",
    "roleplay-chat-branches",
    "connection",
    "prompt-preset",
    "advanced-parameters",
    "roleplay-persona",
    "roleplay-characters",
    "roleplay-ruleset",
    "roleplay-group-chat",
    "roleplay-scoped-regex",
    "roleplay-chat-variables",
    "roleplay-connected-chats",
    "lorebooks",
    "roleplay-chat-summary",
    "roleplay-active-context",
    "roleplay-agents",
    "roleplay-agent-activity",
    "roleplay-author-notes",
    "roleplay-background",
    "roleplay-gallery",
    "impersonate",
    "roleplay-memory-recall",
    "function-calling",
    "translation",
  ],
  game: [
    "chat-name",
    "game-chat-branches",
    "connection",
    "game-prompt",
    "advanced-parameters",
    "game-party",
    "game-scoped-regex",
    "game-chat-variables",
    "game-connected-chats",
    "lorebooks",
    "game-active-context",
    "game-agents",
    "game-background",
    "game-gallery",
    "combat-style",
    "game-widgets",
    "game-memory-recall",
    "function-calling",
    "translation",
  ],
};

async function createCharacter(request: APIRequestContext, name: string) {
  const response = await request.post("/api/characters", { data: { data: { name, first_mes: "" } } });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function createChat(request: APIRequestContext, mode: ChatMode, characterIds: string[]) {
  const response = await request.post("/api/chats", {
    data: { name: `${mode} Chat Settings sections`, mode, characterIds },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const metadata =
    mode === "game"
      ? {
          gameId: "chat-settings-sections-game",
          gameSessionStatus: "active",
          gameSessionNumber: 1,
          gameIntroPresented: true,
        }
      : mode === "roleplay"
        ? { enableAgents: true }
        : null;
  if (metadata) {
    expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: metadata })).ok()).toBeTruthy();
  }
  if (mode === "game") {
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The sections test game begins." },
    });
    expect(message.ok()).toBeTruthy();
  }
  return { id: chat.id, mode };
}

async function setActiveChat(page: Page, chatId: string) {
  await page.evaluate(async (nextChatId) => {
    const module = (await import("/src/stores/chat.store.ts" as string)) as {
      useChatStore: { getState(): { setActiveChatId(id: string): void } };
    };
    module.useChatStore.getState().setActiveChatId(nextChatId);
  }, chatId);
}

/**
 * Top-level Chat Settings sections in on-screen order; drawers nested inside a section are left out. The settings
 * profiles bar isn't a drawer, so it has its own attribute.
 */
async function visibleSections(page: Page) {
  return chatSettingsWindow(page).evaluate((root) => {
    const blocks = Array.from(
      root.querySelectorAll<HTMLElement>("[data-drawer], [data-chat-settings-profiles]"),
    ).filter((element) => !element.parentElement?.closest("[data-drawer]") && element.getClientRects().length > 0);
    return blocks
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((element) =>
        element.hasAttribute("data-chat-settings-profiles")
          ? "settings-profiles"
          : element.getAttribute("data-drawer")!,
      );
  });
}

test("Chat Settings shows every section for each chat mode, in order, and each one opens", async ({
  page,
  request,
}) => {
  const characterIds = [await createCharacter(request, "Section Ada"), await createCharacter(request, "Section Bo")];
  const regexResponse = await request.post("/api/regex-scripts", {
    data: {
      name: "Chat Settings sections fixture",
      findRegex: "SECTIONS_FIXTURE",
      replaceString: "",
      placement: ["ai_output"],
      targetCharacterIds: [characterIds[0]],
    },
  });
  expect(regexResponse.ok()).toBeTruthy();
  const regexId = ((await regexResponse.json()) as { id: string }).id;
  const chats = [
    await createChat(request, "conversation", characterIds),
    await createChat(request, "roleplay", characterIds),
    await createChat(request, "game", characterIds),
  ];
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem("marinara-active-chat-id", chatId);
      },
      { chatId: chats[0]!.id, version: APP_VERSION },
    );
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/");

    for (const [index, chat] of chats.entries()) {
      if (index > 0) await setActiveChat(page, chat.id);
      await expect(page.locator(`[data-chat-mode="${chat.mode}"]`)).toBeVisible();
      const settings = await openChatSettings(page);
      // Sections that wait on data appear a moment later, so poll until the list settles.
      await expect
        .poll(() => visibleSections(page), { message: `${chat.mode} Chat Settings sections` })
        .toEqual(EXPECTED_SECTIONS[chat.mode]);

      // A section's body only renders while it is open, so open each one and check it has content.
      for (const id of EXPECTED_SECTIONS[chat.mode].filter((section) => section !== "settings-profiles")) {
        const drawer = settings.locator(`[data-drawer="${id}"]`);
        const toggle = drawerToggle(drawer);
        await toggle.scrollIntoViewIfNeeded();
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
        await expect(toggle, `${id} opens`).toHaveAttribute("aria-expanded", "true");
        await expect(drawer.locator(":scope > .mari-drawer__body"), `${id} has content`).not.toBeEmpty();
      }
      // Checked again after opening everything, so a section that shows up late fails too.
      expect(await visibleSections(page), `${chat.mode} sections after opening each one`).toEqual(
        EXPECTED_SECTIONS[chat.mode],
      );
      expect(pageErrors, `${chat.mode}: no page errors`).toEqual([]);
    }
  } finally {
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
    await request.delete(`/api/regex-scripts/${regexId}`);
    await Promise.all(characterIds.map((id) => request.delete(`/api/characters/${id}`)));
  }
});
