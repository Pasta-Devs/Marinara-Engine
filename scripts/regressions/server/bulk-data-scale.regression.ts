// Big-library regressions from a tester who imported a SillyTavern folder of about 3000 chats.
// 1. Plain inserts check uniqueness through a hash index, not a scan of every resident row: the
//    scan made bulk imports quadratic. Duplicates must still be refused, inside a batch and across
//    batches, and an id freed by a delete must be insertable again.
// 2. Settings > Data clears in the background, chat by chat, with progress at /expunge/status,
//    and a clear that never finished is reported so it can be run again.
// 3. A bulk import lets the chats it wrote go back to disk as it goes: keeping all 3000 in memory
//    ran a 2 GB Node heap out of memory.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-bulk-data-scale-"));
const fileStorageDir = join(dataDir, "file-storage");
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; body: string }>;
} | null = null;

try {
  const [{ buildApp }, { getDB }, schema, { FileUniqueConstraintError }, { eq }] = await Promise.all([
    import("../../../packages/server/src/app.js"),
    import("../../../packages/server/src/db/connection.js"),
    import("../../../packages/server/src/db/schema/index.js"),
    import("../../../packages/server/src/db/file-schema.js"),
    import("../../../packages/server/src/db/file-query.js"),
  ]);
  app = await buildApp();
  await app.ready();
  const db = await getDB();
  const now = new Date().toISOString();

  // ── 1. Unique index ──
  const emoji = (id: string, name: string) => ({ id, name, filePath: `${name}.png`, createdAt: now, updatedAt: now });
  await db.insert(schema.customEmojis).values([emoji("e1", "wave"), emoji("e2", "smile")]);
  await assert.rejects(
    db.insert(schema.customEmojis).values(emoji("e1", "other")),
    FileUniqueConstraintError,
    "a repeated primary key is refused across batches",
  );
  await assert.rejects(
    db.insert(schema.customEmojis).values(emoji("e3", "wave")),
    FileUniqueConstraintError,
    "a repeated uniqueBy key is refused across batches",
  );
  await assert.rejects(
    db.insert(schema.customEmojis).values([emoji("e4", "a"), emoji("e4", "b")]),
    FileUniqueConstraintError,
    "a repeated key inside one batch is refused",
  );
  assert.equal(
    (await db.select().from(schema.customEmojis)).length,
    2,
    "a refused batch inserts nothing, and the index it was checked against is not left holding its keys",
  );
  await db.insert(schema.customEmojis).values(emoji("e4", "fresh"));
  await db.delete(schema.customEmojis).where(eq(schema.customEmojis.id, "e1"));
  await db.insert(schema.customEmojis).values(emoji("e1", "wave"));
  assert.equal((await db.select().from(schema.customEmojis)).length, 3, "a deleted row's keys can be reused");
  await assert.rejects(
    db.update(schema.customEmojis).set({ name: "wave" }).where(eq(schema.customEmojis.id, "e2")),
    FileUniqueConstraintError,
    "updates still check uniqueness",
  );

  // Many chats with messages, inserted one chat at a time like an import. The quadratic scan took
  // about 28 s for 200 chats of 150 messages; the index takes well under a second.
  const CHATS = 120;
  const PER_CHAT = 60;
  const started = performance.now();
  for (let chat = 0; chat < CHATS; chat++) {
    const chatId = `scale-chat-${chat}`;
    await db
      .insert(schema.chats)
      .values({ id: chatId, name: `Chat ${chat}`, mode: "roleplay", createdAt: now, updatedAt: now });
    await db.insert(schema.messages).values(
      Array.from({ length: PER_CHAT }, (_, index) => ({
        id: `${chatId}-m${index}`,
        chatId,
        role: index % 2 ? "assistant" : "user",
        content: "hello",
        createdAt: now,
      })),
    );
  }
  const insertMs = performance.now() - started;
  assert.ok(insertMs < 15_000, `bulk chat inserts stay fast (took ${Math.round(insertMs)} ms)`);
  await assert.rejects(
    db
      .insert(schema.messages)
      .values({ id: "scale-chat-3-m5", chatId: "scale-chat-3", role: "user", content: "", createdAt: now }),
    FileUniqueConstraintError,
    "the index still sees messages from earlier batches",
  );
  await db._fileStore.flush();

  // ── 2. Background clear ──
  mkdirSync(join(dataDir, "gallery"), { recursive: true });
  for (let index = 0; index < 30; index++) writeFileSync(join(dataDir, "gallery", `${index}.png`), "x");

  const start = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    payload: { confirm: true, scopes: ["chats"], background: true },
  });
  assert.equal(start.statusCode, 202, start.body);
  const started2 = JSON.parse(start.body) as { job: { id: string; state: string; scopes: string[] } };
  assert.deepEqual(started2.job.scopes, ["chats"]);
  assert.ok(existsSync(join(dataDir, "expunge-in-progress.json")), "a running clear leaves a marker");

  const again = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    payload: { confirm: true, scopes: ["chats"], background: true },
  });
  assert.equal(again.statusCode, 409, "only one clear runs at a time");

  let status: { job: { id: string; state: string; step: string; done: number; total: number }; interrupted: unknown };
  const seenProgress = new Set<string>();
  for (let tries = 0; ; tries++) {
    const response = await app.inject({ method: "GET", url: "/api/admin/expunge/status" });
    status = JSON.parse(response.body);
    seenProgress.add(`${status.job.step}:${status.job.total}`);
    if (status.job.state !== "running") break;
    assert.ok(tries < 2000, "the clear finishes");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(status.job.state, "done", JSON.stringify(status.job));
  assert.ok(seenProgress.has(`chats:${CHATS}`), "progress counts the chats being deleted");
  assert.equal((await db.select().from(schema.chats)).length, 0, "every chat is gone");
  assert.equal((await db.select().from(schema.messages)).length, 0, "their messages went with them");
  assert.equal((await db.select().from(schema.customEmojis)).length, 3, "other data is untouched");
  assert.ok(!existsSync(join(dataDir, "expunge-in-progress.json")), "a finished clear removes its marker");
  assert.equal(status.interrupted, null);

  // A marker without a running clear means the server stopped partway.
  writeFileSync(
    join(dataDir, "expunge-in-progress.json"),
    JSON.stringify({ scopes: ["chats", "media", "not-a-scope"], startedAt: now }),
  );
  const interrupted = JSON.parse((await app.inject({ method: "GET", url: "/api/admin/expunge/status" })).body) as {
    interrupted: { scopes: string[] } | null;
  };
  assert.deepEqual(interrupted.interrupted?.scopes, ["chats", "media"], "an unfinished clear is reported");

  // The old blocking form still answers once everything is gone.
  const blocking = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    payload: { confirm: true, scopes: ["chats"] },
  });
  assert.equal(blocking.statusCode, 200, blocking.body);
  assert.equal(JSON.parse(blocking.body).success, true);
  const leftover = JSON.parse((await app.inject({ method: "GET", url: "/api/admin/expunge/status" })).body) as {
    interrupted: { scopes: string[] } | null;
  };
  assert.deepEqual(leftover.interrupted?.scopes, ["media"], "finishing part of an interrupted clear keeps the rest");

  // ── 3. Import memory ──
  const { runSTBulkImport } = await import("../../../packages/server/src/services/import/st-bulk.importer.js");
  const stUser = join(dataDir, "st", "data", "default-user");
  mkdirSync(join(stUser, "characters"), { recursive: true });
  mkdirSync(join(stUser, "chats", "Ava"), { recursive: true });
  writeFileSync(
    join(stUser, "characters", "Ava.json"),
    JSON.stringify({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "Ava", description: "", first_mes: "Hi" },
    }),
  );
  const chatFileCount = 60;
  for (let i = 0; i < chatFileCount; i++) {
    const lines = [{ user_name: "You", character_name: "Ava", chat_metadata: {} }];
    for (let m = 0; m < 4; m++) {
      lines.push({
        name: m % 2 ? "Ava" : "You",
        is_user: m % 2 === 0,
        mes: `chat ${i} line ${m}`,
        send_date: now,
      } as never);
    }
    writeFileSync(
      join(stUser, "chats", "Ava", `Ava - ${i}.jsonl`),
      lines.map((line) => JSON.stringify(line)).join("\n"),
    );
  }
  const importResult = await runSTBulkImport(
    join(dataDir, "st"),
    {
      characters: true,
      chats: true,
      groupChats: true,
      presets: false,
      lorebooks: false,
      backgrounds: false,
      personas: false,
    },
    db,
  );
  assert.equal(importResult.imported.chats, chatFileCount, JSON.stringify(importResult.errors));
  const resident = db._fileStore.getResidentChatUnits().size;
  assert.ok(resident < chatFileCount / 2, `imported chats go back to disk (${resident} of ${chatFileCount} resident)`);
  const importedChats = await db.select({ id: schema.chats.id }).from(schema.chats);
  let importedMessages = 0;
  for (const chat of importedChats) {
    importedMessages += (await db.select().from(schema.messages).where(eq(schema.messages.chatId, chat.id))).length;
  }
  assert.equal(importedMessages, chatFileCount * 4, "chats that went back to disk still read in full");
  const allResident = db._fileStore.getResidentChatUnits().size;
  process.env.MARINARA_MAX_RESIDENT_CHATS = "0";
  await db._fileStore.trimResidentChatUnits(4);
  assert.equal(
    db._fileStore.getResidentChatUnits().size,
    allResident,
    "MARINARA_MAX_RESIDENT_CHATS=0 keeps every chat",
  );
  delete process.env.MARINARA_MAX_RESIDENT_CHATS;
  await db._fileStore.trimResidentChatUnits(4);
  assert.ok(db._fileStore.getResidentChatUnits().size <= 4, "unset, a trim keeps only the most recent chats");

  // The import window polls its progress about once a second, so the poll has its own budget.
  for (let i = 0; i < 30; i++) {
    const poll = await app.inject({ method: "GET", url: "/api/import/st-bulk/status" });
    assert.notEqual(poll.statusCode, 429, `import progress poll ${i + 1} was rate-limited`);
  }

  console.info("Bulk data scale regressions passed.");
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}
