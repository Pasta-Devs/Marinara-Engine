// #7106: Settings -> Appearance -> Roleplay Presentation -> Chat position moves the Roleplay messages and
// composer together to the left or right of the visible chat area on wide screens. Phones keep the full width.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const WIDE = { width: 1920, height: 1080 };

type Position = "left" | "center" | "right";
type Rect = { left: number; right: number; top: number; bottom: number; width: number };

async function createChat(request: APIRequestContext, metadata: Record<string, unknown> = {}) {
  const created: string[] = [];
  const post = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const cleanup = async () => {
    for (const path of created) await request.delete(path).catch(() => undefined);
  };
  try {
    const character = await post("/api/characters", { data: { name: "Mari", first_mes: "" } });
    created.unshift(`/api/characters/${character.id}`);
    const chat = await post("/api/chats", {
      name: "Chat position proof",
      mode: "roleplay",
      characterIds: [character.id],
    });
    created.unshift(`/api/chats/${chat.id}`);
    const patched = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: false, windowLayout: null, chatSettingsHintDismissed: true, ...metadata },
    });
    expect(patched.ok()).toBeTruthy();
    for (const message of [
      { role: "assistant", characterId: character.id, content: "The archive lamps flicker as you step inside." },
      { role: "user", content: "I set the lantern down by the map table." },
      { role: "narrator", content: "Rain taps against the tall windows." },
      { role: "assistant", characterId: character.id, content: '"Over here," Mari says. "Bring the lantern."' },
    ]) {
      await post(`/api/chats/${chat.id}/messages`, message);
    }
    return { chat, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function open(page: Page, chatId: string, ui: Record<string, unknown> = {}, transcript = true) {
  // Keep this browser-local layout proof clear of the settings another project may sync.
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatSettingsMoveTipDismissed: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      appAccentPulseMode: false,
      ...ui,
    },
    // A reload must keep the choice the app saved, not the seed.
    "if-missing",
  );
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version: APP_VERSION },
  );
  await page.goto("/");
  await expect(page.locator('[data-roleplay-chat-column="true"]')).toBeVisible();
  if (transcript) await expect(page.locator(".mari-roleplay-message-body")).toHaveCount(3);
}

/** Every measurement in one frame. */
async function readLayout(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null): Rect | null => {
      if (!element) return null;
      const { left, right, top, bottom, width } = element.getBoundingClientRect();
      return { left, right, top, bottom, width };
    };
    const all = (selector: string) => [...document.querySelectorAll(selector)].map((element) => rect(element)!);
    const scroll = document.querySelector<HTMLElement>("#roleplay-chat-history");
    return {
      position: document.querySelector('[data-chat-mode="roleplay"]')?.getAttribute("data-chat-position") ?? null,
      area: rect(document.querySelector('[data-component="CenterContent"]'))!,
      composer: rect(document.querySelector('[data-roleplay-chat-column="true"]'))!,
      columns: [...all(".mari-roleplay-message-body"), ...all(".rpg-narrator-msg > div:first-child")],
      avatars: all(".mari-roleplay-message-row > .mari-message-avatar"),
      sidebar: rect(document.querySelector('[data-component="ChatSidebarSlot"]')),
      rightPanel: rect(document.querySelector('[data-component="RightPanelDesktopSlot"]')),
      scrollbar: scroll ? scroll.offsetWidth - scroll.clientWidth : 0,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      transcriptOverflow: scroll ? scroll.scrollWidth - scroll.clientWidth : 0,
    };
  });
}
type Layout = Awaited<ReturnType<typeof readLayout>>;

/** Messages, narration and composer share one column; the transcript's scrollbar may offset it. */
function expectOneColumn(layout: Layout) {
  const slack = 1 + layout.scrollbar;
  expect(layout.columns).toHaveLength(4);
  for (const column of layout.columns) {
    expect(Math.abs(column.left - layout.composer.left)).toBeLessThanOrEqual(slack);
    expect(Math.abs(column.right - layout.composer.right)).toBeLessThanOrEqual(slack);
  }
  expect(layout.pageOverflow).toBeLessThanOrEqual(0);
  // At Right a visible scrollbar lets the rows reach into the transcript's side padding, by at most its width.
  expect(layout.transcriptOverflow).toBeLessThanOrEqual(layout.scrollbar);
}

