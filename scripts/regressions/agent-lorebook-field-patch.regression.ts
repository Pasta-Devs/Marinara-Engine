import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-attachment-field-patch-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { agentLorebookAttachmentsSchema, agentLorebookAttachmentPatchesSchema, mergeAgentLorebookAttachments } =
  await import("../../packages/shared/src/schemas/chat.schema.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  const cached = {
    writer: { enabled: true, lorebookId: "book-a" },
    sibling: { enabled: true, lorebookId: "book-sibling" },
  };
  const cachedBefore = structuredClone(cached);
  assert.deepEqual(
    mergeAgentLorebookAttachments(cached, { writer: { enabled: false } }),
    {
      ...cached,
      writer: { enabled: false, lorebookId: "book-a" },
    },
    "optimistic field patches retain the unedited binding and sibling",
  );
  assert.deepEqual(cached, cachedBefore, "shared merge does not mutate the cached/storage source");
  assert(
    !agentLorebookAttachmentsSchema.safeParse({ writer: { enabled: true } }).success,
    "stored/snapshot schema still requires complete entries",
  );
  assert(!agentLorebookAttachmentPatchesSchema.safeParse({ writer: { enabled: undefined } }).success);
  assert.deepEqual(
    mergeAgentLorebookAttachments(["legacy"], { writer: { enabled: true } }),
    {
      writer: { enabled: true, lorebookId: null },
    },
    "legacy arrays do not become numeric map keys",
  );
  const protoPatch = JSON.parse('{"__proto__":{"enabled":true}}');
  const protoResult = mergeAgentLorebookAttachments({}, protoPatch);
  assert.equal(Object.getPrototypeOf(protoResult), Object.prototype);
  assert.equal(({} as Record<string, unknown>).enabled, undefined);
  assert(Object.hasOwn(protoResult, "__proto__"));
  const chat = await chats.create({ name: "Independent attachment fields", mode: "roleplay", characterIds: [] });
  assert(chat);
  const patch = (attachments: unknown) =>
    app.inject({
      method: "PATCH",
      url: `/api/chats/${chat.id}/metadata`,
      payload: { agentLorebookAttachments: attachments },
    });
  const read = async () =>
    (await app.inject({ method: "GET", url: `/api/chats/${chat.id}` })).json().metadata.agentLorebookAttachments;
  const initial = {
    writer: { enabled: true, lorebookId: "book-a" },
    sibling: { enabled: true, lorebookId: "book-sibling" },
  };
  assert.equal((await patch(initial)).statusCode, 200, "existing complete-entry clients remain supported");

  // Another writer changes the selected book after the first client rendered.
  assert.equal((await patch({ writer: { enabled: true, lorebookId: "book-b" } })).statusCode, 200);
  const toggle = await patch({ writer: { enabled: false } });
  assert.equal(toggle.statusCode, 200, `A field-only toggle must pass the real route: ${toggle.body}`);
  assert.deepEqual(await read(), { ...initial, writer: { enabled: false, lorebookId: "book-b" } });

  // Selecting a book must not re-enable an entry another writer disabled.
  assert.equal((await patch({ writer: { lorebookId: "book-c" } })).statusCode, 200);
  assert.deepEqual((await read()).writer, { enabled: false, lorebookId: "book-c" });
  assert.equal((await patch({ writer: { lorebookId: null } })).statusCode, 200);
  assert.deepEqual((await read()).writer, { enabled: false, lorebookId: null }, "explicit clears remain clears");

  assert.equal(
    (await patch({ toggleOnly: { enabled: true }, selectOnly: { lorebookId: "book-first" } })).statusCode,
    200,
  );
  assert.deepEqual((await read()).toggleOnly, { enabled: true, lorebookId: null });
  assert.deepEqual((await read()).selectOnly, { enabled: false, lorebookId: "book-first" });
  assert.equal((await patch({ writer: { enabled: false, lorebookId: "book-a" } })).statusCode, 200);
  const concurrent = await Promise.all([
    patch({ writer: { enabled: true } }),
    patch({ writer: { lorebookId: "book-b" } }),
  ]);
  assert(concurrent.every((response) => response.statusCode === 200));
  assert.deepEqual(
    (await read()).writer,
    { enabled: true, lorebookId: "book-b" },
    "same-agent field writes merge inside the storage queue",
  );
  assert.deepEqual((await read()).sibling, initial.sibling, "unrelated agent bindings remain unchanged");
  const beforeEmpty = await read();
  assert.equal((await patch({})).statusCode, 200);
  assert.deepEqual(await read(), beforeEmpty);
  for (const invalid of [
    null,
    [],
    { writer: null },
    { writer: {} },
    { writer: { enabled: "yes" } },
    { writer: { lorebookId: "" } },
    { writer: { enabled: true, invented: true } },
  ]) {
    assert.equal((await patch(invalid)).statusCode, 400, JSON.stringify(invalid));
    assert.deepEqual(await read(), beforeEmpty, "invalid patches never alter stored bindings");
  }
  // A full entry deliberately sets both fields, preserving wizard/reset and legacy semantics.
  assert.equal((await patch({ writer: { enabled: false, lorebookId: null } })).statusCode, 200);
  assert.deepEqual((await read()).writer, { enabled: false, lorebookId: null });
  console.info(
    "Agent attachment real-route field patches: independent writers, queue, defaults, clears, full clients and validation PASS",
  );
} finally {
  await app.close();
  closeDB();
  rmSync(directory, { recursive: true, force: true });
}
