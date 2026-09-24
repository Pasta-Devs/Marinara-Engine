// Server hunt batch 1 regressions (file-backed store + background seed):
//   - an emptied table's leftover shard directory never revives the stale
//     .pre-shard monolith after a crash before the manifest rewrite,
//   - timestamp (Windows) boot ids tolerate clock steps: a shifted
//     LastBootUpTime never reclaims a live writer's lease, while a real reboot
//     still reclaims even when no PID proof is usable,
//   - joined selects pre-filter the base table and hash equality joins, with
//     results identical to the nested loop,
//   - the background seed preserves an unreadable meta.json instead of
//     overwriting it, and survives a JSON null.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";
const tempRoot = mkdtempSync(join(tmpdir(), "marinara-hunt-b1-"));
process.env.DATA_DIR = tempRoot;

const { and, eq, ne } = await import("../../packages/server/src/db/file-query.js");
const {
  createFileNativeDB,
  STORAGE_VERSION,
  STORAGE_WRITER_LEASE_FILENAME,
  STORAGE_WRITER_OWNER_FILENAME,
  StorageWriterLeaseError,
  writerLeaseFromEarlierBoot,
} = await import("../../packages/server/src/db/file-backed-store.js");
const { chats, messages, messageSwipes } = await import("../../packages/server/src/db/schema/index.js");
const { seedDefaultBackgrounds } = await import("../../packages/server/src/db/seed-backgrounds.js");

function storageDir(label: string) {
  const dir = mkdtempSync(join(tempRoot, `${label}-`));
  process.env.FILE_STORAGE_DIR = dir;
  return dir;
}

const messageRow = (id: string, chatId: string, content: string, second = 0) => ({
  id,
  chatId,
  role: "user",
  content,
  createdAt: `2026-08-08T10:00:${String(second % 60).padStart(2, "0")}.000Z`,
});

function writeManifest(dir: string, messageCount: number) {
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: "2026-08-10T00:00:00.000Z",
      backend: "file-native",
      tables: { messages: messageCount },
      shards: { messages: messageCount },
    }),
  );
}

