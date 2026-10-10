import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Slice 65/68: ⌘J from a chat on first load restores Mari's connection and then starts the chat's
 * thread in the same tick. The thread must keep Mari's connection, not the render's stale fallback
 * (the default connection, here the chat's small one).
 */
test.beforeEach(async ({ request }) => {
  await acquireMariThreadLock();
  const existing = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
    id: string;
  }>;
  await Promise.all(
    existing.map((chat) =>
      request.delete(`/api/chats/internal/professor-mari/chats/${chat.id}`).catch(() => undefined),
    ),
  );
});

test.afterEach(() => {
  releaseMariThreadLock();
});

test("a new Mari thread from a chat keeps Mari's connection", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard shortcut is covered on desktop.");
  const created: string[] = [];
  let chatId: string | null = null;
  const connection = async (name: string, maxContext: number, isDefault: boolean) => {
    const response = await request.post("/api/connections", {
      data: {
        name,
        provider: "custom",
        baseUrl: "http://127.0.0.1:9/v1",
        apiKey: "x",
        model: name,
        maxContext,
        isDefault,
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const id = ((await response.json()) as { id: string }).id;
    created.push(id);
    return id;
  };
  try {
    const mariConnection = await connection(`Mari big ${Date.now().toString(36)}`, 131072, false);
    // Created last, so it is also first in the list (updatedAt desc): the stale fallback either way.
    const chatConnection = await connection(`Chat 4k ${Date.now().toString(36)}`, 4096, true);
    const mari = await request.get(`/api/chats/internal/professor-mari?connectionId=${mariConnection}`);
    expect(mari.ok(), await mari.text()).toBeTruthy();
    const chat = await request.post("/api/chats", {
      data: { name: "Thread connection chat", mode: "conversation", characterIds: [], connectionId: chatConnection },
    });
    expect(chat.ok(), await chat.text()).toBeTruthy();
    chatId = ((await chat.json()) as { id: string }).id;

    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
    });
    const restart = page.waitForRequest((r) => r.url().includes("/internal/professor-mari/restart"));
    await page.goto("/");
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, chatId);
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    expect(new URL((await restart).url()).searchParams.get("connectionId")).toBe(mariConnection);
    await expect
      .poll(async () => {
        const threads = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
          connectionId: string | null;
        }>;
        return threads.map((thread) => thread.connectionId);
      })
      .toEqual([mariConnection]);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    for (const id of created) await request.delete(`/api/connections/${id}`).catch(() => undefined);
  }
});
