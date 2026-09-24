import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";
const dir = mkdtempSync(join(tmpdir(), "marinara-hunt-b46-"));
process.env.FILE_STORAGE_DIR = dir;
process.env.DATA_DIR = dir;

const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { chats, memoryChunks, messages } = await import("../../packages/server/src/db/schema/index.js");
const { chunkAndEmbedMessages } = await import("../../packages/server/src/services/memory-recall.js");

// 1. The stale-chunk prune must not rescan every message for every chunk (O(n^2)).
const source = readFileSync(
  new URL("../../packages/server/src/services/memory-recall.ts", import.meta.url),
  "utf8",
);
const pruneBody = source.slice(
  source.indexOf("async function pruneStaleNativeMemoryChunks"),
  source.indexOf("async function pruneNativeMemoryChunksAfter"),
);
assert.ok(pruneBody.length > 0, "pruneStaleNativeMemoryChunks is present");
assert.doesNotMatch(pruneBody, /\.filter\(\(createdAt\)/u, "prune does not filter the message list per chunk");

// 2. Behaviour: valid chunks survive (including duplicate timestamps), stale ones are rebuilt.
const db = await createFileNativeDB();
const nameMap = { userName: "User", characterNames: {} };
let embedCalls = 0;
const options = {
  embeddingSource: {
    spaceId: "test:b46:plain-v1",
    label: "b46",
    async embed(texts: string[]) {
      embedCalls += texts.length;
      return texts.map(() => Array.from({ length: 8 }, () => 0.5));
    },
  },
};

async function nativeChunks() {
  const rows = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-b46"));
  return rows.sort((a, b) => a.firstMessageAt.localeCompare(b.firstMessageAt));
}

try {
  await db.insert(chats).values({ id: "chat-b46", name: "B46", mode: "conversation" });
  // Duplicate timestamps inside chunks (never straddling a chunk boundary).
  const times = [0, 1, 1, 2, 3, 4, 5, 5, 5, 6, 7, 8];
  for (let index = 0; index < times.length; index += 1) {
    await db.insert(messages).values({
      id: `m-${String(index).padStart(2, "0")}`,
      chatId: "chat-b46",
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Turn ${index}`,
      createdAt: `2026-09-01T10:00:${String(times[index]).padStart(2, "0")}.000Z`,
    });
  }

  await chunkAndEmbedMessages(db, "chat-b46", nameMap, options);
  const first = await nativeChunks();
  assert.ok(first.length >= 1, "chunking created native chunks");
  const firstIds = first.map((chunk) => chunk.id);
  const callsAfterFirst = embedCalls;

  await chunkAndEmbedMessages(db, "chat-b46", nameMap, options);
  const second = await nativeChunks();
  assert.deepEqual(
    second.map((chunk) => chunk.id),
    firstIds,
    "valid chunks (with duplicate timestamps) are kept by the prune",
  );
  assert.equal(embedCalls, callsAfterFirst, "no re-embedding when nothing changed");

  // Remove a message inside the last chunk: that chunk becomes stale and is pruned.
  const lastChunk = second.at(-1)!;
  const allRows = await db.select().from(messages).where(eq(messages.chatId, "chat-b46"));
  const victim = allRows
    .filter((row) => row.createdAt > lastChunk.firstMessageAt && row.createdAt < lastChunk.lastMessageAt)
    .concat(allRows.filter((row) => row.createdAt === lastChunk.lastMessageAt))[0]!;
  await db.delete(messages).where(eq(messages.id, victim.id));

  await chunkAndEmbedMessages(db, "chat-b46", nameMap, options);
  const third = await nativeChunks();
  assert.ok(!third.some((chunk) => chunk.id === lastChunk.id), "a chunk whose span lost a message is pruned");
  for (const chunk of second.slice(0, -1)) {
    assert.ok(
      third.some((row) => row.id === chunk.id),
      "earlier valid chunks survive when a later chunk goes stale",
    );
  }
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}

console.log("server-hunt-b46 regression checks passed.");
