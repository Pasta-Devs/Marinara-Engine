import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatMessageSearch } from "./chat-settings-tools.js";
import { clickTopbarChats } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

type FeatureSettings = Record<string, unknown>;
type MessageTrashHolds = { holders: number; original?: FeatureSettings };

// Message Trash is a global switch, and the mobile projects and repeated runs share one server (#7220). Runs that
// need it hold it together: the first saves the original settings and only the last one restores them.
// ponytail: a worker killed mid-test leaves its hold (or the brief lock) until the e2e servers restart and reset
// .tmp/playwright-data; add stale-holder cleanup by worker pid if that ever bites.
async function holdMessageTrash(request: APIRequestContext, baseURL: string) {
  const dir = new URL(`../.tmp/playwright-data/message-trash-${new URL(baseURL).port}/`, import.meta.url);
  const holdersFile = new URL("holders.json", dir);
  const lock = new URL("lock/", dir);
  const unlock = async (state: MessageTrashHolds) => {
    await writeFile(holdersFile, JSON.stringify(state));
    await rm(lock, { recursive: true, force: true });
  };
  const withLock = async (update: (state: MessageTrashHolds) => Promise<void>) => {
    await mkdir(dir, { recursive: true });
    await expect(() => mkdir(lock)).toPass();
    let state: MessageTrashHolds = { holders: 0 };
    try {
      state = await readFile(holdersFile, "utf8").then(JSON.parse, () => state);
      await update(state);
    } finally {
      await unlock(state);
    }
  };
  const release = async (state: MessageTrashHolds) => {
    state.holders -= 1;
    if (state.holders > 0) return;
    const restored = await request.put("/api/app-settings/features", { data: state.original ?? {} });
    if (!restored.ok()) throw new Error(`Feature settings cleanup failed (${restored.status()})`);
    delete state.original;
  };
  // Set once this hold is counted; after that only letting go of the lock can fail.
  let held: MessageTrashHolds | undefined;
  try {
    await withLock(async (state) => {
      const response = await request.get("/api/app-settings/features");
      expect(response.ok()).toBeTruthy();
      const current = ((await response.json()) as { settings?: FeatureSettings }).settings ?? {};
      const enabled = await request.put("/api/app-settings/features", { data: { ...current, messageTrash: true } });
      expect(enabled.ok()).toBeTruthy();
      // Only the first holder saves; an original a failed restore could not put back stays saved for the next try.
      state.original ??= current;
      state.holders += 1;
      held = state;
    });
  } catch (error) {
    // The caller gets no release callback, so take back a counted hold here while the lock is still ours: other
    // holders keep theirs, and the setting is restored if this was the last one. Then fail with the original error.
    const state = held;
    if (state)
      await release(state)
        .finally(() => unlock(state))
        .catch((rollbackError) => {
          throw new AggregateError([error, rollbackError], "Could not take back a failed Message Trash hold");
        });
    throw error;
  }
  return () => withLock(release);
}

