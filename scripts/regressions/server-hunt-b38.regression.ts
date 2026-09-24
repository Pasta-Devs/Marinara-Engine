import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Batch 38: native Marinara import robustness and profile asset case collisions.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-b38-data-"));
const storageDir = mkdtempSync(join(tmpdir(), "marinara-b38-storage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storageDir;
process.env.LOG_LEVEL = "silent";

const [{ createFileNativeDB }, { importMarinara }, { createCharactersStorage }, profileAssets] = await Promise.all([
  import("../../packages/server/src/db/file-backed-store.js"),
  import("../../packages/server/src/services/import/marinara.importer.js"),
  import("../../packages/server/src/services/storage/characters.storage.js"),
  import("../../packages/server/src/services/import/profile-import-assets.js"),
]);
const { stageProfileImportAssets, promoteStagedProfileAssets, cleanupStagedProfileAssets } = profileAssets;

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XxY4WQAAAABJRU5ErkJggg==";
const validPng = Buffer.from(pngBase64, "base64");
const pngDataUrl = `data:image/png;base64,${pngBase64}`;

const db = await createFileNativeDB();
try {
  // 1. Character media restore failures after the row is created must not fail the import.
  // A plain file where the sprites/avatars directories belong makes every mkdir throw.
  writeFileSync(join(dataDir, "sprites"), "not a directory");
  writeFileSync(join(dataDir, "avatars"), "not a directory");
  const characters = createCharactersStorage(db);
  const before = (await characters.list()).length;
  const imported = await importMarinara(
    {
      type: "marinara_character",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: { name: "Media Failure Hero", description: "d" },
        avatar: pngDataUrl,
        sprites: [{ filename: "happy.png", data: pngDataUrl }],
      },
    } as never,
    db,
  );
  assert.equal(imported.success, true, "character import succeeds even when optional media cannot be written");
  assert.ok(imported.id, "character import returns the committed row id");
  assert.equal((await characters.list()).length, before + 1, "exactly one character row was created");
  rmSync(join(dataDir, "sprites"), { force: true });
  rmSync(join(dataDir, "avatars"), { force: true });

  // 2. A non-array sectionOrder/groupOrder must not crash the preset import.
  for (const [sectionOrder, groupOrder] of [
    ["null", "{}"],
    [{ a: 1 }, "\"text\""],
  ] as const) {
    const preset = await importMarinara(
      {
        type: "marinara_preset",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          preset: { name: "Odd order preset", sectionOrder, groupOrder },
          sections: [],
          groups: [],
          choiceBlocks: [],
        },
      } as never,
      db,
    );
    assert.equal(preset.success, true, `preset import tolerates sectionOrder=${JSON.stringify(sectionOrder)}`);
  }
} finally {
  await db._fileStore.close();
}

// 3. Case-variant asset paths collapse to one file on case-insensitive filesystems.
const assetsDir = mkdtempSync(join(tmpdir(), "marinara-b38-assets-"));
try {
  const original = Buffer.concat([validPng, Buffer.from("original")]);
  mkdirSync(join(assetsDir, "gallery", "global"), { recursive: true });
  writeFileSync(join(assetsDir, "gallery", "global", "Happy.png"), original);
  const stage = await stageProfileImportAssets(
    assetsDir,
    [
      { path: "gallery/global/Happy.png", expectedSize: validPng.length, read: () => validPng },
      { path: "gallery/global/happy.png", expectedSize: validPng.length, read: () => validPng },
    ],
    1024 * 1024,
  );
  assert.equal(stage.assets.length, 1, "only one of the case-variant assets is staged");
  assert.equal(stage.assets[0]?.path, "gallery/global/Happy.png");
  assert.ok(
    stage.skipped.some((entry) => entry.path === "gallery/global/happy.png" && /letter case/.test(entry.message)),
    "the case-variant asset is reported as skipped",
  );
  await promoteStagedProfileAssets(stage);
  assert.deepEqual(readFileSync(stage.assets[0]!.backupPath), original, "rollback backup keeps the user's original");
  await cleanupStagedProfileAssets(stage);
} finally {
  rmSync(assetsDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(storageDir, { recursive: true, force: true });
}

console.info("Server hunt batch 38: character media failures, preset order guards and asset case collisions passed.");
