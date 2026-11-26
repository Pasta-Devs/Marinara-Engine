// Issue #7188: on a computer with the Tracker Panel docked beside a Roleplay chat, the Chat Settings button's
// default spot covered the panel's help button, and a narrow window squeezed the panel to a few pixels.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
// The narrowest docked panel that still fits its close, settings and help buttons (AppShell).
const MIN_PANEL_WIDTH = 96;
const PANEL_CONTROLS = ["Close tracker panel", "Open tracker settings", "Show help for Tracker Panel"];
test.use({ reducedMotion: "reduce" });

async function createChat(request: APIRequestContext, metadata: Record<string, unknown> = {}) {
  const response = await request.post("/api/chats", {
    data: { name: "Docked Tracker Panel", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const patched = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: true, activeAgentIds: ["world-state", "persona-stats", "custom-tracker"], ...metadata },
  });
  expect(patched.ok()).toBeTruthy();
  const state = await request.patch(`/api/chats/${chat.id}/game-state`, {
    data: {
      manual: true,
      location: "Harbor market",
      time: "Evening",
      personaStats: [{ name: "Stamina", value: 6, max: 10, color: "#22c55e" }],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
        customTrackerFields: [{ name: "Health", value: "Fine" }],
      },
    },
  });
  expect(state.ok()).toBeTruthy();
  return chat;
}

async function openChat(
  page: Page,
  chatId: string,
  size: { width: number; height: number },
  ui: Record<string, unknown> = {},
) {
  await page.setViewportSize(size);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    chatSettingsMoveTipDismissed: true,
    appAccentPulseMode: false,
    trackerPanelEnabled: true,
    trackerPanelOpen: true,
    trackerPanelOpenByChatId: { [chatId]: true },
    trackerPanelSide: "right",
    trackerPanelSizeProfile: "standard",
    ...ui,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
  await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
}

/** The element's box from the page itself, so a covered or hidden element still reports its place. */
const rect = (locator: Locator) =>
  locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });

/** The accessible name of the button a press at the centre of `locator` would reach. */
const pressedButton = (locator: Locator) =>
  locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const hit = document.elementFromPoint(x + width / 2, y + height / 2)?.closest("button");
    return hit?.getAttribute("aria-label") ?? hit?.textContent ?? null;
  });

const settingsButton = (page: Page) => page.locator(".mari-window-bubble[data-chat-settings-button]");

/** The docked panel keeps a usable width beside the chat column, and nothing covers its own buttons. */
async function expectUsableDockedPanel(page: Page) {
  const panel = page.locator('[data-component="TrackerDataSidebarDesktop.right"]');
  await expect(panel).toBeVisible();
  await expect(async () => {
    const [box, column, main, settings] = await Promise.all([
      rect(panel),
      rect(page.locator('[data-roleplay-chat-column="true"]')),
      rect(page.locator('[data-component="CenterContent"]')),
      rect(settingsButton(page)),
    ]);
    expect(box.width).toBeGreaterThanOrEqual(MIN_PANEL_WIDTH);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width + 1);
    // Beside the chat, not over its messages or message box.
    expect(box.x).toBeGreaterThanOrEqual(column.x + column.width + 7);
    // The Chat Settings button sits clear of the panel.
    expect(settings.x + settings.width <= box.x || settings.y >= box.y + box.height).toBe(true);
    for (const name of PANEL_CONTROLS) {
      const control = panel.getByRole("button", { name, exact: true });
      const controlBox = await rect(control);
      expect(controlBox.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(await pressedButton(control)).toBe(name);
    }
    expect(await pressedButton(settingsButton(page))).toBe("Chat Settings");
  }).toPass({ timeout: 10_000 });
}

