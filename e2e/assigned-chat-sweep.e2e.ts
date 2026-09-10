import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

test.use({ actionTimeout: 10000 });

const readMetadata = (chat: any) => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata);
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
async function fixture(request: APIRequestContext, mode: "conversation" | "roleplay" | "game") {
  const character = await (
    await request.post("/api/characters", { data: { data: { name: "Dottore", first_mes: "" } } })
  ).json();
  const chat = await (
    await request.post("/api/chats", { data: { name: "The experiment", mode, characterIds: [character.id] } })
  ).json();
  const message = await (
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: character.id,
        content: "A quiet laboratory. Keep this selected phrase in mind.",
      },
    })
  ).json();
  return {
    chat,
    character,
    message,
    cleanup: async () => {
      await request.delete(`/api/chats/${chat.id}`);
      await request.delete(`/api/characters/${character.id}`);
    },
  };
}
async function open(page: Page, chatId: string, state = {}, waitForComposer = true) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      appAccentPulseMode: false,
      showQuickReplyPostOnly: true,
      showQuickRepliesMenu: true,
      ...state,
    },
    "if-missing",
  );
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
  if (waitForComposer) await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
}
for (const [mode, style] of [
  ["conversation", "classic"],
  ["conversation", "bubble"],
] as const) {
  test(`${mode} ${style}: reply selection, cancellation, post-only persistence and compact actions`, async ({
    page,
    request,
    isMobile,
  }, info) => {
    const data = await fixture(request, mode);
    try {
      await open(page, data.chat.id, { conversationMessageStyle: style });
      const row = page.locator(`[data-message-id="${data.message.id}"]`).first();
      if (isMobile) await row.getByText(/A quiet laboratory/).click();
      else await row.hover();
      const reply = row.getByRole("button", { name: "Reply", exact: true });
      if (mode === "conversation" && !isMobile) {
        await page.mouse.move(0, 0);
        await row.focus();
        for (let step = 0; step < 8; step++) {
          await page.keyboard.press("Tab");
          if (await reply.evaluate((button) => button === document.activeElement)) break;
        }
        await expect(reply).toBeFocused();
      }
      await reply.click();
      await expect(page.locator("[data-message-reply]")).toContainText("A quiet laboratory");
      await page.getByRole("button", { name: "Cancel reply", exact: true }).click();
      await expect(page.locator("[data-message-reply]")).toHaveCount(0);
      for (const fromElement of [true, false]) {
        if (!isMobile) await row.hover();
        await row.evaluate((element, fromElement) => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const text = walker.currentNode.textContent ?? "";
            const index = text.indexOf("selected phrase");
            if (index < 0) continue;
            const range = document.createRange();
            range.setStart(fromElement ? element : walker.currentNode, fromElement ? 0 : index);
            range.setEnd(walker.currentNode, index + "selected phrase".length);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            break;
          }
        }, fromElement);
        await reply.click();
        await expect(page.locator("[data-message-reply]")).toContainText("selected phrase");
        await expect(page.locator("[data-message-reply]")).not.toContainText("in mind");
        if (fromElement) await page.getByRole("button", { name: "Cancel reply", exact: true }).click();
        else await expect(page.locator("[data-message-reply]")).not.toContainText("A quiet laboratory");
      }
      await page.locator("textarea[data-chat-composer]").fill("I remember.");
      if (isMobile && mode === "conversation") {
        await page.getByRole("button", { name: "Emoji, GIFs, stickers & tools", exact: true }).click();
        await page.getByRole("button", { name: "Tools", exact: true }).click();
      }
      const quick = page.getByRole("button", { name: "Quick replies", exact: true });
      if (await quick.isVisible()) {
        await quick.click();
        await page.getByRole("menuitem", { name: /Post only/ }).click();
      } else await page.getByRole("button", { name: /^Post only/ }).click();
      await expect(page.getByRole("button", { name: "Cancel reply", exact: true })).toHaveCount(0);
      await expect
        .poll(async () => {
          const messages = await (await request.get(`/api/chats/${data.chat.id}/messages`)).json();
          return messages.find((item: any) => item.role === "user")?.content;
        })
        .toBe("I remember.");
      await page.reload();
      const quote = page.locator("[data-message-reply]");
      await expect(quote).toContainText("selected phrase");
      await expect(quote).toContainText("Dottore");
      await row.hover();
      if (!isMobile) {
        await expect(row.locator(".mari-message-actions")).toHaveCSS("opacity", "1");
        const positions = await row.locator(".mari-message-actions > button").evaluateAll((buttons) =>
          buttons.slice(0, 3).map((button) => {
            const b = button.getBoundingClientRect();
            return { x: b.x, width: b.width };
          }),
        );
        expect(positions.length).toBeGreaterThan(1);
        expect(positions[1]!.x - positions[0]!.x).toBeLessThan(positions[0]!.width + 25);
      }
      await page.screenshot({ path: info.outputPath(`${mode}-${style}-reply.png`), fullPage: true });
      await info.attach("Reply preview and action spacing", {
        path: info.outputPath(`${mode}-${style}-reply.png`),
        contentType: "image/png",
      });
    } finally {
      await data.cleanup();
    }
  });
}

