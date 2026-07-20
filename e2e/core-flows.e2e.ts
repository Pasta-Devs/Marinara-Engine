import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const TRANSPARENT_GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const WHATS_NEW_SEEN_VERSION_KEY = "marinara:whats-new:seen-version";
const WHATS_NEW_E2E_BYPASS_KEY = "marinara:e2e:show-whats-new";
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function collectUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|ResizeObserver/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function prepareFreshClient(page: Page) {
  await page.addInitScript((appVersion) => {
    if (sessionStorage.getItem("marinara:e2e:show-whats-new") !== "true") {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }
    if (localStorage.getItem("marinara-engine-ui")) return;
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          rightPanelOpen: false,
          sidebarOpen: false,
        },
        version: 65,
      }),
    );
  }, APP_VERSION);
}

async function expectHomeContentFits(page: Page) {
  const home = page.locator('[data-component="ChatArea.EmptyState"]');
  await expect
    .poll(async () => {
      return home.evaluate((homeElement) => {
        const contentElement = homeElement.querySelector<HTMLElement>('[data-component="ChatArea.HomeContent"]');
        if (!contentElement) return false;
        const homeRect = homeElement.getBoundingClientRect();
        const contentRect = contentElement.getBoundingClientRect();
        return contentRect.top >= homeRect.top - 1 && contentRect.bottom <= homeRect.bottom + 1;
      });
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await prepareFreshClient(page);
});

test("What's New opens once for each Marinara Engine version", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ bypassKey, seenKey }) => {
      sessionStorage.setItem(bypassKey, "true");
      localStorage.removeItem(seenKey);
    },
    { bypassKey: WHATS_NEW_E2E_BYPASS_KEY, seenKey: WHATS_NEW_SEEN_VERSION_KEY },
  );
  await page.reload();

  const announcement = page.getByRole("dialog", { name: "What's New?" });
  await expect(announcement).toBeVisible();
  await expect(announcement.getByText(`Version ${APP_VERSION}`, { exact: true })).toBeVisible();
  await expect(announcement.getByRole("heading", { name: "We fixed the most glaring issues." })).toBeVisible();
  await expect(announcement.getByText(/We’re sorry for the inconvenience/)).toBeVisible();
  await expect(announcement.getByText("Marinara Engine has been updated.", { exact: true })).toHaveCount(0);
  await expect(announcement.getByText(/Hierarchical Maps/)).toBeVisible();
  await expect(announcement.getByText("Tactical Combat Mode in Games")).toHaveCount(0);
  await expect(announcement.getByRole("link", { name: "View release" })).toHaveAttribute(
    "href",
    `https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v${APP_VERSION}`,
  );

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), WHATS_NEW_SEEN_VERSION_KEY))
    .toBe(APP_VERSION);
  await announcement.getByRole("button", { name: "Got it" }).click();
  await expect(announcement).toBeHidden();

  await page.reload();
  await expect(announcement).toBeHidden();

  await page.evaluate(({ key, previousVersion }) => localStorage.setItem(key, previousVersion), {
    key: WHATS_NEW_SEEN_VERSION_KEY,
    previousVersion: "2.2.1",
  });
  await page.reload();
  await expect(announcement).toBeVisible();
});

test("turning off the custom mouse pointer persists immediately and after reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Appearance preference persistence is covered on desktop.");

  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Appearance" }).click();

  const cursorToggle = page.getByLabel("Custom Mouse Pointer");
  await expect(cursorToggle).toBeChecked();
  await page.getByText("Custom Mouse Pointer", { exact: true }).click();
  await expect(cursorToggle).not.toBeChecked();
  await page.waitForTimeout(100);

  const persistedCursorPreference = await page.evaluate(() => {
    const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
      state?: { customCursorEnabled?: unknown };
    };
    return persisted.state?.customCursorEnabled;
  });
  expect(persistedCursorPreference).toBe(false);

  await page.reload();
  await expect(page.getByLabel("Custom Mouse Pointer")).not.toBeChecked();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.marinaraCustomCursor ?? null))
    .toBeNull();
});

test("Convo About Me keeps manual editing and native expanded-editor keyboard behavior", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The shared Convo profile fields are covered on desktop.");

  const characterName = "About Me Controls Smoke";
  const createResponse = await page.request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        personality: "Dryly funny and observant.",
        extensions: { aboutMe: "alpha\nbeta" },
      },
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const character = (await createResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-characters"]').click();
    await page.getByText(characterName, { exact: true }).first().click();

    const editorSections = page.getByRole("navigation", { name: "Editor sections" });
    await editorSections.getByRole("button", { name: "Convo", exact: true }).click();

    const fields = page.locator('[data-component="ConvoProfileFields"]');
    await expect(fields.getByText("About Me", { exact: true })).toBeVisible();
    const aboutMe = fields.locator("textarea").first();
    await expect(aboutMe).toHaveValue("alpha\nbeta");
    await expect(fields.getByRole("button", { name: "AI Write", exact: true })).toHaveCount(0);
    await expect(fields.getByRole("button", { name: "AI Write sources", exact: true })).toHaveCount(0);
    await expect(fields.locator("select")).toHaveCount(1);

    await aboutMe.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    await page.keyboard.press("Tab");
    await expect(aboutMe).toHaveValue("  alpha\n  beta");
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect(aboutMe).toHaveValue("alpha\nbeta");

    await fields.getByRole("button", { name: "Expand editor", exact: true }).first().click();
    const expandedEditor = page.locator('[data-component="ExpandedMacroEditor"] textarea');
    await expect(expandedEditor).toHaveValue("alpha\nbeta");

    await expandedEditor.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    await page.keyboard.type("!");
    await expect(expandedEditor).toHaveValue("alpha\nbeta!");
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect(expandedEditor).toHaveValue("alpha\nbeta");

    await expandedEditor.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    await page.keyboard.press("Tab");
    await expect(expandedEditor).toHaveValue("  alpha\n  beta");
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect(expandedEditor).toHaveValue("alpha\nbeta");

    await expandedEditor.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(expandedEditor).toHaveValue("alpha\nbeta");
  } finally {
    await page.request.delete(`/api/characters/${character.id}`);
  }
});

