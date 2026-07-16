import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "../../packages/server/src/db/file-query.js";
import { fileTable, isFileUniqueConstraintError, text } from "../../packages/server/src/db/file-schema.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { appSettings, customStickers, noodleInteractions } from "../../packages/server/src/db/schema/index.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-file-close-"));
process.env.FILE_STORAGE_DIR = storageDir;

let releaseWrite!: () => void;
const writeGate = new Promise<void>((resolve) => {
  releaseWrite = resolve;
});
let capturedWrite!: () => void;
const writeCaptured = new Promise<void>((resolve) => {
  capturedWrite = resolve;
});
let blockedFirstSettingsWrite = false;

try {
  const db = await createFileNativeDB({
    beforeTableWrite: async (table) => {
      if (table !== "app_settings" || blockedFirstSettingsWrite) return;
      blockedFirstSettingsWrite = true;
      capturedWrite();
      await writeGate;
    },
  });

  await db.insert(appSettings).values({ key: "before-active-flush", value: "one", updatedAt: "2026-07-14" });
  const activeFlush = db._fileStore.flush();
  await writeCaptured;

  await db.insert(appSettings).values({ key: "queued-during-flush", value: "two", updatedAt: "2026-07-14" });
  let closeResolved = false;
  const close = db._fileStore.close().then(() => {
    closeResolved = true;
  });
  await Promise.resolve();
  assert.equal(closeResolved, false, "close must wait for the active table write");

  releaseWrite();
  await Promise.all([activeFlush, close]);

  const persisted = JSON.parse(readFileSync(join(storageDir, "tables", "app_settings.json"), "utf8")) as Array<{
    key: string;
  }>;
  assert.deepEqual(persisted.map((row) => row.key).sort(), ["before-active-flush", "queued-during-flush"]);
  console.info("File-backed graceful shutdown regression passed.");
} finally {
  releaseWrite();
  rmSync(storageDir, { recursive: true, force: true });
}

const failingStorageDir = mkdtempSync(join(tmpdir(), "marinara-file-close-failure-"));
process.env.FILE_STORAGE_DIR = failingStorageDir;
try {
  const expectedFailure = new Error("simulated persistent write failure");
  const db = await createFileNativeDB({
    beforeTableWrite: (table) => {
      if (table === "app_settings") throw expectedFailure;
    },
  });
  await db.insert(appSettings).values({ key: "must-report-failure", value: "one", updatedAt: "2026-07-14" });
  await assert.rejects(db._fileStore.close(), expectedFailure);
} finally {
  rmSync(failingStorageDir, { recursive: true, force: true });
}

const transactionStorageDir = mkdtempSync(join(tmpdir(), "marinara-file-transaction-"));
process.env.FILE_STORAGE_DIR = transactionStorageDir;
try {
  const db = await createFileNativeDB();
  await db.insert(appSettings).values({ key: "transaction-value", value: "live", updatedAt: "2026-07-16" });
  await db._fileStore.flush();

  let releaseTransaction!: () => void;
  const transactionGate = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });
  let transactionStarted!: () => void;
  const transactionReady = new Promise<void>((resolve) => {
    transactionStarted = resolve;
  });
  const failedTransaction = db.transaction(async (tx) => {
    await tx.update(appSettings).set({ value: "imported" }).where(eq(appSettings.key, "transaction-value"));
    await db._fileStore.flush();
    transactionStarted();
    await transactionGate;
    throw new Error("simulated profile asset promotion failure");
  });
  await transactionReady;

  let outsideWriteFinished = false;
  const outsideWrite = db
    .insert(appSettings)
    .values({ key: "outside-write", value: "preserved", updatedAt: "2026-07-16" })
    .then(() => {
      outsideWriteFinished = true;
    });
  await Promise.resolve();
  assert.equal(outsideWriteFinished, false, "non-transaction writes must wait for the active transaction");

  releaseTransaction();
  await assert.rejects(failedTransaction, /simulated profile asset promotion failure/u);
  await outsideWrite;
  await db._fileStore.flush();

  const rows = await db.select().from(appSettings);
  assert.equal(rows.find((row) => row.key === "transaction-value")?.value, "live");
  assert.equal(rows.find((row) => row.key === "outside-write")?.value, "preserved");
  const persistedRows = JSON.parse(
    readFileSync(join(transactionStorageDir, "tables", "app_settings.json"), "utf8"),
  ) as Array<{ key: string; value: string }>;
  assert.equal(persistedRows.find((row) => row.key === "transaction-value")?.value, "live");
  assert.equal(persistedRows.find((row) => row.key === "outside-write")?.value, "preserved");
  await db._fileStore.close();
  console.info("File-backed serialized durable transaction regression passed.");
} finally {
  rmSync(transactionStorageDir, { recursive: true, force: true });
}

