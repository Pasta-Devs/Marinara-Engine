import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  applyLorebookBulkKeyChanges,
  hasLorebookBulkEditChanges,
  lorebookBulkEditSchema,
  parseLorebookBulkKeyText,
  planLorebookBulkKeyPatches,
  selectLorebookEntryRange,
} from "../../packages/shared/src/utils/lorebook-bulk-edit.js";

// Covers the lorebook bulk editor: the pure key/selection logic and
// POST /lorebooks/:id/entries/bulk-edit and /bulk-delete.

// ── Pure logic ──
assert.deepEqual(parseLorebookBulkKeyText(" Harbor, harbor ,\nDocks,, "), ["Harbor", "Docks"]);
assert.deepEqual(applyLorebookBulkKeyChanges(["Harbor", "docks"], ["Docks", "Pier"], []), ["Harbor", "docks", "Pier"]);
assert.deepEqual(applyLorebookBulkKeyChanges(["Harbor", " Docks"], [], ["docks"]), ["Harbor"]);
assert.equal(applyLorebookBulkKeyChanges(["Harbor"], ["harbor"], ["pier"]), null, "no-op returns null");
// Remove then add lets a key be re-cased in one edit.
assert.deepEqual(applyLorebookBulkKeyChanges(["harbor"], ["Harbor"], ["harbor"]), ["Harbor"]);
assert.deepEqual(
  planLorebookBulkKeyPatches(
    [
      { id: "a", keys: ["Harbor"], secondaryKeys: [] },
      { id: "b", keys: ["Pier"], secondaryKeys: ["Harbor"] },
    ],
    { keyField: "secondaryKeys", addKeys: ["Harbor"] },
  ),
  [{ id: "a", secondaryKeys: ["Harbor"] }],
);
assert.equal(hasLorebookBulkEditChanges({ set: {}, addKeys: [" "] }), false);
assert.equal(hasLorebookBulkEditChanges({ set: { probability: null } }), true);
assert.equal(lorebookBulkEditSchema.safeParse({ entryIds: ["a"] }).success, false, "an edit must change something");
assert.equal(lorebookBulkEditSchema.safeParse({ entryIds: ["a"], set: { probability: 101 } }).success, false);

const ordered = ["a", "b", "c", "d", "e"];
assert.deepEqual([...selectLorebookEntryRange(ordered, new Set(), "b", "d")].sort(), ["b", "c", "d"]);
assert.deepEqual([...selectLorebookEntryRange(ordered, new Set(["a", "b", "c", "d"]), "d", "b")].sort(), ["a"]);
assert.deepEqual([...selectLorebookEntryRange(ordered, new Set(["a"]), null, "c")].sort(), ["a", "c"]);
assert.deepEqual([...selectLorebookEntryRange(ordered, new Set(["a"]), "gone", "a")], []);

