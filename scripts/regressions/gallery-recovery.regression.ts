// #5612: the boot-time gallery recovery scan must not defeat lazy chat-unit
// residency. Its per-chat chat_images queries were individually scoped, but a
// scoped query still loads that chat's ENTIRE storage unit — so on installs
// where most chats have images, boot walked nearly every unit into memory and
// silently reproduced the eager boot #5592 removed. The fixed scan peeks the
// chat_images shard file straight off disk for non-resident units (a
// non-resident unit can hold no unflushed writes while the table is not
// fully leased, so the file is the current state) and only loads a unit when
// it actually has to: an orphaned file to re-register, or a shard the peek
// cannot interpret exactly the way the loader would.
//
// Project imports are DYNAMIC, after the env assignments below — data-dir.ts
// freezes a DATA_DIR constant at module load, so hoisted static imports would
// point the pre-fix scan (and any future module-const regression) at the
// default data dir instead of this fixture, making red/green runs vacuous.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.MARINARA_EAGER_STORAGE === "1" || process.env.MARINARA_EAGER_STORAGE === "true") {
  // Under the kill switch chat_images is fully resident from boot and the scan
  // keeps its original whole-table behavior; these regressions assert the
  // lazy-mode peek semantics.
  console.log("Gallery-recovery regressions skipped: MARINARA_EAGER_STORAGE is set.");
  process.exit(0);
}

// One environment for every block: a data dir (holding gallery/) and a storage
// dir, torn down together. Each block uses distinct chat ids.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-gallery-recovery-"));
const storeDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storeDir;

const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const { chatImages } = await import("../../packages/server/src/db/schema/index.js");
const { recoverGalleryImages } = await import("../../packages/server/src/services/storage/gallery-recovery.js");

const chatRow = (id: string) => ({ id, name: id, mode: "conversation" });
const imageRow = (id: string, chatId: string, filePath: string) => ({
  id,
  chatId,
  filePath,
  prompt: "",
  provider: "",
  model: "",
  width: null,
  height: null,
  createdAt: "2026-08-28T10:00:00.000Z",
});
const messageRow = (id: string, chatId: string) => ({
  id,
  chatId,
  role: "user",
  content: "ballast so a unit load is observable",
  createdAt: "2026-08-28T10:00:00.000Z",
});

const shardPath = (table: string, key: string) => join(storeDir, "tables", table, `${encodeShardKey(key)}.json`);
const writeShard = (table: string, key: string, rows: unknown[]) => {
  mkdirSync(join(storeDir, "tables", table), { recursive: true });
  writeFileSync(shardPath(table, key), JSON.stringify(rows));
};
const writeGalleryFile = (chatId: string, filename: string) => {
  mkdirSync(join(dataDir, "gallery", chatId), { recursive: true });
  writeFileSync(join(dataDir, "gallery", chatId, filename), "not-a-real-png");
};

