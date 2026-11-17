// Character and persona card versions: renaming saved versions, starting at 1.0, advancing on edits only when
// versioning is on, and resetting. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterDataSchema } from "../../../packages/shared/src/schemas/character.schema.js";
import {
  bumpCardVersion,
  createCharactersStorage,
} from "../../../packages/server/src/services/storage/characters.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-character-versions-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const characterStorage = createCharactersStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  // Issues #4130 / #5202 — saved card versions can be renamed; newly created
  // cards start at 1.0; enabled versioning advances on edits; disabled
  // versioning preserves the visible number without retaining new snapshots;
  // and reset returns to a clean 1.0 state.
  const versionControlCharacter = await characterStorage.create(
    characterDataSchema.parse({ name: "Version control character" }),
  );
  assert.ok(versionControlCharacter);
  const createdVersionControlCharacterData = JSON.parse(versionControlCharacter.data) as {
    character_version: string;
    extensions: { versioningEnabled?: boolean };
  };
  assert.equal(createdVersionControlCharacterData.character_version, "1.0");
  assert.equal(createdVersionControlCharacterData.extensions.versioningEnabled, true);
  assert.equal(bumpCardVersion("2.4.3"), "2.4.4");
  assert.equal(bumpCardVersion(" 1.0-rc1 "), "1.0-rc1");
  const editedVersionControlCharacter = await characterStorage.update(versionControlCharacter.id, {
    description: "First automatic version bump",
  });
  assert.equal(
    (JSON.parse(editedVersionControlCharacter?.data ?? "{}") as { character_version?: string }).character_version,
    "1.1",
  );
  await characterStorage.update(versionControlCharacter.id, { extensions: { versioningEnabled: false } });
  const characterSavedCountBeforeDisabledEdit = (
    await characterStorage.listVersions(versionControlCharacter.id)
  ).filter((version) => !version.isCurrent).length;
  const disabledVersionControlCharacter = await characterStorage.update(versionControlCharacter.id, {
    personality: "This edit is deliberately not versioned",
  });
  assert.equal(
    (JSON.parse(disabledVersionControlCharacter?.data ?? "{}") as { character_version?: string }).character_version,
    "1.1",
  );
  assert.equal(
    (await characterStorage.listVersions(versionControlCharacter.id)).filter((version) => !version.isCurrent).length,
    characterSavedCountBeforeDisabledEdit,
  );
  await characterStorage.update(versionControlCharacter.id, { extensions: { versioningEnabled: true } });
  const reenabledVersionControlCharacter = await characterStorage.update(versionControlCharacter.id, {
    scenario: "Automatic versioning is active again",
  });
  assert.equal(
    (JSON.parse(reenabledVersionControlCharacter?.data ?? "{}") as { character_version?: string }).character_version,
    "1.2",
  );
  await characterStorage.update(versionControlCharacter.id, { character_version: "2.0" });
  const characterVersionsBeforeReset = await characterStorage.listVersions(versionControlCharacter.id);
  const savedCharacterVersion = characterVersionsBeforeReset.find((version) => !version.isCurrent);
  assert.ok(savedCharacterVersion);
  const renamedCharacterVersion = await characterStorage.renameVersion(
    versionControlCharacter.id,
    savedCharacterVersion.id,
    "1.0-fixed",
  );
  assert.equal(renamedCharacterVersion?.version, "1.0-fixed");
  assert.equal(renamedCharacterVersion?.data.character_version, "1.0-fixed");
  const resetCharacter = await characterStorage.resetVersions(versionControlCharacter.id);
  assert.equal((JSON.parse(resetCharacter?.data ?? "{}") as { character_version?: string }).character_version, "1.0");
  const characterVersionsAfterReset = await characterStorage.listVersions(versionControlCharacter.id);
  assert.equal(characterVersionsAfterReset.length, 1);
  assert.equal(characterVersionsAfterReset[0]?.isCurrent, true);
  assert.equal(characterVersionsAfterReset[0]?.revision, 1);
  const versionControlPersona = await characterStorage.createPersona(
    "Version control persona",
    "Regression fixture",
    undefined,
    { personaVersion: "1.0" },
  );
  assert.ok(versionControlPersona);
  assert.equal(versionControlPersona.personaVersion, "1.0");
  assert.equal(versionControlPersona.versioningEnabled, "true");
  const editedVersionControlPersona = await characterStorage.updatePersona(versionControlPersona.id, {
    description: "First automatic version bump",
  });
  assert.equal(editedVersionControlPersona?.personaVersion, "1.1");
  await characterStorage.updatePersona(versionControlPersona.id, { versioningEnabled: "false" });
  const personaSavedCountBeforeDisabledEdit = (
    await characterStorage.listPersonaVersions(versionControlPersona.id)
  ).filter((version) => !version.isCurrent).length;
  const disabledVersionControlPersona = await characterStorage.updatePersona(versionControlPersona.id, {
    personality: "This edit is deliberately not versioned",
  });
  assert.equal(disabledVersionControlPersona?.personaVersion, "1.1");
  assert.equal(
    (await characterStorage.listPersonaVersions(versionControlPersona.id)).filter((version) => !version.isCurrent)
      .length,
    personaSavedCountBeforeDisabledEdit,
  );
  await characterStorage.updatePersona(versionControlPersona.id, { versioningEnabled: "true" });
  const reenabledVersionControlPersona = await characterStorage.updatePersona(versionControlPersona.id, {
    scenario: "Automatic versioning is active again",
  });
  assert.equal(reenabledVersionControlPersona?.personaVersion, "1.2");
  await characterStorage.updatePersona(versionControlPersona.id, { personaVersion: "2.0" });
  const personaVersionsBeforeReset = await characterStorage.listPersonaVersions(versionControlPersona.id);
  const savedPersonaVersion = personaVersionsBeforeReset.find((version) => !version.isCurrent);
  assert.ok(savedPersonaVersion);
  const renamedPersonaVersion = await characterStorage.renamePersonaVersion(
    versionControlPersona.id,
    savedPersonaVersion.id,
    "1.0-fixed",
  );
  assert.equal(renamedPersonaVersion?.version, "1.0-fixed");
  assert.equal(renamedPersonaVersion?.data.personaVersion, "1.0-fixed");
  const resetPersona = await characterStorage.resetPersonaVersions(versionControlPersona.id);
  assert.equal(resetPersona?.personaVersion, "1.0");
  const personaVersionsAfterReset = await characterStorage.listPersonaVersions(versionControlPersona.id);
  assert.equal(personaVersionsAfterReset.length, 1);
  assert.equal(personaVersionsAfterReset[0]?.isCurrent, true);
  assert.equal(personaVersionsAfterReset[0]?.revision, 1);
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
