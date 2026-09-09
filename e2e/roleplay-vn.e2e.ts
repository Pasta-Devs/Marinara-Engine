import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const readMetadata = (chat: any) => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata);

async function fixture(request: APIRequestContext, art = false) {
  const paths: string[] = [];
  const create = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const value = await response.json();
    paths.unshift(`${path}/${value.id}`);
    return value;
  };
  const cleanup = async () => {
    for (const path of paths) {
      const response = await request.delete(path);
      // The empty-chat case already deletes its message before teardown.
      expect(response.ok() || response.status() === 404, `Cleanup ${path}: HTTP ${response.status()}`).toBeTruthy();
    }
  };
  try {
    const character = await create("/api/characters", { data: { name: "Mari", first_mes: "" } });
    if (art) {
      const image = readFileSync(
        new URL("../packages/client/public/sprites/mari/Mari_wave.png", import.meta.url),
      ).toString("base64");
      expect(
        (
          await request.post(`/api/characters/${character.id}/avatar`, {
            data: {
              avatar: readFileSync(
                new URL("../packages/client/public/sprites/mari/Mari_profile.png", import.meta.url),
              ).toString("base64"),
              filename: "mari.png",
            },
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.post(`/api/sprites/${character.id}`, {
            data: { expression: "full_neutral", image: `data:image/png;base64,${image}` },
          })
        ).ok(),
      ).toBeTruthy();
    }
    const chat = await create("/api/chats", {
      name: "Visual Novel proof",
      mode: "roleplay",
      characterIds: [character.id],
    });
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            roleplayDisplayStyle: "visual-novel",
            enableAgents: art,
            activeAgentIds: art ? ["expression"] : [],
            spriteCharacterIds: art ? [character.id] : [],
            spriteDisplayModes: ["full-body"],
          },
        })
      ).ok(),
    ).toBeTruthy();
    const message = await create(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      characterId: character.id,
      content:
        'The archive falls quiet.\n\n"We have a new experiment," Mari says.\n\nA small light flickers across the desk.',
    });
    return {
      chat,
      character,
      message,
      cleanup,
    };
  } catch (error) {
    // A teardown failure must not replace the original setup failure.
    await cleanup().catch(() => undefined);
    throw error;
  }
}

async function open(page: Page, chatId: string, theme: "dark" | "light" = "dark") {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
      theme,
      appAccentPulseMode: false,
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
  await expect(page.locator("[data-roleplay-vn]")).toBeVisible();
}

for (const theme of ["dark", "light"] as const) {
  test(`Roleplay VN retains the composer, configured art, and editable history (${theme})`, async ({
    page,
    request,
  }, info) => {
    const data = await fixture(request, true);
    try {
      await open(page, data.chat.id, theme);
      const vn = page.locator("[data-roleplay-vn]");
      await expect(vn).toContainText("A small light flickers across the desk.");
      await expect(vn).not.toContainText("The archive falls quiet.");
      await expect(vn.getByRole("img", { name: "Mari", exact: true })).toBeVisible();
      await expect(page.locator("[data-chat-scroll] [data-message-id]")).toHaveCount(0);
      const input = page.locator(".mari-chat-input textarea");
      await expect(input).toBeVisible();
      await input.fill("An unsent response stays here.");
      await input.blur();
      await expect(page.getByRole("img", { name: /full.*sprite/i })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`vn-${theme}.png`), animations: "disabled" });
      const bubble = await vn.boundingBox();
      const composer = await input.boundingBox();
      expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(composer!.y + 1);
      expect(bubble!.x).toBeGreaterThanOrEqual(0);
      expect(bubble!.x + bubble!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      await vn.getByRole("button", { name: "Show chat history" }).click();
      const history = page.locator("[data-chat-scroll]");
      await expect(history).toBeVisible();
      const message = history.locator(`[data-message-id="${data.message.id}"]`).first();
      await expect(message).toContainText("The archive falls quiet.");
      await message.click();
      await message.getByRole("button", { name: "Edit", exact: true }).click();
      await message.locator("textarea").fill("A revised opening.\n\nThe latest paragraph is edited.");
      await vn.getByRole("button", { name: "Return to Visual Novel" }).click();
      await vn.getByRole("button", { name: "Show chat history" }).click();
      await expect(message.locator("textarea")).toHaveValue("A revised opening.\n\nThe latest paragraph is edited.");
      await message.getByRole("button", { name: "Save edit", exact: true }).click();
      await expect(message).toContainText("The latest paragraph is edited.");
      await page.screenshot({ path: info.outputPath(`history-${theme}.png`), animations: "disabled" });
      await vn.getByRole("button", { name: "Return to Visual Novel" }).click();
      await expect(vn).toContainText("The latest paragraph is edited.");
      await expect(page.locator("[data-chat-scroll] [data-message-id]")).toHaveCount(0);
      await expect(input).toHaveValue("An unsent response stays here.");
    } finally {
      await data.cleanup();
    }
  });
}