// Seed BEFORE the store boots, like a real install.
// chat-a / chat-b: healthy chats whose images are all recorded — the common
// case, which must not load anything.
for (const chatId of ["chat-a", "chat-b"]) {
  writeShard("chats", chatId, [chatRow(chatId)]);
  writeShard("messages", chatId, [messageRow(`m-${chatId}`, chatId)]);
  writeShard("chat_images", chatId, [imageRow(`img-${chatId}`, chatId, `${chatId}/pic.png`)]);
  writeGalleryFile(chatId, "pic.png");
}
// chat-c: one recorded image, one orphaned file — the insert loads this unit.
writeShard("chats", "chat-c", [chatRow("chat-c")]);
writeShard("chat_images", "chat-c", [imageRow("img-c1", "chat-c", "chat-c/known.png")]);
writeGalleryFile("chat-c", "known.png");
writeGalleryFile("chat-c", "orphan.png");
// chat-d: unreadable chat_images shard with a valid .bak recording its file —
// the peek must hand off to the real loader (which recovers from the .bak), and
// the recovered row must prevent a duplicate insert.
writeShard("chats", "chat-d", [chatRow("chat-d")]);
writeShard("chat_images", "chat-d", [imageRow("img-d1", "chat-d", "chat-d/saved.png")]);
writeFileSync(`${shardPath("chat_images", "chat-d")}.bak`, readFileSync(shardPath("chat_images", "chat-d")));
writeFileSync(shardPath("chat_images", "chat-d"), "{corrupt json!");
writeGalleryFile("chat-d", "saved.png");
// chat-e: exists but its gallery directory holds nothing recoverable.
writeShard("chats", "chat-e", [chatRow("chat-e")]);
writeShard("messages", "chat-e", [messageRow("m-e", "chat-e")]);
mkdirSync(join(dataDir, "gallery", "chat-e"), { recursive: true });
// chat-f: a file on disk with NO chat_images shard at all — a genuine orphan
// whose insert must create the shard.
writeShard("chats", "chat-f", [chatRow("chat-f")]);
writeGalleryFile("chat-f", "fresh.png");
// chat-g: a shard in dbName form (chat_id / file_path) — the loader's
// normalizeRow accepts that shape, so the peek must NOT treat it as "no rows"
// (which would duplicate every recorded image); it must hand off to the loader.
writeShard("chats", "chat-g", [chatRow("chat-g")]);
writeShard("chat_images", "chat-g", [
  { id: "img-g1", chat_id: "chat-g", file_path: "chat-g/named.png", createdAt: "2026-08-28T10:00:00.000Z" },
]);
writeGalleryFile("chat-g", "named.png");
// chat-h: two rows sharing one primary key with different filePaths, both
// files on disk. The loader drops the duplicate, so its file IS an orphan —
// the peek must not count both and skip the recovery the old scan performed.
writeShard("chats", "chat-h", [chatRow("chat-h")]);
writeShard("chat_images", "chat-h", [
  imageRow("img-h", "chat-h", "chat-h/first.png"),
  imageRow("img-h", "chat-h", "chat-h/second.png"),
]);
writeGalleryFile("chat-h", "first.png");
writeGalleryFile("chat-h", "second.png");
// chat-i: a primitive (malformed) entry alongside a recorded row. The loader
// drops the entry AND schedules the shard for repair — the peek must hand off
// so that repair is not blocked forever, while the recorded row still
// prevents a duplicate insert.
writeShard("chats", "chat-i", [chatRow("chat-i")]);
writeShard("chat_images", "chat-i", ["malformed-not-a-row", imageRow("img-i1", "chat-i", "chat-i/whole.png")]);
writeGalleryFile("chat-i", "whole.png");
// chat-x: gallery directory for a chat that no longer exists — skipped.
writeGalleryFile("chat-x", "ghost.png");

const aShardBytes = readFileSync(shardPath("chat_images", "chat-a"), "utf8");
const bShardBytes = readFileSync(shardPath("chat_images", "chat-b"), "utf8");

