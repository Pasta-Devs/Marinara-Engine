// SillyTavern imports that go wrong partway must not leave anything behind or confuse the next run:
// junk or future send_date values, a chat whose saving fails after it was created, a file that isn't a chat
// counted as imported (and so making an identical copy "already here"), long chats read whole just to be
// listed, and import routes answering a malformed upload with a bare 500.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../../packages/server/src/db/connection.js";

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-st-hardening-"));
const dataDir = join(fixtureRoot, "data", "default-user");
process.env.DATA_DIR = join(fixtureRoot, "marinara-data");
process.env.FILE_STORAGE_DIR = join(fixtureRoot, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

let db: DB | null = null;
const line = (value: unknown) => JSON.stringify(value);

try {
  const { parseTrustedTimestamp } = await import("../../../packages/server/src/services/import/import-timestamps.js");

  // ── Dates: only strings that look like a date are read ──
  for (const junk of ["12", "user 2", "2001", "chapter 3", "v2.5"]) {
    assert.equal(parseTrustedTimestamp(junk), null, `"${junk}" is not a date`);
  }
  assert.equal(parseTrustedTimestamp("2025-03-01T12:00:00.000Z"), "2025-03-01T12:00:00.000Z", "ISO 8601");
  assert.equal(parseTrustedTimestamp("2025-03-01T12:00:00+02:00"), "2025-03-01T10:00:00.000Z", "ISO with offset");
  assert.equal(parseTrustedTimestamp("Sat, 01 Mar 2025 12:00:00 GMT"), "2025-03-01T12:00:00.000Z", "RFC 2822");
  assert.equal(
    parseTrustedTimestamp("Sat Mar 01 2025 12:00:00 GMT+0000 (Coordinated Universal Time)"),
    "2025-03-01T12:00:00.000Z",
    "JavaScript's Date.toString()",
  );
  assert.ok(parseTrustedTimestamp("March 1, 2025 12:00pm"), "SillyTavern's own send_date still reads");
  assert.ok(parseTrustedTimestamp("2024-5-12 @14h 3m 22s 123ms"), "SillyTavern's file date still reads");
  assert.equal(parseTrustedTimestamp(1_700_000_000_000), "2023-11-14T22:13:20.000Z", "epoch numbers still read");

  const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
  const { chats, messages, characters } = await import("../../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../../packages/server/src/db/file-query.js");
  const { importSTChat } = await import("../../../packages/server/src/services/import/st-chat.importer.js");
  const { runSTBulkImport, scanSTFolder } = await import(
    "../../../packages/server/src/services/import/st-bulk.importer.js"
  );
  db = await createFileNativeDB();

  // ── A message dated in the future doesn't drag the rest of the chat after it ──
  const nowMs = Date.now();
  const future = await importSTChat(
    [
      line({ user_name: "You", character_name: "Aria", chat_metadata: {} }),
      line({ name: "You", is_user: true, mes: "one", send_date: "March 1, 2025 12:00pm" }),
      line({ name: "Aria", is_user: false, mes: "two", send_date: "2099-01-01T00:00:00.000Z" }),
      line({ name: "You", is_user: true, mes: "three", send_date: "user 2" }),
      line({ name: "Aria", is_user: false, mes: "four", send_date: "March 1, 2025 12:05pm" }),
    ].join("\n"),
    db,
  );
  assert.ok("chatId" in future && future.chatId, JSON.stringify(future));
  const futureRows = await db.select().from(messages).where(eq(messages.chatId, future.chatId!));
  assert.equal(futureRows.length, 4);
  for (const row of futureRows) {
    assert.ok(Date.parse(row.createdAt) < nowMs + 60_000, `"${row.content}" is not dated in the future`);
  }
  const [futureChat] = await db.select().from(chats).where(eq(chats.id, future.chatId!));
  assert.ok(Date.parse(futureChat!.updatedAt) < nowMs + 60_000, "nor is the chat");
  assert.ok(
    futureRows.every((row) => row.createdAt.startsWith("2025-03-01")),
    "undated and future messages fall in between their neighbours",
  );

  // ── A chat whose saving fails after it was made is taken away again ──
  const chatsBefore = (await db.select().from(chats)).length;
  const failingDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "insert") {
        return (table: unknown) => {
          if (table === messages) throw new Error("disk full");
          return (target as unknown as { insert: (t: unknown) => unknown }).insert(table);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as DB;
  await assert.rejects(
    importSTChat(
      [
        line({ user_name: "You", character_name: "Aria", chat_metadata: {} }),
        line({ name: "You", is_user: true, mes: "hi" }),
      ].join("\n"),
      failingDb,
    ),
    /disk full/,
  );
  assert.equal((await db.select().from(chats)).length, chatsBefore, "no half-made chat is left behind");

  // ── Folder import: a file that isn't a chat is an error, not "imported", and its copy isn't "already here" ──
  mkdirSync(join(dataDir, "characters"), { recursive: true });
  writeFileSync(
    join(dataDir, "characters", "Aria.json"),
    line({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "Aria", description: "Aria desc" } }),
  );
  mkdirSync(join(dataDir, "chats", "Aria"), { recursive: true });
  mkdirSync(join(dataDir, "chats", "Bram"), { recursive: true });
  const headerOnly = line({ user_name: "You", character_name: "Aria", chat_metadata: {} });
  writeFileSync(join(dataDir, "chats", "Aria", "Empty.jsonl"), headerOnly);
  writeFileSync(join(dataDir, "chats", "Bram", "Empty.jsonl"), headerOnly);
  // A long chat with Windows line ends: listed from its first line.
  writeFileSync(
    join(dataDir, "chats", "Aria", "Long.jsonl"),
    [
      headerOnly,
      ...Array.from({ length: 4000 }, (_, index) =>
        line({ name: index % 2 ? "Aria" : "You", is_user: index % 2 === 0, mes: `${index} ${"x".repeat(200)}` }),
      ),
    ].join("\r\n"),
  );
  const scan = await scanSTFolder(fixtureRoot);
  assert.equal(scan.success, true, scan.error);
  assert.deepEqual(
    scan.chats.map((chat) => chat.name).sort(),
    ["Empty", "Empty", "Long"],
    "every chat file is listed, including a header-only one",
  );
  assert.ok(scan.chats.every((chat) => chat.characterName === "Aria"), "names come from the header line");

  const bulk = await runSTBulkImport(
    fixtureRoot,
    {
      characters: true,
      chats: true,
      groupChats: false,
      presets: false,
      lorebooks: false,
      backgrounds: false,
      personas: false,
    },
    db,
  );
  assert.equal(bulk.imported.chats, 1, "only the real chat counts as imported");
  assert.equal(bulk.skipped?.chats ?? 0, 0, "the second empty file is not 'already here'");
  assert.equal(bulk.errors.filter((error) => error.includes("too few lines")).length, 2, JSON.stringify(bulk.errors));
  const longChat = (await db.select().from(chats)).find((chat) => chat.name.includes("Long"));
  assert.ok(longChat, "the long chat came in");
  assert.equal((await db.select().from(messages).where(eq(messages.chatId, longChat!.id))).length, 4000);
  assert.equal((await db.select().from(characters)).length, 1);

  // ── Import routes answer a malformed upload with a reason, not a bare 500 ──
  const Fastify = (await import("../../../packages/server/node_modules/fastify/fastify.js")).default;
  const multipart = (await import("../../../packages/server/node_modules/@fastify/multipart/index.js")).default;
  const { errorHandler } = await import("../../../packages/server/src/middleware/error-handler.js");
  const { importRoutes } = await import("../../../packages/server/src/routes/import.routes.js");
  const app = Fastify();
  app.decorate("db", db);
  app.setErrorHandler(errorHandler);
  await app.register(multipart);
  await app.register(importRoutes, { prefix: "/api/import" });

  const boundary = "marinara-st-hardening";
  const multipartBody = (fields: Record<string, string>, file: { name: string; content: string | Buffer }) =>
    Buffer.concat([
      Buffer.from(
        Object.entries(fields)
          .map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
          .join(""),
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

  const nullTimestamps = await app.inject({
    method: "POST",
    url: "/api/import/st-character/batch",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: multipartBody(
      { fileTimestamps: JSON.stringify([null, "x", { name: "Wren.json", lastModified: 1_700_000_000_000 }]) },
      { name: "Wren.json", content: line({ spec: "chara_card_v2", data: { name: "Wren", description: "d" } }) },
    ),
  });
  assert.equal(nullTimestamps.statusCode, 200, nullTimestamps.body);
  assert.equal(nullTimestamps.json().results[0].success, true, "a null in fileTimestamps is skipped");

  const badCharx = await app.inject({
    method: "POST",
    url: "/api/import/st-character/batch",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: multipartBody({}, { name: "Broken.charx", content: Buffer.from("not a zip at all") }),
  });
  assert.equal(badCharx.statusCode, 200, badCharx.body);
  assert.equal(badCharx.json().results[0].success, false, "a broken .charx is a failed file");

  const noOptions = await app.inject({
    method: "POST",
    url: "/api/import/st-bulk/run",
    payload: { folderPath: fixtureRoot },
  });
  assert.equal(noOptions.statusCode, 400, noOptions.body);
  assert.match(noOptions.json().error, /options/);

  // ── Importing into a chat: a file that isn't a chat leaves the chat out of any group ──
  const [target] = await db.select().from(chats).where(eq(chats.id, future.chatId!));
  assert.equal(target!.groupId ?? null, null);
  const intoGroup = (content: string, name: string) =>
    app.inject({
      method: "POST",
      url: "/api/import/st-chat-into-group",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chatId"\r\n\r\n${target!.id}\r\n`),
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n` +
            "Content-Type: application/octet-stream\r\n\r\n",
        ),
        Buffer.from(content),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
  const notAChat = await intoGroup(headerOnly, "Empty.jsonl");
  assert.ok(notAChat.json().error, notAChat.body);
  const [afterFailure] = await db.select().from(chats).where(eq(chats.id, target!.id));
  assert.equal(afterFailure!.groupId ?? null, null, "a failed import does not put the chat in a group");

  const branch = [headerOnly, line({ name: "You", is_user: true, mes: "branch" })].join("\n");
  const [first, second] = await Promise.all([intoGroup(branch, "One.jsonl"), intoGroup(branch, "Two.jsonl")]);
  assert.equal(first.json().success, true, first.body);
  assert.equal(second.json().success, true, second.body);
  assert.equal(first.json().groupId, second.json().groupId, "two imports at once share one group");
  const [afterBoth] = await db.select().from(chats).where(eq(chats.id, target!.id));
  assert.equal(afterBoth!.groupId, first.json().groupId, "and the chat is in it");
  await app.close();

  console.log("sillytavern-import-hardening: ok");
} finally {
  await db?._fileStore.close();
  rmSync(fixtureRoot, { recursive: true, force: true });
}
