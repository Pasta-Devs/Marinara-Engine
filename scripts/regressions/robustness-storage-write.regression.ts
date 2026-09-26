// Storage write path, both settings opt-in: with STORAGE_SKIP_UNCHANGED_WRITES
// a flush that would rewrite a shard or the manifest with byte-identical
// content skips the disk (no tmp, fsync, rename or .bak refresh) while real
// changes still go through the crash-safe writer, and with
// STORAGE_YIELDING_SERIALIZE a large shard is serialized in slices that yield
// the event loop. With both unset (step 12) every flush writes as before and
// never yields.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
// Steps 1 to 11 test the opt-in behaviour; step 12 turns both off again.
process.env.STORAGE_SKIP_UNCHANGED_WRITES = "true";
process.env.STORAGE_YIELDING_SERIALIZE = "true";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-storage-write-"));
process.env.FILE_STORAGE_DIR = storageDir;

const { createFileNativeDB, encodeShardKey, storageSerializationForTests } =
  await import("../../packages/server/src/db/file-backed-store.js");
const { chats, messages, appSettings, memoryChunks } = await import("../../packages/server/src/db/schema/index.js");
const { serializeTableRows, serializeTableRowsYielding } = storageSerializationForTests;
const { eq } = await import("../../packages/server/src/db/file-query.js");

const CHAT = "fixture-chat";
const BIG_CHAT = "fixture-big-chat";
const shardPath = (chatId: string) => join(storageDir, "tables", "messages", `${encodeShardKey(chatId)}.json`);
const manifestFile = join(storageDir, "manifest.json");
const mtime = (path: string) => statSync(path).mtimeMs;

const written: string[] = [];
const skipped: string[] = [];
let failNextWriteOf: string | null = null;
let turnsAtBigShardHook: number | null = null;
let eventLoopTurns = 0;

// performance.now drives the serializer's yield budget. "advancing" makes
// every slice look over budget (yield after each row), "frozen" makes no
// slice ever reach it (never yields): a positive and a negative control for
// the same code path, independent of machine speed.
function withClock<T>(mode: "advancing" | "frozen", run: () => Promise<T>): Promise<T> {
  let fake = 0;
  Object.defineProperty(performance, "now", {
    configurable: true,
    writable: true,
    value: mode === "advancing" ? () => (fake += 50) : () => 0,
  });
  return run().finally(() => {
    delete (performance as unknown as { now?: unknown }).now;
  });
}
// Counts event-loop turns (setImmediate hops) from now until the returned stop().
function countTurns() {
  let running = true;
  eventLoopTurns = 0;
  const tick = () => {
    if (!running) return;
    eventLoopTurns++;
    setImmediate(tick);
  };
  setImmediate(tick);
  return () => {
    running = false;
  };
}

