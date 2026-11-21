import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { lorebooksRoutes } from "../../../packages/server/src/routes/lorebooks.routes.js";
import { resetFeatureSettingsForTests } from "../../../packages/server/src/services/features/feature-settings.js";
import { importMarinara } from "../../../packages/server/src/services/import/marinara.importer.js";
import { importSTLorebook } from "../../../packages/server/src/services/import/st-lorebook.importer.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";

// #9652: "Vectors on for new lorebooks" (Settings > Advanced > Features, LOREBOOK_NEW_BOOK_VECTORS) decides
// excludeFromVectorization for a lorebook created without one. Off (the default) keeps today's excluded start;
// a value the request or file carries always wins. Run through scripts/run-regressions.mjs for isolated storage.
delete process.env.LOREBOOK_NEW_BOOK_VECTORS;
const db = await createFileNativeDB();
const Fastify = createRequire(new URL("../../../packages/server/package.json", import.meta.url))("fastify");
const app = Fastify();
try {
  app.decorate("db", db);
  await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  const lorebooks = createLorebooksStorage(db);
  const create = async (payload: Record<string, unknown>) => {
    const response = await app.inject({ method: "POST", url: "/api/lorebooks", payload });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { id: string; excludeFromVectorization: boolean };
  };
  const nativeImport = async (lorebook: Record<string, unknown>) => {
    const before = new Set(((await lorebooks.list()) as Array<{ id: string }>).map((book) => book.id));
    const result = await importMarinara(
      { type: "marinara_lorebook", version: 1, exportedAt: new Date(0).toISOString(), data: { lorebook, entries: [] } },
      db,
    );
    assert.equal(result.success, true, JSON.stringify(result));
    const created = ((await lorebooks.list()) as Array<{ id: string }>).find((book) => !before.has(book.id));
    assert(created, "the native import created a lorebook");
    return (await lorebooks.getById(created.id))!.excludeFromVectorization;
  };
  const stImport = async (name: string) => {
    const result = await importSTLorebook({ name, entries: {} }, db, { fallbackName: name });
    return (await lorebooks.getById((result as { lorebookId: string }).lorebookId))!.excludeFromVectorization;
  };

  // ── switch off (default): new books start excluded, as before ──
  resetFeatureSettingsForTests();
  assert.equal((await create({ name: "Default" })).excludeFromVectorization, true, "off: a new book starts excluded");
  assert.equal(
    (await create({ name: "Asked for vectors", excludeFromVectorization: false })).excludeFromVectorization,
    false,
    "a value in the request wins",
  );
  assert.equal(await stImport("ST off"), true, "off: an ST import (no book-level flag) starts excluded");
  assert.equal(await nativeImport({ name: "Native off" }), true, "off: a native file without the flag starts excluded");
  assert.equal(
    await nativeImport({ name: "Native carries false", excludeFromVectorization: false }),
    false,
    "a native file's own flag wins",
  );

  // ── switch on: new books start with Vectors on ──
  resetFeatureSettingsForTests({ newLorebookVectors: true });
  assert.equal((await create({ name: "On" })).excludeFromVectorization, false, "on: a new book can be vectorized");
  assert.equal(
    (await create({ name: "Asked for none", excludeFromVectorization: true })).excludeFromVectorization,
    true,
    "a value in the request still wins",
  );
  assert.equal(await stImport("ST on"), false, "on: an ST import starts with Vectors on");
  assert.equal(await nativeImport({ name: "Native on" }), false, "on: a native file without the flag follows it");
  assert.equal(
    await nativeImport({ name: "Native carries true", excludeFromVectorization: true }),
    true,
    "a native file's own flag still wins",
  );
  const onBook = await create({ name: "Vectorize at once" });
  const vectorize = await app.inject({
    method: "POST",
    url: `/api/lorebooks/${onBook.id}/vectorize`,
    payload: { connectionId: "missing", model: "x" },
  });
  assert.notEqual(vectorize.statusCode, 409, "on: a fresh book is not refused for having Vectors off");

  // ── the environment variable pins it both ways ──
  process.env.LOREBOOK_NEW_BOOK_VECTORS = "false";
  assert.equal((await create({ name: "Env off" })).excludeFromVectorization, true, "env off beats a saved on");
  resetFeatureSettingsForTests();
  process.env.LOREBOOK_NEW_BOOK_VECTORS = "true";
  assert.equal((await create({ name: "Env on" })).excludeFromVectorization, false, "env on beats a saved off");

  // ── an update without the field leaves the book alone ──
  delete process.env.LOREBOOK_NEW_BOOK_VECTORS;
  const patched = await app.inject({
    method: "PATCH",
    url: `/api/lorebooks/${onBook.id}`,
    payload: { name: "Renamed" },
  });
  assert.equal(patched.statusCode, 200, patched.body);
  assert.equal(patched.json().excludeFromVectorization, false, "a rename keeps the book's own vectors setting");
} finally {
  delete process.env.LOREBOOK_NEW_BOOK_VECTORS;
  resetFeatureSettingsForTests();
  await app.close();
}
