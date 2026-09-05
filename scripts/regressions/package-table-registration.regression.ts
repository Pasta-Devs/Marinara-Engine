// Capability packages ship their own fileTable() declarations, and the store
// now accepts them at runtime through db._fileStore.registerTables(). That
// removes the hardcoded allowlist which was the ONLY reason table names were
// safe to join straight into the storage tree, so these regressions drive the
// real store through:
//   - a traversal name (and other hostile shapes) never reaching the disk,
//   - a keyless table being refused before it can fail on first write,
//   - a valid name becoming a real, queryable, sharded table,
//   - re-registration being idempotent rather than redefining a live table,
//   - a package never shadowing an Engine table of the same name,
//   - registered rows surviving a flush and a full store reload,
//   - a shard recovered from its .bak being rewritten instead of re-recovered
//     on every boot,
//   - a shard that recovers to no usable rows being cleared instead of
//     surviving as a permanently corrupt pair,
//   - an unreadable primary AND backup being quarantined for inspection rather
//     than silently overwritten.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Silence the shared logger before the store module is evaluated: these cases
// deliberately provoke a dozen error-level rejections and quarantine reports,
// and the pino-pretty transport worker that would pretty-print them can outlive
// the finished test and hang the runner. Same env-then-dynamic-import shape as
// illustrator-disconnect.regression.ts.
process.env.LOG_LEVEL = "silent";
const { fileTable, text } = await import("../../packages/server/src/db/file-schema.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createFileNativeDB, FILE_BACKED_TABLES } = await import("../../packages/server/src/db/file-backed-store.js");
const { chats } = await import("../../packages/server/src/db/schema/index.js");

/** Every path under `root`, so a rejected name cannot create anything unnoticed. */
function treeSnapshot(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** The storage dir is nested one level inside the sandbox so a traversal that
 *  escapes it still lands somewhere this test can inspect and clean up. */
function tempStorageDir() {
  const sandbox = mkdtempSync(join(tmpdir(), "marinara-pkg-tables-"));
  const dir = join(sandbox, "storage");
  mkdirSync(dir);
  process.env.FILE_STORAGE_DIR = dir;
  return { sandbox, dir };
}

const packageNotes = fileTable("package_demo_notes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

// Every name a package must not be able to persist under. The traversal cases
// are the security point: tableFilePath/shardDirPath do no escaping.
const hostileNames = [
  "../../escaped",
  "..",
  "nested/table",
  "back\\slash",
  "Uppercase",
  "trailing.",
  "with space",
  "_leading",
  "9leading",
  "con",
  "a".repeat(65),
];

await rejectsHostileNames();
await registersAndPersists();
await refusesToShadowEngineTables();
await healsRecoveredShardsOnRegistration();
await clearsShardsThatRecoverToNoRows();
await quarantinesUnreadableShardPairs();
await preservesMalformedRowsOnRegistration();

async function rejectsHostileNames() {
  const { sandbox } = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    // Baseline AFTER a clean flush, so the comparison below sees only what the
    // rejected registrations produced. The whole sandbox is walked, not just the
    // storage dir: a traversal name that escaped would land beside it.
    // Twice: the second flush is what creates the manifest's .bak, so a single
    // one would leave normal store bookkeeping in the diff below.
    await db._fileStore.flush();
    await db._fileStore.flush();
    const before = treeSnapshot(sandbox);

    for (const name of hostileNames) {
      db._fileStore.registerTables([fileTable(name, { id: text("id").primaryKey() })]);
      assert.ok(!FILE_BACKED_TABLES.includes(name), `${name} must not join the file-backed table list`);
    }
    // isFileTable() only proves the metadata symbol is present. A package
    // shipping a broken definition must be skipped, not throw out of the loop
    // and strand the valid tables registered after it in the same call.
    const brokenMetadata = { [Symbol.for("marinara:file-table")]: null } as unknown;
    db._fileStore.registerTables([brokenMetadata, "not a table", null]);

    // A table with no primary key registers cleanly but can never resolve a
    // shard key, so it must be refused up front rather than on first insert.
    db._fileStore.registerTables([fileTable("package_demo_keyless", { body: text("body").notNull() })]);
    assert.ok(!FILE_BACKED_TABLES.includes("package_demo_keyless"), "a table without a primary key is refused");

    await db._fileStore.flush();
    assert.deepEqual(
      treeSnapshot(sandbox).filter((entry) => !before.includes(entry)),
      [],
      "a rejected table name must not create any file or directory, inside or outside the data directory",
    );
  } finally {
    await db._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function registersAndPersists() {
  const { sandbox, dir } = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    db._fileStore.registerTables([packageNotes]);
    assert.ok(FILE_BACKED_TABLES.includes("package_demo_notes"), "a valid package table joins the table list");

    // Idempotent: a package reload registers the same table again and the
    // already-live definition (and its rows) must survive untouched.
    await db.insert(packageNotes).values({ id: "note-1", body: "hello", createdAt: "2026-09-05T10:00:00.000Z" });
    db._fileStore.registerTables([packageNotes]);
    const afterReregister = await db.select().from(packageNotes);
    assert.equal(afterReregister.length, 1, "re-registration must not reset a live table");

    await db._fileStore.flush();
    const shardDir = join(dir, "tables", "package_demo_notes");
    assert.ok(existsSync(shardDir), "a registered table flushes through the shard pipeline");
    assert.ok(
      !existsSync(join(dir, "tables", "package_demo_notes.json")),
      "a registered table must not also grow a flat monolith",
    );
    assert.ok(
      readdirSync(shardDir).some((entry) => entry.endsWith(".json")),
      "the row is written to a shard file",
    );
  } finally {
    await db._fileStore.close();
  }

  // Reload. NOTE: the registries are process-global, so this second store
  // already knows the name and boot-loads it through initialize(); the
  // re-registration below therefore takes the idempotent path. That is the
  // documented constraint, and this case asserts the rows survive either way.
  // registerTables' own shard loading is covered by the cases below, which each
  // use a name this process has never registered.
  const reopened = await createFileNativeDB();
  try {
    reopened._fileStore.registerTables([packageNotes]);
    const rows = await reopened.select().from(packageNotes);
    assert.equal(rows.length, 1, "registered rows survive a flush and a reload");
    assert.equal(rows[0]!.body, "hello", "reloaded rows keep their values");

    await reopened.delete(packageNotes).where(eq(packageNotes.id, "note-1"));
    await reopened._fileStore.flush();
    const remaining = readdirSync(join(dir, "tables", "package_demo_notes")).filter((e) => e.endsWith(".json"));
    assert.equal(remaining.length, 0, "an emptied registered shard is deleted, not left as litter");
  } finally {
    await reopened._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function refusesToShadowEngineTables() {
  const { sandbox } = tempStorageDir();
  const db = await createFileNativeDB();
  try {
    await db.insert(chats).values({
      id: "chat-1",
      name: "Chat",
      mode: "conversation",
      createdAt: "2026-09-05T10:00:00.000Z",
      updatedAt: "2026-09-05T10:00:00.000Z",
    });
    const impostor = fileTable("chats", { id: text("id").primaryKey(), hijacked: text("hijacked").notNull() });
    db._fileStore.registerTables([impostor]);
    const rows = await db.select().from(chats);
    assert.equal(rows.length, 1, "the Engine's own chats table keeps its rows");
    assert.equal(rows[0]!.name, "Chat", "the Engine's own column metadata is not replaced");
    assert.equal(
      FILE_BACKED_TABLES.filter((table) => table === "chats").length,
      1,
      "a shadowing attempt must not duplicate the name in the table list",
    );
  } finally {
    await db._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function preservesMalformedRowsOnRegistration() {
  // Fresh name again, so this goes through registerTables and not the boot loader.
  const packageMetrics = fileTable("package_demo_metrics", {
    id: text("id").primaryKey(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  });
  const { sandbox, dir } = tempStorageDir();
  const shardDir = join(dir, "tables", "package_demo_metrics");
  mkdirSync(shardDir, { recursive: true });
  const shardPath = join(shardDir, "metric-1.json");
  // A readable shard holding one good row and one malformed entry. The next
  // flush rewrites the file from the good row alone, so the malformed entry is
  // about to be destroyed and there is no .bak holding a copy of it.
  writeFileSync(
    shardPath,
    JSON.stringify([{ id: "metric-1", body: "kept", createdAt: "2026-09-05T10:00:00.000Z" }, "not a row"]),
    "utf8",
  );

  const db = await createFileNativeDB();
  try {
    db._fileStore.registerTables([packageMetrics]);
    const rows = await db.select().from(packageMetrics);
    assert.equal(rows.length, 1, "the usable row is kept");
    const preserved = readdirSync(shardDir).filter((entry) => entry.includes(".corrupt-"));
    assert.equal(preserved.length, 1, "the source file is copied aside before the malformed row is dropped");
    assert.ok(
      readFileSync(join(shardDir, preserved[0]!), "utf8").includes("not a row"),
      "the preserved copy still contains the dropped entry",
    );
    await db._fileStore.flush();
    assert.deepEqual(
      JSON.parse(readFileSync(shardPath, "utf8")),
      rows,
      "the shard is rewritten from the usable rows",
    );
  } finally {
    await db._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

console.info("Capability package table registration regressions passed.");

async function healsRecoveredShardsOnRegistration() {
  // A NAME THIS PROCESS HAS NEVER REGISTERED. The metadata registries are
  // module-global, so a name registered by an earlier case is already in
  // FILE_BACKED_TABLES and a later store would boot-load it through
  // initialize() instead of through registerTables — which would quietly test
  // the wrong code path.
  const packageAudits = fileTable("package_demo_audits", {
    id: text("id").primaryKey(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  });
  const { sandbox, dir } = tempStorageDir();
  const shardDir = join(dir, "tables", "package_demo_audits");
  mkdirSync(shardDir, { recursive: true });
  const shardPath = join(shardDir, "audit-1.json");
  // A corrupt primary with a good backup: registration must recover the rows
  // AND mark the shard dirty, or the next boot recovers from .bak all over
  // again, forever.
  writeFileSync(shardPath, "{ this is not json", "utf8");
  writeFileSync(
    `${shardPath}.bak`,
    JSON.stringify([{ id: "audit-1", body: "recovered", createdAt: "2026-09-05T10:00:00.000Z" }]),
    "utf8",
  );

  const db = await createFileNativeDB();
  try {
    db._fileStore.registerTables([packageAudits]);
    const rows = await db.select().from(packageAudits);
    assert.equal(rows.length, 1, "registration loads rows already on disk for a table it has never seen");
    assert.equal(rows[0]?.body, "recovered", "a registered table recovers its shard from the backup");
    await db._fileStore.flush();
    assert.deepEqual(
      JSON.parse(readFileSync(shardPath, "utf8")),
      rows,
      "the recovered shard is rewritten canonically instead of being re-recovered on every boot",
    );
  } finally {
    await db._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function clearsShardsThatRecoverToNoRows() {
  // Again a name this process has never registered, for the same reason.
  const packageTraces = fileTable("package_demo_traces", {
    id: text("id").primaryKey(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  });
  const { sandbox, dir } = tempStorageDir();
  const shardDir = join(dir, "tables", "package_demo_traces");
  mkdirSync(shardDir, { recursive: true });
  const shardPath = join(shardDir, "trace-1.json");
  // Corrupt primary, VALID BUT EMPTY backup: recovery succeeds and yields zero
  // rows, so there is no shard key to dirty. Without a stale-file mark the
  // flush never visits this shard and the corrupt pair is re-recovered and
  // re-logged on every single boot.
  writeFileSync(shardPath, "{ this is not json", "utf8");
  writeFileSync(`${shardPath}.bak`, "[]", "utf8");

  const db = await createFileNativeDB();
  try {
    db._fileStore.registerTables([packageTraces]);
    assert.equal((await db.select().from(packageTraces)).length, 0, "an empty recovery contributes no rows");
    await db._fileStore.flush();
    assert.ok(!existsSync(shardPath), "the unusable shard primary is removed by the next flush");
    assert.ok(!existsSync(`${shardPath}.bak`), "its backup is removed with it");
  } finally {
    await db._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function quarantinesUnreadableShardPairs() {
  // Distinct name again: the registries are process-global, so reusing one
  // would route this through the boot loader instead of registerTables.
  const packageEvents = fileTable("package_demo_events", {
    id: text("id").primaryKey(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  });
  const { sandbox, dir } = tempStorageDir();
  const shardDir = join(dir, "tables", "package_demo_events");
  mkdirSync(shardDir, { recursive: true });
  const shardPath = join(shardDir, "event-1.json");
  // NEITHER file parses: the rows are unrecoverable, so the bytes are the only
  // thing left worth keeping. They must be moved aside for manual recovery, not
  // left in place for the next flush to overwrite.
  writeFileSync(shardPath, "{ this is not json", "utf8");
  writeFileSync(`${shardPath}.bak`, "also not json", "utf8");

  const db = await createFileNativeDB();
  try {
    db._fileStore.registerTables([packageEvents]);
    assert.equal((await db.select().from(packageEvents)).length, 0, "an unreadable shard contributes no rows");
    const quarantined = readdirSync(shardDir).filter((entry) => entry.includes(".corrupt-"));
    assert.equal(quarantined.length, 2, "both the primary and its backup are quarantined");
    assert.ok(!existsSync(shardPath), "the unreadable primary is moved aside, not left in place");
    assert.deepEqual(
      db._fileStore.getQuarantinedTables().map((entry) => entry.table),
      ["package_demo_events"],
      "the quarantine is reported against the registered table",
    );
    await db._fileStore.flush();
    assert.deepEqual(
      readdirSync(shardDir).filter((entry) => entry.includes(".corrupt-")).length,
      2,
      "a flush does not disturb the preserved files",
    );
  } finally {
    await db._fileStore.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}
