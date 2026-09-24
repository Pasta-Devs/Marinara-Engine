// Regression batch 42:
// 1. Anthropic: top_k must be dropped whenever extended/adaptive thinking is enabled (API rejects the pair).
// 2. Chats storage: editing a message must clear stored geminiParts, which Gemini replays instead of content.
// 3. Grok CLI: stdout/stderr decode through a stateful decoder, and the scratch cwd is re-created when pruned.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "server-hunt-b42-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.LOG_LEVEL = "silent";

try {
  // ── 1. Anthropic top_k with thinking ──
  const { AnthropicProvider } = await import("../../packages/server/src/services/llm/providers/anthropic.provider.js");
  const bodies: Array<Record<string, any>> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "stop" } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const provider = new AnthropicProvider(`http://127.0.0.1:${address.port}`, "test");
  const history = [{ role: "user" as const, content: "Hello" }];
  const sendBody = async (model: string, enableThinking: boolean, viaChat: boolean) => {
    const before = bodies.length;
    const options = { model, stream: viaChat, enableThinking, reasoningEffort: "medium", topK: 40, temperature: 0.7, maxTokens: 2000 } as any;
    try {
      if (viaChat) {
        for await (const _ of provider.chat(history, options)) {
          // drain
        }
      } else {
        await provider.chatComplete(history, options);
      }
    } catch {
      // the stub server always answers 400; only the request body matters
    }
    assert.ok(bodies.length > before, "request was sent");
    return bodies.at(-1)!;
  };
  try {
    for (const viaChat of [false, true]) {
      const plain = await sendBody("claude-sonnet-4-20250514", false, viaChat);
      assert.equal(plain.top_k, 40, "top_k is still sent without thinking");
      for (const model of ["claude-sonnet-4-20250514", "claude-sonnet-4-5-20250929"]) {
        const body = await sendBody(model, true, viaChat);
        assert.ok(body.thinking, `${model} thinking enabled (${viaChat ? "chat" : "chatComplete"})`);
        assert.equal(body.top_k, undefined, `${model} drops top_k with thinking (${viaChat ? "chat" : "chatComplete"})`);
        assert.equal(body.temperature, undefined);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ── 2. geminiParts cleared on edit ──
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const db = await createFileNativeDB({});
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Gemini parts edit", mode: "roleplay", characterIds: [] } as Parameters<typeof chats.create>[0]);
  assert.ok(chat);
  const message = await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: null, content: "Old reply" } as any);
  assert.ok(message);
  const parts = [{ text: "Old reply", thoughtSignature: "sig" }];
  await chats.updateMessageExtra(message.id, { geminiParts: parts, keep: "yes" });
  const readExtra = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : (value ?? {})) as Record<string, any>;
  const seeded = await chats.getMessage(message.id);
  assert.deepEqual(readExtra(seeded?.extra).geminiParts, parts, "seeded geminiParts on the message");

  // Unchanged text keeps the stored parts (thought signature still valid).
  await chats.updateMessageContent(message.id, "Old reply");
  assert.deepEqual(readExtra((await chats.getMessage(message.id))?.extra).geminiParts, parts);

  await chats.updateMessageContent(message.id, "Edited reply");
  const edited = await chats.getMessage(message.id);
  assert.equal(edited?.content, "Edited reply");
  const editedExtra = readExtra(edited?.extra);
  assert.equal(editedExtra.geminiParts ?? null, null, "edit clears stale geminiParts on the message");
  assert.equal(editedExtra.keep, "yes", "other extra fields survive");
  const swipes = await chats.getSwipes(message.id);
  const active = swipes.find((s: any) => s.index === (edited?.activeSwipeIndex ?? 0));
  if (active) {
    assert.equal(active.content, "Edited reply");
    assert.equal(readExtra(active.extra).geminiParts ?? null, null, "edit clears stale geminiParts on the active swipe");
  }
  await db._fileStore.close();

  // ── 3. Grok CLI decoding and scratch dir (source assertions: spawning the real CLI is not possible here) ──
  const grokSource = readFileSync(
    new URL("../../packages/server/src/services/llm/providers/grok-subscription.provider.ts", import.meta.url),
    "utf8",
  );
  assert.match(grokSource, /child\.stdout\?\.setEncoding\("utf8"\)/);
  assert.match(grokSource, /child\.stderr\?\.setEncoding\("utf8"\)/);
  assert.doesNotMatch(grokSource, /chunk\.toString\("utf8"\)/, "no per-chunk decoding");
  assert.doesNotMatch(grokSource, /grokScratchDirPromise \?\?= mkdtemp/, "scratch dir is not cached forever");
  assert.match(grokSource, /isDirectory\(\)\) return dir;/, "cached scratch dir is re-validated");

  console.log("server-hunt-b42 regression passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
