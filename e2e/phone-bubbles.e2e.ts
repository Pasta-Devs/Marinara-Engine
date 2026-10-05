// #7034 step 6: on phones, Chat Settings opens from its button in the chat, and popped-out drawers, the chat's controls
// and the Tracker Panel are bubbles the user places anywhere; each opens as a sheet. On a computer,
// package toolbars and Beholder become control windows, and a dot shows while agents run.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const CHAT_NAME_DRAWER = "drawer:chat-settings:chat-name";
const CONNECTED = "control:connected-chat";
const GAME_CONTROLS = ["control:game", "control:session", "control:volume", "control:assets", CONNECTED];

type Box = { x: number; y: number; width: number; height: number };
type SavedLayout = {
  windows: Record<string, unknown>;
  detached?: string[];
  phoneBubbles?: Record<string, { x: number; y: number }>;
} | null;

async function createChat(
  request: APIRequestContext,
  mode: "roleplay" | "conversation" | "game",
  metadata: Record<string, unknown> = {},
  options: { connected?: boolean } = {},
) {
  const response = await request.post("/api/chats", { data: { name: `Phone ${mode}`, mode, characterIds: [] } });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const gameMetadata =
    mode === "game"
      ? { gameId: "phone-bubbles", gameSessionStatus: "active", gameSessionNumber: 1, gameIntroPresented: true }
      : {};
  const merged = { ...gameMetadata, ...metadata };
  if (Object.keys(merged).length > 0) {
    expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: merged })).ok()).toBeTruthy();
  }
  expect(
    (
      await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content: "Hello there." } })
    ).ok(),
  ).toBeTruthy();
  const cleanup = [chat.id];
  if (options.connected) {
    const partner = (await (
      await request.post("/api/chats", { data: { name: "Phone partner", mode: "conversation", characterIds: [] } })
    ).json()) as { id: string };
    cleanup.push(partner.id);
    expect(
      (await request.post(`/api/chats/${chat.id}/connect`, { data: { targetChatId: partner.id } })).ok(),
    ).toBeTruthy();
  }
  return {
    id: chat.id,
    remove: async () => {
      for (const id of cleanup) await request.delete(`/api/chats/${id}?force=true`);
    },
  };
}

async function prepare(page: Page, chatId: string, ui: Record<string, unknown> = {}) {
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
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version: APP_VERSION },
  );
}

async function readSavedLayout(request: APIRequestContext, chatId: string): Promise<SavedLayout> {
  const chat = (await (await request.get(`/api/chats/${chatId}`)).json()) as { metadata: unknown };
  const metadata = (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata) as {
    windowLayout?: SavedLayout;
  };
  return metadata.windowLayout ?? null;
}

const bubble = (page: Page, id: string) => page.locator(`.mari-window-bubble[data-window="${id}"]`);
const sheet = (page: Page, id: string) => page.locator(`.mari-window[data-window="${id}"]`);
const chatSettingsButton = (page: Page) => page.locator("[data-chat-settings-button]");

async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function openSettingsSheet(page: Page) {
  await chatSettingsButton(page).click();
  const settings = sheet(page, "chat-settings");
  await expect(settings.locator("[data-chat-settings-section]").first()).toBeVisible();
  await expect(settings).toHaveAttribute("data-presentation", "sheet");
  return settings;
}

