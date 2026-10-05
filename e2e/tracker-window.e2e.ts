// #7034 step 5: with the Tracker Panel on, a Roleplay chat's trackers live only in the panel; with it off they
// live in a movable Tracker window (one drawer per tracker). Both carry an Agent activity section.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings, resetChatView } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

async function createTrackerChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Tracker window chat", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: true, activeAgentIds: ["world-state", "persona-stats", "custom-tracker"] },
  });
  expect(metadata.ok()).toBeTruthy();
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

async function prepare(page: Page, chatId: string, ui: Record<string, unknown>) {
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

async function typography(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
    };
  });
}

for (const theme of ["dark", "light"] as const) {
  test(`Tracker Panel activity matches nearby sections and its border follows a pulsing gradient in ${theme} mode`, async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createTrackerChat(request);
    try {
      await prepare(page, chat.id, {
        theme,
        chatSettingsMoveTipDismissed: true,
        appAccentColor: "linear-gradient(90deg, #ff0000, #00ff00, #0000ff)",
        appAccentPulseMode: true,
        appAccentRgbMode: false,
        trackerPanelEnabled: true,
        trackerPanelOpen: true,
        trackerPanelOpenByChatId: { [chat.id]: true },
      });
      await page.goto("/");
      await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
      if (testInfo.project.name.includes("mobile")) {
        await page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]').click();
      }
      const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
      await expect(panel).toBeVisible();
      const activity = panel.locator('[data-tracker-section="agent-activity"]');
      const activityHeader = activity.getByRole("button", { name: /Agent activity/i });
      const customHeader = panel.getByRole("button", { name: "Custom", exact: true });
      const custom = customHeader.locator("xpath=ancestor::section[1]");
      expect(await typography(activityHeader.locator("span").last())).toEqual(
        await typography(customHeader.locator("span").last()),
      );
      const surface = (locator: Locator) =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, border: style.borderBottomColor, shadow: style.boxShadow };
        });
      expect(await surface(activity)).toEqual(await surface(custom));
      await activityHeader.click();
      const action = activity.getByRole("button", { name: "Clear Trackers", exact: true });
      await expect(action).toBeVisible();
      const rowText = await typography(custom.getByText("Fine", { exact: true }).filter({ visible: true }));
      expect((await typography(action)).fontSize).toBe(rowText.fontSize);
      expect((await typography(action)).lineHeight).toBe(rowText.lineHeight);
      const trackerInset = await customHeader
        .locator("..")
        .evaluate((element) => getComputedStyle(element).paddingLeft);
      await expect(action).toHaveCSS("padding-left", trackerInset);
      await expect(action).toHaveCSS("padding-top", trackerInset);

      // Exercise a real output card, not only the empty activity state.
      await page.evaluate(async () => {
        const module = (await import("/src/stores/agent.store.ts" as string)) as {
          useAgentStore: { setState: (state: Record<string, unknown>) => void };
        };
        module.useAgentStore.setState({
          thoughtBubbles: [
            { agentId: "world-state", agentName: "World State", content: "The harbor is calm.", timestamp: Date.now() },
          ],
        });
      });
      const output = activity.locator("[data-agent-output]");
      await expect(output).toContainText("The harbor is calm.");
      const panelNameColor = await output.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "color-mix(in oklab, var(--foreground) 75%, transparent)";
        element.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      await expect(output.getByText("World State", { exact: true })).toHaveCSS("color", panelNameColor);
      expect((await typography(output)).fontSize).toBe(rowText.fontSize);
      await expect(output).toHaveCSS("padding-left", trackerInset);
      await expect(output).toHaveCSS(
        "border-radius",
        await customHeader.evaluate((element) => getComputedStyle(element).borderRadius),
      );

      const shell = page.locator(".mari-tracker-panel:visible");
      await expect(page.locator("html")).toHaveAttribute("data-marinara-accent-animation", "gradient");
      const ring = () => shell.evaluate((element) => getComputedStyle(element).boxShadow);
      const firstRing = await ring();
      await expect.poll(ring).not.toBe(firstRing);
      const followsLiveAccent = await shell.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--marinara-app-accent-solid)";
        element.appendChild(probe);
        const color = getComputedStyle(probe).color;
        const shadow = getComputedStyle(element).boxShadow;
        probe.remove();
        return shadow.includes(color);
      });
      expect(followsLiveAccent).toBe(true);
      await activity.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`tracker-activity-${theme}.png`), animations: "disabled" });
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

