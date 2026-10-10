import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Slice 73: the composer's "Context" chip is what the server gets. From a chat, ⌘J brings that chat
 * along: kept, the send carries it and a "why does he forget" question runs the reply checkup first;
 * removed with its X (keyboard only), the next send carries no chat and no checkup runs.
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

test("the Context chip's X sends the next message without the chat", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard door is covered on desktop.");
  test.setTimeout(90_000);

  const bodies: string[] = [];
  const provider = createServer((incoming, response) => {
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
      return;
    }
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      bodies.push(Buffer.concat(chunks).toString());
      const action = { say: "Here is what I found.", commands: [], stop: true };
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(action) }, finish_reason: null }] })}`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));

  let connectionId = "";
  let chatId = "";
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
    const connection = await request.post("/api/connections", {
      data: {
        name: `Context chip fixture ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;
    const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    expect(mariChat.ok(), await mariChat.text()).toBeTruthy();
    const chat = await request.post("/api/chats", {
      data: { name: "Context chip chat", mode: "conversation", characterIds: [] },
    });
    expect(chat.ok(), await chat.text()).toBeTruthy();
    chatId = ((await chat.json()) as { id: string }).id;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      reduceAmbientEffects: true,
    });
    await page.goto("/");
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, chatId);
    const askMariFromChat = async () => {
      await page
        .locator("main")
        .first()
        .click({ position: { x: 5, y: 5 } });
      await page.keyboard.press("Control+j");
    };
    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    const chip = mariPane.locator('.mari-workspace-composer__context [data-facet="chat"]');
    const sendAndWait = async (text: string) => {
      const before = bodies.length;
      await mariPane.locator("textarea:visible").fill(text);
      await page.keyboard.press("Control+Enter");
      await expect.poll(() => bodies.length, { timeout: 20_000 }).toBeGreaterThan(before);
      await expect(mariPane.locator('.mari-work-timeline[data-active="true"]')).toHaveCount(0, { timeout: 20_000 });
      return bodies.slice(before).join("\n");
    };

    // Removed with its X from the keyboard: the chip goes, and the send carries no chat (a fresh thread,
    // so no earlier turn can bring the id along).
    await askMariFromChat();
    await expect(chip).toContainText("Context chip chat");
    await page.screenshot({ path: "test-results/mari-context-chip-proof/chip-1440.png" });
    const remove = chip.getByRole("button", { name: "Remove Context chip chat" });
    await remove.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveCount(0);
    await page.screenshot({ path: "test-results/mari-context-chip-proof/chip-removed-1440.png" });
    const removed = await sendAndWait("Why does he forget things?");
    expect(removed).not.toContain("ask_mari_context");
    expect(removed).not.toContain(chatId);
    expect(removed).not.toContain("Command: app_data chat.diagnose");

    // Kept (control): the chat goes along, and the forgetting question runs the checkup on it first.
    await page.keyboard.press("Control+j");
    await expect(page.getByPlaceholder(/Search everything/)).toBeVisible();
    await page.keyboard.press("Escape");
    await askMariFromChat();
    await expect(chip).toContainText("Context chip chat");
    const kept = await sendAndWait("Why does he forget things again?");
    expect(kept).toContain("ask_mari_context");
    expect(kept).toContain(chatId);
    expect(kept).toContain("Command: app_data chat.diagnose");
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    const threads = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
      id: string;
    }>;
    for (const thread of threads)
      await request.delete(`/api/chats/internal/professor-mari/chats/${thread.id}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});
