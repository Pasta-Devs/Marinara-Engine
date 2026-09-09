import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

test.use({ actionTimeout: 10000 });

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
async function fixture(request: APIRequestContext, mode: "conversation" | "roleplay") {
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
async function open(page: Page, chatId: string, state = {}) {
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
  await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
}
for (const [mode, style] of [
  ["roleplay", "classic"],
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
