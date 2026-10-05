import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings, resetChatView } from "./chat-settings-tools.js";

type Mode = "conversation" | "roleplay" | "game";
type ChatRow = { id: string; updatedAt: string; metadata: Record<string, unknown> };
type Layout = { detached?: string[] } | null;
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const windowId = (mode: Mode, section: string) => `drawer:chat-settings:${mode}-${section}`;
const bubble = (page: Page, id: string) => page.locator(`.mari-window-bubble[data-window="${id}"]`);

async function createChat(request: APIRequestContext, mode: Mode): Promise<ChatRow> {
  const response = await request.post("/api/chats", { data: { name: "Window migration", mode, characterIds: [] } });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as ChatRow;
  expect(chat.metadata.windowLayout, "new chats explicitly use the new layout defaults").toBeNull();
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          enableAgents: false,
          // Already saved in a real older chat; avoid an unrelated default-background write on first load.
          ...(mode === "roleplay" ? { background: "Black.jpg" } : {}),
          ...(mode === "game"
            ? {
                gameId: "window-migration",
                gameSessionStatus: "active",
                gameSessionNumber: 1,
                gameIntroPresented: true,
              }
            : {}),
        },
      })
    ).ok(),
  ).toBeTruthy();
  if (mode === "game") {
    expect(
      (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", content: "The game begins." },
        })
      ).ok(),
    ).toBeTruthy();
  }
  return (await (await request.get(`/api/chats/${chat.id}`)).json()) as ChatRow;
}

async function prepare(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version: APP_VERSION },
  );
}

async function readChat(request: APIRequestContext, chatId: string): Promise<ChatRow> {
  return (await (await request.get(`/api/chats/${chatId}`)).json()) as ChatRow;
}

