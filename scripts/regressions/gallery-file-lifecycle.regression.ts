// #5613: deleting any gallery image asked "does ANY chat still reference this
// physical file?" with an unscoped filePath query, which permanently converted
// the whole chat_images table to fully resident — silently defeating
// MARINARA_MAX_RESIDENT_CHATS on any install where the user had ever deleted
// an image. The fixed check answers from resident memory (authoritative in
// both directions) plus direct shard-file reads for everything else, hands
// untrusted shards to the real loader by key, and only assumes "referenced"
// for the undecodable remainder — the safe direction. It must never lease the
// table and must load a unit only for an untrusted shard.
//
// Project imports are DYNAMIC, after the env assignments below (see the
// gallery-recovery suite for why: module-load-frozen paths would detach the
// pre-fix code from this fixture and make red/green runs vacuous).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.MARINARA_EAGER_STORAGE === "1" || process.env.MARINARA_EAGER_STORAGE === "true") {
  // Under the kill switch chat_images is fully resident from boot and the
  // check keeps its original whole-table query; these regressions assert the
  // lazy-mode scan semantics.
  console.log("Gallery-file-lifecycle regressions skipped: MARINARA_EAGER_STORAGE is set.");
  process.exit(0);
}

const dataDir = mkdtempSync(join(tmpdir(), "marinara-gallery-lifecycle-"));
const storeDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storeDir;

const { and, eq } = await import("../../packages/server/src/db/file-query.js");
const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const { chatImages, chats } = await import("../../packages/server/src/db/schema/index.js");
const { galleryFileHasReferences, unlinkGalleryFileIfUnreferenced } =
  await import("../../packages/server/src/services/image/gallery-file-lifecycle.js");

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

const shardPath = (table: string, key: string) => join(storeDir, "tables", table, `${encodeShardKey(key)}.json`);
const writeShard = (table: string, key: string, rows: unknown[]) => {
  mkdirSync(join(storeDir, "tables", table), { recursive: true });
  writeFileSync(shardPath(table, key), JSON.stringify(rows));
};

// Seed BEFORE the store boots, like a real install. Every chat is cold at
// first; the check itself decides what loads.
// g1: owns shared.png; g2 also references g1's physical file (branch copy).
writeShard("chats", "g1", [chatRow("g1")]);
writeShard("chats", "g2", [chatRow("g2")]);
writeShard("chat_images", "g1", [imageRow("img-1", "g1", "g1/shared.png")]);
writeShard("chat_images", "g2", [imageRow("img-2", "g2", "g1/shared.png"), imageRow("img-3", "g2", "g2/own.png")]);
// g3: a dbName-form row (external tool) referencing its file.
writeShard("chats", "g3", [chatRow("g3")]);
writeShard("chat_images", "g3", [
  { id: "img-4", chat_id: "g3", file_path: "g3/named.png", createdAt: "2026-08-28T10:00:00.000Z" },
]);
// g4: corrupt shard with a valid .bak holding the only reference to its file.
writeShard("chats", "g4", [chatRow("g4")]);
writeShard("chat_images", "g4", [imageRow("img-5", "g4", "g4/saved.png")]);
writeFileSync(`${shardPath("chat_images", "g4")}.bak`, readFileSync(shardPath("chat_images", "g4")));
writeFileSync(shardPath("chat_images", "g4"), "{corrupt json!");
// g5: a lone .bak (main shard missing entirely) holding the only reference.
writeShard("chats", "g5", [chatRow("g5")]);
writeShard("chat_images", "g5", [imageRow("img-6", "g5", "g5/interrupted.png")]);
writeFileSync(`${shardPath("chat_images", "g5")}.bak`, readFileSync(shardPath("chat_images", "g5")));
rmSync(shardPath("chat_images", "g5"));
// g6: a malformed row in a shard whose real rows do NOT reference the probe.
writeShard("chats", "g6", [chatRow("g6")]);
writeShard("chat_images", "g6", ["malformed-not-a-row", imageRow("img-7", "g6", "g6/other.png")]);
// h9: a chat whose id encodes to the undecodable %h hash form (over 120
// chars), with a corrupt shard and a valid .bak. The filename cannot be
// decoded, so the check must attribute it by matching the encoding over the
// eager chats table and hand it to the loader. Deliberately NOT g-prefixed:
// its unit loads during the first full sweep (hash names sort before
// letters, so its handoff is attempted first) and the g-unit asserts must
// not see it.
const hashChatId = `h9-${"x".repeat(120)}`;
writeShard("chats", hashChatId, [chatRow(hashChatId)]);
writeShard("chat_images", hashChatId, [imageRow("img-9", hashChatId, "h9/hashed.png")]);
writeFileSync(`${shardPath("chat_images", hashChatId)}.bak`, readFileSync(shardPath("chat_images", hashChatId)));
writeFileSync(shardPath("chat_images", hashChatId), "{corrupt json!");
// Orphan-unit rows: chatId null, absent, and non-string. These land in the
// pinned always-resident UNASSIGNED unit, which no per-key query can reach —
// only a scan of the resident rows themselves sees them (found by the
// adversarial verification pass: the first draft unlinked their files).
writeShard("chat_images", "orphaned-rows", [
  { id: "img-o1", chatId: null, filePath: "orphan/null.png", createdAt: "2026-08-28T10:00:00.000Z" },
  { id: "img-o2", filePath: "orphan/missing.png", createdAt: "2026-08-28T10:00:00.000Z" },
  { id: "img-o3", chatId: 42, filePath: "orphan/numeric.png", createdAt: "2026-08-28T10:00:00.000Z" },
]);