test("Roleplay VN waits for complete streaming paragraphs and discards old swipe text", async ({ page, request }) => {
  const data = await fixture(request);
  try {
    await open(page, data.chat.id);
    const paragraph = page.getByRole("region", { name: "Current paragraph" });
    await page.evaluate(
      async ({ chatId, messageId, characterId }) => {
        const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
        const store = useChatStore.getState();
        store.setRegenerateMessageId(messageId);
        store.setStreamingCharacterId(characterId);
        store.setStreamBuffer("An unfinished first paragraph", chatId);
        store.setStreaming(true, chatId);
      },
      { chatId: data.chat.id, messageId: data.message.id, characterId: data.character.id },
    );
    await expect(paragraph).not.toContainText("A small light");
    await expect(paragraph).not.toContainText("An unfinished");
    for (const [text, visible] of [
      ["First complete.\n\nPartial second", "First complete."],
      ["First complete.\n\nSecond complete.\n\nPartial third", "Second complete."],
    ]) {
      await page.evaluate(
        async ({ chatId, text }) => {
          const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
          useChatStore.getState().setStreamBuffer(text!, chatId);
        },
        { chatId: data.chat.id, text },
      );
      await expect(paragraph).toHaveText(visible!);
    }
    await page.evaluate(async () => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      useChatStore.getState().setStreaming(false);
      useChatStore.getState().setRegenerateMessageId(null);
    });
    await expect(paragraph).toContainText("A small light flickers across the desk.");
    await page.evaluate(async () => {
      const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
      useUIStore.getState().setEditLastMessageOnArrowUp(true);
    });
    await page.locator(".mari-chat-input textarea").press("ArrowUp");
    await expect(page.locator("[data-chat-scroll] [data-chat-message-editor]")).toBeVisible();
  } finally {
    await data.cleanup();
  }
});

test("Roleplay wizard and Appearance persist the VN choice and art scales", async ({ page, request }, info) => {
  const data = await fixture(request);
  try {
    await open(page, data.chat.id);
    await page.evaluate(async () => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    await expect(page.getByRole("radio", { name: "Visual Novel", exact: true })).toBeChecked();
    await expect(page.getByText("Change this anytime in Settings → Appearance → Roleplay.")).toBeVisible();
    await page.getByRole("radio", { name: "Classic", exact: true }).click();
    await expect
      .poll(
        async () => readMetadata(await (await request.get(`/api/chats/${data.chat.id}`)).json()).roleplayDisplayStyle,
      )
      .toBe("classic");
    await page.screenshot({ path: info.outputPath("wizard.png"), animations: "disabled" });
    await page.reload();
    await expect(page.locator('[data-roleplay-presentation="classic"]')).toBeVisible();
    await expect(page.locator("[data-roleplay-vn]")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("classic.png"), animations: "disabled" });
    await page.evaluate(async () => {
      const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
      const ui = useUIStore.getState();
      ui.openRightPanel("settings");
      ui.setSettingsTab("appearance");
      ui.setSettingsTargetControlId("roleplay-vn-display");
    });
    const toggle = page.getByRole("checkbox", { name: "Visual Novel display", exact: true });
    await expect(toggle).not.toBeChecked();
    await page
      .locator(`label[for="${await toggle.getAttribute("id")}"]`)
      .first()
      .click();
    await expect
      .poll(
        async () => readMetadata(await (await request.get(`/api/chats/${data.chat.id}`)).json()).roleplayDisplayStyle,
      )
      .toBe("visual-novel");
    for (const [id, value] of [
      ["portrait", "1.5"],
      ["sprite", "2"],
    ]) {
      const slider = page.locator(`#settings-control-roleplay-vn-${id}-scale input`);
      await slider.focus();
      await slider.press("Home");
      for (let step = 0; step < Math.round((Number(value) - 0.75) / 0.05); step++) await slider.press("ArrowRight");
    }
    await page.screenshot({ path: info.outputPath("appearance.png"), animations: "disabled" });
    await page.reload();
    await expect(page.locator('[data-roleplay-presentation="visual-novel"]')).toBeVisible();
    expect(
      await page.evaluate(async () => {
        const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
        const state = useUIStore.getState();
        return [state.roleplayVnPortraitScale, state.roleplayVnSpriteScale];
      }),
    ).toEqual([1.5, 2]);
  } finally {
    await data.cleanup();
  }
});

