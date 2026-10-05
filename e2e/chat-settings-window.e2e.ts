// #7036: Chat Settings is a movable window opened from its button in the chat, built on the shared
// FloatingWindow / Drawer components that custom themes can restyle.
import { expect, test, type APIRequestContext, type Locator, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { resetChatView } from "./chat-settings-tools.js";

type ChatMode = "conversation" | "roleplay" | "game";
type Box = { x: number; y: number; width: number; height: number };

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const MARGIN = 8;

async function createChat(request: APIRequestContext, mode: ChatMode, metadata: Record<string, unknown> = {}) {
  const response = await request.post("/api/chats", {
    data: { name: `${mode} Chat Settings window`, mode, characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const gameMetadata =
    mode === "game"
      ? {
          gameId: "chat-settings-window-game",
          gameSessionStatus: "active",
          gameSessionNumber: 1,
          gameIntroPresented: true,
        }
      : {};
  if (mode === "game" || Object.keys(metadata).length > 0) {
    const patched = await request.patch(`/api/chats/${chat.id}/metadata`, { data: { ...gameMetadata, ...metadata } });
    expect(patched.ok()).toBeTruthy();
  }
  if (mode === "game") {
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The window test game begins." },
    });
    expect(message.ok()).toBeTruthy();
  }
  return { id: chat.id, mode };
}

async function prepare(page: Page, chatId: string | null, ui: Record<string, unknown> = {}) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    ...ui,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      if (chatId) localStorage.setItem("marinara-active-chat-id", chatId);
      else localStorage.removeItem("marinara-active-chat-id");
    },
    { chatId, version: APP_VERSION },
  );
}

/** The window layout the chat saved (#7034 step 4: layouts belong to the chat). */
async function readSavedLayout(request: APIRequestContext, chatId: string) {
  const chat = (await (await request.get(`/api/chats/${chatId}`)).json()) as { metadata: unknown };
  const metadata = (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata) as {
    windowLayout?: {
      windows?: Record<string, { x: number; y: number; width: number; height: number }>;
      bubbles?: Record<string, { x: number; y: number }>;
    } | null;
  };
  return metadata.windowLayout ?? null;
}

async function setActiveChat(page: Page, chatId: string | null) {
  await page.evaluate(async (nextChatId) => {
    const module = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
    module.useChatStore.getState().setActiveChatId(nextChatId);
  }, chatId);
}

/** The Chat Settings button in the chat (#7034; it used to sit in the topbar). */
function chatSettingsButton(page: Page) {
  return page.locator("[data-chat-settings-button]");
}

function settingsWindow(page: Page) {
  return page.locator('[data-window="chat-settings"]');
}

async function openSettingsWindow(page: Page) {
  await chatSettingsButton(page).click();
  const settings = settingsWindow(page);
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute("data-presentation", "window");
  // The loading placeholder shares the window; wait for the real settings.
  await expect(settings.locator("[data-chat-settings-section]").first()).toBeVisible();
  // Measure after the opening animation settles.
  await settings.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined))),
  );
  return settings;
}

async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
}

async function expectInsideViewport(page: Page, settings: Locator) {
  const viewport = page.viewportSize()!;
  const topbar = await box(page.locator('[data-component="TopBar"]'));
  const rect = await box(settings);
  expect(rect.x).toBeGreaterThanOrEqual(MARGIN - 1);
  expect(rect.y).toBeGreaterThanOrEqual(topbar.y + topbar.height + MARGIN - 1);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - MARGIN + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - MARGIN + 1);
}