const transactionFlushFailureDir = mkdtempSync(join(tmpdir(), "marinara-file-transaction-flush-failure-"));
process.env.FILE_STORAGE_DIR = transactionFlushFailureDir;
let rejectNextTransactionWrite = false;
try {
  const expectedFailure = new Error("simulated transaction flush failure");
  const db = await createFileNativeDB({
    beforeTableWrite: (table) => {
      if (table !== "app_settings" || !rejectNextTransactionWrite) return;
      rejectNextTransactionWrite = false;
      throw expectedFailure;
    },
  });
  await db.insert(appSettings).values({ key: "flush-rollback", value: "live", updatedAt: "2026-07-16" });
  await db._fileStore.flush();

  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.update(appSettings).set({ value: "imported" }).where(eq(appSettings.key, "flush-rollback"));
      rejectNextTransactionWrite = true;
      await db._fileStore.flush();
    }),
    expectedFailure,
  );

  const rows = await db.select().from(appSettings);
  assert.equal(rows.find((row) => row.key === "flush-rollback")?.value, "live");
  const persistedRows = JSON.parse(
    readFileSync(join(transactionFlushFailureDir, "tables", "app_settings.json"), "utf8"),
  ) as Array<{ key: string; value: string }>;
  assert.equal(persistedRows.find((row) => row.key === "flush-rollback")?.value, "live");
  await db._fileStore.close();
  console.info("File-backed failed transaction flush rollback regression passed.");
} finally {
  rmSync(transactionFlushFailureDir, { recursive: true, force: true });
}

const packagedSchemaStorageDir = mkdtempSync(join(tmpdir(), "marinara-file-package-schema-"));
process.env.FILE_STORAGE_DIR = packagedSchemaStorageDir;
try {
  // Capability bundles contain their own file-table instances. Their table
  // and column objects have different identities even though they target the
  // same registered Engine tables.
  const packagedChats = fileTable("chats", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    mode: text("mode").notNull(),
    characterIds: text("character_ids").notNull().default("[]"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  });
  const packagedCallSessions = fileTable("conversation_call_sessions", {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull(),
    status: text("status").notNull(),
    mode: text("mode").notNull().default("audio"),
    initiator: text("initiator").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  });

  const db = await createFileNativeDB();
  await db.insert(packagedChats).values({
    id: "package-chat",
    name: "Package Schema Chat",
    mode: "conversation",
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
  });
  await db.insert(packagedCallSessions).values({
    id: "package-call",
    chatId: "package-chat",
    status: "active",
    initiator: "user",
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
  });
  const calls = await db
    .select({ id: packagedCallSessions.id, chatId: packagedCallSessions.chatId })
    .from(packagedCallSessions)
    .where(eq(packagedCallSessions.chatId, "package-chat"));
  assert.deepEqual(calls, [{ id: "package-call", chatId: "package-chat" }]);
  await db._fileStore.close();
  console.info("File-backed capability schema identity regression passed.");
} finally {
  rmSync(packagedSchemaStorageDir, { recursive: true, force: true });
}

const uniqueStorageDir = mkdtempSync(join(tmpdir(), "marinara-file-unique-"));
process.env.FILE_STORAGE_DIR = uniqueStorageDir;
try {
  const db = await createFileNativeDB();
  const stickerBase = {
    filePath: "sticker.webp",
    width: 64,
    height: 64,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
  await db.insert(customStickers).values({ id: "sticker-one", name: "same_name", ...stickerBase });
  await assert.rejects(
    db.insert(customStickers).values({ id: "sticker-two", name: "same_name", ...stickerBase }),
    (error) => isFileUniqueConstraintError(error, "custom_stickers", ["name"]),
  );
  await db.insert(customStickers).values({ id: "sticker-two", name: "other_name", ...stickerBase });
  await assert.rejects(
    db.update(customStickers).set({ name: "same_name" }).where(eq(customStickers.id, "sticker-two")),
    (error) => isFileUniqueConstraintError(error, "custom_stickers", ["name"]),
  );
  const unchangedSticker = await db
    .select({ name: customStickers.name })
    .from(customStickers)
    .where(eq(customStickers.id, "sticker-two"));
  assert.deepEqual(unchangedSticker, [{ name: "other_name" }]);

  const interactionBase = {
    postId: "post-one",
    parentInteractionId: null,
    actorAccountId: "actor-one",
    content: null,
    imageUrl: null,
    actorSnapshot: "{}",
    createdAt: "2026-07-15T00:00:00.000Z",
  };
  await db.insert(noodleInteractions).values({ id: "like-one", type: "like", ...interactionBase });
  await assert.rejects(
    db.insert(noodleInteractions).values({ id: "like-two", type: "like", ...interactionBase }),
    (error) =>
      isFileUniqueConstraintError(error, "noodle_interactions", [
        "postId",
        "actorAccountId",
        "type",
        "parentInteractionId",
      ]),
  );
  await db.insert(noodleInteractions).values({ id: "reply-one", type: "reply", ...interactionBase });
  await db.insert(noodleInteractions).values({ id: "reply-two", type: "reply", ...interactionBase });

  await db._fileStore.close();
  console.info("File-backed unique-key regression passed.");
} finally {
  rmSync(uniqueStorageDir, { recursive: true, force: true });
}
