import { openChatTool } from "./chat-settings-tools.js";
// #7034: on a computer the chat's top controls (Game's Session, Volume, Assets and Game controls, the
// connected chat, Roleplay's package toolbars) are windows that minimize to buttons ("bubbles") you can
// place anywhere. Bubbles snap into line with each other, and their places save with the chat.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings, resetChatView } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const GAME_CONTROLS = "control:game";
const SESSION = "control:session";
const VOLUME = "control:volume";
const ASSETS = "control:assets";
const CONNECTED = "control:connected-chat";

async function createGameWithConnectedChat(request: APIRequestContext) {
  const created = await request.post("/api/chats", {
    data: { name: "Control windows game", mode: "game", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const game = (await created.json()) as { id: string };
  expect(
    (
      await request.patch(`/api/chats/${game.id}/metadata`, {
        data: {
          gameId: "control-windows-game",
          gameSessionStatus: "active",
          gameSessionNumber: 1,
          gameIntroPresented: true,
        },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`/api/chats/${game.id}/messages`, { data: { role: "assistant", content: "The game begins." } })
    ).ok(),
  ).toBeTruthy();
  const other = await request.post("/api/chats", {
    data: { name: "Control windows partner", mode: "conversation", characterIds: [] },
  });
  expect(other.ok()).toBeTruthy();
  const partner = (await other.json()) as { id: string };
  expect(
    (await request.post(`/api/chats/${game.id}/connect`, { data: { targetChatId: partner.id } })).ok(),
  ).toBeTruthy();
  return { gameId: game.id, partnerId: partner.id };
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

function bubble(page: Page, id: string) {
  return page.locator(`.mari-window-bubble[data-window="${id}"]`);
}

function controlWindow(page: Page, id: string) {
  return page.locator(`.mari-window[data-window="${id}"]`);
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

/** Drags a bubble by its centre so its top-left lands at `to`; `hold` keeps the button down at the end. */
async function dragBubble(page: Page, target: Locator, to: { x: number; y: number }, options: { hold?: boolean } = {}) {
  const from = await box(target);
  const grab = { x: from.width / 2, y: from.height / 2 };
  await page.mouse.move(from.x + grab.x, from.y + grab.y);
  await page.mouse.down();
  await page.mouse.move(from.x + grab.x + 12, from.y + grab.y + 12, { steps: 3 });
  await page.mouse.move(to.x + grab.x, to.y + grab.y, { steps: 8 });
  // Let the last position paint (moves are applied on the next frame).
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (!options.hold) await page.mouse.up();
}

async function savedWindowLayout(request: APIRequestContext, chatId: string) {
  const chat = (await (await request.get(`/api/chats/${chatId}`)).json()) as { metadata?: unknown };
  const metadata =
    typeof chat.metadata === "string" ? (JSON.parse(chat.metadata) as Record<string, unknown>) : chat.metadata;
  return ((metadata as Record<string, unknown> | undefined)?.windowLayout ?? null) as {
    windows: Record<
      string,
      { pinned?: boolean; minimized?: boolean; docked?: boolean; locked?: boolean; bubble?: { x: number; y: number } }
    >;
    bubbles?: Record<string, { x: number; y: number }>;
    phoneBubbles?: Record<string, { x: number; y: number }>;
  } | null;
}

test.describe("chat control windows on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "Phones show these as bubbles (phone-bubbles.e2e.ts).");
  });

  test("Game inventory controls stay above a pinned chat window", async ({ page, request }) => {
    const { gameId, partnerId } = await createGameWithConnectedChat(request);
    try {
      await prepare(page, gameId);
      await page.goto("/");
      const settings = await openChatSettings(page);
      await settings.locator('[data-window-control="pin"]').click();
      // Its below-button starting position may cover Inventory; move the pinned window aside first.
      const header = settings.locator(".mari-window__header");
      for (let step = 0; step < 10; step++) await header.press("Shift+ArrowRight");
      await page.getByRole("button", { name: "Inventory", exact: true }).first().click();
      const inventory = page.getByRole("dialog", { name: "Inventory", exact: true });
      await expect(inventory).toBeVisible();
      await expect(settings).toBeHidden();
      await inventory.getByRole("button", { name: "Close", exact: true }).click();
      await expect(inventory).toHaveCount(0);
      await expect(settings).toBeVisible();
    } finally {
      await request.delete(`/api/chats/${gameId}?force=true`);
      await request.delete(`/api/chats/${partnerId}?force=true`);
    }
  });

  test("theme-sized bubbles stay separated and inside the chat when their size changes", async ({ page, request }) => {
    const { gameId, partnerId } = await createGameWithConnectedChat(request);
    try {
      await prepare(page, gameId);
      await page.goto("/");
      await expect(bubble(page, VOLUME)).toBeVisible();
      const theme = await page.addStyleTag({
        content: "html { font-size: 26px !important; --mari-window-bubble-size: 3rem; }",
      });
      const ids = [GAME_CONTROLS, SESSION, VOLUME, ASSETS, CONNECTED];
      await expect.poll(async () => (await box(bubble(page, VOLUME))).width).toBeCloseTo(78, 0);
      await expect
        .poll(async () => {
          const rectangles = await Promise.all(ids.map((id) => box(bubble(page, id))));
          return rectangles.every((rect, index) =>
            rectangles
              .slice(index + 1)
              .every(
                (other) =>
                  rect.x + rect.width <= other.x ||
                  other.x + other.width <= rect.x ||
                  rect.y + rect.height <= other.y ||
                  other.y + other.height <= rect.y,
              ),
          );
        })
        .toBe(true);
      const volume = bubble(page, VOLUME);
      await volume.focus();
      for (let index = 0; index < 30; index++) {
        await volume.press("Shift+ArrowRight");
        await volume.press("Shift+ArrowDown");
      }
      const assertInside = async () => {
        await expect
          .poll(async () => {
            const rect = await box(volume);
            const area = await box(page.locator('[data-component="CenterContent"]'));
            const composer = await box(page.locator("[data-chat-composer]").first());
            return {
              rightOverflow: Math.max(0, rect.x + rect.width - (area.x + area.width)),
              composerOverlap: Math.max(0, rect.y + rect.height - composer.y),
            };
          })
          .toEqual({ rightOverflow: 0, composerOverlap: 0 });
      };
      await assertInside();
      await theme.evaluate((element) => {
        element.textContent = "html { font-size: 26px !important; --mari-window-bubble-size: 4rem; }";
      });
      await expect.poll(async () => (await box(volume)).width).toBeCloseTo(104, 0);
      await assertInside();
    } finally {
      await request.delete(`/api/chats/${gameId}?force=true`);
      await request.delete(`/api/chats/${partnerId}?force=true`);
    }
  });

  test("a never-opened control follows its moved button, then keeps its saved window position", async ({
    page,
    request,
  }) => {
    const { gameId, partnerId } = await createGameWithConnectedChat(request);
    try {
      await prepare(page, gameId);
      await page.goto("/");
      const launcher = bubble(page, VOLUME);
      await expect(launcher).toBeVisible();
      await dragBubble(page, launcher, { x: 680, y: 220 });
      const placed = await box(launcher);
      await expect
        .poll(async () => (await savedWindowLayout(request, gameId))?.bubbles?.[VOLUME])
        .toEqual({
          x: placed.x,
          y: placed.y,
        });
      expect((await savedWindowLayout(request, gameId))?.windows[VOLUME]).toBeUndefined();
      await page.reload();
      await expect(launcher).toBeVisible();
      await launcher.click();
      const volume = controlWindow(page, VOLUME);
      await expect.poll(async () => (await box(volume)).y).toBeCloseTo(placed.y + placed.height + 8, 0);
      const opened = await box(volume);
      expect(opened.x + opened.width).toBeCloseTo(placed.x + placed.width, 0);
      await volume.locator('[data-window-control="close"]').click();
      await dragBubble(page, launcher, { x: placed.x - 200, y: placed.y + 100 });
      await launcher.click();
      await expect.poll(async () => (await box(volume)).y).toBeCloseTo(opened.y, 0);
      const reopened = await box(volume);
      expect(reopened.x).toBeCloseTo(opened.x, 0);
      expect(reopened.width).toBeCloseTo(opened.width, 0);
      expect(reopened.height).toBeCloseTo(opened.height, 0);
    } finally {
      await request.delete(`/api/chats/${gameId}?force=true`);
      await request.delete(`/api/chats/${partnerId}?force=true`);
    }
  });

  test("controls minimize to bubbles that drag, snap, restore and stay with the chat", async ({
    page,
    request,
  }, testInfo) => {
    const { gameId, partnerId } = await createGameWithConnectedChat(request);
    try {
      await prepare(page, gameId);
      await page.goto("/");
      const game = page.locator('[data-chat-mode="game"]');
      await expect(game).toBeVisible({ timeout: 30_000 });

      // Every control starts as a bubble in a row at the top right, where its button was.
      const ids = [GAME_CONTROLS, SESSION, VOLUME, ASSETS, CONNECTED];
      for (const id of ids) {
        await expect(bubble(page, id)).toBeVisible();
        await expect(bubble(page, id)).toHaveAttribute("data-minimized", "true");
      }
      const row = await Promise.all(ids.map((id) => box(bubble(page, id))));
      for (const rect of row) expect(Math.abs(rect.y - row[0]!.y)).toBeLessThanOrEqual(1);
      expect(row.map((rect) => rect.x)).toEqual([...row.map((rect) => rect.x)].sort((a, b) => a - b));
      // The old buttons are gone from the chat's top right.
      await expect(game.locator('[data-tour="game-controls"] button').filter({ visible: true })).toHaveCount(0);
      await expect(bubble(page, VOLUME)).toHaveAccessibleName("Open Volume");
      await expect(bubble(page, VOLUME)).toHaveAttribute("title", "Click to open Volume, or drag to move this button.");

      // Custom themes restyle bubbles through the shared class and --mari-window-bubble-* variables.
      await page.addStyleTag({ content: ":root { --mari-window-bubble-bg: rgb(255, 0, 0); }" });
      await expect(bubble(page, VOLUME)).toHaveCSS("background-color", "rgb(255, 0, 0)");

      // Clicking a bubble opens its window beside it; Close sends it back, with focus on the bubble.
      await bubble(page, VOLUME).click();
      const volume = controlWindow(page, VOLUME);
      await expect(volume).toBeVisible();
      await expect(volume.getByRole("slider").first()).toBeVisible();
      await expect(bubble(page, VOLUME)).toHaveCount(0);
      const controls = await volume
        .locator("[data-window-control]")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-window-control")));
      expect(controls).toEqual(["pin", "lock", "put-back", "close"]);
      await volume.locator('[data-window-control="close"]').click();
      await expect(volume).toHaveCount(0);
      await expect(bubble(page, VOLUME)).toBeFocused();
      // Enter opens it again; an unpinned window goes back to its bubble on a press elsewhere.
      await page.keyboard.press("Enter");
      await expect(volume).toBeVisible();
      await page.locator("[data-chat-mode='game']").click({ position: { x: 300, y: 400 } });
      await expect(volume).toHaveCount(0);
      await expect(bubble(page, VOLUME)).toBeVisible();

      // Dragging places a bubble anywhere; a short press still opens it.
      const start = await box(bubble(page, VOLUME));
      const placed = { x: start.x - 400, y: start.y + 260 };
      await dragBubble(page, bubble(page, VOLUME), placed);
      await expect(controlWindow(page, VOLUME)).toHaveCount(0);
      let moved = await box(bubble(page, VOLUME));
      expect(Math.abs(moved.x - placed.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(moved.y - placed.y)).toBeLessThanOrEqual(1);

      // Near another bubble it snaps: centres in line (a guide shows while it holds), and side by side a
      // steady 8px gap.
      await dragBubble(page, bubble(page, SESSION), { x: moved.x + 5, y: moved.y + 120 }, { hold: true });
      await expect(page.locator('.mari-window-snap-guide[data-axis="x"]')).toBeVisible();
      await page.mouse.up();
      await expect(page.locator(".mari-window-snap-guide")).toHaveCount(0);
      const session = await box(bubble(page, SESSION));
      expect(session.x).toBeCloseTo(moved.x, 0);
      expect(session.y).toBeCloseTo(moved.y + 120, 0);

      await dragBubble(page, bubble(page, ASSETS), { x: moved.x + moved.width + 3, y: moved.y - 4 });
      const assets = await box(bubble(page, ASSETS));
      expect(assets.x).toBeCloseTo(moved.x + moved.width + 8, 0);
      expect(assets.y).toBeCloseTo(moved.y, 0);

      // Holding Alt places it freely.
      await page.keyboard.down("Alt");
      await dragBubble(page, bubble(page, ASSETS), { x: moved.x + moved.width + 3, y: moved.y - 4 });
      await page.keyboard.up("Alt");
      const free = await box(bubble(page, ASSETS));
      expect(free.x).toBeCloseTo(moved.x + moved.width + 3, 0);
      expect(free.y).toBeCloseTo(moved.y - 4, 0);

      // Arrow keys move a focused bubble too (no snapping).
      await bubble(page, VOLUME).focus();
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async () => (await box(bubble(page, VOLUME))).x).toBeCloseTo(moved.x - 10, 0);
      moved = await box(bubble(page, VOLUME));
      await page.screenshot({ path: testInfo.outputPath("bubbles-placed.png"), animations: "disabled" });

      // Move Game controls and open the connected chat's window; both save with this chat.
      const gameControlsPlace = { x: moved.x, y: moved.y + 220 };
      await dragBubble(page, bubble(page, GAME_CONTROLS), gameControlsPlace);
      const gameControls = await box(bubble(page, GAME_CONTROLS));
      await bubble(page, CONNECTED).click();
      const connected = controlWindow(page, CONNECTED);
      await expect(connected.getByRole("button", { name: /^Switch to/u })).toBeVisible();
      await connected.locator('[data-window-control="pin"]').click();
      await expect
        .poll(async () => {
          const layout = await savedWindowLayout(request, gameId);
          return [
            layout?.bubbles?.[GAME_CONTROLS] ?? null,
            layout?.windows[CONNECTED]?.minimized ?? null,
            layout?.windows[CONNECTED]?.pinned ?? null,
          ];
        })
        .toEqual([{ x: gameControls.x, y: gameControls.y }, false, true]);

      await page.reload();
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
      await expect(controlWindow(page, CONNECTED)).toBeVisible();
      await expect(controlWindow(page, CONNECTED)).toHaveAttribute("data-pinned", "true");
      const reloaded = await box(bubble(page, GAME_CONTROLS));
      expect(reloaded.x).toBeCloseTo(gameControls.x, 0);
      expect(reloaded.y).toBeCloseTo(gameControls.y, 0);
      await bubble(page, GAME_CONTROLS).click();
      await expect(controlWindow(page, GAME_CONTROLS).getByRole("button", { name: "Retry Turn" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("game-controls-window.png"), animations: "disabled" });

      // Reset View puts every bubble back in its row, minimized.
      await openChatSettings(page);
      await resetChatView(page);
      for (const id of ids) await expect(bubble(page, id)).toBeVisible();
      const reset = await box(bubble(page, GAME_CONTROLS));
      expect(Math.abs(reset.y - row[0]!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(reset.x - row[0]!.x)).toBeLessThanOrEqual(1);
    } finally {
      await request.delete(`/api/chats/${gameId}?force=true`);
      await request.delete(`/api/chats/${partnerId}?force=true`);
    }
  });
});

test("Game controls dock as usable Settings sections, persist and pop out again", async ({
  page,
  request,
}, testInfo) => {
  const { gameId, partnerId } = await createGameWithConnectedChat(request);
  const desktop = testInfo.project.name.includes("desktop");
  const ids = [SESSION, VOLUME, ASSETS, GAME_CONTROLS];
  try {
    await prepare(page, gameId);
    await page.goto("/");
    const settings = page.locator('[data-window="chat-settings"]');
    for (const id of ids) {
      await openChatTool(page, id);
      await controlWindow(page, id).getByRole("button", { name: "Put back in Chat Settings", exact: true }).click();
      await expect(settings.locator(`[data-docked-chat-control="${id}"]`)).toBeVisible();
      await expect(controlWindow(page, id)).toHaveCount(0);
      await expect(bubble(page, id)).toHaveCount(0);
      await settings.locator('[data-window-control="close"]').click();
    }
    await expect
      .poll(async () => {
        const layout = await savedWindowLayout(request, gameId);
        return ids.map((id) => layout?.windows[id]?.docked);
      })
      .toEqual([true, true, true, true]);
    await page.reload();
    await openChatSettings(page);
    const volumeSection = settings.locator(`[data-docked-chat-control="${VOLUME}"]`);
    await expect(
      settings.locator(`[data-docked-chat-control="${SESSION}"]`).getByRole("button", { name: "Journal", exact: true }),
    ).toBeVisible();
    await expect(
      settings
        .locator(`[data-docked-chat-control="${ASSETS}"]`)
        .getByRole("button", { name: "Generate background", exact: true }),
    ).toBeVisible();
    await expect(
      settings
        .locator(`[data-docked-chat-control="${GAME_CONTROLS}"]`)
        .getByRole("button", { name: "Retry turn", exact: true }),
    ).toBeVisible();
    const master = volumeSection.getByRole("slider").first();
    await master.press("End");
    await expect(master).toHaveValue("100");
    await volumeSection.getByRole("button", { name: "Open Volume in its own window", exact: true }).click();
    if (!desktop) await openChatTool(page, VOLUME);
    const volume = controlWindow(page, VOLUME);
    await expect(volume.getByRole("slider").first()).toHaveValue("100");
    await expect(volumeSection).toHaveCount(0);

    if (desktop) {
      await openChatSettings(page);
      await settings.locator('[data-window-control="pin"]').click();
      const target = await box(settings);
      const header = await box(volume.locator(".mari-window__header"));
      await page.mouse.move(header.x + 60, header.y + header.height / 2);
      await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + 100, { steps: 12 });
      await expect(settings).toHaveAttribute("data-drop-target", "true");
      await page.mouse.up();
      await expect(volumeSection).toBeVisible();
      await expect(volume).toHaveCount(0);
      await volumeSection.scrollIntoViewIfNeeded();
      const drawerHeader = await box(volumeSection.locator(".mari-drawer__header"));
      await page.mouse.move(drawerHeader.x + 60, drawerHeader.y + drawerHeader.height / 2);
      await page.mouse.down();
      await page.mouse.move(target.x - 80, drawerHeader.y + drawerHeader.height / 2, { steps: 12 });
      await page.mouse.up();
      await expect(volume).toBeVisible();
      await expect(volumeSection).toHaveCount(0);
    }
    await expect.poll(async () => (await savedWindowLayout(request, gameId))?.windows[VOLUME]?.docked).toBe(false);
    if (!desktop) {
      await volume.locator('[data-window-control="close"]').click();
      await expect(volume).toBeHidden();
    }
    await openChatSettings(page);
    await resetChatView(page);
    await settings.locator('[data-window-control="close"]').click();
    if (desktop) {
      for (const id of ids) await expect(bubble(page, id)).toBeVisible();
    } else {
      await page.locator("[data-chat-tools-menu-button]").click();
      for (const id of ids) await expect(page.locator(`[data-chat-tools-menu-item="${id}"]`)).toBeVisible();
    }
    await page.screenshot({
      path: testInfo.outputPath("game-controls-docked-and-restored.png"),
      animations: "disabled",
    });
  } finally {
    await request.delete(`/api/chats/${gameId}?force=true`);
    await request.delete(`/api/chats/${partnerId}?force=true`);
  }
});

test("phone docking and pop-out preserve a control's desktop geometry, pin and lock", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("desktop"), "Phone sheets keep the desktop layout unchanged.");
  const { gameId, partnerId } = await createGameWithConnectedChat(request);
  const desktopLayout = { x: 460, y: 180, width: 330, height: 290, pinned: true, locked: true, minimized: false };
  try {
    expect(
      (
        await request.patch(`/api/chats/${gameId}/metadata`, {
          data: { windowLayout: { version: 1, windows: { [VOLUME]: desktopLayout } } },
        })
      ).ok(),
    ).toBeTruthy();
    await prepare(page, gameId);
    await page.goto("/");
    await openChatTool(page, VOLUME);
    await controlWindow(page, VOLUME).getByRole("button", { name: "Put back in Chat Settings", exact: true }).click();
    const section = page.locator(`[data-docked-chat-control="${VOLUME}"]`);
    await section.getByRole("button", { name: "Open Volume in its own window", exact: true }).click();
    await expect(page.locator("[data-chat-tools-menu-button]")).toBeVisible();
    await expect
      .poll(async () => (await savedWindowLayout(request, gameId))?.windows[VOLUME])
      .toEqual({
        ...desktopLayout,
        docked: false,
      });
    await openChatTool(page, VOLUME);
    await expect(controlWindow(page, VOLUME).getByRole("slider").first()).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${gameId}?force=true`);
    await request.delete(`/api/chats/${partnerId}?force=true`);
  }
});

test("Game Character Profiles stays separate, movable and locked across reload with its character content", async ({
  page,
  request,
}, info) => {
  const desktop = info.project.name.includes("desktop");
  const { gameId, partnerId } = await createGameWithConnectedChat(request);
  const response = await request.post("/api/characters", {
    data: { data: { name: "Aster", description: "A patient scout." } },
  });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  const id = "control:character-profiles";
  try {
    expect((await request.patch(`/api/chats/${gameId}`, { data: { characterIds: [character.id] } })).ok()).toBeTruthy();
    expect(
      (
        await request.patch(`/api/chats/${gameId}/metadata`, {
          data: {
            windowLayout: null,
            enableAgents: false,
            gamePartyCharacterIds: [character.id],
            gameCharacterCards: [
              {
                name: "Aster",
                shortDescription: "A patient scout.",
                class: "Scout",
                abilities: [],
                strengths: [],
                weaknesses: [],
                extra: {},
              },
            ],
          },
        })
      ).ok(),
    ).toBeTruthy();
    await prepare(page, gameId, {
      theme: "light",
      chatWidgetPreset: "mari",
      chatWidgetApplyFont: false,
      chatWidgetApplyShape: false,
      chatWidgetApplyColors: false,
    });
    await page.goto("/");
    const launcher = bubble(page, id);
    await expect(launcher).toHaveCount(1);
    await expect(launcher).toBeVisible();
    if (!desktop) {
      await page.locator("[data-chat-tools-menu-button]").click();
      await expect(page.locator(`[data-chat-tools-menu-item="${id}"]`)).toHaveCount(0);
      await page.locator("[data-chat-tools-menu-button]").click();
    }
    await dragBubble(page, launcher, { x: 100, y: 200 });
    const placed = await box(launcher);
    const pointMap = desktop ? "bubbles" : "phoneBubbles";
    await expect
      .poll(async () => (await savedWindowLayout(request, gameId))?.[pointMap]?.[id])
      .toEqual({ x: placed.x, y: placed.y });
    await launcher.click();
    const window = controlWindow(page, id);
    await expect(window).toHaveAttribute("data-presentation", desktop ? "window" : "sheet");
    await expect(window.locator(".mari-window__title")).toHaveCSS("font-family", /serif/);
    const portrait = window.getByTitle("Aster - Click to open character sheet", { exact: true });
    await expect(portrait).toBeVisible();
    if (desktop) {
      const original = await box(window);
      const header = await box(window.locator(".mari-window__title"));
      await page.mouse.move(header.x + 40, header.y + header.height / 2);
      await page.mouse.down();
      await page.mouse.move(header.x + 120, header.y + header.height / 2 + 40, { steps: 10 });
      await page.mouse.up();
      await expect.poll(async () => (await box(window)).x).toBeGreaterThan(original.x + 60);
    }
    await portrait.click();
    const editor = page.locator('[data-component="GameCharacterSheet"]');
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("heading", { name: "Aster", exact: true })).toBeVisible();
    await expect(editor.getByText("Scout", { exact: true }).first()).toBeVisible();
    await editor.getByRole("button", { name: "Close character sheet", exact: true }).click();
    if (!(await window.isVisible())) await launcher.click();
    await window.locator('[data-window-control="lock"]').click();
    await expect(window.locator('[data-window-control="lock"]')).toHaveAttribute("aria-pressed", "true");
    const path = info.outputPath("game-character-profiles-window.png");
    await page.screenshot({ path, animations: "disabled" });
    await info.attach("Movable Character Profiles", { path, contentType: "image/png" });
    await window.locator('[data-window-control="close"]').click();
    await expect(launcher).toHaveAttribute("data-locked", "true");
    await launcher.focus();
    await launcher.press("Shift+ArrowDown");
    expect(await box(launcher)).toEqual(placed);
    await expect
      .poll(async () => (await savedWindowLayout(request, gameId))?.windows[id])
      .toMatchObject({ locked: true });
    await page.reload();
    await expect(launcher).toHaveAttribute("data-locked", "true");
    expect(await box(launcher)).toEqual(placed);
    await launcher.click();
    await expect(portrait).toBeVisible();
    await window.locator('[data-window-control="lock"]').click();
    await window.locator('[data-window-control="close"]').click();
    await launcher.focus();
    await launcher.press("ArrowDown");
    expect((await box(launcher)).y).toBeCloseTo(placed.y + 10, 0);
  } finally {
    await request.delete(`/api/chats/${gameId}?force=true`);
    await request.delete(`/api/chats/${partnerId}?force=true`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
