// #5592 Phase 2: chat-scoped tables (messages, swipes, memory chunks, game
// tables, ...) no longer load at boot — each chat's shards enter memory as one
// unit on first touch and stay resident. These regressions drive the REAL
// store through the behaviors that must hold under partial residency:
//   - boot only DISCOVERS lazy shards; an untouched chat's file is never
//     parsed for healing, while first touch runs the full recovery pipeline,
//   - a chatId-scoped query loads exactly that unit (messages AND swipes
//     together), and an unbounded query leases the whole table,
//   - inserting into an unloaded chat loads the unit first, so the flush
//     rewrites the shard with the pre-existing rows intact (the data-loss
//     failure mode the unit design exists to prevent),
//   - deleting a chat cascades into units that were never read and removes
//     their shard files,
//   - a transaction that loads a unit mid-flight keeps those rows across
//     rollback while the rolled-back write reverts,
//   - the manifest reports the harvested messages total, not the resident
//     fraction, and omits the other lazy tables' counts.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, inArray } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB, encodeShardKey } from "../../packages/server/src/db/file-backed-store.js";
import { chats, gameStateSnapshots, memoryChunks, messages, messageSwipes } from "../../packages/server/src/db/schema/index.js";

if (process.env.MARINARA_EAGER_STORAGE === "1" || process.env.MARINARA_EAGER_STORAGE === "true") {
  // The kill switch restores eager boot loading; these regressions assert
  // lazy-only semantics (no boot healing, per-unit residency). The sharding
  // suite covers the eager path — run it with the same variable set.
  console.log("Lazy chat-unit regressions skipped: MARINARA_EAGER_STORAGE is set.");
  process.exit(0);
}

function tempStorageDir() {
  const dir = mkdtempSync(join(tmpdir(), "marinara-lazy-units-"));
  process.env.FILE_STORAGE_DIR = dir;
  return dir;
}

let seq = 0;
const messageRow = (id: string, chatId: string, content: string) => ({
  id,
  chatId,
  role: "user",
  content,
  createdAt: `2026-08-28T10:00:${String(seq++).padStart(2, "0")}.000Z`,
});
const swipeRow = (id: string, messageId: string, content: string) => ({ id, messageId, index: 0, content });
const chunkRow = (id: string, chatId: string, content: string) => ({
  id,
  chatId,
  content,
  messageCount: 1,
  createdAt: `2026-08-28T10:00:00.000Z`,
});
const chatRow = (id: string) => ({ id, name: id, mode: "conversation" });

const writeShard = (dir: string, table: string, key: string, rows: unknown[]) => {
  mkdirSync(join(dir, "tables", table), { recursive: true });
  writeFileSync(join(dir, "tables", table, `${encodeShardKey(key)}.json`), JSON.stringify(rows));
};
const readShard = (dir: string, table: string, key: string) =>
  JSON.parse(readFileSync(join(dir, "tables", table, `${encodeShardKey(key)}.json`), "utf8")) as Array<
    Record<string, unknown>
  >;
const shardExists = (dir: string, table: string, key: string) =>
  existsSync(join(dir, "tables", table, `${encodeShardKey(key)}.json`));