test("Conversation membership notices begin only after the chat starts", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Conversation membership regression is covered on desktop.");

  const createCharacter = async (name: string) => {
    const response = await request.post("/api/characters", {
      data: { data: { name, first_mes: `Hello from ${name}.` } },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string };
  };

  const firstCharacter = await createCharacter("Greeting Seed One");
  const secondCharacter = await createCharacter("Greeting Seed Two");
  const thirdCharacter = await createCharacter("Later Join Three");
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Conversation Membership Smoke", mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const initialAssignment = await request.patch(`/api/chats/${chat.id}`, {
      data: { characterIds: [firstCharacter.id] },
    });
    expect(initialAssignment.ok()).toBeTruthy();
    const messagesAfterSetup = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
      role: string;
      content: string;
    }>;
    expect(messagesAfterSetup).toEqual([]);

    const laterAssignment = await request.patch(`/api/chats/${chat.id}`, {
      data: { characterIds: [firstCharacter.id, secondCharacter.id] },
    });
    expect(laterAssignment.ok()).toBeTruthy();
    const messagesAfterSetupChanges = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
      role: string;
      content: string;
    }>;
    expect(messagesAfterSetupChanges).toEqual([]);

    const finishSetup = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { conversationSetupComplete: true },
    });
    expect(finishSetup.ok()).toBeTruthy();

    const postStartAssignment = await request.patch(`/api/chats/${chat.id}`, {
      data: { characterIds: [firstCharacter.id, secondCharacter.id, thirdCharacter.id] },
    });
    expect(postStartAssignment.ok()).toBeTruthy();
    const messagesAfterLaterJoin = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
      role: string;
      content: string;
    }>;
    expect(messagesAfterLaterJoin).toHaveLength(1);
    expect(messagesAfterLaterJoin[0]).toMatchObject({
      role: "system",
      content: "Later Join Three has joined the chat.",
    });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/${firstCharacter.id}`);
    await request.delete(`/api/characters/${secondCharacter.id}`);
    await request.delete(`/api/characters/${thirdCharacter.id}`);
  }
});

test("provider concurrency errors appear in generation toasts", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Generation error toast regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Provider Concurrency Toast Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "concurrency-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Provider concurrency limit exceeded for this account" }),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    await page.locator("textarea.mari-chat-input-textarea").fill("Test the provider limit");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(
      page.getByText(
        "The provider's concurrency limit was reached. Wait for another generation to finish, then try again. Provider message: Provider concurrency limit exceeded for this account",
      ),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("generation fallbacks identify the replacement connection in a toast", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Fallback toast regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Fallback Toast Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "fallback-toast-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.route("**/api/generate", async (route) => {
      const events = [
        {
          type: "fallback_used",
          data: {
            category: "main",
            connectionId: "backup-api",
            connectionName: "Backup API",
            model: "fallback-model",
          },
        },
        { type: "token", data: "Fallback response." },
        { type: "done", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    await page.locator("textarea.mari-chat-input-textarea").fill("Use the fallback if necessary");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(page.getByText("Main switched to Backup API (fallback-model).")).toBeVisible();
    await expect(
      page.getByText("The primary generation failed, so Marinara retried with your configured fallback."),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Roleplay rewrite streaming follows the rendered message height", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Roleplay rewrite scrolling is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Rewrite Scroll Follow Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "rewrite-scroll-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    for (let index = 0; index < 8; index += 1) {
      const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 === 0 ? "user" : "assistant",
          content: `Earlier transcript ${index + 1}. ${"Context keeps this message tall. ".repeat(12)}`,
        },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }

    const originalText = "The short original response.";
    const rewrittenText = Array.from(
      { length: 120 },
      (_, index) => `Rewritten line ${index + 1} keeps unfolding beneath the visible transcript boundary.`,
    ).join("\n");
    const savedMessage = {
      id: "__rewrite_scroll_saved__",
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: originalText,
      activeSwipeIndex: 0,
      extra: { postProcessingPending: { agentType: "prose-guardian" } },
      createdAt: new Date().toISOString(),
    };

    await page.route("**/api/generate", async (route) => {
      const events = [
        { type: "token", data: originalText },
        { type: "message_saved", data: savedMessage },
        {
          type: "text_rewrite",
          data: {
            editedText: rewrittenText,
            rewriteApplied: true,
            originalText,
            agentType: "prose-guardian",
          },
        },
        { type: "done", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.enableStreaming = true;
      persisted.state.streamingSpeed = 90;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const scroller = page.locator("[data-chat-scroll]");
    await expect(scroller).toBeVisible();
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeLessThan(12);

    await page.locator("textarea.mari-chat-input-textarea").fill("Rewrite and stream this response");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(page.locator('[data-message-id="__streaming__"]')).toBeVisible();
    const initialScrollTop = await scroller.evaluate((element) => element.scrollTop);

    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop), { timeout: 15_000 })
      .toBeGreaterThan(initialScrollTop + 80);
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeLessThan(40);

    await page.locator("button.mari-chat-send-btn").click();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("editing the preceding Roleplay message keeps one live stream row", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "Roleplay edit-during-stream regression is covered on desktop.",
  );

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Edit During Stream Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "edit-during-stream-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const responseText = Array.from(
      { length: 80 },
      (_, index) => `Streaming line ${index + 1} remains owned by one presentation row.`,
    ).join("\n");
    const savedMessage = {
      id: "__edit_during_stream_saved__",
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: responseText,
      activeSwipeIndex: 0,
      extra: {},
      createdAt: new Date().toISOString(),
    };

    await page.route("**/api/generate", async (route) => {
      const events = [
        { type: "token", data: responseText },
        { type: "message_saved", data: savedMessage },
        { type: "agent_start", data: { phase: "post_generation" } },
        {
          type: "agent_result",
          data: {
            agentType: "world-state",
            agentName: "World State",
            resultType: "game_state_update",
            data: {},
            success: true,
            error: null,
            durationMs: 10,
          },
        },
        { type: "done", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.enableStreaming = true;
      persisted.state.streamingSpeed = 55;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await page.locator("textarea.mari-chat-input-textarea").fill("Please answer while I edit this message.");
    await page.locator("button.mari-chat-send-btn").click();

    const liveStream = page.locator('[data-message-id="__streaming__"]');
    const visibleAssistantRows = page.locator('[data-message-role="assistant"]');
    await expect(liveStream).toHaveCount(1);
    await expect(visibleAssistantRows).toHaveCount(1);
    const userMessage = page.locator('[data-message-role="user"]').last();
    await userMessage.hover();
    await userMessage.getByTitle("Edit").click();
    await expect(userMessage.locator("textarea")).toBeVisible();
    await expect(liveStream).toHaveCount(1);
    await expect(visibleAssistantRows).toHaveCount(1);

    await userMessage.getByLabel("Cancel edit").click();
    await expect(userMessage.locator("textarea")).toHaveCount(0);
    await expect(liveStream).toHaveCount(1);
    await expect(visibleAssistantRows).toHaveCount(1);

    await page.locator("button.mari-chat-send-btn").click();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Roleplay side panels synchronize their slide with the desktop shell resize", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop panel animation regression.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Roleplay Panel Performance Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    for (let index = 0; index < 48; index += 1) {
      const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 === 0 ? "user" : "assistant",
          content: `**Transcript ${index + 1}.** ${"A long roleplay paragraph exercises responsive line wrapping. ".repeat(18)}`,
        },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    const charactersButton = page.getByTitle("Characters");
    await expect(charactersButton).toBeVisible();

    // Exercise the panel over a dense transcript, including its lazy first open.
    await charactersButton.click();
    await expect(page.locator('[data-component="RightPanel"]')).toBeVisible();
    const rightSlot = page.locator('[data-component="RightPanelDesktopSlot"]');
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    const leftSlot = page.locator('[data-component="ChatSidebarSlot"]');
    const leftPanel = page.locator('[data-component="ChatSidebarPanel"]');
    const centerContent = page.locator('[data-component="CenterContent"]');
    await expect(rightPanel).toHaveClass(/mari-shell-panel-enter-right/);
    await rightSlot.evaluate(async (element) => {
      const panel = element.querySelector('[data-component="RightPanelDesktop"]');
      await Promise.all(
        [element, panel]
          .flatMap((target) => target?.getAnimations() ?? [])
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const openRightSlotWidth = (await rightSlot.boundingBox())?.width ?? 0;
    const openRightPanelX = (await rightPanel.boundingBox())?.x ?? 0;
    const centerWidthWithRightPanel = (await centerContent.boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(rightPanel).toHaveClass(/mari-shell-panel-exit-right/);
    await expect(rightSlot).not.toHaveCSS("width", "0px");
    await page.waitForTimeout(70);
    const closingRightSlotWidth = (await rightSlot.boundingBox())?.width ?? 0;
    expect(closingRightSlotWidth).toBeGreaterThan(0);
    expect(closingRightSlotWidth).toBeLessThan(openRightSlotWidth);
    expect((await rightPanel.boundingBox())?.x ?? 0).toBeGreaterThan(openRightPanelX + 8);
    expect((await centerContent.boundingBox())?.width ?? 0).toBeGreaterThan(centerWidthWithRightPanel);
    await expect(rightSlot).toHaveCSS("width", "0px");

    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expect(leftSlot).not.toHaveCSS("width", "0px");
    await expect(leftPanel).toHaveClass(/mari-shell-panel-enter-left/);
    await leftSlot.evaluate(async (element) => {
      const panel = element.querySelector('[data-component="ChatSidebarPanel"]');
      await Promise.all(
        [element, panel]
          .flatMap((target) => target?.getAnimations() ?? [])
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const openLeftSlotWidth = (await leftSlot.boundingBox())?.width ?? 0;
    const openLeftPanelX = (await leftPanel.boundingBox())?.x ?? 0;
    const centerWidthWithLeftPanel = (await centerContent.boundingBox())?.width ?? 0;
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expect(leftPanel).toHaveClass(/mari-shell-panel-exit-left/);
    await expect(leftSlot).not.toHaveCSS("width", "0px");
    await page.waitForTimeout(70);
    const closingLeftSlotWidth = (await leftSlot.boundingBox())?.width ?? 0;
    expect(closingLeftSlotWidth).toBeGreaterThan(0);
    expect(closingLeftSlotWidth).toBeLessThan(openLeftSlotWidth);
    expect((await leftPanel.boundingBox())?.x ?? 0).toBeLessThan(openLeftPanelX - 8);
    expect((await centerContent.boundingBox())?.width ?? 0).toBeGreaterThan(centerWidthWithLeftPanel);
    await expect(leftSlot).toHaveCSS("width", "0px");

    for (const [slot, panel] of [
      [rightSlot, rightPanel],
      [leftSlot, leftPanel],
    ] as const) {
      const slotTransitions = await slot.evaluate((element) => getComputedStyle(element).transitionProperty);
      const panelTransitions = await panel.evaluate((element) => getComputedStyle(element).transitionProperty);
      expect(slotTransitions.split(",").map((property) => property.trim())).toContain("width");
      expect(panelTransitions.split(",").map((property) => property.trim())).toContain("transform");
      expect(panelTransitions.split(",").map((property) => property.trim())).not.toContain("width");
    }
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("desktop Tracker stays in the Roleplay gutter without shifting the chat column", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop Tracker gutter behavior is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Tracker Gutter Layout Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.setViewportSize({ width: 1200, height: 900 });
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: [] },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.trackerPanelEnabled = true;
      persisted.state.trackerPanelOpen = false;
      persisted.state.trackerPanelSide = "left";
      persisted.state.trackerPanelSizeProfile = "expanded";
      persisted.state.trackerPanelHideHudWidgets = false;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const main = page.locator('[data-component="CenterContent"]');
    const chatColumn = page.locator('[data-roleplay-chat-column="true"]');
    const trackerToggle = page.locator('[data-tracker-panel-toggle="roleplay-hud"]:visible').first();
    await expect(chatColumn).toBeVisible();
    await expect(trackerToggle).toBeVisible();
    const chatColumnBefore = await chatColumn.boundingBox();
    expect(chatColumnBefore).not.toBeNull();

    await trackerToggle.click();
    const tracker = page.locator('[data-component="TrackerDataSidebarDesktop.left"]');
    await expect(tracker).toBeVisible();
    await tracker.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)),
      );
    });

    const [mainBox, chatColumnAfter, trackerBox] = await Promise.all([
      main.boundingBox(),
      chatColumn.boundingBox(),
      tracker.boundingBox(),
    ]);
    expect(mainBox).not.toBeNull();
    expect(chatColumnAfter).not.toBeNull();
    expect(trackerBox).not.toBeNull();
    expect(Math.abs(chatColumnAfter!.x - chatColumnBefore!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(chatColumnAfter!.width - chatColumnBefore!.width)).toBeLessThanOrEqual(1);

    const expectedWidth = Math.min(420, Math.floor(chatColumnAfter!.x - mainBox!.x - 8));
    expect(Math.abs(trackerBox!.width - expectedWidth)).toBeLessThanOrEqual(1);
    expect(trackerBox!.x + trackerBox!.width).toBeLessThanOrEqual(chatColumnAfter!.x - 7);

    const trackerContent = tracker.locator(".mari-tracker-panel-scroll");
    const expectedScale = Math.max(0.65, expectedWidth / 420);
    const appliedScale = Number(await trackerContent.getAttribute("data-tracker-content-scale"));
    expect(Math.abs(appliedScale - expectedScale)).toBeLessThanOrEqual(0.001);
    const emptyTrackerText = tracker.getByText("No tracker data yet.", { exact: true });
    await expect(emptyTrackerText).toBeVisible();
    const [emptyTextFontSize, rootFontSize] = await emptyTrackerText.evaluate((element) => [
      parseFloat(getComputedStyle(element).fontSize),
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    ]);
    expect(Math.abs(emptyTextFontSize - rootFontSize * 0.6875 * expectedScale)).toBeLessThanOrEqual(0.1);

    const trackerContentBox = await trackerContent.boundingBox();
    expect(trackerContentBox).not.toBeNull();
    expect(trackerContentBox!.x).toBeGreaterThanOrEqual(trackerBox!.x - 1);
    expect(trackerContentBox!.x + trackerContentBox!.width).toBeLessThanOrEqual(
      trackerBox!.x + trackerBox!.width + 1,
    );

    await tracker.getByRole("button", { name: "Open tracker settings" }).click();
    await expect(tracker.getByRole("toolbar", { name: "Tracker panel settings" })).toBeVisible();
    await tracker.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const horizontalOverflow = await trackerContent.evaluate((root) => {
      let overflow: { className: string; clientWidth: number; depth: number; scrollWidth: number; tagName: string } | null =
        null;
      const scan = (node: Element, depth: number) => {
        if (overflow || depth > 6) return;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (node.scrollWidth > node.clientWidth + 1) {
          overflow = {
            className: node.className,
            clientWidth: node.clientWidth,
            depth,
            scrollWidth: node.scrollWidth,
            tagName: node.tagName,
          };
          return;
        }
        for (let i = 0; i < node.children.length; i++) {
          scan(node.children[i]!, depth + 1);
        }
      };
      scan(root, 0);
      return overflow;
    });
    expect(horizontalOverflow).toBeNull();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Roleplay Active Context shows rich lorebook activation provenance", async ({ page, request }, testInfo) => {
  const lorebookId = "roleplay-active-context-smoke-lorebook";
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Roleplay Active Context Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { activeLorebookIds: [lorebookId] },
  });
  expect(metadataResponse.ok()).toBeTruthy();

  await page.route(`**/api/lorebooks/scan/${chat.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        entries: [
          {
            id: "semantic-entry",
            name: "Whispered Archive",
            content: "The archive answers only to a carefully spoken passphrase.",
            keys: ["archive", "passphrase"],
            lorebookId,
            lorebookName: "Archive Codex",
            activationSources: ["keyword", "semantic"],
            order: 20,
            constant: false,
            selective: false,
            matchedKeys: ["archive"],
            matchType: "semantic",
            semanticScore: 0.864,
          },
          {
            id: "location-entry",
            name: "Northland Bank",
            content: "The bank occupies the northern edge of the square.",
            keys: ["bank"],
            lorebookId,
            lorebookName: "Archive Codex",
            activationSources: ["current_location"],
            order: 10,
            constant: false,
            selective: true,
            matchedKeys: ["bank"],
            matchType: "keyword",
          },
        ],
        budgetSkippedEntries: [
          {
            id: "skipped-entry",
            name: "Sealed Annex",
            lorebookId,
            lorebookName: "Archive Codex",
            matchedKeys: ["annex"],
            activationSources: ["keyword"],
            matchType: "keyword",
            estimatedTokens: 144,
            lorebookBudget: 400,
            lorebookUsedTokens: 360,
            chatBudget: 900,
            chatUsedTokens: 500,
            blockedBy: "lorebook",
          },
        ],
        totalTokens: 321,
        totalEntries: 2,
      }),
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options" }).click();
    }
    await page.locator('button[aria-label="Active Context"]:visible').click();

    const panel = page.locator('[data-component="RoleplayActiveContextPanel"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText("2 active • ~321 tokens", { exact: true })).toBeVisible();
    await expect(panel.getByRole("region", { name: "Current location lore" })).toContainText("Northland Bank");
    await expect(panel.getByText("Whispered Archive", { exact: true })).toBeVisible();
    await expect(panel.getByText("Vector 0.864", { exact: true })).toBeVisible();
    await expect(panel.getByText("Archive Codex · keyword, semantic", { exact: true })).toBeVisible();
    await expect(panel.getByText("Keys: archive, passphrase", { exact: true })).toBeVisible();
    await expect(panel.getByText("Matched: archive", { exact: true })).toBeVisible();

    await panel.getByText("Whispered Archive", { exact: true }).click();
    await expect(panel.getByText("The archive answers only to a carefully spoken passphrase.", { exact: true })).toBeVisible();
    await panel.getByText("1 matching lore entry was skipped by token budget", { exact: true }).click();
    await expect(panel.getByText("Sealed Annex", { exact: true })).toBeVisible();
    await panel.getByText("Sealed Annex", { exact: true }).click();
    await expect(panel.getByText("Budget used before entry: 360 / 400", { exact: true })).toBeVisible();

    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width);
    await testInfo.attach("roleplay-active-context.png", {
      body: await panel.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("rewrite shield switches repeatedly between original and rewritten message versions", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Rewrite version toolbar regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Rewrite Version Toggle Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const originalText = "The original assistant reply for comparison.";
  const rewrittenText = "The polished rewritten assistant reply for comparison.";

  try {
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: rewrittenText,
        extra: {
          proseGuardianOriginalText: originalText,
          proseGuardianRewrittenText: rewrittenText,
          proseGuardianRewrittenAt: new Date().toISOString(),
        },
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await expect(page.getByText(rewrittenText, { exact: true })).toBeVisible();
    await page.getByText(rewrittenText, { exact: true }).hover();
    await page.getByTitle("Show original before rewrite").click();
    await expect(page.getByText(originalText, { exact: true })).toBeVisible();

    await page.getByText(originalText, { exact: true }).hover();
    await page.getByTitle("Show rewritten version").click();
    await expect(page.getByText(rewrittenText, { exact: true })).toBeVisible();
    await expect(page.getByTitle("Show original before rewrite")).toBeAttached();

    await page.getByText(rewrittenText, { exact: true }).hover();
    await page.getByTitle("Show original before rewrite").click();
    await expect(page.getByText(originalText, { exact: true })).toBeVisible();

    await page.getByText(originalText, { exact: true }).hover();
    await page.getByTitle("Show rewritten version").click();
    await expect(page.getByText(rewrittenText, { exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("historical Game Peek Prompt returns the exact selected turn request", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Historical prompt API regression is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Historical Game Prompt Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const firstMessageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "First game turn",
        extra: {
          cachedPrompt: [
            { role: "system", content: "Exact first system prompt" },
            { role: "user", content: "Exact first player input" },
          ],
          chatSummaryFingerprint: "historical-summary",
          generationInfo: { model: "test-game-model", provider: "custom" },
        },
      },
    });
    expect(firstMessageResponse.ok()).toBeTruthy();
    const firstMessage = (await firstMessageResponse.json()) as { id: string };

    const secondMessageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "Second game turn",
        extra: {
          cachedPrompt: [{ role: "user", content: "Exact second player input" }],
          generationInfo: { model: "test-game-model", provider: "custom" },
        },
      },
    });
    expect(secondMessageResponse.ok()).toBeTruthy();

    const peekResponse = await request.post(`/api/chats/${chat.id}/peek-prompt`, {
      data: { messageId: firstMessage.id },
    });
    expect(peekResponse.ok()).toBeTruthy();
    const peek = (await peekResponse.json()) as {
      source: string;
      exact: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(peek.source).toBe("cached");
    expect(peek.exact).toBe(true);
    expect(peek.messages).toEqual([
      { role: "system", content: "Exact first system prompt" },
      { role: "user", content: "Exact first player input" },
    ]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("game widget edits preserve their live numeric values", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game widget persistence is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Game Widget Value Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const widgets = [
      {
        id: "party-health",
        type: "gauge",
        label: "Party health",
        position: "hud_left",
        config: { startingValue: 20, value: 55, max: 100 },
      },
    ];
    const updateResponse = await request.put(`/api/game/${chat.id}/widgets`, { data: { widgets } });
    expect(updateResponse.ok()).toBeTruthy();

    const storedResponse = await request.get(`/api/chats/${chat.id}`);
    expect(storedResponse.ok()).toBeTruthy();
    const storedChat = (await storedResponse.json()) as { metadata: string | Record<string, unknown> };
    const metadata =
      typeof storedChat.metadata === "string"
        ? (JSON.parse(storedChat.metadata) as Record<string, unknown>)
        : storedChat.metadata;
    const storedWidgets = metadata.gameWidgetState as typeof widgets;
    expect(storedWidgets[0]?.config).toMatchObject({ startingValue: 20, value: 55, max: 100 });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("NPC avatar uploads accept Cyrillic character names", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "NPC avatar upload compatibility is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Unicode NPC Avatar Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const uploadResponse = await request.post(`/api/avatars/npc/${chat.id}`, {
      data: {
        name: "Корвин",
        avatar: `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`,
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const upload = (await uploadResponse.json()) as { avatarPath: string };
    expect(decodeURIComponent(upload.avatarPath)).toContain("/корвин.gif?");

    const imageResponse = await request.get(upload.avatarPath);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"]).toBe("image/gif");
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("PocketTTS discovers server voices and uses its speech endpoint", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "PocketTTS routing is covered on desktop.");

  let receivedPath = "";
  let receivedContentType = "";
  let receivedBody = "";
  const pocketTts = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    incoming.on("end", () => {
      receivedPath = incoming.url ?? "";
      receivedContentType = String(incoming.headers["content-type"] ?? "");
      receivedBody = Buffer.concat(chunks).toString("utf8");
      if (incoming.method === "GET" && incoming.url === "/v1/voices") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            object: "list",
            data: [
              { id: "alba", name: "Alba", object: "voice", type: "builtin" },
              { id: "AgentCobra.wav", name: "Agent Cobra", object: "voice", type: "custom" },
            ],
          }),
        );
        return;
      }
      response.writeHead(200, { "Content-Type": "audio/mpeg" });
      response.end(Buffer.from([0x49, 0x44, 0x33]));
    });
  });
  await new Promise<void>((resolve) => pocketTts.listen(0, "127.0.0.1", resolve));
  let originalConfig: unknown;

  try {
    const address = pocketTts.address();
    if (!address || typeof address === "string") throw new Error("PocketTTS mock did not bind to a TCP port");

    const originalConfigResponse = await request.get("/api/tts/config");
    expect(originalConfigResponse.ok()).toBeTruthy();
    originalConfig = await originalConfigResponse.json();

    const configResponse = await request.put("/api/tts/config", {
      data: {
        enabled: true,
        source: "pockettts",
        baseUrl: `http://127.0.0.1:${address.port}`,
        model: "pocket-tts",
        voice: "alba",
        audioFormat: "mp3",
      },
    });
    expect(configResponse.ok()).toBeTruthy();

    const voicesResponse = await request.get("/api/tts/voices");
    expect(voicesResponse.ok()).toBeTruthy();
    expect(receivedPath).toBe("/v1/voices");
    expect(await voicesResponse.json()).toEqual({
      voices: ["alba", "AgentCobra.wav"],
      voiceOptions: [
        {
          id: "alba",
          name: "Alba",
          description: null,
          previewUrl: null,
          category: "builtin",
          labels: null,
        },
        {
          id: "AgentCobra.wav",
          name: "Agent Cobra",
          description: null,
          previewUrl: null,
          category: "custom",
          labels: null,
        },
      ],
      fromProvider: true,
      source: "pockettts",
    });

    const speechResponse = await request.post("/api/tts/speak", {
      data: { text: "Hello from Marinara." },
    });
    expect(speechResponse.ok()).toBeTruthy();
    expect(receivedPath).toBe("/v1/audio/speech");
    expect(receivedContentType).toContain("application/json");
    expect(JSON.parse(receivedBody)).toMatchObject({
      model: "pocket-tts",
      input: "Hello from Marinara.",
      voice: "alba",
      response_format: "mp3",
      speed: 1,
    });

    const fallbackConfigResponse = await request.put("/api/tts/config", {
      data: {
        enabled: true,
        source: "pockettts",
        baseUrl: `http://127.0.0.1:${address.port}`,
        model: "pocket-tts",
        voice: "",
        audioFormat: "mp3",
      },
    });
    expect(fallbackConfigResponse.ok()).toBeTruthy();

    const fallbackSpeechResponse = await request.post("/api/tts/speak", {
      data: { text: "Use the default PocketTTS voice." },
    });
    expect(fallbackSpeechResponse.ok()).toBeTruthy();
    expect(JSON.parse(receivedBody)).toMatchObject({
      input: "Use the default PocketTTS voice.",
      voice: "alba",
    });

    await page.goto("/");
    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanel"]');
    await expect(rightPanel).toBeVisible();
    const ttsLabel = rightPanel.getByText("Text to Speech", { exact: true });
    const ttsCard = ttsLabel.locator("xpath=../../..");
    await ttsCard.getByTitle("Expand").click();
    const serverVoiceSelect = ttsCard.getByLabel("PocketTTS server voice");
    await expect(serverVoiceSelect.locator('option[value="AgentCobra.wav"]')).toHaveText(
      "Agent Cobra (AgentCobra.wav)",
    );
    await expect(ttsCard.getByText("Loaded 2 voices from PocketTTS server.", { exact: true })).toBeVisible();

    await ttsCard.getByText("Only read dialogues", { exact: true }).click();
    const dialoguePause = ttsCard.getByLabel("Pause between dialogues in seconds");
    await expect(dialoguePause).toHaveAttribute("min", "1");
    await expect(dialoguePause).toHaveAttribute("max", "60");
    await expect(dialoguePause).toHaveAttribute("step", "1");
    await expect(dialoguePause).toHaveValue("1");
    await expect(ttsCard.getByText("Pause between dialogues: 1 second", { exact: true })).toBeVisible();

    await dialoguePause.fill("60");
    await expect(ttsCard.getByText("Pause between dialogues: 60 seconds", { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const response = await request.get("/api/tts/config");
        const config = (await response.json()) as { dialoguePauseMs?: number };
        return config.dialoguePauseMs;
      })
      .toBe(60_000);
  } finally {
    try {
      if (originalConfig !== undefined) await request.put("/api/tts/config", { data: originalConfig });
    } finally {
      await new Promise<void>((resolve, reject) => {
        pocketTts.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
});

test("failed Game Lorebook Keeper run exposes a retry action", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game session recovery regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Lorebook Retry Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: "lorebook-retry-smoke-game",
        gameSessionStatus: "concluded",
        gameLorebookKeeperEnabled: true,
        gamePreviousSessionSummaries: [
          {
            summary: "The party escaped the test dungeon.",
            resumePoint: "Outside the dungeon gate.",
            partyDynamics: "Relieved.",
            keyDiscoveries: [],
            characterMoments: [],
            littleDetails: [],
            npcUpdates: [],
            statsSnapshot: {},
            timestamp: new Date().toISOString(),
          },
        ],
        gameLorebookKeeperLastRun: {
          sessionNumber: 1,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: "Structured lorebook output was invalid.",
        },
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The session has concluded." },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    await page.getByRole("button", { name: "Session" }).click();
    const failure = page.locator('[data-component="GameSessionHistory.LorebookKeeperFailure"]');
    await expect(failure).toContainText("Lorebook Keeper failed");
    await expect(failure.getByRole("button", { name: "Retry Lorebook Keeper" })).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game history above the dialogue box opens a historical Peek Prompt", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game historical prompt UI regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Game Prompt History Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { gameId: "prompt-history-smoke-game", gameSessionStatus: "active", gameSessionNumber: 1 },
    });
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", content: "Open the old gate." },
    });
    const historicalTurnResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "The old gate opens with a groan.",
        extra: {
          cachedPrompt: [
            { role: "system", content: "Exact historical Game Master prompt" },
            { role: "user", content: "Open the old gate." },
          ],
        },
      },
    });
    expect(historicalTurnResponse.ok()).toBeTruthy();
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", content: "Step through." },
    });
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "Beyond it waits a moonlit hall.",
        extra: { cachedPrompt: [{ role: "user", content: "Step through." }] },
      },
    });

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            gameDialogueDisplayMode: "stacked",
          },
          version: 65,
        }),
      );
    }, chat.id);
    await page.goto("/");
    const peekButton = page.locator('[data-component="GameNarration.PeekPrompt"]').first();
    await expect(peekButton).toBeVisible();
    await peekButton.click();
    await expect(page.getByRole("heading", { name: "Assembled Prompt" })).toBeVisible();
    await expect(page.getByText("This is the exact cached text prompt sent for the selected turn.")).toBeVisible();
    await page.getByRole("button", { name: /System/ }).click();
    await expect(page.getByText("Exact historical Game Master prompt")).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("home shell and primary topbar panels open without client errors", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto("/");

  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Marinara Engine" })).toBeVisible();

  const charactersButton = page.locator('[data-tour="panel-characters"]');
  await expect(charactersButton.locator("svg")).toHaveClass(/mari-topbar-accent-icon/);

  for (const selector of [
    '[data-tour="sidebar-toggle"]',
    '[data-tour="panel-bot-browser"]',
    '[data-tour="panel-characters"]',
    '[data-tour="panel-lorebooks"]',
    '[data-tour="panel-presets"]',
    '[data-tour="panel-connections"]',
    '[data-tour="panel-agents"]',
    '[data-tour="panel-personas"]',
    '[data-tour="panel-settings"]',
  ]) {
    await page.locator(selector).click();
    await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
    if (selector === '[data-tour="panel-characters"]') {
      await expect(page.locator('[data-component="RightPanelHeaderIcon"]')).toHaveClass(
        /mari-panel-gradient--characters/,
      );
    }
  }

  const health = await page.request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Card Browser labels and the Persona full library stay available across viewports", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.route("**/api/bot-browser/chub/search?*", async (route) => {
    await route.fulfill({
      status: 503,
      json: { error: "offline" },
    });
  });
  await page.goto("/");

  await page.locator('[data-tour="panel-bot-browser"]').click();
  await expect(page.getByText("Card Browser", { exact: true })).toBeVisible();
  const downloadCards = page.getByRole("button", { name: "Download Cards" });
  await expect(downloadCards).toBeVisible();
  await downloadCards.click();

  const cardLibrary = page.locator('[data-component="BotBrowserView"]');
  await expect(cardLibrary.getByText("Cards Library", { exact: true })).toBeVisible();
  await expect(cardLibrary.getByRole("heading", { name: "Browse character cards online" })).toBeVisible();
  const searchError = cardLibrary.getByText("Search failed", { exact: true });
  await expect(searchError).toBeVisible();
  await expect(searchError).toHaveClass(/marinara-chat-chrome-panel-title/);
  const closeCardLibrary = cardLibrary.getByRole("button", { name: "Close library" });
  await expect(closeCardLibrary).toBeVisible();
  await closeCardLibrary.click();

  await page.locator('[data-tour="panel-personas"]').click();
  const openPersonaLibrary = page.getByRole("button", { name: "Open Full Library" });
  await expect(openPersonaLibrary).toBeVisible();
  await openPersonaLibrary.click();

  await expect(page.getByText("Persona Library", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse your personas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New persona" })).toBeVisible();
  await expect(
    page.locator('[data-component="CharacterLibraryView"]').getByPlaceholder("Search personas"),
  ).toBeVisible();
  await expect(page.locator('[data-tour="panel-personas"]')).toHaveClass(/mari-topbar-panel-icon--active/);
  await expect(page.locator('[data-tour="panel-characters"]')).not.toHaveClass(/bg-\[var\(--accent\)\]/);
  expect(errors.filter((error) => !error.includes("status of 503 (Service Unavailable)"))).toEqual([]);
});

