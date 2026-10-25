import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedDefaultPreset } from "../../packages/server/src/db/seed.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";
import { createPromptsStorage } from "../../packages/server/src/services/storage/prompts.storage.js";
import { isStockMarinaraNovelPreset, isStockMarinaraUniversalPreset } from "../../packages/shared/src/types/prompt.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-stock-preset-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();

try {
  const storage = createPromptsStorage(db);
  const appSettings = createAppSettingsStorage(db);
  await seedDefaultPreset(db);
  const original = (await storage.list()).find(isStockMarinaraUniversalPreset);
  assert.ok(original, "a fresh profile receives the stock Marinara universal preset");

  // Marinara's Novel Preset is seeded beside Universal, never as the default, and refreshed the same way.
  const freshPresets = await storage.list();
  const novel = freshPresets.find(isStockMarinaraNovelPreset);
  assert.ok(novel, "a fresh profile receives the stock Marinara novel preset");
  assert.equal(novel.name, "Marinara's Novel Preset");
  assert.equal(freshPresets.length, 2, "a fresh profile has exactly the two stock presets");
  assert.deepEqual(
    freshPresets.filter((preset) => preset.isDefault === "true").map((preset) => preset.id),
    [original.id],
    "only Universal becomes the default on a fresh install",
  );
  assert.ok(await appSettings.get("seed:marinara-novel-preset:sha256"), "the novel bundle hash is recorded");
  assert.ok(await appSettings.get("seed:marinara-novel-preset:snapshot-sha256"), "the novel snapshot is recorded");
  await seedDefaultPreset(db);
  assert.equal((await storage.list()).length, 2, "re-seeding is idempotent");
  assert.equal((await storage.list()).find(isStockMarinaraNovelPreset)?.id, novel.id, "the novel id is stable");

  const novelSections = await storage.listSections(novel.id);
  await appSettings.set("seed:marinara-novel-preset:sha256", "outdated-novel-hash");
  await seedDefaultPreset(db);
  assert.equal(
    (await storage.list()).find(isStockMarinaraNovelPreset)?.id,
    novel.id,
    "a novel bundle upgrade re-applies the preset in place",
  );
  assert.equal((await storage.listSections(novel.id)).length, novelSections.length);
  assert.equal((await storage.list()).length, 2, "an untouched novel upgrade keeps no copy");

  const novelDescription = novel.description;
  await storage.update(novel.id, { description: "My customized novel preset" });
  await seedDefaultPreset(db);
  const afterNovelEdit = await storage.list();
  const novelCopy = afterNovelEdit.find((preset) => preset.name === "Marinara's Novel Preset (Copy)");
  assert.equal(
    afterNovelEdit.find(isStockMarinaraNovelPreset)?.description,
    novelDescription,
    "novel edits are restored",
  );
  assert.equal(novelCopy?.description, "My customized novel preset", "novel edits are kept in an editable copy");
  assert.equal(novelCopy?.systemKey, "", "the novel copy is a normal preset");
  await storage.remove(novelCopy!.id);

  const novelLookalike = await storage.create({
    name: "Marinara's Novel Preset",
    author: "Marinara",
    description: "User-owned novel lookalike",
  });
  assert.ok(novelLookalike);
  await storage.remove(novel.id);
  await seedDefaultPreset(db);
  const afterNovelDeletion = await storage.list();
  assert.equal(afterNovelDeletion.filter(isStockMarinaraNovelPreset).length, 1, "a deleted novel preset is recovered");
  assert.equal(
    afterNovelDeletion.find((preset) => preset.id === novelLookalike.id)?.systemKey,
    "",
    "a user preset named like the novel preset is never claimed",
  );
  assert.equal(
    afterNovelDeletion.find(isStockMarinaraUniversalPreset)?.isDefault,
    "true",
    "recovering the novel preset keeps Universal as the default",
  );
  assert.equal(afterNovelDeletion.find(isStockMarinaraNovelPreset)?.isDefault, "false");
  await storage.remove(novelLookalike.id);

  await storage.setSystemKey(original.id, "");
  await seedDefaultPreset(db);
  assert.equal(
    (await storage.list()).find(isStockMarinaraUniversalPreset)?.id,
    original.id,
    "snapshot evidence migrates a genuine legacy stock preset to the reserved identity",
  );

  await storage.update(original.id, { name: "Default" });
  await appSettings.remove("seed:marinara-universal-preset:snapshot-sha256");
  await appSettings.set("seed:marinara-universal-preset:sha256", "outdated-seed-hash");
  await seedDefaultPreset(db);
  assert.equal(
    (await storage.getById(original.id))?.name,
    "Marinara's Universal Preset",
    "legacy display names are normalized before no-snapshot reconciliation returns",
  );

  const originalDescription = original.description;
  await storage.update(original.id, { description: "My customized universal preset" });
  await seedDefaultPreset(db);

  const afterCustomization = await storage.list();
  const restored = afterCustomization.find(isStockMarinaraUniversalPreset);
  const editableCopy = afterCustomization.find((preset) => preset.name === "Marinara's Universal Preset (Copy)");
  assert.equal(restored?.description, originalDescription, "startup restores the bundled stock preset contents");
  assert.equal(
    editableCopy?.description,
    "My customized universal preset",
    "startup preserves attempted stock edits in an editable copy",
  );
  assert.equal(editableCopy?.systemKey, "", "editable copies do not inherit the reserved stock identity");

  assert.ok(restored && editableCopy, "both the restored stock preset and editable copy exist");
  const matchingUserPreset = await storage.create(
    {
      name: "Marinara's Universal Preset",
      author: "Marinara",
      description: "User-owned matching preset",
    },
    { createdAt: "2026-03-04T14:46:18.499Z", updatedAt: "2026-03-04T14:46:18.499Z" },
  );
  assert.ok(matchingUserPreset, "the matching-name user preset fixture is created");
  await storage.setDefault(editableCopy.id);
  await storage.remove(restored.id);
  await seedDefaultPreset(db);

  const afterDeletion = await storage.list();
  assert.equal(
    afterDeletion.filter(isStockMarinaraUniversalPreset).length,
    1,
    "startup recovers a deleted stock preset",
  );
  assert.equal(
    afterDeletion.find((preset) => preset.id === matchingUserPreset.id)?.systemKey,
    "",
    "a user preset with matching editable fields is never claimed as stock",
  );
  assert.equal(
    afterDeletion.find((preset) => preset.id === editableCopy.id)?.isDefault,
    "true",
    "recovering the stock preset preserves the user's chosen default",
  );
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}

console.info("Stock preset protection regression checks passed.");