/** A phone keeps the full-width column: nothing spills sideways. */
function expectOneColumnOnPhone(layout: Layout) {
  expect(layout.columns).toHaveLength(4);
  expect(layout.pageOverflow).toBeLessThanOrEqual(0);
  expect(layout.transcriptOverflow).toBeLessThanOrEqual(0);
  for (const box of [layout.composer, ...layout.columns]) {
    expect(box.left).toBeGreaterThanOrEqual(layout.area.left);
    expect(box.right).toBeLessThanOrEqual(layout.area.right);
  }
}

/** The visible chat area is the pane between the open sidebars. */
function expectInsideArea(layout: Layout) {
  const left = Math.max(layout.area.left, layout.sidebar?.right ?? 0);
  const right = Math.min(layout.area.right, layout.rightPanel?.width ? layout.rightPanel.left : Infinity);
  for (const box of [layout.composer, ...layout.columns, ...layout.avatars]) {
    expect(box.left).toBeGreaterThanOrEqual(left - 1);
    expect(box.right).toBeLessThanOrEqual(right + 1);
  }
}

async function settledLayout(page: Page, check: (layout: Layout) => void) {
  let settled: Layout | null = null;
  // Sidebars slide in, so measure until the geometry holds still and passes.
  await expect(async () => {
    const first = await readLayout(page);
    await page.waitForTimeout(150);
    const second = await readLayout(page);
    expect(second).toEqual(first);
    check(second);
    settled = second;
  }).toPass({ timeout: 10_000 });
  return settled!;
}

async function choosePosition(page: Page, position: Position) {
  await clickTopbarPanel(page, "settings");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("group", { name: "Appearance by chat mode", exact: true })
    .getByRole("button", { name: "Roleplay", exact: true })
    .click();
  const choices = page.getByRole("group", { name: "Chat position", exact: true });
  await choices.scrollIntoViewIfNeeded();
  const label = { left: "Left", center: "Center", right: "Right" }[position];
  await choices.getByRole("button", { name: label, exact: true }).click();
  await expect(choices.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await clickTopbarPanel(page, "settings");
  await expect(choices).toBeHidden();
}

async function setPosition(page: Page, position: Position) {
  await page.evaluate(async (value) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().setRoleplayChatPosition(value);
  }, position);
}

async function expectConnectionsMenuOnScreen(page: Page) {
  const switcher = page.getByRole("button", { name: "Quick Connection Switcher", exact: true });
  await switcher.click();
  const menu = page.getByRole("menu", { name: "Connections", exact: true });
  await expect(menu).toBeVisible();
  await expect(async () => {
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(WIDE.width);
    expect(box.y + box.height).toBeLessThanOrEqual(WIDE.height);
  }).toPass();
  await switcher.click();
  await expect(menu).toBeHidden();
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}