test("downloadable agent catalog is usable on desktop and mobile", async ({ page }, testInfo) => {
  const errors = collectUnexpectedErrors(page);
  const catalogPackages = [
    {
      id: "uno",
      name: "UNO",
      description: "Play UNO with Conversation characters.",
      category: "misc",
    },
    {
      id: "prose-guardian",
      name: "Prose Guardian",
      description: "Keeps generated prose focused and consistent.",
      category: "writer",
    },
    {
      id: "character-tracker",
      name: "Character Tracker",
      description: "Tracks durable character state changes.",
      category: "tracker",
    },
    {
      id: "card-evolution-auditor",
      name: "Card Evolution Auditor",
      description: "Proposes durable character-card updates for review.",
      category: "writer",
    },
    {
      id: "hierarchical-maps",
      name: "Hierarchical Maps",
      description: "Tracks locations and spatial context.",
      category: "tracker",
    },
  ].map(({ id, name, description, category }) => ({
    category,
    manifest: {
      schemaVersion: 1,
      id,
      name,
      version: "1.0.0",
      description,
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { agents: "agents.json" },
      files: [],
      permissions: ["agent-runtime", "chat-read", "prompt-context", "ui"],
      restartRequired: false,
    },
    artifact: { url: `https://example.com/${id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
    documentationUrl: `https://github.com/Pasta-Devs/Marinara-Agents#${id}`,
  }));
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-14T00:00:00.000Z",
        packages: catalogPackages,
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/custom-agent-repositories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enabled: true, repositories: [] }),
    });
  });
  await page.route("**/api/custom-agent-repositories/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        repository: {
          id: "0123456789abcdef",
          url: "https://github.com/example/community-agents",
          owner: "example",
          name: "community-agents",
        },
        digest: "a".repeat(64),
        changes: [
          {
            agentId: "continuity-helper",
            name: "Continuity Helper",
            status: "new",
            changedFields: [],
            definition: {
              id: "continuity-helper",
              name: "Continuity Helper",
              description: "Checks recent turns for contradictions.",
              phase: "post_processing",
              enabledByDefault: false,
              category: "writer",
              defaultTools: ["search_messages"],
              defaultPromptTemplate: "Check {{messages}} for continuity errors.",
            },
          },
        ],
      }),
    });
  });
  await page.goto("/");
  await page.locator('[data-tour="panel-characters"]').click();
  await page.getByRole("button", { name: "Open Full Library" }).click();
  await expect(page.getByRole("heading", { name: "Browse your characters" })).toBeVisible();
  await expect(
    page.locator('[data-component="CharacterLibraryView"]').getByPlaceholder('Search characters or -tag:"tag name"'),
  ).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await expect(page.locator('[data-component="RightPanelMobile"]')).toHaveCount(0);
  } else {
    await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
  }
  await page.getByTitle("Close library").click();

  await page.locator('[data-tour="panel-agents"]').click();
  await expect(page.getByText("No Agents installed yet, click Download Agents to add them!")).toBeVisible();
  await page.getByLabel("Agents").getByRole("button", { name: "Download Agents", exact: true }).click();

  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  if (testInfo.project.name.includes("mobile")) {
    await expect(page.locator('[data-component="RightPanelMobile"]')).toHaveCount(0);
  } else {
    await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
  }
  await expect(catalogView.getByRole("heading", { name: "Download Agents" })).toBeVisible();
  await expect(catalogView.getByRole("heading", { name: "Installed Agents", exact: true })).toBeVisible();
  await expect(catalogView.getByRole("heading", { name: "Uninstalled Agents", exact: true })).toBeVisible();
  await expect(catalogView.locator("aside h3")).toHaveText(["Writer Agents", "Tracker Agents", "Misc Agents"]);
  const writerSection = catalogView.locator("aside h3", { hasText: "Writer Agents" }).locator("..");
  const trackerSection = catalogView.locator("aside h3", { hasText: "Tracker Agents" }).locator("..");
  await expect(writerSection.getByText("Card Evolution Auditor", { exact: true })).toBeVisible();
  await expect(trackerSection.getByText("Hierarchical Maps", { exact: true })).toBeVisible();
  await expect(catalogView.getByText("About Me Keeper")).toHaveCount(0);
  await expect(catalogView.getByText("Play UNO with Conversation characters.").first()).toBeVisible();
  const allAgentsButton = catalogView.locator("button", { hasText: "All agents" });
  if (testInfo.project.name.includes("mobile")) {
    await catalogView.getByRole("button", { name: "UNO Play UNO with Conversation characters.", exact: true }).click();
    await expect(allAgentsButton).toBeVisible();
    await allAgentsButton.click();
    await expect(allAgentsButton).toBeHidden();
    await catalogView.getByRole("button", { name: "UNO Play UNO with Conversation characters.", exact: true }).click();
  } else {
    await expect(allAgentsButton).toBeHidden();
  }
  await expect(catalogView.getByText("Marinara Engine v2.3.0+")).toBeVisible();
  await expect(catalogView.getByRole("link", { name: "Read how this agent works" })).toHaveAttribute(
    "href",
    "https://github.com/Pasta-Devs/Marinara-Agents#uno",
  );
  await expect(catalogView.getByRole("button", { name: "Install", exact: true })).toBeVisible();
  await catalogView.getByRole("button", { name: "Custom Sources" }).click();
  const customSources = page.getByRole("dialog", { name: "Custom Agent Repositories" });
  await expect(customSources.getByText(/not affiliated with or vetted by PastaDevs/u)).toBeVisible();
  await customSources.getByLabel("GitHub agent repository URL").fill("https://github.com/example/community-agents");
  await customSources.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(customSources.getByRole("heading", { name: "example/community-agents" })).toBeVisible();
  await expect(customSources.getByText("Continuity Helper", { exact: true })).toBeVisible();
  await customSources.getByRole("button", { name: "Add Repository" }).click();
  const trustConfirmation = page.getByRole("dialog", { name: "Add this custom repository?" });
  await expect(trustConfirmation.getByText(/Custom agents can run tools/u)).toBeVisible();
  await trustConfirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(customSources).toBeVisible();
  expect(errors).toEqual([]);
});

test("agent catalog reports API failures without diagnosing an internet outage", async ({ page }) => {
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Validation Error" }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-agents"]').click();
  await page.getByLabel("Agents").getByRole("button", { name: "Download Agents", exact: true }).click();

  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  await expect(catalogView.getByText("The agent catalog is unavailable.")).toBeVisible();
  await expect(catalogView.getByText(/Marinara Engine returned HTTP 400: Validation Error\./)).toBeVisible();
  await expect(catalogView.getByText(/Check the server internet connection/)).toHaveCount(0);
});

test("Music Player links to Music DJ while its package is unavailable", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  let musicDjInstalled = false;
  const musicDjManifest = {
    schemaVersion: 1,
    id: "spotify",
    name: "Music DJ",
    version: "1.0.0",
    description: "Matches scene mood with Spotify, YouTube, or local music.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [],
    permissions: ["agent-runtime", "chat-read", "prompt-context", "ui"],
    restartRequired: false,
  };
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        musicDjInstalled
          ? [
              {
                id: "spotify",
                version: "1.0.0",
                manifest: musicDjManifest,
                installedAt: "2026-07-15T00:00:00.000Z",
                status: "active",
                error: null,
                legacy: false,
              },
            ]
          : [],
      ),
    });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-15T00:00:00.000Z",
        packages: [
          {
            category: "misc",
            manifest: musicDjManifest,
            artifact: { url: "https://example.com/spotify.zip", sha256: "a".repeat(64), bytes: 2048 },
          },
        ],
      }),
    });
  });

  const openMusicPlayerSetting = async () => {
    await page.locator('[data-tour="panel-settings"]').click();
    const row = page.locator("#settings-control-music-player");
    await expect(row).toBeVisible();
    return row;
  };
  const expandUnavailablePlayer = async () => {
    const openPrompt = page.getByRole("button", { name: "Open Music DJ download prompt" });
    if (await openPrompt.isVisible()) await openPrompt.click();
  };

  await page.goto("/");
  let unavailablePlayer = page.locator('[data-component="MusicDjUnavailablePlayer"]');
  await expect(unavailablePlayer).toBeVisible();
  await expandUnavailablePlayer();
  await expect(unavailablePlayer.getByText("Download Music DJ Agent to configure", { exact: true })).toBeVisible();
  let musicPlayerRow = await openMusicPlayerSetting();
  const musicPlayerToggle = musicPlayerRow.locator('input[type="checkbox"]');
  await expect(musicPlayerToggle).toHaveCount(1);
  await expect(musicPlayerToggle).toBeChecked();
  await musicPlayerRow.getByText("Music Player", { exact: true }).click();
  await expect(musicPlayerToggle).not.toBeChecked();
  await expect(page.locator('[data-component="MusicDjUnavailablePlayer"]')).toHaveCount(0);
  await musicPlayerRow.getByText("Music Player", { exact: true }).click();
  await expect(musicPlayerToggle).toBeChecked();
  unavailablePlayer = page.locator('[data-component="MusicDjUnavailablePlayer"]');
  await expect(unavailablePlayer).toBeVisible();
  await expandUnavailablePlayer();

  musicDjInstalled = true;
  await page.reload();
  await expect(page.locator('[data-component="MusicDjUnavailablePlayer"]')).toHaveCount(0);
  musicPlayerRow = await openMusicPlayerSetting();
  await expect(musicPlayerRow.locator('input[type="checkbox"]')).toHaveCount(1);

  musicDjInstalled = false;
  await page.reload();
  unavailablePlayer = page.locator('[data-component="MusicDjUnavailablePlayer"]');
  await expect(unavailablePlayer).toBeVisible();
  await expandUnavailablePlayer();
  await unavailablePlayer.getByRole("button", { name: "Download Agents" }).click();
  await expect(page.locator('[data-component="AgentCatalogView"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Download Agents" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Connections exposes Local Whisper only while Conversation Calls is installed", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The capability ownership path is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  let callsInstalled = true;
  const callsPackage = {
    id: "conversation-calls",
    version: "1.0.1",
    manifest: {
      schemaVersion: 1,
      id: "conversation-calls",
      name: "Conversation Calls",
      version: "1.0.1",
      description: "Audio and video calls for Conversation chats.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent", "conversation-calls"],
      entrypoints: { client: "client.js", agents: "agents.json" },
      files: [],
      permissions: ["ui"],
      restartRequired: true,
    },
    installedAt: "2026-07-14T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };

  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(callsInstalled ? [callsPackage] : []),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/conversation-calls/client?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        if (!customElements.get("marinara-capability-conversation-calls")) {
          customElements.define("marinara-capability-conversation-calls", class extends HTMLElement {});
        }
      `,
    });
  });
  await page.route("**/api/sidecar/speech/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "not_downloaded",
        config: { modelId: null },
        available: true,
        modelDownloaded: false,
        modelDisplayName: null,
        modelSize: null,
        models: [
          {
            id: "whisper_tiny",
            label: "Whisper Tiny (Multilingual)",
            repoId: "Xenova/whisper-tiny",
            description: "Fast local speech recognition.",
            sizeBytes: 180 * 1024 * 1024,
            ramBytes: 350 * 1024 * 1024,
          },
        ],
        downloadProgress: null,
        error: null,
        platform: "darwin",
        arch: "arm64",
        runtime: {
          packageFound: true,
          bindingFound: true,
          expectedBindingPath: "/tmp/onnxruntime_binding.node",
          installedBindingArchs: ["arm64"],
          platform: "darwin",
          arch: "arm64",
          nodeVersion: "v24.0.0",
          nodeExecPath: "/usr/bin/node",
          liteMode: false,
        },
      }),
    });
  });

  const openExpandedLocalModel = async () => {
    const rightPanel = page.locator('[data-component="RightPanel"]');
    await page.locator('[data-tour="panel-connections"]').click();
    await expect(rightPanel).toBeVisible();
    const localModelLabel = rightPanel.getByText("Local Model", { exact: true });
    await localModelLabel.evaluate((element) => element.parentElement?.parentElement?.click());
    const localModelCard = localModelLabel.locator("xpath=../../..");
    await expect(localModelCard.getByTitle("Collapse")).toBeVisible();
    return rightPanel;
  };

  await page.goto("/");
  let rightPanel = await openExpandedLocalModel();
  await expect(rightPanel.getByText("Local Speech Model", { exact: true })).toBeVisible();
  await expect(rightPanel.getByRole("button", { name: "Download Whisper" })).toBeVisible();

  callsInstalled = false;
  await page.reload();
  rightPanel = await openExpandedLocalModel();
  await expect(rightPanel.getByText("Local Speech Model", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("agent catalog can install and uninstall every package", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Bulk agent package actions are covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const packageIds = ["prose-guardian", "character-tracker", "uno"];
  const installedIds = new Set<string>();
  const installRequests: string[] = [];
  const uninstallRequests: string[] = [];
  const catalogPackages = packageIds.map((id, index) => {
    const names = ["Prose Guardian", "Character Tracker", "UNO"];
    const categories = ["writer", "tracker", "misc"];
    return {
      category: categories[index],
      manifest: {
        schemaVersion: 1,
        id,
        name: names[index],
        version: "1.0.0",
        description: `Description for ${names[index]}.`,
        engine: { min: "2.3.0", maxExclusive: "3.0.0" },
        kind: ["agent"],
        entrypoints: { agents: "agents.json" },
        files: [],
        permissions: ["agent-runtime", "chat-read", "prompt-context"],
        restartRequired: false,
      },
      artifact: { url: `https://example.com/${id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
    };
  });

  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-14T00:00:00.000Z",
        packages: catalogPackages,
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        catalogPackages
          .filter((entry) => installedIds.has(entry.manifest.id))
          .map((entry) => ({
            id: entry.manifest.id,
            version: entry.manifest.version,
            manifest: entry.manifest,
            installedAt: "2026-07-14T00:00:00.000Z",
            status: "active",
            error: null,
            legacy: false,
          })),
      ),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route(/\/api\/capability-packages\/[^/]+\/install$/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const id = decodeURIComponent(pathname.split("/").at(-2) ?? "");
    installRequests.push(id);
    installedIds.add(id);
    const entry = catalogPackages.find((candidate) => candidate.manifest.id === id);
    expect(entry).toBeTruthy();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id,
        version: entry!.manifest.version,
        manifest: entry!.manifest,
        installedAt: "2026-07-14T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
      }),
    });
  });
  await page.route(/\/api\/capability-packages\/[^/]+$/, async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
    uninstallRequests.push(id);
    installedIds.delete(id);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ restartRequired: false }),
    });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-agents"]').click();
  await page.getByRole("button", { name: "Download Agents" }).click();

  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  const installAllButton = catalogView.getByRole("button", { name: "Install All", exact: true });
  const uninstallAllButton = catalogView.getByRole("button", { name: "Uninstall All", exact: true });
  await expect(installAllButton).toBeEnabled();
  await expect(uninstallAllButton).toBeDisabled();

  await catalogView.getByRole("textbox", { name: "Search downloadable agents" }).fill("UNO");
  await installAllButton.click();
  await expect.poll(() => installedIds.size).toBe(packageIds.length);
  await expect(installAllButton).toBeDisabled();
  await expect(uninstallAllButton).toBeEnabled();
  expect(installRequests).toEqual(packageIds);

  await uninstallAllButton.click();
  const confirmDialog = page.getByRole("dialog", { name: "Uninstall all 3 agents?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Uninstall All", exact: true }).click();
  await expect.poll(() => installedIds.size).toBe(0);
  await expect(installAllButton).toBeEnabled();
  await expect(uninstallAllButton).toBeDisabled();
  expect(uninstallRequests).toEqual(packageIds);
  expect(errors).toEqual([]);
});

test("installed package artwork appears in the sidebar and clears immediately on uninstall", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The persistent Agents sidebar is a desktop workflow.");

  const errors = collectUnexpectedErrors(page);
  let installed = true;
  const packageManifest = {
    schemaVersion: 1,
    id: "prose-guardian",
    name: "Prose Guardian",
    version: "1.0.0",
    description: "Keeps generated prose focused and consistent.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [],
    permissions: ["agent-runtime", "chat-read", "prompt-context"],
    restartRequired: false,
  };
  const agentManifest = {
    id: "prose-guardian",
    name: "Prose Guardian",
    description: "Keeps generated prose focused and consistent.",
    author: "Pasta Devs",
    phase: "post_processing",
    enabledByDefault: false,
    category: "writer",
    defaultPromptTemplate: "Review the prose.",
  };

  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-14T00:00:00.000Z",
        packages: [
          {
            category: "writer",
            iconUrl: "https://example.com/prose-guardian-artwork.gif",
            manifest: packageManifest,
            artifact: {
              url: "https://example.com/prose-guardian.zip",
              sha256: "a".repeat(64),
              bytes: 2048,
            },
          },
        ],
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        installed
          ? [
              {
                id: packageManifest.id,
                version: packageManifest.version,
                manifest: packageManifest,
                installedAt: "2026-07-14T00:00:00.000Z",
                status: "active",
                error: null,
                legacy: false,
              },
            ]
          : [],
      ),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(installed ? [agentManifest] : []),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("https://example.com/prose-guardian-artwork.gif", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });
  await page.route("**/api/capability-packages/prose-guardian", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    installed = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ restartRequired: false }),
    });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-agents"]').click();
  const agentsSidebar = page.locator('[data-component="RightPanelDesktop"]');
  const proseGuardianCard = agentsSidebar.locator('[data-agent-name="Prose Guardian"]');
  await expect(proseGuardianCard).toBeVisible();
  await expect(proseGuardianCard.locator('[data-component="AgentArtwork"]')).toHaveAttribute(
    "src",
    "https://example.com/prose-guardian-artwork.gif",
  );

  await agentsSidebar.getByRole("button", { name: "Download Agents" }).click();
  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  await expect(catalogView.getByRole("button", { name: "Uninstall", exact: true })).toBeVisible();
  await catalogView.getByRole("button", { name: "Uninstall", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Uninstall Prose Guardian?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Uninstall", exact: true }).click();

  await expect(agentsSidebar.getByText("Prose Guardian", { exact: true })).toHaveCount(0);
  await expect(agentsSidebar.getByText("No Agents installed yet, click Download Agents to add them!")).toBeVisible();
  await expect(catalogView.getByRole("button", { name: "Install", exact: true })).toBeVisible();
  await expect(agentsSidebar).toBeVisible();
  expect(errors).toEqual([]);
});

