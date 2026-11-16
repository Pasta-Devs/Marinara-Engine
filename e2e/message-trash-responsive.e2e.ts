import { expect, test, type JSHandle } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatMessageSearch } from "./chat-settings-tools.js";
import { clickTopbarChats } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const ENTRY_COUNT = 1001;

// #7210: a large trash fills in batch by batch, and a restore neither re-renders nor restyles its rows.
test("a large message trash fills in batches and a restore leaves its rows alone", async ({
  page,
  request,
}, testInfo) => {
  const created = await request.post("/api/chats", {
    data: { name: "Responsive trash fixture", mode: "conversation" },
  });
  expect(created.ok()).toBeTruthy();
  const chat = await created.json();
  let releaseRestore!: () => void;
  const restoreHeld = new Promise<void>((resolve) => {
    releaseRestore = resolve;
  });
  let releaseDelete!: () => void;
  const deleteHeld = new Promise<void>((resolve) => {
    releaseDelete = resolve;
  });
  const handles: JSHandle[] = [];
  let cleanupFailure: unknown;
  try {
    const timestamp = new Date().toISOString();
    const entries = Array.from({ length: ENTRY_COUNT }, (_, index) => ({
      id: `responsive-entry-${index}`,
      chatId: chat.id,
      messageId: `responsive-message-${index}`,
      role: "user",
      characterId: null,
      content: `Responsive fixture ${index}`,
      swipeCount: 1,
      messageCreatedAt: timestamp,
      deletedAt: timestamp,
      expiresAt: timestamp,
    }));
    const restoreRequests: string[][] = [];
    await page.route(`**/api/chats/${chat.id}/trash`, (route) => route.fulfill({ json: entries }));
    await page.route(`**/api/chats/${chat.id}/trash/restore`, async (route) => {
      const { entryIds } = route.request().postDataJSON() as { entryIds: string[] };
      restoreRequests.push(entryIds);
      await restoreHeld;
      // Every entry conflicts, so the list stays the same and the warning toast shows.
      return route.fulfill({ json: { restoredMessageIds: [], conflictEntryIds: entryIds } });
    });
    const deleteRequests: unknown[] = [];
    await page.route(`**/api/chats/${chat.id}/trash/delete`, async (route) => {
      deleteRequests.push(route.request().postDataJSON());
      await deleteHeld;
      // Nothing is deleted, so the refetched trash keeps every row.
      return route.fulfill({ json: { deleted: 0 } });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentPulseMode: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ chatId, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
        // Count trash row renders the way React DevTools does: after each commit, a component fiber for
        // a fixture entry that is new to the tree and has the PerformedWork flag (1) ran its render.
        type Fiber = {
          type: unknown;
          memoizedProps?: { entry?: { id?: unknown } } | null;
          flags: number;
          child: Fiber | null;
          sibling: Fiber | null;
        };
        const counter = { rowRenders: 0 };
        let previousRows = new WeakSet<Fiber>();
        Object.assign(window, {
          __trashRowRenders: counter,
          __REACT_DEVTOOLS_GLOBAL_HOOK__: {
            renderers: new Map(),
            supportsFiber: true,
            inject: () => 1,
            onCommitFiberUnmount: () => {},
            onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
              const rows = new WeakSet<Fiber>();
              const pending = [root.current];
              while (pending.length > 0) {
                const fiber = pending.pop()!;
                const entryId = fiber.memoizedProps?.entry?.id;
                if (
                  typeof fiber.type === "function" &&
                  typeof entryId === "string" &&
                  entryId.startsWith("responsive-")
                ) {
                  rows.add(fiber);
                  if (!previousRows.has(fiber) && (fiber.flags & 1) === 1) counter.rowRenders += 1;
                }
                if (fiber.child) pending.push(fiber.child);
                if (fiber.sibling) pending.push(fiber.sibling);
              }
              previousRows = rows;
            },
          },
        });
      },
      { chatId: chat.id, appVersion: version },
    );
    await page.goto("/");
    await clickTopbarChats(page);
    if (testInfo.project.name.includes("mobile")) await page.getByRole("button", { name: "Close chats" }).click();
    const panel = await openChatMessageSearch(page);

    // Record how many rows each DOM update adds while the trash fills in.
    const growth = await panel.evaluateHandle((search) => {
      const added: number[] = [];
      new MutationObserver((records) => {
        let rows = 0;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            for (const button of [node, ...node.querySelectorAll("button")]) {
              if (button.tagName === "BUTTON" && button.textContent === "Restore") rows += 1;
            }
          }
        }
        if (rows > 0) added.push(rows);
      }).observe(search, { childList: true, subtree: true });
      return added;
    });
    handles.push(growth);
    await panel.getByRole("tab", { name: "Trash", exact: true }).click();
    const rowRestore = panel.locator("button").filter({ hasText: /^Restore$/ });
    await expect(rowRestore).toHaveCount(ENTRY_COUNT);
    const added = await growth.evaluate((rows) => rows);
    expect(added.reduce((sum, rows) => sum + rows, 0)).toBe(ENTRY_COUNT);
    // One batch of 200 rows per update, never the whole list at once.
    expect(Math.max(...added)).toBeLessThanOrEqual(200);

    const list = panel.locator("[aria-busy]");
    await expect(list).toHaveAttribute("aria-busy", "false");
    const rowChanges = await list.evaluateHandle((element) => {
      const changes = { count: 0 };
      new MutationObserver((records) => {
        for (const record of records) {
          // The busy cover comes and goes as a direct child; anything else is a row change.
          const coverOnly =
            record.target === element &&
            [...record.addedNodes, ...record.removedNodes].every(
              (node) => node instanceof Element && node.getAttribute("aria-hidden") === "true",
            );
          if (!coverOnly) changes.count += 1;
        }
      }).observe(element, { attributes: true, childList: true, subtree: true, characterData: true });
      return changes;
    });
    handles.push(rowChanges);
    const renders = await page.evaluateHandle(
      () => (window as unknown as { __trashRowRenders: { rowRenders: number } }).__trashRowRenders,
    );
    handles.push(renders);
    const rendersBefore = await renders.evaluate((counter) => counter.rowRenders);
    // The counter sees rows render: each one rendered at least once while the trash filled in.
    expect(rendersBefore).toBeGreaterThanOrEqual(ENTRY_COUNT);

    const restoreAll = panel.getByRole("button", { name: "Restore all", exact: true });
    // The busy status stays on the page, empty while idle, so screen readers announce it when it fills in.
    const status = panel.getByRole("status");
    await expect(status).toBeEmpty();
    const listTop = (await list.boundingBox())!.y;
    await restoreAll.click();
    await expect(restoreAll).toBeDisabled();
    await expect(list).toHaveAttribute("aria-busy", "true");
    // It says why the rows pause, without moving the list.
    await expect(status).toHaveText("Restoring messages…");
    await expect(status.getByText("Restoring messages…", { exact: true })).toBeVisible();
    expect((await list.boundingBox())!.y).toBe(listTop);
    // Row actions wait for the running restore, including from the keyboard.
    await rowRestore.first().focus();
    await page.keyboard.press("Enter");
    releaseRestore();
    await expect(
      page.getByText("Some messages could not be restored. Check the remaining entries and try again.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(restoreAll).toBeEnabled();
    await expect(list).toHaveAttribute("aria-busy", "false");
    await expect(status).toBeEmpty();
    expect(restoreRequests).toHaveLength(1);
    expect(restoreRequests[0]).toHaveLength(ENTRY_COUNT);
    expect(await rowChanges.evaluate((changes) => changes.count)).toBe(0);
    expect(await renders.evaluate((counter) => counter.rowRenders)).toBe(rendersBefore);
    await expect(rowRestore).toHaveCount(ENTRY_COUNT);

    // A running delete says so too, and the status empties again once it is done.
    await panel.getByRole("button", { name: "Empty trash", exact: true }).click();
    await panel.getByRole("button", { name: "Click again to empty", exact: true }).click();
    await expect(list).toHaveAttribute("aria-busy", "true");
    await expect(status).toHaveText("Deleting messages…");
    releaseDelete();
    await expect(list).toHaveAttribute("aria-busy", "false");
    await expect(status).toBeEmpty();
    expect(deleteRequests).toEqual([{ all: true }]);
  } finally {
    releaseRestore();
    releaseDelete();
    for (const handle of handles) {
      await handle.dispose().catch((error) => {
        cleanupFailure = error;
      });
    }
    await request.delete(`/api/chats/${chat.id}?force=true`).then(
      (response) => {
        if (!response.ok()) cleanupFailure = new Error(`Chat fixture cleanup failed (${response.status()})`);
      },
      (error) => {
        cleanupFailure = error;
      },
    );
  }
  if (cleanupFailure !== undefined) throw cleanupFailure;
});