for (const mode of ["conversation", "roleplay", "game"] as const) {
  test(`an older ${mode} chat keeps its tools as buttons and remembers putting one back`, async ({ page, request }) => {
    const chat = await createChat(request, mode);
    try {
      await prepare(page, chat.id);
      // Model the first response from a chat saved before windowLayout existed. Later reads use the real saved result.
      let legacyResponse = true;
      await page.route(`**/api/chats/${chat.id}`, async (route) => {
        if (route.request().method() !== "GET" || !legacyResponse) return route.continue();
        const response = await route.fetch();
        const body = (await response.json()) as ChatRow;
        delete body.metadata.windowLayout;
        legacyResponse = false;
        await route.fulfill({ response, json: body });
      });
      const migrationResponse = page.waitForResponse((response) => {
        const req = response.request();
        if (req.method() !== "PATCH" || !req.url().endsWith(`/api/chats/${chat.id}/metadata`)) return false;
        const body = req.postDataJSON() as Record<string, unknown>;
        return Object.keys(body).length === 1 && Object.hasOwn(body, "windowLayout");
      });
      await page.goto("/");
      await expect(page.locator(`[data-chat-mode="${mode}"]`)).toBeVisible();
      const sections = ["chat-branches", "active-context", "gallery"];
      if (mode !== "game") sections.push("message-search");
      if (mode === "roleplay") sections.push("chat-summary", "author-notes");
      const ids = sections.map((section) => windowId(mode, section));
      for (const id of ids) {
        await expect(bubble(page, id)).toBeVisible();
        await expect(page.locator(`.mari-window[data-window="${id}"]`)).toBeHidden();
      }
      await expect
        .poll(async () => ((await readChat(request, chat.id)).metadata.windowLayout as Layout)?.detached)
        .toEqual(expect.arrayContaining(ids));
      // Game narration can persist its progress independently after this request.
      // Assert the real migration response so that unrelated activity cannot race this check.
      const migratedResponse = await migrationResponse;
      expect(migratedResponse.ok()).toBeTruthy();
      const migratedChat = (await migratedResponse.json()) as ChatRow;
      expect(migratedChat.updatedAt, "migration does not reorder the chat list").toBe(chat.updatedAt);

      const branchesId = windowId(mode, "chat-branches");
      await bubble(page, branchesId).click();
      const branches = page.locator(`.mari-window[data-window="${branchesId}"]`);
      await expect(branches).toBeVisible();
      await branches.getByRole("button", { name: "Put back in Chat Settings", exact: true }).click();
      await expect(bubble(page, branchesId)).toHaveCount(0);
      await expect
        .poll(
          async () =>
            ((await readChat(request, chat.id)).metadata.windowLayout as Layout)?.detached?.includes(branchesId) ??
            false,
        )
        .toBe(false);
      await page.reload();
      await expect(bubble(page, windowId(mode, "gallery"))).toBeVisible();
      await expect(bubble(page, branchesId)).toHaveCount(0);
      const settings = await openChatSettings(page);
      await expect(settings.locator(`[data-drawer="${mode}-chat-branches"]`)).toBeVisible();

      await resetChatView(page);
      await expect.poll(async () => (await readChat(request, chat.id)).metadata.windowLayout).toBeNull();
      await page.reload();
      await expect(page.locator(`[data-chat-mode="${mode}"]`)).toBeVisible();
      for (const id of ids) await expect(bubble(page, id)).toHaveCount(0);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

test("a new chat starts with its tools in Chat Settings", async ({ page, request }) => {
  const chat = await createChat(request, "roleplay");
  try {
    await prepare(page, chat.id);
    await page.goto("/");
    const settings = await openChatSettings(page);
    for (const section of [
      "chat-branches",
      "active-context",
      "gallery",
      "message-search",
      "chat-summary",
      "author-notes",
    ]) {
      await expect(settings.locator(`[data-drawer="roleplay-${section}"]`)).toBeAttached();
      await expect(bubble(page, windowId("roleplay", section))).toHaveCount(0);
    }
    expect((await readChat(request, chat.id)).metadata.windowLayout).toBeNull();
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("locking a window keeps its button in place until the window is unlocked", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Window lock controls live in the desktop title bar.");
  const chat = await createChat(request, "roleplay");
  const expectLockedMovement = async (button: Locator) => {
    await expect(button).toHaveAttribute("data-locked", "true");
    const before = (await button.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 100, before.y + before.height / 2 + 100, { steps: 6 });
    await page.mouse.up();
    await button.focus();
    await button.press("Shift+ArrowDown");
    await button.press("ArrowLeft");
    const after = (await button.boundingBox())!;
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  };
  try {
    await prepare(page, chat.id);
    await page.goto("/");
    const settings = await openChatSettings(page);
    const settingsButton = page.locator("[data-chat-settings-button]");
    await settings.locator('[data-window-control="lock"]').click();
    await settings.locator('[data-window-control="close"]').click();
    await expectLockedMovement(settingsButton);
    await settingsButton.press("Enter");
    await expect(settings).toBeVisible();
    await settings.locator('[data-window-control="lock"]').click();
    await expect(settingsButton).toHaveAttribute("data-locked", "false");
    await settings.locator('[data-window-control="close"]').click();
    const settingsBefore = (await settingsButton.boundingBox())!;
    await settingsButton.focus();
    await settingsButton.press("ArrowDown");
    expect((await settingsButton.boundingBox())!.y).toBeCloseTo(settingsBefore.y + 10, 0);

    await settingsButton.click();
    await settings
      .locator('[data-drawer="chat-name"]')
      .getByRole("button", { name: "Open Chat Name in its own window", exact: true })
      .click();
    const drawerId = "drawer:chat-settings:chat-name";
    const detached = page.locator(`.mari-window[data-window="${drawerId}"]`);
    const detachedButton = bubble(page, drawerId);
    await detached.locator('[data-window-control="lock"]').click();
    await detached.locator('[data-window-control="close"]').click();
    await expectLockedMovement(detachedButton);
    await expect
      .poll(async () => {
        const layout = (await readChat(request, chat.id)).metadata.windowLayout as {
          windows?: Record<string, { locked?: boolean; minimized?: boolean }>;
        };
        return layout.windows?.[drawerId];
      })
      .toMatchObject({ locked: true, minimized: true });
    await page.reload();
    await expect(detachedButton).toBeVisible();
    await expectLockedMovement(detachedButton);
    await detachedButton.click();
    await expect(detached).toBeVisible();
    await detached.locator('[data-window-control="lock"]').click();
    await detached.locator('[data-window-control="close"]').click();
    await expect(detachedButton).toHaveAttribute("data-locked", "false");
    const detachedBefore = (await detachedButton.boundingBox())!;
    await detachedButton.focus();
    await detachedButton.press("Shift+ArrowDown");
    expect((await detachedButton.boundingBox())!.y).toBeCloseTo(detachedBefore.y + 50, 0);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("phone sheets can unlock buttons saved as locked on a computer", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Phone sheets expose the button's lock control.");
  const chat = await createChat(request, "roleplay");
  const drawerId = "drawer:chat-settings:chat-name";
  const savedGeometry = { x: 420, y: 100, width: 400, height: 500, pinned: true, locked: true, minimized: true };
  try {
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            windowLayout: {
              version: 1,
              windows: { "chat-settings": savedGeometry, [drawerId]: savedGeometry },
              detached: [drawerId],
            },
          },
        })
      ).ok(),
    ).toBeTruthy();
    await prepare(page, chat.id);
    await page.goto("/");
    for (const [id, launcher] of [
      ["chat-settings", page.locator("[data-chat-settings-button]")],
      [drawerId, bubble(page, drawerId)],
    ] as const) {
      await expect(launcher).toBeVisible();
      await expect(launcher).toHaveAttribute("data-locked", "true");
      const before = (await launcher.boundingBox())!;
      await launcher.focus();
      await launcher.press("ArrowDown");
      expect((await launcher.boundingBox())!.y).toBeCloseTo(before.y, 0);
      await launcher.tap();
      const sheet = page.locator(`.mari-window[data-window="${id}"]`);
      await expect(sheet).toBeVisible();
      const lock = sheet.locator('[data-window-control="lock"]');
      await expect(lock).toHaveAttribute("aria-pressed", "true");
      await lock.tap();
      await expect(lock).toHaveAttribute("aria-pressed", "false");
      await sheet.locator('[data-window-control="close"]').tap();
      await expect(launcher).toHaveAttribute("data-locked", "false");
      await launcher.focus();
      await launcher.press("ArrowDown");
      expect((await launcher.boundingBox())!.y).toBeCloseTo(before.y + 10, 0);
      await expect
        .poll(async () => {
          const layout = (await readChat(request, chat.id)).metadata.windowLayout as {
            windows: Record<string, unknown>;
          };
          return layout.windows[id];
        })
        .toMatchObject({ ...savedGeometry, locked: false });
    }
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
