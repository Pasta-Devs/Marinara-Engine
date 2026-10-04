import { devices, expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
// The browser comes from the mobile-webkit project; this file only swaps the phone for an iPad.
const { defaultBrowserType: _browser, ...iPad } = devices["iPad Pro 11"];

test.use(iPad);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "iPad Safari checks run in WebKit.");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
});

async function seedShell(page: Page, state: Parameters<typeof seedUIState>[1]) {
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    sidebarOpen: false,
    rightPanelOpen: false,
    ...state,
  });
}

test("tapping a roleplay in the iPad chat list opens it", async ({ page, request }) => {
  const created = await request.post("/api/chats", {
    data: { name: "iPad scene tap", mode: "roleplay", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  try {
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The tavern door creaks open." },
    });
    expect(message.ok()).toBeTruthy();
    await seedShell(page, { sidebarOpen: true });
    await page.goto("/");

    const chatList = page.locator('[data-component="ChatSidebarPanel"]');
    await expect(chatList).toBeVisible();
    await chatList.locator('[data-tour="chat-mode-roleplay"]').tap();
    await chatList.locator(`[data-chat-id="${chat.id}"]`).tap();

    await expect(chatList).toHaveCount(0);
    await expect(page.getByText("The tavern door creaks open.")).toBeInViewport();
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

/** Playwright has no software keyboard, so stand in for Safari's visual viewport. */
async function mockVisualViewport(page: Page) {
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
    Object.defineProperty(window, "__openIpadKeyboard", {
      value: (top: number) => {
        keyboardTop = top;
        viewport.dispatchEvent(new Event("resize"));
      },
    });
  });
}

// A short latest reply ends up under the keyboard; a long one starts above the transcript.
for (const replyLines of [0, 60]) {
  test(`editing a ${replyLines ? "long " : ""}roleplay message on iPad keeps the editor above the keyboard`, ({
    page,
    request,
  }) => editLatestReplyOnIpad(page, request, replyLines));
}

async function editLatestReplyOnIpad(page: Page, request: APIRequestContext, replyLines: number) {
  const created = await request.post("/api/chats", {
    data: { name: "iPad keyboard edit", mode: "roleplay", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  try {
    let lastId = "";
    for (let index = 0; index < 12; index += 1) {
      const saved = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 ? "assistant" : "user",
          content:
            index === 11 && replyLines
              ? Array.from({ length: replyLines }, (_, line) => `Reply line ${line + 1} of the long answer.`).join("\n")
              : `Keyboard line ${index + 1}. ${"The lantern light flickers over the old map. ".repeat(4)}`,
        },
      });
      expect(saved.ok()).toBeTruthy();
      lastId = ((await saved.json()) as { id: string }).id;
    }
    await mockVisualViewport(page);
    await seedShell(page, {});
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    await page.goto("/");

    // Tap the latest reply, then its Edit action, as in the report's video.
    const latest = page.locator(`[data-message-id="${lastId}"]`);
    await latest.getByText(replyLines ? /Reply line 60 of the long answer/ : /^Keyboard line 12\./).tap();
    await latest.getByRole("button", { name: "Edit", exact: true }).tap();
    const editor = latest.locator("[data-chat-message-editor]");
    await expect(editor).toBeFocused();

    const keyboardTop = Math.round(iPad.viewport.height * 0.6);
    await page.evaluate((top) => {
      (window as typeof window & { __openIpadKeyboard: (top: number) => void }).__openIpadKeyboard(top);
    }, keyboardTop);
    await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");

    // The app shrinks to the visible area, so the composer sits on top of the keyboard.
    await expect
      .poll(async () => {
        const shell = await page.locator('[data-component="AppShell"]').boundingBox();
        return shell ? Math.round(shell.y + shell.height) : null;
      })
      .toBe(keyboardTop);
    // The start of the message being edited stays visible above it.
    const transcript = page.locator("[data-chat-scroll]:visible");
    await expect
      .poll(async () => {
        const [box, area] = await Promise.all([editor.boundingBox(), transcript.boundingBox()]);
        return !!box && !!area && box.y >= area.y && box.y + 40 <= area.y + area.height;
      })
      .toBe(true);
    // It lands below the top controls, so pressing its first line reaches the editor, not the agent window there.
    await expect
      .poll(() =>
        editor.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return [0.1, 0.5, 0.95].map(
            (fraction) => document.elementFromPoint(box.left + box.width * fraction, box.top + 16) === element,
          );
        }),
      )
      .toEqual([true, true, true]);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
}

test("Support Diagnostics copies while the iPad tap is still being handled", async ({ page }) => {
  // Safari only lets a page write to the clipboard while it is handling the tap. Playwright's
  // WebKit allows a few seconds more, so hold the copy to Safari's rule here.
  await page.addInitScript(() => {
    let handlingTap = false;
    window.addEventListener(
      "click",
      (event) => {
        if (!event.isTrusted) return;
        handlingTap = true;
        setTimeout(() => (handlingTap = false), 0);
      },
      true,
    );
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async (text: string) => {
        if (!handlingTap) throw new DOMException("Clipboard write outside the tap", "NotAllowedError");
        (window as typeof window & { __copiedReport?: string }).__copiedReport = text;
      },
    });
    const execCommand = document.execCommand.bind(document);
    document.execCommand = (command, ...rest) =>
      command === "copy" && !handlingTap ? false : execCommand(command, ...rest);
  });
  await seedShell(page, { rightPanelOpen: true, rightPanel: "settings", settingsTab: "advanced" });
  await page.goto("/");

  await page.getByRole("button", { name: "Copy Support Diagnostics", exact: true }).tap();

  await expect(page.getByText("Support diagnostics copied.", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as typeof window & { __copiedReport?: string }).__copiedReport ?? ""))
    .toContain("Mari last acted on: none recorded this session");
});
