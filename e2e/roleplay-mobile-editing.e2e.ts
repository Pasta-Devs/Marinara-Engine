import { expect, test, type APIRequestContext, type CDPSession, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Phone editing checks.");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    sidebarOpen: false,
    rightPanelOpen: false,
  });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
});

/** Open a chat with a reply long enough to scroll inside its editor, the latest unless more messages follow it. */
async function withLongReply(
  page: Page,
  request: APIRequestContext,
  run: (reply: Locator) => Promise<void>,
  {
    mode = "roleplay",
    messagesAfter = 0,
    character,
  }: { mode?: "roleplay" | "conversation"; messagesAfter?: number; character?: string } = {},
) {
  const characterIds: string[] = [];
  if (character) {
    const card = await request.post("/api/characters", { data: { data: { name: character, first_mes: "" } } });
    expect(card.ok()).toBeTruthy();
    characterIds.push(((await card.json()) as { id: string }).id);
  }
  const created = await request.post("/api/chats", {
    data: { name: "Phone editing", mode, characterIds },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  try {
    let replyId = "";
    for (let index = 0; index < 4 + messagesAfter; index += 1) {
      const saved = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 ? "assistant" : "user",
          content:
            index === 3
              ? Array.from({ length: 40 }, (_, line) => `Reply line ${line + 1} of the long answer.`).join("\n")
              : `Opening line ${index + 1}. ${"The lantern light flickers over the old map. ".repeat(4)}`,
        },
      });
      expect(saved.ok()).toBeTruthy();
      if (index === 3) replyId = ((await saved.json()) as { id: string }).id;
    }
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    await page.goto("/");
    await run(page.locator(`[data-message-id="${replyId}"]`));
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
    for (const id of characterIds) await request.delete(`/api/characters/${id}`);
  }
}

async function startEditing(reply: Locator) {
  await reply.getByText(/Reply line 40 of the long answer/).tap();
  await reply.getByRole("button", { name: "Edit", exact: true }).tap();
  const editor = reply.locator("[data-chat-message-editor]");
  await expect(editor).toBeFocused();
  return editor;
}

/** Whether a touch at each fraction of the editor's width, on its first text line, lands on the editor. */
function firstLineTakesTouches(editor: Locator, fractions: number[]) {
  return editor.evaluate((element, points) => {
    const box = element.getBoundingClientRect();
    const y = box.top + 16;
    return points.map((fraction) => document.elementFromPoint(box.left + box.width * fraction, y) === element);
  }, fractions);
}

/** Scroll the transcript until the editor's first line is level with the menu button at the top of the chat. */
async function levelFirstLineWithMenu(page: Page, editor: Locator, chatSurface: string) {
  const menu = page.locator(chatSurface).getByRole("button", { name: "More options", exact: true });
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  const menuMiddle = menuBox!.y + menuBox!.height / 2;
  await editor.evaluate((element, buttonMiddle) => {
    const transcript = element.closest("[data-chat-scroll]")!;
    transcript.scrollTop += element.getBoundingClientRect().top + 16 - buttonMiddle;
  }, menuMiddle);
  await expect
    .poll(() => editor.evaluate((element, y) => Math.abs(element.getBoundingClientRect().top + 16 - y), menuMiddle))
    .toBeLessThanOrEqual(1);
}

test("a Roleplay message being edited takes touches along its first line (#6992)", async ({ page, request }) => {
  await withLongReply(page, request, async (latest) => {
    const editor = await startEditing(latest);
    // Editing starts below the floating top controls, so the whole first line can be pressed.
    await expect.poll(() => firstLineTakesTouches(editor, [0.1, 0.5, 0.95])).toEqual([true, true, true]);

    // Scrolled up level with the menu button, the line still takes touches beside it.
    await levelFirstLineWithMenu(page, editor, '[data-component="ChatArea.Roleplay"]');
    expect(await firstLineTakesTouches(editor, [0.1, 0.5])).toEqual([true, true]);
  });
});

test("a Conversation message being edited takes touches under the see-through header (#6992)", async ({
  page,
  request,
}) => {
  await withLongReply(
    page,
    request,
    async (reply) => {
      const editor = await startEditing(reply);
      // Scrolled up level with the menu button, the line takes touches beside it.
      await levelFirstLineWithMenu(page, editor, '[data-chat-mode="conversation"]');
      expect(await firstLineTakesTouches(editor, [0.1, 0.5])).toEqual([true, true]);
    },
    // Conversation keeps its editor short, so later messages give room to scroll it under the header.
    { mode: "conversation", messagesAfter: 2 },
  );
});

/** Playwright has no software keyboard, so stand in for Safari's visual viewport. Call before the page loads. */
async function standInForSafariKeyboard(page: Page) {
  await page.addInitScript(() => {
    let keyboardTop: number | null = null;
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => keyboardTop ?? window.innerHeight },
      width: { get: () => window.innerWidth },
      offsetTop: { get: () => 0 },
      pageTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageLeft: { get: () => 0 },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window, "__openKeyboard", {
      value: (top: number) => {
        keyboardTop = top;
        viewport.dispatchEvent(new Event("resize"));
      },
    });
  });
}

/** Open the keyboard: Android shrinks the page, while the Safari stand-in only shrinks its visual viewport. */
async function openKeyboard(page: Page, android: boolean) {
  if (android) await page.setViewportSize({ width: 390, height: 500 });
  else
    await page.evaluate(() => {
      const open = (window as typeof window & { __openKeyboard: (top: number) => void }).__openKeyboard;
      open(Math.round(window.innerHeight * 0.55));
    });
  await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
}

