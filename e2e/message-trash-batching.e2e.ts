import { expect, test, type JSHandle } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatMessageSearch } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const conflictsOnly of [false, true]) {
  test(
    conflictsOnly
      ? "restore all keeps conflicts-only batches after a later failure"
      : "restore all batches large selections and keeps partial failures retryable",
    async ({ page, request }, testInfo) => {
      test.setTimeout(90_000);
      const created = await request.post("/api/chats", {
        data: { name: "Large recovery fixture", mode: "conversation" },
      });
      expect(created.ok()).toBeTruthy();
      const chat = await created.json();
      let releaseSecondBatch!: () => void;
      const secondBatch = new Promise<void>((resolve) => {
        releaseSecondBatch = resolve;
      });
      let cleanupFailure: unknown;
      let restoreObserver: JSHandle<{ result: unknown; stop(): void }> | undefined;
      try {
        const timestamp = new Date().toISOString();
        let remaining = Array.from({ length: 5001 }, (_, index) => ({
          id: `recovery-entry-${index}`,
          chatId: chat.id,
          messageId: `recovery-message-${index}`,
          role: "user",
          characterId: null,
          content: `Recovery fixture ${index}`,
          swipeCount: 1,
          messageCreatedAt: timestamp,
          deletedAt: timestamp,
          expiresAt: timestamp,
        }));
        const batches: string[][] = [];
        let trashReads = 0;
        let messageReads = 0;
        page.on("request", (sent) => {
          if (new URL(sent.url()).pathname === `/api/chats/${chat.id}/messages`) messageReads += 1;
        });
        await page.route(`**/api/chats/${chat.id}/trash`, (route) => {
          trashReads += 1;
          return route.fulfill({ json: remaining });
        });
        await page.route(`**/api/chats/${chat.id}/trash/restore`, async (route) => {
          const { entryIds } = route.request().postDataJSON() as { entryIds: string[] };
          batches.push(entryIds);
          if (entryIds.length > 5000) return route.fulfill({ status: 400, json: { error: "entryIds limit exceeded" } });
          if (batches.length === 2) {
            await secondBatch;
            return route.fulfill({ status: 500, json: { error: "Synthetic later-batch failure" } });
          }
          if (batches.length === 3) return route.fulfill({ status: 500, json: { error: "Synthetic retry failure" } });
          const conflictEntryIds = batches.length === 1 ? (conflictsOnly ? entryIds : [entryIds[0]!]) : [];
          const requestedIds = new Set(entryIds);
          const conflictIds = new Set(conflictEntryIds);
          const restored = remaining.filter((entry) => requestedIds.has(entry.id) && !conflictIds.has(entry.id));
          const restoredIds = new Set(restored.map((entry) => entry.id));
          remaining = remaining.filter((entry) => !restoredIds.has(entry.id));
          return route.fulfill({
            json: { restoredMessageIds: restored.map((entry) => entry.messageId), conflictEntryIds },
          });
        });
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
        await page.getByRole("button", { name: "Chats", exact: true }).click();
        if (testInfo.project.name.includes("mobile")) {
          await page.getByRole("button", { name: "Close chats" }).click();
        }
        const panel = await openChatMessageSearch(page);
        await panel.getByRole("tab", { name: "Trash", exact: true }).click();
        // Avoid computing accessible names for every button in the 5,001-row mock.
        const restoreAll = panel.locator("button").filter({ hasText: /^Restore all$/ });
        await expect(restoreAll).toBeEnabled();
        if (conflictsOnly) {
          // Observe the real hook's result without exposing application internals in production.
          restoreObserver = await page.evaluateHandle(async () => {
            const moduleUrl = performance
              .getEntriesByType("resource")
              .map((entry) => entry.name)
              .find((url) => new URL(url).pathname.endsWith("/@tanstack_react-query.js"));
            if (!moduleUrl) throw new Error("React Query module was not loaded");
            const { MutationCache } = await import(moduleUrl);
            const notify = MutationCache.prototype.notify;
            const observed = { result: null as unknown, stop: () => (MutationCache.prototype.notify = notify) };
            MutationCache.prototype.notify = function (
              this: unknown,
              event: { type: string; mutation?: { state: { status: string; variables?: unknown; data?: unknown } } },
            ) {
              const state = event.mutation?.state;
              if (
                event.type === "updated" &&
                state?.status === "success" &&
                Array.isArray(state.variables) &&
                state.variables[0] === "recovery-entry-0"
              ) {
                observed.result = state.data;
              }
              return notify.call(this, event);
            };
            return observed;
          });
        }
        const initialTrashReads = trashReads;
        const initialMessageReads = messageReads;
        await restoreAll.click();
        await expect.poll(() => batches.map((batch) => batch.length)).toEqual([5000, 1]);
        await expect(restoreAll).toBeDisabled();
        await expect(panel.locator("button").filter({ hasText: /^Empty trash$/ })).toBeDisabled();
        expect(trashReads).toBe(initialTrashReads);
        releaseSecondBatch();
        // Replacing 5,001 mocked rows takes longer under development rendering and browser tracing.
        const failureToast = page.locator("[data-sonner-toast]").filter({ hasText: "Synthetic later-batch failure" });
        await expect(failureToast).toHaveAttribute("data-type", "warning", { timeout: 30_000 });
        if (conflictsOnly) {
          expect(await restoreObserver!.evaluate((observer) => observer.result)).toEqual({
            restoredMessageIds: [],
            conflictEntryIds: batches[0],
            error: "Synthetic later-batch failure",
          });
          await expect(failureToast.locator("[data-description]")).toHaveCount(0);
          await expect(panel.locator("button").filter({ hasText: /^Restore$/ })).toHaveCount(5001);
          await expect(restoreAll).toBeEnabled();
          expect(remaining.map((entry) => entry.id)).toEqual(batches.flat());
        } else {
          await expect(page.getByText("4999 messages restored", { exact: true })).toBeVisible();
          await expect(panel.getByRole("button", { name: "Restore", exact: true })).toHaveCount(2);
          await expect.poll(() => messageReads).toBeGreaterThan(initialMessageReads);
          await expect(restoreAll).toBeEnabled();
          await restoreAll.click();
          await expect(page.getByText("Synthetic retry failure", { exact: true })).toBeVisible();
          await expect(panel.getByRole("button", { name: "Restore", exact: true })).toHaveCount(2);
          await expect(restoreAll).toBeEnabled();
          await restoreAll.click();
          await expect(panel.getByRole("button", { name: "Restore", exact: true })).toHaveCount(0);
          await expect(page.getByText("2 messages restored", { exact: true })).toBeVisible();
          expect(batches.map((batch) => batch.length)).toEqual([5000, 1, 2, 2]);
          expect(batches[2]).toEqual(["recovery-entry-0", "recovery-entry-5000"]);
          expect(batches[3]).toEqual(batches[2]);
          expect(remaining).toEqual([]);
        }
      } finally {
        releaseSecondBatch();
        await restoreObserver
          ?.evaluate((observer) => observer.stop())
          .catch((error) => {
            cleanupFailure = error;
          });
        await restoreObserver?.dispose().catch((error) => {
          cleanupFailure = error;
        });
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
    },
  );
}
