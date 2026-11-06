// ─────────────────────────────────────────────────────────────
// Character description split: saved as a new version
// ─────────────────────────────────────────────────────────────
// "Split description into fields" always lands as a new card or persona version, so the unsplit
// card stays in the version history:
//  - an import with splitDescription creates the card as it came, then saves the split as a
//    "description-split" version; the snapshot holds the original description
//  - a card with versioning off is still split, without a snapshot
//  - a persona update labelled the same way snapshots the unsplit persona
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-description-split-version-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.MARINARA_ENV_FILE = join(dir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { importSTCharacter } = await import("../../packages/server/src/services/import/st-character.importer.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { DESCRIPTION_SPLIT_VERSION } = await import("../../packages/shared/src/utils/character-description-split.js");
const db = await getDB();
const storage = createCharactersStorage(db);

const description = [
  "Arya Vale is a 24 year old courier who runs packages across the lower city.",
  "",
  "Personality: stubborn, quick to laugh, hates being told to slow down.",
  "Appearance: short black hair with a silver streak, patched grey jacket.",
].join("\n");
const card = (extensions: Record<string, unknown> = {}) => ({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name: "Arya Vale", description, personality: "", extensions },
});

try {
  // 1. Import with the split: the saved card is split, the one version in history is the unsplit card.
  const imported = await importSTCharacter(card(), db, { splitDescription: true });
  assert.equal(imported.success, true);
  assert.ok(imported.characterId);
  assert.equal(imported.descriptionSplit?.status, "changed");
  const saved = JSON.parse((await storage.getById(imported.characterId))!.data);
  assert.equal(saved.description, "Arya Vale is a 24 year old courier who runs packages across the lower city.");
  assert.match(saved.personality, /^Personality: stubborn/);
  assert.match(saved.extensions.appearance, /^Appearance: short black hair/);
  assert.equal(saved.character_version, "1.1", "the split bumps the card version");
  const versions = await storage.listVersions(imported.characterId);
  const snapshots = versions.filter((version) => !version.isCurrent);
  assert.equal(snapshots.length, 1, "exactly one snapshot: the card as imported");
  assert.equal(snapshots[0]!.source, DESCRIPTION_SPLIT_VERSION.source);
  assert.equal(snapshots[0]!.reason, DESCRIPTION_SPLIT_VERSION.reason);
  assert.equal(snapshots[0]!.data.description, description, "the snapshot keeps the unsplit description");
  assert.equal(snapshots[0]!.data.personality, "");
  assert.equal(snapshots[0]!.data.character_version, "1.0");

  // 2. Without the option nothing is split and no version is written.
  const plain = await importSTCharacter(card(), db);
  assert.ok(plain.characterId);
  assert.equal(plain.descriptionSplit, undefined);
  assert.equal(JSON.parse((await storage.getById(plain.characterId))!.data).description, description);
  assert.equal((await storage.listVersions(plain.characterId)).filter((v) => !v.isCurrent).length, 0);

  // 3. A card with versioning off is still split, without a snapshot.
  const unversioned = await importSTCharacter(card({ versioningEnabled: false }), db, { splitDescription: true });
  assert.ok(unversioned.characterId);
  assert.equal(unversioned.descriptionSplit?.status, "changed");
  const unversionedData = JSON.parse((await storage.getById(unversioned.characterId))!.data);
  assert.match(unversionedData.personality, /^Personality: stubborn/);
  assert.equal(unversionedData.extensions.versioningEnabled, false, "other extensions survive the split update");
  assert.equal((await storage.listVersions(unversioned.characterId)).filter((v) => !v.isCurrent).length, 0);

  // 4. The persona split (saved by the Bot Browser after creating the persona) snapshots the unsplit persona.
  const persona = await storage.createPersona("Arya", description);
  assert.ok(persona);
  const updated = await storage.updatePersona(
    persona.id,
    { description: "Arya Vale is a courier.", personality: "Personality: stubborn." },
    { versionSource: DESCRIPTION_SPLIT_VERSION.source, versionReason: DESCRIPTION_SPLIT_VERSION.reason },
  );
  assert.equal(updated?.description, "Arya Vale is a courier.");
  const personaSnapshots = (await storage.listPersonaVersions(persona.id)).filter((v) => !v.isCurrent);
  assert.equal(personaSnapshots.length, 1);
  assert.equal(personaSnapshots[0]!.source, DESCRIPTION_SPLIT_VERSION.source);
  assert.equal(
    personaSnapshots[0]!.data.description,
    description,
    "the persona snapshot keeps the unsplit description",
  );

  process.stdout.write("Character description split version regression passed.\n");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
