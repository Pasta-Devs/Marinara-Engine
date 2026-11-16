// Noodle account handles: two profiles with the same name get distinct handles, and one can't take another's.
// Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNoodleStorage } from "../../../packages/server/src/services/storage/noodle.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-noodle-account-handles-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const noodleStorage = createNoodleStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const firstPublicNoodleAccount = await noodleStorage.upsertAccountFromProfile({
    kind: "persona",
    entityId: "shared-noodle-handle-persona",
    displayName: "Shared Noodle Handle",
  });
  const secondPublicNoodleAccount = await noodleStorage.upsertAccountFromProfile({
    kind: "character",
    entityId: "shared-noodle-handle-character",
    displayName: "Shared Noodle Handle",
  });
  assert.equal(firstPublicNoodleAccount.handle, "shared_noodle_handle");
  assert.equal(secondPublicNoodleAccount.handle, "shared_noodle_handle_2");
  await assert.rejects(
    noodleStorage.updateAccount(secondPublicNoodleAccount.id, { handle: firstPublicNoodleAccount.handle }),
    /unique value already exists/iu,
  );
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
