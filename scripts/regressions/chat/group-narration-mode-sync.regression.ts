import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #6959: switching Merged Narrator and Individual must move the prompt identity and the
// context together, and Chat Settings must show the mode generation actually uses.
const dir = mkdtempSync(join(tmpdir(), "marinara-narration-mode-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, normalizeGroupChatMode } = await import("../../../packages/shared/dist/index.js");

const prompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const { messages } = JSON.parse(Buffer.concat(chunks).toString()) as { messages: Array<{ content: string }> };
  prompts.push(messages.map((message) => message.content).join("\n"));
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "A reply." }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Narration fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 32768,
    maxTokensOverride: 256,
  });
  assert(connection);
  const characters = createCharactersStorage(db);
  const joe = await characters.create(characterDataSchema.parse({ name: "Joe Smith", description: "JOE_CARD" }));
  const jane = await characters.create(characterDataSchema.parse({ name: "Jane Doe", description: "JANE_CARD" }));
  assert(joe && jane);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Narration fixture", parameters: { maxTokens: 256 }, wrapFormat: "xml" });
  assert(preset);
  await presets.createSection({ presetId: preset.id, identifier: "role", name: "Role", content: "You are {{char}}." });
  for (const type of ["character", "chat_history"]) {
    await presets.createSection({
      presetId: preset.id,
      identifier: type,
      name: type,
      isMarker: true,
      markerConfig: { type },
    });
  }
  const chat = await chats.create({
    name: "Narration proof",
    mode: "roleplay",
    characterIds: [joe.id, jane.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, enableMemoryRecall: false });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Hello, everyone." });

  const setMode = async (groupChatMode: unknown) => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/chats/${chat.id}/metadata`,
      payload: { groupChatMode },
    });
    assert.equal(response.statusCode, 200, response.body);
    return JSON.parse(response.body).metadata.groupChatMode;
  };
  const generate = async (extra: Record<string, unknown> = {}) => {
    const start = prompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    // The Smart order picker has its own hidden prompt; only replies carry an identity.
    return prompts.slice(start).filter((prompt) => !prompt.includes("hidden response orchestrator"));
  };
  const identity = (prompt: string) => prompt.match(/You are ([^.]+)\./u)?.[1];
  const turn = (prompt: string) => prompt.match(/Respond ONLY as ([^.]+)\./u)?.[1];
  const expectMode = (mode: string, replies: string[], label: string) => {
    assert(replies.length > 0, `${label}: a reply was generated`);
    if (mode === "merged") {
      assert.equal(replies.length, 1, `${label}: Merged writes one reply`);
      assert.equal(identity(replies[0]!), "Joe Smith", `${label}: Merged keeps the narrator identity`);
      assert.equal(turn(replies[0]!), undefined, `${label}: Merged has no single-speaker turn`);
      assert(
        replies[0]!.includes("JOE_CARD") && replies[0]!.includes("JANE_CARD"),
        `${label}: Merged context carries the whole cast`,
      );
      return;
    }
    for (const reply of replies) {
      assert(turn(reply), `${label}: Individual names the speaker`);
      assert.equal(identity(reply), turn(reply), `${label}: Individual identity matches its turn`);
    }
  };
  const lastReply = async () => (await chats.listMessages(chat.id)).filter((m: any) => m.role === "assistant").at(-1)!;

  // A new chat has no stored mode yet, which is Merged.
  expectMode("merged", await generate(), "new chat send");
  // Toggle back and forth through the real route. The latest reply was written under the
  // other mode, and every way of asking for a reply must still follow the selected one.
  for (const mode of ["individual", "merged", "individual", "merged"]) {
    assert.equal(await setMode(mode), mode);
    const previous = await lastReply();
    expectMode(mode, await generate({ continueMessageId: previous.id }), `${mode} continue`);
    expectMode(mode, await generate({ regenerateMessageId: previous.id }), `${mode} swipe`);
    expectMode(mode, await generate(), `${mode} send`);
  }

  // A malformed mode can no longer be saved, and one already stored reads the same everywhere.
  assert.equal(await setMode(1), "merged", "the metadata route stores a mode generation understands");
  for (const stored of [1, "Individual", "bogus", null]) {
    await chats.patchMetadata(chat.id, { groupChatMode: stored });
    const shown = normalizeGroupChatMode(stored);
    assert.equal(shown, "merged", `${String(stored)} reads as the default Merged mode`);
    expectMode(shown, await generate(), `stored ${String(stored)}`);
  }
  // The reported chat: a profile-applied Individual + Smart chat shows and generates Individual.
  const reported = { appliedChatPresetId: "deleted-profile", groupChatMode: "individual", groupResponseOrder: "smart" };
  await chats.patchMetadata(chat.id, reported);
  expectMode(normalizeGroupChatMode(reported.groupChatMode), await generate(), "reported chat");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Group narration mode sync regression passed.\n");
