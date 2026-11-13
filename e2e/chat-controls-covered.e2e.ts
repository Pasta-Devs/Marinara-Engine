// Issue #7176: between phone and desktop widths (an 856px foldable, say) panels and editors open
// over a chat that stays mounted. The chat's buttons and windows must not show through them, and
// the Trackers button must close the Tracker Panel it opened.
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const ANDROID_APP_UA =
  "Mozilla/5.0 (Linux; Android 14; Honor Magic V2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 MarinaraEngine/Android";
const AGENTS_PANEL = '[data-component="RightPanelMobile"], [data-component="RightPanelDesktopSlot"]';
test.use({ reducedMotion: "reduce" });

async function createChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Covered chat controls", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  expect(
    (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { enableAgents: true, activeAgentIds: [] } })).ok(),
  ).toBeTruthy();
  return chat;
}

async function openChat(page: Page, chatId: string) {
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

const center = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
};

/** Whether a press at this point reaches the given element (nothing drawn over it). */
const pressReaches = (page: Page, point: { x: number; y: number }, selector: string) =>
  page.evaluate(({ x, y, selector }) => document.elementFromPoint(x, y)?.closest(selector) != null, {
    ...point,
    selector,
  });

async function snap(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
}

/** The 856px flow: the Tracker Panel, then the Agents list and an agent's editor, all over the chat and a pinned window. */
async function checkCoveredChat(page: Page, info: TestInfo) {
  const settingsButton = page.locator(".mari-window-bubble[data-chat-settings-button]");
  const trackersButton = page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]');
  const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
  const chatButtons = page.locator(".mari-window-bubble:visible");

  // The panel opens over the chat on load; the chat's buttons stay under it.
  await expect(panel).toBeVisible();
  await snap(page, info, "tracker-panel-open");
  await expect(chatButtons).toHaveCount(0);

  await panel.getByRole("button", { name: "Close tracker panel", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(settingsButton).toBeVisible();
  await expect(trackersButton).toHaveAttribute("aria-expanded", "false");
  const settingsPoint = await center(settingsButton);
  const trackersPoint = await center(trackersButton);

  // From the keyboard: the panel hides its button, so focus moves into the panel and back again on close.
  await trackersButton.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-component="TrackerDataSidebarMobile"]')).toBeFocused();
  await expect(chatButtons).toHaveCount(0);
  await expect.poll(() => pressReaches(page, trackersPoint, ".mari-tracker-panel")).toBe(true);
  await expect.poll(() => pressReaches(page, settingsPoint, ".mari-tracker-panel")).toBe(true);
  await panel.getByRole("button", { name: "Close tracker panel", exact: true }).click();
  await expect(trackersButton).toBeVisible();
  await expect(trackersButton).toBeFocused();

  // A pinned window stays open behind other screens, out of sight.
  await settingsButton.click();
  const settingsWindow = page.locator('.mari-window[data-window="chat-settings"]');
  await expect(settingsWindow).toBeVisible();
  await settingsWindow.locator('[data-window-control="pin"]').click();
  await expect(settingsWindow).toHaveAttribute("data-pinned", "true");

  // Another screen from the top bar, without going Home first.
  await page.locator('[data-tour="panel-agents"]').click();
  const newAgent = page.locator(AGENTS_PANEL).getByRole("button", { name: "New", exact: true });
  await expect(newAgent).toBeVisible();
  await snap(page, info, "agents-list");
  await expect(chatButtons).toHaveCount(0);
  await expect(settingsWindow).toBeHidden();
  await expect.poll(() => pressReaches(page, trackersPoint, AGENTS_PANEL)).toBe(true);
  await expect.poll(() => pressReaches(page, settingsPoint, AGENTS_PANEL)).toBe(true);

  await newAgent.click();
  const editor = page.locator('[data-component="MobileDetailSheet"]');
  const save = editor.getByRole("button", { name: "Save", exact: true });
  const back = editor.getByRole("button", { name: /^Back to/ });
  await expect(save).toBeVisible();
  await snap(page, info, "agent-editor");
  await expect(chatButtons).toHaveCount(0);
  await expect(settingsWindow).toBeHidden();
  for (const point of [settingsPoint, trackersPoint, await center(save), await center(back)]) {
    await expect.poll(() => pressReaches(page, point, '[data-component="MobileDetailSheet"]')).toBe(true);
  }

  // Back returns to the Agents list, still over the chat; closing it brings the buttons back where they were.
  await back.click();
  await expect(editor).toHaveCount(0);
  await expect(newAgent).toBeVisible();
  await expect(chatButtons).toHaveCount(0);
  await page.locator('[data-tour="panel-agents"]').click();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toHaveCount(0);
  await expect(settingsButton).toBeVisible();
  expect(await center(settingsButton)).toEqual(settingsPoint);
  await expect(settingsWindow).toBeVisible();
  await expect(settingsWindow).toHaveAttribute("data-pinned", "true");
}