test("Roleplay VN bounds long paragraphs and handles an empty chat without art", async ({ page, request }, info) => {
  const data = await fixture(request);
  try {
    const long = "A long paragraph remains readable without pushing the composer off screen. ".repeat(100);
    expect(
      (
        await request.patch(`/api/chats/${data.chat.id}/messages/${data.message.id}`, {
          data: { content: `Earlier.\n\n${long}` },
        })
      ).ok(),
    ).toBeTruthy();
    await open(page, data.chat.id);
    const paragraph = page.getByRole("region", { name: "Current paragraph" });
    await expect(paragraph).toContainText("A long paragraph remains readable");
    const bounds = await paragraph.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.31);
    expect(await paragraph.evaluate((element) => element.scrollHeight > element.clientHeight)).toBeTruthy();
    await expect(page.locator(".mari-chat-input textarea")).toBeInViewport();
    await page.screenshot({ path: info.outputPath("long-paragraph.png"), animations: "disabled" });
    await request.delete(`/api/chats/${data.chat.id}/messages/${data.message.id}`);
    await page.reload();
    await expect(page.locator("[data-roleplay-vn]")).toContainText("Send a message to begin the scene.");
    await expect(page.locator(".mari-chat-input textarea")).toBeInViewport();
  } finally {
    await data.cleanup();
  }
});

test("Roleplay VN follows the selected swipe and the next chat's display choice", async ({ page, request }) => {
  const data = await fixture(request);
  let other: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    other = await fixture(request);
    expect(
      (
        await request.post(`/api/chats/${data.chat.id}/messages/${data.message.id}/swipes`, {
          data: { content: "An alternate opening.\n\nThe alternate paragraph." },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (await request.patch(`/api/chats/${other.chat.id}/metadata`, { data: { roleplayDisplayStyle: "classic" } })).ok(),
    ).toBeTruthy();
    await open(page, data.chat.id);
    const vn = page.locator("[data-roleplay-vn]");
    await expect(vn).toContainText("The alternate paragraph.");
    await vn.getByRole("button", { name: "Show chat history" }).click();
    const message = page.locator(`[data-chat-scroll] [data-message-id="${data.message.id}"]`).first();
    await message.click();
    await message.getByRole("button", { name: "Previous swipe", exact: true }).click();
    await expect(message).toContainText("The archive falls quiet.");
    await vn.getByRole("button", { name: "Return to Visual Novel" }).click();
    await expect(vn).toContainText("A small light flickers across the desk.");
    await page.evaluate(async (chatId) => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      useChatStore.getState().setActiveChatId(chatId);
    }, other.chat.id);
    await expect(page.locator('[data-roleplay-presentation="classic"]')).toBeVisible();
    await expect(page.locator("[data-roleplay-vn]")).toHaveCount(0);
    await expect(page.locator("[data-chat-scroll]")).toContainText("The archive falls quiet.");
  } finally {
    await data.cleanup();
    await other?.cleanup();
  }
});

test("Roleplay VN shows dice and image-only messages without findLast support", async ({ page, request }, info) => {
  const data = await fixture(request);
  try {
    await page.addInitScript(() =>
      Object.defineProperty(Array.prototype, "findLast", { value: undefined, configurable: true }),
    );
    const roll = await request.post(`/api/chats/${data.chat.id}/messages`, {
      data: {
        role: "user",
        content: "/roll 1d20+3",
        extra: { diceRollResult: { notation: "1d20+3", rolls: [12], modifier: 3, total: 15 } },
      },
    });
    expect(roll.ok(), await roll.text()).toBeTruthy();
    await open(page, data.chat.id);
    const vn = page.locator("[data-roleplay-vn]");
    await expect(vn.getByLabel(/Rolled 1d20\+3/)).toBeVisible();
    await expect(vn).not.toContainText("/roll");
    const attachment = await request.post(`/api/chats/${data.chat.id}/messages`, {
      data: {
        role: "user",
        content: "",
        extra: { attachments: [{ type: "image", url: "/sprites/mari/Mari_profile.png", filename: "portrait.png" }] },
      },
    });
    expect(attachment.ok(), await attachment.text()).toBeTruthy();
    await page.reload();
    await expect(vn.getByRole("img", { name: "portrait.png", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("vn-attachment.png"), animations: "disabled" });
    await vn.getByRole("button", { name: "Open portrait.png", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Image preview", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close image", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Image preview", exact: true })).toHaveCount(0);
  } finally {
    await data.cleanup();
  }
});
