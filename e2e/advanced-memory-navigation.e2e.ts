import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_ADVANCED_MEMORY_SETTINGS, type AdvancedMemoryStatus } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;
const memoryWindowId = "drawer:chat-settings:roleplay-memory-recall";

async function capture(page: Page, path: string) {
  await page.screenshot({ path, animations: "disabled" });
}

for (const { detached, pinned } of [
  { detached: false, pinned: false },
  { detached: true, pinned: false },
  { detached: true, pinned: true },
]) {
  for (const entry of ["event", "notice", "cross-chat notice", "cold-chat notice"] as const) {
    test(`Advanced Memory ${entry} reaches ${pinned ? "pinned " : ""}${detached ? "popped-out" : "docked"} Memory Recall`, async ({
      page,
      request,
    }, info) => {
      const created = await request.post("/api/characters", {
        data: { data: { name: "Memory navigator", first_mes: "" } },
      });
      expect(created.ok()).toBeTruthy();
      const character = (await created.json()) as { id: string };
      const response = await request.post("/api/chats", {
        data: { name: "Memory navigation proof", mode: "roleplay", characterIds: [character.id] },
      });
      expect(response.ok()).toBeTruthy();
      const chat = (await response.json()) as { id: string };
      const settings = {
        ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
        enabled: true,
        knowledgeConfirmed: true,
        knowledgeStarts: { [character.id]: null },
      };
      const status: AdvancedMemoryStatus = {
        settings,
        job: { id: "prepared", status: "ready", stage: "ready", completed: 0, total: 0, error: null },
        missingKnowledgeCharacterIds: [],
        records: [],
        helperModel: "Fixture helper",
        summaryModel: "Fixture helper",
        warnings: [],
        unpreparedScenes: [{ sceneId: "unprepared-scene", startIndex: 1, endIndex: 2 }],
      };
      let otherChatId: string | null = null;
      let releaseTarget = () => {};
      const fixRequests: unknown[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        expect(
          (
            await request.patch(`/api/chats/${chat.id}/metadata`, {
              data: {
                enableAgents: false,
                advancedMemory: settings,
                ...(detached
                  ? {
                      windowLayout: {
                        version: 1,
                        detached: [memoryWindowId],
                        windows: {
                          [memoryWindowId]: {
                            x: 150,
                            y: 120,
                            width: 450,
                            height: 540,
                            minimized: true,
                            pinned,
                            locked: false,
                          },
                        },
                      },
                    }
                  : {}),
              },
            })
          ).ok(),
        ).toBeTruthy();
        await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
        await page.route(`**/api/chats/${chat.id}/advanced-memory**`, async (route) => {
          if (route.request().method() === "POST" && new URL(route.request().url()).pathname.endsWith("/initialize")) {
            fixRequests.push(route.request().postDataJSON());
            status.job = { id: "fix", status: "running", stage: "summarizing", completed: 0, total: 1, error: null };
            return route.fulfill({ status: 202, json: status });
          }
          return route.fulfill({ json: status });
        });
        await seedUIState(page, {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
          appAccentPulseMode: false,
          chatSettingsExpandedSections: { "roleplay-memory-recall": false },
        });
        await page.addInitScript(
          ({ chatId, version }) => {
            localStorage.setItem("marinara-active-chat-id", chatId);
            localStorage.setItem("marinara:whats-new:seen-version", version);
          },
          { chatId: chat.id, version },
        );
        await page.goto("/");
        await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
        const notice = page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Advanced Memory found a problem in 1 scene." });
        await expect(notice).toBeVisible();
        if (entry === "cross-chat notice" || entry === "cold-chat notice") {
          const otherResponse = await request.post("/api/chats", {
            data: { name: "Other window layout", mode: "roleplay", characterIds: [character.id] },
          });
          expect(otherResponse.ok()).toBeTruthy();
          otherChatId = ((await otherResponse.json()) as { id: string }).id;
          expect(
            (
              await request.patch(`/api/chats/${otherChatId}/metadata`, {
                data: {
                  enableAgents: false,
                  windowLayout: { version: 1, windows: {}, detached: detached ? [] : [memoryWindowId] },
                },
              })
            ).ok(),
          ).toBeTruthy();
          await page.evaluate(async (id) => {
            const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
            useChatStore.getState().setActiveChatId(id);
          }, otherChatId);
          await expect
            .poll(() =>
              page.evaluate(
                async ({ id, detached }) => {
                  const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
                  const { useFloatingWindowStore } = await import("/src/stores/floating-window.store.ts" as string);
                  return (
                    useChatStore.getState().activeChatId === id &&
                    !!useFloatingWindowStore.getState().detached["drawer:chat-settings:roleplay-memory-recall"] !==
                      detached
                  );
                },
                { id: otherChatId, detached },
              ),
            )
            .toBe(true);
          await expect(notice).toBeVisible();
          if (pinned) await expect(page.locator(`.mari-window[data-window="${memoryWindowId}"]`)).not.toBeVisible();
          if (entry === "cold-chat notice") {
            const held = new Promise<void>((resolve) => {
              releaseTarget = resolve;
            });
            await page.route(`**/api/chats/${chat.id}`, async (route) => {
              await held;
              await route.continue();
            });
            await page.evaluate(async (id) => {
              const { queryClient } = await import("/src/lib/query-client.ts" as string);
              const { chatKeys } = await import("/src/hooks/use-chats.ts" as string);
              queryClient.removeQueries({ queryKey: chatKeys.detail(id), exact: true });
            }, chat.id);
          }
        }
        if (entry !== "event") {
          await notice.getByRole("button", { name: "Fix", exact: true }).click();
          if (entry === "cold-chat notice") {
            await expect(page.locator('[data-component="ChatArea.RestoringChat"]')).toBeVisible();
            expect(fixRequests).toEqual([]);
            releaseTarget();
          }
        } else {
          await page.evaluate((chatId) => {
            window.dispatchEvent(new CustomEvent("marinara:advanced-memory-settings", { detail: { chatId } }));
          }, chat.id);
        }
        const owner = page.locator(`.mari-window[data-window="${detached ? memoryWindowId : "chat-settings"}"]`);
        const memory = owner.locator('[data-chat-settings-section="roleplay-memory-recall"]');
        await expect(owner).toBeVisible();
        if (detached && info.project.name === "desktop-chromium")
          await expect(owner).toHaveAttribute("data-pinned", String(pinned));
        if (detached) await expect(page.locator('.mari-window[data-window="chat-settings"]')).not.toBeVisible();
        await expect(memory.getByText("Advanced Memory Recall", { exact: true })).toBeVisible();
        await expect(memory).toBeInViewport();
        if (entry !== "event") {
          await expect.poll(() => fixRequests).toEqual([expect.objectContaining({ fixAll: true })]);
          await expect(memory.locator('[data-component="AdvancedMemoryProgress"]')).toContainText("Summarizing scenes");
        } else {
          expect(fixRequests).toEqual([]);
          if (!detached) {
            await memory.locator(":scope > .mari-drawer__header [data-drawer-toggle]").click();
            await expect(memory.getByText("Advanced Memory Recall", { exact: true })).toHaveCount(0);
            await page.evaluate((chatId) => {
              window.dispatchEvent(new CustomEvent("marinara:advanced-memory-settings", { detail: { chatId } }));
            }, chat.id);
            await expect(memory.getByText("Advanced Memory Recall", { exact: true })).toBeVisible();
            await expect(memory.getByText("Enable Memory Recall", { exact: true })).toBeInViewport({ ratio: 1 });
          }
        }
        for (const theme of ["dark", "light"] as const) {
          await page.evaluate(async (theme) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            useUIStore.getState().setTheme(theme);
          }, theme);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await capture(page, info.outputPath(`memory-navigation-${theme}.png`));
        }
        expect(errors).toEqual([]);
      } finally {
        releaseTarget();
        if (otherChatId) await request.delete(`/api/chats/${otherChatId}?force=true`);
        await request.delete(`/api/chats/${chat.id}?force=true`);
        await request.delete(`/api/characters/${character.id}`);
      }
    });
  }
}