test("Chat position moves the Roleplay column and composer together inside the visible chat area", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Chat position applies to wide screens.");
  test.setTimeout(150_000);
  await page.setViewportSize(WIDE);
  const { chat, cleanup } = await createChat(request);
  try {
    await open(page, chat.id);

    // Center is today's layout: one centred column.
    const center = await settledLayout(page, (layout) => {
      expect(layout.position).toBeNull();
      expectOneColumn(layout);
      const leftGap = layout.composer.left - layout.area.left;
      const rightGap = layout.area.right - layout.composer.right;
      expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1 + layout.scrollbar);
    });
    await shot(page, "center");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await settledLayout(page, (layout) => {
      expect(layout.sidebar!.width).toBeGreaterThan(200);
      expectOneColumn(layout);
      expectInsideArea(layout);
    });
    await shot(page, "center-chats-sidebar");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await settledLayout(page, (layout) => expect(layout.sidebar?.width ?? 0).toBeLessThanOrEqual(1));

    // Left: the column moves to the left edge of the chat area, keeping room for its avatars.
    await choosePosition(page, "left");
    const left = await settledLayout(page, (layout) => {
      expect(layout.position).toBe("left");
      expectOneColumn(layout);
      expectInsideArea(layout);
      expect(layout.composer.left - layout.area.left).toBeLessThanOrEqual(160);
      expect(layout.composer.left).toBeLessThan(center.composer.left - 300);
      expect(Math.abs(layout.composer.width - center.composer.width)).toBeLessThanOrEqual(1);
    });
    await shot(page, "left");
    await expectConnectionsMenuOnScreen(page);

    // Opening the chats sidebar pushes the column right instead of covering it.
    await page.locator('[data-tour="sidebar-toggle"]').click();
    const leftWithSidebar = await settledLayout(page, (layout) => {
      expect(layout.sidebar!.width).toBeGreaterThan(200);
      expectOneColumn(layout);
      expectInsideArea(layout);
      expect(layout.composer.left - layout.sidebar!.right).toBeLessThanOrEqual(160);
    });
    expect(leftWithSidebar.composer.left).toBeGreaterThan(left.composer.left + 200);
    await shot(page, "left-chats-sidebar");

    // Both sidebars at once still leave the column inside the pane between them.
    await clickTopbarPanel(page, "characters");
    await settledLayout(page, (layout) => {
      expect(layout.rightPanel!.width).toBeGreaterThan(200);
      expectOneColumn(layout);
      expectInsideArea(layout);
    });
    await clickTopbarPanel(page, "characters");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await settledLayout(page, (layout) => {
      expect(layout.sidebar?.width ?? 0).toBeLessThanOrEqual(1);
      expect(layout.rightPanel?.width ?? 0).toBeLessThanOrEqual(1);
    });

    // The choice is saved.
    await page.reload();
    await expect(page.locator('[data-roleplay-chat-column="true"]')).toBeVisible();
    await settledLayout(page, (layout) => {
      expect(layout.position).toBe("left");
      expect(Math.abs(layout.composer.left - left.composer.left)).toBeLessThanOrEqual(1);
      expectOneColumn(layout);
    });

    // Right mirrors Left, and the right panel pushes the column left.
    await choosePosition(page, "right");
    const right = await settledLayout(page, (layout) => {
      expect(layout.position).toBe("right");
      expectOneColumn(layout);
      expectInsideArea(layout);
      expect(layout.area.right - layout.composer.right).toBeLessThanOrEqual(160);
      expect(layout.composer.left).toBeGreaterThan(center.composer.left + 300);
      const leftGap = left.composer.left - left.area.left;
      expect(Math.abs(layout.area.right - layout.composer.right - leftGap)).toBeLessThanOrEqual(1);
    });
    await shot(page, "right");
    await expectConnectionsMenuOnScreen(page);
    await clickTopbarPanel(page, "characters");
    const rightWithPanel = await settledLayout(page, (layout) => {
      expect(layout.rightPanel!.width).toBeGreaterThan(200);
      expectOneColumn(layout);
      expectInsideArea(layout);
      expect(layout.rightPanel!.left - layout.composer.right).toBeLessThanOrEqual(160);
    });
    expect(rightWithPanel.composer.right).toBeLessThan(right.composer.right - 200);
    await shot(page, "right-characters-panel");
    await clickTopbarPanel(page, "characters");

    // Back to Center restores the original geometry exactly.
    await choosePosition(page, "center");
    await settledLayout(page, (layout) => {
      expect(layout.position).toBeNull();
      expect(layout.composer).toEqual(center.composer);
      expect(layout.columns).toEqual(center.columns);
    });
  } finally {
    await cleanup();
  }
});

test("Chat position keeps the column clear of a Tracker Panel on the same side", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The docked Tracker Panel is a desktop layout.");
  await page.setViewportSize(WIDE);
  const { chat, cleanup } = await createChat(request, { enableAgents: true, activeAgentIds: [] });
  try {
    await open(page, chat.id, {
      roleplayChatPosition: "left",
      trackerPanelEnabled: true,
      trackerPanelOpen: true,
      trackerPanelOpenByChatId: { [chat.id]: true },
      trackerPanelSide: "left",
      trackerPanelSizeProfile: "standard",
      trackerPanelHideHudWidgets: false,
    });
    const tracker = page.locator('[data-component="TrackerDataSidebarDesktop.left"]');
    await expect(tracker).toBeVisible();
    const expectClearOfTracker = async (oneColumn: boolean) => {
      await expect(async () => {
        const before = (await tracker.boundingBox())!;
        await page.waitForTimeout(300);
        const box = (await tracker.boundingBox())!;
        const layout = await readLayout(page);
        expect(layout.position).toBe("left");
        // The panel keeps its full Standard width (340px), and the column and panel settle instead of
        // resizing each other.
        expect(Math.round(box.width)).toBe(340);
        expect(box).toEqual(before);
        if (oneColumn) expectOneColumn(layout);
        for (const column of [layout.composer, ...layout.columns, ...layout.avatars]) {
          expect(column.left).toBeGreaterThanOrEqual(box.x + box.width);
        }
      }).toPass({ timeout: 10_000 });
    };
    await expectClearOfTracker(true);
    await shot(page, "left-tracker-panel");
    // A pane too narrow for the panel and a full column: the column narrows, the panel keeps its width.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expectClearOfTracker(false);
    await shot(page, "left-tracker-panel-chats-sidebar");
  } finally {
    await cleanup();
  }
});