/** Drags with the mouse so its top-left lands at `to`; `hold` keeps the button down at the end. */
async function dragBubble(page: Page, target: Locator, to: { x: number; y: number }, options: { hold?: boolean } = {}) {
  const from = await box(target);
  const grab = { x: from.width / 2, y: from.height / 2 };
  await page.mouse.move(from.x + grab.x, from.y + grab.y);
  await page.mouse.down();
  await page.mouse.move(from.x + grab.x - 14, from.y + grab.y + 14, { steps: 3 });
  await page.mouse.move(to.x + grab.x, to.y + grab.y, { steps: 8 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (!options.hold) await page.mouse.up();
}

/** No bubble sits on the message box, and the page never scrolls sideways. */
async function expectComposerClearAndNoSideScroll(page: Page) {
  const overlap = await page.evaluate(() => {
    const composer = document.querySelector("[data-chat-mode] [data-chat-composer]");
    const shell = composer?.closest("[data-chat-resource-drop-exclude]") ?? composer;
    const composerRect = shell?.getBoundingClientRect();
    if (!composerRect) return [];
    return Array.from(document.querySelectorAll(".mari-window-bubble"))
      .map((element) => ({ id: element.getAttribute("data-window"), rect: element.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.left < composerRect.right &&
          rect.right > composerRect.left &&
          rect.top < composerRect.bottom &&
          rect.bottom > composerRect.top,
      )
      .map(({ id }) => id);
  });
  expect(overlap).toEqual([]);
  const sideScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth ||
      document.body.scrollWidth > document.body.clientWidth,
  );
  expect(sideScroll).toBe(false);
}

test.describe("phone bubbles", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Phones only; computers keep windows.");
  });

  test("a drawer pops out into a bubble that drags, snaps, opens, goes back and stays with the chat", async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, "roleplay", {}, { connected: true });
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      // The old "More options" menu is gone; Chat Settings starts at the chat's top right.
      await expect(page.getByRole("button", { name: "More options", exact: true })).toHaveCount(0);
      const area = await box(page.locator('[data-component="CenterContent"]'));
      const settingsButton = await box(chatSettingsButton(page));
      expect(Math.abs(settingsButton.x + settingsButton.width - (area.x + area.width - 8))).toBeLessThanOrEqual(1);
      await expect(chatSettingsButton(page)).toHaveAttribute("data-presentation", "sheet");
      await expect(bubble(page, CONNECTED)).toBeVisible();
      await expectComposerClearAndNoSideScroll(page);

      // The pop-out button moves the drawer into a bubble and closes the sheet so the bubble shows.
      const settings = await openSettingsSheet(page);
      await expect(settings.getByRole("button", { name: "Help", exact: true })).toBeVisible();
      await expect(settings.getByRole("button", { name: "Reset View", exact: true })).toBeVisible();
      const popOut = settings.locator('[data-drawer$="chat-name"] [data-drawer-control="pop-out"]');
      expect((await box(popOut)).height).toBeGreaterThanOrEqual(44);
      await popOut.click();
      // Chat Settings stays mounted, hidden, to keep the popped-out drawer's state.
      await expect(settings).toBeHidden();
      const drawerBubble = bubble(page, CHAT_NAME_DRAWER);
      await expect(drawerBubble).toBeVisible();
      await expect(sheet(page, CHAT_NAME_DRAWER)).toHaveCount(0);
      await expect(drawerBubble).toHaveAccessibleName("Open Chat Name");
      // It takes the next free spot in the row, left of the connected chat's bubble.
      const connected = await box(bubble(page, CONNECTED));
      let placed = await box(drawerBubble);
      expect(placed.y).toBeCloseTo(connected.y, 0);
      expect(placed.x).toBeCloseTo(connected.x - connected.width - 8, 0);
      // A 36px bubble with a 44px tap area.
      expect(placed.width).toBeCloseTo(36, 0);
      const tapArea = await drawerBubble.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left - 3, rect.top + rect.height / 2);
        return hit === element || element.contains(hit);
      });
      expect(tapArea).toBe(true);

      // Dragged under the connected chat's bubble it snaps into line with it, a steady gap below.
      await dragBubble(
        page,
        drawerBubble,
        { x: connected.x - 4, y: connected.y + connected.height + 11 },
        { hold: true },
      );
      await expect(page.locator(".mari-window-snap-guide").first()).toBeVisible();
      await page.mouse.up();
      placed = await box(drawerBubble);
      expect(placed.x).toBeCloseTo(connected.x, 0);
      expect(placed.y).toBeCloseTo(connected.y + connected.height + 8, 0);
      await expect(sheet(page, CHAT_NAME_DRAWER)).toHaveCount(0);

      // A tap opens the drawer as a sheet; closing it goes back to the bubble.
      await drawerBubble.click();
      const drawerSheet = sheet(page, CHAT_NAME_DRAWER);
      await expect(drawerSheet).toBeVisible();
      await expect(drawerSheet).toHaveAttribute("data-presentation", "sheet");
      await expect(drawerSheet.getByText("Chat ID", { exact: false })).toBeVisible();
      const sheetBox = await box(drawerSheet);
      const viewport = page.viewportSize()!;
      expect(sheetBox.x).toBeGreaterThanOrEqual(0);
      expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: testInfo.outputPath("drawer-sheet.png"), animations: "disabled" });
      await drawerSheet.locator('[data-window-control="close"]').click();
      await expect(drawerSheet).toHaveCount(0);
      await expect(drawerBubble).toBeVisible();

      // Its place saves with the chat, apart from the computer's places, and survives a reload.
      await expect
        .poll(async () => {
          const layout = await readSavedLayout(request, chat.id);
          return [layout?.detached ?? [], layout?.phoneBubbles?.[CHAT_NAME_DRAWER] ?? null];
        })
        .toEqual([[CHAT_NAME_DRAWER], { x: placed.x, y: placed.y }]);
      await page.reload();
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      const reloaded = await box(bubble(page, CHAT_NAME_DRAWER));
      expect(reloaded.x).toBeCloseTo(placed.x, 0);
      expect(reloaded.y).toBeCloseTo(placed.y, 0);
      await page.screenshot({ path: testInfo.outputPath("bubbles-after-reload.png"), animations: "disabled" });

      // Put back returns the drawer to Chat Settings.
      await bubble(page, CHAT_NAME_DRAWER).click();
      await sheet(page, CHAT_NAME_DRAWER).getByRole("button", { name: "Put back in Chat Settings" }).click();
      await expect(bubble(page, CHAT_NAME_DRAWER)).toHaveCount(0);
      const reopened = await openSettingsSheet(page);
      await expect(reopened.locator('[data-drawer$="chat-name"]').first()).toHaveAttribute("data-detached", "false");
      await expect.poll(async () => (await readSavedLayout(request, chat.id))?.detached ?? []).toEqual([]);
    } finally {
      await chat.remove();
    }
  });

  test("a tap with a little finger movement opens a bubble instead of moving it", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes("chromium"), "Touch input is sent through Chromium's DevTools.");
    const chat = await createChat(request, "conversation", {}, { connected: true });
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible({ timeout: 30_000 });
      const target = bubble(page, CONNECTED);
      const start = await box(target);
      const cdp = await page.context().newCDPSession(page);
      const touch = async (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
        cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      const cx = start.x + start.width / 2;
      const cy = start.y + start.height / 2;
      // A wobbly tap (6px) still opens it.
      await touch("touchStart", cx, cy);
      await touch("touchMove", cx + 4, cy + 4);
      await touch("touchEnd", cx + 4, cy + 4);
      await expect(sheet(page, CONNECTED)).toBeVisible();
      await sheet(page, CONNECTED).locator('[data-window-control="close"]').click();
      await expect(target).toBeVisible();
      const unchanged = await box(target);
      expect(unchanged.x).toBeCloseTo(start.x, 0);
      expect(unchanged.y).toBeCloseTo(start.y, 0);
      // A real drag moves it and opens nothing.
      // Some touch browsers omit the release click. Suppress it here if emitted so
      // this test always covers that path, rather than consuming the drag guard.
      await target.evaluate((element) => {
        const omitReleaseClick = (event: Event) => event.stopImmediatePropagation();
        element.setAttribute("data-test-release-click-blocker", "true");
        element.addEventListener("click", omitReleaseClick, true);
        element.addEventListener(
          "pointerup",
          () =>
            window.setTimeout(() => {
              element.removeEventListener("click", omitReleaseClick, true);
              element.removeAttribute("data-test-release-click-blocker");
            }, 0),
          { once: true },
        );
      });
      await touch("touchStart", cx, cy);
      for (let step = 1; step <= 6; step += 1) await touch("touchMove", cx - step * 20, cy + step * 30);
      await touch("touchEnd", cx - 120, cy + 180);
      await expect(sheet(page, CONNECTED)).toHaveCount(0);
      const moved = await box(target);
      expect(moved.x).toBeLessThan(start.x - 100);
      expect(moved.y).toBeGreaterThan(start.y + 150);
      await expectComposerClearAndNoSideScroll(page);
      await expect(target).not.toHaveAttribute("data-test-release-click-blocker", "true");
      // The first deliberate tap after the drag must open, without a second tap.
      const nextX = moved.x + moved.width / 2;
      const nextY = moved.y + moved.height / 2;
      await touch("touchStart", nextX, nextY);
      await touch("touchEnd", nextX, nextY);
      await expect(sheet(page, CONNECTED)).toBeVisible();
    } finally {
      await chat.remove();
    }
  });

  for (const [theme, preset] of [
    ["dark", "dottore"],
    ["light", "mari"],
  ] as const) {
    test(`separate phone trackers use ${preset} styling and keep moved buttons and edits in ${theme} mode`, async ({
      page,
      request,
    }, testInfo) => {
      const chat = await createChat(request, "roleplay", {
        enableAgents: true,
        activeAgentIds: ["world-state", "persona-stats"],
        windowLayout: null,
      });
      try {
        expect(
          (
            await request.patch(`/api/chats/${chat.id}/game-state`, {
              data: {
                manual: true,
                location: "Harbor market",
                personaStats: [{ name: "Stamina", value: 6, max: 10, color: "#22c55e" }],
              },
            })
          ).ok(),
        ).toBeTruthy();
        await prepare(page, chat.id, {
          theme,
          chatWidgetPreset: preset,
          chatWidgetFont: "@mono",
          chatWidgetBorderColor: "#f4cb78",
          chatWidgetBackgroundColor: "#14243b",
          chatWidgetTextColor: "#f5eed6",
          trackerPanelEnabled: false,
          trackerPanelOpen: false,
          trackerPanelHideHudWidgets: true,
        });
        await page.goto("/");
        const world = bubble(page, "control:tracker-world");
        const player = bubble(page, "control:tracker-player");
        await expect(world).toHaveCount(1);
        await expect(player).toHaveCount(1);
        await expect(world).toBeVisible();
        await expect(player).toBeVisible();
        await expect(world).toHaveAccessibleName("Open World State");
        await expect(player).toHaveAccessibleName("Open Player & Tracker");
        expect(
          await world.evaluate(
            (element) =>
              element.closest(".rpg-hud") === null &&
              element.parentElement?.matches('[data-component="ChatArea.Roleplay"]'),
          ),
        ).toBe(true);
        const worldStart = await box(world);
        const playerStart = await box(player);
        expect(
          Math.abs(worldStart.x - playerStart.x) >= worldStart.width ||
            Math.abs(worldStart.y - playerStart.y) >= worldStart.height,
        ).toBe(true);
        await dragBubble(page, world, { x: 40, y: 240 });
        const placed = await box(world);
        await expect
          .poll(async () => (await readSavedLayout(request, chat.id))?.phoneBubbles?.["control:tracker-world"] ?? null)
          .toEqual({ x: placed.x, y: placed.y });
        await world.click();
        const window = sheet(page, "control:tracker-world");
        await expect(window).toHaveAttribute("data-presentation", "sheet");
        await expect(window.getByRole("button", { name: "Harbor market", exact: true })).toBeVisible();
        await expect(window).toHaveCSS("font-family", /monospace/);
        await expect(window.locator(".mari-window__title")).toHaveCSS("color", "rgb(245, 238, 214)");
        await expect
          .poll(() =>
            window.evaluate((element) =>
              [null, "::before", "::after"]
                .map((pseudo) => {
                  const style = getComputedStyle(element, pseudo);
                  return `${style.backgroundColor} ${style.backgroundImage}`;
                })
                .join(" "),
            ),
          )
          .toContain("rgb(20, 36, 59)");
        await expect(window.locator('[data-window-control="close"] svg')).toHaveCSS("color", "rgb(244, 203, 120)");
        await window.getByRole("button", { name: "Harbor market", exact: true }).click();
        const location = window.getByPlaceholder("Location", { exact: true });
        await location.fill("Lantern market");
        await expect(location).toHaveCSS("-webkit-text-fill-color", "rgb(245, 238, 214)");
        await location.press("Enter");
        await expect
          .poll(async () => (await (await request.get(`/api/chats/${chat.id}/game-state`)).json()).location)
          .toBe("Lantern market");
        await page.screenshot({
          path: testInfo.outputPath(`${preset}-${theme}-phone-world-tracker.png`),
          animations: "disabled",
        });
        await window.locator('[data-window-control="close"]').click();
        await expect(world).toBeVisible();
        await player.click();
        const playerWindow = sheet(page, "control:tracker-player");
        await expect(playerWindow.getByText("Stamina", { exact: true })).toBeVisible();
        await expect(playerWindow).toHaveCSS("font-family", /monospace/);
        await page.screenshot({
          path: testInfo.outputPath(`${preset}-${theme}-phone-player-tracker.png`),
          animations: "disabled",
        });
        await playerWindow.locator('[data-window-control="close"]').click();
        await expectComposerClearAndNoSideScroll(page);
        await page.reload();
        await expect(world).toBeVisible();
        await expect(world).toHaveCount(1);
        await expect(player).toHaveCount(1);
        await expect
          .poll(async () => {
            const actual = await box(world);
            return { x: actual.x, y: actual.y };
          })
          .toEqual({ x: placed.x, y: placed.y });
        await world.click();
        await expect(window.getByRole("button", { name: "Lantern market", exact: true })).toBeVisible();
      } finally {
        await chat.remove();
      }
    });
  }

  test("the Tracker Panel dice shows a bubble that opens the phone Tracker Panel", async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, "roleplay", {
      enableAgents: true,
      activeAgentIds: ["world-state", "persona-stats"],
    });
    try {
      await prepare(page, chat.id, {
        trackerPanelEnabled: false,
        trackerPanelOpen: false,
        trackerPanelHideHudWidgets: true,
      });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      const trackerBubble = page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]');
      const panel = page.locator('[data-component="TrackerDataSidebarMobile"]');
      await expect(trackerBubble).toHaveCount(0);
      // The separate World and Player trackers use movable buttons while the panel is off.
      await expect(bubble(page, "control:tracker-world")).toBeVisible();
      await expect(bubble(page, "control:tracker-player")).toBeVisible();

      const settings = await openSettingsSheet(page);
      const dice = settings.getByRole("button", { name: "Tracker Panel", exact: true });
      await dice.click();
      await expect(dice).toHaveAttribute("aria-pressed", "true");
      await expect(bubble(page, "control:tracker-world")).toHaveCount(0);
      await expect(bubble(page, "control:tracker-player")).toHaveCount(0);
      // Switching it on leaves the panel closed: it waits behind its bubble.
      await settings.locator('[data-window-control="close"]').click();
      await expect(trackerBubble).toBeVisible();
      await expect(trackerBubble).toHaveAccessibleName("Open Tracker Panel");
      await expect(panel).toHaveCount(0);
      await expectComposerClearAndNoSideScroll(page);

      await trackerBubble.click();
      await expect(panel).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("tracker-panel-open.png"), animations: "disabled" });
      // Closing the panel goes back to the bubble; the switch stays on.
      await panel.getByRole("button", { name: "Close Tracker Panel" }).click();
      await expect(panel).toHaveCount(0);
      await expect(trackerBubble).toBeVisible();

      // Its place saves with the chat.
      const start = await box(trackerBubble);
      await dragBubble(page, trackerBubble, { x: 40, y: start.y + 200 });
      const placed = await box(trackerBubble);
      await expect
        .poll(async () => (await readSavedLayout(request, chat.id))?.phoneBubbles?.["tracker-panel"] ?? null)
        .toEqual({ x: placed.x, y: placed.y });

      // Switching it off removes the bubble.
      const reopened = await openSettingsSheet(page);
      const reopenedDice = reopened.getByRole("button", { name: "Tracker Panel", exact: true });
      await expect(reopenedDice).toHaveAttribute("aria-pressed", "true");
      await reopenedDice.click();
      await expect(reopenedDice).toHaveAttribute("aria-pressed", "false");
      await reopened.locator('[data-window-control="close"]').click();
      await expect(trackerBubble).toHaveCount(0);
    } finally {
      await chat.remove();
    }
  });

  test("Game's controls are bubbles in a row that open their content as sheets", async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, "game", {}, { connected: true });
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      const game = page.locator('[data-chat-mode="game"]');
      await expect(game).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Game actions", exact: true })).toHaveCount(0);

      // Settings owns the first top-right slot; controls start to its left and wrap below it.
      for (const id of GAME_CONTROLS) await expect(bubble(page, id)).toBeVisible();
      const row = await Promise.all(GAME_CONTROLS.map((id) => box(bubble(page, id))));
      const viewport = page.viewportSize()!;
      const settingsButton = await box(chatSettingsButton(page));
      const rects = [...row, settingsButton];
      for (const [index, rect] of rects.entries()) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
        for (const other of rects.slice(index + 1)) {
          const apart =
            rect.x + rect.width <= other.x ||
            other.x + other.width <= rect.x ||
            rect.y + rect.height <= other.y ||
            other.y + other.height <= rect.y;
          expect(apart, "bubbles never overlap").toBe(true);
        }
      }
      const connectedBox = row.at(-1)!;
      expect(Math.abs(connectedBox.y - settingsButton.y)).toBeLessThanOrEqual(1);
      expect(connectedBox.x + connectedBox.width).toBeLessThan(settingsButton.x);
      for (const rect of row) expect([0, 44]).toContain(Math.round(rect.y - settingsButton.y));
      // The map stays clear of the bubbles.
      const map = await box(game.locator('[data-tour="game-map"]').first());
      for (const rect of rects) expect(map.x + map.width <= rect.x || map.y + map.height <= rect.y).toBe(true);
      await expectComposerClearAndNoSideScroll(page);
      const input = await box(game.getByPlaceholder("What do you do?"));
      for (const rect of rects) expect(rect.y + rect.height).toBeLessThan(input.y);
      await page.screenshot({ path: testInfo.outputPath("game-bubbles.png"), animations: "disabled" });

      const opens: Array<[string, (window: Locator) => Locator]> = [
        ["control:game", (window) => window.getByRole("button", { name: "Retry Turn" })],
        ["control:session", (window) => window.getByRole("button", { name: /history/iu }).first()],
        ["control:volume", (window) => window.getByRole("slider").first()],
        ["control:assets", (window) => window.getByRole("button", { name: "Generate background", exact: true })],
        [CONNECTED, (window) => window.getByRole("button", { name: /^Switch to/u })],
      ];
      for (const [id, content] of opens) {
        await bubble(page, id).click();
        const window = sheet(page, id);
        await expect(window).toBeVisible();
        await expect(window).toHaveAttribute("data-presentation", "sheet");
        await expect(content(window)).toBeVisible();
        const rect = await box(window);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
        if (id === "control:session") {
          await page.screenshot({ path: testInfo.outputPath("session-sheet.png"), animations: "disabled" });
        }
        await window.locator('[data-window-control="close"]').click();
        await expect(window).toHaveCount(0);
        await expect(bubble(page, id)).toBeVisible();
      }
    } finally {
      await chat.remove();
    }
  });

  test("bubbles stay clear of the keyboard and the message box when the screen shrinks", async ({ page, request }) => {
    const chat = await createChat(request, "conversation", {}, { connected: true });
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible({ timeout: 30_000 });
      const target = bubble(page, CONNECTED);
      const composer = page.locator("[data-chat-mode] [data-chat-composer]").first();
      // Dragged as low as it goes, it stops above the message box.
      await dragBubble(page, target, { x: 24, y: 2000 });
      const composerTop = async () =>
        composer.evaluate(
          (element) => (element.closest("[data-chat-resource-drop-exclude]") ?? element).getBoundingClientRect().top,
        );
      let low = await box(target);
      expect(low.y + low.height).toBeLessThanOrEqual(await composerTop());
      // A shorter screen (the keyboard, or turning the phone) moves it back into view.
      const viewport = page.viewportSize()!;
      await page.setViewportSize({ width: viewport.width, height: Math.round(viewport.height * 0.6) });
      await expect
        .poll(async () => {
          low = await box(target);
          return low.y + low.height <= (await composerTop());
        })
        .toBe(true);
      await expectComposerClearAndNoSideScroll(page);
      await page.setViewportSize(viewport);
    } finally {
      await chat.remove();
    }
  });

  test("a phone turned sideways shows the chat's windows without sideways scrolling", async ({ page, request }) => {
    const chat = await createChat(request, "game", {}, { connected: true });
    try {
      await prepare(page, chat.id);
      const portrait = page.viewportSize()!;
      await page.setViewportSize({ width: portrait.height, height: portrait.width });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
      // Wide enough for the computer layout: the same controls are minimized windows on screen.
      for (const id of GAME_CONTROLS) {
        const rect = await box(bubble(page, id));
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(portrait.height);
        expect(rect.y + rect.height).toBeLessThanOrEqual(portrait.width);
      }
      await expect(chatSettingsButton(page)).toBeVisible();
      await expectComposerClearAndNoSideScroll(page);
      // Back upright, they are a phone's bubbles again.
      await page.setViewportSize(portrait);
      await expect(bubble(page, GAME_CONTROLS[0]!)).toHaveAttribute("data-presentation", "sheet");
      await expectComposerClearAndNoSideScroll(page);
    } finally {
      await chat.remove();
    }
  });
});