test("Conversation feature packages expose commands and settings without per-chat attachment", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "Conversation agent settings regression is covered on desktop.",
  );

  const errors = collectUnexpectedErrors(page);
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Conversation Agent Settings Smoke", mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  let conversationFeaturesInstalled = false;
  let clientLoadAttempts = 0;
  const releaseInitialClientLoad = createDeferred();
  const illustratorManifest = {
    id: "illustrator",
    name: "Illustrator",
    description: "Generates image prompts for important visual moments.",
    author: "Pasta Devs",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    defaultPromptTemplate: "Return a concise image prompt.",
  };
  const conversationFeatureManifests = [
    illustratorManifest,
    ...[
      ["conversation-calls", "Conversation Calls"],
      ["eightball", "8-Ball Pool"],
      ["chess", "Chess"],
      ["poker", "Poker"],
      ["rock-paper-scissors", "Rock-Paper-Scissors"],
      ["tic-tac-toe", "Tic-Tac-Toe"],
      ["uno", "UNO"],
    ].map(([id, name]) => ({
      id,
      name,
      description: `${name} Conversation feature.`,
      author: "Pasta Devs",
      phase: "pre_generation",
      enabledByDefault: false,
      category: "misc",
      runtimeDisabled: true,
      modeAllowlist: ["conversation"],
      execution: "feature",
      defaultPromptTemplate: "",
    })),
  ];
  const callsInstalledPackage = {
    id: "conversation-calls",
    version: "1.0.0",
    manifest: {
      schemaVersion: 1,
      id: "conversation-calls",
      name: "Conversation Calls",
      version: "1.0.0",
      description: "Audio and video calls for Conversation chats.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent", "conversation-calls"],
      entrypoints: { client: "client.js", agents: "agents.json" },
      files: [],
      permissions: ["ui"],
      restartRequired: true,
    },
    installedAt: "2026-07-14T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conversationFeaturesInstalled ? conversationFeatureManifests : []),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conversationFeaturesInstalled ? [callsInstalledPackage] : []),
    });
  });
  await page.route("**/api/capability-packages/conversation-calls/client?*", async (route) => {
    clientLoadAttempts += 1;
    if (clientLoadAttempts === 1) {
      await releaseInitialClientLoad.promise;
      await route.fulfill({
        status: 503,
        contentType: "application/javascript",
        body: "Service unavailable",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        if (!customElements.get("marinara-capability-conversation-calls")) {
          customElements.define("marinara-capability-conversation-calls", class extends HTMLElement {
            connectedCallback() {
              this.addEventListener("marinara-capability-props", () => this.render());
              this.render();
            }
            render() {
              if (this.getAttribute("view") !== "settings") return;
              const props = this.capabilityProps || {};
              const enabled = props.metadata?.conversationCallsEnabled === true;
              this.innerHTML = '<section class="mari-chat-option-field"><span>Conversation Calls</span><button type="button">Audio/Video Calls</button><button type="button" data-crash-capability>Crash capability</button>' + (enabled ? '<span>Call Audio Pipeline</span>' : '') + '</section>';
              this.querySelector("button:not([data-crash-capability])")?.addEventListener("click", () => {
                props.updateMetadata?.({ conversationCallsEnabled: !enabled });
              });
              this.querySelector("[data-crash-capability]")?.addEventListener("click", () => {
                const message = "Injected capability runtime failure";
                this.capabilityRuntimeError = message;
                this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }));
              });
            }
          });
        }
      `,
    });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Chat Settings" }).click();
    let drawer = page.locator(".mari-chat-settings-drawer");
    let agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents$/ });
    await expect(agentsSection).toHaveCount(1);
    await agentsSection.click();
    await expect(drawer.getByText("Commands", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Schedule Updates", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Memories", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Selfies", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Illustrator Settings", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Conversation Calls", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Enable Agents", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Agent Suite", { exact: true })).toHaveCount(0);
    await expect(drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Commands$/ })).toHaveCount(0);

    conversationFeaturesInstalled = true;
    await page.reload();
    await page.getByRole("button", { name: "Chat Settings" }).click();
    drawer = page.locator(".mari-chat-settings-drawer");
    agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents$/ });
    await expect(agentsSection).toHaveCount(1);
    await agentsSection.click();
    await expect(
      drawer.locator('[data-capability-client-state="loading"][data-capability-package-id="conversation-calls"]'),
    ).toBeVisible();
    releaseInitialClientLoad.resolve();
    const clientLoadFailure = drawer.getByRole("alert").filter({ hasText: "Conversation Calls didn't load" });
    await expect(clientLoadFailure).toBeVisible();
    await expect(
      clientLoadFailure.getByText("Your chat and saved data are unchanged.", { exact: false }),
    ).toBeVisible();
    const clientLoadRetry = clientLoadFailure.getByRole("button", { name: "Try again", exact: true });
    expect((await clientLoadRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await clientLoadRetry.click();
    await expect(clientLoadFailure).toHaveCount(0);
    await expect(drawer.getByText("Commands", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Selfies", { exact: true })).toBeVisible();
    await expect(drawer.getByText("8-Ball Pool", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Chess", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Poker", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Rock-Paper-Scissors", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Tic-Tac-Toe", { exact: true })).toBeVisible();
    await expect(drawer.getByText("UNO", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Illustrator Settings", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Conversation Calls", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Call Audio Pipeline", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Enable Agents", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Agent Suite", { exact: true })).toHaveCount(0);
    const illustratorSettings = drawer.getByText("Illustrator Settings", { exact: true });
    const callsSettings = drawer.getByText("Conversation Calls", { exact: true });
    const callsSettingsHandle = await callsSettings.elementHandle();
    if (!callsSettingsHandle) throw new Error("Conversation Calls settings did not render");
    expect(
      await illustratorSettings.evaluate(
        (illustrator, calls) =>
          calls instanceof Node &&
          Boolean(illustrator.compareDocumentPosition(calls) & Node.DOCUMENT_POSITION_FOLLOWING),
        callsSettingsHandle,
      ),
    ).toBe(true);
    await drawer.getByRole("button", { name: "Audio/Video Calls", exact: true }).click();
    await expect(drawer.getByText("Call Audio Pipeline", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Crash capability", exact: true }).click();
    const runtimeFailure = drawer.getByRole("alert").filter({ hasText: "Conversation Calls stopped" });
    await expect(runtimeFailure).toBeVisible();
    const runtimeRetry = runtimeFailure.getByRole("button", { name: "Try again", exact: true });
    expect((await runtimeRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await runtimeRetry.click();
    await expect(runtimeFailure).toHaveCount(0);
    await expect(drawer.getByText("Conversation Calls", { exact: true })).toBeVisible();
    await expect(drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Commands$/ })).toHaveCount(0);
    expect(clientLoadAttempts).toBe(2);
    expect(errors.some((error) => error.includes("Could not load client capability conversation-calls"))).toBe(true);
    expect(
      errors.filter(
        (error) =>
          !error.includes("Could not load client capability conversation-calls") &&
          !/Failed to load resource:.*503/iu.test(error),
      ),
    ).toEqual([]);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Conversation setup commands follow the installed agent library", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Conversation setup command regression is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const beforeResponse = await request.get("/api/chats");
  const beforeChats = (await beforeResponse.json()) as Array<{ id: string }>;
  const existingChatIds = new Set(beforeChats.map((chat) => chat.id));
  const connectionResponse = await request.post("/api/connections", {
    data: { name: `Conversation Setup Smoke ${Date.now()}`, provider: "custom" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  let illustratorInstalled = false;
  const illustratorManifest = {
    id: "illustrator",
    name: "Illustrator",
    description: "Generates image prompts for important visual moments.",
    author: "Pasta Devs",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    defaultPromptTemplate: "Return a concise image prompt.",
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(illustratorInstalled ? [illustratorManifest] : []),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });

  const openAutomationStep = async () => {
    const newConversationButton = page.getByLabel("New Conversation");
    if (!(await newConversationButton.isVisible())) {
      await page.locator('[data-tour="sidebar-toggle"]').click();
    }
    await expect(newConversationButton).toBeVisible();
    const conversationModeButton = page.locator('[data-tour="chat-mode-conversation"]');
    if ((await conversationModeButton.getAttribute("aria-pressed")) !== "true") {
      await conversationModeButton.click();
    }
    const chatCreated = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/chats",
    );
    await newConversationButton.evaluate((button: HTMLButtonElement) => button.click());
    const connectionGate = page.getByRole("heading", { name: "Set Up Conversation", exact: true });
    const wizardHeading = page.getByRole("heading", { name: "New Conversation", exact: true });
    await expect(connectionGate.or(wizardHeading)).toBeVisible();
    if (await connectionGate.isVisible()) {
      await page.getByRole("button", { name: "Create Chat", exact: true }).click();
    }
    expect((await chatCreated).ok()).toBeTruthy();
    await expect(wizardHeading).toBeVisible();
    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await nextButton.click();
    await nextButton.click();
    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Automation", exact: true })).toBeVisible();
  };

  try {
    await page.goto("/");
    await openAutomationStep();
    await expect(page.getByText("Commands", { exact: true })).toBeVisible();
    await expect(page.getByText("Schedule Updates", { exact: true })).toBeVisible();
    await expect(page.getByText("Memories", { exact: true })).toBeVisible();
    await expect(page.getByText("Selfies", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Calls", { exact: true })).toHaveCount(0);
    let setupWizard = page.getByRole("heading", { name: "New Conversation", exact: true }).locator("../..");
    await expect(setupWizard.getByRole("button", { name: "Download Agents", exact: true })).toBeVisible();

    illustratorInstalled = true;
    await page.reload();
    await openAutomationStep();
    await expect(page.getByText("Schedule Updates", { exact: true })).toBeVisible();
    await expect(page.getByText("Selfies", { exact: true })).toBeVisible();
    await expect(page.getByText("Calls", { exact: true })).toHaveCount(0);
    setupWizard = page.getByRole("heading", { name: "New Conversation", exact: true }).locator("../..");
    await expect(setupWizard.getByRole("button", { name: "Download Agents", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const afterResponse = await request.get("/api/chats");
    const afterChats = (await afterResponse.json()) as Array<{ id: string }>;
    await Promise.all(
      afterChats
        .filter((chat) => !existingChatIds.has(chat.id))
        .map((chat) => request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 })),
    );
    await request.delete(`/api/connections/${connection.id}`, { timeout: 10_000 });
  }
});

test("Game setup only shows features owned by installed agents", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game setup agent feature regression is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Game Setup Agent Features Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  let installedAgentIds = new Set<string>();
  const agentNames: Record<string, string> = {
    "hierarchical-maps": "Hierarchical Maps",
    illustrator: "Illustrator",
    "lorebook-keeper": "Lorebook Keeper",
    spotify: "Music DJ",
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    const manifests = Array.from(installedAgentIds).map((id) => ({
      id,
      name: agentNames[id] ?? id,
      description: `${agentNames[id] ?? id} test manifest.`,
      author: "Pasta Devs",
      phase: "post_processing",
      enabledByDefault: false,
      category: id === "hierarchical-maps" ? "tracker" : "misc",
      defaultPromptTemplate: "Test prompt.",
    }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifests) });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/game-assets/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scannedAt: "2026-07-14T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  const openLorebooksStep = async () => {
    const dialog = page.getByRole("dialog", { name: "New Game" });
    await expect(dialog).toBeVisible();
    const recommendation = dialog.getByText(
      "Use a strong model for the initial world generation. You can change it later in Chat Settings.",
    );
    await expect(recommendation).toHaveClass(/text-\[var\(--primary\)\]/);
    for (const heading of ["World", "Party", "Goals", "Lorebooks"]) {
      await dialog.getByRole("button", { name: "Next", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    return dialog;
  };

  try {
    await page.goto("/");
    const initialDialog = page.getByRole("dialog", { name: "New Game" });
    const importButton = initialDialog.getByRole("button", { name: "Import setup", exact: true });
    await expect(importButton).toBeEnabled();
    await initialDialog.getByLabel("Import Game Mode setup file").setInputFiles({
      name: "tower-run.marinara-game-setup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-game-setup",
          version: 1,
          exportedAt: "2026-07-16T12:00:00.000Z",
          gameName: "Imported Tower Run",
          setup: {
            config: {
              genre: "Fantasy",
              setting: "A city built around a shifting dungeon tower",
              tone: "Heroic",
              difficulty: "Hard",
              playerGoals: "Reach the final floor",
              gmMode: "standalone",
              rating: "sfw",
              partyCharacterIds: [],
              generationParameters: { temperature: 0.65 },
            },
            effectiveGenerationParameters: { temperature: 0.65, maxTokens: 8192 },
            preferences: "Use clear progression and frequent loot rewards.",
            createdAt: "2026-07-16T11:00:00.000Z",
          },
        }),
      ),
    });
    await expect(initialDialog.locator('input[placeholder="Name your adventure..."]')).toHaveValue(
      "Imported Tower Run",
    );
    await expect(
      initialDialog.getByText("tower-run.marinara-game-setup.json loaded. Review the steps, then start the new game.", {
        exact: true,
      }),
    ).toBeVisible();

    const temperatureField = initialDialog.locator('input[inputmode="decimal"]').first();
    await expect(temperatureField).toHaveValue("0.65");
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await expect(initialDialog.locator('input[placeholder="Describe your world…"]')).toHaveValue(
      "A city built around a shifting dungeon tower",
    );
    await expect(initialDialog.getByRole("button", { name: "Hard", exact: true })).toHaveClass(
      /bg-\[var\(--primary\)\]\/20/,
    );
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "Party", exact: true })).toBeVisible();
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
    await expect(initialDialog.locator('textarea[placeholder="What do you want to achieve?"]')).toHaveValue(
      "Reach the final floor",
    );
    await expect(initialDialog.locator('textarea[placeholder="Any extra details for the GM?"]')).toHaveValue(
      "Use clear progression and frequent loot rewards.",
    );
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "Lorebooks", exact: true })).toBeVisible();

    let dialog = initialDialog;
    await expect(dialog.getByText("Hierarchical world map", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await expect(dialog.getByText("Music DJ", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Lorebook Keeper", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Illustrator", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Download Agents", exact: true })).toBeVisible();

    installedAgentIds = new Set(["spotify", "lorebook-keeper", "illustrator"]);
    await page.reload();
    dialog = await openLorebooksStep();
    await expect(dialog.getByText("Hierarchical world map", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await expect(dialog.getByText("Music DJ", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Lorebook Keeper", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Illustrator", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Visual Generation", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Download Agents", exact: true })).toHaveCount(0);

    installedAgentIds.add("hierarchical-maps");
    await page.reload();
    dialog = await openLorebooksStep();
    await expect(dialog.getByText("Hierarchical world map", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 });
  }
});

test("Roleplay and Game chat settings link empty agent libraries to Download Agents", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Empty Chat Settings agent libraries are covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chats: Array<{ id: string; mode: "roleplay" | "game" }> = [];
  const fixtureNames = new Set(["roleplay Empty Agent Settings Smoke", "game Empty Agent Settings Smoke"]);
  const existingChatsResponse = await page.request.get("/api/chats");
  const existingChats = (await existingChatsResponse.json()) as Array<{ id: string; name: string }>;
  await Promise.all(
    existingChats
      .filter((chat) => fixtureNames.has(chat.name))
      .map((chat) => page.request.delete(`/api/chats/${chat.id}`)),
  );
  for (const mode of ["roleplay", "game"] as const) {
    const response = await page.request.post("/api/chats", {
      data: { name: `${mode} Empty Agent Settings Smoke`, mode, characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = (await response.json()) as { id: string };
    if (mode === "game") {
      const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          gameId: "empty-agent-settings-smoke-game",
          gameSessionStatus: "active",
          gameSessionNumber: 1,
          gameIntroPresented: true,
        },
      });
      expect(metadataResponse.ok()).toBeTruthy();
      const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The party arrives at the test crossroads." },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }
    chats.push({ id: chat.id, mode });
  }

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/game-assets/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scannedAt: "2026-07-14T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  try {
    await page.goto("/");
    for (const chat of chats) {
      await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
      await page.reload();
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await expect(drawer, `${chat.mode} Chat Settings drawer should open`).toBeVisible();
      const sectionLabels = await drawer.locator('[role="button"][aria-expanded]').allTextContents();
      expect(
        sectionLabels.some((label) => label.startsWith("Agents")),
        `${chat.mode} Chat Settings sections`,
      ).toBeTruthy();
      const agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
      await agentsSection.click();
      await expect(drawer.getByText("No agents downloaded yet.", { exact: true })).toBeVisible();
      await drawer.getByRole("button", { name: "Download Agents", exact: true }).click();
      const catalog = page.locator('[data-component="AgentCatalogView"]');
      await expect(catalog).toBeVisible();
      await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
      await catalog.getByRole("button", { name: "Back to Agents" }).click();
      await expect(catalog).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 })));
  }
});

test("Hierarchical Maps settings stay inside the active agent entry", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Hierarchical Maps agent placement is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chats: Array<{ id: string; mode: "roleplay" | "game" }> = [];
  for (const mode of ["roleplay", "game"] as const) {
    const response = await request.post("/api/chats", {
      data: { name: `${mode} Hierarchical Maps Agent Menu Smoke`, mode, characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = (await response.json()) as { id: string };
    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["hierarchical-maps"],
        ...(mode === "game"
          ? {
              gameId: "hierarchical-maps-agent-menu-smoke",
              gameSessionStatus: "active",
              gameSessionNumber: 1,
              gameIntroPresented: true,
            }
          : {}),
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    if (mode === "game") {
      const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The party studies the map." },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }
    chats.push({ id: chat.id, mode });
  }

  const agentManifest = {
    id: "hierarchical-maps",
    name: "Hierarchical Maps",
    description: "Adds persistent hierarchical locations and spatial context.",
    author: "Pasta Devs",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "tracker",
    runtimeDisabled: true,
    modeAllowlist: ["roleplay", "game"],
    defaultPromptTemplate: "",
    execution: "feature",
  };
  const packageManifest = {
    schemaVersion: 1,
    id: "hierarchical-maps",
    name: "Hierarchical Maps",
    version: "1.0.6",
    description: agentManifest.description,
    engine: { min: "2.3.0", maxExclusive: "2.4.0" },
    kind: ["agent", "maps"],
    entrypoints: { agents: "agents.json", client: "client.js" },
    contributions: {
      slots: ["chat-settings", "spatial-workspace", "chat-runtime", "game-world-map"],
      agentDetail: { agentIds: ["hierarchical-maps"] },
    },
    files: [],
    permissions: ["ui"],
    restartRequired: true,
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([agentManifest]) });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-16T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "hierarchical-maps",
          version: packageManifest.version,
          manifest: packageManifest,
          installedAt: "2026-07-16T00:00:00.000Z",
          status: "active",
          error: null,
          legacy: false,
        },
      ]),
    });
  });
  await page.route("**/api/capability-packages/hierarchical-maps/client?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        class HierarchicalMapsSmokeElement extends HTMLElement {
          connectedCallback() {
            this.addEventListener('marinara-capability-props', () => this.render());
            this.render();
          }
          render() {
            const props = this.capabilityProps || {};
            if (this.getAttribute('view') === 'detail') {
              this.innerHTML = '<section data-testid="hierarchical-maps-detail"><h1>Hierarchical Maps home</h1><p>' + (props.chatName || 'No current chat') + '</p><button type="button">Back to Agents</button></section>';
              this.querySelector('button')?.addEventListener('click', () => props.onClose?.());
              return;
            }
            this.innerHTML = '<div data-testid="hierarchical-maps-controls">Hierarchical map controls</div>';
          }
        }
        if (!customElements.get('marinara-capability-hierarchical-maps')) {
          customElements.define('marinara-capability-hierarchical-maps', HierarchicalMapsSmokeElement);
        }
        export {};
      `,
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/chats/*/spatial-context", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        definition: null,
        currentLocationId: null,
        breadcrumb: [],
        destinations: [],
        warnings: [],
        hasCommittedSpatialHistory: false,
      }),
    });
  });
  await page.route("**/api/game-assets/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  try {
    await page.addInitScript((chatId) => {
      if (sessionStorage.getItem("maps-feature-detail-chat-seeded")) return;
      localStorage.setItem("marinara-active-chat-id", chatId);
      sessionStorage.setItem("maps-feature-detail-chat-seeded", "true");
    }, chats[0]!.id);
    await page.goto("/");
    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator('[data-component="RightPanelDesktop"]');
    const mapsCard = agentsPanel.locator('[data-agent-name="Hierarchical Maps"]');
    await expect(mapsCard).toBeVisible();
    await mapsCard.getByText("Hierarchical Maps", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Hierarchical Maps home" })).toBeVisible();
    await expect(page.getByTestId("hierarchical-maps-detail")).toContainText(
      "roleplay Hierarchical Maps Agent Menu Smoke",
    );
    await expect(page.getByText("System Prompt", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Back to Agents" }).click();
    await expect(page.getByTestId("hierarchical-maps-detail")).toHaveCount(0);

    for (const chat of chats) {
      await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
      await page.reload();
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await expect(drawer).toBeVisible();
      await expect(
        drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Hierarchical map/ }),
        `${chat.mode} should not expose a top-level Hierarchical map section`,
      ).toHaveCount(0);

      const agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
      await agentsSection.click();
      if (chat.mode === "roleplay") {
        await drawer.getByRole("button", { name: /Tracker Agents/ }).click();
      }

      const agentEntry = drawer.locator('[data-chat-agent-entry="hierarchical-maps"]');
      await expect(agentEntry, `${chat.mode} Hierarchical Maps agent entry`).toBeVisible();
      await expect(agentEntry.getByTestId("hierarchical-maps-controls")).toBeVisible();
      await expect(drawer.locator("marinara-capability-hierarchical-maps")).toHaveCount(1);
      await expect(agentEntry.locator("marinara-capability-hierarchical-maps")).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 })));
  }
});