// ── Routes ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-bulk-edit-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
type Response = { statusCode: number; body: string; json(): any };
let db: { _fileStore: { close(): Promise<void> } } | null = null;
let app: { close(): Promise<void>; inject(options: Record<string, unknown>): Promise<Response> } | null = null;
try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  const [{ createFileNativeDB }, { lorebooksRoutes }] = await Promise.all([
    import("../../packages/server/src/db/file-backed-store.js"),
    import("../../packages/server/src/routes/lorebooks.routes.js"),
  ]);
  const fileDb = await createFileNativeDB();
  db = fileDb;
  const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");
  const server = Fastify({ bodyLimit: 10 * 1024 * 1024 });
  server.decorate("db", fileDb);
  await server.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  app = server;
  const request = async (method: string, url: string, payload?: unknown, status = 200) => {
    const response = await app!.inject({ method, url, payload });
    assert.equal(response.statusCode, status, `${method} ${url} -> ${response.statusCode} ${response.body}`);
    return response.body ? response.json() : null;
  };

  const book = await request("POST", "/api/lorebooks", { name: "Harbor Town" });
  const other = await request("POST", "/api/lorebooks", { name: "Elsewhere" });
  const folder = await request("POST", `/api/lorebooks/${book.id}/folders`, { name: "Places" });
  const otherFolder = await request("POST", `/api/lorebooks/${other.id}/folders`, { name: "Foreign" });

  const ENTRY_COUNT = 950;
  await request("POST", `/api/lorebooks/${book.id}/entries/bulk`, {
    entries: Array.from({ length: ENTRY_COUNT }, (_, index) => ({
      name: `Entry ${index}`,
      content: `Content ${index}`,
      keys: index % 2 === 0 ? ["Harbor", `key${index}`] : [`key${index}`],
      order: index,
    })),
  });
  const foreign = await request("POST", `/api/lorebooks/${other.id}/entries`, { name: "Foreign", keys: ["Harbor"] });
  const entries = (await request("GET", `/api/lorebooks/${book.id}/entries`)) as Array<{ id: string; keys: string[] }>;
  assert.equal(entries.length, ENTRY_COUNT);
  const allIds = entries.map((entry) => entry.id);

  // Field changes across all 950 entries in one request.
  const started = Date.now();
  const setResult = await request("POST", `/api/lorebooks/${book.id}/entries/bulk-edit`, {
    entryIds: allIds,
    set: { enabled: false, constant: true, probability: 40, order: 7, depth: 3, folderId: folder.id },
  });
  assert.deepEqual(setResult, { matched: ENTRY_COUNT, updated: ENTRY_COUNT });
  assert.ok(Date.now() - started < 10_000, "bulk edit of 950 entries stays fast");
  let after = (await request("GET", `/api/lorebooks/${book.id}/entries`)) as Array<Record<string, any>>;
  assert.ok(
    after.every(
      (entry) =>
        entry.enabled === false &&
        entry.constant === true &&
        entry.probability === 40 &&
        entry.order === 7 &&
        entry.depth === 3 &&
        entry.folderId === folder.id,
    ),
  );

  // Key removal only rewrites entries that had the key.
  const removeResult = await request("POST", `/api/lorebooks/${book.id}/entries/bulk-edit`, {
    entryIds: allIds,
    removeKeys: ["harbor"],
  });
  assert.deepEqual(removeResult, { matched: ENTRY_COUNT, updated: ENTRY_COUNT / 2 });
  after = await request("GET", `/api/lorebooks/${book.id}/entries`);
  assert.ok(after.every((entry) => !entry.keys.includes("Harbor")));

  await request("POST", `/api/lorebooks/${book.id}/entries/bulk-edit`, {
    entryIds: allIds.slice(0, 2),
    keyField: "secondaryKeys",
    addKeys: ["Docks"],
    set: { probability: null, folderId: null },
  });
  const first = await request("GET", `/api/lorebooks/${book.id}/entries/${allIds[0]}`);
  assert.deepEqual(first.secondaryKeys, ["Docks"]);
  assert.equal(first.probability, null);
  assert.equal(first.folderId, null);

  // All or nothing: a foreign entry or folder rejects the whole edit.
  await request(
    "POST",
    `/api/lorebooks/${book.id}/entries/bulk-edit`,
    { entryIds: [allIds[5], foreign.id], set: { enabled: true } },
    400,
  );
  await request(
    "POST",
    `/api/lorebooks/${book.id}/entries/bulk-edit`,
    { entryIds: [allIds[6]], set: { enabled: true, folderId: otherFolder.id }, addKeys: ["Pier"] },
    400,
  );
  const untouched = await request("GET", `/api/lorebooks/${book.id}/entries/${allIds[6]}`);
  assert.equal(untouched.enabled, false, "a rejected edit leaves fields unchanged");
  assert.ok(!untouched.keys.includes("Pier"), "a rejected edit leaves keys unchanged");
  assert.equal((await request("GET", `/api/lorebooks/${other.id}/entries/${foreign.id}`)).keys[0], "Harbor");
  for (const [set, message] of [
    [{ enabled: "yes" }, "Invalid input: expected boolean, received string"],
    [{ probability: "often" }, "Invalid input: expected number, received string"],
    [{ folderId: 5 }, "Invalid input: expected string, received number"],
    [{ probability: 101 }, "Too big: expected number to be <=100"],
    [{}, "Choose at least one change to apply"],
  ]) {
    const invalid = await request(
      "POST",
      `/api/lorebooks/${book.id}/entries/bulk-edit`,
      { entryIds: allIds, set },
      400,
    );
    assert.deepEqual(invalid, { error: message });
  }
  await request("POST", `/api/lorebooks/missing/entries/bulk-edit`, { entryIds: allIds, set: { enabled: true } }, 404);

  // Delete: one pass, only this book's entries.
  const deleteResult = await request("POST", `/api/lorebooks/${book.id}/entries/bulk-delete`, {
    entryIds: [...allIds.slice(0, 900), foreign.id],
  });
  assert.deepEqual(deleteResult, { deleted: 900 });
  assert.equal((await request("GET", `/api/lorebooks/${book.id}/entries`)).length, ENTRY_COUNT - 900);
  assert.equal((await request("GET", `/api/lorebooks/${other.id}/entries`)).length, 1);
  await request("POST", `/api/lorebooks/${book.id}/entries/bulk-delete`, { entryIds: [] }, 400);
} finally {
  await app?.close();
  await db?._fileStore.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("lorebook-bulk-edit regression passed");