test.describe("Roleplay trackers on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "Phones keep the tracker strip (and a Tracker Panel bubble).",
    );
  });

  test("with the Tracker Panel on, trackers show only in the panel, which has Agent activity", async ({
    page,
    request,
  }) => {
    const chat = await createTrackerChat(request);
    try {
      await prepare(page, chat.id, {
        trackerPanelEnabled: true,
        trackerPanelOpen: true,
        trackerPanelOpenByChatId: { [chat.id]: true },
      });
      await page.goto("/");
      const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await expect(panel.getByRole("button", { name: /^Location: Harbor market/ })).toBeVisible();

      // Nothing else on screen repeats the trackers: no Tracker window and no tracker icons in the HUD row.
      await expect(page.locator('[data-window="trackers"]')).toHaveCount(0);
      const hud = page.locator('[data-tracker-panel-anchor="roleplay-hud"]').filter({ visible: true });
      // Agent activity has no button there either: it is in the panel, the Tracker window and Chat Settings.
      await expect(hud.getByRole("button", { name: /^Agents & Actions/ })).toHaveCount(0);
      for (const title of ["World State", "Persona Stats", "Custom Tracker"]) {
        await expect(hud.locator(`[title="${title}"]`).filter({ visible: true })).toHaveCount(0);
      }

      const activity = panel.locator('[data-tracker-section="agent-activity"]');
      const header = activity.getByRole("button", { name: /Agent activity/i });
      await expect(header).toHaveAttribute("aria-expanded", "false");
      await expect(activity.locator('[data-component="AgentActivitySection"]')).toHaveCount(0);
      await header.click();
      await expect(header).toHaveAttribute("aria-expanded", "true");
      const section = activity.locator('[data-component="AgentActivitySection"]');
      await expect(section.getByRole("button", { name: "Clear Trackers", exact: true })).toBeVisible();
      await expect(section.getByRole("button", { name: /^Re-run Trackers/ })).toBeEnabled();
      await header.click();
      await expect(section).toHaveCount(0);

      // Chat Settings offers the Tracker Panel dice (on here), not the Tracker window switch.
      const settings = await openChatSettings(page);
      await expect(settings.locator('[data-tracker-panel-toggle="chat-settings"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(settings.locator('[data-tracker-window-toggle="chat-settings"]')).toHaveCount(0);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("the default Trackers window uses a free gutter and becomes a button when the chat is narrow", async ({
    page,
    request,
  }) => {
    const chat = await createTrackerChat(request);
    try {
      await page.setViewportSize({ width: 2400, height: 1000 });
      await prepare(page, chat.id, { trackerPanelEnabled: true, trackerPanelOpen: false });
      await page.goto("/");
      const window = page.locator('.mari-window[data-window="trackers"]');
      const bubble = page.locator('.mari-window-bubble[data-window="trackers"]');
      await expect(window).toBeVisible();
      const rect = await window.boundingBox();
      const transcript = await page.locator(".mari-roleplay-input-column").first().boundingBox();
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(transcript!.x);
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(bubble).toBeVisible();
      await expect(window).toBeHidden();
      await bubble.click();
      await expect(window).toBeVisible();
      await window.getByRole("button", { name: "Close Trackers", exact: true }).click();
      await expect(bubble).toBeFocused();
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });

  test("with the Tracker Panel off, trackers show in a Tracker window with a drawer each", async ({
    page,
    request,
  }) => {
    const chat = await createTrackerChat(request);
    try {
      await prepare(page, chat.id, { trackerPanelEnabled: false, trackerPanelOpen: false });
      await page.goto("/");
      const trackerWindow = page.locator('.mari-window[data-window="trackers"]');
      const trackerBubble = page.locator('.mari-window-bubble[data-window="trackers"]');
      await expect(trackerBubble).toBeVisible({ timeout: 30_000 });
      await expect(trackerWindow).toBeHidden();
      await trackerBubble.click();
      await expect(trackerWindow).toBeVisible();
      await expect(trackerWindow).toHaveAttribute("data-pinned", "true");
      await expect(trackerWindow).toHaveAttribute("data-locked", "false");
      // Opening the bubble gives keyboard focus to its window.
      await expect(trackerWindow).toBeFocused();
      await expect(page.locator('[data-component="TrackerDataSidebar"]')).toHaveCount(0);
      const hud = page.locator('[data-tracker-panel-anchor="roleplay-hud"]').filter({ visible: true });
      await expect(hud.locator('[title="Persona Stats"]').filter({ visible: true })).toHaveCount(0);

      // Even a pinned window stays above the composer and its open slash-command suggestions.
      const composer = page.locator("textarea[data-chat-composer]").first();
      await composer.fill("/");
      await expect
        .poll(async () => {
          const windowRect = await trackerWindow.boundingBox();
          const inputRect = await page.locator(".chat-input-container:visible").first().boundingBox();
          return windowRect!.y + windowRect!.height <= inputRect!.y;
        })
        .toBe(true);
      await composer.fill("");

      // One drawer per tracker, open by default with the full box; collapsed, each shows its miniature.
      const world = trackerWindow.locator('[data-drawer="tracker-world"]');
      const persona = trackerWindow.locator('[data-drawer="tracker-persona"]');
      const custom = trackerWindow.locator('[data-drawer="tracker-custom"]');
      for (const drawer of [world, persona, custom]) await expect(drawer).toBeVisible();
      await expect(world.getByText("Harbor market", { exact: true })).toBeVisible();
      await expect(custom.getByRole("button", { name: "Health", exact: true })).toBeVisible();
      await expect(world.locator(".mari-drawer__summary")).toHaveCount(0);

      await custom.locator(".mari-drawer__header").click();
      await expect(custom.getByRole("button", { name: "Health", exact: true })).toHaveCount(0);
      await expect(custom.locator(".mari-drawer__summary")).toHaveText("Health: Fine");
      await world.locator(".mari-drawer__header").click();
      await expect(world.getByText("Harbor market", { exact: true })).toHaveCount(0);
      await expect(world.locator(".mari-drawer__summary svg").first()).toBeVisible();
      await persona.locator(".mari-drawer__header").click();
      await expect(persona.locator(".mari-drawer__summary .rounded-full").first()).toBeVisible();
      // Pressing the miniature expands its drawer.
      await custom.locator(".mari-drawer__summary").click();
      await expect(custom.getByRole("button", { name: "Health", exact: true })).toBeVisible();

      // Agent activity, with its actions.
      const activity = trackerWindow.locator('[data-drawer="agent-activity"]');
      await activity.locator(".mari-drawer__header").click();
      const section = activity.locator('[data-component="AgentActivitySection"]');
      await expect(section.getByRole("button", { name: /^Re-run Trackers/ })).toBeEnabled();
      await section.getByRole("button", { name: "Clear Trackers", exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Clear all trackers for this chat?" });
      await dialog.getByRole("button", { name: "Clear Trackers", exact: true }).click();
      await expect
        .poll(async () => (await (await request.get(`/api/chats/${chat.id}/game-state`)).json()).location)
        .toBeNull();
      await expect(world.locator(".mari-drawer__summary")).toBeVisible();

      // Lock keeps it in place; pin keeps it open when the user presses elsewhere.
      const lock = trackerWindow.locator('[data-window-control="lock"]');
      await lock.click();
      await expect(trackerWindow).toHaveAttribute("data-locked", "true");
      await expect(trackerWindow.locator(".mari-window__resize-handle")).toHaveCount(0);
      await lock.click();
      await expect(trackerWindow).toHaveAttribute("data-locked", "false");
      await page.locator("[data-chat-composer]").first().click();
      await expect(trackerWindow).toBeVisible();
      await trackerWindow.locator('[data-window-control="pin"]').click();
      await expect(trackerWindow).toHaveAttribute("data-pinned", "false");
      await page.locator("[data-chat-composer]").first().click();
      await expect(trackerWindow).toBeHidden();

      // A minimized window keeps its bubble; its own close action returns focus there.
      await expect(trackerBubble).toBeVisible();
      await trackerBubble.click();
      await expect(trackerWindow).toBeVisible();
      await trackerWindow.getByRole("button", { name: "Close Trackers", exact: true }).click();
      await expect(trackerWindow).toBeHidden();
      await expect(trackerBubble).toBeFocused();

      // The title-bar dice switches between the panel and the window; no separate toggle remains.
      const settings = await openChatSettings(page);
      await expect(settings.locator('[data-tracker-window-toggle="chat-settings"]')).toHaveCount(0);
      const dice = settings.getByRole("button", { name: "Tracker Panel", exact: true });
      await dice.click();
      await expect(trackerBubble).toHaveCount(0);
      await dice.click();
      await expect(trackerBubble).toBeVisible();
      await resetChatView(page);
      await expect(trackerBubble).toBeVisible();
      await trackerBubble.click();
      await expect(trackerWindow).toBeVisible();
      await expect(trackerWindow).toHaveAttribute("data-pinned", "true");
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test("detached tracker lists retain their final border in every widget preset and custom gradients", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Popped-out tracker drawers use desktop windows.");
  const chat = await createTrackerChat(request);
  try {
    await prepare(page, chat.id, { trackerPanelEnabled: false, theme: "dark" });
    await page.goto("/");
    await page.locator('.mari-window-bubble[data-window="trackers"]').click();
    const world = page.locator('.mari-window[data-window="trackers"] [data-drawer="tracker-world"]');
    await world.locator('[data-drawer-control="pop-out"]').click();
    const window = page.locator('.mari-window[data-window="drawer:trackers:tracker-world"]');
    const fields = window.locator('.mari-drawer[data-detached="true"]');
    await expect(window.getByText("Harbor market", { exact: true })).toBeVisible();
    for (const preset of ["default", "dottore", "mari"] as const) {
      await page.evaluate(async (preset) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setChatWidgetPreset(preset);
      }, preset);
      await expect(fields).toHaveCSS("border-bottom-width", "1px");
      await expect(fields).toHaveCSS("border-bottom-style", "solid");
      await expect(fields).not.toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
      await window.screenshot({
        path: testInfo.outputPath(`detached-tracker-border-${preset}.png`),
        animations: "disabled",
      });
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setChatWidgetBorderColor("linear-gradient(90deg, #ff6b6b, #ffd93d)");
      });
      await expect(page.locator("html")).toHaveAttribute("data-chat-widget-colors", /border/);
      await expect.poll(() => fields.evaluate((node) => getComputedStyle(node, "::before").paddingBottom)).toBe("1px");
      await expect
        .poll(() => fields.evaluate((node) => getComputedStyle(node, "::before").backgroundImage))
        .toContain("linear-gradient");
    }
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
