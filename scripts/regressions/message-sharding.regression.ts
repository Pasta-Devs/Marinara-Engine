// #4708: messages and message_swipes persist as one file per chat instead of
// a monolith that re-serialized every chat's history on every saved message.
// These regressions drive the REAL store through the lifecycle:
//   - fresh installs write shards, never a monolith,
//   - a flush after one chat's message touches ONLY that chat's files,
//   - the one-way migration (monolith -> shards) preserves every row, sends
//     orphan swipes to the reserved unassigned shard, renames the monolith
//     AND its .bak to .pre-shard (the automatic backup), and removes its
//     sentinel,
//   - a crashed migration retries from the untouched monolith,
//   - a downgrade-recreated monolith is quarantined, never merged,
//   - data written by a newer storage format refuses to load,
//   - transaction rollback restores shard dirtiness and the write-generation
//     contract stays keyed on the bare table name,
//   - deleting a chat removes its shard files instead of leaving litter,
//   - shard filenames are a security boundary against crafted chat ids.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, desc, eq, jsonFlagsNotTrue, ne, stringIsNonBlank } from "../../packages/server/src/db/file-query.js";
import {
  createFileNativeDB,
  encodeShardKey,
  FILE_BACKED_TABLES,
  getFileTableShardStrategy,
  SHARDED_TABLES,
  STORAGE_VERSION,
  StorageFormatTooNewError,
} from "../../packages/server/src/db/file-backed-store.js";
import {
  appSettings,
  characterCardVersions,
  characters,
  chats,
  gameCheckpoints,
  memoryChunks,
  messages,
  messageSwipes,
  lorebookEntries,
  lorebooks,
  oocInfluences,
  spatialContextSnapshots,
} from "../../packages/server/src/db/schema/index.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";

function tempStorageDir() {
  const dir = mkdtempSync(join(tmpdir(), "marinara-shards-"));
  process.env.FILE_STORAGE_DIR = dir;
  return dir;
}

let messageRowSeq = 0;
const messageRow = (id: string, chatId: string, content: string) => ({
  id,
  chatId,
  role: "user",
  content,
  // Monotonic, valid ISO timestamps: the shard loader sorts on createdAt,
  // so the fixture must produce a real chronological order.
  createdAt: `2026-08-08T10:00:${String(messageRowSeq++).padStart(2, "0")}.000Z`,
});

assert.deepEqual(SHARDED_TABLES, FILE_BACKED_TABLES, "every file-backed table must use the shard pipeline");
for (const table of FILE_BACKED_TABLES) {
  const strategy = getFileTableShardStrategy(table);
  assert.ok(strategy.column, `${table} declares a stable shard-key strategy`);
  assert.equal(
    getFileTableShardStrategy(table),
    strategy,
    `${table} reuses its validated shard strategy instead of recomputing it per row`,
  );
}

