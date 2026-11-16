import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedDefaultPreset } from "../../packages/server/src/db/seed.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";
import { createPromptsStorage } from "../../packages/server/src/services/storage/prompts.storage.js";
import { isStockMarinaraUniversalPreset } from "../../packages/shared/src/types/prompt.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-stock-preset-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();

try {
  const storage = createPromptsStorage(db);
  const appSettings = createAppSettingsStorage(db);
  await seedDefaultPreset(db);
  const original = (await storage.list()).find(isStockMarinaraUniversalPreset);
  assert.ok(original, "a fresh profile receives the stock Marinara universal preset");

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
  await storage.update(editableCopy.id, { name: restored.name });
  await storage.setDefault(editableCopy.id);
  const protectedCopy = await storage.setSystemKey(editableCopy.id, restored.systemKey);
  assert.ok(protectedCopy);
  const copySections = await storage.listSections(editableCopy.id);
  await seedDefaultPreset(db);
  assert.deepEqual(
    (await storage.list()).filter(isStockMarinaraUniversalPreset).map((preset) => preset.id),
    [restored.id],
    "startup keeps the verified stock row even when a protected copy is newer and chosen as the default",
  );
  assert.deepEqual(
    await storage.getById(editableCopy.id),
    { ...protectedCopy, systemKey: "" },
    "startup removes only the extra protection flag",
  );
  assert.deepEqual(await storage.listSections(editableCopy.id), copySections, "the copy keeps its sections and IDs");
  await seedDefaultPreset(db);
  assert.equal((await storage.getById(editableCopy.id))?.systemKey, "", "subsequent startups leave the copy editable");

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
