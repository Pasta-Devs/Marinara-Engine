// #7034: Chat Branches, Chat Summary, Active Context, Author's Notes, Agent activity and Gallery moved from
// the chat's top buttons into Chat Settings drawers, and Search messages sits under Profile setup.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import {
  chatSettingsDrawer,
  drawerToggle,
  openChatSettings,
  openChatSettingsTool,
  type ChatSettingsTool,
} from "./chat-settings-tools.js";

type ChatMode = "conversation" | "roleplay" | "game";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

async function createChat(request: APIRequestContext, mode: ChatMode) {
  const response = await request.post("/api/chats", {
    data: { name: `${mode} Chat Settings tools`, mode, characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const metadata =
    mode === "game"
      ? {
          gameId: "chat-settings-tools-game",
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
      data: { role: "assistant", content: "The tools test game begins." },
    });
    expect(message.ok()).toBeTruthy();
  }
  return { id: chat.id, mode };
}

async function setActiveChat(page: Page, chatId: string) {
  await page.evaluate(async (nextChatId) => {
    const module = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
    module.useChatStore.getState().setActiveChatId(nextChatId);
  }, chatId);
}

/** Top edge of each element, so the visual order (CSS `order`) can be compared. */
async function tops(locators: Locator[]) {
  return Promise.all(locators.map(async (locator) => (await locator.boundingBox())?.y ?? Number.NaN));
}

const TOOLS: Record<ChatMode, ChatSettingsTool[]> = {
  roleplay: ["chat-branches", "chat-summary", "active-context", "agent-activity", "author-notes", "gallery"],
  conversation: ["chat-branches", "active-context", "gallery"],
  game: ["chat-branches", "active-context", "gallery"],
};

// The removed top buttons, by their old accessible names.
const REMOVED_BUTTONS = [
  /^Switch branch/u,
  /^Chat Summary/u,
  /^Active Context$/u,
  /^Author.s Notes$/u,
  /^Agents & Actions/u,
  /^Gallery$/u,
  /^Search messages$/u,
];

test("chat tools live in Chat Settings in every mode and their top buttons are gone", async ({
  page,
  request,
}, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  const chats = [
    await createChat(request, "roleplay"),
    await createChat(request, "conversation"),
    await createChat(request, "game"),
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
    await page.goto("/");

    for (const [index, chat] of chats.entries()) {
      if (index > 0) await setActiveChat(page, chat.id);
      const root = page.locator(`[data-chat-mode="${chat.mode}"]`);
      await expect(root).toBeVisible();

      // Phones have no chat menu any more: Chat Settings is in the topbar, the rest are bubbles.
      if (mobile) {
        await expect(
          page.getByRole("button", { name: /^(More options|Game actions)$/u }).filter({ visible: true }),
        ).toHaveCount(0);
      }
      for (const name of REMOVED_BUTTONS) {
        await expect(page.getByRole("button", { name }).filter({ visible: true }), `${chat.mode}: ${name}`).toHaveCount(
          0,
        );
      }

      const settings = await openChatSettings(page);
      for (const name of REMOVED_BUTTONS) {
        await expect(root.getByRole("button", { name }).filter({ visible: true })).toHaveCount(0);
      }

      // Search messages: inline under Profile setup (Conversation and Roleplay only).
      const search = settings.locator("[data-chat-settings-search]");
      const chatName = settings.locator('[data-chat-settings-section="chat-name"]');
      const branches = chatSettingsDrawer(page, "chat-branches");
      if (chat.mode === "game") {
        await expect(search).toHaveCount(0);
      } else {
        const searchDrawer = chatSettingsDrawer(page, "message-search");
        const toggle = searchDrawer.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(search).toHaveCount(0);
        const help = searchDrawer.getByRole("button", { name: "Show help", exact: true });
        await help.click();
        await expect(
          page.getByText("Search for messages in the chat history, bookmarks, or removed messages.", { exact: true }),
        ).toBeVisible();
        await help.press("Escape");
        await openChatSettingsTool(page, "message-search");
        await expect(search.getByRole("searchbox", { name: "Search messages in this chat" })).toBeVisible();
        const [searchTop, nameTop] = await tops([search, chatName]);
        expect(searchTop, `${chat.mode}: Search sits above Chat Name`).toBeLessThan(nameTop!);
      }

      // Chat Branches directly under Chat Name.
      const [nameTop, branchesTop] = await tops([chatName, branches]);
      expect(branchesTop, `${chat.mode}: Chat Branches under Chat Name`).toBeGreaterThan(nameTop!);
      const nextAfterName = await chatName.evaluate((element) => {
        const parent = element.closest("[style*='order']") ?? element;
        const siblings = Array.from(parent.parentElement!.children).filter((child) => child.getClientRects().length);
        const sorted = siblings.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const next = sorted[sorted.indexOf(parent) + 1];
        return next?.getAttribute("data-drawer") ?? next?.querySelector("[data-drawer]")?.getAttribute("data-drawer");
      });
      expect(nextAfterName).toBe(`${chat.mode}-chat-branches`);

      // Chat Summary under Lorebooks, Active Context under Chat Summary, then Agents, Agent activity (its own
      // section) and Author's Notes.
      const lorebooks = settings.locator('[data-chat-settings-section="lorebooks"]');
      const activeContext = chatSettingsDrawer(page, "active-context");
      const gallery = chatSettingsDrawer(page, "gallery");
      if (chat.mode === "roleplay") {
        const summary = chatSettingsDrawer(page, "chat-summary");
        const agents = chatSettingsDrawer(page, "agents");
        const activity = chatSettingsDrawer(page, "agent-activity");
        const notes = chatSettingsDrawer(page, "author-notes");
        const order = await tops([lorebooks, summary, activeContext, agents, activity, notes, gallery]);
        expect(order, "roleplay drawer order").toEqual([...order].sort((a, b) => a - b));
      } else {
        await expect(chatSettingsDrawer(page, "chat-summary")).toHaveCount(0);
        await expect(chatSettingsDrawer(page, "author-notes")).toHaveCount(0);
        await expect(chatSettingsDrawer(page, "agent-activity")).toHaveCount(0);
        const order = await tops([lorebooks, activeContext, gallery]);
        expect(order, `${chat.mode} drawer order`).toEqual([...order].sort((a, b) => a - b));
      }

      // Each drawer opens its content and can pop out like the other sections (into a bubble on a phone).
      for (const tool of TOOLS[chat.mode]) {
        const drawer = await openChatSettingsTool(page, tool);
        await expect(drawer.locator(':scope > .mari-drawer__header [data-drawer-control="pop-out"]')).toHaveCount(1);
        const body = drawer.locator(":scope > .mari-drawer__body");
        await expect(body).toBeVisible();
        if (tool === "chat-branches") await expect(body.getByRole("button", { name: "Stats" })).toBeVisible();
        if (tool === "chat-summary") await expect(body).toContainText("Automatic Summaries");
        if (tool === "author-notes") {
          await expect(body.getByRole("textbox", { name: "Author's Notes", exact: true })).toBeVisible();
        }
        if (tool === "agent-activity") {
          // Not nested in Agents any more.
          await expect(chatSettingsDrawer(page, "agents").locator("[data-drawer$='-agent-activity']")).toHaveCount(0);
          await expect(body).toContainText("No agent activity yet");
        }
        if (tool === "gallery") {
          await expect(body.getByRole("searchbox", { name: "Search gallery images", exact: true })).toBeVisible();
        }
        if (tool === "active-context") await expect(body).not.toBeEmpty();
      }
      await page.screenshot({ path: testInfo.outputPath(`chat-tools-${chat.mode}.png`), animations: "disabled" });

      // The window reflows to its width: no sideways scroll in the narrowest Chat Settings.
      const overflow = await settings.evaluate((element) => {
        const area = element.querySelector<HTMLElement>(".\\@container");
        return area ? area.scrollWidth - area.clientWidth : 0;
      });
      expect(overflow, `${chat.mode}: Chat Settings scrolls sideways`).toBeLessThanOrEqual(1);
      await settings.locator('[data-window-control="close"]').click();
      await expect(settings).toHaveCount(0);
    }
  } finally {
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
  }
});

// #7322: the Agent activity icon turns into a spinner while agents work, and a steady dot shows after one
// fails until Agent activity is opened. The failures stay there for Retry.
test("the Agent activity icon shows running and failed agents until it is opened", async ({ page, request }) => {
  const chat = await createChat(request, "roleplay");
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem("marinara-active-chat-id", chatId);
      },
      { chatId: chat.id, version: APP_VERSION },
    );
    await page.goto("/");
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    await openChatSettings(page);
    const toggle = drawerToggle(chatSettingsDrawer(page, "agent-activity"));
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const icon = toggle.locator(".mari-agent-activity-icon");
    const dot = icon.locator(".mari-agent-activity-icon__dot");
    await expect(icon).toBeVisible();
    await expect(icon).not.toHaveAttribute("data-running");
    await expect(dot).toHaveCount(0);

    const agents = (action: "run" | "stop" | "fail") =>
      page.evaluate(
        async ({ chatId, action }) => {
          const module = (await import("/src/stores/agent.store.ts" as string)) as PageAgentStoreModule;
          const store = module.useAgentStore.getState();
          if (action === "fail") {
            store.setFailedAgentFailures(
              [
                {
                  agentType: "world-state",
                  agentName: "World State",
                  error: "Provider call failed",
                  reasonLabel: null,
                  retryTarget: null,
                },
              ],
              chatId,
            );
          } else store.setProcessing(action === "run", chatId);
        },
        { chatId: chat.id, action },
      );

    await agents("run");
    await expect(icon).toHaveAttribute("data-running", "true");
    await expect(toggle).toHaveAccessibleName(/Agents are running/u);
    await agents("fail");
    await agents("stop");
    await expect(icon).not.toHaveAttribute("data-running");
    await expect(dot).toBeVisible();
    await expect(toggle).toHaveAccessibleName(/1 agent failed/u);
    // The theme's accent held steady, so Accent Pulse never makes it flash.
    await expect(dot).toHaveCSS("animation-name", "none");

    await toggle.click();
    await expect(dot).toHaveCount(0);
    await expect(icon).not.toHaveAttribute("data-failed");
    const body = chatSettingsDrawer(page, "agent-activity").locator(":scope > .mari-drawer__body");
    await expect(body.getByRole("button", { name: /Retry Failed Agents/u })).toBeVisible();

    // A later failure shows the dot again while Agent activity is closed.
    await toggle.click();
    await agents("fail");
    await expect(dot).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