function expectSameBox(actual: Box, expected: Box, label: string) {
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${label} ${key}`).toBeLessThanOrEqual(1.5);
  }
}

test.describe("Chat Settings window on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "The movable window is the desktop presentation.");
  });

  test("the Chat Settings button starts at the chat's top right and only appears in chats", async ({
    page,
    request,
  }) => {
    const chats = [
      await createChat(request, "roleplay", { enableAgents: true }),
      await createChat(request, "conversation"),
      await createChat(request, "game"),
    ];
    try {
      await prepare(page, null, { trackerPanelEnabled: true, trackerPanelOpen: false });
      await page.goto("/");
      await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
      await expect(chatSettingsButton(page)).toHaveCount(0);

      for (const chat of chats) {
        await setActiveChat(page, chat.id);
        const root = page.locator(`[data-chat-mode="${chat.mode}"]`);
        await expect(root).toBeVisible();
        // The topbar has no Chat Settings button; the chat has its own, a bubble like the other windows'.
        await expect(
          page.locator('[data-component="TopBar"]').getByRole("button", { name: "Chat Settings", exact: true }),
        ).toHaveCount(0);
        const button = chatSettingsButton(page);
        await expect(button).toBeVisible();
        await expect(button).toHaveClass(/\bmari-window-bubble\b/u);
        await expect(button).toHaveAccessibleName("Chat Settings");
        await expect(button).toHaveAttribute("title", "Chat Settings");
        await expect(button).toHaveAttribute("aria-expanded", "false");
        const [area, topbar, buttonBox] = [
          await box(page.locator('[data-component="CenterContent"]')),
          await box(page.locator('[data-component="TopBar"]')),
          await box(button),
        ];
        expect(Math.abs(buttonBox.x + buttonBox.width - (area.x + area.width - MARGIN))).toBeLessThanOrEqual(1);
        expect(Math.abs(buttonBox.y - (topbar.y + topbar.height + MARGIN))).toBeLessThanOrEqual(1);

        // Settings, Help layout and the Tracker Panel launcher no longer sit among the chat's top buttons.
        await expect(root.locator('[data-chat-toolbar-panel-action="settings"]').filter({ visible: true })).toHaveCount(
          0,
        );
        await expect(root.locator('[data-chat-help="help"]').filter({ visible: true })).toHaveCount(0);
        await expect(root.getByRole("button", { name: "Help", exact: true }).filter({ visible: true })).toHaveCount(0);
      }

      // A detail editor takes the chat's place, so the button leaves with it.
      await page.evaluate(async () => {
        const module = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
        module.useUIStore.getState().openAgentCatalog();
      });
      await expect(chatSettingsButton(page)).toBeHidden();
      await page.evaluate(async () => {
        const module = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
        module.useUIStore.getState().closeAgentCatalog();
      });
      await expect(chatSettingsButton(page)).toBeVisible();

      await page.locator('[data-component="TopBar"]').getByRole("button", { name: "Home", exact: true }).click();
      await expect(chatSettingsButton(page)).toHaveCount(0);
    } finally {
      await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
    }
  });

  test("Chat Settings tips dismiss only for this chat and stay dismissed after reload", async ({ page, request }) => {
    const first = await createChat(request, "conversation");
    let second: { id: string; mode: ChatMode } | undefined;
    try {
      await prepare(page, first.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      const settings = await openSettingsWindow(page);
      const hints = settings.locator("[data-chat-settings-top-row]");
      await expect(hints).toContainText("Your setups for chats are saved within the profiles below.");
      await settings.getByRole("button", { name: "Hide these tips for this chat", exact: true }).click();
      await expect(hints).toHaveCount(0);
      await expect
        .poll(async () => {
          const chat = await (await request.get(`/api/chats/${first.id}`)).json();
          const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
          return metadata.chatSettingsHintDismissed;
        })
        .toBe(true);
      await page.reload();
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      await openSettingsWindow(page);
      await expect(hints).toHaveCount(0);

      second = await createChat(request, "conversation");
      await setActiveChat(page, second.id);
      if (!(await settings.isVisible())) await openSettingsWindow(page);
      await expect(hints).toBeVisible();
      await setActiveChat(page, first.id);
      if (!(await settings.isVisible())) await openSettingsWindow(page);
      await expect(hints).toHaveCount(0);
    } finally {
      await request.delete(`/api/chats/${first.id}?force=true`);
      if (second) await request.delete(`/api/chats/${second.id}?force=true`);
    }
  });

  test("the Chat Settings button drags anywhere, stays with the chat and toggles the window", async ({
    page,
    request,
  }) => {
    const chat = await createChat(request, "conversation");
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      const button = chatSettingsButton(page);
      const start = await box(button);
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 - 20, start.y + start.height / 2 + 20, { steps: 3 });
      await page.mouse.move(start.x - 300 + start.width / 2, start.y + 240 + start.height / 2, { steps: 8 });
      await page.mouse.up();
      const placed = await box(button);
      expect(Math.abs(placed.x - (start.x - 300))).toBeLessThanOrEqual(1);
      expect(Math.abs(placed.y - (start.y + 240))).toBeLessThanOrEqual(1);
      // A drag does not open Chat Settings; a click does, and a second click closes it again.
      await expect(settingsWindow(page)).toHaveCount(0);
      await expect
        .poll(async () => {
          const layout = (await readSavedLayout(request, chat.id)) as { bubbles?: Record<string, unknown> } | null;
          return layout?.bubbles?.["chat-settings-button"] ?? null;
        })
        .toEqual({ x: placed.x, y: placed.y });
      await button.click();
      await expect(settingsWindow(page)).toBeVisible();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await button.click();
      await expect(settingsWindow(page)).toHaveCount(0);
      await expect(button).toBeFocused();
      // The window's X closes it back to the button too.
      await button.click();
      await settingsWindow(page).getByRole("button", { name: "Close chat settings", exact: true }).click();
      await expect(settingsWindow(page)).toHaveCount(0);
      await expect(button).toBeFocused();

      await page.reload();
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      const reloaded = await box(chatSettingsButton(page));
      expect(Math.abs(reloaded.x - placed.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(reloaded.y - placed.y)).toBeLessThanOrEqual(1);
      // Reset View brings it back to the top right, while refresh above preserved its custom position.
      await chatSettingsButton(page).click();
      await resetChatView(page);
      await expect.poll(async () => Math.abs((await box(chatSettingsButton(page))).x - start.x)).toBeLessThanOrEqual(1);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("Chat Settings opens as a window that moves, resizes, locks, pins, closes and resets", async ({
    page,
    request,
  }) => {
    const chat = await createChat(request, "roleplay");
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();

      const settings = await openSettingsWindow(page);
      const button = chatSettingsButton(page);
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("dialog", { name: "Chat Settings", exact: true })).toHaveAttribute(
        "aria-modal",
        "false",
      );
      await expect.poll(() => settings.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await expect(settings).toHaveAttribute("data-pinned", "false");
      await expect(settings).toHaveAttribute("data-locked", "false");
      await expectInsideViewport(page, settings);
      const defaultBox = await box(settings);
      const opener = await box(button);
      expect(defaultBox.y, "the first opening sits below its button").toBeCloseTo(opener.y + opener.height + 8, 0);
      const composer = await box(page.locator("[data-chat-composer]").first());
      expect(defaultBox.y + defaultBox.height, "the window opens above the message box").toBeLessThanOrEqual(
        composer.y,
      );
      // The per-mode description is gone; the drag-and-drop hint stays.
      await expect(settings.getByText("Classic roleplay mode", { exact: false })).toHaveCount(0);
      await expect(settings.getByText("You can drag and drop", { exact: false })).toBeVisible();

      // Move by the title bar.
      const header = settings.locator(".mari-window__header");
      const headerBox = await box(header);
      await drag(page, { x: headerBox.x + headerBox.width / 2, y: headerBox.y + headerBox.height / 2 }, -160, 0);
      const moved = await box(settings);
      expectSameBox(moved, { ...defaultBox, x: defaultBox.x - 160 }, "moved");

      // Resize from the bottom-right corner and from the left edge.
      const corner = await box(settings.locator('.mari-window__resize-handle[data-edge="se"]'));
      await drag(page, { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, 40, -60);
      const cornerResized = await box(settings);
      expectSameBox(cornerResized, { ...moved, width: moved.width + 40, height: moved.height - 60 }, "corner resize");
      const leftEdge = await box(settings.locator('.mari-window__resize-handle[data-edge="w"]'));
      await drag(page, { x: leftEdge.x + leftEdge.width / 2, y: leftEdge.y + leftEdge.height / 2 }, -50, 0);
      const edgeResized = await box(settings);
      expectSameBox(
        edgeResized,
        { ...cornerResized, x: cornerResized.x - 50, width: cornerResized.width + 50 },
        "left edge resize",
      );

      // Arrow keys move the focused title bar and resize from the focused corner.
      await settings.getByRole("group", { name: "Move window with the arrow keys", exact: true }).focus();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Shift+ArrowDown");
      const keyMoved = await box(settings);
      expectSameBox(keyMoved, { ...edgeResized, x: edgeResized.x - 10, y: edgeResized.y + 50 }, "keyboard move");
      await settings.getByRole("button", { name: "Resize window with the arrow keys", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowUp");
      const keyResized = await box(settings);
      expectSameBox(
        keyResized,
        { ...keyMoved, width: keyMoved.width + 10, height: keyMoved.height - 10 },
        "keyboard resize",
      );

      // The layout is remembered with the chat.
      await expect
        .poll(async () => (await readSavedLayout(request, chat.id))?.windows?.["chat-settings"]?.width)
        .toBeCloseTo(keyResized.width, 0);
      await page.reload();
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      await openSettingsWindow(page);
      expectSameBox(await box(settings), keyResized, "remembered after reload");

      // A resize cue shows in the corner while the pointer is over the window, and fades away after.
      const grip = settings.locator(".mari-window__resize-grip");
      await expect(grip).toHaveCount(1);
      await page.mouse.move(1, 450);
      await settings.evaluate((element) => (element as HTMLElement).blur());
      await expect(grip).toHaveCSS("opacity", "0");
      await settings.locator(".mari-window__title").hover();
      await expect(grip).toHaveCSS("opacity", "1");
      await page.screenshot({ path: test.info().outputPath("resize-grip.png"), animations: "disabled" });

      // Locked: no handles or cue, and neither the pointer nor the keyboard moves it.
      const lock = settings.getByRole("button", { name: "Lock window", exact: true });
      await lock.click();
      await expect(lock).toHaveAttribute("aria-pressed", "true");
      await expect(settings).toHaveAttribute("data-locked", "true");
      await expect(settings.locator(".mari-window__resize-handle")).toHaveCount(0);
      await expect(settings.locator(".mari-window__resize-grip")).toHaveCount(0);
      await expect(settings.getByRole("group", { name: "Move window with the arrow keys", exact: true })).toHaveCount(
        0,
      );
      const lockedHeader = await box(header);
      await drag(
        page,
        { x: lockedHeader.x + lockedHeader.width / 2, y: lockedHeader.y + lockedHeader.height / 2 },
        -120,
        60,
      );
      await header.press("ArrowLeft");
      expectSameBox(await box(settings), keyResized, "locked");
      await lock.click();
      await expect(settings).toHaveAttribute("data-locked", "false");

      // Unpinned: a press elsewhere closes it.
      await page.locator("[data-chat-scroll]").click({ position: { x: 40, y: 200 } });
      await expect(settings).toHaveCount(0);
      await expect(button).toHaveAttribute("aria-expanded", "false");

      // Pinned: it stays through presses elsewhere, other chat panels and Escape.
      await openSettingsWindow(page);
      const pin = settings.getByRole("button", { name: "Pin window", exact: true });
      await pin.click();
      await expect(pin).toHaveAttribute("aria-pressed", "true");
      await expect(settings).toHaveAttribute("data-pinned", "true");
      await page.locator("[data-chat-scroll]").click({ position: { x: 40, y: 200 } });
      await expect(settings).toBeVisible();
      // Another chat panel opening announces itself the way a toolbar button does.
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent("mari-chat-toolbar-action", { detail: { panelAction: null } })),
      );
      await expect(settings).toBeVisible();
      await settings.focus();
      await page.keyboard.press("Escape");
      await expect(settings).toBeVisible();
      await pin.click();
      await expect(settings).toHaveAttribute("data-pinned", "false");

      // Escape and the close button close an unpinned window and return focus to the Chat Settings button.
      await settings.focus();
      await page.keyboard.press("Escape");
      await expect(settings).toHaveCount(0);
      await expect(button).toBeFocused();
      await openSettingsWindow(page);
      await settings.getByRole("button", { name: "Close chat settings", exact: true }).click();
      await expect(settings).toHaveCount(0);
      await expect(button).toBeFocused();

      // Escape in a text field belongs to the field; anywhere else in a section it closes the window.
      await openSettingsWindow(page);
      const chatName = settings.locator('[data-chat-settings-section="chat-name"]');
      const chatNameHeader = chatName.locator("> .mari-drawer__header [data-drawer-toggle]");
      if ((await chatNameHeader.getAttribute("aria-expanded")) !== "true") await chatNameHeader.click();
      await chatName.locator(".mari-drawer__body button").first().click();
      await expect(chatName.locator("input")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(settings).toBeVisible();
      await settings.getByRole("button", { name: "Copy chat ID", exact: true }).focus();
      await page.keyboard.press("Escape");
      await expect(settings).toHaveCount(0);
      await expect(button).toBeFocused();

      // Reset View, an icon before pin and lock, asks first: Cancel keeps the layout, Reset restores it.
      await openSettingsWindow(page);
      await settings.getByRole("button", { name: "Pin window", exact: true }).click();
      await settings.getByRole("button", { name: "Lock window", exact: true }).click();
      const controls = await settings
        .locator(".mari-window__controls > button")
        .evaluateAll((elements) =>
          elements.map(
            (element) =>
              element.getAttribute("data-chat-settings-control") ?? element.getAttribute("data-window-control"),
          ),
        );
      expect(controls.filter((control) => control !== "tracker-panel")).toEqual([
        "reset-view",
        "favorite-layout",
        "pin",
        "lock",
        "close",
      ]);
      const resetIcon = settings.getByRole("button", { name: "Reset View", exact: true });
      await expect(resetIcon).toHaveAttribute("title", "Reset View");
      const lockedBox = await box(settings);
      await resetIcon.click();
      const confirm = page.getByRole("dialog", { name: "Are you sure you want to reset the view?" });
      await expect(confirm).toContainText("Every window and section goes back to its default place for this chat.");
      await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(confirm).toHaveCount(0);
      await expect(resetIcon).toBeFocused();
      await expect(settings).toHaveAttribute("data-pinned", "true");
      await expect(settings).toHaveAttribute("data-locked", "true");
      expectSameBox(await box(settings), lockedBox, "cancelled reset");
      await resetChatView(page);
      await expect(resetIcon).toBeFocused();
      await expect(settings).toHaveAttribute("data-pinned", "false");
      await expect(settings).toHaveAttribute("data-locked", "false");
      expectSameBox(await box(settings), defaultBox, "reset view");
      await expect.poll(() => readSavedLayout(request, chat.id)).toBeNull();
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("the window stays on screen when the viewport shrinks or the saved layout is bad", async ({ page, request }) => {
    const chat = await createChat(request, "conversation");
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      const settings = await openSettingsWindow(page);
      const handle = await box(settings.locator('.mari-window__resize-handle[data-edge="se"]'));
      await drag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, 400, 400);
      await expectInsideViewport(page, settings);
      const beforeShrink = await box(settings);

      for (const size of [
        { width: 900, height: 600 },
        { width: 800, height: 420 },
      ]) {
        await page.setViewportSize(size);
        await expect
          .poll(async () => (await box(settings)).x + (await box(settings)).width)
          .toBeLessThanOrEqual(size.width - MARGIN + 1);
        await expectInsideViewport(page, settings);
        await expect(settings.getByRole("button", { name: "Close chat settings", exact: true })).toBeInViewport();
      }
      // Pinning while squeezed keeps the saved place, so the window returns there when the viewport grows.
      const pin = settings.getByRole("button", { name: "Pin window", exact: true });
      await pin.click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect.poll(async () => (await box(settings)).height).toBeGreaterThan(beforeShrink.height - 2);
      expectSameBox(await box(settings), beforeShrink, "back in place after pinning while squeezed");
      await pin.click();
      await expect
        .poll(async () => (await readSavedLayout(request, chat.id))?.windows?.["chat-settings"])
        .toMatchObject({
          pinned: false,
        });

      const badLayouts = [
        "{not json",
        JSON.stringify({ version: 0, windows: { "chat-settings": { x: 5000, y: 5000, width: 9, height: 9 } } }),
        JSON.stringify({
          version: 1,
          windows: { "chat-settings": { x: null, y: "NaN", width: -10, height: 1e9, pinned: "yes", locked: 1 } },
        }),
        JSON.stringify({
          version: 1,
          windows: {
            "chat-settings": { x: 99999, y: -99999, width: 99999, height: 99999, pinned: false, locked: false },
          },
        }),
      ];
      for (const raw of badLayouts) {
        const windowLayout = raw.startsWith("{not") ? raw : JSON.parse(raw);
        expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: { windowLayout } })).ok()).toBeTruthy();
        await page.reload();
        await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
        await openSettingsWindow(page);
        await expectInsideViewport(page, settings);
        await expect(settings).toHaveAttribute("data-pinned", "false");
        await expect(settings).toHaveAttribute("data-locked", "false");
        await settings.getByRole("button", { name: "Close chat settings", exact: true }).click();
      }
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("the Tracker Panel dice in the Chat Settings title bar turns the panel on and off", async ({
    page,
    request,
  }) => {
    const chats = [
      await createChat(request, "roleplay", { enableAgents: true, activeAgentIds: ["world-state"] }),
      await createChat(request, "conversation", { enableAgents: true }),
      await createChat(request, "game"),
    ];
    try {
      // The panel's default side is the right, where the window opens too.
      await prepare(page, chats[0]!.id, {
        trackerPanelEnabled: false,
        trackerPanelOpen: false,
        trackerPanelSide: "right",
      });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      const trackersWindow = page.locator('.mari-window[data-window="trackers"]');
      const trackersBubble = page.locator('.mari-window-bubble[data-window="trackers"]');
      await expect(trackersBubble).toBeVisible();
      const settings = await openSettingsWindow(page);
      const defaultBox = await box(settings);
      // No switch row for the Tracker Panel; Reset View and the dice sit before pin and lock.
      await expect(settings.locator("[data-chat-settings-top-row] [data-tracker-panel-toggle]")).toHaveCount(0);
      const controls = await settings
        .locator(".mari-window__controls > button")
        .evaluateAll((elements) =>
          elements.map(
            (element) =>
              element.getAttribute("data-chat-settings-control") ?? element.getAttribute("data-window-control"),
          ),
        );
      expect(controls).toEqual(["reset-view", "favorite-layout", "tracker-panel", "pin", "lock", "close"]);
      const dice = settings.getByRole("button", { name: "Tracker Panel", exact: true });
      await expect(dice).toHaveAttribute("title", "Tracker Panel");
      await expect(dice).toHaveAttribute("aria-pressed", "false");
      // The dice is the only tracker visibility control in Chat Settings.
      await expect(settings.locator('[data-tracker-window-toggle="chat-settings"]')).toHaveCount(0);

      // One click: on, highlighted and shown, and the Trackers window gives way.
      await dice.click();
      await expect(dice).toHaveAttribute("aria-pressed", "true");
      const tracker = page.locator('[data-component="TrackerDataSidebarDesktop.right"]');
      await expect(tracker).toBeVisible();
      await expect(trackersWindow).toHaveCount(0);
      await expect(settings.locator('[data-tracker-window-toggle="chat-settings"]')).toHaveCount(0);
      await expect(settings).toBeVisible();
      const ui = () =>
        page.evaluate(async (chatId) => {
          const module = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
          const state = module.useUIStore.getState();
          return [state.trackerPanelEnabled, state.trackerPanelOpen, state.trackerPanelOpenByChatId[chatId]];
        }, chats[0]!.id);
      expect(await ui()).toEqual([true, true, true]);
      // A window the user has not moved makes room for the panel instead of covering it.
      const trackerLeft = async () => tracker.evaluate((element) => (element as HTMLElement).offsetLeft);
      await expect
        .poll(async () => (await box(settings)).x + (await box(settings)).width)
        .toBeLessThanOrEqual(await trackerLeft());
      const covered = await tracker.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest(".mari-window") !==
          null
        );
      });
      expect(covered, "the Tracker Panel is not under the window").toBe(false);
      await page.screenshot({ path: test.info().outputPath("tracker-dice-on.png"), animations: "disabled" });

      // The next click: off and hidden, and the trackers go back to the Trackers window.
      await dice.click();
      await expect(dice).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator('[data-component="TrackerDataSidebar"]:visible')).toHaveCount(0);
      await expect(trackersBubble).toBeVisible();
      expect(await ui()).toEqual([false, false, false]);
      await expect.poll(async () => (await box(settings)).x).toBeCloseTo(defaultBox.x, 0);

      for (const chat of chats.slice(1)) {
        await settings.getByRole("button", { name: "Close chat settings", exact: true }).click();
        await setActiveChat(page, chat.id);
        await expect(page.locator(`[data-chat-mode="${chat.mode}"]`)).toBeVisible();
        await openSettingsWindow(page);
        await expect(settings.getByRole("button", { name: "Reset View", exact: true })).toBeVisible();
        await expect(settings.locator('[data-tracker-panel-toggle="chat-settings"]')).toHaveCount(0);
      }
    } finally {
      await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
    }
  });

  test("Chat Settings explains moving it, and a Roleplay tip says so once until dismissed", async ({
    page,
    request,
  }) => {
    const roleplay = await createChat(request, "roleplay");
    const conversation = await createChat(request, "conversation");
    try {
      await prepare(page, roleplay.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      const settings = await openSettingsWindow(page);
      const hint = settings.locator("[data-chat-settings-top-row]").filter({ hasText: "Drag this window" });
      await expect(hint).toContainText(
        "Drag this window's title bar to move it, and drag its edges to resize it. Drag a section's title out",
      );

      // The tip points at the Chat Settings button: dragging it is the thing to discover.
      const tip = page.locator("[data-chat-settings-move-tip]");
      await expect(tip).toHaveText(
        "Drag and drop Chat Settings wherever you want. All sections within it can be moved out into separate buttons and windows for you to customize freely.",
      );
      // It leaves focus alone and sits just under the button; the window's controls stay above it.
      await expect(tip.locator(":focus")).toHaveCount(0);
      const tipBox = await box(tip);
      const buttonBox = await box(chatSettingsButton(page));
      expect(tipBox.y).toBeGreaterThanOrEqual(buttonBox.y + buttonBox.height);
      expect(tipBox.y - (buttonBox.y + buttonBox.height)).toBeLessThan(16);
      await expect
        .poll(() =>
          settings.locator(".mari-window__controls button").evaluateAll((buttons) =>
            buttons.every((button) => {
              const rect = button.getBoundingClientRect();
              const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              return hit !== null && button.contains(hit);
            }),
          ),
        )
        .toBe(true);
      await page.screenshot({ path: test.info().outputPath("move-tip.png"), animations: "disabled" });

      // Not in other modes.
      await settings.getByRole("button", { name: "Close chat settings", exact: true }).click();
      await setActiveChat(page, conversation.id);
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      await expect(page.locator("[data-chat-settings-move-tip]")).toHaveCount(0);
      await setActiveChat(page, roleplay.id);
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      await expect(tip).toBeVisible();

      // Closing the page immediately must not lose a dismissal to debounced storage.
      const savedImmediately = await tip
        .getByRole("button", { name: "Dismiss tip", exact: true })
        .evaluate((button) => {
          (button as HTMLButtonElement).click();
          return JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "{}").state?.chatSettingsMoveTipDismissed;
        });
      expect(savedImmediately).toBe(true);
      await expect(page.locator("[data-chat-settings-move-tip]")).toHaveCount(0);
      // A fresh page shares persisted storage without this test's per-load preference seed.
      const fresh = await page.context().newPage();
      await fresh.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await fresh.goto("/");
      await expect(fresh.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      await fresh.reload();
      await expect(fresh.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      await expect(fresh.locator("[data-chat-settings-button]")).toBeVisible();
      await expect(fresh.locator("[data-chat-settings-move-tip]")).toHaveCount(0);
      await fresh.close();
    } finally {
      await request.delete(`/api/chats/${roleplay.id}?force=true`);
      await request.delete(`/api/chats/${conversation.id}?force=true`);
    }
  });

  test("launcher tip dismissal survives stale settings, other chats and a fresh browser", async ({
    page,
    request,
    browser,
  }) => {
    const chats = [await createChat(request, "roleplay"), await createChat(request, "roleplay")];
    let serverSettings: Record<string, unknown> = {
      chatSettingsMoveTipDismissed: false,
      __updatedAt: Date.now() + 60_000,
    };
    let releaseSettings!: () => void;
    const settingsGate = new Promise<void>((resolve) => {
      releaseSettings = resolve;
    });
    const syncedDismissals: unknown[] = [];
    const serveSettings = async (route: Route) => {
      if (route.request().method() === "PUT") {
        serverSettings = JSON.parse(route.request().postDataJSON().value) as Record<string, unknown>;
        syncedDismissals.push(serverSettings.chatSettingsMoveTipDismissed);
        await route.fulfill({ json: { value: JSON.stringify(serverSettings) } });
        return;
      }
      const value = JSON.stringify(serverSettings);
      await settingsGate;
      await route.fulfill({ json: { value } });
    };
    const waitForSettings = (target: Page) =>
      expect
        .poll(() =>
          target.evaluate(async () => {
            const module = (await import("/src/stores/ui.store.ts" as string)) as {
              useUIStore: { getState(): { settingsSyncReady: boolean } };
            };
            return module.useUIStore.getState().settingsSyncReady;
          }),
        )
        .toBe(true);
    const freshContext = await browser.newContext({ viewport: page.viewportSize()! });
    try {
      await page.route("**/api/app-settings/ui", serveSettings);
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
        },
        "if-missing",
      );
      await page.addInitScript(
        ({ chatId, version }) => {
          localStorage.setItem("marinara:whats-new:seen-version", version);
          localStorage.setItem("marinara-active-chat-id", chatId);
        },
        { chatId: chats[0]!.id, version: APP_VERSION },
      );
      const settingsRequest = page.waitForRequest(
        (req) => req.url().endsWith("/api/app-settings/ui") && req.method() === "GET",
      );
      await page.goto("/");
      await settingsRequest;
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      const tip = page.locator("[data-chat-settings-move-tip]");
      await expect(tip).toBeVisible();
      // Dismiss while the old server preferences are still loading, with no storage grace period.
      const savedImmediately = await tip
        .getByRole("button", { name: "Dismiss tip", exact: true })
        .evaluate((button) => {
          (button as HTMLButtonElement).click();
          return JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "{}").state?.chatSettingsMoveTipDismissed;
        });
      expect(savedImmediately).toBe(true);
      releaseSettings();
      await waitForSettings(page);
      await expect(tip).toHaveCount(0);
      await expect.poll(() => syncedDismissals.at(-1)).toBe(true);

      await setActiveChat(page, chats[1]!.id);
      await expect(chatSettingsButton(page)).toBeVisible();
      await expect(tip).toHaveCount(0);
      await setActiveChat(page, chats[0]!.id);
      await expect(tip).toHaveCount(0);

      // Even a newer blob from another browser cannot restore the once-dismissed reminder.
      serverSettings = { ...serverSettings, chatSettingsMoveTipDismissed: false, __updatedAt: Date.now() + 60_000 };
      const writesBeforeReload = syncedDismissals.length;
      await page.reload();
      await waitForSettings(page);
      await expect(chatSettingsButton(page)).toBeVisible();
      await expect(tip).toHaveCount(0);
      expect(syncedDismissals.length).toBeGreaterThan(writesBeforeReload);
      expect(syncedDismissals.at(-1)).toBe(true);

      // The shared dismissal also wins when a fresh browser has newer, unrelated preferences.
      await freshContext.route("**/api/app-settings/ui", serveSettings);
      await seedUIState(freshContext, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        chatSettingsMoveTipDismissed: false,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
      });
      await freshContext.addInitScript(
        ({ chatId, version }) => {
          localStorage.setItem("marinara:whats-new:seen-version", version);
          localStorage.setItem("marinara-active-chat-id", chatId);
          localStorage.setItem("marinara-engine-ui-updated-at", String(Date.now() + 120_000));
        },
        { chatId: chats[0]!.id, version: APP_VERSION },
      );
      const fresh = await freshContext.newPage();
      await fresh.goto(page.url());
      await waitForSettings(fresh);
      await expect(chatSettingsButton(fresh)).toBeVisible();
      await expect(fresh.locator("[data-chat-settings-move-tip]")).toHaveCount(0);
      expect(
        await fresh.evaluate(
          () => JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "{}").state?.chatSettingsMoveTipDismissed,
        ),
      ).toBe(true);
    } finally {
      releaseSettings();
      await freshContext.close();
      await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
    }
  });

  test("Help Layout opens beside the Chat Settings title and labels visible controls in every mode", async ({
    page,
    request,
  }) => {
    const chats = [
      await createChat(request, "roleplay", { enableAgents: true }),
      await createChat(request, "conversation"),
      await createChat(request, "game"),
    ];
    try {
      await prepare(page, chats[0]!.id, { trackerPanelEnabled: true, trackerPanelOpen: false });
      await page.goto("/");
      for (const [index, chat] of chats.entries()) {
        if (index > 0) await setActiveChat(page, chat.id);
        await expect(page.locator(`[data-chat-mode="${chat.mode}"]`)).toBeVisible();
        const settings = await openSettingsWindow(page);
        const help = settings.locator(".mari-window__header").getByRole("button", { name: "Help", exact: true });
        await help.hover();
        await expect(page.getByText("Show what each part of this chat does.", { exact: true })).toBeVisible();
        await help.click();
        const overlay = page.locator(`[data-chat-help-overlay="${chat.mode}"]`);
        await expect(overlay).toBeVisible();
        await expect(overlay).toBeFocused();
        await expect(settings).toBeVisible();

        const expected = [
          "settings",
          "help",
          "window-title",
          "window-pin",
          "window-lock",
          "window-close",
          "reset-view",
        ];
        if (chat.mode === "roleplay") expected.push("tracker-panel");
        for (const id of expected) await expect(overlay.locator(`[data-chat-help-highlight="${id}"]`)).toBeVisible();

        // Every callout sits on its control, and nothing else covers that control.
        const misplaced = await overlay.evaluate((overlayElement) => {
          const highlights = Array.from(overlayElement.querySelectorAll<HTMLElement>("[data-chat-help-highlight]"));
          const centres = highlights.map((highlight) => {
            const rect = highlight.getBoundingClientRect();
            return {
              id: highlight.dataset.chatHelpHighlight!,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
          });
          const sourceSelectors: Record<string, string> = {
            messages: "[data-chat-scroll]",
            composer: "[data-chat-resource-drop-exclude], [data-chat-composer]",
            map: '[data-tour="game-map"]',
            party: '[data-tour="game-party"]',
            dialogue: '[data-tour="game-dialogue"]',
            widgets: "[data-game-widget-rail]",
            "window-title": '[data-window="chat-settings"] .mari-window__title',
            "window-pin": '[data-window="chat-settings"] [data-window-control="pin"]',
            "window-lock": '[data-window="chat-settings"] [data-window-control="lock"]',
            "window-close": '[data-window="chat-settings"] [data-window-control="close"]',
            "tracker-panel": '[data-tracker-panel-toggle="chat-settings"]',
            "agent-activity": '[data-window="chat-settings"] [data-drawer$="-agent-activity"] > .mari-drawer__header',
          };
          overlayElement.style.visibility = "hidden";
          try {
            return centres.flatMap(({ id, x, y }) => {
              const hit = document.elementFromPoint(x, y);
              const selector = sourceSelectors[id] ?? `[data-chat-help="${id}"]`;
              return hit?.closest(selector) ? [] : [`${id} → ${hit?.outerHTML.slice(0, 120) ?? "nothing"}`];
            });
          } finally {
            overlayElement.style.visibility = "";
          }
        });
        expect(misplaced, `${chat.mode} callouts without a visible control`).toEqual([]);

        // Number badges sit beside small controls, so their icons stay readable.
        for (const control of ["pin", "lock", "close"]) {
          const badge = await box(overlay.locator(`[data-chat-help-highlight="window-${control}"] > span`));
          const icon = await box(settings.locator(`[data-window-control="${control}"] svg`));
          const overlapX = Math.min(badge.x + badge.width, icon.x + icon.width) - Math.max(badge.x, icon.x);
          const overlapY = Math.min(badge.y + badge.height, icon.y + icon.height) - Math.max(badge.y, icon.y);
          expect(overlapX <= 0 || overlapY <= 0, `${chat.mode} ${control} badge clear of its icon`).toBe(true);
        }

        // Escape closes only the overlay: the unpinned window stays open and the ? gets focus back.
        await page.keyboard.press("Escape");
        await expect(overlay).toHaveCount(0);
        await expect(settings).toBeVisible();
        await expect(help).toBeFocused();

        // With the window closed, the Chat Settings callout points at the Chat Settings button.
        await settings.getByRole("button", { name: "Close chat settings", exact: true }).click();
        await expect(settings).toHaveCount(0);
        await page.evaluate((mode) => {
          window.dispatchEvent(new CustomEvent("mari-chat-help-open-request", { detail: { mode } }));
        }, chat.mode);
        await expect(overlay).toBeVisible();
        expectSameBox(
          await box(overlay.locator('[data-chat-help-highlight="settings"]')),
          await box(chatSettingsButton(page)),
          `${chat.mode} button callout`,
        );
        await expect(overlay.locator('[data-chat-help-highlight="window-pin"]')).toHaveCount(0);
        await overlay.dispatchEvent("pointerdown");
        await expect(overlay).toHaveCount(0);
      }
    } finally {
      await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
    }
  });

  test("windows and drawers carry the theming contract and follow custom theme variables", async ({
    page,
    request,
  }) => {
    const chat = await createChat(request, "roleplay");
    const themeResponse = await request.post("/api/themes", {
      data: {
        name: "Window theming contract",
        css: ":root { --mari-window-border: rgb(255, 0, 0); --mari-window-radius: 3px; } [data-drawer] { --mari-drawer-border: rgb(0, 128, 0); }",
      },
    });
    expect(themeResponse.ok()).toBeTruthy();
    const theme = (await themeResponse.json()) as { id: string };
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      const settings = await openSettingsWindow(page);
      for (const part of ["header", "title", "controls", "body", "resize-handle"]) {
        await expect(settings.locator(`.mari-window__${part}`).first()).toBeAttached();
      }
      await expect(settings).toHaveClass(/\bmari-window\b/u);
      await expect(settings).toHaveAttribute("data-detached", "false");
      const drawer = settings.locator('[data-drawer="chat-name"]');
      await expect(drawer).toHaveClass(/\bmari-drawer\b/u);
      await expect(drawer).toHaveAttribute("data-chat-settings-section", "chat-name");
      await expect(drawer).toHaveAttribute("data-detached", "false");
      await expect(drawer.getByRole("button", { name: "Chat Name", exact: true })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(drawer.locator(".mari-drawer__title")).toHaveText("Chat Name");
      const sectionsOutsideDrawers = await settings.evaluate((element) =>
        Array.from(element.querySelectorAll("[data-chat-settings-section]"))
          .filter((section) => !section.matches(".mari-drawer"))
          .map((section) => section.getAttribute("data-chat-settings-section")),
      );
      expect(sectionsOutsideDrawers, "every Chat Settings section renders through the shared drawer").toEqual([]);
      await expect(settings.locator('.mari-drawer[data-drawer="advanced-parameters"]')).toHaveCount(1);
      const defaultBorder = await settings.evaluate((element) => getComputedStyle(element).borderTopColor);
      const defaultDrawerBorder = await drawer.evaluate((element) => getComputedStyle(element).borderBottomColor);
      expect(defaultBorder).not.toBe("rgb(255, 0, 0)");

      const activated = await request.put("/api/themes/active", { data: { id: theme.id } });
      expect(activated.ok()).toBeTruthy();
      await page.reload();
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      await openSettingsWindow(page);
      await expect(settings).toHaveCSS("border-top-color", "rgb(255, 0, 0)");
      await expect(settings).toHaveCSS("border-top-left-radius", "3px");
      await expect(drawer).toHaveCSS("border-bottom-color", "rgb(0, 128, 0)");
      expect(defaultDrawerBorder).not.toBe("rgb(0, 128, 0)");
    } finally {
      await request.put("/api/themes/active", { data: { id: null } });
      await request.delete(`/api/themes/${theme.id}`);
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("the Chat Settings button sends an open control window back to its button, as it closed popovers", async ({
    page,
    request,
  }) => {
    const chat = await createChat(request, "game");
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible();
      const sessionBubble = page.locator('.mari-window-bubble[data-window="control:session"]');
      const sessionWindow = page.locator('.mari-window[data-window="control:session"]');
      await sessionBubble.click();
      await expect(sessionWindow).toBeVisible();
      await chatSettingsButton(page).click();
      await expect(settingsWindow(page)).toBeVisible();
      await expect(sessionWindow).toHaveCount(0);
      await expect(sessionBubble).toBeVisible();
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("the window opens without motion when motion is reduced", async ({ page, request }) => {
    const chat = await createChat(request, "conversation");
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      const settings = await openSettingsWindow(page);
      await expect(settings).toHaveCSS("animation-name", "none");
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test("phones open Chat Settings from its button as a sheet with Help and the Tracker Panel dice", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Phones show Chat Settings as a sheet.");
  const chat = await createChat(request, "roleplay", { enableAgents: true });
  try {
    await prepare(page, chat.id, { trackerPanelEnabled: true, trackerPanelOpen: false });
    await page.goto("/");
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    // The chat's own menu is gone (#7034); Chat Settings starts at the chat's top right.
    await expect(page.getByRole("button", { name: "More options", exact: true })).toHaveCount(0);
    await expect(page.locator('[data-chat-toolbar-panel-action="settings"]').filter({ visible: true })).toHaveCount(1);
    const [area, buttonBox] = [
      await box(page.locator('[data-component="CenterContent"]')),
      await box(chatSettingsButton(page)),
    ];
    expect(Math.abs(buttonBox.x + buttonBox.width - (area.x + area.width - MARGIN))).toBeLessThanOrEqual(1);
    await expect(
      page.locator('[data-component="TopBar"]').getByRole("button", { name: "Chat Settings", exact: true }),
    ).toHaveCount(0);

    await chatSettingsButton(page).click();
    const sheet = settingsWindow(page);
    await expect(sheet).toBeVisible();
    // The loading placeholder shares the sheet; measure the real settings, not the one being replaced.
    await expect(sheet.locator("[data-chat-settings-section]").first()).toBeVisible();
    await expect(sheet).toHaveAttribute("data-presentation", "sheet");
    await expect(sheet.locator('[data-window-control="lock"]')).toBeVisible();
    await expect(sheet.locator('[data-window-control="close"]')).toBeVisible();
    await expect(sheet.locator('[data-window-control="pin"]')).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    // Reset View and the Tracker Panel dice sit in the sheet's title bar, as on a computer.
    await expect(sheet.getByRole("button", { name: "Reset View", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Tracker Panel", exact: true })).toBeVisible();
    const sheetBox = await box(sheet);
    const viewport = page.viewportSize()!;
    expect(sheetBox.x).toBeGreaterThanOrEqual(0);
    expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(viewport.width);
    // Help closes the sheet, which covers the chat, before it labels what is under it.
    await sheet.getByRole("button", { name: "Help", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('[data-chat-help-overlay="roleplay"]')).toBeVisible();
    await expect(page.locator('[data-chat-help-highlight="settings"]')).toBeVisible();
    await page.locator('[data-chat-help-highlight="settings"]').click();
    const detail = page.locator('[data-chat-help-mobile-detail="settings"]');
    await expect(detail.getByRole("heading", { name: "Chat Settings", exact: true })).toBeVisible();
    await expect(detail).toContainText("Chat Settings contains all the settings for this chat.");
    const icons = detail.locator('[data-chat-help-settings-legend="roleplay"]');
    await expect(icons.getByRole("listitem")).toContainText([
      "Reset View:",
      "Favorite layout:",
      "Tracker Panel:",
      "Lock or unlock:",
      "Close window:",
      "Move a section out:",
    ]);
    await expect(icons).toContainText("A profile with its own layout takes priority.");
    await icons.getByRole("listitem").last().scrollIntoViewIfNeeded();
    await expect(icons.getByRole("listitem").last()).toBeInViewport({ ratio: 1 });
    const detailBox = await box(detail);
    expect(detailBox.x).toBeGreaterThanOrEqual(0);
    expect(detailBox.x + detailBox.width).toBeLessThanOrEqual(viewport.width);
    expect(detailBox.y + detailBox.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath("mobile-settings-help-icons.png"), animations: "disabled" });
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("sidebars keep saved buttons separately reachable and restore their positions", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop sidebars resize the chat area.");
  await page.setViewportSize({ width: 1365, height: 900 });
  const ids = ["chat-branches", "active-context", "gallery", "message-search"].map(
    (section) => `drawer:chat-settings:conversation-${section}`,
  );
  const points = [1265, 1225, 16, 56].map((x) => ({ x, y: 110 }));
  const layout = {
    version: 1,
    detached: ids,
    windows: Object.fromEntries(
      ids.map((id) => [
        id,
        { x: 600, y: 160, width: 400, height: 350, pinned: false, locked: id === ids[0], minimized: true },
      ]),
    ),
    bubbles: {
      "chat-settings-button": { x: 1305, y: 110 },
      ...Object.fromEntries(ids.map((id, index) => [id, points[index]])),
    },
  };
  const chat = await createChat(request, "conversation", { enableAgents: false, windowLayout: layout });
  try {
    await prepare(page, chat.id, { chatSettingsMoveTipDismissed: true, sidebarWidth: 320, rightPanelWidth: 320 });
    await page.goto("/");
    const buttons = page.locator(".mari-window-bubble");
    await expect(buttons).toHaveCount(5);
    const readPositions = () =>
      buttons.evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return [element.getAttribute("data-window"), { x: rect.x, y: rect.y }];
          }),
        ),
      );
    const initial = await readPositions();
    const expectReachable = async () => {
      await expect
        .poll(() =>
          buttons.evaluateAll((elements) => {
            const area = document.querySelector('[data-component="CenterContent"]')!.getBoundingClientRect();
            const rectangles = elements.map((element) => element.getBoundingClientRect());
            return elements.flatMap((element, index) => {
              const rect = rectangles[index]!;
              const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              const inside = rect.left >= area.left + 7 && rect.right <= area.right - 7;
              const separate = rectangles.every(
                (other, otherIndex) =>
                  otherIndex === index ||
                  rect.right <= other.left ||
                  rect.left >= other.right ||
                  rect.bottom <= other.top ||
                  rect.top >= other.bottom,
              );
              return inside && separate && (hit === element || element.contains(hit))
                ? []
                : [element.getAttribute("data-window")];
            });
          }),
        )
        .toEqual([]);
    };
    await expectReachable();
    const topbar = page.locator('[data-component="TopBar"]');
    await topbar.getByTitle("Settings", { exact: true }).click();
    await expect(page.locator('[data-component="RightPanelDesktopSlot"]')).toHaveAttribute("aria-hidden", "false");
    await expect
      .poll(async () => (await box(page.locator('[data-component="RightPanelDesktopSlot"]'))).width)
      .toBe(320);
    await expectReachable();
    await topbar.getByTitle("Chats", { exact: true }).click();
    await expect(page.locator('[data-component="ChatSidebarSlot"]')).toHaveAttribute("aria-hidden", "false");
    await expect.poll(async () => (await box(page.locator('[data-component="ChatSidebarSlot"]'))).width).toBe(320);
    await expectReachable();
    await expect.poll(() => readSavedLayout(request, chat.id)).toEqual(layout);
    const locked = page.locator(`.mari-window-bubble[data-window="${ids[0]}"]`);
    await expect(locked).toHaveAttribute("data-locked", "true");
    const lockedPosition = await box(locked);
    await locked.press("ArrowLeft");
    expectSameBox(await box(locked), lockedPosition, "locked button after sidebar reflow");
    await locked.click();
    const opened = page.locator(`.mari-window[data-window="${ids[0]}"]`);
    await expect(opened).toBeVisible();
    await opened.locator('[data-window-control="close"]').click();
    await expectReachable();
    await topbar.getByTitle("Settings", { exact: true }).click();
    await expectReachable();
    await topbar.getByTitle("Chats", { exact: true }).click();
    await expect.poll(readPositions).toEqual(initial);
    // Opening/closing a drawer may add its legacy window.bubble fallback; the saved places stay intact.
    await expect.poll(() => readSavedLayout(request, chat.id)).toMatchObject(layout);
    await expect.poll(async () => (await readSavedLayout(request, chat.id))?.bubbles).toEqual(layout.bubbles);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("sidebars keep the default Settings button clear of a saved button", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop sidebars resize the chat area.");
  await page.setViewportSize({ width: 1365, height: 900 });
  const id = "drawer:chat-settings:conversation-chat-branches";
  const chat = await createChat(request, "conversation");
  try {
    await prepare(page, chat.id, { sidebarWidth: 320, rightPanelWidth: 320 });
    await page.goto("/");
    await expect(chatSettingsButton(page)).toBeVisible();
    const originalSettings = await box(chatSettingsButton(page));
    const savedPoint = { x: originalSettings.x - 320, y: originalSettings.y };
    const layout = {
      version: 1,
      detached: [id],
      windows: { [id]: { x: 600, y: 160, width: 400, height: 350, pinned: false, locked: true, minimized: true } },
      bubbles: { [id]: savedPoint },
    };
    expect(
      (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { windowLayout: layout } })).ok(),
    ).toBeTruthy();
    await page.reload();
    const saved = page.locator(`.mari-window-bubble[data-window="${id}"]`);
    await expect(saved).toBeVisible();
    const before = await box(saved);
    await page.locator('[data-component="TopBar"]').getByTitle("Settings", { exact: true }).click();
    await expect
      .poll(async () => (await box(page.locator('[data-component="RightPanelDesktopSlot"]'))).width)
      .toBe(320);
    await expect
      .poll(() =>
        page.locator(".mari-window-bubble").evaluateAll((elements) =>
          elements.every((element) => {
            const rect = element.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return hit === element || element.contains(hit);
          }),
        ),
      )
      .toBe(true);
    expectSameBox(await box(saved), before, "the saved button keeps its position");
    const movedSettings = await box(chatSettingsButton(page));
    expect(
      Math.abs(movedSettings.x - before.x) >= before.width || Math.abs(movedSettings.y - before.y) >= before.height,
    ).toBe(true);
    await page.locator('[data-component="TopBar"]').getByTitle("Settings", { exact: true }).click();
    await expect.poll(async () => (await box(chatSettingsButton(page))).x).toBe(originalSettings.x);
    await expect.poll(() => readSavedLayout(request, chat.id)).toEqual(layout);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