test("an unmoved Trackers window follows Chat position to a free gutter", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The Trackers window starts as a button on phones.");
  await page.setViewportSize(WIDE);
  const { chat, cleanup } = await createChat(request, { enableAgents: true, activeAgentIds: ["world-state"] });
  try {
    const state = await request.patch(`/api/chats/${chat.id}/game-state`, {
      data: { manual: true, location: "Archive", time: "Evening" },
    });
    expect(state.ok()).toBeTruthy();
    await open(page, chat.id, { trackerPanelEnabled: false, trackerPanelOpen: false });
    const trackers = page.locator('.mari-window[data-window="trackers"]');
    const bubble = page.locator('.mari-window-bubble[data-window="trackers"]');
    const expectBesideColumn = async () => {
      await expect(trackers).toBeVisible();
      await expect(async () => {
        const box = (await trackers.boundingBox())!;
        const layout = await readLayout(page);
        for (const column of [layout.composer, ...layout.columns, ...layout.avatars]) {
          expect(box.x + box.width).toBeLessThanOrEqual(column.left);
        }
      }).toPass();
    };
    await expectBesideColumn();
    // At Left the column takes the gutter, so the window waits as a button instead of covering messages.
    await setPosition(page, "left");
    await expect(bubble).toBeVisible();
    await expect(trackers).toBeHidden();
    await setPosition(page, "right");
    await expectBesideColumn();
  } finally {
    await cleanup();
  }
});

test("Chat position moves the Visual Novel composer and its history together", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Chat position applies to wide screens.");
  await page.setViewportSize(WIDE);
  const { chat, cleanup } = await createChat(request, { roleplayDisplayStyle: "visual-novel" });
  try {
    await open(page, chat.id, { roleplayChatPosition: "left" }, false);
    const composer = page.locator('[data-roleplay-chat-column="true"]');
    await expect(page.locator("[data-roleplay-vn]")).toBeVisible();
    const area = (await page.locator('[data-component="CenterContent"]').boundingBox())!;
    const closed = (await composer.boundingBox())!;
    expect(closed.x - area.x).toBeLessThanOrEqual(160);

    await page.getByRole("button", { name: "Show chat history", exact: true }).click();
    const history = page.locator("[data-chat-resource-drop-surface]");
    await expect(history).toHaveClass(/mari-roleplay-input-column/);
    await expect(async () => {
      const [historyBox, composerBox] = await Promise.all([history.boundingBox(), composer.boundingBox()]);
      expect(Math.abs(historyBox!.x - composerBox!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(historyBox!.width - composerBox!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(composerBox!.x - closed.x)).toBeLessThanOrEqual(1);
    }).toPass();
    await shot(page, "left-visual-novel-history");
  } finally {
    await cleanup();
  }
});

test("Chat position changes nothing on a phone", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Phone layouts run on the mobile projects.");
  const { chat, cleanup } = await createChat(request);
  try {
    await open(page, chat.id);
    const center = await settledLayout(page, (layout) => expectOneColumnOnPhone(layout));
    for (const position of ["left", "right"] as const) {
      await setPosition(page, position);
      await expect
        .poll(() =>
          page.evaluate(() => JSON.parse(localStorage.getItem("marinara-engine-ui")!).state.roleplayChatPosition),
        )
        .toBe(position);
      const layout = await readLayout(page);
      expect(layout.position).toBe(position);
      expectOneColumnOnPhone(layout);
      expect(layout.composer).toEqual(center.composer);
      expect(layout.columns).toEqual(center.columns);
    }
  } finally {
    await cleanup();
  }
});
