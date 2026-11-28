import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const DRAFTS = ["I wave at Alice from the doorway.", "I knock twice and wait for Alice to answer."];

/** A stand-in OpenAI-compatible model that streams each draft slowly, word by word. */
async function startModel(): Promise<{ server: Server; baseUrl: string; calls: () => number }> {
  let calls = 0;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    // A direction with this word fails before any text is written.
    if (body.includes("FAILNOW")) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "mock failure" } }));
      return;
    }
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const text = DRAFTS[calls % DRAFTS.length]!;
    calls += 1;
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const word of text.split(/(?<= )/u)) {
      res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: word } }] })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
    res.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing mock model port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1`, calls: () => calls };
}

// Impersonate as a message draft: the result is written into the message box, nothing is posted, and Redo and Undo
// work on it. Sending it is what posts it.
test("Impersonate writes a message draft that is not posted until sent", async ({ page, request }, testInfo) => {
  const model = await startModel();
  const created: string[] = [];
  try {
    const connection = await request.post("/api/connections", {
      data: { name: `Draft model ${testInfo.project.name}`, provider: "custom", baseUrl: model.baseUrl, model: "m" },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    const { id: connectionId } = (await connection.json()) as { id: string };
    created.push(`/api/connections/${connectionId}`);
    const character = await request.post("/api/characters", { data: { data: { name: "Alice" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    const { id: characterId } = (await character.json()) as { id: string };
    created.push(`/api/characters/${characterId}`);
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Impersonate draft", mode: "roleplay", characterIds: [characterId], connectionId },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    created.unshift(`/api/chats/${chat.id}`);
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", characterId, content: "Alice opens the door." },
    });
    const messageCount = async () =>
      ((await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as unknown[]).length;
    expect(await messageCount()).toBe(1);

    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
      impersonateResult: "draft",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");

    const box = page.locator("textarea.mari-chat-input-textarea");
    const strip = page.locator("[data-impersonate-draft]");
    await box.fill("/impersonate wave at Alice");
    await page.locator("button.mari-chat-send-btn").click();

    // It writes into the box, which is read-only meanwhile, with Stop in place of Send.
    await expect(strip).toHaveAttribute("data-impersonate-draft", "writing");
    await expect(box).toHaveAttribute("readonly", "");
    await expect(page.locator("button.mari-chat-send-btn")).toHaveAttribute("aria-label", /stop/iu);
    await expect(strip).toHaveAttribute("data-impersonate-draft", "ready");
    await expect(box).toHaveValue(DRAFTS[0]!);
    await expect(box).not.toHaveAttribute("readonly", "");
    // Nothing was posted: no message, no character reply.
    expect(await messageCount()).toBe(1);
    await expect(page.locator('[data-message-role="user"]')).toHaveCount(0);

    // Redo replaces the draft; Undo gives back the typed command.
    await strip.getByRole("button", { name: "Redo" }).click();
    await expect(strip).toHaveAttribute("data-impersonate-draft", "ready");
    await expect(box).toHaveValue(DRAFTS[1]!);
    expect(model.calls()).toBe(2);
    await strip.getByRole("button", { name: "Undo" }).click();
    await expect(strip).toHaveCount(0);
    await expect(box).toHaveValue("/impersonate wave at Alice");
    expect(await messageCount()).toBe(1);

    // A draft that fails before writing anything gives the box back what it had.
    await box.fill("/impd FAILNOW");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(strip).toHaveCount(0);
    await expect(box).toHaveValue("/impd FAILNOW");
    expect(await messageCount()).toBe(1);

    // /impersonate_draft drafts again; the edited draft is what Send posts.
    await box.fill("/impd");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(strip).toHaveAttribute("data-impersonate-draft", "ready");
    await box.fill(`${DRAFTS[0]} Hello!`);
    await page.locator("button.mari-chat-send-btn").click();
    await expect(strip).toHaveCount(0);
    await expect(page.locator('[data-message-role="user"]').filter({ hasText: "Hello!" })).toBeVisible();
  } finally {
    for (const path of created) await request.delete(path).catch(() => undefined);
    model.server.close();
  }
});