// Representative non-chat owners prove that the generic strategy writes and
// re-homes only the affected entity shard, without recreating a monolith.
{
  const dir = tempStorageDir();
  const writes: string[] = [];
  const db = await createFileNativeDB({ beforeTableWrite: (table) => void writes.push(table) });
  try {
    for (const id of ["character-a", "character-b"]) {
      await db.insert(characters).values({
        id,
        data: JSON.stringify({ name: id }),
        createdAt: "2026-08-08T10:00:00.000Z",
        updatedAt: "2026-08-08T10:00:00.000Z",
      });
    }
    await db.insert(characterCardVersions).values({
      id: "version-a",
      characterId: "character-a",
      data: JSON.stringify({ name: "character-a" }),
      createdAt: "2026-08-08T10:00:01.000Z",
    });
    await db.insert(lorebooks).values({
      id: "book-a",
      name: "World Lore",
      createdAt: "2026-08-08T10:00:02.000Z",
      updatedAt: "2026-08-08T10:00:02.000Z",
    });
    await db.insert(lorebookEntries).values({
      id: "entry-a",
      lorebookId: "book-a",
      name: "Magic",
      createdAt: "2026-08-08T10:00:03.000Z",
      updatedAt: "2026-08-08T10:00:03.000Z",
    });
    await db._fileStore.flush();

    assert.equal(existsSync(join(dir, "tables", "character_card_versions.json")), false);
    assert.equal(existsSync(join(dir, "tables", "lorebook_entries.json")), false);
    assert.ok(
      existsSync(join(dir, "tables", "character_card_versions", `${encodeShardKey("character-a")}.json`)),
      "card-version history groups under its character",
    );
    assert.ok(
      existsSync(join(dir, "tables", "lorebook_entries", `${encodeShardKey("book-a")}.json`)),
      "lorebook entries group under their lorebook",
    );

    writes.length = 0;
    await db
      .update(characterCardVersions)
      .set({ characterId: "character-b" })
      .where(eq(characterCardVersions.id, "version-a"));
    await db._fileStore.flush();
    assert.deepEqual(
      writes.filter((table) => table.startsWith("character_card_versions/")).sort(),
      [`character_card_versions/${encodeShardKey("character-b")}`],
      "moving a child writes only its new owner shard; the empty old shard is deleted below",
    );
    assert.equal(
      existsSync(join(dir, "tables", "character_card_versions", `${encodeShardKey("character-a")}.json`)),
      false,
      "the empty old-owner shard is removed",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Shard filename encoding is a security boundary ──

assert.equal(encodeShardKey("abc-def-123"), "abc-def-123", "lowercase ids stay readable");
assert.equal(encodeShardKey("abc_DEF"), "abc%5F%44%45%46", "underscores AND uppercase are encoded");
assert.notEqual(
  encodeShardKey("Chat-A"),
  encodeShardKey("chat-a"),
  "case-variant ids never share a filename — NTFS/APFS are case-insensitive and a collision silently clobbers a chat",
);
assert.ok(!encodeShardKey("../../../etc/passwd").includes("/"), "path separators never survive encoding");
assert.ok(!encodeShardKey("..\\..\\evil").includes("\\"), "backslashes never survive encoding");
assert.equal(
  encodeShardKey("orphaned-rows"),
  "orphaned-rows",
  "the orphan shard key encodes to itself (readable file)",
);
assert.match(encodeShardKey("x".repeat(500)), /^%h[0-9a-f]{32}$/, "overlong keys fall back to a hash form");
assert.match(encodeShardKey("con"), /^%h[0-9a-f]{32}$/, "Windows reserved basenames fall back to a hash form");
assert.equal(
  encodeShardKey("nanoid-Like_id"),
  "nanoid-%4Cike%5Fid",
  "nanoid-style ids encode to a stable, pinned filename",
);

// ── Fresh install: shards, never a monolith ──

{
  const dir = tempStorageDir();
  const writes: string[] = [];
  const db = await createFileNativeDB({ beforeTableWrite: (table) => void writes.push(table) });
  try {
    await db.insert(chats).values({ id: "chat-a", name: "A", mode: "conversation" });
    await db.insert(chats).values({ id: "chat-b", name: "B", mode: "conversation" });
    await db.insert(messages).values(messageRow("m-a1", "chat-a", "hello a"));
    await db.insert(messages).values(messageRow("m-b1", "chat-b", "hello b"));
    await db.insert(messageSwipes).values({ id: "s-a1", messageId: "m-a1", index: 0, content: "swipe" });
    await db._fileStore.flush();

    assert.equal(existsSync(join(dir, "tables", "messages.json")), false, "no messages monolith is ever created");
    const aShard = join(dir, "tables", "messages", `${encodeShardKey("chat-a")}.json`);
    const bShard = join(dir, "tables", "messages", `${encodeShardKey("chat-b")}.json`);
    assert.ok(existsSync(aShard) && existsSync(bShard), "each chat owns a message shard file");
    assert.equal(JSON.parse(readFileSync(aShard, "utf8"))[0].content, "hello a");
    const swipeShard = join(dir, "tables", "message_swipes", `${encodeShardKey("chat-a")}.json`);
    assert.ok(existsSync(swipeShard), "swipes shard beside their parent chat");
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.version, STORAGE_VERSION, "the manifest records the current storage format");
    assert.equal(manifest.tables.messages, 2, "logical row counts still cover sharded tables");
    assert.equal(manifest.shards.messages, 2, "shard diagnostics record the file count");

    // ── Flush granularity: one chat's message touches only its own files ──
    writes.length = 0;
    await db.insert(messages).values(messageRow("m-a2", "chat-a", "again a"));
    await db._fileStore.flush();
    const shardWrites = writes.filter((t) => t.startsWith("messages/"));
    assert.deepEqual(
      shardWrites,
      [`messages/${encodeShardKey("chat-a")}`],
      "a saved message rewrites ONLY that chat's shard — the #4708 core claim",
    );
    assert.ok(!writes.some((t) => t.includes(encodeShardKey("chat-b"))), "the other chat's files are untouched");

    // ── Write-generation contract stays keyed on the bare table name ──
    const genBefore = db._fileStore.getTableWriteGeneration("messages");
    await db.insert(messages).values(messageRow("m-a3", "chat-a", "gen"));
    assert.ok(
      db._fileStore.getTableWriteGeneration("messages") > genBefore,
      "shard writes bump the logical table generation (#4705 contract)",
    );

    // ── Rollback restores shard dirtiness and the shard index ──
    await db._fileStore.flush();
    writes.length = 0;
    await db
      .transaction(async (tx) => {
        await tx.insert(messages).values(messageRow("m-a4", "chat-a", "doomed"));
        throw new Error("force rollback");
      })
      .catch(() => {});
    await db._fileStore.flush();
    assert.equal(
      writes.filter((t) => t.startsWith("messages/")).length,
      0,
      "a rolled-back message leaves no shard dirty",
    );
    const rows = await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
    assert.equal(rows.length, 3, "rolled-back row is gone from memory too");

    // ── Chat delete removes the shard files entirely ──
    await db.delete(chats).where(eq(chats.id, "chat-b"));
    await db._fileStore.flush();
    assert.equal(existsSync(bShard), false, "a deleted chat's message shard is removed, not emptied");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Migration: monolith -> shards, rename set, orphan swipes ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  const monolith = [messageRow("m-1", "chat-x", "one"), messageRow("m-2", "chat-y", "two")];
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify(monolith));
  writeFileSync(join(dir, "tables", "messages.json.bak"), JSON.stringify(monolith));
  writeFileSync(
    join(dir, "tables", "message_swipes.json"),
    JSON.stringify([
      { id: "s-1", messageId: "m-1", index: 0, content: "swipe one" },
      { id: "s-orphan", messageId: "m-gone", index: 0, content: "orphan" },
    ]),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ version: 2, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
  );

  const db = await createFileNativeDB();
  try {
    const migrated = await db.select().from(messages);
    assert.equal(migrated.length, 2, "every monolith row survives the migration");
    assert.ok(
      existsSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`)),
      "per-chat shards exist after migration",
    );
    assert.ok(existsSync(join(dir, "tables", "messages.json.pre-shard")), "the monolith is renamed, not deleted");
    assert.ok(
      existsSync(join(dir, "tables", "messages.json.bak.pre-shard")),
      "the .bak is renamed too — a leftover .bak would let a downgraded build resurrect stale history",
    );
    assert.equal(existsSync(join(dir, "tables", "messages.json")), false, "no monolith remains under its old name");
    assert.equal(
      existsSync(join(dir, "tables", "messages", ".migrating")),
      false,
      "the migration sentinel is removed on success",
    );
    const orphanShard = join(dir, "tables", "message_swipes", "orphaned-rows.json");
    assert.ok(existsSync(orphanShard), "orphan swipes land in the reserved shard instead of vanishing");
    assert.equal(JSON.parse(readFileSync(orphanShard, "utf8"))[0].id, "s-orphan");
    const swipes = await db.select().from(messageSwipes);
    assert.equal(swipes.length, 2, "orphan swipes still load");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Restored profile: expected rows + no shards -> recover pre-shard backup ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "messages.json.pre-shard"),
    JSON.stringify([messageRow("m-restored", "chat-restored", "history survives reinstall")]),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: "2026-08-10T00:00:00.000Z",
      backend: "file-native",
      tables: { messages: 1 },
      shards: { messages: 1 },
    }),
  );

  const db = await createFileNativeDB();
  try {
    const restored = await db.select().from(messages);
    assert.equal(restored.length, 1, "an expected history is recovered when every message shard is absent");
    assert.equal(restored[0]!.content, "history survives reinstall");
    assert.ok(
      existsSync(join(dir, "tables", "messages.json.pre-shard")),
      "the preserved source remains available after recovery",
    );
    assert.ok(
      existsSync(join(dir, "tables", "messages", `${encodeShardKey("chat-restored")}.json`)),
      "recovered history is written back into the current shard layout",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// An intentionally empty current manifest must not resurrect stale history.
{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "messages.json.pre-shard"),
    JSON.stringify([messageRow("m-deleted", "chat-deleted", "must stay deleted")]),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: "2026-08-10T00:00:00.000Z",
      backend: "file-native",
      tables: { messages: 0 },
      shards: { messages: 0 },
    }),
  );

  const db = await createFileNativeDB();
  try {
    assert.equal((await db.select().from(messages)).length, 0, "zero expected rows never revive the old backup");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// Malformed manifest counts are not proof that a restored profile expects
// rows. Strings and fractions must not revive a stale pre-shard backup.
for (const invalidExpectedCount of ["1", 1.5]) {
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "messages.json.pre-shard"),
    JSON.stringify([messageRow("m-stale", "chat-stale", "must not be restored")]),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: "2026-08-10T00:00:00.000Z",
      backend: "file-native",
      tables: { messages: invalidExpectedCount },
      shards: { messages: 0 },
    }),
  );

  const db = await createFileNativeDB();
  try {
    assert.equal(
      (await db.select().from(messages)).length,
      0,
      `invalid expected row count ${JSON.stringify(invalidExpectedCount)} never revives the old backup`,
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Crashed migration: sentinel present -> retry from the monolith ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "authoritative")]));
  // A partial, WRONG shard from the crashed attempt plus the sentinel.
  writeFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`), JSON.stringify([]));
  writeFileSync(join(dir, "tables", "messages", ".migrating"), "2026-08-08T00:00:00.000Z");

  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "the retry migrates from the untouched monolith");
    assert.equal(rows[0]!.content, "authoritative", "the partial crashed shards were discarded");
    assert.ok(existsSync(join(dir, "tables", "messages.json.pre-shard")), "the retried migration completes");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Downgrade artifact: monolith beside shards, no sentinel -> quarantine ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify([messageRow("m-1", "chat-x", "sharded truth")]),
  );
  // A monolith recreated by a pre-shard build during a downgrade session.
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-9", "chat-x", "forked")]));

  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "the forked monolith is never merged");
    assert.equal(rows[0]!.content, "sharded truth", "the shards are authoritative");
    const artifacts = readdirSync(join(dir, "tables")).filter((name) => name.includes(".post-downgrade-"));
    assert.ok(artifacts.length > 0, "the conflicting monolith is quarantined under a timestamped name");
    const quarantined = db._fileStore.getQuarantinedTables();
    assert.ok(
      quarantined.some((entry) => entry.table === "messages"),
      "the quarantine surface reports the conflict",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Newer storage format refuses to load ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "untouchable")]));
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ version: 99, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
  );
  try {
    await assert.rejects(
      createFileNativeDB(),
      (error: unknown) => error instanceof StorageFormatTooNewError,
      "data from a newer format must refuse to load instead of being misread",
    );
    // The refusal must precede EVERY migration side effect: a directory this
    // build cannot read must not be mutated by it either.
    assert.ok(existsSync(join(dir, "tables", "messages.json")), "the refused startup leaves the monolith untouched");
    assert.equal(existsSync(join(dir, "tables", "messages.json.pre-shard")), false, "no pre-shard rename happened");
    assert.equal(existsSync(join(dir, "tables", "messages")), false, "no shard directory was created");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A bak-only NEWER manifest still refuses before migration side effects ──
// A crash can leave only manifest.json.bak; the pre-migration gate must
// recover the version from it rather than short-circuit on the missing
// primary and let the migration mutate a directory this build cannot read.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "untouchable")]));
  writeFileSync(
    join(dir, "manifest.json.bak"),
    JSON.stringify({ version: 99, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
  );
  try {
    await assert.rejects(
      createFileNativeDB(),
      (error: unknown) => error instanceof StorageFormatTooNewError,
      "a newer version surviving only in manifest.json.bak must still refuse to load",
    );
    assert.ok(existsSync(join(dir, "tables", "messages.json")), "the refused startup leaves the monolith untouched");
    assert.equal(existsSync(join(dir, "tables", "messages.json.pre-shard")), false, "no pre-shard rename happened");
    assert.equal(existsSync(join(dir, "tables", "messages")), false, "no shard directory was created");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Crash between mkdir and the sentinel write: monolith must NOT be quarantined ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true }); // empty shard dir, no sentinel
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "survivor")]));
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "an EMPTY shard dir beside a monolith is a crashed migration, not a downgrade");
    assert.equal(rows[0]!.content, "survivor", "the monolith is migrated, never quarantined in favor of nothing");
    assert.ok(existsSync(join(dir, "tables", "messages.json.pre-shard")), "migration completed on the retry");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Crash between the two renames: retry must use the FRESH primary ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  // .bak renamed first (new order), crash before the primary rename: fresh
  // primary + complete shards + sentinel still present.
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "fresh")]));
  writeFileSync(
    join(dir, "tables", "messages.json.bak.pre-shard"),
    JSON.stringify([messageRow("m-0", "chat-x", "stale")]),
  );
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify([messageRow("m-1", "chat-x", "fresh")]),
  );
  writeFileSync(join(dir, "tables", "messages", ".migrating"), "ts");
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.content, "fresh", "the retry migrates from the fresh primary, never the stale .bak");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Duplicate rows across shards are dropped on load and healed on flush ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  const dupRow = messageRow("m-dup", "chat-x", "original");
  writeFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`), JSON.stringify([dupRow]));
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-y")}.json`),
    JSON.stringify([{ ...dupRow, chatId: "chat-y", content: "stale copy" }]),
  );
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "duplicate primary keys across shards never survive into memory");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A shard with ONLY malformed rows is quarantined, not kept as a zombie ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  const shardPath = join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`);
  writeFileSync(shardPath, JSON.stringify(["not-a-row", 42]));
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 0, "malformed rows never load");
    assert.equal(existsSync(shardPath), false, "the all-malformed shard file is removed from the shard dir");
    const quarantined = readdirSync(join(dir, "tables", "messages")).filter((name) => name.includes(".corrupt-"));
    assert.equal(quarantined.length, 1, "the file is preserved under a .corrupt- name for manual recovery");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Self-heal dirties EVERY shard key found in a recovered file ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  // chat-x's shard carries one malformed row plus a row that belongs to
  // chat-y; chat-y's own file exists and is clean, so it is already "known"
  // and only a dirty key can force its rewrite.
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify(["malformed", messageRow("m-x1", "chat-x", "x"), messageRow("m-y2", "chat-y", "displaced")]),
  );
  const yPath = join(dir, "tables", "messages", `${encodeShardKey("chat-y")}.json`);
  writeFileSync(yPath, JSON.stringify([messageRow("m-y1", "chat-y", "resident")]));
  const db = await createFileNativeDB();
  try {
    await db._fileStore.flush();
    const yRows = JSON.parse(readFileSync(yPath, "utf8")) as Array<{ id: string }>;
    assert.deepEqual(
      yRows.map((row) => row.id).sort(),
      ["m-y1", "m-y2"],
      "healing a mixed recovered file rewrites EVERY shard its rows map to, not just the first row's",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A misplaced physical shard file is rewritten canonically, not kept forever ──
// Logical-key dirtying alone never touches a file whose rows belong to OTHER
// shards (hand-edits, stray re-home copies): the flush writes the rows' real
// shards and skips the physical file, reintroducing its stray rows on every
// startup.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  // chat-x.json holds ONLY a chat-y row: the file must be deleted and the row
  // must land in chat-y.json.
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify([messageRow("m-y1", "chat-y", "misplaced")]),
  );
  const db = await createFileNativeDB();
  try {
    const yRows = JSON.parse(
      readFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-y")}.json`), "utf8"),
    ) as Array<{ id: string }>;
    assert.deepEqual(
      yRows.map((row) => row.id),
      ["m-y1"],
      "the misplaced row lands in its real shard",
    );
    assert.equal(
      existsSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`)),
      false,
      "the physical file that held only foreign rows is deleted, not reloaded forever",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  // chat-x.json holds a real chat-x row PLUS a stray copy of chat-y's row:
  // the file must be rewritten without the stray, while chat-y.json keeps its
  // own copy — the stray must not reappear on the next load.
  const yRow = messageRow("m-y1", "chat-y", "resident");
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify([messageRow("m-x1", "chat-x", "real"), { ...yRow, content: "stray copy" }]),
  );
  writeFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-y")}.json`), JSON.stringify([yRow]));
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 2, "the stray duplicate never reaches memory");
    const xRows = JSON.parse(
      readFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`), "utf8"),
    ) as Array<{ id: string }>;
    assert.deepEqual(
      xRows.map((row) => row.id),
      ["m-x1"],
      "the mixed file is rewritten canonically without the stray copy",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Inserting a parent message adopts its orphan swipes' shard files ──
// Orphan swipes live in the unassigned shard. When their message is later
// INSERTED, they silently regroup into the chat's shard at flush time — both
// swipe files must be rewritten, or the unassigned file keeps a stale copy
// that duplicates on the next load.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  mkdirSync(join(dir, "tables", "message_swipes"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "message_swipes", "orphaned-rows.json"),
    JSON.stringify([{ id: "s-1", messageId: "m-1", index: 0, content: "orphan swipe" }]),
  );
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({ id: "chat-a", name: "A", mode: "conversation" });
    await db.insert(messages).values(messageRow("m-1", "chat-a", "parent arrives"));
    await db._fileStore.flush();
    const swipes = JSON.parse(
      readFileSync(join(dir, "tables", "message_swipes", `${encodeShardKey("chat-a")}.json`), "utf8"),
    ) as Array<{ id: string }>;
    assert.deepEqual(
      swipes.map((row) => row.id),
      ["s-1"],
      "the orphan swipe lands in the adopting chat's shard",
    );
    assert.equal(
      existsSync(join(dir, "tables", "message_swipes", "orphaned-rows.json")),
      false,
      "the unassigned shard file is rewritten away, not left holding a stale copy",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Rollback restores the orphan-swipe markers ──
// A rolled-back parent insert consumes the orphan marker inside the
// transaction; without rebuilding it on rollback, the REAL insert afterwards
// would no longer dirty the unassigned swipe shard.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  mkdirSync(join(dir, "tables", "message_swipes"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "message_swipes", "orphaned-rows.json"),
    JSON.stringify([{ id: "s-1", messageId: "m-1", index: 0, content: "orphan swipe" }]),
  );
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({ id: "chat-a", name: "A", mode: "conversation" });
    // assert.rejects on the DELIBERATE error: a transaction that failed
    // before inserting m-1 would leave the marker untouched and pass this
    // test without exercising the restoration at all.
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.insert(messages).values(messageRow("m-1", "chat-a", "rolled back"));
        throw new Error("force rollback");
      }),
      /force rollback/,
    );
    await db.insert(messages).values(messageRow("m-1", "chat-a", "real parent"));
    await db._fileStore.flush();
    const swipes = JSON.parse(
      readFileSync(join(dir, "tables", "message_swipes", `${encodeShardKey("chat-a")}.json`), "utf8"),
    ) as Array<{ id: string }>;
    assert.deepEqual(
      swipes.map((row) => row.id),
      ["s-1"],
      "adoption still works after a rolled-back attempt",
    );
    assert.equal(
      existsSync(join(dir, "tables", "message_swipes", "orphaned-rows.json")),
      false,
      "the unassigned shard file is still rewritten away after the rollback consumed and restored the marker",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A stale manifest version is rewritten on the next boot ──
// Crash window: migration completed but the first flush never ran, leaving
// sharded data under a version-2 manifest. The downgrade guard (#4708 PR 2)
// trusts manifest.version, so the store must heal it on the next startup —
// not wait for the next data write.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify([messageRow("m-1", "chat-x", "sharded")]),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ version: 2, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
  );
  const db = await createFileNativeDB();
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { version: number };
    assert.equal(manifest.version, STORAGE_VERSION, "a lagging manifest version is healed by the startup flush");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A MISSING manifest is recreated on the next boot ──
// The downgrade guard reads manifest.version; sharded data with no manifest
// at all would give it nothing to check.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`),
    JSON.stringify([messageRow("m-1", "chat-x", "sharded")]),
  );
  const db = await createFileNativeDB();
  try {
    assert.ok(existsSync(join(dir, "manifest.json")), "a boot over manifest-less table data recreates the manifest");
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { version: number };
    assert.equal(manifest.version, STORAGE_VERSION, "the recreated manifest carries the current storage version");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A crashed-migration retry never deletes quarantine artifacts ──
// The retry clears incomplete shard files, but .corrupt-* files are
// user-recovery data the store must never delete on its own.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "monolith")]));
  writeFileSync(join(dir, "tables", "messages", ".migrating"), "2026-08-08T00:00:00.000Z");
  writeFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`), JSON.stringify([]));
  const quarantinedPath = join(dir, "tables", "messages", "chat-old.json.corrupt-2026-08-01T00-00-00-000Z");
  writeFileSync(quarantinedPath, "preserved recovery bytes");
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "the retry migrates from the monolith");
    assert.ok(existsSync(quarantinedPath), "quarantined .corrupt files survive the migration retry");
    assert.equal(
      existsSync(join(dir, "tables", "messages", ".migrating")),
      false,
      "the sentinel is gone after the completed retry",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Duplicate ids: the canonical shard's copy beats a stale foreign copy ──
// With identical sort keys, keep-first would let discovery order decide — a
// stale foreign copy could win and self-healing would then overwrite the
// canonical row with it.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  const canonical = messageRow("m-dup", "chat-b", "canonical content");
  // The foreign copy shares id AND createdAt, and lives in chat-a.json —
  // which sorts and loads FIRST, so keep-first would pick it.
  writeFileSync(
    join(dir, "tables", "messages", `${encodeShardKey("chat-a")}.json`),
    JSON.stringify([{ ...canonical, content: "stale foreign copy" }]),
  );
  writeFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-b")}.json`), JSON.stringify([canonical]));
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "one copy survives");
    assert.equal(rows[0]!.content, "canonical content", "the canonical shard's copy wins, not discovery order");
    const bRows = JSON.parse(
      readFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-b")}.json`), "utf8"),
    ) as Array<{ content: string }>;
    assert.equal(
      bRows[0]!.content,
      "canonical content",
      "self-healing never replaces the canonical row with the stale copy",
    );
    assert.equal(
      existsSync(join(dir, "tables", "messages", `${encodeShardKey("chat-a")}.json`)),
      false,
      "the foreign file holding the stale copy is cleaned up",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A quarantined bak-only shard leaves no phantom manifest entry ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  writeFileSync(join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json.bak`), "{corrupt");
  const db = await createFileNativeDB();
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
      shards: Record<string, number>;
    };
    assert.equal(manifest.shards.messages, 0, "an unreadable bak-only shard is quarantined, never counted as known");
    const quarantined = readdirSync(join(dir, "tables", "messages")).filter((name) => name.includes(".corrupt-"));
    assert.equal(quarantined.length, 1, "the unreadable backup is preserved for manual recovery");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A corrupt primary with a valid EMPTY .bak is cleaned up, not zombied ──
// recoveredFromBackup with zero rows left the corrupt primary in `known`
// with no dirty key derivable from rows — re-parsed, re-recovered, and
// re-logged on every startup forever.

{
  const dir = tempStorageDir();
  try {
    mkdirSync(join(dir, "tables", "messages"), { recursive: true });
    const shardPath = join(dir, "tables", "messages", `${encodeShardKey("chat-x")}.json`);
    writeFileSync(shardPath, "{corrupt json");
    writeFileSync(`${shardPath}.bak`, JSON.stringify([]));
    const db = await createFileNativeDB();
    try {
      const rows = await db.select().from(messages);
      assert.equal(rows.length, 0, "nothing usable loads from the empty backup");
      assert.equal(existsSync(shardPath), false, "the corrupt primary is removed by the startup flush");
      assert.equal(
        existsSync(`${shardPath}.bak`),
        false,
        "the empty backup goes with it — zero-row shards are deleted",
      );
    } finally {
      await db._fileStore.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Bak-only shard: primary vanished in a crash, .bak survives ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  const encoded = encodeShardKey("chat-x");
  writeFileSync(
    join(dir, "tables", "messages", `${encoded}.json.bak`),
    JSON.stringify([messageRow("m-1", "chat-x", "from bak")]),
  );
  const db = await createFileNativeDB();
  try {
    const rows = await db.select().from(messages);
    assert.equal(rows.length, 1, "a bak-only shard is discovered and recovered (readdir lists no primary)");
    assert.equal(rows[0]!.content, "from bak");
    await db._fileStore.flush();
    assert.ok(
      existsSync(join(dir, "tables", "messages", `${encoded}.json`)),
      "self-heal rewrites the missing primary on the next flush",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── PR 3 (#4708): every remaining chat-keyed table shards by its own chatId ──
// memory_chunks stands in for the direct-chatId family (chat_images,
// agent_runs, conversation_call_messages, game_state_snapshots,
// spatial_context_snapshots resolve identically through shardKeyForRow).

{
  const dir = tempStorageDir();
  const writes: string[] = [];
  const db = await createFileNativeDB({ beforeTableWrite: (table) => void writes.push(table) });
  try {
    await db.insert(chats).values({ id: "chat-a", name: "A", mode: "conversation" });
    await db.insert(chats).values({ id: "chat-b", name: "B", mode: "conversation" });
    for (const chatId of ["chat-a", "chat-b"]) {
      await db.insert(memoryChunks).values({
        id: `chunk-${chatId}`,
        chatId,
        content: "chunked",
        messageCount: 1,
        firstMessageAt: "2026-08-08T10:00:00.000Z",
        lastMessageAt: "2026-08-08T10:00:00.000Z",
        createdAt: "2026-08-08T10:00:00.000Z",
      });
    }
    await db._fileStore.flush();
    assert.equal(existsSync(join(dir, "tables", "memory_chunks.json")), false, "no memory_chunks monolith is created");
    assert.ok(
      existsSync(join(dir, "tables", "memory_chunks", `${encodeShardKey("chat-a")}.json`)),
      "memory chunks land in per-chat shard files",
    );

    // Per-chat flush granularity: touching one chat's chunks writes ONLY that
    // chat's file.
    writes.length = 0;
    await db.update(memoryChunks).set({ content: "rewritten" }).where(eq(memoryChunks.id, "chunk-chat-a"));
    await db._fileStore.flush();
    const chunkWrites = writes.filter((t) => t.startsWith("memory_chunks/"));
    assert.deepEqual(
      chunkWrites,
      [`memory_chunks/${encodeShardKey("chat-a")}`],
      "one chat's chunk write touches only that chat's shard file",
    );

    // Chat deletion cascades remove the shard files, not just the rows.
    await db.delete(chats).where(eq(chats.id, "chat-b"));
    await db._fileStore.flush();
    assert.equal(
      existsSync(join(dir, "tables", "memory_chunks", `${encodeShardKey("chat-b")}.json`)),
      false,
      "deleting a chat removes its chunk shard file",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── PR 3 migration: every new monolith shards in one boot, rows and originals preserved ──

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  const seeded: Array<[string, Record<string, unknown>]> = [
    [
      "memory_chunks",
      {
        id: "row-memory_chunks",
        chatId: "chat-x",
        content: "c",
        messageCount: 1,
        firstMessageAt: "t",
        lastMessageAt: "t",
        createdAt: "2026-08-08T10:00:00.000Z",
      },
    ],
    [
      "chat_images",
      { id: "row-chat_images", chatId: "chat-x", filePath: "img.png", createdAt: "2026-08-08T10:00:01.000Z" },
    ],
    [
      "agent_runs",
      {
        id: "row-agent_runs",
        agentConfigId: "cfg",
        chatId: "chat-x",
        messageId: "m-1",
        resultType: "text",
        createdAt: "2026-08-08T10:00:02.000Z",
      },
    ],
    [
      "agent_memory",
      {
        id: "row-agent_memory",
        agentConfigId: "cfg",
        chatId: "chat-x",
        key: "k",
        value: "v",
        updatedAt: "2026-08-08T10:00:02.500Z",
      },
    ],
    [
      "conversation_call_sessions",
      {
        id: "row-conversation_call_sessions",
        chatId: "chat-x",
        status: "ended",
        mode: "audio",
        createdAt: "2026-08-08T10:00:02.750Z",
      },
    ],
    [
      "conversation_call_messages",
      {
        id: "row-conversation_call_messages",
        callId: "call-1",
        chatId: "chat-x",
        role: "user",
        participantKind: "user",
        kind: "text",
        createdAt: "2026-08-08T10:00:03.000Z",
      },
    ],
    [
      "game_state_snapshots",
      { id: "row-game_state_snapshots", chatId: "chat-x", messageId: "m-1", createdAt: "2026-08-08T10:00:04.000Z" },
    ],
    [
      "game_engine_state",
      { id: "row-game_engine_state", chatId: "chat-x", gameType: "uno", createdAt: "2026-08-08T10:00:04.250Z" },
    ],
    [
      "game_checkpoints",
      {
        id: "row-game_checkpoints",
        chatId: "chat-x",
        snapshotId: "row-game_state_snapshots",
        createdAt: "2026-08-08T10:00:04.500Z",
      },
    ],
    [
      "game_turn_storyboards",
      { id: "row-game_turn_storyboards", chatId: "chat-x", messageId: "m-1", createdAt: "2026-08-08T10:00:04.750Z" },
    ],
    [
      "game_scene_videos",
      { id: "row-game_scene_videos", chatId: "chat-x", filePath: "v.mp4", createdAt: "2026-08-08T10:00:05.000Z" },
    ],
    [
      "spatial_context_snapshots",
      {
        id: "row-spatial_context_snapshots",
        chatId: "chat-x",
        messageId: "m-1",
        definitionRevision: 1,
        source: "test",
        createdAt: "2026-08-08T10:00:05.250Z",
      },
    ],
    // The two target-keyed tables shard by targetChatId, not sourceChatId.
    [
      "ooc_influences",
      {
        id: "row-ooc_influences",
        sourceChatId: "chat-other",
        targetChatId: "chat-x",
        createdAt: "2026-08-08T10:00:05.500Z",
      },
    ],
    [
      "conversation_notes",
      {
        id: "row-conversation_notes",
        sourceChatId: "chat-other",
        targetChatId: "chat-x",
        createdAt: "2026-08-08T10:00:05.750Z",
      },
    ],
  ];
  for (const [table, row] of seeded) {
    writeFileSync(join(dir, "tables", `${table}.json`), JSON.stringify([row]));
  }
  const db = await createFileNativeDB();
  try {
    for (const [table] of seeded) {
      const shardPath = join(dir, "tables", table, `${encodeShardKey("chat-x")}.json`);
      assert.ok(existsSync(shardPath), `${table} migrated into a per-chat shard`);
      const rows = JSON.parse(readFileSync(shardPath, "utf8")) as Array<{ id: string }>;
      assert.deepEqual(
        rows.map((row) => row.id),
        [`row-${table}`],
        `${table} rows survive the migration intact`,
      );
      assert.ok(
        existsSync(join(dir, "tables", `${table}.json.pre-shard`)),
        `${table} monolith preserved as .pre-shard`,
      );
      assert.equal(existsSync(join(dir, "tables", `${table}.json`)), false, `${table} monolith renamed away`);
    }
    assert.equal(
      existsSync(join(dir, "tables", "ooc_influences", `${encodeShardKey("chat-other")}.json`)),
      false,
      "influences shard by targetChatId, never by sourceChatId",
    );
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { version: number };
    assert.equal(manifest.version, STORAGE_VERSION, "the migrated store lands on the current format");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── SET_NULL cascades persist for sharded children ──
// applySetNullRelations was the one mutation path calling markDirty without
// shard keys: the null-out landed in memory but the flush never wrote it,
// so a restart resurrected the dangling FK.

{
  const dir = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({ id: "chat-a", name: "A", mode: "conversation" });
    await db.insert(spatialContextSnapshots).values({
      id: "spatial-1",
      chatId: "chat-a",
      messageId: "m-1",
      definitionRevision: 1,
      source: "test",
      createdAt: "2026-08-08T10:00:00.000Z",
    });
    await db.insert(gameCheckpoints).values({
      id: "cp-1",
      chatId: "chat-a",
      snapshotId: "snap-1",
      spatialSnapshotId: "spatial-1",
      createdAt: "2026-08-08T10:00:01.000Z",
    });
    await db._fileStore.flush();
    await db.delete(spatialContextSnapshots).where(eq(spatialContextSnapshots.id, "spatial-1"));
    await db._fileStore.flush();
    const onDisk = JSON.parse(
      readFileSync(join(dir, "tables", "game_checkpoints", `${encodeShardKey("chat-a")}.json`), "utf8"),
    ) as Array<{ id: string; spatialSnapshotId: string | null }>;
    assert.equal(
      onDisk[0]!.spatialSnapshotId,
      null,
      "the SET_NULL cascade reaches the checkpoint's shard file on disk",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Influences and notes cascade with their chats (both FKs) ──
// The schemas declare onDelete: cascade on sourceChatId AND targetChatId,
// but the store's graph never carried the relations — post-sharding that
// left permanent orphaned shard files and stale injections on chat-id reuse.

{
  const dir = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({ id: "chat-src", name: "S", mode: "conversation" });
    await db.insert(chats).values({ id: "chat-tgt", name: "T", mode: "roleplay" });
    await db.insert(oocInfluences).values({
      id: "inf-1",
      sourceChatId: "chat-src",
      targetChatId: "chat-tgt",
      createdAt: "2026-08-08T10:00:00.000Z",
    });
    await db._fileStore.flush();
    const shardPath = join(dir, "tables", "ooc_influences", `${encodeShardKey("chat-tgt")}.json`);
    assert.ok(existsSync(shardPath), "influences shard by targetChatId");
    await db.delete(chats).where(eq(chats.id, "chat-tgt"));
    await db._fileStore.flush();
    assert.equal(existsSync(shardPath), false, "deleting the target chat removes its influence shard file");
    const rows = await db.select().from(oocInfluences);
    assert.equal(rows.length, 0, "the rows are gone from memory too");
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── A re-migration never clobbers the original .pre-shard backup ──
// Round trip: migrate -> unshard -> migrate again. The docs promise the
// pre-migration originals are never deleted by the Engine, so the second
// migration must take the timestamped form instead of renaming over the
// first backup.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(join(dir, "tables", "memory_chunks.json.pre-shard"), JSON.stringify([{ id: "pristine-original" }]));
  writeFileSync(
    join(dir, "tables", "memory_chunks.json"),
    JSON.stringify([
      {
        id: "chunk-1",
        chatId: "chat-x",
        content: "rebuilt",
        messageCount: 1,
        firstMessageAt: "t",
        lastMessageAt: "t",
        createdAt: "2026-08-08T10:00:00.000Z",
      },
    ]),
  );
  const db = await createFileNativeDB();
  try {
    const original = JSON.parse(readFileSync(join(dir, "tables", "memory_chunks.json.pre-shard"), "utf8")) as Array<{
      id: string;
    }>;
    assert.deepEqual(
      original.map((row) => row.id),
      ["pristine-original"],
      "the first .pre-shard backup survives a re-migration",
    );
    assert.ok(
      readdirSync(join(dir, "tables")).some((name) => /^memory_chunks\.json\.pre-shard-.+/.test(name)),
      "the re-migrated monolith is preserved under a timestamped .pre-shard- name",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── The post-migration notice marker (#4756) ──
// A migration boot writes a durable app_settings marker the client shows
// once; fresh installs never write one; an acknowledged (cleared) marker is
// not resurrected by later boots that migrate nothing.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(join(dir, "tables", "messages.json"), JSON.stringify([messageRow("m-1", "chat-x", "old world")]));
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ version: 2, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
  );
  const db = await createFileNativeDB();
  try {
    const settings = JSON.parse(
      readFileSync(join(dir, "tables", "app_settings", `${encodeShardKey("storage-migration-notice")}.json`), "utf8"),
    ) as Array<{
      key: string;
      value: string;
    }>;
    const marker = settings.find((row) => row.key === "storage-migration-notice");
    assert.ok(marker, "a migration boot persists the notice marker");
    const notice = JSON.parse(marker!.value) as { fromFormat: number; toFormat: number; migratedTables: string[] };
    assert.equal(notice.fromFormat, 2, "the notice records the pre-migration format");
    assert.equal(notice.toFormat, STORAGE_VERSION, "the notice records the current format");
    assert.ok(notice.migratedTables.includes("messages"), "the notice lists the migrated tables");

    // Acknowledge, then boot again without a migration: stays acknowledged.
    await db.update(appSettings).set({ value: "" }).where(eq(appSettings.key, "storage-migration-notice"));
    await db._fileStore.flush();
  } finally {
    await db._fileStore.close();
  }
  const db2 = await createFileNativeDB();
  try {
    const settings = JSON.parse(
      readFileSync(join(dir, "tables", "app_settings", `${encodeShardKey("storage-migration-notice")}.json`), "utf8"),
    ) as Array<{
      key: string;
      value: string;
    }>;
    const marker = settings.find((row) => row.key === "storage-migration-notice");
    assert.equal(marker?.value, "", "an acknowledged notice is not resurrected by a migration-free boot");
  } finally {
    await db2._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

{
  const dir = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({ id: "chat-a", name: "A", mode: "conversation" });
    await db._fileStore.flush();
    const noticeShard = join(dir, "tables", "app_settings", `${encodeShardKey("storage-migration-notice")}.json`);
    const settings = existsSync(noticeShard)
      ? (JSON.parse(readFileSync(noticeShard, "utf8")) as Array<{ key: string }>)
      : [];
    assert.equal(
      settings.some((row) => row.key === "storage-migration-notice"),
      false,
      "a fresh install migrates nothing and never writes the notice marker",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// An UNACKNOWLEDGED prior notice merges with a new migration instead of
// being overwritten: the original fromFormat wins and the table lists union.

{
  const dir = tempStorageDir();
  mkdirSync(join(dir, "tables"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "app_settings.json"),
    JSON.stringify([
      {
        key: "storage-migration-notice",
        value: JSON.stringify({ fromFormat: 2, toFormat: 3, migratedTables: ["messages"], migratedAt: "t" }),
        updatedAt: "2026-08-08T00:00:00.000Z",
      },
    ]),
  );
  writeFileSync(
    join(dir, "tables", "memory_chunks.json"),
    JSON.stringify([
      {
        id: "chunk-1",
        chatId: "chat-x",
        content: "c",
        messageCount: 1,
        firstMessageAt: "t",
        lastMessageAt: "t",
        createdAt: "2026-08-08T10:00:00.000Z",
      },
    ]),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ version: 3, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
  );
  const db = await createFileNativeDB();
  try {
    const settings = JSON.parse(
      readFileSync(join(dir, "tables", "app_settings", `${encodeShardKey("storage-migration-notice")}.json`), "utf8"),
    ) as Array<{
      key: string;
      value: string;
    }>;
    const marker = settings.find((row) => row.key === "storage-migration-notice");
    const notice = JSON.parse(marker!.value) as { fromFormat: number; toFormat: number; migratedTables: string[] };
    assert.equal(notice.fromFormat, 2, "the prior unacknowledged notice's fromFormat wins the merge");
    assert.equal(notice.toFormat, STORAGE_VERSION, "toFormat advances to the current format");
    assert.ok(
      notice.migratedTables.includes("messages") && notice.migratedTables.includes("memory_chunks"),
      "the migrated-table lists union across the merged notices",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// Home previews apply metadata filtering before LIMIT, while count() returns
// the aggregate without projecting one row per message.
{
  const dir = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({ id: "preview-chat", name: "Preview", mode: "conversation" });
    await db.insert(messages).values([
      messageRow("preview-visible", "preview-chat", "Visible"),
      { ...messageRow("preview-empty", "preview-chat", ""), role: "assistant" },
      { ...messageRow("preview-whitespace", "preview-chat", " \n\t "), role: "assistant" },
      {
        ...messageRow("preview-hidden", "preview-chat", "Hidden"),
        role: "assistant",
        extra: JSON.stringify({ hiddenFromUser: true }),
      },
      {
        ...messageRow("preview-command", "preview-chat", "Command"),
        role: "assistant",
        extra: JSON.stringify({ commandOnly: true }),
      },
    ]);

    assert.equal(db.count(messages, eq(messages.chatId, "preview-chat")), 5, "aggregate count covers every row");
    const previews = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, "preview-chat"),
          ne(messages.role, "system"),
          stringIsNonBlank(messages.content),
          jsonFlagsNotTrue(messages.extra, ["hiddenFromUser", "commandOnly"]),
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(1);
    assert.deepEqual(
      previews,
      [{ id: "preview-visible" }],
      "blank and hidden command anchors cannot consume preview slots",
    );
    const storage = createChatsStorage(db);
    const firstPage = await storage.listMessagesPaginated("preview-chat", 2);
    assert.deepEqual(
      firstPage.map((message) => message.id),
      ["preview-hidden", "preview-command"],
      "the newest history page keeps chronological display order",
    );
    const historyCursor = `${firstPage[0]!.createdAt}|${encodeURIComponent(firstPage[0]!.id)}`;
    await db.delete(messages).where(eq(messages.id, "preview-visible"));
    const secondPage = await storage.listMessagesPaginated("preview-chat", 2, historyCursor);
    assert.deepEqual(
      secondPage.map((message) => message.id),
      ["preview-empty", "preview-whitespace"],
      "deleting an older message between pages cannot repeat the cursor page",
    );
    await assert.rejects(
      storage.listMessagesPaginated(
        "preview-chat",
        1,
        `${firstPage[0]!.createdAt}|${encodeURIComponent("missing-message")}`,
      ),
      /Invalid message cursor/u,
      "history cursors must identify a message in the current snapshot",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

console.info("Message sharding regressions passed.");