test("Roleplay omits Reply from message actions and keeps the restored DM control in Connected Chats", async ({
  page,
  request,
  isMobile,
}) => {
  const data = await fixture(request, "roleplay");
  try {
    await open(page, data.chat.id);
    const row = page.locator(`[data-message-id="${data.message.id}"]`).first();
    if (isMobile) await row.getByText(/A quiet laboratory/).click();
    else await row.hover();
    await expect(row.getByRole("button", { name: "Reply", exact: true })).toHaveCount(0);
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const connected = page.locator('[data-chat-settings-section="roleplay-connected-chats"]');
    const header = connected.locator('[role="button"][aria-expanded]').first();
    if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
    const toggle = connected.getByRole("checkbox", { name: /^Allow character DMs/ });
    const label = connected.locator(`label[for="${await toggle.getAttribute("id")}"]`).first();
    await expect(toggle).not.toBeChecked();
    await label.click();
    await expect(toggle).toBeChecked();
    await expect
      .poll(
        async () =>
          readMetadata(await (await request.get(`/api/chats/${data.chat.id}`)).json()).roleplayCommandToggles.dm,
      )
      .toBe(true);
    await label.click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(
        async () =>
          readMetadata(await (await request.get(`/api/chats/${data.chat.id}`)).json()).roleplayCommandToggles.dm,
      )
      .toBe(false);
    expect(readMetadata(await (await request.get(`/api/chats/${data.chat.id}`)).json()).roleplayCommandsEnabled).toBe(
      true,
    );
  } finally {
    await data.cleanup();
  }
});

test("Roleplay streaming applies matching regex immediately and keeps incomplete fragments", async ({
  page,
  request,
}) => {
  const data = await fixture(request, "roleplay");
  const regex = await (
    await request.post("/api/regex-scripts", {
      data: {
        name: "Streaming cleanup",
        findRegex: "\\[secret:[^\\]]*\\]",
        replaceString: "",
        placement: ["ai_output"],
        targetCharacterIds: [data.character.id],
      },
    })
  ).json();
  try {
    await request.patch(`/api/chats/${data.chat.id}/metadata`, { data: { scopedRegexMode: "exclusive" } });
    await open(page, data.chat.id);
    const stream = async (text: string) =>
      page.evaluate(
        async ({ text, chatId, characterId }) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          const store = useChatStore.getState();
          store.setStreamingCharacterId(characterId);
          store.setStreamBuffer(text, chatId);
          store.setStreaming(true, chatId);
        },
        { text, chatId: data.chat.id, characterId: data.character.id },
      );
    const row = page.locator('[data-message-id="__streaming__"]');
    await stream("Visible [secret:partial");
    await expect(row).toContainText("[secret:partial");
    await stream("Visible [secret:partial] remains.");
    await expect(row).toContainText("Visible");
    await expect(row).toContainText("remains.");
    await expect(row).not.toContainText("secret:");
  } finally {
    await request.delete(`/api/regex-scripts/${regex.id}`);
    await data.cleanup();
  }
});

test("4K maximum display and chat font keep the composer and scrolling usable", async ({
  page,
  request,
  isMobile,
}, info) => {
  test.skip(isMobile, "4K desktop viewport proof");
  const data = await fixture(request, "roleplay");
  try {
    await page.setViewportSize({ width: 3840, height: 2160 });
    for (let i = 0; i < 16; i++)
      await request.post(`/api/chats/${data.chat.id}/messages`, {
        data: {
          role: i % 2 ? "assistant" : "user",
          characterId: i % 2 ? data.character.id : null,
          content: `Experiment ${i}. A longer message keeps the transcript scrollable at large text sizes.`,
        },
      });
    await open(page, data.chat.id, { fontSize: 34, chatFontSize: 72 });
    await expect.poll(() => page.locator("html").evaluate((el) => getComputedStyle(el).fontSize)).toBe("34px");
    const input = page.locator("textarea[data-chat-composer]");
    await input.fill("Still within reach.");
    await expect(input).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const scrollable = page.locator("[data-message-id]").last();
    await scrollable.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    await page.screenshot({ path: info.outputPath("4k-maximum-size.png") });
    await info.attach("4K maximum sizes", { path: info.outputPath("4k-maximum-size.png"), contentType: "image/png" });
  } finally {
    await data.cleanup();
  }
});