const db = await createFileNativeDB();
const leased = () => db._fileStore.getFullyResidentLazyTables();
const resident = () => db._fileStore.getResidentChatUnits();
// The UNASSIGNED "orphaned-rows" unit is resident from boot by design; the
// fixture chats are what the check must not load.
const residentFixtureUnits = () => [...resident()].filter((unit) => unit.startsWith("g"));
try {
  // ── Cross-chat reference found by peek alone: no loads, no lease ──
  assert.equal(
    await galleryFileHasReferences(db, "g1/shared.png"),
    true,
    "a reference in another cold chat's shard is found",
  );
  assert.deepEqual(residentFixtureUnits(), [], "finding a reference by peek loads no units");
  assert.equal(leased().size, 0, "the reference check never leases the table");

  // ── dbName-form row counts as a reference without a load ──
  // (Scan order is sorted, so the g3 hit short-circuits before the untrusted
  // g4/g5/g6 shards are even considered.)
  assert.equal(
    await galleryFileHasReferences(db, "g3/named.png"),
    true,
    "a dbName-form row is a reference the peek can read",
  );
  assert.equal(resident().has("g3"), false, "reading a dbName-form row needs no unit load");
  assert.deepEqual(residentFixtureUnits(), [], "the earlier shards' misses load nothing on the way");

  // ── Corrupt shard: loader handoff loads exactly that unit, .bak wins ──
  assert.equal(
    await galleryFileHasReferences(db, "g4/saved.png"),
    true,
    "a reference recovered from the .bak of a corrupt shard is found",
  );
  assert.deepEqual(
    residentFixtureUnits(),
    ["g4"],
    "only the untrusted shard's unit loads — the handoff short-circuits",
  );

  // ── Lone .bak (interrupted flush): handoff, reference honored ──
  assert.equal(
    await galleryFileHasReferences(db, "g5/interrupted.png"),
    true,
    "a reference that only survives in a lone .bak is honored",
  );
  assert.equal(resident().has("g5"), true, "the lone-.bak unit loads through the ladder");
  assert.equal(resident().has("g6"), false, "the later untrusted shard stays cold behind the short-circuit");

  // ── Malformed row: handoff (repair path), correct negative answer ──
  assert.equal(
    await galleryFileHasReferences(db, "g6/unrelated.png"),
    false,
    "a shard with a malformed row is handed to the loader and still answers correctly",
  );
  assert.equal(resident().has("g6"), true, "the malformed-row shard's unit loads so repair can run");
  assert.equal(leased().size, 0, "no scenario so far leased the table");

  // ── Rows the query layer cannot address still count as references ──
  assert.equal(
    await galleryFileHasReferences(db, "orphan/null.png"),
    true,
    "a row with a null chatId in the orphan unit is a reference",
  );
  assert.equal(
    await galleryFileHasReferences(db, "orphan/missing.png"),
    true,
    "a row with no chatId at all is a reference",
  );
  assert.equal(
    await galleryFileHasReferences(db, "orphan/numeric.png"),
    true,
    "a row with a non-string chatId is a reference",
  );

  // ── Unreferenced path: full sweep over now-trusted shards, no NEW loads ──
  const residentBeforeMiss = residentFixtureUnits();
  assert.equal(await galleryFileHasReferences(db, "g1/gone.png"), false, "an unreferenced path reports false");
  assert.deepEqual(residentFixtureUnits(), residentBeforeMiss, "a full-sweep miss loads no additional units");
  assert.equal(
    await galleryFileHasReferences(db, "g1/gone.png"),
    false,
    "the memoized second sweep answers identically",
  );

  // ── Memory is authoritative for resident units, both directions ──
  await db.insert(chatImages).values(imageRow("img-8", "g1", "g1/fresh.png"));
  assert.equal(
    await galleryFileHasReferences(db, "g1/fresh.png"),
    true,
    "an unflushed new row in a resident unit counts as a reference",
  );
  await db.delete(chatImages).where(and(eq(chatImages.chatId, "g2"), eq(chatImages.id, "img-3")));
  // Premise pin: the assertion below is only meaningful while the deleted row
  // is still in the on-disk shard (inside the flush debounce). If timing ever
  // breaks this, fail loudly instead of testing nothing.
  assert.equal(
    readFileSync(shardPath("chat_images", "g2"), "utf8").includes("img-3"),
    true,
    "the deleted row is still in the stale disk shard when the check runs",
  );
  assert.equal(
    await galleryFileHasReferences(db, "g2/own.png"),
    false,
    "an unflushed delete wins over the stale disk shard — the row does not resurrect",
  );
  assert.equal(leased().size, 0, "the memory pass never leases the table");

  // ── The real deletion flow: unreferenced file removed, referenced kept ──
  mkdirSync(join(dataDir, "gallery", "g2"), { recursive: true });
  writeFileSync(join(dataDir, "gallery", "g2", "own.png"), "bytes");
  assert.equal(
    await unlinkGalleryFileIfUnreferenced({ db, filePath: "g2/own.png" }),
    true,
    "the physical file of a fully-dereferenced image is deleted",
  );
  assert.equal(existsSync(join(dataDir, "gallery", "g2", "own.png")), false, "the file is gone from disk");
  mkdirSync(join(dataDir, "gallery", "g1"), { recursive: true });
  writeFileSync(join(dataDir, "gallery", "g1", "shared.png"), "bytes");
  assert.equal(
    await unlinkGalleryFileIfUnreferenced({ db, filePath: "g1/shared.png" }),
    false,
    "a file another chat still references is kept",
  );
  assert.equal(existsSync(join(dataDir, "gallery", "g1", "shared.png")), true, "the referenced file stays on disk");

  // ── Hash-form shard name: attributed through the eager chats table ──
  assert.equal(
    await galleryFileHasReferences(db, "h9/hashed.png"),
    true,
    "a reference behind an unreadable hash-named shard is recovered via the chats-table match",
  );
  assert.equal(resident().has(hashChatId), true, "the hash-named shard's unit loads through the ladder");
  assert.equal(
    await galleryFileHasReferences(db, "h9/not-there.png"),
    false,
    "the hash-named shard, once attributed and healed, does not poison unrelated answers",
  );

  // ── Junk entries the store's discovery ignores are ignored here too ──
  writeFileSync(join(storeDir, "tables", "chat_images", ".json"), "junk");
  writeFileSync(join(storeDir, "tables", "chat_images", "x.json.tmp"), "junk");
  writeFileSync(join(storeDir, "tables", "chat_images", "y.json.bak.bak"), "junk");
  assert.equal(
    await galleryFileHasReferences(db, "g1/still-gone.png"),
    false,
    "artifact filenames invisible to the store's discovery cannot disable cleanup",
  );

  // ── A non-canonical shard filename no chat matches: conservative TRUE ──
  // "%68" percent-decodes to "h", but encodeShardKey("h") is "h" — a
  // different file — so a naive handoff would read the WRONG shard. With no
  // chat matching the name either, the check must assume referenced, and
  // only after the rest of the sweep found nothing.
  writeFileSync(join(storeDir, "tables", "chat_images", "%68.json"), "{corrupt json!");
  assert.equal(
    await galleryFileHasReferences(db, "g1/shared.png"),
    true,
    "real references are still found ahead of the unattributable-shard fallback",
  );
  assert.equal(
    await galleryFileHasReferences(db, "phantom/nowhere.png"),
    true,
    "an unattributable unreadable shard forces the conservative answer for unproven paths",
  );

  // ── A leased table (from any other source) still answers correctly ──
  await db.select().from(chatImages).where(eq(chatImages.prompt, "force-lease"));
  assert.equal(leased().has("chat_images"), true, "an unscoped query elsewhere still leases (control)");
  assert.equal(
    await galleryFileHasReferences(db, "g1/shared.png"),
    true,
    "with the table leased, the plain-query path answers from memory",
  );
  assert.equal(
    await galleryFileHasReferences(db, "phantom/nowhere.png"),
    false,
    "the lease loads every discovered shard, so the plain-query path is precise again",
  );
} finally {
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Gallery-file-lifecycle regressions passed.");
