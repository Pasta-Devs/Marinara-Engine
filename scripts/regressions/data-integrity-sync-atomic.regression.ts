import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-sync-atomic-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.MARINARA_ENV_FILE = join(dir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const schema = await import("../../packages/server/src/db/schema/index.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { embedLorebookIntoCharacter } =
  await import("../../packages/server/src/services/lorebook/character-book-sync.js");
const multipart = createRequire(import.meta.url)(
  "../../packages/server/node_modules/@fastify/multipart",
) as typeof import("../../packages/server/node_modules/@fastify/multipart/types/index.js").default;
const { saveLorebookImage } = await import("../../packages/server/src/services/lorebook/lorebook-images.js");
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jX8AAAAASUVORK5CYII=";
const png = Buffer.from(pngBase64, "base64");
const imageDirectory = join(dir, "lorebooks/images/entries");
function imageFiles() {
  return existsSync(imageDirectory) ? readdirSync(imageDirectory).sort() : [];
}
const db = await getDB();
const books = createLorebooksStorage(db);
const characters = createCharactersStorage(db);
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(multipart);
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
await app.register(charactersRoutes, { prefix: "/api/characters" });

async function snapshot() {
  return Promise.all([
    db.select().from(schema.characters),
    db.select().from(schema.characterCardVersions),
    db.select().from(schema.lorebooks),
    db.select().from(schema.lorebookEntries),
    db.select().from(schema.lorebookCharacterLinks),
    db.select().from(schema.lorebookPersonaLinks),
    db.select().from(schema.chats),
    Promise.resolve(imageFiles()),
  ]);
}

function identified<T>(row: T): T & { id: string } {
  assert.ok(row && typeof row === "object" && "id" in row && typeof row.id === "string");
  return row as T & { id: string };
}

async function fixture() {
  const character = (await characters.create(characterDataSchema.parse({ name: "Owner" })))!;
  const book = identified(await books.create({ name: "Embedded", characterIds: [character.id] }));
  const image = await saveLorebookImage(png);
  const entry = identified(
    await books.createEntry({ lorebookId: book.id, name: "Fact", content: "Old", images: [image] }),
  );
  await embedLorebookIntoCharacter(db, character.id, book.id);
  const chat = (await chats.create({
    name: "References",
    mode: "roleplay",
    characterIds: [character.id],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
  }))!;
  await chats.patchMetadata(chat.id, {
    activeLorebookIds: [book.id],
    entryStateOverrides: { [entry.id]: { enabled: false } },
    lorebookEntryStateOverrides: { [entry.id]: { enabled: true } },
    entryTimingStates: { [entry.id]: { cooldown: 3 } },
    lorebookEntryTimingStates: { [entry.id]: { sticky: 2 } },
  });
  return { character, book, entry };
}

async function failWrite<T>(
  operation: () => Promise<T>,
  failAt = 1,
  failedTable: typeof schema.characters | typeof schema.chats = schema.characters,
): Promise<T> {
  const original = db.update;
  let writes = 0;
  db.update = ((table: any) => {
    const builder = original(table);
    if (table === failedTable) {
      const set = builder.set.bind(builder);
      builder.set = ((values: any) => {
        const update = set(values);
        const where = update.where.bind(update);
        update.where = (async (condition: any) => {
          const result = await where(condition);
          // Fail AFTER the mirror write too: rolling back just the entry is insufficient.
          if (++writes === failAt) throw new Error("injected sync write failure");
          return result;
        }) as unknown as typeof update.where;
        return update;
      }) as typeof builder.set;
    }
    return builder;
  }) as typeof db.update;
  try {
    const result = await operation();
    assert.equal(writes, failAt, "the injected failure path was reached");
    return result;
  } finally {
    db.update = original;
  }
}

const failures: unknown[] = [];
async function test(name: string, operation: () => Promise<void>) {
  try {
    await operation();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`, error);
    failures.push(error);
  }
}

try {
  await test("entry creation and retry leave no duplicate or partial mirror", async () => {
    const { book } = await fixture();
    const before = await snapshot();
    const request = () =>
      app.inject({
        method: "POST",
        url: `/api/lorebooks/${book.id}/entries`,
        payload: { name: "New", content: "New" },
      });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await failWrite(request);
      assert.equal(response.statusCode, 500);
      assert.deepEqual(await snapshot(), before, "failed create restores entries, mirror, IDs and chat references");
    }
    assert.equal((await request()).statusCode, 200);
    assert.equal((await books.listEntries(book.id)).length, 2);
  });

  for (const kind of [
    "book",
    "entry",
    "bulk-enabled",
    "bulk-patch",
    "bulk-create",
    "bulk-edit",
    "delete",
    "bulk-delete",
    "image",
  ] as const) {
    await test(`${kind} mutation and mirror roll back together`, async () => {
      const { book, entry } = await fixture();
      const other = kind === "bulk-enabled" ? await fixture() : null;
      const base = `/api/lorebooks/${book.id}`;
      const requests = {
        book: { method: "PATCH", url: base, payload: { name: "Changed" } },
        entry: { method: "PATCH", url: `${base}/entries/${entry.id}`, payload: { content: "Changed" } },
        "bulk-enabled": {
          method: "POST",
          url: "/api/lorebooks/bulk-enabled",
          payload: { ids: [book.id, other?.book.id], enabled: false },
        },
        "bulk-patch": {
          method: "PATCH",
          url: `${base}/entries/bulk`,
          payload: { entryIds: [entry.id], changes: { enabled: false } },
        },
        "bulk-create": {
          method: "POST",
          url: `${base}/entries/bulk`,
          payload: { entries: [{ name: "New A" }, { name: "New B" }] },
        },
        "bulk-edit": {
          method: "POST",
          url: `${base}/entries/bulk-edit`,
          payload: { entryIds: [entry.id], set: { enabled: false } },
        },
        delete: { method: "DELETE", url: `${base}/entries/${entry.id}` },
        "bulk-delete": { method: "POST", url: `${base}/entries/bulk-delete`, payload: { entryIds: [entry.id] } },
        image: {
          method: "POST",
          url: `${base}/entries/${entry.id}/images`,
          headers: { "content-type": "multipart/form-data; boundary=sync-atomic" },
          payload: Buffer.concat([
            Buffer.from(
              '--sync-atomic\r\nContent-Disposition: form-data; name="file"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n',
            ),
            png,
            Buffer.from("\r\n--sync-atomic--\r\n"),
          ]),
        },
      };
      const request = () =>
        app.inject({ ...requests[kind], method: requests[kind].method as "POST" | "PATCH" | "DELETE" });
      const before = await snapshot();
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await failWrite(request, other ? 2 : 1);
        assert.equal(response.statusCode, 500, response.body);
        assert.deepEqual(await snapshot(), before);
      }
      const success = await request();
      assert.equal(success.statusCode, kind === "delete" ? 204 : 200, success.body);
    });
  }

  await test("metadata cleanup failure restores deleted IDs, mirror and chat settings", async () => {
    const { book, entry } = await fixture();
    const before = await snapshot();
    const response = await failWrite(
      () => app.inject({ method: "DELETE", url: `/api/lorebooks/${book.id}/entries/${entry.id}` }),
      1,
      schema.chats,
    );
    assert.equal(response.statusCode, 500);
    assert.deepEqual(await snapshot(), before);
  });

  for (const existing of [false, true]) {
    await test(`embedded ${existing ? "reimport" : "first import"} is atomic and retryable`, async () => {
      const { character, book } = await fixture();
      const data = JSON.parse((await characters.getById(character.id))!.data);
      data.character_book.entries[0].content = "Replacement";
      data.character_book.entries[0].extensions.marinaraImages.push({
        dataUrl: `data:image/png;base64,${pngBase64}`,
        caption: "New image",
      });
      if (!existing) delete data.extensions.importMetadata.embeddedLorebook.lorebookId;
      await characters.update(character.id, data, undefined, { mergeExtensions: false, skipVersionSnapshot: true });
      const before = await snapshot();
      const request = () =>
        app.inject({ method: "POST", url: `/api/characters/${character.id}/embedded-lorebook/import` });
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await failWrite(request, 2);
        assert.equal(response.statusCode, 500);
        assert.deepEqual(
          await snapshot(),
          before,
          "book, old entry IDs, character links, pointer and chat overrides survive failure",
        );
      }
      const response = await request();
      assert.equal(response.statusCode, 200, response.body);
      if (existing) assert.equal(response.json().lorebookId, book.id);
      assert.equal((await books.listEntries(response.json().lorebookId)).length, 1);
      const saved = JSON.parse((await characters.getById(character.id))!.data);
      assert.equal(saved.character_book.entries[0].content, "Replacement");
      assert.equal(saved.extensions.importMetadata.embeddedLorebook.lorebookId, response.json().lorebookId);
    });
  }
  await test("chat admission retry transfers exactly once", async () => {
    const { book, entry } = await fixture();
    const destination = identified(await books.create({ name: "Destination" }));
    const original = db.transaction;
    let raced = false;
    db.transaction = (async (operation: Parameters<typeof db.transaction>[0]) => {
      if (!raced) {
        raced = true;
        await chats.create({
          name: "Racing chat",
          mode: "roleplay",
          characterIds: [],
          groupId: null,
          personaId: null,
          promptPresetId: null,
          connectionId: null,
        });
      }
      return original(operation);
    }) as typeof db.transaction;
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/lorebooks/${book.id}/entries/transfer`,
        payload: { operation: "move", entryIds: [entry.id], targetLorebookId: destination.id },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().transferred, 1);
      assert.equal(response.json().created.length, 1);
      assert.equal((await books.listEntries(book.id)).length, 0);
      assert.equal((await books.listEntries(destination.id)).length, 1);
    } finally {
      db.transaction = original;
    }
  });
  assert.equal(failures.length, 0, "all atomic sync controls passed");
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