test("Roleplay setup points empty agent libraries to the Agents tab", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Roleplay setup empty-state regression is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const beforeResponse = await request.get("/api/chats");
  const beforeChats = (await beforeResponse.json()) as Array<{ id: string }>;
  const existingChatIds = new Set(beforeChats.map((chat) => chat.id));
  const connectionResponse = await request.post("/api/connections", {
    data: { name: `Roleplay Setup Smoke ${Date.now()}`, provider: "custom" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  try {
    await page.goto("/");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await page.locator('[data-tour="chat-mode-roleplay"]').click();
    await page.getByLabel("New Roleplay").click();
    const connectionGate = page.getByRole("heading", { name: "Set Up Roleplay", exact: true });
    const wizardHeading = page.getByRole("heading", { name: "New Roleplay", exact: true });
    await expect(connectionGate.or(wizardHeading)).toBeVisible();
    if (await connectionGate.isVisible()) {
      await page.getByRole("button", { name: "Create Chat", exact: true }).click();
    }
    await expect(wizardHeading).toBeVisible();
    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Pick a Preset", exact: true })).toBeVisible();
    await nextButton.click();
    const skipChoices = page.getByRole("button", { name: "Skip", exact: true });
    await expect(skipChoices).toBeVisible();
    await skipChoices.click();
    await expect(page.getByRole("heading", { name: "Persona & Characters", exact: true })).toBeVisible();
    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Attach Lorebooks", exact: true })).toBeVisible();
    await nextButton.click();
    const agentsStepHeading = page.getByRole("heading", { name: "Enable Agents", exact: true });
    await expect(agentsStepHeading).toBeVisible();
    await expect(
      page.getByText("No agents downloaded yet. Head to Agents tab and click Download Agents to get some!"),
    ).toBeVisible();
    await expect(
      page.locator('[data-component="ChatSetupWizard.AgentEmptyState"] .mari-panel-gradient--agents'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Open Agents tab" }).click();
    await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Download Agents" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    const afterResponse = await request.get("/api/chats");
    const afterChats = (await afterResponse.json()) as Array<{ id: string }>;
    await Promise.all(
      afterChats.filter((chat) => !existingChatIds.has(chat.id)).map((chat) => request.delete(`/api/chats/${chat.id}`)),
    );
    await request.delete(`/api/connections/${connection.id}`, { timeout: 10_000 });
  }
});

test("desktop resource editors open beside their source sidebars", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop side-by-side editor behavior.");
  await page.setViewportSize({ width: 1360, height: 900 });

  const suffix = Date.now().toString(36);
  const createResource = async (path: string, data: Record<string, unknown>) => {
    const response = await page.request.post(path, { data });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const characterName = `Sidebar Character ${suffix}`;
  const lorebookName = `Sidebar Lorebook ${suffix}`;
  const presetName = `Sidebar Preset ${suffix}`;
  const connectionName = `Sidebar Connection ${suffix}`;
  const agentName = `Sidebar Agent ${suffix}`;
  const personaName = `Sidebar Persona ${suffix}`;
  const character = await createResource("/api/characters", { data: { name: characterName } });
  const lorebook = await createResource("/api/lorebooks", {
    name: lorebookName,
    description: "Desktop sidebar regression fixture.",
    category: "world",
    enabled: true,
  });
  const preset = await createResource("/api/prompts", {
    name: presetName,
    description: "Desktop sidebar regression fixture.",
  });
  const connection = await createResource("/api/connections", {
    name: connectionName,
    provider: "custom",
  });
  const agent = await createResource("/api/agents", {
    type: `sidebar-agent-${suffix}`,
    name: agentName,
    description: "Desktop sidebar regression fixture.",
    phase: "post_processing",
  });
  const persona = await createResource("/api/characters/personas", {
    name: personaName,
    description: "Desktop sidebar regression fixture.",
  });

  const resources = [
    { panel: "characters", name: characterName },
    { panel: "lorebooks", name: lorebookName },
    { panel: "presets", name: presetName },
    { panel: "connections", name: connectionName },
    { panel: "agents", name: agentName },
    { panel: "personas", name: personaName },
  ];

  try {
    await page.goto("/");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    const chatSidebar = page.locator('[data-component="ChatSidebarPanel"]');
    const resourceSidebar = page.locator('[data-component="RightPanelDesktop"]');
    const centerContent = page.locator('[data-component="CenterContent"]');
    await expect(chatSidebar).toBeVisible();

    for (const resource of resources) {
      await page.locator(`[data-tour="panel-${resource.panel}"]`).click();
      await expect(resourceSidebar).toBeVisible();
      await expect(centerContent).toHaveAttribute("data-center-compact", "true");
      const resourceRow = resourceSidebar.getByText(resource.name, { exact: true }).first();
      await expect(resourceRow).toBeVisible();
      await resourceRow.evaluate((element) => (element as HTMLElement).click());

      const editor = centerContent.locator(".mari-editor-shell");
      await expect(editor).toBeVisible();
      await expect(resourceSidebar).toBeVisible();
      await expect(chatSidebar).toBeVisible();
      await expect(resourceSidebar.getByText(resource.name, { exact: true }).first()).toBeVisible();

      await editor.locator(".mari-editor-header .mari-editor-action").first().click();
      await expect(editor).toHaveCount(0);
    }
  } finally {
    if (!page.isClosed()) {
      await Promise.all([
        page.request.delete(`/api/characters/${character.id}`),
        page.request.delete(`/api/lorebooks/${lorebook.id}`),
        page.request.delete(`/api/prompts/${preset.id}`),
        page.request.delete(`/api/connections/${connection.id}`),
        page.request.delete(`/api/agents/${agent.id}`),
        page.request.delete(`/api/characters/personas/${persona.id}`),
      ]);
    }
  }
});

test("desktop Connections and Lorebooks folders expand without a React hook error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop right-sidebar folder regression.");
  await page.setViewportSize({ width: 1360, height: 900 });

  const suffix = Date.now().toString(36);
  const connectionName = `Folder Connection ${suffix}`;
  const connectionFolderName = `Connection Folder ${suffix}`;
  const lorebookName = `Folder Lorebook ${suffix}`;
  const lorebookFolderName = `Lorebook Folder ${suffix}`;
  const connectionResponse = await page.request.post("/api/connections", {
    data: { name: connectionName, provider: "custom" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const connectionFolderResponse = await page.request.post("/api/connection-folders", {
    data: { name: connectionFolderName },
  });
  expect(connectionFolderResponse.ok()).toBeTruthy();
  const connectionFolder = (await connectionFolderResponse.json()) as { id: string };
  expect(
    (
      await page.request.post("/api/connection-folders/move-connection", {
        data: { connectionId: connection.id, folderId: connectionFolder.id },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.patch(`/api/connection-folders/${connectionFolder.id}`, {
        data: { collapsed: true },
      })
    ).ok(),
  ).toBeTruthy();

  const lorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Folder expansion regression fixture.",
      category: "world",
      enabled: true,
    },
  });
  expect(lorebookResponse.ok()).toBeTruthy();
  const lorebook = (await lorebookResponse.json()) as { id: string };
  await page.addInitScript(
    ({ folderName, lorebookId }) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "marinara-library-folders-v1",
        JSON.stringify([
          {
            id: "folder-expansion-regression",
            scope: "lorebooks",
            name: folderName,
            collapsed: true,
            sortOrder: 0,
            itemIds: [lorebookId],
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );
    },
    { folderName: lorebookFolderName, lorebookId: lorebook.id },
  );

  const errors = collectUnexpectedErrors(page);
  try {
    await page.goto("/");

    await page.locator('[data-tour="panel-connections"]').click();
    const resourceSidebar = page.locator('[data-component="RightPanelDesktop"]');
    const connectionFolderToggle = resourceSidebar.locator(
      `[data-connection-folder-id="${connectionFolder.id}"] > [role="button"]`,
    );
    await expect(connectionFolderToggle).toBeVisible();
    await connectionFolderToggle.click();
    await expect(connectionFolderToggle).toHaveAttribute("aria-expanded", "true");
    await expect(resourceSidebar.getByText(connectionName, { exact: true })).toBeVisible();

    await page.locator('[data-tour="panel-lorebooks"]').click();
    const lorebookFolderToggle = resourceSidebar.locator(
      '[data-lorebook-folder-id="folder-expansion-regression"] > [role="button"]',
    );
    await expect(lorebookFolderToggle).toBeVisible();
    await lorebookFolderToggle.click();
    await expect(lorebookFolderToggle).toHaveAttribute("aria-expanded", "true");
    await expect(resourceSidebar.getByText(lorebookName, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (!page.isClosed()) {
      await Promise.all([
        page.request.delete(`/api/connections/${connection.id}`),
        page.request.delete(`/api/connection-folders/${connectionFolder.id}`),
        page.request.delete(`/api/lorebooks/${lorebook.id}`),
      ]);
    }
  }
});

test("Professor Mari chat fills the mobile home viewport and keeps its composer visible", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Professor Mari mobile viewport regression.");
  await page.goto("/");

  await page
    .locator('[data-component="HomeProfessorMariChat.MariPanel"]')
    .getByRole("button", { name: "Ask Professor Mari" })
    .click();

  const topBar = page.locator('[data-component="TopBar"]');
  const window = page.locator('[data-component="HomeProfessorMariChat.Window"]');
  const composer = window.getByPlaceholder("Ask Professor Mari...");
  await expect(window).toBeVisible();
  await expect(composer).toBeVisible();
  await expect
    .poll(async () => {
      const [topBarBox, windowBox, composerBox] = await Promise.all([
        topBar.boundingBox(),
        window.boundingBox(),
        composer.boundingBox(),
      ]);
      const viewport = page.viewportSize();
      if (!topBarBox || !windowBox || !composerBox || !viewport) return false;
      const contentTop = topBarBox.y + topBarBox.height;
      return (
        Math.abs(windowBox.y - contentTop) <= 1 &&
        Math.abs(windowBox.y + windowBox.height - viewport.height) <= 1 &&
        composerBox.y + composerBox.height <= viewport.height + 1
      );
    })
    .toBe(true);
});

test("Lorebook Save keeps Overview stable while the updated detail cache settles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop editor regression");

  const name = `Lorebook save stability ${Date.now()}`;
  const createResponse = await page.request.post("/api/lorebooks", {
    data: {
      name,
      description: "Temporary browser regression lorebook.",
      category: "world",
      isGlobal: true,
      enabled: true,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const lorebook = (await createResponse.json()) as { id: string };

  let patchSaved = false;
  await page.route(`**/api/lorebooks/${lorebook.id}`, async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      const response = await route.fetch();
      patchSaved = response.ok();
      await route.fulfill({ response });
      return;
    }
    if (method === "GET" && patchSaved) {
      // Expose the old cache race: before the fix, Save marked the form clean
      // and reloaded its stale pre-save detail while this refetch was pending.
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    await route.continue();
  });

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(name, { exact: true }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByRole("checkbox", { name: "Disable global lorebook" }).evaluate((element) => {
      (element as HTMLInputElement).click();
    });
    const disabledGlobalSwitch = page.getByRole("checkbox", { name: "Enable global lorebook" });
    await expect(disabledGlobalSwitch).not.toBeChecked();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Lorebook saved")).toBeVisible();
    await page.waitForTimeout(900);
    await expect(disabledGlobalSwitch).toBeVisible();
    await expect(disabledGlobalSwitch).not.toBeChecked();

    const savedResponse = await page.request.get(`/api/lorebooks/${lorebook.id}`);
    expect(savedResponse.ok()).toBeTruthy();
    expect(((await savedResponse.json()) as { isGlobal: boolean }).isGlobal).toBe(false);
  } finally {
    if (!page.isClosed()) {
      await page.unroute(`**/api/lorebooks/${lorebook.id}`);
      await page.request.delete(`/api/lorebooks/${lorebook.id}`);
    }
  }
});

test("selected Lorebook entries accept one batch setting update", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop editor batch controls are covered on desktop.");

  const name = `Lorebook batch edit ${Date.now()}`;
  const createResponse = await page.request.post("/api/lorebooks", {
    data: { name, description: "Temporary batch-edit regression lorebook.", category: "world", enabled: true },
  });
  expect(createResponse.ok()).toBeTruthy();
  const lorebook = (await createResponse.json()) as { id: string };

  try {
    for (const entryName of ["Batch Entry One", "Batch Entry Two"]) {
      const entryResponse = await page.request.post(`/api/lorebooks/${lorebook.id}/entries`, {
        data: { name: entryName, content: `${entryName} content`, preventRecursion: true },
      });
      expect(entryResponse.ok()).toBeTruthy();
    }

    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(name, { exact: true }).click();
    await page.getByRole("button", { name: /^Entries/ }).click();
    await page.getByTitle("Select entries to copy or move").click();
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
    await page.getByLabel("Setting to apply to selected entries").selectOption("preventRecursion");
    await page.getByLabel("Value to apply to selected entries").selectOption("false");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("Prevent recursion updated for 2 entries.")).toBeVisible();

    const entriesResponse = await page.request.get(`/api/lorebooks/${lorebook.id}/entries`);
    expect(entriesResponse.ok()).toBeTruthy();
    const entries = (await entriesResponse.json()) as Array<{ preventRecursion: boolean }>;
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.preventRecursion === false)).toBe(true);
  } finally {
    await page.request.delete(`/api/lorebooks/${lorebook.id}`).catch(() => undefined);
  }
});

test("Lorebook context filter chips expose Noodle and keep complete borders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop Lorebook filter geometry is covered on desktop.");

  const suffix = Date.now();
  const characterName = `Filter chip character ${suffix}`;
  const characterTag = `Filter tag ${suffix}`;
  const lorebookName = `Lorebook filter chip geometry ${suffix}`;
  const entryName = `Filter chip entry ${suffix}`;
  const characterResponse = await page.request.post("/api/characters", {
    data: { data: { name: characterName, tags: [characterTag] } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const lorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Temporary filter chip geometry fixture.",
      category: "world",
      enabled: true,
    },
  });
  expect(lorebookResponse.ok()).toBeTruthy();
  const lorebook = (await lorebookResponse.json()) as { id: string };
  const entryResponse = await page.request.post(`/api/lorebooks/${lorebook.id}/entries`, {
    data: {
      name: entryName,
      content: "Filter chip geometry fixture content.",
      characterFilterMode: "include",
      characterFilterIds: [character.id],
      characterTagFilterMode: "include",
      characterTagFilters: [characterTag],
      generationTriggerFilterMode: "include",
      generationTriggerFilters: ["conversation"],
      additionalMatchingSources: ["character_name"],
    },
  });
  expect(entryResponse.ok()).toBeTruthy();
  const entry = (await entryResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(lorebookName, { exact: true }).click();
    await page.getByRole("button", { name: /^Entries/ }).click();
    await page.getByRole("button", { name: "Expand entry" }).click();
    await page.getByText("Context filters & matching sources", { exact: true }).click();

    const filterArea = page.locator("details").filter({ hasText: "Context filters & matching sources" });
    const chips = filterArea.locator("button.mari-editor-chip");
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThan(8);
    await expect(filterArea.locator("button.mari-editor-chip--accent")).toHaveCount(4);

    const noodleChip = filterArea.getByRole("button", { name: "Noodle", exact: true });
    await expect(noodleChip).toBeVisible();
    await noodleChip.click();
    await expect(noodleChip).toHaveClass(/mari-editor-chip--accent/u);
    await expect
      .poll(async () => {
        const entriesResponse = await page.request.get(`/api/lorebooks/${lorebook.id}/entries`);
        const entries = (await entriesResponse.json()) as Array<{ id: string; generationTriggerFilters: string[] }>;
        return entries.find((candidate) => candidate.id === entry.id)?.generationTriggerFilters ?? [];
      })
      .toContain("noodle");

    const invalidBorders = await chips.evaluateAll((elements) =>
      elements
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            label: element.textContent?.trim() ?? "",
            widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
            styles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
            shadow: style.boxShadow,
          };
        })
        .filter(
          (chip) =>
            chip.widths.some((width) => width !== "1px") ||
            chip.styles.some((style) => style !== "solid") ||
            chip.shadow !== "none",
        ),
    );
    expect(invalidBorders).toEqual([]);
  } finally {
    await Promise.all([
      page.request.delete(`/api/lorebooks/${lorebook.id}`).catch(() => undefined),
      page.request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("Conversation autocompletes and renders standard emoji shortcodes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop Conversation autocomplete is covered on desktop.");

  const characterResponse = await page.request.post("/api/characters", {
    data: { data: { name: `Emoji Character ${Date.now()}` } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Standard emoji autocomplete", mode: "conversation", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", characterId: character.id, content: "Model sent :CRYING:" },
    });
    expect(messageResponse.ok()).toBeTruthy();
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    await expect(page.getByText("Model sent 😢", { exact: true })).toBeVisible();
    const input = page.locator('textarea[placeholder*="Message"]').last();
    await input.fill(":CRY");
    const cryingSuggestion = page.getByRole("button", { name: /:crying:.*Standard/i });
    await expect(cryingSuggestion).toBeVisible();
    await cryingSuggestion.click();
    await expect(input).toHaveValue("😢 ");
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
    await page.request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("home page stays fitted while FAQ behavior matches the viewport", async ({ page }, testInfo) => {
  const errors = collectUnexpectedErrors(page);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const home = page.locator('[data-component="ChatArea.EmptyState"]');
  const content = page.locator('[data-component="ChatArea.HomeContent"]');
  await expect(home).toBeVisible();
  await expect(content).toBeVisible();

  await expectHomeContentFits(page);
  await expect(home).toHaveCSS("overflow-y", "hidden");
  const defaultScale = await content.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 1 : new DOMMatrix(transform).a;
  });
  expect(defaultScale).toBeGreaterThanOrEqual(0.9);

  const inlineFaq = page.locator('[data-component="HomeFaq.Compact"]');
  const mobileFaqLauncher = page.locator('[data-component="HomeFaq.MobileLauncher"]');

  if (mobile) {
    await expect(inlineFaq).toBeHidden();
    await expect(mobileFaqLauncher).toBeVisible();
    await expect(mobileFaqLauncher.locator(".lucide-chevron-right")).toHaveCount(0);

    const recentChats = page.locator('[data-component="RecentChats"]');
    const mariPanel = page.locator('[data-component="HomeProfessorMariChat.MariPanel"]');
    const mariSprite = page.locator('[data-component="HomeProfessorMariChat.Scene"] [data-part="sprite"]');
    const mobileGeometry = await Promise.all([
      recentChats.boundingBox(),
      mariPanel.boundingBox(),
      mariSprite.boundingBox(),
    ]);
    const [recentRect, panelRect, spriteRect] = mobileGeometry;
    expect(recentRect).not.toBeNull();
    expect(panelRect).not.toBeNull();
    expect(spriteRect).not.toBeNull();
    expect(spriteRect!.y).toBeLessThan(panelRect!.y);
    expect(spriteRect!.y).toBeGreaterThanOrEqual(recentRect!.y + recentRect!.height);

    await mobileFaqLauncher.getByRole("button", { name: "Open Professor Mari's FAQ" }).click();
    const faqDialog = page.getByRole("dialog", { name: "Professor Mari's FAQ" });
    await expect(faqDialog).toBeVisible();
    await expect(faqDialog.getByRole("searchbox", { name: "Search FAQ" })).toBeVisible();
    await expect(faqDialog.getByText("Start here before you go hunting through Discord logs.")).toHaveCount(0);
    await expect(faqDialog.getByText("Before You Post A Bug")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(faqDialog).toBeHidden();
  } else {
    await expect(mobileFaqLauncher).toBeHidden();
    await expect(inlineFaq).toBeVisible();
    const desktopFaqHeader = inlineFaq.locator('[data-component="HomeFaq.DesktopHeader"]');
    await expect(desktopFaqHeader).toBeVisible();
    expect(await desktopFaqHeader.evaluate((element) => element.tagName)).toBe("DIV");
    await expect(inlineFaq.locator('[data-component="HomeFaq.CompactList"]')).toBeVisible();

    const faqPanel = page.locator('[data-component="HomeProfessorMariChat.FaqPanel"]');
    const [faqPanelRect, inlineFaqRect] = await Promise.all([faqPanel.boundingBox(), inlineFaq.boundingBox()]);
    expect(faqPanelRect).not.toBeNull();
    expect(inlineFaqRect).not.toBeNull();
    expect(
      Math.abs(faqPanelRect!.y + faqPanelRect!.height - (inlineFaqRect!.y + inlineFaqRect!.height)),
    ).toBeLessThanOrEqual(12);

    const mariWelcome = page.locator('[data-component="HomeProfessorMariChat.Welcome"]');
    await expect(mariWelcome).toBeVisible();
    const mariWelcomeFits = await mariWelcome.evaluate((element) => element.scrollHeight <= element.clientHeight + 1);
    expect(mariWelcomeFits).toBe(true);
  }

  await page.setViewportSize({ width: mobile ? 390 : 1024, height: mobile ? 650 : 700 });
  await expectHomeContentFits(page);
  await expect(home).toHaveCSS("overflow-y", "hidden");

  expect(errors).toEqual([]);
});

test("Noodle interface icons consistently use Noodle blue", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The full Noodle settings surface is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();

  const noodle = page.locator('[data-component="NoodleView"]');
  await expect(noodle).toBeVisible();

  const expectBlueIcons = async (selector: string) => {
    const iconColors = await page
      .locator(selector)
      .locator("svg:visible")
      .evaluateAll((icons) => Array.from(new Set(icons.map((icon) => getComputedStyle(icon).color))));
    expect(iconColors.length).toBeGreaterThan(0);
    expect(iconColors).toEqual(["rgb(126, 167, 255)"]);
  };

  await expectBlueIcons('[data-component="NoodleView"]');
  await noodle.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(noodle.getByRole("button", { name: "Reset Noodle Timeline" })).toBeVisible();
  await expect(noodle.getByRole("button", { name: "Uninvite everybody" })).toHaveCSS("color", "rgb(126, 167, 255)");
  const scheduleCard = noodle.locator('[data-component="NoodleView.RefreshSchedule"]');
  await expect(scheduleCard).toBeVisible();
  await expect(scheduleCard.getByText("Automatic schedule")).toBeVisible();
  await expectBlueIcons('[data-component="NoodleView"]');

  const firstBootstrapResponse = await page.request.get("/api/noodle");
  expect(firstBootstrapResponse.ok()).toBe(true);
  const firstBootstrap = (await firstBootstrapResponse.json()) as {
    settings: { refreshesPerDay: number };
    scheduler: { scheduledTimes: string[]; completedTimes: string[] };
  };
  expect(firstBootstrap.scheduler.scheduledTimes).toHaveLength(firstBootstrap.settings.refreshesPerDay);
  const secondBootstrap = (await (await page.request.get("/api/noodle")).json()) as {
    scheduler: { scheduledTimes: string[] };
  };
  expect(secondBootstrap.scheduler.scheduledTimes).toEqual(firstBootstrap.scheduler.scheduledTimes);

  await expect(scheduleCard.locator("[data-noodle-schedule-slot]")).toHaveCount(
    firstBootstrap.scheduler.scheduledTimes.length,
  );
  const pendingRefreshCount = firstBootstrap.scheduler.scheduledTimes.filter(
    (scheduledTime) => !firstBootstrap.scheduler.completedTimes.includes(scheduledTime),
  ).length;
  const rescheduleButtons = scheduleCard.getByRole("button", { name: /^Reschedule refresh / });
  await expect(rescheduleButtons).toHaveCount(pendingRefreshCount);
  if (pendingRefreshCount > 0) {
    await rescheduleButtons.first().click();
    await expect(scheduleCard.getByLabel(/^New time for refresh /)).toBeVisible();
    await expect(scheduleCard.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await scheduleCard.getByRole("button", { name: "Cancel reschedule" }).click();
    await expect(scheduleCard.getByLabel(/^New time for refresh /)).toHaveCount(0);
  }

  await noodle.getByRole("button", { name: "Reset Noodle Timeline" }).click();
  const resetDialog = page.getByRole("dialog", { name: "Reset Noodle Timeline" });
  await expect(resetDialog).toBeVisible();
  await expectBlueIcons('[role="dialog"][aria-label="Reset Noodle Timeline"]');
  await resetDialog.getByRole("button", { name: "Cancel" }).click();

  expect(errors).toEqual([]);
});

test("Noodle settings edit and restore the timeline base prompt", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The complete prompt editing flow is covered on desktop.");

  const promptKey = "noodle.timelineBase";
  const initialDetailResponse = await page.request.get(`/api/prompt-overrides/${promptKey}`);
  expect(initialDetailResponse.ok()).toBe(true);
  const initialDetail = (await initialDetailResponse.json()) as {
    override: { template: string; enabled: boolean } | null;
  };
  const customPrompt = `Custom Noodle timeline base prompt ${Date.now()}.`;

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    const noodle = page.locator('[data-component="NoodleView"]');
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();

    const promptSetting = noodle.locator('[data-component="NoodleView.PromptSetting"]');
    await expect(promptSetting).toBeVisible();
    const promptRect = await promptSetting.boundingBox();
    const invitesRect = await noodle.getByRole("heading", { name: "Invites" }).boundingBox();
    expect(promptRect).not.toBeNull();
    expect(invitesRect).not.toBeNull();
    expect(promptRect!.y).toBeLessThan(invitesRect!.y);

    const editPromptButton = promptSetting.getByRole("button", { name: "Edit prompt" });
    await expect(editPromptButton).toHaveCSS("align-items", "center");
    await expect(editPromptButton).toHaveCSS("justify-content", "center");
    await expect(editPromptButton.locator("svg")).toBeVisible();
    await expect(editPromptButton.locator("svg")).toHaveCSS("color", "rgb(126, 167, 255)");
    await editPromptButton.click();
    const editor = page.locator('[data-component="ExpandedTextarea"]');
    await expect(editor.getByRole("heading", { name: "Edit Noodle Prompt" })).toBeVisible();
    const promptTextarea = editor.locator("textarea");
    await expect(promptTextarea).toHaveValue(
      /You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./,
    );
    await promptTextarea.fill(customPrompt);
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/prompt-overrides/${promptKey}`,
    );
    await editor.getByRole("button", { name: "Save prompt" }).click();
    expect((await saveResponse).ok()).toBe(true);
    await expect(promptSetting).toContainText(customPrompt);
    await expect(promptSetting).toContainText("Custom");

    const restoreResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === `/api/prompt-overrides/${promptKey}`,
    );
    await promptSetting.getByRole("button", { name: "Restore default" }).click();
    expect((await restoreResponse).ok()).toBe(true);
    await expect(promptSetting).toContainText("Default");

    await promptSetting.getByRole("button", { name: "Edit prompt" }).click();
    await expect(page.locator('[data-component="ExpandedTextarea"] textarea')).toHaveValue(
      /You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./,
    );
  } finally {
    if (initialDetail.override) {
      await page.request.put(`/api/prompt-overrides/${promptKey}`, {
        data: initialDetail.override,
      });
    } else {
      await page.request.delete(`/api/prompt-overrides/${promptKey}`);
    }
  }
});

test("Noodle carryover mode labels fit inside their controls", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The compact three-column settings row is desktop-only.");

  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();
  const noodle = page.locator('[data-component="NoodleView"]');
  await noodle.getByRole("button", { name: "Settings", exact: true }).click();
  const carryoverSection = noodle.getByRole("heading", { name: "Carryover" }).locator("..");

  for (const name of ["Conversations", "Roleplays", "Games"]) {
    const checkbox = carryoverSection.getByRole("checkbox", { name, exact: true });
    const control = checkbox.locator("..");
    const text = control.getByText(name, { exact: true });
    await expect(control).toBeVisible();
    const [controlRect, textRect, checkboxRect] = await Promise.all([
      control.boundingBox(),
      text.boundingBox(),
      checkbox.boundingBox(),
    ]);
    expect(controlRect).not.toBeNull();
    expect(textRect).not.toBeNull();
    expect(checkboxRect).not.toBeNull();
    expect(textRect!.x).toBeGreaterThanOrEqual(controlRect!.x);
    expect(checkboxRect!.x - (textRect!.x + textRect!.width)).toBeGreaterThanOrEqual(6);
    expect(checkboxRect!.x + checkboxRect!.width).toBeLessThanOrEqual(controlRect!.x + controlRect!.width);
    expect(await text.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});

test("Noodle settings persist through refetch and reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Noodle settings persistence is covered on desktop.");

  const initialResponse = await page.request.get("/api/noodle");
  expect(initialResponse.ok()).toBe(true);
  const initial = (await initialResponse.json()) as {
    settings: {
      enableImagePrompts: boolean;
      maxImagesPerRefresh: number;
      allowRandomUsers: boolean;
      carryoverMaxItems: number;
      refreshesPerDay: number;
    };
  };
  const nextImageLimit = initial.settings.maxImagesPerRefresh === 9 ? 8 : 9;
  const nextRandomUsers = !initial.settings.allowRandomUsers;
  const nextCarryItems = initial.settings.carryoverMaxItems === 10 ? 9 : 10;
  const nextRefreshesPerDay = initial.settings.refreshesPerDay === 3 ? 4 : 3;

  const enableImagesResponse = await page.request.put("/api/noodle/settings", {
    data: { enableImagePrompts: true },
  });
  expect(enableImagesResponse.ok()).toBe(true);
  const enabledSettings = (await enableImagesResponse.json()) as typeof initial.settings;
  expect(enabledSettings.enableImagePrompts).toBe(true);

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    const noodle = page.locator('[data-component="NoodleView"]');
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();

    const imageLimitInput = noodle
      .locator("label")
      .filter({ hasText: "Images/refresh" })
      .locator('input[type="number"]');
    await expect(imageLimitInput).toBeVisible();
    const imageSaveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/noodle/settings",
    );
    await imageLimitInput.fill(String(nextImageLimit));
    await imageLimitInput.blur();
    expect((await imageSaveResponse).ok()).toBe(true);
    await expect(imageLimitInput).toHaveValue(String(nextImageLimit));

    const randomUsersButton = noodle.getByRole("button", { name: /Random users/ });
    const randomUsersSaveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/noodle/settings",
    );
    await randomUsersButton.click();
    expect((await randomUsersSaveResponse).ok()).toBe(true);

    await expect
      .poll(async () => {
        const response = await page.request.get("/api/noodle");
        const bootstrap = (await response.json()) as typeof initial;
        return {
          maxImagesPerRefresh: bootstrap.settings.maxImagesPerRefresh,
          allowRandomUsers: bootstrap.settings.allowRandomUsers,
        };
      })
      .toEqual({ maxImagesPerRefresh: nextImageLimit, allowRandomUsers: nextRandomUsers });

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    const reloadedNoodle = page.locator('[data-component="NoodleView"]');
    await reloadedNoodle.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      reloadedNoodle.locator("label").filter({ hasText: "Images/refresh" }).locator('input[type="number"]'),
    ).toHaveValue(String(nextImageLimit));
    await expect(reloadedNoodle.getByRole("button", { name: /Random users/ })).toContainText(
      nextRandomUsers ? "Enabled" : "Ambient fake profiles",
    );

    const carryItemsInput = reloadedNoodle
      .locator("label")
      .filter({ hasText: "Carry items" })
      .locator('input[type="number"]');
    await carryItemsInput.fill(String(nextCarryItems));
    await reloadedNoodle.getByRole("button", { name: "Home", exact: true }).click();
    await reloadedNoodle.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      reloadedNoodle.locator("label").filter({ hasText: "Carry items" }).locator('input[type="number"]'),
    ).toHaveValue(String(nextCarryItems));
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/noodle");
        const bootstrap = (await response.json()) as typeof initial;
        return bootstrap.settings.carryoverMaxItems;
      })
      .toBe(nextCarryItems);

    const refreshesPerDayInput = reloadedNoodle
      .locator("label")
      .filter({ hasText: "Refreshes/day" })
      .locator('input[type="number"]');
    await refreshesPerDayInput.fill(String(nextRefreshesPerDay));
    await reloadedNoodle.getByRole("button", { name: /Notifications/ }).click();
    await reloadedNoodle.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      reloadedNoodle.locator("label").filter({ hasText: "Refreshes/day" }).locator('input[type="number"]'),
    ).toHaveValue(String(nextRefreshesPerDay));
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/noodle");
        const bootstrap = (await response.json()) as typeof initial;
        return bootstrap.settings.refreshesPerDay;
      })
      .toBe(nextRefreshesPerDay);
  } finally {
    await page.request.put("/api/noodle/settings", {
      data: {
        enableImagePrompts: initial.settings.enableImagePrompts,
        maxImagesPerRefresh: initial.settings.maxImagesPerRefresh,
        allowRandomUsers: initial.settings.allowRandomUsers,
        carryoverMaxItems: initial.settings.carryoverMaxItems,
        refreshesPerDay: initial.settings.refreshesPerDay,
      },
    });
  }
});

test("Noodle restores the selected persona and preserves per-persona post authorship", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Noodle persona persistence is covered on desktop.");

  const createdPersonaIds: string[] = [];
  const createdPostIds: string[] = [];
  try {
    for (const name of ["Noodle Persona One", "Noodle Persona Two"]) {
      const response = await page.request.post("/api/characters/personas", {
        data: { name, description: "Temporary Noodle account persistence regression persona." },
      });
      expect(response.ok()).toBe(true);
      createdPersonaIds.push(((await response.json()) as { id: string }).id);
    }
    const selectedPersonaId = createdPersonaIds[1]!;
    expect((await page.request.get("/api/noodle")).ok()).toBe(true);
    const authoredPosts = [];
    for (const [index, personaId] of createdPersonaIds.entries()) {
      const response = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "persona",
          authorEntityId: personaId,
          content: `Authorship regression post ${index + 1}`,
        },
      });
      expect(response.ok()).toBe(true);
      const post = (await response.json()) as {
        id: string;
        authorAccountId: string;
        authorSnapshot: { kind: string; entityId: string; displayName: string; handle: string } | null;
      };
      createdPostIds.push(post.id);
      authoredPosts.push(post);
      expect(post.authorSnapshot).toMatchObject({
        kind: "persona",
        entityId: personaId,
        displayName: `Noodle Persona ${index === 0 ? "One" : "Two"}`,
      });
    }
    expect(authoredPosts[0]?.authorAccountId).not.toBe(authoredPosts[1]?.authorAccountId);

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    const noodle = page.locator('[data-component="NoodleView"]');
    const accountSwitcher = noodle.locator('[data-component="NoodleView.AccountSwitcher"]');
    await accountSwitcher.click();
    await noodle.locator(`[data-noodle-persona-id="${selectedPersonaId}"]`).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("marinara-engine-ui");
          if (!raw) return null;
          return (
            (JSON.parse(raw) as { state?: { noodleSelectedPersonaId?: string | null } }).state
              ?.noodleSelectedPersonaId ?? null
          );
        }),
      )
      .toBe(selectedPersonaId);

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    await expect(noodle).toBeVisible();
    await expect(accountSwitcher).toContainText("Noodle Persona Two");
    for (const [index, post] of authoredPosts.entries()) {
      const article = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
      await expect(article).toContainText(`Noodle Persona ${index === 0 ? "One" : "Two"}`);
      await expect(article).toContainText(`@${post.authorSnapshot?.handle}`);
    }
  } finally {
    for (const postId of createdPostIds) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    for (const personaId of createdPersonaIds) {
      await page.request.delete(`/api/characters/personas/${personaId}`, { timeout: 5_000 }).catch(() => undefined);
    }
  }
});

test("Noodle posts tag invited characters with @handle mentions", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  let createdPostId: string | null = null;
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Mention Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  const initialBootstrapResponse = await page.request.get("/api/noodle");
  expect(initialBootstrapResponse.ok()).toBe(true);
  const initialBootstrap = (await initialBootstrapResponse.json()) as {
    accounts: Array<{ id: string; entityId: string; handle: string }>;
  };
  const professorMariAccount = initialBootstrap.accounts.find((account) => account.entityId === "__professor_mari__");
  expect(professorMariAccount).toBeTruthy();

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const composer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    const textarea = composer.getByPlaceholder("What's simmering?");
    await textarea.fill("Dinner with @prof");

    const mentionList = composer.getByRole("listbox", { name: "Tag a character" });
    await expect(mentionList).toBeVisible();
    await mentionList.getByRole("option", { name: /Professor Mari.*@professor_mari/i }).click();
    await expect(textarea).toHaveValue("Dinner with @professor_mari ");
    await textarea.pressSequentially("tonight.");

    const postResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/noodle/posts",
    );
    await composer.getByRole("button", { name: "Post", exact: true }).click();
    const postResponse = await postResponsePromise;
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as {
      id: string;
      metadata: { mentionedAccountIds?: string[] };
    };
    createdPostId = post.id;
    await expect(textarea).toHaveValue("");
    expect(post.metadata.mentionedAccountIds).toContain(professorMariAccount!.id);

    const postArticle = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
    await expect(postArticle).toBeVisible();
    const mention = postArticle.getByRole("button", { name: "View @professor_mari profile" });
    await expect(mention).toBeVisible();

    const updatedBootstrap = (await (await page.request.get("/api/noodle")).json()) as {
      digests: Array<{ sourcePostId: string | null; accountIds: string[] }>;
    };
    const postDigest = updatedBootstrap.digests.find((digest) => digest.sourcePostId === post.id);
    expect(postDigest?.accountIds).toContain(professorMariAccount!.id);

    await mention.click();
    await expect(noodle.getByRole("heading", { name: "Professor Mari", exact: true })).toBeVisible();

    const replyResponse = await page.request.post(`/api/noodle/posts/${post.id}/interactions`, {
      data: {
        actorKind: "persona",
        actorEntityId: personaId,
        type: "reply",
        content: "Reply mention for @professor_mari.",
      },
    });
    expect(replyResponse.ok()).toBe(true);
    const reply = (await replyResponse.json()) as { id: string };

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    const replyMention = page
      .locator(`[data-noodle-interaction-id="${reply.id}"]`)
      .getByRole("button", { name: "View @professor_mari profile" });
    await expect(replyMention).toBeVisible();
    await replyMention.click();
    await expect(noodle.getByRole("heading", { name: "Professor Mari", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (createdPostId) {
      await page.request.delete(`/api/noodle/posts/${createdPostId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle polls support character creation and voting on both sides", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  const createdPostIds: string[] = [];
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Poll Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  const initialBootstrapResponse = await page.request.get("/api/noodle");
  expect(initialBootstrapResponse.ok()).toBe(true);
  const initialBootstrap = (await initialBootstrapResponse.json()) as {
    accounts: Array<{ id: string; kind: string; entityId: string }>;
  };
  const professorMariAccount = initialBootstrap.accounts.find((account) => account.entityId === "__professor_mari__");
  const personaAccount = initialBootstrap.accounts.find(
    (account) => account.kind === "persona" && account.entityId === personaId,
  );
  expect(professorMariAccount).toBeTruthy();
  expect(personaAccount).toBeTruthy();

  const characterPollResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "character",
      authorEntityId: "__professor_mari__",
      content: "Help me choose the laboratory tea.",
      poll: { question: "Which tea should I brew?", options: ["Jasmine", "Earl Grey"] },
    },
  });
  expect(characterPollResponse.ok()).toBe(true);
  const characterPollPost = (await characterPollResponse.json()) as {
    id: string;
    metadata: { poll?: { options: Array<{ id: string; label: string }> } };
  };
  createdPostIds.push(characterPollPost.id);
  expect(characterPollPost.metadata.poll?.options).toHaveLength(2);

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const characterPollArticle = noodle.locator(`[data-noodle-post-id="${characterPollPost.id}"]`);
    await expect(characterPollArticle.getByRole("region", { name: "Poll: Which tea should I brew?" })).toBeVisible();
    const jasmineOption = characterPollArticle.locator('[data-noodle-poll-option="option-1"]');
    const earlGreyOption = characterPollArticle.locator('[data-noodle-poll-option="option-2"]');

    await jasmineOption.click();
    await expect(jasmineOption).toHaveAttribute("aria-pressed", "true");
    await expect(characterPollArticle.getByText("1 vote · You voted")).toBeVisible();
    await earlGreyOption.click();
    await expect(earlGreyOption).toHaveAttribute("aria-pressed", "true");
    await expect(jasmineOption).toHaveAttribute("aria-pressed", "false");
    await expect(characterPollArticle.getByText("1 vote · You voted")).toBeVisible();

    const voteBootstrap = (await (await page.request.get("/api/noodle")).json()) as {
      interactions: Array<{
        postId: string;
        actorAccountId: string;
        type: string;
        content: string | null;
      }>;
    };
    const personaVotes = voteBootstrap.interactions.filter(
      (interaction) =>
        interaction.postId === characterPollPost.id &&
        interaction.actorAccountId === personaAccount!.id &&
        interaction.type === "vote",
    );
    expect(personaVotes).toHaveLength(1);
    expect(personaVotes[0]?.content).toBe("option-2");

    const composer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    await composer.getByTitle("Create poll").click();
    await page.getByPlaceholder("Ask a question").fill("Which experiment comes next?");
    await page.getByPlaceholder("Option 1").fill("Robotics");
    await page.getByPlaceholder("Option 2").fill("Alchemy");
    await page.getByRole("button", { name: "Add Poll", exact: true }).click();
    await expect(composer.locator('[data-component="NoodleView.DraftPoll"]')).toBeVisible();

    const personaPollResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/noodle/posts",
    );
    await composer.getByRole("button", { name: "Post", exact: true }).click();
    const personaPollResponse = await personaPollResponsePromise;
    expect(personaPollResponse.ok()).toBe(true);
    const personaPollPost = (await personaPollResponse.json()) as {
      id: string;
      metadata: { poll?: { question: string; options: Array<{ id: string }> } };
    };
    createdPostIds.push(personaPollPost.id);
    expect(personaPollPost.metadata.poll?.question).toBe("Which experiment comes next?");

    const characterVoteResponse = await page.request.post(`/api/noodle/posts/${personaPollPost.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "vote",
        content: personaPollPost.metadata.poll?.options[0]?.id,
      },
    });
    expect(characterVoteResponse.ok()).toBe(true);
    const characterVote = (await characterVoteResponse.json()) as {
      actorAccountId: string;
      type: string;
      content: string | null;
    };
    expect(characterVote.actorAccountId).toBe(professorMariAccount!.id);
    expect(characterVote.type).toBe("vote");
    expect(characterVote.content).toBe("option-1");
    expect(errors).toEqual([]);
  } finally {
    for (const postId of createdPostIds) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("liking one Noodle post leaves unrelated reaction controls visually stable", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Reaction stability is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  const createdPostIds: string[] = [];
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Reaction Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  await page.request.get("/api/noodle");
  for (const label of ["First", "Second"]) {
    const response = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "persona",
        authorEntityId: personaId,
        content: `${label} reaction stability post ${Date.now()}`,
      },
    });
    expect(response.ok()).toBe(true);
    createdPostIds.push(((await response.json()) as { id: string }).id);
  }

  const reactionRequestStarted = createDeferred();
  const releaseReaction = createDeferred();

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const targetPost = noodle.locator(`[data-noodle-post-id="${createdPostIds[0]}"]`);
    const unrelatedPost = noodle.locator(`[data-noodle-post-id="${createdPostIds[1]}"]`);
    await expect(targetPost).toBeVisible();
    await expect(unrelatedPost).toBeVisible();

    const targetLike = targetPost.getByRole("button", { name: "Like post" });
    const unrelatedLike = unrelatedPost.getByRole("button", { name: "Like post" });
    await expect(targetLike.locator("svg")).toHaveAttribute("fill", "none");
    const unrelatedClass = await unrelatedLike.getAttribute("class");
    const unrelatedText = await unrelatedLike.textContent();
    await page.route("**/api/noodle/posts/*/interactions", async (route) => {
      if (route.request().method() === "POST") {
        reactionRequestStarted.resolve();
        await releaseReaction.promise;
      }
      await route.continue();
    });

    let bootstrapRequestsAfterLike = 0;
    let countBootstrapRequests = false;
    page.on("request", (request) => {
      if (countBootstrapRequests && request.method() === "GET" && new URL(request.url()).pathname === "/api/noodle") {
        bootstrapRequestsAfterLike += 1;
      }
    });

    countBootstrapRequests = true;
    await targetLike.click();
    await reactionRequestStarted.promise;
    await expect(targetLike).toBeDisabled();
    await expect(targetLike).toHaveAttribute("aria-busy", "true");
    await expect(unrelatedLike).toBeEnabled();
    await expect(unrelatedLike).toHaveAttribute("class", unrelatedClass ?? "");
    await expect(unrelatedLike).toHaveText(unrelatedText ?? "");

    releaseReaction.resolve();
    const targetUnlike = targetPost.getByRole("button", { name: "Unlike post" });
    await expect(targetUnlike).toBeEnabled();
    await expect(targetUnlike.locator("svg")).toHaveAttribute("fill", "currentColor");
    await expect(targetPost.locator('[data-noodle-reaction="like"]')).toContainText("1");
    await expect(unrelatedLike).toBeEnabled();
    await page.waitForTimeout(150);
    expect(bootstrapRequestsAfterLike).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    releaseReaction.resolve();
    for (const postId of createdPostIds) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle persona and character comments can be edited and deleted", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Comment ownership controls are covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  let personaId: string | null = null;
  let createdPersonaId: string | null = null;
  let postId: string | null = null;
  let controlPostId: string | null = null;

  try {
    const activePersonaResponse = await page.request.get("/api/characters/personas/active");
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    personaId = activePersona?.id ?? null;
    if (!personaId) {
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: "Noodle Comment Owner", description: "Temporary browser regression persona." },
      });
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
      expect(activateResponse.ok()).toBe(true);
    }

    await page.request.get("/api/noodle");
    const postResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: "__professor_mari__",
        content: `Comment ownership regression ${Date.now()}`,
      },
    });
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as { id: string };
    postId = post.id;
    const controlPostResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: "__professor_mari__",
        content: `Newer control post ${Date.now()}`,
      },
    });
    expect(controlPostResponse.ok()).toBe(true);
    const controlPost = (await controlPostResponse.json()) as { id: string };
    controlPostId = controlPost.id;

    const ownReplyResponse = await page.request.post(`/api/noodle/posts/${postId}/interactions`, {
      data: {
        actorKind: "persona",
        actorEntityId: personaId,
        type: "reply",
        content: "Original persona comment.",
      },
    });
    expect(ownReplyResponse.ok()).toBe(true);
    const ownReply = (await ownReplyResponse.json()) as { id: string };

    const childReplyResponse = await page.request.post(`/api/noodle/posts/${postId}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "reply",
        content: "Character-owned child reply.",
        parentInteractionId: ownReply.id,
      },
    });
    expect(childReplyResponse.ok()).toBe(true);
    const childReply = (await childReplyResponse.json()) as { id: string };

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const activePost = noodle.locator(`[data-noodle-post-id="${postId}"]`);
    const newerControlPost = noodle.locator(`[data-noodle-post-id="${controlPostId}"]`);
    const ownComment = noodle.locator(`[data-noodle-interaction-id="${ownReply.id}"]`);
    const characterComment = noodle.locator(`[data-noodle-interaction-id="${childReply.id}"]`);
    await expect(newerControlPost).toBeVisible();
    await expect(ownComment).toBeVisible();
    await expect(characterComment).toBeVisible();
    expect(
      await activePost.evaluate((element, controlPostId) => {
        const control = document.querySelector(`[data-noodle-post-id="${controlPostId}"]`);
        return Boolean(control && element.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING);
      }, controlPostId),
    ).toBe(true);
    await expect(ownComment.getByRole("button", { name: "Edit comment" })).toBeVisible();
    await expect(ownComment.getByRole("button", { name: "Delete comment" })).toBeVisible();
    await expect(characterComment.getByRole("button", { name: "Edit comment" })).toBeVisible();
    await expect(characterComment.getByRole("button", { name: "Delete comment" })).toBeVisible();

    await characterComment.getByRole("button", { name: "Edit comment" }).click();
    const characterEditor = characterComment.locator('[data-component="NoodleView.CommentEditor"]');
    await characterEditor.getByRole("textbox", { name: "Edit comment" }).fill("Edited character reply.");
    await characterEditor.getByRole("button", { name: "Save" }).click();
    await expect(characterComment).toContainText("Edited character reply.");

    await characterComment.getByRole("button", { name: "Delete comment" }).click();
    const characterDeleteDialog = page.getByRole("dialog", { name: "Delete Noodle Comment" });
    await expect(characterDeleteDialog).toBeVisible();
    await characterDeleteDialog.getByRole("button", { name: "Delete comment" }).click();
    await expect(characterComment).toHaveCount(0);
    await expect(ownComment).toBeVisible();

    await ownComment.getByRole("button", { name: "Edit comment" }).click();
    const editor = ownComment.locator('[data-component="NoodleView.CommentEditor"]');
    await editor.getByRole("textbox", { name: "Edit comment" }).fill("Edited persona comment.");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(ownComment).toContainText("Edited persona comment.");

    await ownComment.getByRole("button", { name: "Delete comment" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete Noodle Comment" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete comment" }).click();
    await expect(ownComment).toHaveCount(0);
    await expect(characterComment).toHaveCount(0);

    expect(errors).toEqual([]);
  } finally {
    if (postId) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (controlPostId) {
      await page.request.delete(`/api/noodle/posts/${controlPostId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle post and reply composers autocomplete character handles", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  let personaId: string | null = null;
  let createdPersonaId: string | null = null;
  let postId: string | null = null;

  try {
    const activePersonaResponse = await page.request.get("/api/characters/personas/active");
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    personaId = activePersona?.id ?? null;
    if (!personaId) {
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: "Noodle Mention Tester", description: "Temporary browser regression persona." },
      });
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
      expect(activateResponse.ok()).toBe(true);
    }

    const bootstrapResponse = await page.request.get("/api/noodle");
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrap = (await bootstrapResponse.json()) as {
      accounts: Array<{ entityId: string; handle: string; kind: string; invited: boolean }>;
    };
    const mentionAccount = bootstrap.accounts.find(
      (account) => account.kind === "character" && account.invited && account.handle.length > 0,
    );
    expect(mentionAccount).toBeDefined();

    const postResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: mentionAccount!.entityId,
        content: `Mention autocomplete regression ${Date.now()}`,
      },
    });
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as { id: string };
    postId = post.id;
    const commentResponse = await page.request.post(`/api/noodle/posts/${post.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: mentionAccount!.entityId,
        type: "reply",
        content: "A comment waiting for a tagged response.",
      },
    });
    expect(commentResponse.ok()).toBe(true);
    const comment = (await commentResponse.json()) as { id: string };

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const mentionPrefix = mentionAccount!.handle.slice(0, Math.min(2, mentionAccount!.handle.length));
    const inlineComposer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    const postTextarea = inlineComposer.getByPlaceholder("What's simmering?");
    await postTextarea.fill(`Hello @${mentionPrefix}`);

    const postMentionList = page.locator("#noodle-inline-mention-list");
    await expect(postMentionList).toBeVisible();
    const postMentionOption = postMentionList.getByRole("option").filter({ hasText: `@${mentionAccount!.handle}` });
    await expect(postMentionOption).toBeVisible();
    await postMentionOption.click();
    await expect(postTextarea).toHaveValue(`Hello @${mentionAccount!.handle} `);

    const activePost = noodle.locator(`[data-noodle-post-id="${postId}"]`);
    const targetComment = activePost.locator(`[data-noodle-interaction-id="${comment.id}"]`);
    await targetComment.getByTitle("Reply").click();
    const replyComposer = activePost.locator(
      `[data-component="NoodleView.ReplyComposer"][data-noodle-reply-parent-id="${comment.id}"]`,
    );
    const replyTextarea = replyComposer.getByPlaceholder("Leave a comment…");
    await replyTextarea.fill(`Replying @${mentionAccount!.handle}`);

    const replyMentionList = page.locator("#noodle-reply-mention-list");
    await expect(replyMentionList).toBeVisible();
    const replyMentionOption = replyMentionList.getByRole("option").filter({ hasText: `@${mentionAccount!.handle}` });
    await expect(replyMentionOption).toBeVisible();
    await replyTextarea.press("Tab");
    await expect(replyTextarea).toHaveValue(`Replying @${mentionAccount!.handle} `);

    expect(errors).toEqual([]);
  } finally {
    if (postId) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle desktop composers insert emojis at the active cursor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop cursor placement is covered in the desktop shell.");

  const errors = collectUnexpectedErrors(page);
  let createdPersonaId: string | null = null;
  let postId: string | null = null;

  try {
    const activePersonaResponse = await page.request.get("/api/characters/personas/active");
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    if (!activePersona?.id) {
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: "Noodle Cursor Tester", description: "Temporary browser regression persona." },
      });
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
      expect(activateResponse.ok()).toBe(true);
    }

    const bootstrapResponse = await page.request.get("/api/noodle");
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrap = (await bootstrapResponse.json()) as {
      accounts: Array<{ entityId: string; kind: string; invited: boolean }>;
    };
    const characterAccount = bootstrap.accounts.find((account) => account.kind === "character" && account.invited);
    expect(characterAccount).toBeDefined();

    const postResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: characterAccount!.entityId,
        content: `Emoji cursor regression ${Date.now()}`,
      },
    });
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as { id: string };
    postId = post.id;

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const inlineComposer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    const postTextarea = inlineComposer.getByPlaceholder("What's simmering?");
    await postTextarea.fill("Alpha Omega");
    await postTextarea.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(6, 6);
    });
    await inlineComposer.getByTitle("Emoji, GIFs and stickers").click();
    await page.getByRole("textbox", { name: "Search emojis" }).fill("test tube");
    await page.getByRole("button", { name: /test tube/i }).click();
    await expect(postTextarea).toHaveValue("Alpha 🧪Omega");
    await expect.poll(() => postTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(8);
    await expect.poll(() => postTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionEnd)).toBe(8);
    await inlineComposer.getByTitle("Emoji, GIFs and stickers").click();

    const activePost = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
    await activePost.getByTitle("Reply").first().click();
    const replyComposer = activePost.locator('[data-component="NoodleView.ReplyComposer"]');
    const replyTextarea = replyComposer.getByPlaceholder("Leave a comment…");
    await replyTextarea.fill("Reply here");
    await replyTextarea.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(6, 10);
    });
    await replyComposer.getByTitle("Emoji, GIFs and stickers").click();
    await page.getByRole("textbox", { name: "Search emojis" }).fill("test tube");
    await page.getByRole("button", { name: /test tube/i }).click();
    await expect(replyTextarea).toHaveValue("Reply 🧪");
    await expect.poll(() => replyTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(8);
    await expect.poll(() => replyTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionEnd)).toBe(8);

    expect(errors).toEqual([]);
  } finally {
    if (postId) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle reply notifications focus the actionable timeline reply", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Reply notification focus is covered on mobile.");

  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Notification Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  await page.request.get("/api/noodle");
  const postResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "persona",
      authorEntityId: personaId,
      content: `Notification focus regression ${Date.now()}`,
    },
  });
  expect(postResponse.ok()).toBe(true);
  const post = (await postResponse.json()) as { id: string };

  try {
    const replyResponse = await page.request.post(`/api/noodle/posts/${post.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "reply",
        content: "A focused reply regression check.",
      },
    });
    expect(replyResponse.ok()).toBe(true);
    const reply = (await replyResponse.json()) as { id: string };

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const notificationsButton = noodle.getByRole("button", { name: "Noodle notifications" });
    await expect(notificationsButton.locator('[data-component="NoodleView.NotificationBadge"]')).toBeVisible();
    await notificationsButton.click();
    await expect(noodle.locator('[data-component="NoodleView.NotificationBadge"]')).toHaveCount(0);
    await noodle.getByRole("button", { name: "Replies", exact: true }).click();

    const notification = noodle.locator(`[data-noodle-notification-target="${reply.id}"]`);
    await expect(notification).toBeVisible();
    await notification.click();

    const focusedReply = noodle.locator(`[data-noodle-interaction-id="${reply.id}"]`);
    await expect(focusedReply).toBeVisible();
    await expect(focusedReply).toBeFocused();
    await expect(focusedReply.getByTitle(/Like comment|Unlike comment/)).toBeVisible();
    await expect(focusedReply.getByTitle("Reply")).toBeVisible();

    await focusedReply.getByTitle("Reply").click();
    const nestedComposer = noodle.locator(
      `[data-component="NoodleView.ReplyComposer"][data-noodle-reply-parent-id="${reply.id}"]`,
    );
    await expect(nestedComposer).toBeVisible();
    await expect(nestedComposer).toContainText("Replying to");
    const [replyRect, composerRect] = await Promise.all([focusedReply.boundingBox(), nestedComposer.boundingBox()]);
    expect(replyRect).not.toBeNull();
    expect(composerRect).not.toBeNull();
    expect(composerRect!.y).toBeGreaterThanOrEqual(replyRect!.y + replyRect!.height - 1);
    expect(
      await nestedComposer.evaluate((composer, interactionId) => {
        const target = document.querySelector(`[data-noodle-interaction-id="${interactionId}"]`);
        return Boolean(target && target.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING);
      }, reply.id),
    ).toBe(true);

    await nestedComposer.getByTitle("Attach image").click();
    const replyImageDivider = page.locator('[data-component="NoodleView.ReplyImageDivider"]');
    await expect(replyImageDivider).toBeVisible();
    await expect(replyImageDivider).toHaveCSS("color", "rgb(126, 167, 255)");

    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/noodle/posts/${post.id}`, { timeout: 5_000 }).catch(() => undefined);
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle only bumps posts when another account replies to the persona's comment", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Timeline bump ordering is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Bump Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  await page.request.get("/api/noodle");
  const olderPostResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "character",
      authorEntityId: "__professor_mari__",
      content: `Older timeline bump regression ${Date.now()}`,
    },
  });
  expect(olderPostResponse.ok()).toBe(true);
  const olderPost = (await olderPostResponse.json()) as { id: string };
  await page.waitForTimeout(10);
  const newerPostResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "character",
      authorEntityId: "__professor_mari__",
      content: `Newer timeline bump regression ${Date.now()}`,
    },
  });
  expect(newerPostResponse.ok()).toBe(true);
  const newerPost = (await newerPostResponse.json()) as { id: string };

  try {
    const personaReplyResponse = await page.request.post(`/api/noodle/posts/${olderPost.id}/interactions`, {
      data: {
        actorKind: "persona",
        actorEntityId: personaId,
        type: "reply",
        content: "My comment should not bump this post.",
      },
    });
    expect(personaReplyResponse.ok()).toBe(true);
    const personaReply = (await personaReplyResponse.json()) as { id: string };

    const readRegressionOrder = async () =>
      page
        .locator("[data-noodle-post-id]")
        .evaluateAll(
          (elements, postIds) =>
            elements
              .map((element) => element.getAttribute("data-noodle-post-id"))
              .filter((postId): postId is string => postId !== null && postIds.includes(postId)),
          [olderPost.id, newerPost.id],
        );

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    await expect(page.locator(`[data-noodle-post-id="${olderPost.id}"]`)).toBeVisible();
    await expect.poll(readRegressionOrder).toEqual([newerPost.id, olderPost.id]);

    const characterReplyResponse = await page.request.post(`/api/noodle/posts/${olderPost.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "reply",
        content: "Professor Mari directly replied to the persona comment.",
        parentInteractionId: personaReply.id,
      },
    });
    expect(characterReplyResponse.ok()).toBe(true);

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    await expect(page.locator(`[data-noodle-post-id="${olderPost.id}"]`)).toBeVisible();
    await expect.poll(readRegressionOrder).toEqual([olderPost.id, newerPost.id]);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/noodle/posts/${olderPost.id}`, { timeout: 5_000 }).catch(() => undefined);
    await page.request.delete(`/api/noodle/posts/${newerPost.id}`, { timeout: 5_000 }).catch(() => undefined);
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle mobile shell keeps navigation usable across every view", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The responsive Noodle shell is covered on mobile.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();

  const noodle = page.locator('[data-component="NoodleView"]');
  const header = noodle.locator('[data-component="NoodleView.MobileHeader"]');
  const bottomNav = noodle.locator('[data-component="NoodleView.MobileBottomNav"]');
  await expect(header).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await expect(header.locator('img[src="/noodle-klusek.png"]')).toBeVisible();

  const [noodleRect, logoRect, bottomNavRect, bottomNavRowRect] = await Promise.all([
    noodle.boundingBox(),
    header.locator('img[src="/noodle-klusek.png"]').boundingBox(),
    bottomNav.boundingBox(),
    bottomNav.locator(":scope > div").boundingBox(),
  ]);
  expect(noodleRect).not.toBeNull();
  expect(logoRect).not.toBeNull();
  expect(bottomNavRect).not.toBeNull();
  expect(bottomNavRowRect).not.toBeNull();
  expect(Math.abs(logoRect!.x + logoRect!.width / 2 - (noodleRect!.x + noodleRect!.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(bottomNavRect!.y + bottomNavRect!.height - (noodleRect!.y + noodleRect!.height))).toBeLessThanOrEqual(
    1,
  );
  expect(bottomNavRowRect!.height).toBe(52);
  expect(bottomNavRect!.height).toBeLessThanOrEqual(58);

  const sawDrawerSlide = await page.evaluate(async () => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Open Noodle account menu"]');
    if (!trigger) return false;
    trigger.click();
    const positions: number[] = [];
    for (let frame = 0; frame < 10; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const drawer = document.querySelector<HTMLElement>('[data-component="NoodleView.MobileDrawer"]');
      if (drawer) positions.push(drawer.getBoundingClientRect().x);
    }
    const first = positions[0];
    const last = positions.at(-1);
    return first !== undefined && last !== undefined && first < -1 && last > first + 10;
  });
  expect(sawDrawerSlide).toBe(true);

  const drawer = page.locator('[data-component="NoodleView.MobileDrawer"]');
  const accountMenu = page.getByRole("dialog", { name: "Noodle account menu" });
  await expect(accountMenu).toBeVisible();
  await expect.poll(() => drawer.evaluate((element) => Math.round(element.getBoundingClientRect().x))).toBe(0);
  const [drawerRect, topBarRect] = await Promise.all([
    drawer.boundingBox(),
    page.locator('[data-component="TopBar"]').boundingBox(),
  ]);
  expect(drawerRect).not.toBeNull();
  expect(topBarRect).not.toBeNull();
  expect(Math.abs(drawerRect!.x - noodleRect!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(drawerRect!.y - noodleRect!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(drawerRect!.width - noodleRect!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(drawerRect!.height - noodleRect!.height)).toBeLessThanOrEqual(1);
  expect(drawerRect!.y).toBeGreaterThanOrEqual(topBarRect!.y + topBarRect!.height - 1);
  for (const item of ["Home", "Profile", "Settings", "Post"]) {
    await expect(accountMenu.getByRole("button", { name: item, exact: true })).toBeVisible();
  }
  await expect(accountMenu.getByRole("button", { name: "Switch account" })).toBeVisible();

  const retainedDuringCollapse = await page.evaluate(async () => {
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Close Noodle account menu"]');
    close?.click();
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    return Boolean(document.querySelector('[data-component="NoodleView.MobileDrawer"]'));
  });
  expect(retainedDuringCollapse).toBe(true);
  await expect(drawer).toHaveCount(0);

  await noodle.getByRole("button", { name: "Open Noodle account menu" }).click();
  await expect(accountMenu).toBeVisible();
  await accountMenu.getByRole("button", { name: "Post", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  const composer = page.getByRole("heading", { name: "New post" });
  await expect(composer).toBeVisible();
  await page.getByRole("button", { name: "Close New post" }).click();

  await noodle.getByRole("button", { name: "Open Noodle account menu" }).click();
  await accountMenu.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(noodle.getByRole("heading", { name: "Noodle settings" })).toBeVisible();
  const promptSetting = noodle.locator('[data-component="NoodleView.PromptSetting"]');
  await expect(promptSetting).toBeVisible();
  const editPromptButton = promptSetting.getByRole("button", { name: "Edit prompt" });
  await expect(editPromptButton).toHaveCSS("justify-content", "center");
  await expect(editPromptButton.locator("svg")).toBeVisible();
  await expect(editPromptButton.locator("svg")).toHaveCSS("color", "rgb(126, 167, 255)");
  await editPromptButton.click();
  const promptEditor = page.locator('[data-component="ExpandedTextarea"]');
  await expect(promptEditor.getByRole("heading", { name: "Edit Noodle Prompt" })).toBeVisible();
  await promptEditor.getByRole("button", { name: "Cancel" }).first().click();
  await expect(promptEditor).toBeHidden();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  await noodle.getByRole("button", { name: "Open Noodle account menu" }).click();
  await accountMenu.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(drawer).toHaveCount(0);

  const timelineScroller = noodle.locator("main");
  await timelineScroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  expect(await timelineScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await bottomNav.getByRole("button", { name: "Noodle home" }).click();
  await expect(header).toBeVisible();
  await expect.poll(() => timelineScroller.evaluate((element) => element.scrollTop)).toBe(0);

  await noodle.getByRole("button", { name: "Open Noodle account menu" }).click();
  await accountMenu.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(noodle.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  await bottomNav.getByRole("button", { name: "Search Noodle" }).click();
  const searchInput = noodle.getByRole("searchbox", { name: "Search Noodle" });
  await expect(searchInput).toBeVisible();
  await expect(noodle.getByRole("heading", { name: "Who to follow" })).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  await bottomNav.getByRole("button", { name: "Search Noodle" }).click();
  await searchInput.fill("Professor");
  await expect(noodle.getByRole("heading", { name: "Search results" })).toBeVisible();
  await bottomNav.getByRole("button", { name: "Noodle home" }).click();
  await expect(header).toBeVisible();
  await bottomNav.getByRole("button", { name: "Search Noodle" }).click();
  await expect(searchInput).toHaveValue("");

  await bottomNav.getByRole("button", { name: "Noodle notifications" }).click();
  await expect(noodle.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  expect(errors).toEqual([]);
});

test("chat mode tabs and new-chat actions stay reachable", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto("/");

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(page.locator('[data-component="ChatSidebar"]')).toBeVisible();

  const modes = [
    { tour: "chat-mode-conversation", label: "New Conversation" },
    { tour: "chat-mode-roleplay", label: "New Roleplay" },
    { tour: "chat-mode-game", label: "New Game" },
  ];

  for (const mode of modes) {
    await page.locator(`[data-tour="${mode.tour}"]`).click();
    await expect(page.getByLabel(mode.label)).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test("Roleplay reduced paint effects preserve semantic and custom styling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Reduced Roleplay paint styling is covered on desktop.");

  const characterResponse = await page.request.post("/api/characters", {
    data: {
      data: {
        name: "Reduced Paint Tint",
        extensions: { boxColor: "#123456" },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Reduced Roleplay Paint Smoke", mode: "roleplay", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const userMessageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "user",
        content: "The default bubble should become transparent.",
      },
    });
    expect(userMessageResponse.ok()).toBeTruthy();
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: character.id,
        content: "A semantic ring must survive the lighter paint profile.",
        extra: { isConversationStart: true },
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    const surface = page.locator('[data-chat-mode="roleplay"]');
    const bubble = page.locator('[data-message-role="assistant"] .mari-rp-bubble').first();
    const defaultBubble = page.locator('[data-message-role="user"] .mari-rp-bubble').first();
    await expect(surface).not.toHaveClass(/mari-rp-reduced-paint/);
    await expect(bubble).toBeVisible();
    await expect(page.locator(".rpg-vignette")).not.toHaveCSS("display", "none");

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Appearance" }).click();
    const reducedPaintToggle = page.getByLabel("Reduced paint effects");
    await reducedPaintToggle.scrollIntoViewIfNeeded();
    await page.getByText("Reduced paint effects", { exact: true }).click();
    await expect(reducedPaintToggle).toBeChecked();

    await expect(surface).toHaveClass(/mari-rp-reduced-paint/);
    const reducedStyles = await bubble.evaluate((element) => {
      const bubbleStyle = getComputedStyle(element);
      const overlayStyle = getComputedStyle(document.querySelector(".rpg-overlay")!);
      const vignetteStyle = getComputedStyle(document.querySelector(".rpg-vignette")!);
      return {
        backgroundImage: bubbleStyle.backgroundImage,
        boxShadow: bubbleStyle.boxShadow,
        dropShadow: bubbleStyle.getPropertyValue("--tw-shadow").trim(),
        overlayBackgroundImage: overlayStyle.backgroundImage,
        overlayBackgroundColor: overlayStyle.backgroundColor,
        vignetteDisplay: vignetteStyle.display,
      };
    });
    expect(reducedStyles.backgroundImage).toContain("linear-gradient");
    expect(reducedStyles.dropShadow).toBe("0 0 #0000");
    expect(reducedStyles.boxShadow).not.toBe("none");
    expect(reducedStyles.overlayBackgroundImage).toBe("none");
    expect(reducedStyles.overlayBackgroundColor).toBe("rgba(8, 8, 18, 0.5)");
    expect(reducedStyles.vignetteDisplay).toBe("none");

    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "reduced-paint-card-css-smoke";
      style.textContent = ".mari-card-css .mari-message-bubble { background: rgb(1, 2, 3); }";
      document.head.append(style);
    });
    await expect(bubble).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(bubble).toHaveCSS("background-image", "none");
    await page.evaluate(() => document.getElementById("reduced-paint-card-css-smoke")?.remove());

    const opacitySlider = page.getByLabel("Roleplay Messages Background Opacity");
    await opacitySlider.focus();
    for (let step = 0; step < 18; step += 1) await opacitySlider.press("ArrowLeft");
    await expect(opacitySlider).toHaveValue("0");
    await expect(defaultBubble).toHaveAttribute("data-roleplay-bubble-transparent", "true");
    await expect(defaultBubble).toHaveCSS("background-image", "none");
    await expect(defaultBubble).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(bubble).not.toHaveAttribute("data-roleplay-bubble-transparent", "true");
    expect(await bubble.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("rgb(18, 52, 86)");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
            state?: { roleplayReducedPaintEffects?: unknown; chatFontOpacity?: unknown };
          };
          return [persisted.state?.roleplayReducedPaintEffects, persisted.state?.chatFontOpacity];
        }),
      )
      .toEqual([true, 0]);

    await page.reload();
    await expect(surface).toHaveClass(/mari-rp-reduced-paint/);
    await expect(defaultBubble).toHaveAttribute("data-roleplay-bubble-transparent", "true");
    await expect(bubble).not.toHaveAttribute("data-roleplay-bubble-transparent", "true");
    await expect(bubble).not.toHaveCSS("box-shadow", "none");
  } finally {
    await Promise.all([
      page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      page.request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("memory recall modal accepts clicks from chat settings", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Memory recall modal regression is covered on desktop.");

  const response = await page.request.post("/api/chats", {
    data: {
      name: "Memory Recall Menu Smoke",
      mode: "conversation",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };

  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);
  await page.goto("/");

  await page.getByRole("button", { name: "Chat Settings" }).click();
  const drawer = page.locator(".mari-chat-settings-drawer");
  await expect(drawer.getByRole("heading", { name: "Chat Settings" })).toBeVisible();
  await drawer.getByText("Memory Recall", { exact: true }).click();
  await drawer.getByRole("button", { name: "Access memories for this chat" }).click();

  const dialog = page.getByRole("dialog", { name: "Memories for This Chat" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("0 memory chunks").click();
  await expect(dialog).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Chat Settings" })).toBeVisible();
});

test("mobile topbar remains reachable while sidebars switch", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile shell smoke only runs in the mobile project.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.locator('[data-component="ChatSidebar"]')).toBeVisible();
  const mobileChatSidebar = page.locator('[data-component="ChatSidebarPanel"]');
  const openMobileSidebarX = (await mobileChatSidebar.boundingBox())?.x ?? 0;
  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(mobileChatSidebar).toHaveClass(/mari-shell-panel-exit-left/);
  expect((await mobileChatSidebar.boundingBox())?.width ?? 0).toBeGreaterThan(
    (await page.evaluate(() => innerWidth)) * 0.9,
  );
  await page.waitForTimeout(70);
  expect((await mobileChatSidebar.boundingBox())?.x ?? 0).toBeLessThan(openMobileSidebarX - 8);
  await expect(mobileChatSidebar).toHaveAttribute("aria-hidden", "true");

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(page.locator('[data-component="ChatSidebar"]')).toBeVisible();

  await page.locator('[data-tour="panel-characters"]').click();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();

  await page.locator('[data-tour="panel-settings"]').click();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();

  expect(errors).toEqual([]);
});

test("mobile Game keeps CYOA usable above four HUD widgets", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The Game viewport-pressure regression is mobile-only.");

  const errors = collectUnexpectedErrors(page);
  await expect.poll(async () => (await request.get("/api/health")).ok()).toBe(true);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Mobile Game CYOA Viewport Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  const hudWidgets = [
    {
      id: "widget-floor",
      type: "counter",
      label: "Dungeon Floor",
      icon: "🗼",
      position: "hud_left",
      accent: "#9B6CFF",
      config: { count: 1 },
    },
    {
      id: "widget-exp",
      type: "progress_bar",
      label: "EXP to Next Level",
      icon: "✨",
      position: "hud_left",
      accent: "#4FD6FF",
      config: { value: 20, max: 100 },
    },
    {
      id: "widget-bonds",
      type: "stat_block",
      label: "Party Bonds",
      icon: "💞",
      position: "hud_right",
      accent: "#FF69B4",
      config: { stats: [{ name: "Ally", value: 40 }] },
    },
    {
      id: "widget-pressure",
      type: "gauge",
      label: "Curse Pressure",
      icon: "💜",
      position: "hud_right",
      accent: "#C43DFF",
      config: { value: 10, max: 100 },
    },
  ];

  try {
    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: "mobile-cyoa-viewport-smoke",
        gameSessionStatus: "active",
        gameSessionNumber: 1,
        gameIntroPresented: true,
        gameActiveState: "dialogue",
        enableAgents: false,
        activeAgentIds: [],
        enableCustomWidgets: true,
        gameBlueprint: {
          campaignPlan: {},
          hudWidgets,
          introSequence: [],
          visualTheme: {},
        },
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();

    const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content:
          'The party reaches a fork in the flooded vault.\n\n[choices: "Take the surveyed stairs through the glowing nests"|"Risk the faster waterway before the chamber floods"|"Follow the unstable violet route into the unknown"]',
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.route("**/api/game-assets/manifest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
      });
    });
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            gameTextSpeed: 100,
          },
          version: 65,
        }),
      );
    }, chat.id);

    await page.goto("/");
    const choiceStage = page.locator('[data-component="GameSurface.MobileChoiceStage"]');
    const choiceStack = page.locator('[data-component="GameSurface.MobileChoiceStack"]');
    const leftWidgetRail = page.locator('[data-component="GameSurface.MobileWidgetRailLeft"]');
    const rightWidgetRail = page.locator('[data-component="GameSurface.MobileWidgetRailRight"]');
    const narrationPanel = page.locator('[data-component="GameNarration.ActivePanel"]');
    const composer = page.getByPlaceholder("What do you do?");
    const optionList = page.locator('[data-component="GameChoiceCards.Options"]');
    const options = page.locator('[data-component="GameChoiceCards.Options"] > button');
    await expect(choiceStage).toBeVisible();
    await expect(choiceStack).toBeVisible();
    await expect(leftWidgetRail).toBeVisible();
    await expect(rightWidgetRail).toBeVisible();
    await expect(composer).toBeVisible();
    await expect(options).toHaveCount(3);

    const viewport = { width: 390, height: 700 };
    await page.setViewportSize(viewport);
    await expect(page.getByTitle("Game actions")).toBeVisible();
    await expect(page.locator('[data-tour="game-map"]').getByRole("button", { name: "Open map" })).toBeVisible();

    await expect
      .poll(async () => {
        const stageRect = await choiceStage.boundingBox();
        const choiceRect = await choiceStack.boundingBox();
        const leftWidgetRect = await leftWidgetRail.boundingBox();
        const rightWidgetRect = await rightWidgetRail.boundingBox();
        const narrationRect = await narrationPanel.boundingBox();
        const composerRect = await composer.boundingBox();
        if (!stageRect || !choiceRect || !leftWidgetRect || !rightWidgetRect || !narrationRect || !composerRect) {
          return null;
        }
        return {
          choiceFillsCenter: choiceRect.height >= stageRect.height - 1,
          choiceBetweenWidgets:
            leftWidgetRect.x + leftWidgetRect.width <= choiceRect.x + 1 &&
            choiceRect.x + choiceRect.width <= rightWidgetRect.x + 1,
          widgetsShareChoiceBand:
            leftWidgetRect.y >= stageRect.y - 1 &&
            leftWidgetRect.y + leftWidgetRect.height <= stageRect.y + stageRect.height + 1 &&
            rightWidgetRect.y >= stageRect.y - 1 &&
            rightWidgetRect.y + rightWidgetRect.height <= stageRect.y + stageRect.height + 1,
          choiceStageBeforeNarration: stageRect.y + stageRect.height <= narrationRect.y + 1,
          narrationStartsInViewport: narrationRect.y >= 0 && narrationRect.y < viewport.height,
          composerFullyInViewport: composerRect.y >= 0 && composerRect.y + composerRect.height <= viewport.height + 1,
        };
      })
      .toEqual({
        choiceFillsCenter: true,
        choiceBetweenWidgets: true,
        widgetsShareChoiceBand: true,
        choiceStageBeforeNarration: true,
        narrationStartsInViewport: true,
        composerFullyInViewport: true,
      });

    await optionList.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(page.getByText("Choose your action", { exact: true })).toBeVisible();
    await expect(options.last()).toBeVisible();
    const optionListRect = await optionList.boundingBox();
    const lastOptionRect = await options.last().boundingBox();
    expect(optionListRect).not.toBeNull();
    expect(lastOptionRect).not.toBeNull();
    expect(lastOptionRect!.y).toBeGreaterThanOrEqual(optionListRect!.y - 1);
    expect(lastOptionRect!.y + lastOptionRect!.height).toBeLessThanOrEqual(
      optionListRect!.y + optionListRect!.height + 1,
    );
    await expect(page.getByText("The party reaches a fork in the flooded vault.", { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("Roleplay displays a selected background when its file route is GET-only", async ({ page }) => {
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Roleplay Background Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const backgroundUrl = "/api/backgrounds/file/rp-background-smoke.png";
  const requestedMethods: string[] = [];

  try {
    await page.route("**/api/backgrounds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "user:rp-background-smoke.png",
            filename: "rp-background-smoke.png",
            url: backgroundUrl,
            originalName: "Roleplay background smoke",
            tags: [],
            source: "user",
            createdAt: "2026-07-16T00:00:00.000Z",
            folderId: null,
          },
        ]),
      });
    });
    await page.route(`**${backgroundUrl}`, async (route) => {
      requestedMethods.push(route.request().method());
      if (route.request().method() !== "GET") {
        await route.fulfill({ status: 405, body: "" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" preserveAspectRatio="none"><path fill="#8f365f" d="M0 0h800v900H0z"/><path fill="#36548f" d="M800 0h800v900H800z"/></svg>',
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();
    await page.locator(`img[src="${backgroundUrl}"]`).locator("..").click();

    await expect
      .poll(async () =>
        page
          .locator(".mari-background")
          .evaluateAll(
            (layers, expectedUrl) =>
              layers.some(
                (layer) =>
                  (layer as HTMLImageElement).getAttribute("src")?.includes(expectedUrl) &&
                  (layer as HTMLElement).style.opacity === "1",
              ),
            backgroundUrl,
          ),
      )
      .toBe(true);

    const roleplaySurface = page.locator('[data-chat-mode="roleplay"]');
    const activeBackground = page.locator(`img.mari-background[src="${backgroundUrl}"]`);
    await expect(activeBackground).toHaveCSS("object-fit", "fill");
    const expectBackgroundToFitRoleplaySurface = async () => {
      await expect
        .poll(async () => {
          const [surfaceBox, backgroundBox] = await Promise.all([
            roleplaySurface.boundingBox(),
            activeBackground.boundingBox(),
          ]);
          if (!surfaceBox || !backgroundBox) return null;
          return {
            width: Math.round(backgroundBox.width - surfaceBox.width),
            height: Math.round(backgroundBox.height - surfaceBox.height),
          };
        })
        .toEqual({ width: 0, height: 0 });
    };

    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="panel-settings"]').click();
    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="panel-settings"]').click();
    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expectBackgroundToFitRoleplaySurface();
    expect(requestedMethods).toContain("GET");
    expect(requestedMethods).not.toContain("HEAD");
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Background library organization works with desktop drag and touch drag", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  const originalFilename = `background-folder-${suffix}.gif`;
  const uploadResponse = await page.request.post("/api/backgrounds/upload", {
    multipart: {
      file: {
        name: originalFilename,
        mimeType: "image/gif",
        buffer: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
      },
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as { filename: string; url: string };
  const backgroundId = `user:${uploaded.filename}`;
  let folderId: string | null = null;

  try {
    const tagResponse = await page.request.patch(`/api/backgrounds/${encodeURIComponent(uploaded.filename)}/tags`, {
      data: { tags: ["smoke-folder"] },
    });
    expect(tagResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Appearance" }).click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();

    await expect(
      page.getByText("Drag and drop backgrounds to folders, double-click or double-tap to rename."),
    ).toBeVisible();
    const sortSelect = page.getByLabel("Sort backgrounds");
    await expect(sortSelect.locator("option")).toHaveText(["A-Z", "Z-A", "Newest", "Oldest"]);
    await page.getByRole("button", { name: /Tags \(/ }).click();
    await page.getByRole("button", { name: "smoke-folder", exact: true }).click();

    const backgroundRow = page.locator(`[data-background-id="${backgroundId}"]`);
    await expect(backgroundRow).toBeVisible();
    const defaultToggle = backgroundRow.locator("[data-background-default-toggle]");
    await defaultToggle.scrollIntoViewIfNeeded();
    const starBefore = await defaultToggle.boundingBox();
    await defaultToggle.click();
    await expect(defaultToggle).toHaveAttribute("aria-pressed", "true");
    const starAfter = await defaultToggle.boundingBox();
    expect(Math.abs((starAfter?.x ?? 0) - (starBefore?.x ?? 0))).toBeLessThan(1);
    expect(Math.abs((starAfter?.y ?? 0) - (starBefore?.y ?? 0))).toBeLessThan(1);
    await defaultToggle.click();

    const [createFolderResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && new URL(response.url()).pathname === "/api/backgrounds/folders",
      ),
      page.getByRole("button", { name: "New Folder" }).click(),
    ]);
    expect(createFolderResponse.ok()).toBeTruthy();
    const createdFolder = (await createFolderResponse.json()) as { id: string; name: string };
    folderId = createdFolder.id;

    const folder = page.locator(`[data-background-folder-id="${folderId}"]`);
    await expect(folder).toBeVisible();
    if (testInfo.project.name.includes("mobile")) {
      await page.evaluate(
        ({ sourceId, targetFolderId }) => {
          const source = document.querySelector<HTMLElement>(`[data-background-id="${sourceId}"]`);
          const handle = source?.querySelector<HTMLElement>("button[title^='Drag']");
          const target = document.querySelector<HTMLElement>(`[data-background-folder-id="${targetFolderId}"]`);
          if (!source || !handle || !target) throw new Error("Background touch drag fixtures were not rendered");
          const startRect = handle.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const start = new Touch({
            identifier: 1,
            target: handle,
            clientX: startRect.left + startRect.width / 2,
            clientY: startRect.top + startRect.height / 2,
          });
          const end = new Touch({
            identifier: 1,
            target: handle,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + Math.min(targetRect.height / 2, 20),
          });
          handle.dispatchEvent(
            new TouchEvent("touchstart", {
              bubbles: true,
              cancelable: true,
              touches: [start],
              changedTouches: [start],
            }),
          );
          window.dispatchEvent(
            new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [end], changedTouches: [end] }),
          );
          window.dispatchEvent(
            new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [end] }),
          );
        },
        { sourceId: backgroundId, targetFolderId: folderId! },
      );
    } else {
      await backgroundRow.dragTo(folder);
    }

    await expect
      .poll(async () => {
        const response = await page.request.get("/api/backgrounds");
        const backgrounds = (await response.json()) as Array<{ id: string; folderId: string | null }>;
        return backgrounds.find((background) => background.id === backgroundId)?.folderId ?? null;
      })
      .toBe(folderId);

    const folderHeader = folder.getByRole("button", { name: /folder .*Double-tap or press F2 to rename/i });
    await folderHeader.dblclick();
    const folderNameInput = folder.locator("input");
    await expect(folderNameInput).toBeVisible();
    await folderNameInput.fill(`Scenes ${suffix}`);
    await folderNameInput.press("Enter");
    await expect(folder.getByText(`Scenes ${suffix}`, { exact: true })).toBeVisible();
  } finally {
    if (folderId) await page.request.delete(`/api/backgrounds/folders/${encodeURIComponent(folderId)}`);
    await page.request.delete(`/api/backgrounds/${encodeURIComponent(uploaded.filename)}`);
  }
});