{
  const db = await createFileNativeDB();
  try {
    await recoverGalleryImages(db);
    const resident = db._fileStore.getResidentChatUnits();

    // The headline assertion: recovery visited every chat but loaded only the
    // units it had a concrete reason to touch. Before the fix, chat-a and
    // chat-b (fully recorded) loaded too — every chat with images did.
    assert.equal(resident.has("chat-a"), false, "a fully-recorded chat's unit is not loaded by the boot scan");
    assert.equal(resident.has("chat-b"), false, "no fully-recorded chat's unit is loaded by the boot scan");
    assert.equal(resident.has("chat-e"), false, "a chat with an empty gallery directory is not loaded");
    assert.equal(resident.has("chat-x"), false, "a deleted chat's leftover directory is not loaded");
    assert.equal(resident.has("chat-c"), true, "the chat with an orphaned file loads (the insert needs its unit)");
    assert.equal(resident.has("chat-d"), true, "the chat with an unreadable shard loads (recovery ladder handoff)");
    assert.equal(resident.has("chat-g"), true, "the dbName-form shard is handed to the loader, not misread as empty");
    assert.equal(resident.has("chat-h"), true, "the duplicate-id shard is handed to the loader, not counted twice");
    assert.equal(resident.has("chat-i"), true, "a malformed row is handed to the loader so shard repair can run");
    assert.equal(db._fileStore.getFullyResidentLazyTables().size, 0, "the scan itself never leases a whole table");

    const cRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-c"));
    assert.deepEqual(
      cRows.map((row) => row.filePath).sort(),
      ["chat-c/known.png", "chat-c/orphan.png"],
      "the orphaned file is re-registered and the recorded row is preserved",
    );
    const dRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-d"));
    assert.deepEqual(
      dRows.map((row) => row.filePath),
      ["chat-d/saved.png"],
      "the .bak-recovered row is honored — no duplicate insert for the corrupt-shard chat",
    );
    const fRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-f"));
    assert.deepEqual(
      fRows.map((row) => row.filePath),
      ["chat-f/fresh.png"],
      "a file with no shard at all is recovered",
    );
    const gRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-g"));
    assert.deepEqual(
      gRows.map((row) => row.filePath),
      ["chat-g/named.png"],
      "the dbName-form row is recognized as recorded — no duplicate insert",
    );
    const hRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-h"));
    assert.deepEqual(
      hRows.map((row) => row.filePath).sort(),
      ["chat-h/first.png", "chat-h/second.png"],
      "the loader-dropped duplicate's file is re-registered like the old scan did",
    );
    const iRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-i"));
    assert.deepEqual(
      iRows.map((row) => row.filePath),
      ["chat-i/whole.png"],
      "the malformed entry is dropped, the recorded row survives, no duplicate insert",
    );
    const xRows = await db.select().from(chatImages).where(eq(chatImages.chatId, "chat-x"));
    assert.equal(xRows.length, 0, "no rows are created for a chat that no longer exists");

    await db._fileStore.flush();
    assert.equal(
      readFileSync(shardPath("chat_images", "chat-a"), "utf8"),
      aShardBytes,
      "an untouched chat's shard file is byte-identical after recovery and flush",
    );
    assert.equal(
      readFileSync(shardPath("chat_images", "chat-b"), "utf8"),
      bShardBytes,
      "no untouched chat's shard file is rewritten",
    );
    assert.equal(
      existsSync(shardPath("chat_images", "chat-f")),
      true,
      "the recovered orphan's shard exists after flush",
    );
  } finally {
    await db._fileStore.close();
  }
}

// ── Second boot: every shard the peek now reads was written by the STORE ──
// This pins peek-vs-persisted-shape compatibility: if the serializer's on-disk
// row shape ever diverged from what the peek reads, this pass would either
// load units it must not or re-register recorded images.
{
  const db = await createFileNativeDB();
  try {
    await recoverGalleryImages(db);
    const resident = db._fileStore.getResidentChatUnits();
    // chat-a/b were never rewritten; chat-c/d/f/h were flushed by the FIRST
    // boot in the store's own canonical shape, and chat-i's malformed entry
    // was repaired away by that flush — none of them may load now. (chat-g is
    // the deliberate exception: the loader accepts a dbName-form shard
    // without rewriting it, so its conservative loader handoff repeats each
    // boot until some write canonicalizes the file.)
    for (const chatId of ["chat-a", "chat-b", "chat-c", "chat-d", "chat-f", "chat-h", "chat-i"]) {
      assert.equal(
        resident.has(chatId),
        false,
        `${chatId} is not loaded on re-boot — the peek reads the store's own flushed shards`,
      );
    }
    const counts = new Map<string, number>();
    for (const chatId of ["chat-a", "chat-b", "chat-c", "chat-d", "chat-f", "chat-g", "chat-h", "chat-i"]) {
      const rows = await db.select().from(chatImages).where(eq(chatImages.chatId, chatId));
      counts.set(chatId, rows.length);
    }
    assert.deepEqual(
      [...counts.values()],
      [1, 1, 2, 1, 1, 1, 2, 1],
      "no chat gains or loses rows on a fully-recorded re-boot",
    );
  } finally {
    await db._fileStore.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

console.log("Gallery-recovery regressions passed.");
