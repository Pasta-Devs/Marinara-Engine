import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-data-integrity-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.MARINARA_ENV_FILE = join(dir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const schema = await import("../../packages/server/src/db/schema/index.js");
const db = await getDB();

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
function identified<T>(row: T): T & { id: string } {
  assert.ok(row && typeof row === "object" && "id" in row && typeof row.id === "string");
  return row as T & { id: string };
}
const app = Fastify();
app.decorate("db", db);
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
try {
  const storage = createLorebooksStorage(db);
  const source = identified(await storage.create({ name: "Source" }));
  const target = identified(await storage.create({ name: "Target" }));
  const entries = await Promise.all(
    ["First", "Second"].map((name) => storage.createEntry({ lorebookId: source.id, name, content: name })),
  );
  const before = await db.select().from(schema.lorebookEntries);
  const originalDelete = db.delete;
  let deletes = 0;
  db.delete = ((table: any) => {
    const builder = originalDelete(table);
    if (table === schema.lorebookEntries) {
      const where = builder.where.bind(builder);
      builder.where = ((condition: any) => {
        if (++deletes === 2) throw new Error("injected second source deletion failure");
        return where(condition);
      }) as typeof builder.where;
    }
    return builder;
  }) as typeof db.delete;
  const payload = {
    entryIds: entries.map((entry) => identified(entry).id),
    targetLorebookId: target.id,
    operation: "move",
  };
  let failed;
  try {
    failed = await app.inject({ method: "POST", url: `/api/lorebooks/${source.id}/entries/transfer`, payload });
  } finally {
    db.delete = originalDelete;
  }
  assert.equal(failed.statusCode, 500, failed.body);
  assert.deepEqual(
    await db.select().from(schema.lorebookEntries),
    before,
    "a failed move preserves both source rows and removes provisional copies",
  );
  for (const operation of ["copy", "move"]) {
    const response = await app.inject({
      method: "POST",
      url: `/api/lorebooks/${source.id}/entries/transfer`,
      payload: { ...payload, operation },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().transferred, 2);
  }
  assert.equal((await storage.listEntries(source.id)).length, 0);
  assert.equal((await storage.listEntries(target.id)).length, 4);
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