test("Game setup offers library cards in both the GM and party pickers", async ({ page, request }, info) => {
  const data = await fixture(request, "game");
  try {
    // A new game deliberately starts with no active party.
    expect((await request.patch(`/api/chats/${data.chat.id}`, { data: { characterIds: [] } })).ok()).toBeTruthy();
    await open(page, data.chat.id, {}, false);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: /Character GM/ }).click();
    const choices = page.getByRole("button", { name: /Dottore$/ });
    await expect(choices).toHaveCount(2);
    await choices.last().click();
    await expect(page.getByText("Party Members (1 selected)", { exact: true })).toBeVisible();
    await choices.first().click();
    await expect(page.getByText("No characters found.", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("game-library-pickers.png") });
  } finally {
    await data.cleanup();
  }
});

test("Character-sheet resolution migrates once and remains independent after a saved edit", async ({
  page,
  request,
}, info) => {
  const data = await fixture(request, "conversation");
  try {
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          {
            id: "illustrator",
            version: "1.0.0",
            status: "active",
            readiness: "ready",
            manifest: {
              schemaVersion: 1,
              id: "illustrator",
              name: "Illustrator",
              version: "1.0.0",
              engine: { min: "2.0.0", maxExclusive: "3.0.0" },
              kind: ["agent"],
              entrypoints: { agents: "agents.json" },
              permissions: ["agent-runtime"],
              files: [],
            },
          },
        ],
      }),
    );
    await open(page, data.chat.id, { imageBackgroundWidth: 1536, imageBackgroundHeight: 1024 });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("sheet-migration-seeded")) return;
      const old = JSON.parse(localStorage.getItem("marinara-engine-ui")!);
      old.version = 99;
      delete old.state.imageCharacterSheetWidth;
      delete old.state.imageCharacterSheetHeight;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(old));
      sessionStorage.setItem("sheet-migration-seeded", "true");
    });
    await page.reload();
    const openImageSettings = async () =>
      page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        const ui = useUIStore.getState();
        ui.openRightPanel("settings");
        ui.setSettingsTab("generations");
        ui.setSettingsTargetControlId("image-character-sheet-size");
      });
    await openImageSettings();
    const sheets = page.locator("#settings-control-image-character-sheet-size input");
    await expect(sheets.nth(0)).toHaveValue("1536");
    await expect(sheets.nth(1)).toHaveValue("1024");
    await sheets.nth(0).fill("768");
    await sheets.nth(1).fill("1152");
    await sheets.nth(1).blur();
    const backgrounds = page.locator("#settings-control-image-background-size input");
    await expect(backgrounds.nth(0)).toHaveValue("1536");
    await expect(backgrounds.nth(1)).toHaveValue("1024");
    await backgrounds.nth(0).fill("2048");
    await backgrounds.nth(0).blur();
    await page.reload();
    await openImageSettings();
    await expect(sheets.nth(0)).toHaveValue("768");
    await expect(sheets.nth(1)).toHaveValue("1152");
    await expect(backgrounds.nth(0)).toHaveValue("2048");
    await sheets.nth(0).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("independent-character-sheet-size.png") });
    const saved = await page.evaluate(async () => {
      const { pickSyncedSettings, useUIStore } = await import("/src/stores/ui.store.ts" as string);
      const state = pickSyncedSettings(useUIStore.getState());
      return [state.imageCharacterSheetWidth, state.imageCharacterSheetHeight, state.imageBackgroundWidth];
    });
    expect(saved).toEqual([768, 1152, 2048]);
  } finally {
    await data.cleanup();
  }
});

test("Conversation Help explains the Reply action", async ({ page, request, isMobile }) => {
  const data = await fixture(request, "conversation");
  try {
    await open(page, data.chat.id);
    await page.evaluate(async () => {
      const { requestChatHelp } = await import("/src/lib/chat-help-events.ts" as string);
      requestChatHelp("conversation");
    });
    const messagesHelp = page.getByRole("button", { name: /^Messages: Read the chat/ });
    if (isMobile) await messagesHelp.click();
    else await messagesHelp.hover();
    await expect(page.getByText("Reply to this message or a selected passage.", { exact: true })).toBeVisible();
  } finally {
    await data.cleanup();
  }
});
