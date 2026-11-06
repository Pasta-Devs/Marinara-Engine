// Optimistic cold-history scans must be invalidated by lazy-load repairs,
// including repairs that do not pass through an ordinary insert/update/delete.
import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = fs.mkdtempSync(join(tmpdir(), "marinara-load-heal-generation-"));
process.env.DATA_DIR = root;
process.env.MARINARA_ENV_FILE = join(root, ".env");
delete process.env.MARINARA_EAGER_STORAGE;
fs.writeFileSync(process.env.MARINARA_ENV_FILE, "");
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { register } = await import(pathToFileURL(serverRequire.resolve("tsx/esm/api")).href);
const unregister = register();

try {
  const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.ts");
  const { eq } = await import("../../packages/server/src/db/file-query.ts");
  const { messages } = await import("../../packages/server/src/db/schema/index.ts");
  const { unlinkAvatarFilesIfUnreferenced } =
    await import("../../packages/server/src/services/image/avatar-file-lifecycle.ts");
  const at = "2026-10-23T00:00:00.000Z";
  const avatar = "/api/avatars/file/protected.png";
  const extra = JSON.stringify({ personaSnapshot: { avatarUrl: avatar } });
  const message = (id, chatId, metadata = "{}") => ({
    id,
    chatId,
    role: "user",
    content: "fixture",
    extra: metadata,
    createdAt: at,
  });
  let storage;
  const shard = (table, key) => join(storage, "tables", table, `${encodeShardKey(key)}.json`);
  const write = (table, key, rows) => {
    fs.mkdirSync(join(storage, "tables", table), { recursive: true });
    fs.writeFileSync(shard(table, key), JSON.stringify(rows));
  };
  const fixture = async (name, seed, check) => {
    storage = join(root, name);
    process.env.FILE_STORAGE_DIR = storage;
    seed();
    const db = await createFileNativeDB();
    try {
      await check(db);
    } finally {
      await db._fileStore.close();
    }
    console.log(`PASS ${name}`);
  };
  const chat = (id) => write("chats", id, [{ id, name: id, mode: "conversation", createdAt: at, updatedAt: at }]);
  const generation = (db, table = "messages") => db._fileStore.getTableWriteGeneration(table);
  const load = (db, id) => db.select().from(messages).where(eq(messages.chatId, id));

  await fixture(
    "clean-read",
    () => {
      chat("clean");
      write("messages", "clean", [message("clean-message", "clean")]);
    },
    async (db) => {
      const before = generation(db);
      assert.equal((await load(db, "clean")).length, 1);
      await db._fileStore.flush();
      assert.equal(generation(db), before, "a clean lazy read/flush must not invalidate a history snapshot");
    },
  );

  await fixture(
    "staged-gc-rehome",
    () => {
      chat("a");
      chat("c");
      write("messages", "a", [message("a-own", "a"), message("stray", "c", extra)]);
      write("messages", "c", [message("c-own", "c")]);
    },
    async (db) => {
      const avatarRoot = join(storage, "avatars");
      fs.mkdirSync(avatarRoot);
      const protectedFile = join(avatarRoot, "protected.png");
      fs.writeFileSync(protectedFile, "protected");
      const before = generation(db);
      const initialLeases = [...db._fileStore.getFullyResidentLazyTables()].sort();
      const originalRead = fsPromises.readFile;
      const originalReaddir = fsPromises.readdir;
      let sampledC;
      let sampledA;
      let relocated = false;
      fsPromises.readdir = async function (path, ...args) {
        const entries = await originalReaddir.call(this, path, ...args);
        if (String(path) === join(storage, "tables", "messages")) {
          entries.sort((a, b) => Number(b === "c.json") - Number(a === "c.json"));
        }
        return entries;
      };
      fsPromises.readFile = async function (path, ...args) {
        const contents = await originalRead.call(this, path, ...args);
        if (String(path) === shard("messages", "c") && sampledC === undefined) {
          sampledC = String(contents);
          // The scanner has C's old bytes. A real lazy read now moves the
          // only avatar reference from A into C, then flush rewrites A.
          await load(db, "a");
          await db._fileStore.flush();
          relocated = true;
        } else if (String(path) === shard("messages", "a") && relocated) {
          sampledA = String(contents);
        }
        return contents;
      };
      syncBuiltinESMExports();
      let deleted;
      try {
        deleted = await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [avatar] });
      } finally {
        fsPromises.readFile = originalRead;
        fsPromises.readdir = originalReaddir;
        syncBuiltinESMExports();
      }
      assert.equal(relocated, true, "the real load and flush must complete inside the cold-read pause");
      assert.equal(typeof sampledC, "string");
      assert.equal(typeof sampledA, "string", "the scanner must continue through A after the rehome");
      assert.equal(sampledC.includes(avatar), false, "C-before must contain no frozen reference");
      assert.equal(sampledA.includes(avatar), false, "A-after must contain no frozen reference");
      assert.equal(fs.readFileSync(shard("messages", "c"), "utf8").includes(avatar), true);
      assert.equal(deleted, 0);
      assert.equal(fs.existsSync(protectedFile), true, "staged GC must retain the relocated frozen avatar");
      assert.ok(generation(db) > before, "the load-side repair must invalidate the mixed cold-file snapshot");
      assert.deepEqual([...db._fileStore.getFullyResidentLazyTables()].sort(), initialLeases);
    },
  );

  await fixture(
    "stray-rehome",
    () => {
      chat("a");
      chat("c");
      write("messages", "a", [message("a-own", "a"), message("stray", "c", extra)]);
      write("messages", "c", [message("c-own", "c")]);
    },
    async (db) => {
      const before = await db.transaction(() => generation(db));
      const earlierC = fs.readFileSync(shard("messages", "c"), "utf8");
      assert.equal(earlierC.includes(avatar), false);
      await load(db, "a");
      const afterLoad = generation(db);
      assert.ok(afterLoad > before, "re-homing a frozen reference must invalidate the earlier cold-file snapshot");
      await db._fileStore.flush();
      assert.equal(generation(db), afterLoad, "persisting an already recorded repair is not a new graph change");
      assert.equal(fs.readFileSync(shard("messages", "a"), "utf8").includes(avatar), false);
      assert.equal(fs.readFileSync(shard("messages", "c"), "utf8").includes(avatar), true);
      assert.ok(db._fileStore.getResidentLazyRows("messages").some((row) => row.extra === extra));
    },
  );

  await fixture(
    "canonical-replacement",
    () => {
      chat("a");
      chat("c");
      write("messages", "a", [message("a-own", "a"), message("same-id", "c")]);
      write("messages", "c", [message("same-id", "c", extra)]);
    },
    async (db) => {
      const originalRead = fs.readFileSync;
      let beforeCanonical;
      // Observe the real boundary after the stray is resident and before the
      // clean canonical shard replaces it; the earlier rehome bump is insufficient.
      fs.readFileSync = function (path, ...args) {
        if (String(path) === shard("messages", "c")) {
          const stray = db._fileStore.getResidentLazyRows("messages").find((row) => row.id === "same-id");
          assert.equal(stray?.extra, "{}", "the stale stray must be resident before its canonical copy loads");
          beforeCanonical = generation(db);
        }
        return originalRead.call(this, path, ...args);
      };
      syncBuiltinESMExports();
      try {
        await load(db, "a");
      } finally {
        fs.readFileSync = originalRead;
        syncBuiltinESMExports();
      }
      assert.equal(typeof beforeCanonical, "number", "the scoped query must pull the canonical unit in transitively");
      assert.equal(db._fileStore.getResidentLazyRows("messages").find((row) => row.id === "same-id")?.extra, extra);
      assert.ok(generation(db) > beforeCanonical, "a clean canonical replacement must invalidate the stray snapshot");
    },
  );

  for (const kind of ["malformed-only", "unreadable", "backup-recovery", "empty-backup"]) {
    await fixture(
      kind,
      () => {
        chat(kind);
        write("messages", kind, [message(`${kind}-message`, kind)]);
        write("message_trash", kind, kind === "malformed-only" ? [null] : []);
        if (kind !== "malformed-only") {
          fs.writeFileSync(shard("message_trash", kind), "{broken");
          const backup =
            kind === "unreadable"
              ? "{also-broken"
              : JSON.stringify(
                  kind === "empty-backup"
                    ? []
                    : [
                        {
                          id: "deleted",
                          chatId: kind,
                          messageId: "deleted-message",
                          role: "user",
                          content: "deleted",
                          messageCreatedAt: at,
                          deletedAt: at,
                          snapshot: JSON.stringify({ message: message("deleted-message", kind, extra), swipes: [] }),
                        },
                      ],
                );
          fs.writeFileSync(`${shard("message_trash", kind)}.bak`, backup);
        }
      },
      async (db) => {
        const before = generation(db, "message_trash");
        assert.ok(fs.existsSync(shard("message_trash", kind)), "the lazy trash shard must remain cold at boot");
        assert.equal(
          db._fileStore.getQuarantinedTables().some((entry) => entry.table === "message_trash"),
          false,
        );
        await load(db, kind);
        assert.ok(generation(db, "message_trash") > before, `${kind} load repair must invalidate a history snapshot`);
        if (kind === "malformed-only" || kind === "unreadable") {
          assert.equal(fs.existsSync(shard("message_trash", kind)), false, "unrecoverable primary must be quarantined");
          const files = db._fileStore
            .getQuarantinedTables()
            .filter((entry) => entry.table === "message_trash")
            .flatMap((entry) => entry.files);
          assert.ok(
            files.length > 0 && files.every((file) => fs.existsSync(file.to)),
            "quarantined bytes must remain recoverable",
          );
        } else if (kind === "backup-recovery") {
          assert.ok(db._fileStore.getResidentLazyRows("message_trash").some((row) => row.snapshot.includes(avatar)));
        }
        await db._fileStore.flush();
        if (kind === "empty-backup") {
          assert.equal(
            fs.existsSync(shard("message_trash", kind)),
            false,
            "a recovered empty shard must not recur forever",
          );
          assert.equal(fs.existsSync(`${shard("message_trash", kind)}.bak`), false);
        }
      },
    );
  }
} finally {
  await unregister();
  fs.rmSync(root, { recursive: true, force: true });
}
