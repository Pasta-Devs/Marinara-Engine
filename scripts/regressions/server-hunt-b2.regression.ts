import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";
const dir = mkdtempSync(join(tmpdir(), "marinara-hunt-b2-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = dir;

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { seedDefaultRegexScripts, CLEAN_HTML_ID, REGEX_DEFAULTS_SEEDED_KEY } = await import(
  "../../packages/server/src/db/seed-regex.js"
);
const { regexScripts, appSettings } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");

const COLLAPSE_ID = "default-collapse-newlines";
const ids = async (db: Awaited<ReturnType<typeof createFileNativeDB>>) =>
  (await db.select({ id: regexScripts.id }).from(regexScripts)).map((r) => r.id).sort();

let db = await createFileNativeDB();
try {
  // Fresh install seeds both defaults.
  await seedDefaultRegexScripts(db);
  assert.deepEqual(await ids(db), [CLEAN_HTML_ID, COLLAPSE_ID].sort());

  // A deleted default stays deleted across restarts.
  await db.delete(regexScripts).where(eq(regexScripts.id, COLLAPSE_ID));
  await seedDefaultRegexScripts(db);
  await db._fileStore.close();
  db = await createFileNativeDB();
  await seedDefaultRegexScripts(db);
  assert.deepEqual(await ids(db), [CLEAN_HTML_ID], "deleted built-in regex script must not be re-seeded");

  // Legacy install (no seeded marker) with a deleted default: not re-inserted either.
  await db.delete(appSettings).where(eq(appSettings.key, REGEX_DEFAULTS_SEEDED_KEY));
  await seedDefaultRegexScripts(db);
  assert.deepEqual(await ids(db), [CLEAN_HTML_ID], "legacy installs keep their deletions");
  const marker = await db.select().from(appSettings).where(eq(appSettings.key, REGEX_DEFAULTS_SEEDED_KEY));
  assert.deepEqual(JSON.parse(marker[0]!.value).sort(), [CLEAN_HTML_ID, COLLAPSE_ID].sort());

  // Idempotent: repeated seeding does not duplicate rows.
  await seedDefaultRegexScripts(db);
  assert.deepEqual(await ids(db), [CLEAN_HTML_ID]);
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}
console.info("server-hunt-b2: deleted default regex scripts stay deleted passed.");

// The automation expunge must also clear the seed marker, or the built-in scripts are gone for good.
{
  const { readFileSync } = await import("node:fs");
  const admin = readFileSync(new URL("../../packages/server/src/routes/admin.routes.ts", import.meta.url), "utf8");
  const regexWipe = admin.indexOf("db.delete(schema.regexScripts).run()");
  const markerWipe = admin.indexOf("eq(schema.appSettings.key, REGEX_DEFAULTS_SEEDED_KEY)");
  if (regexWipe < 0 || markerWipe < regexWipe) throw new Error("automation expunge must clear REGEX_DEFAULTS_SEEDED_KEY after wiping regex scripts");
  console.log("server-hunt-b2 expunge marker check passed");
}