try {
  // ── 1. Emptied table + crash before manifest rewrite: no resurrection ──
  {
    const dir = storageDir("emptied");
    mkdirSync(join(dir, "tables", "messages"), { recursive: true });
    writeFileSync(
      join(dir, "tables", "messages.json.pre-shard"),
      JSON.stringify([messageRow("m-deleted", "chat-deleted", "must stay deleted")]),
    );
    // The stale manifest still counts the rows the user just deleted.
    writeManifest(dir, 1);
    const db = await createFileNativeDB();
    try {
      assert.equal(
        (await db.select().from(messages)).length,
        0,
        "an empty shard directory (deliberately emptied table) never revives the .pre-shard backup",
      );
      assert.ok(existsSync(join(dir, "tables", "messages.json.pre-shard")), "the backup itself is left alone");
      assert.ok(!existsSync(join(dir, "tables", "messages.json")), "no monolith is copied back into place");
    } finally {
      await db._fileStore.close();
    }
  }
  // The restored-profile case (#4845) still recovers when the directory is gone.
  {
    const dir = storageDir("restored");
    mkdirSync(join(dir, "tables"), { recursive: true });
    writeFileSync(
      join(dir, "tables", "messages.json.pre-shard"),
      JSON.stringify([messageRow("m-restored", "chat-restored", "history survives reinstall")]),
    );
    writeManifest(dir, 1);
    const db = await createFileNativeDB();
    try {
      const rows = await db.select().from(messages);
      assert.equal(rows.length, 1, "a missing shard directory still recovers the preserved backup");
    } finally {
      await db._fileStore.close();
    }
  }

  // ── 2. Timestamp (Windows) boot ids: clock steps never reclaim a live
  //       lease, a real reboot still does even without any PID proof ──
  {
    const hour = 3_600_000;
    const iso = (ms: number) => new Date(ms).toISOString().replace(/Z$/u, "0000Z");
    const processStart = Date.now() - Math.round(process.uptime() * 1000);
    const currentBoot = iso(processStart - hour);
    // Pure decision checks (opaque ids compare exactly, as on Linux).
    assert.equal(writerLeaseFromEarlierBoot({ bootId: "boot-a", acquiredAt: iso(Date.now()) }, "boot-b"), true);
    assert.equal(writerLeaseFromEarlierBoot({ bootId: "boot-a", acquiredAt: iso(Date.now()) }, "boot-a"), false);
    assert.equal(
      writerLeaseFromEarlierBoot({ bootId: iso(processStart - hour - 30_000), acquiredAt: iso(Date.now()) }, currentBoot),
      false,
      "an NTP-shifted LastBootUpTime on a lease acquired after this boot is not an earlier boot",
    );
    assert.equal(
      writerLeaseFromEarlierBoot(
        { bootId: iso(processStart - 48 * hour), acquiredAt: iso(processStart - 47 * hour) },
        currentBoot,
      ),
      true,
      "a lease acquired before the current boot started is from an earlier boot",
    );

    const dir = storageDir("lease");
    const leaseDir = join(dir, STORAGE_WRITER_LEASE_FILENAME);
    const ownerFile = join(leaseDir, STORAGE_WRITER_OWNER_FILENAME);
    const first = await createFileNativeDB({ writerLeaseBootId: currentBoot });
    const template = JSON.parse(readFileSync(ownerFile, "utf8")) as Record<string, unknown>;
    await first._fileStore.close();
    assert.equal(template.version, 4);
    const readToken = () => (JSON.parse(readFileSync(ownerFile, "utf8")) as { token: string }).token;

    // A live owner (this very process, lease taken after it started) whose
    // recorded LastBootUpTime differs from ours only by a clock step.
    mkdirSync(leaseDir, { recursive: true });
    writeFileSync(
      ownerFile,
      JSON.stringify({
        ...template,
        pid: process.pid,
        bootId: iso(processStart - hour - 30_000),
        token: "live-owner-token",
        acquiredAt: new Date().toISOString(),
      }),
    );
    await assert.rejects(
      createFileNativeDB({ writerLeaseBootId: currentBoot }),
      StorageWriterLeaseError,
      "a shifted LastBootUpTime must not reclaim a live writer's lease",
    );
    assert.equal(readToken(), "live-owner-token", "the live owner's lease is untouched");
    rmSync(leaseDir, { recursive: true, force: true });

    // Review problem (a): an unidentified Windows writer (hostId null, no
    // pidNamespace, as every real Windows lease) on machine-local storage has
    // no usable PID proof, so the boot proof alone must reclaim it after a
    // real reboot. The PID is this live process, so only the boot proof can
    // reclaim it.
    mkdirSync(leaseDir, { recursive: true });
    writeFileSync(
      ownerFile,
      JSON.stringify({
        ...template,
        hostId: null,
        pidNamespace: undefined,
        scopeId: undefined,
        pid: process.pid,
        bootId: iso(processStart - 48 * hour),
        token: "unidentified-earlier-boot-token",
        acquiredAt: iso(processStart - 47 * hour),
      }),
    );
    const afterReboot = await createFileNativeDB({
      writerLeaseBootId: currentBoot,
      writerLeaseStorageIsMachineLocal: true,
    });
    assert.notEqual(
      readToken(),
      "unidentified-earlier-boot-token",
      "an unidentified writer from an earlier boot is reclaimed without any PID proof",
    );
    await afterReboot._fileStore.close();

    // Review problem (b) (a reused PID owned by a process we cannot
    // inspect) is covered by the same path: the boot proof runs before any
    // PID check, and the fixture above reclaims with no usable PID proof.
  }

  // ── 3. Joined selects: pre-filter + hash join, identical results ──
  {
    storageDir("join");
    const db = await createFileNativeDB();
    try {
      // One chat keeps the flush to a couple of shard files; both sides of the
      // join still hold thousands of resident rows.
      const count = 3000;
      await db.insert(chats).values({ id: "chat-1", name: "Target", mode: "conversation" });
      await db
        .insert(messages)
        .values(Array.from({ length: count }, (_, i) => messageRow(`m-${i}`, "chat-1", `hello ${i}`, i)));
      const swipeRows = Array.from({ length: count }, (_, i) => ({
        id: `s-${i}`,
        messageId: `m-${i}`,
        index: 0,
        content: `swipe ${i}`,
        createdAt: "2026-08-08T10:00:00.000Z",
      }));
      swipeRows.push({ ...swipeRows[0]!, id: "s-orphan", messageId: "m-missing" });
      await db.insert(messageSwipes).values(swipeRows);

      const started = performance.now();
      const byBaseWhere = await db
        .select({ id: messageSwipes.id, content: messages.content })
        .from(messageSwipes)
        .innerJoin(messages, eq(messageSwipes.messageId, messages.id))
        .where(eq(messageSwipes.messageId, "m-7"));
      const byJoinedWhere = await db
        .select({ id: messageSwipes.id, content: messages.content })
        .from(messageSwipes)
        .innerJoin(messages, eq(messages.id, messageSwipes.messageId))
        .where(eq(messages.content, "hello 7"));
      const elapsed = performance.now() - started;

      assert.deepEqual(byBaseWhere, [{ id: "s-7", content: "hello 7" }]);
      assert.deepEqual(byJoinedWhere, [{ id: "s-7", content: "hello 7" }]);
      // Each query was ~9M pair evaluations and allocations with the old
      // nested loop; the pre-filter and hash join make them linear.
      assert.ok(elapsed < 1500, `joined selects stay linear (took ${Math.round(elapsed)} ms)`);

      // Every swipe except the orphan joins exactly once.
      const all = await db
        .select({ id: messageSwipes.id })
        .from(messageSwipes)
        .innerJoin(messages, eq(messageSwipes.messageId, messages.id));
      assert.equal(all.length, count, "the hash join drops only rows with no matching key");

      // Non-equality joins keep the nested loop and its semantics.
      const nonEq = await db
        .select({ id: messageSwipes.id, messageId: messages.id })
        .from(messageSwipes)
        .innerJoin(messages, and(ne(messageSwipes.messageId, messages.id), eq(messages.id, "m-1")))
        .where(eq(messageSwipes.id, "s-2"));
      assert.deepEqual(nonEq, [{ id: "s-2", messageId: "m-1" }]);
    } finally {
      await db._fileStore.close();
    }
  }

  // ── 4. Background seed keeps an unreadable meta.json ──
  {
    const bgDir = join(tempRoot, "backgrounds-torn");
    mkdirSync(bgDir, { recursive: true });
    writeFileSync(join(bgDir, "custom.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const torn = '{"custom.jpg":{"tags":["my","tag';
    writeFileSync(join(bgDir, "meta.json"), torn);
    await seedDefaultBackgrounds(bgDir);
    const preserved = readdirSync(bgDir).filter((name) => name.startsWith("meta.json.corrupt-"));
    assert.equal(preserved.length, 1, "the unreadable meta.json is preserved for manual recovery");
    assert.equal(readFileSync(join(bgDir, preserved[0]!), "utf8"), torn);
    const rebuilt = JSON.parse(readFileSync(join(bgDir, "meta.json"), "utf8")) as Record<string, { tags: string[] }>;
    assert.deepEqual(rebuilt["Black.jpg"]?.tags, ["black", "plain", "dark"]);

    // A JSON null no longer throws (it used to crash startup).
    const nullDir = join(tempRoot, "backgrounds-null");
    mkdirSync(nullDir, { recursive: true });
    writeFileSync(join(nullDir, "custom.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    writeFileSync(join(nullDir, "meta.json"), "null");
    await seedDefaultBackgrounds(nullDir);
    assert.ok(JSON.parse(readFileSync(join(nullDir, "meta.json"), "utf8"))["Black.jpg"]);

    // A healthy meta.json with nothing to add is not rewritten.
    const healthyDir = join(tempRoot, "backgrounds-healthy");
    mkdirSync(healthyDir, { recursive: true });
    writeFileSync(join(healthyDir, "custom.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const healthy = '{"Black.jpg":{"tags":["mine"]},"custom.jpg":{"tags":["keep"]}}';
    writeFileSync(join(healthyDir, "meta.json"), healthy);
    await seedDefaultBackgrounds(healthyDir);
    assert.equal(readFileSync(join(healthyDir, "meta.json"), "utf8"), healthy, "no needless rewrite");
    assert.deepEqual(
      readdirSync(healthyDir).filter((name) => name.startsWith("meta.json.")),
      [],
      "no temp or corrupt files are left behind",
    );
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("server-hunt-b1 regressions passed");
