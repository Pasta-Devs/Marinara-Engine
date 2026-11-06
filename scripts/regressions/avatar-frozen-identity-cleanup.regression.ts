import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Bind all module-level paths to disposable storage before importing production code.
const root = mkdtempSync(join(tmpdir(), "marinara-frozen-avatar-cleanup-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.MARINARA_ENV_FILE = join(root, ".env");
delete process.env.MARINARA_EAGER_STORAGE;
writeFileSync(process.env.MARINARA_ENV_FILE, "");
const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { appSettings, chats, messages, messageSwipes, messageTrash, personas } =
  await import("../../packages/server/src/db/schema/index.js");
const {
  deleteAbandonedAvatarFiles,
  scanAbandonedAvatarFiles,
  unlinkAvatarFilesIfUnreferenced,
  withAvatarFileLifecycleLock,
} = await import("../../packages/server/src/services/image/avatar-file-lifecycle.js");

const avatarRoot = join(root, "avatars");
mkdirSync(avatarRoot);
const at = new Date().toISOString();
const pathFor = (name: string) => join(avatarRoot, name);
const urlFor = (name: string) => `/api/avatars/file/${encodeURIComponent(name)}?v=frozen`;
const extraFor = (name: string) =>
  JSON.stringify({ personaSnapshot: { name: "Past persona", avatarUrl: urlFor(name) } });
const message = (id: string, chatId: string, extra = "{}") => ({
  id,
  chatId,
  role: "user",
  content: "Frozen identity",
  extra,
  createdAt: at,
});
const shardPath = (table: string, id: string) => join(root, "storage", "tables", table, `${encodeShardKey(id)}.json`);
const writeAvatar = (name: string) => writeFileSync(pathFor(name), name);
async function duringColdRead<T>(operation: () => Promise<T>, during: () => Promise<unknown>): Promise<T> {
  const readDirectory = fsPromises.readdir;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached!: () => void;
  const paused = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let held = false;
  fsPromises.readdir = (async (...args: Parameters<typeof readDirectory>) => {
    if (!held && String(args[0]).endsWith(join("tables", "messages"))) {
      held = true;
      reached();
      await released;
    }
    return readDirectory(...args);
  }) as typeof readDirectory;
  syncBuiltinESMExports();
  const pending = operation();
  try {
    await Promise.race([
      paused,
      pending.then(() => {
        throw new Error("cleanup did not reach cold history I/O");
      }),
    ]);
    await during();
  } finally {
    release();
    fsPromises.readdir = readDirectory;
    syncBuiltinESMExports();
    await pending;
  }
  return pending;
}
for (const name of ["message.png", "swipe.png", "trash-message.png", "trash-swipe.png", "backup.png", "orphan.png"])
  writeAvatar(name);
let db = await createFileNativeDB();
try {
  for (const id of ["message", "swipe", "trash", "backup", "race"]) {
    await db.insert(chats).values({ id, name: id, mode: "conversation", createdAt: at, updatedAt: at });
  }
  await db.insert(messages).values(message("m-message", "message", extraFor("message.png")));
  await db.insert(messages).values(message("m-swipe", "swipe"));
  await db.insert(messageSwipes).values({
    id: "s-history",
    messageId: "m-swipe",
    index: 1,
    content: "Past swipe",
    extra: extraFor("swipe.png"),
    createdAt: at,
  });
  await db.insert(messageTrash).values({
    id: "trash",
    chatId: "trash",
    messageId: "deleted",
    role: "user",
    content: "Deleted",
    messageCreatedAt: at,
    deletedAt: at,
    snapshot: JSON.stringify({
      message: message("deleted", "trash", extraFor("trash-message.png")),
      swipes: [{ id: "deleted-swipe", messageId: "deleted", index: 1, extra: extraFor("trash-swipe.png") }],
    }),
  });
  await db.insert(messages).values(message("m-backup", "backup", extraFor("backup.png")));
  await db._fileStore.close();
  db = await createFileNativeDB();
  const initialResident = [...db._fileStore.getResidentChatUnits()].sort();
  const initialLeased = [...db._fileStore.getFullyResidentLazyTables()].sort();
  const input = { db, avatarRoot, nowMs: Date.now() + 11 * 60_000 };
  assert.deepEqual(
    await scanAbandonedAvatarFiles(input),
    { files: 1, bytes: Buffer.byteLength("orphan.png") },
    "scan must not count frozen current messages, inactive swipes or restorable trash as abandoned",
  );
  assert.deepEqual(await deleteAbandonedAvatarFiles(input), { files: 1, bytes: Buffer.byteLength("orphan.png") });
  assert.equal(existsSync(pathFor("orphan.png")), false, "truly abandoned avatars must still be collected");
  for (const name of ["message.png", "swipe.png", "trash-message.png", "trash-swipe.png", "backup.png"])
    assert.equal(existsSync(pathFor(name)), true, `${name} must survive optimizer cleanup`);
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({
      db,
      avatarRoot,
      avatarPaths: [urlFor("message.png"), urlFor("swipe.png"), urlFor("trash-swipe.png")],
    }),
    0,
    "direct final-card cleanup must honor the same frozen references",
  );
  assert.deepEqual(
    [...db._fileStore.getResidentChatUnits()].sort(),
    initialResident,
    "cleanup must not load cold chats",
  );
  assert.deepEqual(
    [...db._fileStore.getFullyResidentLazyTables()].sort(),
    initialLeased,
    "cleanup must never lease history tables",
  );

  // A crash can leave only a backup; cleanup must inspect it without repairing storage.
  const backupPath = shardPath("messages", "backup");
  renameSync(backupPath, `${backupPath}.bak`);
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("backup.png")] }), 0);
  assert.equal(existsSync(backupPath), false, "cleanup must not repair or rewrite a cold shard");
  renameSync(`${backupPath}.bak`, backupPath);

  // Resident memory wins over stale disk in both directions.
  await db.delete(messages).where(eq(messages.id, "m-message"));
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("message.png")] }),
    1,
    "a committed unflushed deletion must not resurrect the old on-disk reference",
  );
  writeAvatar("new.png");
  await db.insert(messages).values(message("m-new", "race", extraFor("new.png")));
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("new.png")] }),
    0,
    "an unflushed identity insertion must preserve its avatar",
  );

  // Once every candidate is protected, unrelated cold history must not prolong the write gate.
  const readResidentRows = db._fileStore.getResidentLazyRows;
  let laterTableReads = 0;
  db._fileStore.getResidentLazyRows = (table) => {
    if (table !== "messages") laterTableReads++;
    return readResidentRows(table);
  };
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("new.png")] }), 0);
  db._fileStore.getResidentLazyRows = readResidentRows;
  assert.equal(laterTableReads, 0, "finding every candidate must stop before scanning later history tables");

  // A temporary deletion in another transaction is not a committed release.
  let transactionStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    transactionStarted = resolve;
  });
  let rollback!: () => void;
  const release = new Promise<void>((resolve) => {
    rollback = resolve;
  });
  const transaction = db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.id, "m-new"));
    transactionStarted();
    await release;
    throw new Error("rollback identity deletion");
  });
  const rejectedTransaction = assert.rejects(transaction, /rollback identity deletion/u);
  await started;
  let cleanupSettled = false;
  const cleanup = unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("new.png")] }).then(
    (count) => {
      cleanupSettled = true;
      return count;
    },
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(cleanupSettled, false, "cleanup waits for committed storage rather than deleting during a transaction");
  rollback();
  await rejectedTransaction;
  assert.equal(await cleanup, 0);
  assert.equal(existsSync(pathFor("new.png")), true, "rollback must retain the committed avatar");

  // Cleanup-only failure must not quarantine a shard or delete even a possible orphan.
  writeAvatar("unknown.png");
  const coldPath = shardPath("message_swipes", "swipe");
  const goodShard = readFileSync(coldPath);
  writeFileSync(coldPath, "{unreadable shard");
  assert.deepEqual(await deleteAbandonedAvatarFiles(input), { files: 0, bytes: 0 });
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("unknown.png")] }), 0);
  assert.equal(existsSync(pathFor("unknown.png")), true);
  assert.equal(readFileSync(coldPath, "utf8"), "{unreadable shard", "inspection must leave damaged storage untouched");
  writeFileSync(coldPath, goodShard);

  const residentRows = db._fileStore.getResidentLazyRows;
  let historyReads = 0;
  db._fileStore.getResidentLazyRows = () => {
    historyReads++;
    throw new Error("injected cleanup read failure");
  };
  await db.insert(personas).values({
    id: "card-owned",
    name: "Current owner",
    avatarPath: urlFor("unknown.png"),
    createdAt: at,
    updatedAt: at,
  });
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("unknown.png")] }), 0);
  assert.equal(historyReads, 0, "card-owned files require no expensive history scan");
  await db.delete(personas).where(eq(personas.id, "card-owned"));
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("unknown.png")] }), 0);
  db._fileStore.getResidentLazyRows = residentRows;
  assert.equal(existsSync(pathFor("unknown.png")), true);

  // Last reference released: preserve retention until trash is actually purged, then collect.
  await db.delete(messageTrash).where(eq(messageTrash.id, "trash"));
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({
      db,
      avatarRoot,
      avatarPaths: [urlFor("trash-message.png"), urlFor("trash-swipe.png")],
    }),
    2,
  );

  // Each public cleanup path leaves unrelated writers free during cold I/O.
  for (const mode of ["scan", "delete", "direct"] as const) {
    const name = `progress-${mode}.png`;
    writeAvatar(name);
    let write: Promise<unknown> | undefined;
    let completedWhilePaused = false;
    const count = await duringColdRead(
      async () => {
        if (mode === "direct") return unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor(name)] });
        return (await (mode === "scan" ? scanAbandonedAvatarFiles(input) : deleteAbandonedAvatarFiles(input))).files;
      },
      async () => {
        let wrote = false;
        write = db
          .insert(appSettings)
          .values({ key: `progress-${mode}`, value: "done", updatedAt: at })
          .then(() => {
            wrote = true;
          });
        await new Promise<void>((resolve) => setImmediate(resolve));
        completedWhilePaused = wrote;
      },
    );
    await write;
    assert.equal(completedWhilePaused, true, `${mode} must not hold the write gate during cold I/O`);
    assert.ok(count > 0);
    assert.equal(existsSync(pathFor(name)), mode === "scan");
    rmSync(pathFor(name), { force: true });
  }

  // Real identity writers need both the avatar lifecycle lock and the storage write gate.
  for (const mode of ["scan", "delete", "direct"] as const) {
    const name = `identity-progress-${mode}.png`;
    writeAvatar(name);
    let writer: Promise<unknown> | undefined;
    let completedWhilePaused = false;
    const count = await duringColdRead(
      async () => {
        if (mode === "direct") return unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor(name)] });
        return (await (mode === "scan" ? scanAbandonedAvatarFiles(input) : deleteAbandonedAvatarFiles(input))).files;
      },
      async () => {
        let wrote = false;
        writer = withAvatarFileLifecycleLock(async () => {
          await db
            .update(messages)
            .set({ content: `identity writer ${mode}` })
            .where(eq(messages.id, "m-new"));
          wrote = true;
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        completedWhilePaused = wrote;
      },
    );
    await writer;
    assert.equal(completedWhilePaused, true, `${mode} must release both gates during cold I/O`);
    assert.equal(count, 0, "a completed history writer invalidates the captured generation");
    assert.equal(existsSync(pathFor(name)), true);
  }

  // Any history-table write after capture invalidates the whole reclamation pass.
  for (const table of ["messages", "message_swipes", "message_trash"] as const) {
    const name = `changed-${table}.png`;
    writeAvatar(name);
    const removed = await duringColdRead(
      () => unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor(name)] }),
      async () => {
        if (table === "messages")
          await db
            .update(messages)
            .set({ extra: extraFor(name) })
            .where(eq(messages.id, "m-new"));
        else if (table === "message_swipes")
          await db
            .update(messageSwipes)
            .set({ extra: extraFor(name) })
            .where(eq(messageSwipes.id, "s-history"));
        else
          await db.insert(messageTrash).values({
            id: "phase-trash",
            chatId: "trash",
            messageId: "phase-deleted",
            role: "user",
            content: "Deleted",
            messageCreatedAt: at,
            deletedAt: at,
            snapshot: JSON.stringify({ message: message("phase-deleted", "trash", extraFor(name)), swipes: [] }),
          });
      },
    );
    assert.equal(removed, 0, `${table} generation change must retain every candidate`);
    assert.equal(existsSync(pathFor(name)), true);
  }
  await db
    .update(messages)
    .set({ extra: extraFor("new.png") })
    .where(eq(messages.id, "m-new"));
  await db
    .update(messageSwipes)
    .set({ extra: extraFor("swipe.png") })
    .where(eq(messageSwipes.id, "s-history"));
  await db.delete(messageTrash).where(eq(messageTrash.id, "phase-trash"));

  writeAvatar("phase-rollback.png");
  assert.equal(
    await duringColdRead(
      () => unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("phase-rollback.png")] }),
      () =>
        assert.rejects(
          db.transaction(async (tx) => {
            await tx.delete(messages).where(eq(messages.id, "m-new"));
            throw new Error("rollback between avatar scan phases");
          }),
          /rollback between avatar scan phases/u,
        ),
    ),
    0,
    "rollback cannot restore the earlier generation and certify a stale scan",
  );
  assert.equal(existsSync(pathFor("phase-rollback.png")), true);

  writeAvatar("phase-card.png");
  assert.equal(
    await duringColdRead(
      () => unlinkAvatarFilesIfUnreferenced({ db, avatarRoot, avatarPaths: [urlFor("phase-card.png")] }),
      async () => {
        await db.insert(personas).values({
          id: "phase-owner",
          name: "New owner",
          avatarPath: urlFor("phase-card.png"),
          createdAt: at,
          updatedAt: at,
        });
      },
    ),
    0,
    "final validation must re-read current cards after cold I/O",
  );
  await db.delete(personas).where(eq(personas.id, "phase-owner"));

  // Real flush-tail eviction is now allowed during cold I/O: captured resident refs remain safe.
  const previousCap = process.env.MARINARA_MAX_RESIDENT_CHATS;
  try {
    process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
    await db._fileStore.flush();
    for (const chatId of ["race", "swipe", "backup"])
      await db.select().from(messages).where(eq(messages.chatId, chatId));
    assert.equal(db._fileStore.getResidentChatUnits().has("race"), true);
    writeAvatar("eviction-orphan.png");
    assert.equal(
      await duringColdRead(
        () =>
          unlinkAvatarFilesIfUnreferenced({
            db,
            avatarRoot,
            avatarPaths: [urlFor("new.png"), urlFor("eviction-orphan.png")],
          }),
        async () => {
          await db._fileStore.flush();
          assert.equal(
            db._fileStore.getResidentChatUnits().has("race"),
            false,
            "real eviction must finish while cold I/O is paused",
          );
        },
      ),
      1,
    );
    assert.equal(existsSync(pathFor("new.png")), true, "eviction cannot hide the resident reference already captured");
    assert.equal(existsSync(pathFor("eviction-orphan.png")), false);
  } finally {
    if (previousCap === undefined) delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    else process.env.MARINARA_MAX_RESIDENT_CHATS = previousCap;
  }
  console.info(
    "Frozen identity avatar cleanup regressions passed (cold/resident messages, swipes, trash, backup, rollback, staged writes, eviction, and read failures).",
  );
} finally {
  await db._fileStore.close();
  rmSync(root, { recursive: true, force: true });
}