async function openChat(page: Page, chatId: string, mobile: boolean) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ chatId, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    },
    { chatId, appVersion: version },
  );
  await page.goto("/");
  await clickTopbarChats(page);
  if (mobile) await page.getByRole("button", { name: "Close chats" }).click();
}

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} message marks stay visible and trash reports partial restores`, async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    const releaseMessageTrash = await holdMessageTrash(request, baseURL!);
    let chatId: string | undefined;
    let messageId: string | undefined;
    let cleanupFailures: unknown[] = [];
    try {
      const created = await request.post("/api/chats", { data: { name: "Message marks fixture", mode } });
      expect(created.ok()).toBeTruthy();
      const chat = await created.json();
      chatId = chat.id;
      const hiddenResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: "assistant",
          content: "Hidden bookmarked fixture.",
          extra: { hiddenFromUser: true, bookmark: { createdAt: new Date().toISOString() } },
        },
      });
      expect(hiddenResponse.ok()).toBeTruthy();
      const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "Synthetic message for marks and restore." },
      });
      expect(messageResponse.ok()).toBeTruthy();
      const message = await messageResponse.json();
      messageId = message.id;

      await openChat(page, chat.id, testInfo.project.name.includes("mobile"));

      const messageRow = page.locator(`[data-message-id="${messageId}"]`);
      await expect(messageRow).toContainText("Synthetic message for marks and restore.");
      await messageRow.focus();
      await messageRow.getByRole("button", { name: "Bookmark, pin or note" }).click();
      const marksMenu = page.getByRole("dialog", { name: "Bookmark, pin or note" });
      await expect(marksMenu.getByRole("button", { name: "Bookmark message" })).toBeFocused();
      await marksMenu.getByRole("button", { name: "Bookmark message" }).click();
      await marksMenu.getByRole("button", { name: "Pin to context" }).click();
      await marksMenu.getByRole("textbox", { name: "Private note" }).fill("Synthetic private note.");
      const originalViewport = page.viewportSize()!;
      const mobile = testInfo.project.name.includes("mobile");
      if (mobile) {
        // Simulate the keyboard shrinking and panning the visual viewport without changing layout size.
        await page.evaluate(() => {
          Object.defineProperties(window.visualViewport!, {
            height: { configurable: true, value: 220 },
            offsetTop: { configurable: true, value: 80 },
            pageTop: { configurable: true, value: 80 },
          });
          window.visualViewport!.dispatchEvent(new Event("resize"));
        });
      } else {
        await page.setViewportSize({ width: originalViewport.width, height: 240 });
      }
      await expect.poll(async () => (await marksMenu.boundingBox())?.height ?? Infinity).toBeLessThanOrEqual(224);
      await expect.poll(() => marksMenu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      const saveNote = marksMenu.getByRole("button", { name: "Save note" });
      await saveNote.scrollIntoViewIfNeeded();
      const menuBox = (await marksMenu.boundingBox())!;
      const saveBox = (await saveNote.boundingBox())!;
      expect(menuBox.y).toBeGreaterThanOrEqual(mobile ? 80 : 0);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(mobile ? 300 : 240);
      expect(saveBox.y).toBeGreaterThanOrEqual(menuBox.y);
      expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(menuBox.y + menuBox.height);
      await saveNote.click();
      if (mobile) {
        await page.evaluate(() => {
          for (const key of ["height", "offsetTop", "pageTop"]) Reflect.deleteProperty(window.visualViewport!, key);
          window.visualViewport!.dispatchEvent(new Event("resize"));
        });
      } else {
        await page.setViewportSize(originalViewport);
      }
      await page.keyboard.press("Escape");
      // Move focus off the message to the top bar; Home is there at every width (a phone lists Chats under More).
      await page.locator('[data-component="TopBar"]').getByRole("button", { name: "Home", exact: true }).focus();
      await page.mouse.move(0, 0);
      const bookmarkIndicator = messageRow.getByRole("img", { name: "Bookmarked", exact: true });
      await expect(bookmarkIndicator).toBeVisible();
      await expect
        .poll(() =>
          bookmarkIndicator.evaluate((element) => {
            let opacity = 1;
            for (let current: Element | null = element; current; current = current.parentElement) {
              opacity *= Number(getComputedStyle(current).opacity);
            }
            return opacity;
          }),
        )
        .toBe(1);

      await expect
        .poll(async () => {
          const result = await request.get(`/api/chats/${chat.id}/messages`);
          const messages = await result.json();
          const saved = messages.find((item: { id: string }) => item.id === messageId);
          return typeof saved?.extra === "string" ? JSON.parse(saved.extra) : saved?.extra;
        })
        .toMatchObject({
          bookmark: expect.any(Object),
          pinnedToContext: true,
          privateNote: "Synthetic private note.",
        });

      if (!mobile) {
        // Roleplay also shows the one-time Chat Settings move tip as a note (118b7d3fc); check the note viewer itself.
        const noteViewer = page.locator('[role="note"][data-chat-floating-panel]');
        // Keyboard activation does not send an outside pointerdown to dismiss the note viewer.
        const noteIndicator = messageRow.getByRole("button", { name: "Show private note", exact: true });
        const marksAction = messageRow.getByRole("button", { name: "Bookmark, pin or note" });
        await noteIndicator.press("Enter");
        await expect(noteViewer).toContainText("Synthetic private note.");
        await marksAction.press("Enter");
        await marksMenu.getByRole("textbox", { name: "Private note" }).fill("");
        await marksMenu.getByRole("button", { name: "Save note" }).press("Enter");
        await expect(noteIndicator).toHaveCount(0);
        await expect(noteViewer).toHaveCount(0);
        await marksMenu.getByRole("textbox", { name: "Private note" }).fill("Synthetic private note.");
        await marksMenu.getByRole("button", { name: "Save note" }).press("Enter");
        await expect(noteIndicator).toHaveAttribute("aria-expanded", "false");
        await expect(noteViewer).toHaveCount(0);
        await page.keyboard.press("Escape");
      }

      // Use the message DELETE route as a deterministic fixture action; restore is exercised through the chat UI.
      const deleted = await request.delete(`/api/chats/${chat.id}/messages/${messageId}`);
      expect(deleted.status()).toBe(200);
      expect(await deleted.json()).toEqual({ trashed: true, trashedCount: 1 });
      const conflictResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "Entry retained after a restore conflict." },
      });
      expect(conflictResponse.ok()).toBeTruthy();
      const conflictMessage = await conflictResponse.json();
      expect((await request.delete(`/api/chats/${chat.id}/messages/${conflictMessage.id}`)).ok()).toBeTruthy();
      const trashResponse = await request.get(`/api/chats/${chat.id}/trash`);
      expect(trashResponse.ok()).toBeTruthy();
      const trash = (await trashResponse.json()) as Array<{ id: string; messageId: string }>;
      const restoreEntry = trash.find((entry) => entry.messageId === messageId)!;
      const conflictEntry = trash.find((entry) => entry.messageId === conflictMessage.id)!;
      // Exercise the partial-result UI contract while keeping the failed entry in real storage.
      await page.route(`**/api/chats/${chat.id}/trash/restore`, async (route) => {
        const response = await route.fetch({ postData: { entryIds: [restoreEntry.id] } });
        await route.fulfill({ response, json: { ...(await response.json()), conflictEntryIds: [conflictEntry.id] } });
      });
      await page.reload();
      const trashedRow = page.locator(`[data-message-id="${messageId}"]`);
      await expect(trashedRow).toHaveCount(0);
      const searchPanel = await openChatMessageSearch(page);
      await searchPanel.getByRole("tab", { name: "Bookmarks", exact: true }).click();
      await expect(searchPanel).not.toContainText("Hidden bookmarked fixture.");
      await searchPanel.getByRole("tab", { name: "Trash", exact: true }).click();
      await expect(searchPanel).toContainText("Synthetic message for marks and restore.");
      await searchPanel.getByRole("button", { name: "Restore all", exact: true }).click();
      await expect(page.getByText("Message restored", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Some messages could not be restored. Check the remaining entries and try again.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(searchPanel).toContainText("Entry retained after a restore conflict.");
      await expect(page.locator(`[data-message-id="${messageId}"]`)).toContainText(
        "Synthetic message for marks and restore.",
      );
      await searchPanel.getByRole("tab", { name: "Bookmarks", exact: true }).click();
      await expect(searchPanel.getByTitle("Jump to message 2")).toContainText(
        "Synthetic message for marks and restore.",
      );
      await expect(searchPanel).not.toContainText("Hidden bookmarked fixture.");
    } finally {
      const cleanupRequests: Array<Promise<unknown>> = [];
      if (chatId) {
        cleanupRequests.push(
          request.delete(`/api/chats/${chatId}?force=true`).then((response) => {
            if (!response.ok()) throw new Error(`Chat fixture cleanup failed (${response.status()})`);
          }),
        );
      }
      cleanupRequests.push(releaseMessageTrash());
      const cleanupResults = await Promise.allSettled(cleanupRequests);
      cleanupFailures = cleanupResults.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "Could not clean up message marks browser fixture");
    }
  });
}

test("a message deleted in the chat shows again when restored from the trash", async ({
  page,
  request,
  baseURL,
  isMobile,
}) => {
  const releaseMessageTrash = await holdMessageTrash(request, baseURL!);
  let chatId: string | undefined;
  let cleanupFailures: unknown[] = [];
  try {
    const chat = await (
      await request.post("/api/chats", { data: { name: "Trash restore fixture", mode: "conversation" } })
    ).json();
    chatId = chat.id;
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "A message to delete and restore." },
      })
    ).json();
    await openChat(page, chat.id, isMobile);
    const row = page.locator(`[data-message-id="${message.id}"]`);
    await expect(row).toContainText("A message to delete and restore.");

    // Delete it in the app, so the chat keeps hiding it after the reload: only a fetch that shows it again ends that.
    if (isMobile) await row.click({ position: { x: 80, y: 24 } });
    else await row.hover();
    await row.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("dialog", { name: "Delete message" })
      .getByRole("button", { name: "Delete message", exact: true })
      .click();
    await expect(row).toHaveCount(0);
    await expect.poll(async () => (await (await request.get(`/api/chats/${chat.id}/trash`)).json()).length).toBe(1);

    const searchPanel = await openChatMessageSearch(page);
    await searchPanel.getByRole("tab", { name: "Trash", exact: true }).click();
    await searchPanel.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(page.getByText("Message restored", { exact: true })).toBeVisible();
    await expect(row).toContainText("A message to delete and restore.");
  } finally {
    const results = await Promise.allSettled([
      chatId
        ? request.delete(`/api/chats/${chatId}?force=true`).then((response) => {
            if (!response.ok()) throw new Error(`Chat fixture cleanup failed (${response.status()})`);
          })
        : Promise.resolve(),
      releaseMessageTrash(),
    ]);
    cleanupFailures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  }
  if (cleanupFailures.length > 0) throw new AggregateError(cleanupFailures, "Could not clean up trash restore fixture");
});