for (const width of [1024, 1280, 1440]) {
  test(`the docked Tracker Panel stays usable beside the chat at ${width}px`, async ({ page, request }, info) => {
    test.skip(!info.project.name.includes("desktop"), "The docked Tracker Panel is a computer layout.");
    const chat = await createChat(request);
    try {
      await openChat(page, chat.id, { width, height: 800 });
      await expectUsableDockedPanel(page);
      await page.screenshot({ path: info.outputPath(`docked-${width}.png`), animations: "disabled" });

      // The chats sidebar leaves less room beside the chat; the panel still keeps its minimum.
      await page.locator('[data-tour="sidebar-toggle"]').click();
      // Chats opens in the one sidebar (#9492), docked on the right like the panel.
      await expect(page.locator('[data-component="SidebarSlot"]')).toBeVisible();
      await expectUsableDockedPanel(page);
      await page.screenshot({ path: info.outputPath(`docked-${width}-sidebar.png`), animations: "disabled" });
    } finally {
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

test("a Chat Settings button the user placed stays there beside the docked Tracker Panel", async ({
  page,
  request,
}, info) => {
  test.skip(!info.project.name.includes("desktop"), "The docked Tracker Panel is a computer layout.");
  const saved = { x: 1380, y: 110 };
  const chat = await createChat(request, {
    windowLayout: { version: 1, windows: {}, bubbles: { "chat-settings-button": saved } },
  });
  try {
    await openChat(page, chat.id, { width: 1440, height: 800 });
    await expect(page.locator('[data-component="TrackerDataSidebarDesktop.right"]')).toBeVisible();
    await expect(async () => {
      const box = await rect(settingsButton(page));
      expect(Math.round(box.x)).toBe(saved.x);
      expect(Math.round(box.y)).toBe(saved.y);
    }).toPass({ timeout: 10_000 });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("the docked Tracker Panel stays beside the chat while switching chats", async ({ page, request }, info) => {
  test.skip(!info.project.name.includes("desktop"), "The docked Tracker Panel is a computer layout.");
  const first = await createChat(request);
  const second = await createChat(request);
  try {
    await openChat(
      page,
      first.id,
      { width: 1280, height: 800 },
      { trackerPanelOpenByChatId: { [first.id]: true, [second.id]: true } },
    );
    const panel = page.locator('[data-component="TrackerDataSidebarDesktop.right"]');
    await expect(panel).toBeVisible();
    // Each switch replaces the chat column the panel measures its width against.
    for (const chat of [second, first, second, first, second, first]) {
      await page.evaluate(async (chatId) => {
        const module = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
        module.useChatStore.getState().setActiveChatId(chatId);
      }, chat.id);
      await expect(page.locator('[data-roleplay-chat-column="true"]')).toBeVisible();
      await expect(panel).toBeVisible();
    }
  } finally {
    await Promise.all([first, second].map((chat) => request.delete(`/api/chats/${chat.id}`)));
  }
});

test("narrowing the window to a phone puts Chat Settings back in its corner", async ({ page, request }, info) => {
  test.skip(!info.project.name.includes("desktop"), "Starts from the docked computer layout.");
  const chat = await createChat(request);
  try {
    await openChat(page, chat.id, { width: 1440, height: 800 });
    await expectUsableDockedPanel(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator('[data-component^="TrackerDataSidebarDesktop."]')).toHaveCount(0);
    await expect(async () => {
      const [main, settings] = await Promise.all([
        rect(page.locator('[data-component="CenterContent"]')),
        rect(settingsButton(page)),
      ]);
      expect(Math.abs(settings.x + settings.width - (main.x + main.width - 8))).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 10_000 });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("between phone and computer widths the Tracker Panel still opens over the chat", async ({
  page,
  request,
}, info) => {
  test.skip(!info.project.name.includes("desktop"), "856px is a computer window here; phones are covered elsewhere.");
  const chat = await createChat(request);
  try {
    await openChat(page, chat.id, { width: 856, height: 800 });
    const panel = page.locator('[data-component="TrackerDataSidebarMobile"]');
    await expect(panel).toBeVisible();
    await expect(page.locator('[data-component^="TrackerDataSidebarDesktop."]')).toHaveCount(0);
    // From the keyboard: this layout's chat buttons may sit over the panel's header.
    await panel.getByRole("button", { name: "Close tracker panel", exact: true }).press("Enter");
    await expect(panel).toHaveCount(0);
    const [main, column, settings] = await Promise.all([
      rect(page.locator('[data-component="CenterContent"]')),
      rect(page.locator('[data-roleplay-chat-column="true"]')),
      rect(settingsButton(page)),
    ]);
    // The chat keeps its full width and the Chat Settings button its top-right corner.
    expect(Math.abs(column.width - main.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(settings.x + settings.width - (main.x + main.width - 8))).toBeLessThanOrEqual(1);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
