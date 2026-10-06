// #7034 step 6: on phones, Chat Settings opens from its button in the chat, and popped-out drawers, the chat's controls
// share a movable Chat tools menu; tracker buttons remain separate. Each tool opens as a sheet. On a computer,
// package toolbars and Beholder become control windows, and a dot shows while agents run.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openChatTool } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const CHAT_NAME_DRAWER = "drawer:chat-settings:chat-name";
const TOOLS_MENU = "chat-tools-menu";
const CONNECTED = "control:connected-chat";
const GAME_CONTROLS = ["control:game", "control:session", "control:volume", "control:assets", CONNECTED];

type Box = { x: number; y: number; width: number; height: number };
type SavedLayout = {
  windows: Record<string, unknown>;
  detached?: string[];
  phoneMenu?: { locked: boolean; order: string[] };
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
    partnerId: cleanup[1],
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

async function sharedBubbleShape(page: Page) {
  return page.evaluate(() => {
    // Resolve inherited shape tokens outside the menu so a menu-specific override
    // cannot make the expected shape agree with the same broken declaration.
    const probe = document.createElement("span");
    probe.style.borderRadius =
      "var(--mari-window-bubble-radius, var(--mari-widget-bubble-radius, calc(var(--radius) + 0.125rem)))";
    probe.style.clipPath = "var(--mari-widget-button-clip, none)";
    document.body.append(probe);
    const radius = getComputedStyle(probe).borderRadius;
    const clip = getComputedStyle(probe).clipPath;
    probe.style.clipPath = "var(--mari-widget-button-inner-clip, none)";
    const innerClip = getComputedStyle(probe).clipPath;
    probe.remove();
    return { radius, clip, innerClip };
  });
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

  test("phone Chat tools expands themed buttons that stay reachable, movable, reorderable and locked per chat", async ({
    page,
    request,
  }, testInfo) => {
    const oldPoint = { x: 24, y: 250 };
    const chat = await createChat(
      request,
      "roleplay",
      {
        windowLayout: { version: 1, windows: {}, phoneBubbles: { [CONNECTED]: oldPoint } },
      },
      { connected: true },
    );
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      const launcher = bubble(page, TOOLS_MENU);
      await expect(launcher).toBeVisible();
      await expect(launcher).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("[data-chat-tools-menu]")).toHaveCount(0);
      await expect(bubble(page, CONNECTED)).toHaveCount(0);
      const settings = await openSettingsSheet(page);
      // A menu launcher shares the chat stacking context, beneath the active Settings sheet.
      const close = settings.locator('[data-window-control="close"]');
      expect(
        await close.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit === element || element.contains(hit);
        }),
      ).toBe(true);
      expect(
        await launcher.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit?.closest(".mari-window")?.getAttribute("data-window");
        }),
      ).toBe("chat-settings");
      await settings.locator('[data-drawer$="chat-name"] [data-drawer-control="pop-out"]').click();
      await expect(settings).toBeHidden();
      await expect(bubble(page, CHAT_NAME_DRAWER)).toHaveCount(0);
      await launcher.click();
      const menu = page.locator("[data-chat-tools-menu]");
      const rows = menu.locator("[data-chat-tools-menu-item]");
      await expect(rows).toHaveCount(2);
      await expect(menu).not.toHaveClass(/mari-window/);
      await expect(menu).toHaveAttribute("role", "group");
      await expect(menu.locator(".mari-drawer")).toHaveCount(0);
      for (const button of await menu.locator("button").all()) {
        const bounds = await box(button);
        expect(bounds.width).toBe(bounds.height);
        await expect(button).toHaveCSS("border-radius", (await sharedBubbleShape(page)).radius);
        await expect(button).toHaveAccessibleName(/.+/);
      }
      await page.screenshot({ path: testInfo.outputPath("themed-tools-default.png"), animations: "disabled" });
      const order = () =>
        rows.evaluateAll((items) => items.map((item) => item.getAttribute("data-chat-tools-menu-item")!));
      const initial = await order();
      const secondHandle = menu.locator(`[data-chat-tools-menu-tool="${initial[1]}"]`);
      await secondHandle.press("ArrowUp");
      await expect.poll(order).toEqual([...initial].reverse());
      await expect(rows.first()).toHaveAttribute("aria-posinset", "1");
      // Drag the tool button itself; ending that gesture must not open its tool.
      const dragHandle = menu.locator(`[data-chat-tools-menu-tool="${initial[1]}"]`);
      // Framer animates the keyboard reorder; use actionability before measuring its new position.
      await dragHandle.hover();
      const handleBox = await box(dragHandle);
      const lastBox = await box(rows.last());
      const start = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };
      const end = { x: lastBox.x + lastBox.width - 20, y: lastBox.y + lastBox.height - 4 };
      if (testInfo.project.name.includes("chromium")) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
        for (let step = 1; step <= 12; step++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              {
                x: start.x + ((end.x - start.x) * step) / 12,
                y: start.y + ((end.y - start.y) * step) / 12,
              },
            ],
          });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        try {
          await page.mouse.move(end.x, end.y, { steps: 12 });
          // WebKit may deliver all moves within one frame; keep the real drag active
          // until Framer has applied its pointer update, then verify the released order.
          await expect.poll(order).toEqual(initial);
        } finally {
          await page.mouse.up();
        }
      }
      await expect.poll(order).toEqual(initial);
      await expect(menu).toBeVisible();
      await expect(sheet(page, initial[1]!)).toHaveCount(0);
      // The expanded stack follows its trigger; its own buttons are not snap targets.
      const lastTool = menu.locator("[data-chat-tools-menu-tool]").last();
      await lastTool.hover();
      const lastToolBox = await box(lastTool);
      const triggerBeforeDrag = await box(launcher);
      // WebKit delivers pointer coordinates in whole CSS pixels, even when a
      // Framer layout animation left the preceding tool at a fractional pixel.
      const drop = { x: triggerBeforeDrag.x, y: Math.round(lastToolBox.y + lastToolBox.height + 12) };
      await dragBubble(page, launcher, drop);
      expect((await box(launcher)).y).toBeCloseTo(drop.y, 0);
      await expect(menu).toBeVisible();
      await launcher.focus();
      await launcher.press("ArrowDown");
      const placed = await box(launcher);
      const movedMenu = await box(menu);
      expect(movedMenu.y).toBeGreaterThanOrEqual(placed.y + placed.height);
      const lock = menu.locator('[data-window-control="lock"]');
      await lock.click();
      await expect(lock).toHaveAttribute("aria-pressed", "true");
      await expect(menu.locator("[data-chat-tools-menu-tool]").first()).toHaveAttribute("data-locked", "true");
      await menu.locator("[data-chat-tools-menu-tool]").last().press("ArrowUp");
      await expect.poll(order).toEqual(initial);
      // A locked tool must not hand its reorder keys to the chat's edit-message shortcut.
      await expect(page.locator("[data-chat-message-editor]")).toHaveCount(0);
      await launcher.focus();
      await launcher.press("ArrowDown");
      expect(await box(launcher)).toEqual(placed);
      await page.screenshot({ path: testInfo.outputPath("phone-tools-menu.png"), animations: "disabled" });
      await testInfo.attach("Reordered locked phone Chat tools", {
        path: testInfo.outputPath("phone-tools-menu.png"),
        contentType: "image/png",
      });
      await launcher.click();
      const drawerSheet = await openChatTool(page, CHAT_NAME_DRAWER);
      await expect(drawerSheet).toHaveAttribute("data-presentation", "sheet");
      await drawerSheet.getByRole("button", { name: "Phone roleplay", exact: true }).click();
      await drawerSheet.getByRole("textbox").fill("Renamed through Chat tools");
      await drawerSheet.getByRole("textbox").press("Enter");
      await drawerSheet.locator('[data-window-control="close"]').click();
      await expect(launcher).toBeFocused();
      await expect
        .poll(async () => {
          const saved = await readSavedLayout(request, chat.id);
          return {
            menu: saved?.phoneMenu,
            point: saved?.phoneBubbles?.[TOOLS_MENU],
            old: saved?.phoneBubbles?.[CONNECTED],
          };
        })
        .toEqual({ menu: { locked: true, order: initial }, point: { x: placed.x, y: placed.y }, old: oldPoint });
      await page.reload();
      await expect(launcher).toBeVisible();
      await expect(menu).toHaveCount(0);
      expect(await box(launcher)).toEqual(placed);
      await launcher.click();
      await expect(menu).toHaveAttribute("data-locked", "true");
      await expect.poll(order).toEqual(initial);
      await menu.locator(`[data-chat-tools-menu-tool="${CHAT_NAME_DRAWER}"]`).click();
      await expect(drawerSheet.getByRole("button", { name: "Renamed through Chat tools", exact: true })).toBeVisible();
      await drawerSheet.getByRole("button", { name: "Put back in Chat Settings" }).click();
      await expect.poll(async () => (await readSavedLayout(request, chat.id))?.detached ?? []).toEqual([]);
      await launcher.click();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toHaveAttribute("data-chat-tools-menu-item", CONNECTED);
      await launcher.click();
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setActiveChatId(id);
      }, chat.partnerId!);
      await expect(page.locator('[data-chat-mode="conversation"]')).toBeVisible();
      await expect(launcher).toHaveAttribute("data-locked", "false");
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setActiveChatId(id);
      }, chat.id);
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
      await expect(launcher).toHaveAttribute("data-locked", "true");
    } finally {
      await chat.remove();
    }
  });

  for (const theme of ["dark", "light"] as const) {
    test(`phone Chat tools follows every preset and shape override with gradient paint in ${theme} mode`, async ({
      page,
      request,
    }, testInfo) => {
      const chat = await createChat(request, "game", {}, { connected: true });
      try {
        await prepare(page, chat.id, { theme, appAccentPulseMode: false });
        await page.goto("/");
        await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
        const launcher = bubble(page, TOOLS_MENU);
        await launcher.click();
        const menu = page.locator("[data-chat-tools-menu]");
        await expect(menu.locator("[data-chat-tools-menu-tool]")).toHaveCount(GAME_CONTROLS.length);
        const buttons = page.locator("[data-chat-tools-menu-button], [data-chat-tools-menu] button");
        await expect(buttons).toHaveCount(GAME_CONTROLS.length + 2);
        for (const [preset, shape] of [
          ["default", "preset"],
          ["dottore", "preset"],
          ["mari", "preset"],
          ["dottore", "rounded"],
          ["mari", "square"],
          ["mari", "cut-corner"],
          ["dottore", "arched"],
        ] as const) {
          for (const gradient of [false, true]) {
            await test.step(`${preset}/${shape}, ${gradient ? "custom gradients" : "preset colors"}`, async () => {
              await page.evaluate(
                async ({ preset, shape, gradient }) => {
                  const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
                  useUIStore.setState({
                    chatWidgetPreset: preset,
                    chatWidgetShape: shape,
                    chatWidgetBorderColor: gradient ? "linear-gradient(90deg, #cca077, #88ccdd)" : "",
                    chatWidgetBackgroundColor: gradient ? "linear-gradient(135deg, #202838, #384050)" : "",
                  });
                },
                { preset, shape, gradient },
              );
              const resolvedShape =
                shape !== "preset" ? shape : preset === "dottore" ? "cut-corner" : preset === "mari" ? "arched" : null;
              if (resolvedShape)
                await expect(page.locator("html")).toHaveAttribute("data-chat-widget-shape", resolvedShape);
              else await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-shape");
              if (gradient) await expect(page.locator("html")).toHaveAttribute("data-chat-widget-colors", /border/);
              else await expect(page.locator("html")).not.toHaveAttribute("data-chat-widget-colors");
              const expected = await sharedBubbleShape(page);
              if (resolvedShape === "cut-corner") expect(expected.clip).toContain("polygon(");
              for (const button of await buttons.all()) {
                await expect(button).toHaveCSS("border-radius", expected.radius);
                const paint = await button.evaluate((element, gradient) => {
                  const frame = gradient ? element.querySelector(".mari-window-bubble__paint")! : element;
                  const outer = getComputedStyle(frame, gradient ? null : "::after");
                  const inner = getComputedStyle(frame, "::after");
                  return {
                    clip: outer.clipPath,
                    innerClip: inner.clipPath,
                    border: outer.backgroundImage,
                    background: inner.backgroundImage,
                  };
                }, gradient);
                expect(paint.clip).toBe(expected.clip);
                if (gradient) {
                  expect(paint.innerClip).toBe(expected.innerClip);
                  expect(paint.border).toContain("linear-gradient");
                  expect(paint.background).toContain("linear-gradient");
                }
              }
              await expectComposerClearAndNoSideScroll(page);
              await page.screenshot({
                path: testInfo.outputPath(`tools-${preset}-${shape}-${theme}-${gradient ? "gradient" : "preset"}.png`),
                animations: "disabled",
              });
            });
          }
        }
      } finally {
        await chat.remove();
      }
    });
  }

  test("holding a phone tool reorders five tools, saves after reload and respects locking", async ({
    page,
    request,
  }, testInfo) => {
    const nativeTouch = testInfo.project.name.includes("chromium");
    testInfo.annotations.push({
      type: "input",
      description: nativeTouch ? "Native Chromium CDP touch" : "WebKit real mouse fallback; not native iOS touch",
    });
    const chat = await createChat(request, "game", {}, { connected: true });
    const cdp = nativeTouch ? await page.context().newCDPSession(page) : null;
    try {
      await prepare(page, chat.id, { chatWidgetPreset: "dottore" });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
      const launcher = bubble(page, TOOLS_MENU);
      await launcher.click();
      const menu = page.locator("[data-chat-tools-menu]");
      const rows = menu.locator("[data-chat-tools-menu-item]");
      await expect(rows).toHaveCount(GAME_CONTROLS.length);
      const order = () =>
        rows.evaluateAll((items) => items.map((item) => item.getAttribute("data-chat-tools-menu-item")!));
      const initial = await order();
      const movedId = initial.at(-1)!;
      const reordered = [movedId, ...initial.slice(0, -1)];
      const movedTool = menu.locator(`[data-chat-tools-menu-tool="${movedId}"]`);
      const heldDrag = async (target: Locator, destination: Locator, expected: string[]) => {
        await target.hover();
        const icon = await box(target.locator("svg").first());
        const to = await box(destination);
        const start = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 };
        const end = { x: to.x + to.width / 2, y: to.y + 8 };
        if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
        else {
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
        }
        try {
          // Keep the pointer down before moving to exercise the reported held-drag path.
          await page.waitForTimeout(600);
          for (let step = 1; step <= 16; step++) {
            const point = {
              x: start.x + ((end.x - start.x) * step) / 16,
              y: start.y + ((end.y - start.y) * step) / 16,
            };
            if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
            else await page.mouse.move(point.x, point.y);
            await page.waitForTimeout(16);
          }
          await expect.poll(order).toEqual(expected);
        } finally {
          if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          else await page.mouse.up();
        }
      };
      await heldDrag(movedTool, rows.first(), reordered);
      await expect.poll(order).toEqual(reordered);
      await expect(menu).toBeVisible();
      await expect(sheet(page, movedId)).toHaveCount(0);
      await expect.poll(async () => (await readSavedLayout(request, chat.id))?.phoneMenu?.order).toEqual(reordered);
      await page.reload();
      await expect(launcher).toBeVisible();
      await launcher.click();
      await expect.poll(order).toEqual(reordered);
      const lock = menu.locator('[data-window-control="lock"]');
      await lock.click();
      await expect(lock).toHaveAttribute("aria-pressed", "true");
      await heldDrag(menu.locator("[data-chat-tools-menu-tool]").last(), rows.first(), reordered);
      await expect.poll(order).toEqual(reordered);
      await expect(menu).toBeVisible();
      await expect
        .poll(async () => (await readSavedLayout(request, chat.id))?.phoneMenu)
        .toEqual({ locked: true, order: reordered });
      await page.screenshot({
        path: testInfo.outputPath("held-tools-reordered-and-locked.png"),
        animations: "disabled",
      });
      // A deliberate next tap must open immediately, even if the browser omitted the drag-release click.
      if (cdp) {
        const target = await box(movedTool.locator("svg").first());
        const point = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else await movedTool.click();
      await expect(sheet(page, movedId)).toBeVisible();
      await expect(menu).toHaveCount(0);
    } finally {
      await cdp?.detach();
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
      const target = bubble(page, TOOLS_MENU);
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
      await expect(page.locator("[data-chat-tools-menu]")).toBeVisible();
      await bubble(page, TOOLS_MENU).click();
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
      await expect(page.locator("[data-chat-tools-menu]")).toHaveCount(0);
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
      await expect(page.locator("[data-chat-tools-menu]")).toBeVisible();
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
        trackerPanelHideHudWidgets: false,
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
      await expect(trackerBubble).toHaveAccessibleName("Open Trackers");
      await expect(panel).toHaveCount(0);
      await expectComposerClearAndNoSideScroll(page);

      await trackerBubble.click();
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("button", { name: "Close Tracker Panel" })).toBeVisible();
      await expect.poll(async () => Math.abs((await box(panel)).x)).toBeLessThan(1);
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

  test("Game Map stays a separate themed movable button and keeps its lock and position", async ({
    page,
    request,
  }, info) => {
    const chat = await createChat(request, "game", { windowLayout: null, enableAgents: false });
    const id = "control:map";
    try {
      await prepare(page, chat.id, {
        theme: "dark",
        chatWidgetPreset: "dottore",
        chatWidgetBorderColor: "#ccaa77",
        chatWidgetBackgroundColor: "#112233",
        chatWidgetTextColor: "#e6efff",
        chatWidgetApplyFont: false,
        chatWidgetApplyShape: false,
        chatWidgetApplyColors: false,
      });
      await page.goto("/");
      const launcher = bubble(page, id);
      await expect(launcher).toHaveCount(1);
      await expect(launcher).toHaveAccessibleName("Open Map");
      for (const role of ["font", "shape", "colors"])
        await expect(page.locator("html")).not.toHaveAttribute(`data-chat-widget-apply-${role}`);
      await expect(launcher.locator("svg")).toHaveCSS("color", "rgb(204, 170, 119)");
      await bubble(page, TOOLS_MENU).click();
      await expect(page.locator(`[data-chat-tools-menu-item="${id}"]`)).toHaveCount(0);
      await bubble(page, TOOLS_MENU).click();
      await dragBubble(page, launcher, { x: 90, y: 200 });
      const placed = await box(launcher);
      await expect
        .poll(async () => (await readSavedLayout(request, chat.id))?.phoneBubbles?.[id])
        .toEqual({ x: placed.x, y: placed.y });
      await launcher.click();
      const window = sheet(page, id);
      await expect(window).toHaveAttribute("data-presentation", "sheet");
      await expect(window.locator(".mari-window__title")).toHaveCSS("font-family", /monospace/);
      await expect(window.getByText("No local map yet", { exact: true })).toBeVisible();
      await expect(window.getByRole("button", { name: "Generate", exact: true })).toBeVisible();
      await window.locator('[data-window-control="lock"]').click();
      await expect(window.locator('[data-window-control="lock"]')).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: info.outputPath("game-map-phone-sheet.png"), animations: "disabled" });
      await window.locator('[data-window-control="close"]').click();
      await expect(launcher).toBeFocused();
      await launcher.press("Shift+ArrowDown");
      expect(await box(launcher)).toEqual(placed);
      await dragBubble(page, launcher, { x: 180, y: 320 });
      expect(await box(launcher)).toEqual(placed);
      // A locked click remains usable even though the drag gesture cannot move it.
      if (await window.isVisible()) await window.locator('[data-window-control="close"]').click();
      await expect
        .poll(async () => (await readSavedLayout(request, chat.id))?.windows[id])
        .toMatchObject({ locked: true });
      await page.reload();
      await expect(launcher).toHaveAttribute("data-locked", "true");
      expect(await box(launcher)).toEqual(placed);
      await launcher.click();
      await expect(window.getByText("No local map yet", { exact: true })).toBeVisible();
      await window.locator('[data-window-control="lock"]').click();
      await window.locator('[data-window-control="close"]').click();
      await launcher.focus();
      await launcher.press("ArrowDown");
      expect((await box(launcher)).y).toBeCloseTo(placed.y + 10, 0);
    } finally {
      await chat.remove();
    }
  });

  test("Game's controls share a vertical Chat tools menu and open usable sheets", async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, "game", {}, { connected: true });
    try {
      await prepare(page, chat.id);
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
      const launcher = bubble(page, TOOLS_MENU);
      await expect(launcher).toBeVisible();
      for (const id of GAME_CONTROLS) await expect(bubble(page, id)).toHaveCount(0);
      await launcher.click();
      const menu = page.locator("[data-chat-tools-menu]");
      const rows = menu.locator("[data-chat-tools-menu-item]");
      await expect(rows).toHaveCount(GAME_CONTROLS.length);
      const rects = await Promise.all((await rows.all()).map(box));
      for (let i = 1; i < rects.length; i++)
        expect(rects[i]!.y).toBeGreaterThanOrEqual(rects[i - 1]!.y + rects[i - 1]!.height - 1);
      await expectComposerClearAndNoSideScroll(page);
      await page.screenshot({ path: testInfo.outputPath("game-tools-menu.png"), animations: "disabled" });
      const viewport = page.viewportSize()!;
      const opens: Array<[string, (window: Locator) => Locator]> = [
        ["control:game", (window) => window.getByRole("button", { name: "Retry Turn" })],
        ["control:session", (window) => window.getByRole("button", { name: /history/iu }).first()],
        ["control:volume", (window) => window.getByRole("slider").first()],
        ["control:assets", (window) => window.getByRole("button", { name: "Generate background", exact: true })],
        [CONNECTED, (window) => window.getByRole("button", { name: /^Switch to/u })],
      ];
      for (const [id, content] of opens) {
        await openChatTool(page, id);
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
        await expect(launcher).toBeFocused();
      }
    } finally {
      await chat.remove();
    }
  });

  test("edge-docked phone Chat tools stay centered above and below their launcher", async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, "game", {}, { connected: true });
    try {
      await prepare(page, chat.id, { appAccentPulseMode: false });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
      const launcher = bubble(page, TOOLS_MENU);
      const menu = page.locator("[data-chat-tools-menu]");
      const viewport = page.viewportSize()!;
      for (const [preset, size] of [
        ["dottore", null],
        ["mari", 96],
      ] as const) {
        await page.evaluate(
          async ({ preset, size }) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            useUIStore.setState({ chatWidgetPreset: preset, chatWidgetButtonSize: size });
          },
          { preset, size },
        );
        await expect(launcher).toHaveCSS("width", `${size ?? 36}px`);
        for (const edge of ["right", "left"] as const) {
          for (const direction of ["below", "above"] as const) {
            await dragBubble(page, launcher, {
              x: edge === "left" ? -100 : viewport.width + 100,
              y: direction === "below" ? 130 : viewport.height + 100,
            });
            await launcher.click();
            await expect(menu.locator("[data-chat-tools-menu-tool]")).toHaveCount(GAME_CONTROLS.length);
            const visibleGaps = await menu.evaluate((element) => {
              const scroller = element.querySelector("ul")!.getBoundingClientRect();
              const buttons = Array.from(element.querySelectorAll("button"), (button) => ({
                rect: button.getBoundingClientRect(),
                tool: button.hasAttribute("data-chat-tools-menu-tool"),
              }));
              const visible = ({ rect, tool }: (typeof buttons)[number]) =>
                !tool || (rect.top >= scroller.top && rect.bottom <= scroller.bottom);
              return buttons
                .slice(1)
                .flatMap((button, index) =>
                  visible(buttons[index]!) && visible(button) ? [button.rect.top - buttons[index]!.rect.bottom] : [],
                );
            });
            // Reach the full scroll endpoint, including padding after the last button.
            await menu.locator("ul").evaluate((element) => {
              element.scrollTop = element.scrollHeight;
            });
            await page.screenshot({
              path: testInfo.outputPath(`edge-tools-${preset}-${edge}-${direction}.png`),
              animations: "disabled",
            });
            const trigger = await box(launcher);
            const center = trigger.x + trigger.width / 2;
            for (const button of await menu.locator("button").all()) {
              const rect = await box(button);
              expect(Math.abs(rect.x + rect.width / 2 - center)).toBeLessThanOrEqual(1);
              expect(rect.x).toBeGreaterThanOrEqual(0);
              expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
            }
            // Match the 8px spacing of other snapped phone buttons, including the lock-to-first-tool gap.
            expect(visibleGaps.length).toBeGreaterThanOrEqual(2);
            for (const gap of visibleGaps) expect(Math.abs(gap - 8)).toBeLessThanOrEqual(1);
            const expanded = await box(menu);
            if (direction === "below") expect(expanded.y).toBeGreaterThanOrEqual(trigger.y + trigger.height);
            else expect(expanded.y + expanded.height).toBeLessThanOrEqual(trigger.y);
            const nearest = await box(
              direction === "below"
                ? menu.locator('[data-window-control="lock"]')
                : menu.locator("[data-chat-tools-menu-tool]").last(),
            );
            const launcherGap =
              direction === "below" ? nearest.y - trigger.y - trigger.height : trigger.y - nearest.y - nearest.height;
            expect(Math.abs(launcherGap - 8)).toBeLessThanOrEqual(1);
            await expectComposerClearAndNoSideScroll(page);
            await launcher.click();
            await expect(menu).toHaveCount(0);
          }
        }
      }
    } finally {
      await chat.remove();
    }
  });

  test("large themed tools scroll inside a short phone viewport without covering their trigger", async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, "game", {}, { connected: true });
    try {
      await page.setViewportSize({ width: 390, height: 520 });
      await prepare(page, chat.id, { chatWidgetButtonSize: 96, appAccentPulseMode: false });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="game"]')).toBeVisible({ timeout: 30_000 });
      const launcher = bubble(page, TOOLS_MENU);
      await expect(launcher).toHaveCSS("width", "96px");
      await dragBubble(page, launcher, { x: 20, y: 170 });
      for (const [preset, theme] of [
        ["dottore", "dark"],
        ["mari", "light"],
      ] as const) {
        await page.evaluate(
          async ({ preset, theme }) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            useUIStore.setState({
              chatWidgetPreset: preset,
              theme,
              chatWidgetBorderColor: "linear-gradient(90deg, #cca077, #88ccdd)",
              chatWidgetBackgroundColor: "linear-gradient(135deg, #202838, #384050)",
            });
          },
          { preset, theme },
        );
        await launcher.click();
        const menu = page.locator("[data-chat-tools-menu]");
        await expect(menu.locator("[data-chat-tools-menu-tool]")).toHaveCount(GAME_CONTROLS.length);
        const menuBox = await box(menu);
        const triggerBox = await box(launcher);
        expect(menuBox.x).toBeGreaterThanOrEqual(0);
        expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
        expect(menuBox.y).toBeGreaterThanOrEqual(0);
        expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(520);
        expect(
          menuBox.x + menuBox.width <= triggerBox.x ||
            menuBox.x >= triggerBox.x + triggerBox.width ||
            menuBox.y + menuBox.height <= triggerBox.y ||
            menuBox.y >= triggerBox.y + triggerBox.height,
        ).toBe(true);
        const scroller = menu.locator("ul");
        expect(await scroller.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
        const last = menu.locator("[data-chat-tools-menu-tool]").last();
        await last.scrollIntoViewIfNeeded();
        await expect(last).toHaveCSS("width", "96px");
        await expect(last).toHaveCSS("height", "96px");
        await expect(last).toHaveCSS("border-radius", (await sharedBubbleShape(page)).radius);
        expect(
          await last.evaluate(
            (node) => getComputedStyle(node.querySelector(".mari-window-bubble__paint")!).backgroundImage,
          ),
        ).toContain("linear-gradient");
        await expectComposerClearAndNoSideScroll(page);
        await page.screenshot({
          path: testInfo.outputPath(`themed-tools-${preset}-${theme}.png`),
          animations: "disabled",
        });
        const id = await last.getAttribute("data-chat-tools-menu-tool");
        await last.click();
        await expect(sheet(page, id!)).toBeVisible();
        await expect(menu).toHaveCount(0);
        await sheet(page, id!).locator('[data-window-control="close"]').click();
        await launcher.click();
        await menu.press("Escape");
        await expect(menu).toHaveCount(0);
        await expect(launcher).toBeFocused();
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
      const target = bubble(page, TOOLS_MENU);
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
      // Some phones remain narrower than the desktop breakpoint even sideways.
      if (portrait.height >= 768) {
        for (const id of GAME_CONTROLS) {
          const rect = await box(bubble(page, id));
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(portrait.height);
          expect(rect.y + rect.height).toBeLessThanOrEqual(portrait.width);
        }
      } else {
        await expect(bubble(page, TOOLS_MENU)).toBeVisible();
        for (const id of GAME_CONTROLS) await expect(bubble(page, id)).toHaveCount(0);
      }
      await expect(chatSettingsButton(page)).toBeVisible();
      await expectComposerClearAndNoSideScroll(page);
      // Back upright, the same controls return to their shared menu.
      await page.setViewportSize(portrait);
      await expect(bubble(page, TOOLS_MENU)).toBeVisible();
      for (const id of GAME_CONTROLS) await expect(bubble(page, id)).toHaveCount(0);
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
