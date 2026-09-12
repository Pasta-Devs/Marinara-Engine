import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveScopedRegexMode } from "../../packages/shared/src/utils/regex-scoping.js";
import { createPromptPresetSchema, updatePromptPresetSchema } from "../../packages/shared/src/schemas/prompt.schema.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { createPromptsStorage } from "../../packages/server/src/services/storage/prompts.storage.js";
import { importMarinara } from "../../packages/server/src/services/import/marinara.importer.js";

for (const mode of ["disabled", "exclusive", "chat"] as const) {
  assert.equal(resolveScopedRegexMode(undefined, mode), mode);
  assert.equal(resolveScopedRegexMode(null, mode), mode, "clearing the override restores inheritance");
  for (const override of ["disabled", "exclusive", "chat"] as const) {
    assert.equal(resolveScopedRegexMode(override, mode), override, "explicit chat choices always win");
  }
}
assert.equal(resolveScopedRegexMode(), "disabled", "legacy chats/presets stay opt-in");
assert.equal(resolveScopedRegexMode("invalid", "invalid"), "disabled");
assert.equal(createPromptPresetSchema.parse({ name: "Legacy" }).scopedRegexMode, "disabled");
assert.equal(updatePromptPresetSchema.safeParse({ scopedRegexMode: "invalid" }).success, false);
assert.equal(updatePromptPresetSchema.safeParse({ scopedRegexMode: null }).success, false);

const dir = mkdtempSync(join(tmpdir(), "marinara-preset-regex-"));
process.env.FILE_STORAGE_DIR = dir;
let db = await createFileNativeDB();
try {
  let presets = createPromptsStorage(db);
  const legacy = await presets.create({ name: "Legacy preset" });
  assert.equal(legacy?.scopedRegexMode, "disabled");
  assert.ok(legacy);
  await presets.update(legacy.id, { scopedRegexMode: "chat" });
  await db._fileStore.close();
  db = await createFileNativeDB();
  presets = createPromptsStorage(db);
  const saved = await presets.getById(legacy.id);
  assert.equal(saved?.scopedRegexMode, "chat", "preset mode survives storage restart");
  assert.equal((await presets.duplicate(legacy.id))?.scopedRegexMode, "chat", "duplicates retain the default");
  const imported = await importMarinara(
    {
      type: "marinara_preset",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { preset: saved, sections: [], groups: [], choiceBlocks: [] },
    },
    db,
  );
  assert.equal(imported.success, true);
  assert.equal((await presets.getById(imported.id!))?.scopedRegexMode, "chat", "native imports retain the default");
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}
console.info("Preset regex defaults: inheritance, validation, persistence, duplicate and import passed.");
