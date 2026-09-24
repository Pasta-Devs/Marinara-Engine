import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// app-settings set() must be an atomic upsert: two concurrent first writes of
// the same key, issued while a transaction holds the write turn, must both
// succeed instead of the second failing the primary-key uniqueness check.

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b50-"));
const fileStorageDir = join(dataDir, "file-storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createAppSettingsStorage } = await import(
  "../../packages/server/src/services/storage/app-settings.storage.js"
);

try {
  const db = await getDB();
  const settings = createAppSettingsStorage(db);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const inTx = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const tx = db.transaction(async () => {
    entered();
    await gate;
  });
  await inTx;

  const writes = Promise.allSettled([
    settings.set("hunt-b50-key", "first"),
    settings.set("hunt-b50-key", "second"),
  ]);
  // Let both set() calls reach their pending write turn across macrotasks.
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  await tx;
  const results = await writes;
  for (const result of results) {
    assert.equal(
      result.status,
      "fulfilled",
      `concurrent first write must not fail: ${result.status === "rejected" ? String(result.reason) : ""}`,
    );
  }
  assert.equal(await settings.get("hunt-b50-key"), "second", "last concurrent write wins");

  await settings.set("hunt-b50-key", "third");
  assert.equal(await settings.get("hunt-b50-key"), "third", "plain update still works");

  console.log("server-hunt-b50 regression passed");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