test.describe("between phone and desktop widths", () => {
  test.use({ viewport: { width: 856, height: 904 } });

  test("chat buttons stay off other screens and under the Tracker Panel", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop-chromium", "One Chromium run covers this width.");
    const chat = await createChat(request);
    try {
      await openChat(page, chat.id);
      await checkCoveredChat(page, info);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test.describe("in the Android app on a foldable", () => {
  test.use({ viewport: { width: 856, height: 904 }, isMobile: true, hasTouch: true, userAgent: ANDROID_APP_UA });

  test("chat buttons stay off other screens and under the Tracker Panel", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop-chromium", "One Chromium run covers this device.");
    const chat = await createChat(request);
    try {
      await openChat(page, chat.id);
      await checkCoveredChat(page, info);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the Trackers button opens and closes its panel", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop-chromium", "Computer layout.");
    const chat = await createChat(request);
    try {
      await openChat(page, chat.id);
      const trackersButton = page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]');
      const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
      await expect(panel).toBeVisible();
      await expect(trackersButton).toBeVisible();
      await expect(trackersButton).toHaveAttribute("aria-expanded", "true");
      await snap(page, info, "desktop-tracker-panel-open");

      await trackersButton.click();
      await expect(panel).toHaveCount(0);
      await expect(trackersButton).toHaveAttribute("aria-expanded", "false");
      await expect(trackersButton).toBeFocused();

      await trackersButton.click();
      await expect(panel).toBeVisible();
      await expect(trackersButton).toHaveAttribute("aria-expanded", "true");

      // Docked panels sit beside the chat, which keeps its buttons; an editor replaces the chat.
      await page.locator('[data-tour="panel-agents"]').click();
      const newAgent = page.locator(AGENTS_PANEL).getByRole("button", { name: "New", exact: true });
      await expect(newAgent).toBeVisible();
      await expect(page.locator(".mari-window-bubble[data-chat-settings-button]")).toBeVisible();
      await newAgent.click();
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      await expect(page.locator(".mari-window-bubble")).toHaveCount(0);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test("on a phone the chat buttons and Tracker Panel behave as before", async ({ page, request, isMobile }, info) => {
  test.skip(!isMobile, "Phone layout.");
  const chat = await createChat(request);
  try {
    await openChat(page, chat.id);
    const trackersButton = page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]');
    const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
    // Phones begin at the button.
    await expect(trackersButton).toBeVisible();
    await expect(panel).toHaveCount(0);
    const trackersPoint = await center(trackersButton);
    await trackersButton.click();
    await expect(panel).toBeVisible();
    await expect.poll(() => pressReaches(page, trackersPoint, ".mari-tracker-panel")).toBe(true);
    await snap(page, info, "phone-tracker-panel-open");
    await panel.getByRole("button", { name: "Close tracker panel", exact: true }).click();
    await expect(trackersButton).toBeVisible();
    expect(await center(trackersButton)).toEqual(trackersPoint);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
