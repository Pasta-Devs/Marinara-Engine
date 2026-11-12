import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-regex-folders-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "file-storage");
process.env.MARINARA_FILE_STORAGE_DIR = process.env.FILE_STORAGE_DIR;

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createLibraryFoldersStorage } =
  await import("../../packages/server/src/services/storage/library-folders.storage.js");
const { createRegexScriptsStorage } =
  await import("../../packages/server/src/services/storage/regex-scripts.storage.js");
const { applyRegexScriptsToPromptText } = await import("../../packages/server/src/services/regex/regex-application.js");

const db = await createFileNativeDB();
try {
  const folders = createLibraryFoldersStorage(db);
  const scripts = createRegexScriptsStorage(db);
  const defaults = { placement: ["ai_output"] as const, applyMode: "both" as const };
  const first = (await scripts.create({
    ...defaults,
    placement: [...defaults.placement],
    name: "First",
    findRegex: "ONE",
    replaceString: "TWO",
  }))!;
  const second = (await scripts.create({
    ...defaults,
    placement: [...defaults.placement],
    name: "Second",
    findRegex: "TWO",
    replaceString: "THREE",
  }))!;
  const disabled = (await scripts.create({
    ...defaults,
    placement: [...defaults.placement],
    name: "Disabled",
    findRegex: "THREE",
    replaceString: "FOUR",
    enabled: false,
  }))!;
  const scoped = (await scripts.create({
    ...defaults,
    placement: [...defaults.placement],
    name: "Scoped",
    findRegex: "ONE",
    replaceString: "SCOPED",
    targetCharacterIds: ["character"],
  }))!;
  const folder = (await folders.create("regex", { name: "Pack" }))!;
  const apply = async (targetCharacterId?: string) =>
    applyRegexScriptsToPromptText("ONE", await scripts.list(), "ai_output", 0, { targetCharacterId });

  assert.equal(await apply(), "THREE");
  await folders.moveItems("regex", { itemIds: [second.id, disabled.id, scoped.id, first.id], folderId: folder.id });
  assert.equal(await apply(), "THREE", "folder membership order must not change execution order");

  await folders.update("regex", folder.id, { paused: true });
  assert.equal(await apply(), "ONE", "pausing bypasses prompt application");
  assert.equal(await apply("character"), "SCOPED", "a character-scoped rule ignores library folder state");
  assert.equal((await scripts.getById(first.id))?.enabled, "true");
  assert.equal((await scripts.getById(disabled.id))?.enabled, "false");

  await folders.update("regex", folder.id, { paused: false });
  assert.equal(await apply(), "THREE", "resuming keeps the individual disabled rule off");
  assert.equal(await scripts.setEnabled([first.id, "missing"], false), false);
  assert.equal(await apply(), "THREE", "a failed bulk toggle makes no partial change");
  assert.equal(await scripts.setEnabled([first.id, second.id], false), true);
  assert.equal(await apply(), "ONE");
  await scripts.remove(first.id);
  assert.ok(!(await folders.getById("regex", folder.id))?.itemIds.includes(first.id));
} finally {
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}
