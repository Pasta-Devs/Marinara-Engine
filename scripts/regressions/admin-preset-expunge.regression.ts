import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isStockMarinaraUniversalPreset } from "../../packages/shared/src/types/prompt.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-admin-preset-expunge-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const previousMarinaraFileStorageDir = process.env.MARINARA_FILE_STORAGE_DIR;
const previousNodeEnv = process.env.NODE_ENV;
const previousLiteMode = process.env.MARINARA_LITE;

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number }>;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";

  const [{ buildApp }, { getDB }, { createPromptsStorage }, { createLibraryFoldersStorage }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/services/storage/prompts.storage.js"),
    import("../../packages/server/src/services/storage/library-folders.storage.js"),
  ]);

  app = await buildApp();
  await app.ready();

  const db = await getDB();
  const presets = createPromptsStorage(db);
  const folders = createLibraryFoldersStorage(db);

  async function stockSnapshot() {
    const stockPreset = (await presets.list()).find(isStockMarinaraUniversalPreset);
    assert.ok(stockPreset, "startup must seed the stock Universal Preset");
    const [groups, sections, choiceBlocks] = await Promise.all([
      presets.listGroups(stockPreset.id),
      presets.listSections(stockPreset.id),
      presets.listChoiceBlocksForPreset(stockPreset.id),
    ]);
    return { preset: stockPreset, groups, sections, choiceBlocks };
  }

  async function createEditableFixture(label: string, makeDefault: boolean, imitateStock = false) {
    const preset = await presets.create({
      name: imitateStock ? "Marinara's Universal Preset" : `${label} preset`,
      description: "Must be deleted",
      author: imitateStock ? "Marinara" : undefined,
    });
    assert.ok(preset);
    const group = await presets.createGroup({
      presetId: preset.id,
      name: `${label} group`,
      parentGroupId: null,
      order: 100,
      enabled: true,
    });
    assert.ok(group);
    const section = await presets.createSection({
      presetId: preset.id,
      identifier: `${label}-section`,
      name: `${label} section`,
      content: "Editable prompt content",
      groupId: group.id,
    });
    assert.ok(section);
    const choiceBlock = await presets.createChoiceBlock({
      presetId: preset.id,
      variableName: `${label}_choice`,
      question: "Choose one",
      options: [{ id: `${label}-option`, label: "Option", value: "option" }],
      multiSelect: false,
      separator: ", ",
      randomPick: false,
      displayMode: "auto",
      optionSort: "manual",
    });
    assert.ok(choiceBlock);
    const folder = await folders.create("presets", { name: `${label} folder` });
    assert.ok(folder);
    await folders.moveItems("presets", { folderId: folder.id, itemIds: [preset.id] });
    if (makeDefault) await presets.setDefault(preset.id);
    return preset.id;
  }

  async function assertEditableFixtureDeleted(presetId: string) {
    assert.equal(await presets.getById(presetId), null, "editable preset row must be deleted");
    assert.deepEqual(await presets.listGroups(presetId), [], "editable preset groups must be deleted");
    assert.deepEqual(await presets.listSections(presetId), [], "editable preset sections must be deleted");
    assert.deepEqual(await presets.listChoiceBlocksForPreset(presetId), [], "editable preset choices must be deleted");
    assert.deepEqual(await folders.list("presets"), [], "editable preset folders must be deleted");
  }

  const scopedEditablePresetId = await createEditableFixture("scoped", true, true);
  const stockBeforeScopedExpunge = await stockSnapshot();
  const scopedResponse = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    payload: { confirm: true, scopes: ["presets"] },
  });
  assert.equal(scopedResponse.statusCode, 200, "scoped preset expunge must succeed");
  const stockAfterScopedExpunge = await stockSnapshot();
  assert.deepEqual(stockAfterScopedExpunge.groups, stockBeforeScopedExpunge.groups);
  assert.deepEqual(stockAfterScopedExpunge.sections, stockBeforeScopedExpunge.sections);
  assert.deepEqual(stockAfterScopedExpunge.choiceBlocks, stockBeforeScopedExpunge.choiceBlocks);
  assert.deepEqual(stockAfterScopedExpunge.preset, {
    ...stockBeforeScopedExpunge.preset,
    isDefault: "true",
  });
  assert.equal(
    (await presets.getDefault())?.id,
    stockBeforeScopedExpunge.preset.id,
    "scoped preset expunge must restore the stock preset as default",
  );
  await assertEditableFixtureDeleted(scopedEditablePresetId);

  const clearAllEditablePresetId = await createEditableFixture("clear_all", false);
  const stockBeforeClearAll = await stockSnapshot();
  const clearAllResponse = await app.inject({
    method: "POST",
    url: "/api/admin/clear-all",
    payload: { confirm: true },
  });
  assert.equal(clearAllResponse.statusCode, 200, "clear-all compatibility route must succeed");
  const stockAfterClearAll = await stockSnapshot();
  assert.deepEqual(stockAfterClearAll.groups, stockBeforeClearAll.groups);
  assert.deepEqual(stockAfterClearAll.sections, stockBeforeClearAll.sections);
  assert.deepEqual(stockAfterClearAll.choiceBlocks, stockBeforeClearAll.choiceBlocks);
  assert.deepEqual(stockAfterClearAll.preset, {
    ...stockBeforeClearAll.preset,
    isDefault: "true",
  });
  assert.equal(
    (await presets.getDefault())?.id,
    stockBeforeClearAll.preset.id,
    "clear-all must preserve a valid stock preset default",
  );
  await assertEditableFixtureDeleted(clearAllEditablePresetId);
  assert.deepEqual(
    (await presets.list()).map((preset) => preset.id),
    [stockBeforeClearAll.preset.id],
    "only the stock Universal Preset may remain after clear-all",
  );
} finally {
  await app?.close();
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  if (previousMarinaraFileStorageDir === undefined) delete process.env.MARINARA_FILE_STORAGE_DIR;
  else process.env.MARINARA_FILE_STORAGE_DIR = previousMarinaraFileStorageDir;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousLiteMode === undefined) delete process.env.MARINARA_LITE;
  else process.env.MARINARA_LITE = previousLiteMode;
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Admin preset expunge regression passed.");