test("opening the keyboard to edit the latest Conversation reply keeps its first line below the header (#6992)", async ({
  page,
  request,
}, testInfo) => {
  const android = testInfo.project.name === "mobile-chromium";
  if (!android) await standInForSafariKeyboard(page);
  await withLongReply(
    page,
    request,
    async (latest) => {
      const editor = await startEditing(latest);
      const startTop = await editor.evaluate((element) => element.getBoundingClientRect().top);
      await openKeyboard(page, android);
      // The keyboard lines the editor up again, below the character card and More options instead of under them.
      await expect
        .poll(async () => ({
          moved: (await editor.evaluate((element) => element.getBoundingClientRect().top)) < startTop,
          touches: await firstLineTakesTouches(editor, [0.1, 0.5, 0.95]),
        }))
        .toEqual({ moved: true, touches: [true, true, true] });
    },
    { mode: "conversation", character: "Mira Lanternkeeper" },
  );
});

test("the end of a long Roleplay message and its Save button stay reachable above the iPhone keyboard (#6992)", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "Only iOS keeps the page height when its keyboard opens.");
  await standInForSafariKeyboard(page);
  await withLongReply(page, request, async (latest) => {
    const editor = await startEditing(latest);
    await openKeyboard(page, false);

    // Scrolling inside the editor brings its last line into the space above the composer.
    await editor.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const composer = page.locator('[data-component="ChatArea.Roleplay"] .chat-input-container');
    await expect
      .poll(async () => {
        const [editorBox, composerBox] = await Promise.all([editor.boundingBox(), composer.boundingBox()]);
        return editorBox && composerBox ? Math.round(composerBox.y - (editorBox.y + editorBox.height)) : null;
      })
      .toBeGreaterThanOrEqual(0);
    expect(await firstLineTakesTouches(editor, [0.5])).toEqual([true]);
    // Save stays above the composer too, so the edit can be kept without closing the keyboard.
    const save = latest.getByRole("button", { name: "Save edit", exact: true });
    expect(
      await save.evaluate((button) => {
        const box = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
      }),
    ).toBe(true);
  });
});

/** Stand in for keyboard UI around a focused field, then check the page left it alone. */
async function expectKeyboardUiLeavesFieldAlone(page: Page, cdp: CDPSession, field: Locator) {
  await expect(field).toBeFocused();
  // Android shrinks the page for its keyboard; let the app settle before watching.
  await page.setViewportSize({ width: 390, height: 500 });
  await page.waitForTimeout(400);
  const before = await field.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(3, 3);
    const target = window as typeof window & { __field?: HTMLTextAreaElement; __focusMoves?: number };
    target.__field = element;
    target.__focusMoves = 0;
    return element.value;
  });
  const state = () =>
    page.evaluate(() => {
      const { __field: element, __focusMoves: moves } = window as typeof window & {
        __field: HTMLTextAreaElement;
        __focusMoves: number;
      };
      return {
        sameField: document.activeElement === element && element.isConnected,
        caret: [element.selectionStart, element.selectionEnd],
        moves,
      };
    });

  // A keyboard menu takes the window's focus, its suggestion strip comes and goes, then focus returns.
  await page.evaluate(() => {
    const element = document.activeElement!;
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
    element.dispatchEvent(new FocusEvent("blur"));
    element.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    window.dispatchEvent(new FocusEvent("blur"));
  });
  await page.setViewportSize({ width: 390, height: 470 });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => {
    const element = document.activeElement!;
    Reflect.deleteProperty(document, "hasFocus");
    window.dispatchEvent(new FocusEvent("focus"));
    element.dispatchEvent(new FocusEvent("focus"));
    element.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  expect(await state()).toEqual({ sameField: true, caret: [3, 3], moves: 0 });
  await expect(field).toHaveValue(before);

  // Composing Japanese text stays in the same field.
  await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.imeSetComposition", { text: "にほん", selectionStart: 3, selectionEnd: 3 });
  await cdp.send("Input.insertText", { text: "日本" });
  await page.waitForTimeout(400);
  expect(await state()).toEqual({ sameField: true, caret: [5, 5], moves: 0 });
  await expect(field).toHaveValue(`${before.slice(0, 3)}日本${before.slice(3)}`);
  await page.setViewportSize({ width: 390, height: 844 });
}

test("keyboard pop-ups leave the focused field, its caret and its text alone (#6992)", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Android keyboard input, driven through Chromium.");
  await page.addInitScript(() => {
    const target = window as typeof window & { __focusMoves?: number };
    target.__focusMoves = 0;
    // The stand-in keyboard events are untrusted, so a trusted one means the page itself moved focus.
    const count = (event: FocusEvent) => {
      if (event.isTrusted) target.__focusMoves! += 1;
    };
    document.addEventListener("focusin", count, true);
    document.addEventListener("focusout", count, true);
  });
  await withLongReply(page, request, async (latest) => {
    const cdp = await page.context().newCDPSession(page);
    const composer = page.locator('[data-component="ChatArea.Roleplay"] textarea[data-chat-composer]');
    await composer.tap();
    await composer.fill("Hello there");
    await expectKeyboardUiLeavesFieldAlone(page, cdp, composer);
    await expectKeyboardUiLeavesFieldAlone(page, cdp, await startEditing(latest));
  });
});