try {
  // 0. Unit: the yielding serializer is byte-identical to serializeTableRows,
  //    including the packed-vector unpack and JSON's null for unserializable
  //    elements, and its fingerprint is length plus sha1 of that text.
  const vectorRows = [
    { id: "v1", chatId: "c", embedding: new Float64Array([0.25, -1.5, 3]), content: "a" },
    { id: "v2", chatId: "c", embedding: null, content: 'b   "quoted"' },
    { toJSON: () => undefined },
    { id: "v3", nested: { list: [1, "two", null] }, embedding: "[1,2]" },
  ] as never[];
  const expectedVector = serializeTableRows("memory_chunks", vectorRows);
  assert.match(expectedVector, /"embedding":"\[0\.25,-1\.5,3\]"/, "reference unpacks the Float64Array to a string");
  assert.ok(expectedVector.includes(",null,"), "reference renders the toJSON-undefined row as null");
  const yieldedVector = await serializeTableRowsYielding("memory_chunks", vectorRows);
  assert.equal(yieldedVector.text, expectedVector, "yielding serializer must match serializeTableRows (vector table)");
  assert.equal(
    yieldedVector.fingerprint,
    `${expectedVector.length}:${createHash("sha1").update(expectedVector).digest("hex")}`,
  );
  assert.ok(
    (vectorRows[0] as unknown as { embedding: unknown }).embedding instanceof Float64Array,
    "the stored row must not be mutated by the unpack",
  );
  assert.equal((await serializeTableRowsYielding("messages", [] as never[])).text, "[]");
  const plainRows = Array.from({ length: 40 }, (_, index) => ({ id: `p${index}`, content: "x".repeat(index) }));
  const expectedPlain = serializeTableRows("messages", plainRows as never[]);
  // Unit yield controls: an advancing clock yields between rows, a frozen one never does.
  let stop = countTurns();
  const advancing = await withClock("advancing", () => serializeTableRowsYielding("messages", plainRows as never[]));
  stop();
  assert.equal(advancing.text, expectedPlain, "output must not change when slices yield");
  assert.ok(eventLoopTurns >= plainRows.length - 1, `advancing clock must yield per row (saw ${eventLoopTurns} turns)`);
  stop = countTurns();
  const frozen = await withClock("frozen", () => serializeTableRowsYielding("messages", plainRows as never[]));
  stop();
  assert.equal(frozen.text, expectedPlain);
  assert.equal(eventLoopTurns, 0, "frozen clock must never yield");

  const db = await createFileNativeDB({
    beforeTableWrite: (table) => {
      if (failNextWriteOf && table === failNextWriteOf) {
        failNextWriteOf = null;
        throw new Error("injected write failure");
      }
      if (table === `messages/${encodeShardKey(BIG_CHAT)}` && turnsAtBigShardHook === null) {
        turnsAtBigShardHook = eventLoopTurns;
      }
      written.push(table);
    },
    onTableWriteSkipped: (table) => {
      skipped.push(table);
    },
  });
  const store = db._fileStore;
  const shardLabel = `messages/${encodeShardKey(CHAT)}`;
  const reset = () => {
    written.length = 0;
    skipped.length = 0;
  };

  await db.insert(chats).values({
    id: CHAT,
    name: "Fixture",
    mode: "roleplay",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as never);
  await db.insert(messages).values([
    { id: "m1", chatId: CHAT, role: "user", content: "hello", extra: "{}", createdAt: "2026-01-01T00:00:01.000Z" },
    {
      id: "m2",
      chatId: CHAT,
      role: "assistant",
      content: "hi there",
      extra: "{}",
      createdAt: "2026-01-01T00:00:02.000Z",
    },
  ] as never);
  await db.insert(appSettings).values({ key: "fixture-setting", value: "one", updatedAt: "2026-01-01" } as never);
  await store.flush(true);

  // 1. First write lands and is exactly serializeTableRows of the stored rows.
  const first = readFileSync(shardPath(CHAT), "utf8");
  assert.equal(
    first,
    serializeTableRows("messages", JSON.parse(first) as never[]),
    "shard file must be byte-identical to serializeTableRows",
  );
  assert.deepEqual(
    (JSON.parse(first) as Array<{ id: string }>).map((row) => row.id),
    ["m1", "m2"],
  );
  // A vector table's packed embedding reaches disk as its original string.
  await db.insert(memoryChunks).values({
    id: "chunk-1",
    chatId: CHAT,
    content: "chunk",
    embedding: "[0.5,0.25]",
    messageCount: 2,
    firstMessageAt: "2026-01-01T00:00:01.000Z",
    lastMessageAt: "2026-01-01T00:00:02.000Z",
    createdAt: "2026-01-01T00:00:03.000Z",
  } as never);
  await store.flush(true);
  const chunkFile = readFileSync(join(storageDir, "tables", "memory_chunks", `${encodeShardKey(CHAT)}.json`), "utf8");
  assert.match(chunkFile, /"embedding":"\[0\.5,0\.25\]"/, "vector column must be written as its string form");
  const shardMtime = mtime(shardPath(CHAT));
  const manifestMtime = mtime(manifestFile);

  // 2. An update that sets the same values dirties the shard but must not
  //    rewrite it, nor refresh its .bak, nor touch the manifest.
  reset();
  await db.update(messages).set({ content: "hi there" }).where(eq(messages.id, "m2"));
  await store.flush();
  assert.ok(skipped.includes(shardLabel), "identical shard content must be skipped");
  assert.equal(mtime(shardPath(CHAT)), shardMtime, "skipped shard must keep its mtime");
  assert.equal(existsSync(`${shardPath(CHAT)}.bak`), false, "a skipped write must not create or refresh a .bak");
  assert.equal(mtime(manifestFile), manifestMtime, "manifest with unchanged counts must not be rewritten");

  // 3. A bare re-mark (no row change at all) is skipped too.
  reset();
  store.markShardDirty!("messages", [CHAT]);
  await store.flush();
  assert.deepEqual(
    written.filter((label) => label === shardLabel),
    [shardLabel],
    "hook still runs before a skip",
  );
  assert.ok(skipped.includes(shardLabel));
  assert.equal(mtime(shardPath(CHAT)), shardMtime);

  // 4. A real change goes through the crash-safe writer: new primary, and the
  //    .bak holds the previous durable content.
  reset();
  await db.update(messages).set({ content: "changed" }).where(eq(messages.id, "m2"));
  await store.flush();
  assert.equal(skipped.includes(shardLabel), false, "changed content must be written");
  const second = readFileSync(shardPath(CHAT), "utf8");
  assert.match(second, /"changed"/);
  assert.equal(readFileSync(`${shardPath(CHAT)}.bak`, "utf8"), first, ".bak must hold the previous content");

  // 5. A file removed behind the store's back is never vouched for: the next
  //    identical flush writes it again.
  unlinkSync(shardPath(CHAT));
  reset();
  store.markShardDirty!("messages", [CHAT]);
  await store.flush();
  assert.equal(skipped.includes(shardLabel), false, "missing file must be rewritten");
  assert.equal(readFileSync(shardPath(CHAT), "utf8"), second);

  // 6. A file edited behind the store's back (different size) is rewritten.
  writeFileSync(shardPath(CHAT), "[]");
  reset();
  store.markShardDirty!("messages", [CHAT]);
  await store.flush();
  assert.equal(skipped.includes(shardLabel), false, "externally edited file must be rewritten");
  assert.equal(readFileSync(shardPath(CHAT), "utf8"), second);

  // 7. A failed write keeps the dirty mark and retries; the on-disk content
  //    stays the last durable write until the retry lands.
  failNextWriteOf = shardLabel;
  await db.update(messages).set({ content: "after failure" }).where(eq(messages.id, "m2"));
  await assert.rejects(store.flush(), /injected write failure/);
  assert.equal(readFileSync(shardPath(CHAT), "utf8"), second, "failed write must leave the old durable file");
  reset();
  await store.flush();
  assert.match(readFileSync(shardPath(CHAT), "utf8"), /"after failure"/, "retry must persist the change");
  assert.equal(skipped.includes(shardLabel), false);

  // 8. Every built-in table is sharded (app_settings included) and follows
  //    the same rule; the manifest is rewritten only when counts change.
  reset();
  await db.update(appSettings).set({ value: "one" }).where(eq(appSettings.key, "fixture-setting"));
  await store.flush();
  const settingsWrites = written.filter((label) => label.startsWith("app_settings"));
  assert.ok(settingsWrites.length >= 1, "the app_settings shard must reach the write path");
  assert.deepEqual(
    skipped.filter((label) => label.startsWith("app_settings")),
    settingsWrites,
    "identical app_settings content must be skipped",
  );
  reset();
  await db.update(appSettings).set({ value: "two" }).where(eq(appSettings.key, "fixture-setting"));
  await store.flush();
  assert.ok(
    written.some((label) => label.startsWith("app_settings")),
    "changed setting reaches the write path",
  );
  assert.equal(
    skipped.some((label) => label.startsWith("app_settings")),
    false,
    "changed setting must be written",
  );
  const manifestBefore = mtime(manifestFile);
  const manifestTextBefore = readFileSync(manifestFile, "utf8");
  await db.insert(messages).values({
    id: "m3",
    chatId: CHAT,
    role: "user",
    content: "third",
    extra: "{}",
    createdAt: "2026-01-01T00:00:03.000Z",
  } as never);
  await store.flush();
  const manifestText = readFileSync(manifestFile, "utf8");
  const manifest = JSON.parse(manifestText) as { tables: Record<string, number> };
  assert.equal(manifest.tables.messages, 3, "manifest must be rewritten when counts change");
  assert.notEqual(manifestText, manifestTextBefore);
  assert.notEqual(mtime(manifestFile), manifestBefore, "manifest file must really be replaced");

  // 9. A shard flush yields the event loop between serializer slices. The
  //    big chat's chats row is flushed first, so its messages shard is the
  //    ONLY file in each measured flush and no other file I/O can let the
  //    loop turn before the write hook. The frozen-clock control proves it:
  //    with the budget never reached, zero turns happen before the hook.
  await db.insert(chats).values({
    id: BIG_CHAT,
    name: "Big fixture",
    mode: "roleplay",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as never);
  const body = "The caravan rolls on through the valley while the rain keeps falling. ".repeat(4);
  const bigRows = [];
  for (let index = 0; index < 300; index++) {
    bigRows.push({
      id: `big-${String(index).padStart(5, "0")}`,
      chatId: BIG_CHAT,
      role: index % 2 ? "assistant" : "user",
      content: body,
      extra: "{}",
      createdAt: `2026-01-02T00:00:00.${String(index).padStart(5, "0")}Z`,
    });
  }
  await db.insert(messages).values(bigRows as never);
  await store.flush(true);
  const bigBefore = readFileSync(shardPath(BIG_CHAT), "utf8");
  assert.equal((JSON.parse(bigBefore) as unknown[]).length, 300);

  const measure = async (mode: "advancing" | "frozen") => {
    turnsAtBigShardHook = null;
    store.markShardDirty!("messages", [BIG_CHAT]);
    const stopTurns = countTurns();
    await withClock(mode, () => store.flush());
    stopTurns();
    return turnsAtBigShardHook as number | null;
  };
  const frozenTurns = await measure("frozen");
  assert.equal(frozenTurns, 0, "negative control: without a yield no event-loop turn precedes the write hook");
  const advancingTurns = await measure("advancing");
  assert.ok(
    advancingTurns !== null && advancingTurns >= 100,
    `the serializer must yield between slices (saw ${advancingTurns} turns before the hook)`,
  );
  assert.equal(readFileSync(shardPath(BIG_CHAT), "utf8"), bigBefore, "yielding must not change the shard bytes");

  await store.close();

  // 10. A reload sees exactly what was flushed.
  const reopened = await createFileNativeDB();
  const rows = await reopened.select().from(messages).where(eq(messages.chatId, CHAT));
  assert.deepEqual(
    (rows as Array<{ id: string; content: string }>).map((row) => [row.id, row.content]),
    [
      ["m1", "hello"],
      ["m2", "after failure"],
      ["m3", "third"],
    ],
  );
  await reopened._fileStore.close();

  // 11. A primary recovered from its .bak at load is rewritten, never skipped,
  //     and the repair does not copy the corrupt primary over the .bak.
  const bakBefore = readFileSync(`${shardPath(CHAT)}.bak`, "utf8");
  writeFileSync(shardPath(CHAT), "{ not json");
  const recoveredSkips: string[] = [];
  const recovered = await createFileNativeDB({ onTableWriteSkipped: (table) => recoveredSkips.push(table) });
  const recoveredRows = await recovered.select().from(messages).where(eq(messages.chatId, CHAT));
  const bakIds = (JSON.parse(bakBefore) as Array<{ id: string }>).map((row) => row.id);
  assert.deepEqual(
    (recoveredRows as Array<{ id: string }>).map((row) => row.id),
    bakIds,
    "rows come back from the .bak",
  );
  await recovered._fileStore.flush();
  assert.equal(recoveredSkips.includes(shardLabel), false, "a recovered path is never skipped");
  assert.deepEqual(
    (JSON.parse(readFileSync(shardPath(CHAT), "utf8")) as Array<{ id: string }>).map((row) => row.id),
    bakIds,
    "the corrupt primary is repaired from memory",
  );
  assert.equal(readFileSync(`${shardPath(CHAT)}.bak`, "utf8"), bakBefore, "the .bak stays the recovery source");
  await recovered._fileStore.close();

  // 12. Default (both settings unset): an identical re-mark is written again
  //     exactly as before, and a shard flush never yields, even with a clock
  //     that would make every slice run over budget.
  delete process.env.STORAGE_SKIP_UNCHANGED_WRITES;
  delete process.env.STORAGE_YIELDING_SERIALIZE;
  const plainWrites: string[] = [];
  const plainSkips: string[] = [];
  let plainTurnsAtBigHook: number | null = null;
  const plain = await createFileNativeDB({
    beforeTableWrite: (table) => {
      if (table === `messages/${encodeShardKey(BIG_CHAT)}` && plainTurnsAtBigHook === null) {
        plainTurnsAtBigHook = eventLoopTurns;
      }
      plainWrites.push(table);
    },
    onTableWriteSkipped: (table) => plainSkips.push(table),
  });
  await plain.select().from(messages).where(eq(messages.chatId, CHAT));
  await plain._fileStore.flush(true);
  const plainMtime = mtime(shardPath(CHAT));
  const plainBytes = readFileSync(shardPath(CHAT), "utf8");
  await new Promise((resolve) => setTimeout(resolve, 20));
  plainWrites.length = 0;
  plain._fileStore.markShardDirty!("messages", [CHAT]);
  await plain._fileStore.flush();
  assert.ok(plainWrites.includes(shardLabel), "default: the re-marked shard reaches the writer");
  assert.deepEqual(plainSkips, [], "default: nothing is ever skipped");
  assert.notEqual(mtime(shardPath(CHAT)), plainMtime, "default: the identical shard is rewritten on disk");
  assert.equal(readFileSync(shardPath(CHAT), "utf8"), plainBytes);
  await plain.select().from(messages).where(eq(messages.chatId, BIG_CHAT));
  plain._fileStore.markShardDirty!("messages", [BIG_CHAT]);
  const stopPlain = countTurns();
  await withClock("advancing", () => plain._fileStore.flush());
  stopPlain();
  assert.equal(plainTurnsAtBigHook, 0, "default: the serializer never yields before the write");
  assert.equal(readFileSync(shardPath(BIG_CHAT), "utf8"), bigBefore);
  await plain._fileStore.close();

  console.info("Robustness storage-write regression passed.");
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}
