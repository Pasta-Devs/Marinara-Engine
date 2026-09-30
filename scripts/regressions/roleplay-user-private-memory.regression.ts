import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-user-private-memory-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "false";
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { messages, memoryChunks } = await import("../../packages/server/src/db/schema/index.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { chunkAndEmbedMessages, recallMemories } = await import("../../packages/server/src/services/memory-recall.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
const requests: Array<{ kind: string; text: string }> = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/systemone")) {
    requests.push({ kind: "decision", text: JSON.stringify(body.state) });
    response.end(
      JSON.stringify({
        answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: "noul", noul: 0.99 }])),
      }),
    );
  } else if (request.url?.endsWith("/embeddings")) {
    requests.push({ kind: "embedding", text: JSON.stringify(body.input) });
    response.end(
      JSON.stringify({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1, 0] })) }),
    );
  } else {
    requests.push({ kind: "summary", text: JSON.stringify(body.messages) });
    const classification = body.messages[0]?.content.startsWith("Identify scene transitions");
    const content = classification
      ? JSON.stringify({
          starts: JSON.parse(body.messages[1].content)
            .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
            .map((message: { messageId: string }) => ({ messageId: message.messageId })),
        })
      : '{"summary":"Public scene.","title":"Scene","audience":"all"}';
    response.end(
      JSON.stringify({
        choices: [
          {
            message: { role: "assistant", content },
            finish_reason: "stop",
          },
        ],
      }),
    );
  }
});
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Private memory proof",
    provider: "custom",
    model: "fixture",
    embeddingModel: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 32768,
  });
  assert(connection);
  const decision = await createConnectionsStorage(db).create({
    name: "Memory decisions",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: "fixture",
    apiKey: "",
    maxStateTokens: 30000,
  });
  assert(decision);
  const chatIds = new Map<string, string>();
  const raw = 'Public. [whisper: character="Bob" text="LEGACY_WHISPER_SECRET"] [notes: content="LEGACY_NOTE_SECRET"]';
  for (const mode of ["roleplay", "conversation", "game"] as const) {
    const chat = await chats.create({ name: mode, mode, characterIds: [], connectionId: connection.id });
    assert(chat);
    chatIds.set(mode, chat.id);
    await chats.patchMetadata(chat.id, {
      automaticSummaryEnabled: false,
      advancedMemory: { enabled: true },
    });
    // Bypass the new write normalizer to represent an existing pre-feature file.
    for (let index = 0; index < 5; index++) {
      await db.insert(messages).values({
        id: `${mode}-${index}`,
        chatId: chat.id,
        role: "user",
        content:
          index === 0
            ? raw
            : index === 1
              ? 'More public. [notes: content="UNFINISHED_SECRET'
              : `${index === 3 ? "SCENE_CHANGE " : ""}Public turn ${index}.`,
        extra: JSON.stringify(index === 3 ? { isConversationStart: true } : {}),
        createdAt: `2026-09-30T10:00:0${index}.000Z`,
      });
    }
    const original = await chats.listMessages(chat.id);
    const requestStart = requests.length;
    const summary = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/generate-summary`, payload: {} });
    assert.equal(summary.statusCode, 200, summary.body);
    const summaryText = requests.at(-1)!.text;
    assert(summaryText.includes("Public."));
    assert.equal(summaryText.includes("LEGACY_WHISPER_SECRET"), mode !== "roleplay");
    assert.equal(summaryText.includes("LEGACY_NOTE_SECRET"), mode !== "roleplay");
    assert.equal(summaryText.includes("UNFINISHED_SECRET"), mode !== "roleplay");

    const embedded: string[] = [];
    await chunkAndEmbedMessages(
      db,
      chat.id,
      { userName: "Mari", characterNames: {} },
      {
        embeddingSource: {
          spaceId: "test:private-memory",
          label: "fixture",
          async embed(texts) {
            embedded.push(...texts);
            return texts.map(() => [1, 0]);
          },
        },
      },
    );
    assert.equal(embedded.length, 1);
    assert.equal(embedded[0]!.includes("LEGACY_WHISPER_SECRET"), mode !== "roleplay");
    assert.equal(embedded[0]!.includes("LEGACY_NOTE_SECRET"), mode !== "roleplay");
    assert.equal(embedded[0]!.includes("UNFINISHED_SECRET"), mode !== "roleplay");
    const storedChunks = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, chat.id));
    assert.equal(storedChunks[0]?.content, embedded[0]);
    await db.update(memoryChunks).set({ content: raw }).where(eq(memoryChunks.id, storedChunks[0]!.id));
    const recall = await recallMemories(db, "Public", [chat.id], {
      embeddingSource: {
        spaceId: "test:private-memory",
        label: "fixture",
        embed: async (texts) => texts.map(() => [1, 0]),
      },
    });
    assert.equal(recall.length, 1);
    assert.equal(
      recall[0]!.content.includes("SECRET"),
      mode !== "roleplay",
      "pre-existing chunk text is projected on recall",
    );
    assert.equal(
      (await db.select().from(memoryChunks).where(eq(memoryChunks.id, storedChunks[0]!.id)))[0]!.content,
      raw,
    );

    if (mode === "roleplay") {
      const memory = createAdvancedMemoryService(db);
      const sceneCheck = await memory.getSceneCheck(chat.id, { force: true });
      assert(sceneCheck);
      assert(!JSON.stringify(sceneCheck.messages).includes("SECRET"), "scene classification sees only public text");
      await memory.initialize(chat.id);
      const status = await memory.status(chat.id);
      assert(
        status.records.some((record) => record.kind === "excerpt"),
        "real Advanced Memory excerpts were stored",
      );
      assert(!JSON.stringify(status.records).includes("SECRET"));
      assert(requests.slice(requestStart).some((request) => request.kind === "embedding"));
      assert(requests.slice(requestStart).every((request) => !request.text.includes("SECRET")));
      const savedExcerpt = status.records.find((record) => record.kind === "excerpt")!;
      await db.update(advancedMemoryRecords).set({ content: raw }).where(eq(advancedMemoryRecords.id, savedExcerpt.id));
      await memory.updateSettings(chat.id, { decisionEnabled: true, decisionConnectionId: decision.id });
      const decisionStart = requests.length;
      const prepared = await memory.prepare({
        chatId: chat.id,
        messages: original,
        audienceCharacterIds: [],
        budgetTokens: 16000,
      });
      await memory.validatePrepared(chat.id, original, prepared.receipt);
      assert(
        requests.slice(decisionStart).some((request) => request.kind === "decision"),
        "cached excerpt reaches the actual decision path",
      );
      assert(
        requests.slice(decisionStart).every((request) => !request.text.includes("SECRET")),
        "old cached excerpts are projected before decision prompts",
      );
      assert(!JSON.stringify(prepared).includes("SECRET"));
      assert.equal(
        (await memory.status(chat.id)).records.find((record) => record.id === savedExcerpt.id)?.content,
        raw,
        "archive source is preserved",
      );
    }
    assert.deepEqual(
      await chats.listMessages(chat.id),
      original,
      "model projections never mutate the owner’s saved source",
    );
  }
  const destination = chatIds.get("conversation")!;
  for (const [label, sourceChatId, keepsLiteral] of [
    ["roleplay", chatIds.get("roleplay")!, false],
    ["game", chatIds.get("game")!, true],
    ["missing", "deleted-source", false],
  ] as const) {
    await db
      .insert(memoryChunks)
      .values({
        id: `import-${label}`,
        chatId: destination,
        sourceChatId,
        content: raw,
        embedding: JSON.stringify([1, 0]),
        embeddingSpaceId: `test:import-${label}`,
        firstMessageAt: "2026-09-30T10:00:00.000Z",
        lastMessageAt: "2026-09-30T10:00:04.000Z",
        messageCount: 5,
      });
    const recalled = await recallMemories(db, "Public", [destination], {
      embeddingSource: { spaceId: `test:import-${label}`, label, embed: async (texts) => texts.map(() => [1, 0]) },
    });
    assert.equal(recalled.length, 1);
    assert.equal(
      recalled[0]!.content.includes("SECRET"),
      keepsLiteral,
      `imported ${label} uses source mode, with unknown sources failing closed`,
    );
  }
  console.log(
    "Legacy Roleplay private bodies stay out of manual summaries, Advanced Memory and native embeddings; other modes and stored source stay unchanged.",
  );
} finally {
  await app.close();
  await db._fileStore.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
}
