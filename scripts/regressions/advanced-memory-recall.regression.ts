import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-bounded-recall-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";
const calls: string[] = [];
let stallQuery = false;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    calls.push("embedding");
    if (stallQuery) return;
    response.end(JSON.stringify({ data: texts.map((_: string, index: number) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const classification = body.messages[0].content.startsWith("Identify scene transitions");
  calls.push(classification ? "classify" : "summary");
  const content = classification
    ? {
        starts: JSON.parse(body.messages[1].content)
          .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
          .map((message: { messageId: string }) => ({ messageId: message.messageId })),
      }
    : { summary: "SCENE_RECAP: The silver compass promise led the travelers through the mountain pass." };
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
    }),
  );
});
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS, normalizeAdvancedMemorySettings } =
  await import("../../packages/shared/dist/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Bounded recall fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 65_000,
    maxTokensOverride: 512,
    embeddingModel: "fixture-embedding",
  });
  const chat = await chats.create({
    name: "Five past scenes",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  assert(chat);
  await memory.updateSettings(chat.id, { enabled: true, retrieveMinMessages: 3, retrieveMaxMessages: 3 });
  assert.equal(DEFAULT_ADVANCED_MEMORY_SETTINGS.retrieveMaxScenes, 3);
  assert.equal(
    normalizeAdvancedMemorySettings({ enabled: true }).retrieveMaxScenes,
    3,
    "old settings gain the default",
  );
  await chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 65 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `${index % 12 === 0 ? "SCENE_CHANGE " : ""}The silver compass promise led the travelers through the mountain pass. Turn ${index + 1}.`,
      ...(index === 60 ? { extra: { isConversationStart: true } } : {}),
    })),
  );
  await memory.initialize(chat.id);
  const source = await chats.listMessages(chat.id);
  const input = { chatId: chat.id, messages: source, audienceCharacterIds: [], budgetTokens: 50_000 };
  const before = calls.length;
  const stages: string[] = [];
  const recalled = await memory.prepare({ ...input, onProgress: (job) => stages.push(job.stage) });
  assert.equal(
    recalled.receipt.recalledSceneIds.length,
    3,
    "the default caps distinct scenes, including matching excerpt chunks",
  );
  assert.equal(
    recalled.receipt.recalledMessageIds.length,
    9,
    "each scene contributes at most one three-message excerpt",
  );
  assert.deepEqual(
    calls.slice(before),
    ["embedding"],
    "ordinary recall only embeds its query, without archive preparation",
  );
  assert(!stages.includes("indexing") && !stages.includes("summarizing") && !stages.includes("classifying"));
  assert.equal(recalled.recalledScenes, null, "a paired scene summary is not separately injected again");
  assert.match(
    recalled.recalledMessages!,
    /Present message range in the context is: #61–#65, with the last user message being #65\./u,
  );
  assert.equal(recalled.recalledMessages!.match(/SCENE_RECAP/g)?.length, 3);
  assert.equal(recalled.recalledMessages!.match(/Excerpt:\nMessages #\d+–#\d+;/g)?.length, 3);
  for (const block of recalled.recalledMessages!.split("Scene summary:\n").slice(1)) {
    assert(block.indexOf("SCENE_RECAP") < block.indexOf("Excerpt:\n"), "each summary precedes its own excerpt");
    const range = /Excerpt:\nMessages #(\d+)–#(\d+);/u.exec(block)!;
    assert.equal(Number(range[2]) - Number(range[1]), 2, "one heading covers the complete contiguous excerpt");
    assert.equal(block.match(/^#\d+ /gm)?.length, 3);
  }
  await memory.validatePrepared(chat.id, source, recalled.receipt);
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 1 });
  const one = await memory.prepare({ ...input, readOnly: true });
  assert.equal(one.receipt.recalledSceneIds.length, 1);
  assert.equal(one.receipt.recalledMessageIds.length, 3);
  await assert.rejects(memory.validatePrepared(chat.id, source, recalled.receipt), /changed/u);
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 0 });
  const beforeOff = calls.length;
  const off = await memory.prepare(input);
  assert.deepEqual(off.receipt.recalledSceneIds, []);
  assert.deepEqual(off.receipt.recalledMessageIds, []);
  assert.equal(off.recalledMessages, null);
  assert.equal(off.recalledScenes, null);
  assert(off.chatSummary, "required continuity is independent of optional recall");
  assert.equal(calls.length, beforeOff, "disabled recall does not request a query embedding");

  await memory.updateSettings(chat.id, { retrieveMaxScenes: 50, retrieveMinMessages: 0, retrieveMaxMessages: 0 });
  const summaries = await memory.prepare({ ...input, readOnly: true });
  assert.equal(summaries.receipt.recalledSceneIds.length, 5, "a limit is a maximum, not a required count");
  assert.equal(summaries.recalledMessages, null);
  assert.equal(summaries.recalledScenes!.match(/SCENE_RECAP/g)?.length, 5);

  await memory.updateSettings(chat.id, { retrieveMaxScenes: 3, retrieveMinMessages: 3, retrieveMaxMessages: 3 });
  const appended = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "And what happened to that silver compass promise?",
  });
  assert(appended);
  const beforeAppend = calls.length;
  const next = await memory.prepare({ ...input, messages: await chats.listMessages(chat.id) });
  assert.deepEqual(calls.slice(beforeAppend), ["embedding"], "new live turns are not archived before generation");
  assert(next.messageIds.includes(appended.id));
  assert.match(next.recalledMessages!, /last user message being #66\./u);

  stallQuery = true;
  const started = Date.now();
  const fallback = await memory.prepare({ ...input, messages: await chats.listMessages(chat.id) });
  assert(Date.now() - started < 4000, "a stalled embedding provider cannot stall optional recall for minutes");
  assert(fallback.receipt.recalledSceneIds.length > 0, "bounded lexical recall survives a stalled embedding provider");
  process.stdout.write(
    "Advanced Memory scene limits, paired excerpts, current-turn context and bounded retrieval passed.\n",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