test.describe("chat windows on desktop (step 6)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "Desktop windows.");
  });

  function packageFixture(id: string, slot: "conversation-toolbar" | "roleplay-tracker", name: string) {
    return {
      id,
      version: "1.0.0",
      status: "active",
      readiness: "ready",
      error: null,
      installedAt: "2026-01-01T00:00:00.000Z",
      manifest: {
        schemaVersion: 1,
        id,
        name,
        version: "1.0.0",
        engine: { min: "2.0.0", maxExclusive: "3.0.0" },
        kind: ["agent"],
        entrypoints: { client: "client.js" },
        contributions: { slots: [slot] },
        permissions: [],
        files: [],
      },
    };
  }

  test("Conversation package toolbars and Beholder are control windows with bubbles", async ({ page, request }) => {
    const conversation = await createChat(request, "conversation", {
      enableAgents: true,
      activeAgentIds: ["phone-toolbar"],
    });
    const roleplay = await createChat(request, "roleplay", { enableAgents: true, activeAgentIds: ["beholder"] });
    try {
      await page.route("**/api/capability-packages/installed", (route) =>
        route.fulfill({
          json: [
            packageFixture("phone-toolbar", "conversation-toolbar", "Toolbar Package"),
            packageFixture("beholder", "roleplay-tracker", "Beholder"),
          ],
        }),
      );
      await prepare(page, conversation.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible({ timeout: 30_000 });
      const toolbarBubble = bubble(page, "control:package:phone-toolbar");
      await expect(toolbarBubble).toBeVisible();
      await expect(toolbarBubble).toHaveAccessibleName("Open Toolbar Package");
      await expect(toolbarBubble).toHaveAttribute("data-chat-help", "agent-controls");
      await toolbarBubble.click();
      await expect(sheet(page, "control:package:phone-toolbar")).toBeVisible();
      await expect(sheet(page, "control:package:phone-toolbar")).toHaveAttribute("data-presentation", "window");
      // The header has no package buttons of its own any more.
      await expect(page.locator('[data-chat-mode="conversation"] [data-chat-help="agent-controls"]')).toHaveCount(0);

      await page.evaluate(async (chatId) => {
        const module = (await import("/src/stores/chat.store.ts" as string)) as {
          useChatStore: { getState: () => { setActiveChatId: (id: string) => void } };
        };
        module.useChatStore.getState().setActiveChatId(chatId);
      }, roleplay.id);
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      const beholderBubble = bubble(page, "control:beholder:beholder");
      await expect(beholderBubble).toBeVisible();
      await expect(beholderBubble).toHaveAccessibleName("Open Beholder");
      await beholderBubble.click();
      await expect(sheet(page, "control:beholder:beholder")).toBeVisible();
    } finally {
      await conversation.remove();
      await roleplay.remove();
    }
  });

  test("a dot on the Chat Settings button and the Trackers window shows while agents run", async ({
    page,
    request,
  }) => {
    const chat = await createChat(request, "roleplay", { enableAgents: true, activeAgentIds: ["world-state"] });
    try {
      await prepare(page, chat.id, { trackerPanelEnabled: false });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      const button = chatSettingsButton(page);
      const trackers = sheet(page, "trackers");
      await expect(bubble(page, "trackers")).toBeVisible();
      await bubble(page, "trackers").click();
      await expect(trackers).toBeVisible();
      await expect(button.locator("[data-agents-running]")).toHaveCount(0);
      await expect(trackers.locator("[data-agents-running]")).toHaveCount(0);

      const setProcessing = (processing: boolean) =>
        page.evaluate(
          async ({ chatId, processing }) => {
            const module = (await import("/src/stores/agent.store.ts" as string)) as {
              useAgentStore: { getState: () => { setProcessing: (value: boolean, chatId: string) => void } };
            };
            module.useAgentStore.getState().setProcessing(processing, chatId);
          },
          { chatId: chat.id, processing },
        );
      await setProcessing(true);
      await expect(button.locator("[data-agents-running]")).toBeVisible();
      await expect(button).toHaveAccessibleDescription("Agents are running");
      await expect(button).toHaveAccessibleName("Chat Settings");
      await expect(trackers.getByRole("img", { name: "Agents are running" })).toBeVisible();
      await setProcessing(false);
      await expect(button.locator("[data-agents-running]")).toHaveCount(0);
      await expect(trackers.locator("[data-agents-running]")).toHaveCount(0);

      // Reduced motion keeps the dot still.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await setProcessing(true);
      await expect(button.locator("[data-agents-running]")).toHaveCSS("animation-name", "none");
    } finally {
      await chat.remove();
    }
  });
});
