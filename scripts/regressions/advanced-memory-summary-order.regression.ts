import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-summary-order-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

let beforeSummaryResponse: (() => Promise<void>) | undefined;
const summaryRequests: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = JSON.stringify(body.messages);
  assert.match(prompt, /Aim for approximately/u, "Resume must call the real constant-summary compaction path");
  summaryRequests.push(prompt);
  const mutate = beforeSummaryResponse;
  beforeSummaryResponse = undefined;
  await mutate?.();
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "The early promise led through the middle journey to the late reunion.",
            }),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { createChatSummaryEntry, estimateChatSummaryTokens } = await import("../../packages/shared/src/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Summary order fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 65000,
  });
  const fixture = async (name: string, legacyTimestamps = false) => {
    const chat = await chats.create({
      name,
      mode: "roleplay",
      characterIds: ["maukie"],
      connectionId: connection.id,
    });
    assert(chat);
    await chats.createMessagesBatch(chat.id, [
      { role: "user", content: "The early promise." },
      { role: "assistant", characterId: "maukie", content: "The middle journey." },
      { role: "user", content: "The late reunion." },
      { role: "user", content: "The current scene.", extra: { isConversationStart: true } },
    ]);
    const messages = await chats.listMessages(chat.id);
    const entries = ["EARLY", "MIDDLE", "LATE"].map((marker, index) =>
      createChatSummaryEntry({
        id: `${name}-${marker}`,
        content: `${marker} remembered detail. `.repeat(150),
        enabled: true,
        origin: "manual",
        sourceMode: "range",
        messageIds: [messages[index]!.id],
        messageCount: 1,
        rangeStartIndex: index + 1,
        rangeEndIndex: index + 1,
      }),
    );
    assert(estimateChatSummaryTokens(entries[0]!.content) > 1024 * 0.7);
    const storageOrder = [entries[2]!, entries[0]!, entries[1]!];
    const stored = legacyTimestamps
      ? storageOrder.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...entry }) => entry)
      : storageOrder;
    await chats.patchMetadata(chat.id, {
      summaryEntries: stored,
      advancedMemory: { enabled: true, summaryBudgetTokens: 512 },
      advancedMemoryState: {
        status: "error",
        stage: "compacting",
        completed: 0,
        total: 1,
        error: "Chat Summaries changed while being combined; retry",
      },
    });
    return { chat, messages, entries, stored };
  };
  const readEntries = async (chatId: string) =>
    JSON.parse((await chats.getById(chatId))!.metadata).summaryEntries as Array<
      ReturnType<typeof createChatSummaryEntry>
    >;
  const assertCompacted = async (chatId: string, sourceIds: string[]) => {
    const saved = (await readEntries(chatId)) as Array<ReturnType<typeof createChatSummaryEntry>>;
    const enabled = saved.filter((entry) => entry.enabled);
    assert.equal(enabled.length, 1, "Resume saves one active replacement");
    assert.equal(enabled[0]!.origin, "automated");
    assert.equal(enabled[0]!.sourceMode, "range");
    assert.equal(enabled[0]!.messageCount, sourceIds.length);
    assert.deepEqual(enabled[0]!.messageIds, sourceIds, "replacement coverage follows message order");
    const messages = await chats.listMessages(chatId);
    assert.equal(enabled[0]!.rangeStartIndex, messages.findIndex((message) => message.id === sourceIds[0]) + 1);
    assert.equal(enabled[0]!.rangeEndIndex, messages.findIndex((message) => message.id === sourceIds.at(-1)) + 1);
    assert.equal((await memory.status(chatId)).job.status, "ready", "Resume leaves the stopped work unit");
    assert.equal((await memory.status(chatId)).job.error, null);
  };

  const ordered = await fixture("out-of-order");
  await memory.initialize(ordered.chat.id);
  assert.equal(summaryRequests.length, 1);
  const prompt = summaryRequests[0]!;
  assert(prompt.indexOf("EARLY") < prompt.indexOf("MIDDLE"));
  assert(prompt.indexOf("MIDDLE") < prompt.indexOf("LATE"), "the helper receives summaries in message order");
  await assertCompacted(
    ordered.chat.id,
    ordered.messages.slice(0, 3).map((message) => message.id),
  );
  const originals = (await readEntries(ordered.chat.id)).filter((entry) =>
    ordered.entries.some((original) => original.id === entry.id),
  );
  assert.deepEqual(
    originals.map(({ updatedAt: _updatedAt, ...entry }) => entry),
    ordered.stored.map(({ updatedAt: _updatedAt, ...entry }) => ({ ...entry, enabled: false })),
    "compaction keeps the original summaries and their stored order",
  );

  const legacy = await fixture("legacy-without-timestamps", true);
  await memory.initialize(legacy.chat.id);
  await assertCompacted(
    legacy.chat.id,
    legacy.messages.slice(0, 3).map((message) => message.id),
  );

  for (const change of ["edited", "missing", "policy"] as const) {
    const race = await fixture(change);
    let afterConcurrentChange = race.stored;
    beforeSummaryResponse = async () => {
      if (change === "edited")
        afterConcurrentChange = race.stored.map((entry) =>
          entry.id === race.entries[0]!.id ? { ...entry, content: `${entry.content} CORRECTED_BY_USER` } : entry,
        );
      if (change === "missing") afterConcurrentChange = race.stored.filter((entry) => entry.id !== race.entries[0]!.id);
      await chats.patchMetadata(race.chat.id, {
        summaryEntries: afterConcurrentChange,
        ...(change === "policy" ? { advancedMemory: { enabled: true, summaryBudgetTokens: 1024 } } : {}),
      });
    };
    await assert.rejects(
      memory.initialize(race.chat.id),
      /(?:Chat Summaries|Memory sources or summary corrections) changed.*retry/u,
      `${change} input must reject the stale helper result`,
    );
    assert.equal(beforeSummaryResponse, undefined, "the concurrent change happened during the helper request");
    assert.deepEqual(await readEntries(race.chat.id), afterConcurrentChange, "a rejected result changes no summaries");
    const stopped = (await memory.status(race.chat.id)).job;
    assert.equal(stopped.status, "error", "a real edit is reported instead of leaving a running work unit");
    assert.equal(stopped.stage, "compacting", "Resume retries the rejected compaction without a reset");
    assert.match(stopped.error ?? "", /(?:Chat Summaries|Memory sources or summary corrections) changed/u);
    await memory.initialize(race.chat.id);
    await assertCompacted(
      race.chat.id,
      race.messages.slice(change === "missing" ? 1 : 0, 3).map((message) => message.id),
    );
  }
  console.log("Advanced Memory compacts out-of-order ranged summaries, rejects concurrent changes, and resumes.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