// ── Scoped queries load one unit; untouched units stay unparsed on disk ──

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  writeShard(dir, "messages", "chat-a", [messageRow("m-a1", "chat-a", "a one"), messageRow("m-a2", "chat-a", "a two")]);
  // chat-b's file carries a malformed row: eager loading would preserve and
  // heal it at boot; lazy loading must leave the file byte-identical until
  // chat-b is actually touched.
  const bRows = [messageRow("m-b1", "chat-b", "b one"), "malformed-not-a-row"];
  writeShard(dir, "messages", "chat-b", bRows);
  const bShardPath = join(dir, "tables", "messages", `${encodeShardKey("chat-b")}.json`);
  const bShardSource = readFileSync(bShardPath, "utf8");
  writeShard(dir, "message_swipes", "chat-a", [swipeRow("s-a1", "m-a1", "swipe a")]);
  writeShard(dir, "memory_chunks", "chat-b", [chunkRow("c-b1", "chat-b", "chunk b")]);
  const db = await createFileNativeDB();
  try {
    const aMessages = await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    assert.deepEqual(
      aMessages.map((row) => row.id),
      ["m-a1", "m-a2"],
      "a chatId-scoped query returns the unit's rows",
    );
    // Swipes load WITH the unit: a parent-mapped query needs no prior read.
    const aSwipes = await db
      .select()
      .from(messageSwipes)
      .where(inArray(messageSwipes.messageId, ["m-a1"]));
    assert.deepEqual(
      aSwipes.map((row) => row.id),
      ["s-a1"],
      "the unit's swipes are resident after the messages query",
    );
    assert.equal(db.count(messages, eq(messages.chatId, "chat-a")), 2, "count() sees the loaded unit");
    await db._fileStore.flush();
    // Raw-bytes comparison: a rewrite that preserved the parsed rows (e.g.
    // reserialization) would still prove the file was touched.
    assert.equal(
      readFileSync(bShardPath, "utf8"),
      bShardSource,
      "an untouched unit's file is byte-identical after another unit's load and flush — no boot healing",
    );
    // First touch of chat-b runs the recovery pipeline: the malformed row is
    // skipped, the source preserved, and the shard heals on the next flush.
    const bMessages = await db.select().from(messages).where(eq(messages.chatId, "chat-b"));
    assert.deepEqual(
      bMessages.map((row) => row.id),
      ["m-b1"],
      "first touch loads the unit and skips the malformed row",
    );
    await db._fileStore.flush();
    assert.deepEqual(
      readShard(dir, "messages", "chat-b").map((row) => row.id),
      ["m-b1"],
      "the malformed row is healed away on the first flush after the unit loads",
    );
    const chunks = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-b"));
    assert.deepEqual(
      chunks.map((row) => row.id),
      ["c-b1"],
      "every lazy table's shard for the unit is reachable",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Writing into an unloaded unit loads it first — no sibling data loss ──

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-c", [chatRow("chat-c")]);
  writeShard(dir, "messages", "chat-c", [
    messageRow("m-c1", "chat-c", "old one"),
    messageRow("m-c2", "chat-c", "old two"),
  ]);
  const db = await createFileNativeDB();
  try {
    // No read first: the insert itself must make the unit resident, or the
    // flush below would rewrite chat-c.json with ONLY the new row.
    await db.insert(messages).values(messageRow("m-c3", "chat-c", "new"));
    await db._fileStore.flush();
    assert.deepEqual(
      readShard(dir, "messages", "chat-c").map((row) => row.id),
      ["m-c1", "m-c2", "m-c3"],
      "the shard keeps its pre-existing rows after a cold insert",
    );
    // Same for update-by-scope on a cold unit.
    await db.update(messages).set({ content: "edited" }).where(eq(messages.id, "m-c1"));
    const edited = await db.select().from(messages).where(eq(messages.id, "m-c1"));
    assert.equal(edited[0]!.content, "edited", "a PK-addressed update reaches a row loaded via the messages index");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Unbounded queries lease the whole table ──

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  writeShard(dir, "messages", "chat-a", [messageRow("m-a1", "chat-a", "a")]);
  writeShard(dir, "messages", "chat-b", [messageRow("m-b1", "chat-b", "b")]);
  const db = await createFileNativeDB();
  try {
    const all = await db.select().from(messages);
    assert.deepEqual(
      all.map((row) => row.id).sort(),
      ["m-a1", "m-b1"],
      "a select with no WHERE returns every unit's rows",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Deleting a chat cascades into units that were never read ──

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-d", [chatRow("chat-d")]);
  writeShard(dir, "messages", "chat-d", [messageRow("m-d1", "chat-d", "doomed")]);
  writeShard(dir, "message_swipes", "chat-d", [swipeRow("s-d1", "m-d1", "doomed swipe")]);
  writeShard(dir, "memory_chunks", "chat-d", [chunkRow("c-d1", "chat-d", "doomed chunk")]);
  const db = await createFileNativeDB();
  try {
    await db.delete(chats).where(eq(chats.id, "chat-d"));
    await db._fileStore.flush();
    for (const table of ["messages", "message_swipes", "memory_chunks"]) {
      assert.equal(shardExists(dir, table, "chat-d"), false, `${table} shard files of a deleted chat are removed`);
    }
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A unit loaded mid-transaction survives rollback; the write does not ──

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-e", [chatRow("chat-e")]);
  writeShard(dir, "messages", "chat-e", [messageRow("m-e1", "chat-e", "original")]);
  const db = await createFileNativeDB();
  try {
    await assert.rejects(
      db.transaction(async (tx) => {
        // The update's scope hook loads chat-e INSIDE the transaction.
        await tx.update(messages).set({ content: "rolled back" }).where(eq(messages.chatId, "chat-e"));
        throw new Error("force rollback");
      }),
      /force rollback/,
    );
    const rows = await db.select().from(messages).where(eq(messages.chatId, "chat-e"));
    assert.equal(rows.length, 1, "the mid-transaction unit load survives the rollback");
    assert.equal(rows[0]!.content, "original", "the rolled-back write reverts");
    await db._fileStore.flush();
    assert.deepEqual(
      readShard(dir, "messages", "chat-e").map((row) => row.content),
      ["original"],
      "disk keeps the original row after rollback",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A unit loaded DURING a flush keeps its shard file until the next flush ──
// The stale-file cleanup pass unlinks shard files whose rows were re-homed.
// Its marks must be captured atomically with the dirty keys at flush start:
// reading the live map let a lazy unit load — running inside the flush's own
// awaited writes — add a mark whose paired dirty keys the flush never saw,
// and the cleanup then deleted the freshly loaded shard (and .bak) while its
// rows existed only in memory. Setup: two chats whose swipe files each hold
// one ORPHAN swipe (parent message gone), i.e. files the store re-homes into
// the unassigned shard — the exact state that creates stale marks.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-x", [chatRow("chat-x")]);
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "message_swipes", "chat-x", [swipeRow("s-x", "m-ghost-x", "orphan x")]);
  writeShard(dir, "message_swipes", "chat-a", [swipeRow("s-a", "m-ghost-a", "orphan a")]);
  let loadDuringFlush: (() => Promise<void>) | null = null;
  const db = await createFileNativeDB({
    beforeTableWrite: async (name: string) => {
      if (name.startsWith("message_swipes/") && loadDuringFlush) {
        const load = loadDuringFlush;
        loadDuringFlush = null;
        await load();
      }
    },
  });
  try {
    // First touch of chat-x re-homes its orphan swipe: stale mark + dirty
    // keys for the unassigned shard now exist BEFORE the flush.
    await db.select().from(messages).where(eq(messages.chatId, "chat-x"));
    // During that flush's swipe-shard write, chat-a loads mid-flight.
    loadDuringFlush = async () => {
      await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    };
    await db._fileStore.flush();
    assert.equal(
      shardExists(dir, "message_swipes", "chat-a"),
      true,
      "a shard loaded mid-flush is NOT unlinked by that flush — its rows exist only in memory until the next one",
    );
    // The deferred mark processes correctly on the next flush: the orphan
    // lands in the unassigned shard and the old file is then removed.
    await db._fileStore.flush();
    assert.equal(
      shardExists(dir, "message_swipes", "chat-a"),
      false,
      "the deferred stale file heals on the next flush",
    );
    assert.deepEqual(
      readShard(dir, "message_swipes", "orphaned-rows")
        .map((row) => row.id)
        .sort(),
      ["s-a", "s-x"],
      "both orphan swipes are on disk in the unassigned shard",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Every stray id in a file is tracked — canonical copies beat ALL stale strays ──
// A shard file can hold several rows belonging to another unit (interrupted
// re-home). Each stray id must be tracked individually: forgetting any of them
// makes the later canonical-file load treat its fresh copy as a duplicate and
// keep the stale stray as the persisted row.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  const canonical1 = messageRow("m-1", "chat-b", "canonical one");
  const canonical2 = messageRow("m-2", "chat-b", "canonical two");
  // chat-a's file holds its own row PLUS stale stray copies of BOTH chat-b rows.
  writeShard(dir, "messages", "chat-a", [
    messageRow("m-a", "chat-a", "a real"),
    { ...canonical1, content: "stale stray one" },
    { ...canonical2, content: "stale stray two" },
  ]);
  writeShard(dir, "messages", "chat-b", [canonical1, canonical2]);
  const db = await createFileNativeDB();
  try {
    // Touching chat-a merges the strays first, then pulls chat-b in
    // transitively — the canonical file's copies must replace EVERY stray.
    const aMessages = await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    assert.deepEqual(
      aMessages.map((row) => row.id),
      ["m-a"],
      "chat-a keeps only its own row once the strays re-home",
    );
    const bMessages = await db.select().from(messages).where(eq(messages.chatId, "chat-b"));
    assert.deepEqual(
      bMessages.map((row) => row.content).sort(),
      ["canonical one", "canonical two"],
      "the canonical shard's copies win over every stale stray copy from a multi-stray file",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A .bak recovered DURING a flush keeps its recovery source safe ──
// Loading a lazy shard whose primary is corrupt recovers the rows from .bak
// and marks the corrupt primary so the healing write does NOT refresh the
// backup from it. That mark must travel with the flush batch that writes the
// shard: if an in-flight flush (which never wrote the shard) destroyed it,
// the next flush would copy the still-corrupt primary over the only valid
// backup before writing — one failed write away from losing both sources.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  writeShard(dir, "chats", "chat-z", [chatRow("chat-z")]);
  const zPrimary = join(dir, "tables", "memory_chunks", `${encodeShardKey("chat-z")}.json`);
  mkdirSync(join(dir, "tables", "memory_chunks"), { recursive: true });
  const goodBak = JSON.stringify([chunkRow("c-z", "chat-z", "recovered chunk")]);
  writeFileSync(zPrimary, "{corrupt json");
  writeFileSync(`${zPrimary}.bak`, goodBak);
  let loadDuringFlush: (() => Promise<void>) | null = null;
  const db = await createFileNativeDB({
    beforeTableWrite: async (name: string) => {
      if (name.startsWith("messages/") && loadDuringFlush) {
        const load = loadDuringFlush;
        loadDuringFlush = null;
        await load();
      }
    },
  });
  try {
    await db.insert(messages).values(messageRow("m-b", "chat-b", "trigger"));
    // During the flush of that insert, chat-z loads: its chunk shard recovers
    // from .bak and marks the corrupt primary — in the LIVE set, which the
    // in-flight flush must not consume or destroy.
    loadDuringFlush = async () => {
      const recovered = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-z"));
      assert.deepEqual(
        recovered.map((row) => row.id),
        ["c-z"],
        "the corrupt shard recovers from .bak on unit load",
      );
    };
    await db._fileStore.flush();
    // The next flush writes the healed primary WITHOUT refreshing .bak from
    // the corrupt bytes still on disk.
    await db._fileStore.flush();
    const healed = JSON.parse(readFileSync(zPrimary, "utf8")) as Array<{ id: string }>;
    assert.deepEqual(
      healed.map((row) => row.id),
      ["c-z"],
      "the healing flush rewrites the primary from memory",
    );
    assert.equal(
      readFileSync(`${zPrimary}.bak`, "utf8"),
      goodBak,
      "the valid backup is never overwritten with the corrupt primary's bytes",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── dbName-form insert input still scopes to the right unit ──
// prepareInsertRow accepts database-name fields (chat_id); unit selection
// must see the NORMALIZED row, or the insert scopes to the unassigned unit,
// the duplicate scan misses the destination chat's on-disk rows, and a
// colliding id silently replaces the stored row instead of throwing.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-c", [chatRow("chat-c")]);
  writeShard(dir, "messages", "chat-c", [messageRow("m-c1", "chat-c", "original")]);
  const db = await createFileNativeDB();
  try {
    await assert.rejects(
      db.insert(messages).values({
        id: "m-c1",
        chat_id: "chat-c",
        role: "user",
        content: "impostor",
        createdAt: "2026-08-28T11:00:00.000Z",
      } as never),
      /unique|duplicate/i,
      "a duplicate id in dbName form hits the unit's on-disk rows and is rejected",
    );
    const rows = await db.select().from(messages).where(eq(messages.chatId, "chat-c"));
    assert.deepEqual(
      rows.map((row) => row.content),
      ["original"],
      "the stored row survives the rejected duplicate insert",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A duplicate message id in ANOTHER chat's unit is still rejected ──
// Primary-key uniqueness is table-wide, but the duplicate scan only sees
// resident rows. The complete harvest index names the unit that already owns
// an incoming id, and the insert must load it — otherwise an id-preserving
// import into a different chat silently persists the same id twice.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  writeShard(dir, "messages", "chat-a", [messageRow("m-dup", "chat-a", "the original")]);
  const db = await createFileNativeDB();
  try {
    await assert.rejects(
      db.insert(messages).values(messageRow("m-dup", "chat-b", "impostor in another chat")),
      /unique|duplicate/i,
      "an id owned by an unloaded unit is found via the harvest index and rejected",
    );
    const rows = await db.select().from(messages).where(eq(messages.id, "m-dup"));
    assert.deepEqual(
      rows.map((row) => row.content),
      ["the original"],
      "the owning chat's row survives untouched",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A row misfiled in ANOTHER unit's shard is reachable through its owner ──
// The eager loader saw misfiled rows because it read every file. Per-unit
// loading must consult the harvest's physical-location record, or a query
// scoped to the OWNING chat loads only that chat's own file and the misfiled
// row stays invisible until its host unit happens to load.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  // chat-b has NO file of its own; its only row sits inside chat-a's shard.
  writeShard(dir, "messages", "chat-a", [
    messageRow("m-a", "chat-a", "a's own row"),
    messageRow("m-b1", "chat-b", "b's misfiled row"),
  ]);
  const db = await createFileNativeDB();
  try {
    const bRows = await db.select().from(messages).where(eq(messages.chatId, "chat-b"));
    assert.deepEqual(
      bRows.map((row) => row.id),
      ["m-b1"],
      "the owning chat's scoped query finds its misfiled row",
    );
    await db._fileStore.flush();
    assert.deepEqual(
      readShard(dir, "messages", "chat-b").map((row) => row.id),
      ["m-b1"],
      "the misfiled row heals into its canonical shard on the next flush",
    );
    assert.deepEqual(
      readShard(dir, "messages", "chat-a").map((row) => row.id),
      ["m-a"],
      "the host file is rewritten without the stray",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A rollback keeps load-created healing marks paired with their dirty keys ──
// (#5606) A lazy unit load INSIDE a transaction creates healing marks: dirty
// keys for the rows' real shards plus a stale mark on the stray-holding file.
// Rollback restores the pre-transaction dirty maps — which would strand the
// stale mark alone, and the next flush would then rewrite the host file
// canonically while the stray rows' own shard is skipped as clean, erasing
// their only on-disk copy. The marks must be re-merged on rollback.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  // chat-a's file holds chat-b's ONLY copy of m-b2; chat-b's own file exists
  // (if it did not, the flush's recreate-if-missing rule would mask the bug).
  writeShard(dir, "messages", "chat-a", [
    messageRow("m-a1", "chat-a", "a's own row"),
    messageRow("m-b2", "chat-b", "b's only copy, misfiled"),
  ]);
  writeShard(dir, "messages", "chat-b", [messageRow("m-b1", "chat-b", "b's resident row")]);
  const db = await createFileNativeDB();
  try {
    await assert.rejects(
      db.transaction(async (tx) => {
        // The scope hook loads chat-a (and, transitively, chat-b) INSIDE the
        // transaction, creating the healing marks mid-tx.
        await tx.update(messages).set({ content: "rolled back" }).where(eq(messages.chatId, "chat-a"));
        throw new Error("force rollback");
      }),
      /force rollback/,
    );
    await db._fileStore.flush();
    assert.deepEqual(
      readShard(dir, "messages", "chat-b")
        .map((row) => row.id)
        .sort(),
      ["m-b1", "m-b2"],
      "the misfiled row's only copy is re-homed to its canonical shard, not erased by the healing rewrite",
    );
    assert.deepEqual(
      readShard(dir, "messages", "chat-a").map((row) => row.id),
      ["m-a1"],
      "the host file is rewritten canonically without the stray",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Set-null relations are copy-on-write and roll back cleanly ──
// (#5592 Phase 3) Resident row objects are immutable once installed:
// transaction snapshots are shallow (arrays of references), which is only a
// valid rollback state if no mutation ever writes INTO a row object. The
// set-null cascade was the last in-place mutator — a rollback across it must
// restore the child's foreign key, in memory and on disk.

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-sn", [chatRow("chat-sn")]);
  writeShard(dir, "spatial_context_snapshots", "chat-sn", [
    { id: "spatial-1", chatId: "chat-sn", messageId: "m-x", swipeIndex: 0, createdAt: "2026-08-28T10:00:00.000Z" },
  ]);
  writeShard(dir, "game_checkpoints", "chat-sn", [
    {
      id: "cp-1",
      chatId: "chat-sn",
      messageId: "m-x",
      spatialSnapshotId: "spatial-1",
      triggerType: "manual",
      createdAt: "2026-08-28T10:00:01.000Z",
    },
  ]);
  const db = await createFileNativeDB();
  try {
    const { spatialContextSnapshots, gameCheckpoints } = await import("../../packages/server/src/db/schema/index.js");
    await assert.rejects(
      db.transaction(async (tx) => {
        // Deleting the snapshot set-nulls the checkpoint's spatialSnapshotId.
        await tx.delete(spatialContextSnapshots).where(eq(spatialContextSnapshots.id, "spatial-1"));
        throw new Error("force rollback");
      }),
      /force rollback/,
    );
    const checkpoints = await db.select().from(gameCheckpoints).where(eq(gameCheckpoints.chatId, "chat-sn"));
    assert.equal(
      checkpoints[0]?.spatialSnapshotId,
      "spatial-1",
      "the rolled-back set-null leaves the child's foreign key intact in memory",
    );
    const snapshots = await db
      .select()
      .from(spatialContextSnapshots)
      .where(eq(spatialContextSnapshots.chatId, "chat-sn"));
    assert.equal(snapshots.length, 1, "the rolled-back delete leaves the parent row intact");
    await db._fileStore.flush();
    assert.equal(
      readShard(dir, "game_checkpoints", "chat-sn")[0]?.spatialSnapshotId,
      "spatial-1",
      "disk keeps the foreign key after the rollback",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Manifest: messages reports the harvested total; other lazy counts are omitted ──

{
  const dir = tempStorageDir();
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  writeShard(dir, "messages", "chat-a", [messageRow("m-a1", "chat-a", "a")]);
  writeShard(dir, "messages", "chat-b", [messageRow("m-b1", "chat-b", "b"), messageRow("m-b2", "chat-b", "bb")]);
  writeShard(dir, "memory_chunks", "chat-a", [chunkRow("c-a1", "chat-a", "chunk")]);
  const db = await createFileNativeDB();
  try {
    // Load only chat-a, then flush: the manifest must not report the resident
    // fraction as the table total.
    await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    await db._fileStore.flush(true);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
      tables: Record<string, number | undefined>;
    };
    assert.equal(manifest.tables.messages, 3, "messages reports the complete harvested count");
    assert.equal(
      Object.prototype.hasOwnProperty.call(manifest.tables, "memory_chunks"),
      false,
      "a partially resident lazy table has no manifest count",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ═══ Unit eviction (#5592 Phase 2 PR-B) ═══
// MARINARA_MAX_RESIDENT_CHATS caps resident units; past it, the LRU sweep at
// the tail of each successful flush drops the least-recently-touched CLEAN
// unit from memory (never from disk). The unassigned pseudo-unit is pinned.

const loadedUnitsOf = (db: Awaited<ReturnType<typeof createFileNativeDB>>) => db._fileStore.getResidentChatUnits();

// ── Cap enforcement, LRU order, and reload correctness ──

{
  const dir = tempStorageDir();
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
  for (const chat of ["chat-a", "chat-b", "chat-c"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
    writeShard(dir, "messages", chat, [messageRow(`m-${chat}`, chat, `content of ${chat}`)]);
  }
  writeShard(dir, "message_swipes", "chat-a", [swipeRow("s-a", "m-chat-a", "swipe of a")]);
  const db = await createFileNativeDB();
  try {
    for (const chat of ["chat-a", "chat-b", "chat-c"]) {
      await db.select().from(messages).where(eq(messages.chatId, chat));
    }
    await db._fileStore.flush();
    const loaded = loadedUnitsOf(db);
    assert.equal(loaded.has("chat-a"), false, "the least-recently-touched clean unit is evicted past the cap");
    assert.equal(loaded.has("chat-b"), true, "recently touched units stay resident");
    assert.equal(loaded.has("chat-c"), true, "the most recent unit stays resident");
    assert.equal(loaded.has("orphaned-rows"), true, "the unassigned pseudo-unit is pinned");
    const reloaded = await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    assert.deepEqual(
      reloaded.map((row) => row.content),
      ["content of chat-a"],
      "an evicted unit reloads from disk on the next touch",
    );
    const swipes = await db
      .select()
      .from(messageSwipes)
      .where(inArray(messageSwipes.messageId, ["m-chat-a"]));
    assert.deepEqual(
      swipes.map((row) => row.id),
      ["s-a"],
      "the reloaded unit brings its swipes back with it",
    );
  } finally {
    delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A chat CREATED this process survives an evict/reload round trip ──
// Discovery was boot-only before PR-B: a post-boot shard registered in
// knownShardFiles but not in the lazy discovery index, so an evicted
// fresh chat would have reloaded permanently empty.

{
  const dir = tempStorageDir();
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
  for (const chat of ["chat-x", "chat-y"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
    writeShard(dir, "messages", chat, [messageRow(`m-${chat}`, chat, chat)]);
  }
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values(chatRow("chat-new"));
    await db.insert(messages).values(messageRow("m-new-1", "chat-new", "fresh chat message"));
    await db._fileStore.flush();
    // Age chat-new below the cap, then sweep.
    await db.select().from(messages).where(eq(messages.chatId, "chat-x"));
    await db.select().from(messages).where(eq(messages.chatId, "chat-y"));
    await db._fileStore.flush();
    assert.equal(loadedUnitsOf(db).has("chat-new"), false, "the fresh chat is the LRU candidate and gets evicted");
    const rows = await db.select().from(messages).where(eq(messages.chatId, "chat-new"));
    assert.deepEqual(
      rows.map((row) => row.content),
      ["fresh chat message"],
      "a chat created after boot reloads from its post-boot shard file",
    );
  } finally {
    delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A unit with pending (unflushed) marks is never evicted ──

{
  const dir = tempStorageDir();
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
  for (const chat of ["chat-a", "chat-b", "chat-c"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
    writeShard(dir, "messages", chat, [messageRow(`m-${chat}`, chat, chat)]);
  }
  let injectDirty: (() => void) | null = null;
  const db = await createFileNativeDB({
    beforeTableWrite: async () => {
      if (injectDirty) {
        const inject = injectDirty;
        injectDirty = null;
        inject();
      }
    },
  });
  try {
    // Touch order makes chat-a the LRU candidate; the mid-flush mark lands in
    // the LIVE dirty map (the flush already captured its own batch), so the
    // post-flush sweep sees chat-a dirty and must skip it.
    for (const chat of ["chat-a", "chat-b", "chat-c"]) {
      await db.select().from(messages).where(eq(messages.chatId, chat));
    }
    await db.update(messages).set({ content: "touched b" }).where(eq(messages.chatId, "chat-b"));
    injectDirty = () => {
      db._fileStore.markShardDirty!("messages", ["chat-a"]);
    };
    await db._fileStore.flush();
    assert.equal(loadedUnitsOf(db).has("chat-a"), true, "a unit with a pending dirty mark survives the sweep");
    assert.equal(
      loadedUnitsOf(db).has("chat-c"),
      false,
      "the sweep passes over the dirty unit and evicts the next-oldest clean one instead",
    );
    // Flush the injected mark, bring the resident count back over the cap,
    // and confirm the now-clean unit is evictable.
    await db._fileStore.flush();
    await db.select().from(messages).where(eq(messages.chatId, "chat-c"));
    await db._fileStore.flush();
    assert.equal(loadedUnitsOf(db).has("chat-a"), false, "once the mark flushes, the unit becomes evictable");
  } finally {
    delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── In-session edits survive the evict/reload round trip ──

{
  const dir = tempStorageDir();
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
  for (const chat of ["chat-a", "chat-b", "chat-c"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
    writeShard(dir, "messages", chat, [messageRow(`m-${chat}`, chat, "original")]);
  }
  const db = await createFileNativeDB();
  try {
    await db.update(messages).set({ content: "edited before eviction" }).where(eq(messages.id, "m-chat-a"));
    await db._fileStore.flush();
    await db.select().from(messages).where(eq(messages.chatId, "chat-b"));
    await db.select().from(messages).where(eq(messages.chatId, "chat-c"));
    await db._fileStore.flush();
    assert.equal(loadedUnitsOf(db).has("chat-a"), false, "the edited chat was evicted after its edit flushed");
    const rows = await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    assert.deepEqual(
      rows.map((row) => row.content),
      ["edited before eviction"],
      "the flushed edit survives the evict/reload round trip",
    );
  } finally {
    delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Eviction is disabled by default ──

{
  const dir = tempStorageDir();
  delete process.env.MARINARA_MAX_RESIDENT_CHATS;
  for (const chat of ["chat-a", "chat-b", "chat-c", "chat-d"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
    writeShard(dir, "messages", chat, [messageRow(`m-${chat}`, chat, chat)]);
  }
  const db = await createFileNativeDB();
  try {
    for (const chat of ["chat-a", "chat-b", "chat-c", "chat-d"]) {
      await db.select().from(messages).where(eq(messages.chatId, chat));
    }
    await db._fileStore.flush();
    for (const chat of ["chat-a", "chat-b", "chat-c", "chat-d"]) {
      assert.equal(loadedUnitsOf(db).has(chat), true, `without a cap, ${chat} stays resident`);
    }
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Evict/reload keeps orderBy-less query results identical ──
// Resident order is (createdAt, id)-sorted at insert time as well as at
// load time, so a query without an explicit orderBy returns the same rows in
// the same order whether or not the unit was evicted in between. (Found by
// adversarial review: append-ordered inserts + reload's re-sort made a
// .limit/.find over an unordered swipe query return DIFFERENT rows with the
// cap on vs off.)

{
  const dir = tempStorageDir();
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
  for (const chat of ["chat-a", "chat-b", "chat-c"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
    writeShard(dir, "messages", chat, [messageRow(`m-${chat}`, chat, chat)]);
  }
  writeShard(dir, "message_swipes", "chat-a", [
    { id: "sw-stored", messageId: "m-chat-a", index: 0, content: "stored", createdAt: "2026-01-01T00:00:00.000Z" },
  ]);
  const db = await createFileNativeDB();
  try {
    await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    // A live swipe (fresh timestamp) and an imported swipe (null createdAt,
    // exactly what chat import writes) land in append order...
    await db.insert(messageSwipes).values({
      id: "sw-live",
      messageId: "m-chat-a",
      index: 1,
      content: "live",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    await db.insert(messageSwipes).values({ id: "sw-imported", messageId: "m-chat-a", index: 2, content: "imported" });
    const before = await db
      .select()
      .from(messageSwipes)
      .where(inArray(messageSwipes.messageId, ["m-chat-a"]));
    await db._fileStore.flush();
    await db.select().from(messages).where(eq(messages.chatId, "chat-b"));
    await db.select().from(messages).where(eq(messages.chatId, "chat-c"));
    await db._fileStore.flush();
    assert.equal(loadedUnitsOf(db).has("chat-a"), false, "chat-a was evicted between the two reads");
    const after = await db
      .select()
      .from(messageSwipes)
      .where(inArray(messageSwipes.messageId, ["m-chat-a"]));
    assert.deepEqual(
      after.map((row) => row.id),
      before.map((row) => row.id),
      "an orderBy-less query returns the identical sequence across an evict/reload round trip",
    );
  } finally {
    delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── One corrupt unit does not disable eviction for the rest of the install ──
// Units involved in corruption healing are pinned — but ONLY those units.
// (Found by adversarial review: pinning tested the accumulated table-wide
// stray set, so one misfiled row pinned every unit loaded afterwards and the
// cap silently stopped bounding memory on exactly the installs it targets.)

{
  const dir = tempStorageDir();
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
  for (const chat of ["chat-1", "chat-2", "chat-3", "chat-4", "chat-5"]) {
    writeShard(dir, "chats", chat, [chatRow(chat)]);
  }
  // chat-1's shard holds a stray row belonging to chat-2 (both get pinned);
  // chat-3 and chat-4 are perfectly healthy.
  writeShard(dir, "messages", "chat-1", [
    messageRow("m-1", "chat-1", "one"),
    messageRow("m-2-stray", "chat-2", "misfiled"),
  ]);
  writeShard(dir, "messages", "chat-3", [messageRow("m-3", "chat-3", "three")]);
  writeShard(dir, "messages", "chat-4", [messageRow("m-4", "chat-4", "four")]);
  writeShard(dir, "messages", "chat-5", [messageRow("m-5", "chat-5", "five")]);
  const db = await createFileNativeDB();
  try {
    await db.select().from(messages).where(eq(messages.chatId, "chat-1"));
    await db._fileStore.flush();
    await db.select().from(messages).where(eq(messages.chatId, "chat-3"));
    await db.select().from(messages).where(eq(messages.chatId, "chat-4"));
    await db.select().from(messages).where(eq(messages.chatId, "chat-5"));
    await db._fileStore.flush();
    const loaded = loadedUnitsOf(db);
    assert.equal(loaded.has("chat-1"), true, "the corrupt unit itself stays pinned");
    assert.equal(loaded.has("chat-3"), false, "healthy units loaded after the corrupt one are still evictable");
    assert.equal(loaded.has("chat-4"), true, "recent healthy units stay resident");
    assert.equal(loaded.has("chat-5"), true, "the most recent healthy unit stays resident");
  } finally {
    delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── #5611: chat-scoped game-state operations do not lease the whole table ──
// Before the residual-lease fixes, the hot tracker path (getByMessage inside
// updateByMessage, the create() dedupe delete, getCommittedForMessages) queried
// game_state_snapshots without a chatId conjunct. The store cannot scope those
// conditions, so the FIRST game-mode turn converted the table to permanently
// fully-resident — silently defeating MARINARA_MAX_RESIDENT_CHATS. This block
// drives the real storage layer through the same operations and asserts the
// table is never leased and the other chat's unit is never loaded; the final
// half runs a deliberately unscoped query to prove the lease tripwire (and the
// diagnostics accessor) still detect exactly what the old code used to do.

{
  const dir = tempStorageDir();
  const gameStateRow = (id: string, chatId: string, messageId: string, swipeIndex: number, committed: number) => ({
    id,
    chatId,
    messageId,
    swipeIndex,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    worldCustomFields: "[]",
    presentCharacters: "[]",
    recentEvents: "[]",
    playerStats: null,
    personaStats: null,
    manualOverrides: null,
    fieldLocks: null,
    hiddenTrackerFields: null,
    committed,
    createdAt: `2026-08-28T09:00:0${swipeIndex}.000Z`,
  });
  writeShard(dir, "chats", "chat-a", [chatRow("chat-a")]);
  writeShard(dir, "chats", "chat-b", [chatRow("chat-b")]);
  writeShard(dir, "game_state_snapshots", "chat-a", [gameStateRow("gs-a1", "chat-a", "m-a1", 0, 1)]);
  writeShard(dir, "game_state_snapshots", "chat-b", [gameStateRow("gs-b1", "chat-b", "m-b1", 0, 1)]);
  const db = await createFileNativeDB();
  const { createGameStateStorage } = await import(
    "../../packages/server/src/services/storage/game-state.storage.js"
  );
  const gameStateStore = createGameStateStorage(db as never);
  const leasedTables = () => db._fileStore.getFullyResidentLazyTables();
  try {
    const found = await gameStateStore.getByChatAndMessage("chat-a", "m-a1", 0);
    assert.equal(found?.id, "gs-a1", "the chat-scoped message lookup finds the snapshot");
    assert.equal(leasedTables().size, 0, "a chat-scoped message lookup does not lease any table");
    assert.equal(loadedUnitsOf(db).has("chat-b"), false, "the other chat's unit stays on disk");

    // The clone path exercises create()'s dedupe delete AND the re-read after insert.
    const cloned = await gameStateStore.updateByMessage("m-a2", 0, "chat-a", { location: "harbor" });
    assert.equal(cloned?.messageId, "m-a2", "updateByMessage clones a snapshot for the new anchor");
    assert.equal(leasedTables().size, 0, "the tracker write path (update + create dedupe) does not lease");

    const committed = await gameStateStore.getCommittedForMessages("chat-a", ["m-a1"]);
    assert.equal(committed.get("m-a1")?.id, "gs-a1", "the batch committed fetch finds the snapshot");
    assert.equal(leasedTables().size, 0, "the batch committed fetch does not lease");
    assert.equal(loadedUnitsOf(db).has("chat-b"), false, "chat-b is still untouched after the full hot path");

    // Inversion: the pre-fix condition shape (messageId with no chatId) MUST
    // still trip the lease — this pins the tripwire the fix is measured against.
    await db.select().from(gameStateSnapshots).where(eq(gameStateSnapshots.messageId, "m-b1"));
    assert.equal(
      leasedTables().has("game_state_snapshots"),
      true,
      "an unscoped messageId query still converts the table to fully resident",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("Lazy chat-unit regressions passed.");
