import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatMessageSearch } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} message marks stay visible and trash reports partial restores`, async ({ page, request }, testInfo) => {
    const originalFeaturesResponse = await request.get("/api/app-settings/features");
    expect(originalFeaturesResponse.ok()).toBeTruthy();
    const originalFeatures = await originalFeaturesResponse.json();
    const features = { ...(originalFeatures.settings ?? {}), messageTrash: true };
    let chatId: string | undefined;
    let messageId: string | undefined;
    let cleanupFailures: unknown[] = [];
    try {
      const enabledFeaturesResponse = await request.put("/api/app-settings/features", { data: features });
      expect(enabledFeaturesResponse.ok()).toBeTruthy();
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
        { chatId: chat.id, appVersion: version },
      );
      await page.goto("/");
      await page.getByRole("button", { name: "Chats" }).click();
      if (testInfo.project.name.includes("mobile")) await page.getByRole("button", { name: "Close chats" }).click();

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
      await page.getByRole("button", { name: "Chats", exact: true }).focus();
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
        // Keyboard activation does not send an outside pointerdown to dismiss the note viewer.
        const noteIndicator = messageRow.getByRole("button", { name: "Show private note", exact: true });
        const marksAction = messageRow.getByRole("button", { name: "Bookmark, pin or note" });
        await noteIndicator.press("Enter");
        await expect(page.getByRole("note")).toContainText("Synthetic private note.");
        await marksAction.press("Enter");
        await marksMenu.getByRole("textbox", { name: "Private note" }).fill("");
        await marksMenu.getByRole("button", { name: "Save note" }).press("Enter");
        await expect(noteIndicator).toHaveCount(0);
        await expect(page.getByRole("note")).toHaveCount(0);
        await marksMenu.getByRole("textbox", { name: "Private note" }).fill("Synthetic private note.");
        await marksMenu.getByRole("button", { name: "Save note" }).press("Enter");
        await expect(noteIndicator).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByRole("note")).toHaveCount(0);
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
      cleanupRequests.push(
        request.put("/api/app-settings/features", { data: originalFeatures.settings ?? {} }).then((response) => {
          if (!response.ok()) throw new Error(`Feature settings cleanup failed (${response.status()})`);
        }),
      );
      const cleanupResults = await Promise.allSettled(cleanupRequests);
      cleanupFailures = cleanupResults.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "Could not clean up message marks browser fixture");
    }
  });
}
