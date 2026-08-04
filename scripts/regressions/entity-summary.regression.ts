import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  characterDataSchema,
  entitySummaryFieldsSchema,
  lorebookEntitySummaryFieldsSchema,
  personaEntitySummaryFieldsSchema,
  type CharacterData,
  type ExportEnvelope,
} from "../../packages/shared/src/index.js";
import { characterToLibraryItem, personaToLibraryItem } from "../../packages/client/src/lib/library/library-item.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import {
  buildNativeCharacterEnvelope,
  buildNativePersonaEnvelope,
} from "../../packages/server/src/routes/characters.routes.js";
import { buildNativeLorebookEnvelope } from "../../packages/server/src/routes/lorebooks.routes.js";
import {
  ENTITY_SUMMARY_PROJECTION_VERSION,
  projectAndHashEntitySummary,
} from "../../packages/server/src/services/entity-summary/entity-summary-projection.js";
import { importMarinara } from "../../packages/server/src/services/import/marinara.importer.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { createLorebooksStorage } from "../../packages/server/src/services/storage/lorebooks.storage.js";

const provenance = entitySummaryFieldsSchema.parse({
  entitySummary: "A factual summary.",
  entitySummaryGeneratedAt: "2026-08-04T12:00:00.000Z",
  entitySummarySource: "manual",
  entitySummaryContentHash: `sha256:${"a".repeat(64)}`,
  entitySummaryProjectionVersion: ENTITY_SUMMARY_PROJECTION_VERSION,
});
assert.deepEqual(personaEntitySummaryFieldsSchema.parse(provenance), provenance);
assert.deepEqual(lorebookEntitySummaryFieldsSchema.parse(provenance), provenance);

const characterData = characterDataSchema.parse({
  name: "  Summary Hero  ",
  description: "A  patient\nresearcher.",
  personality: "Exacting",
  scenario: "A laboratory",
  creator_notes: "Grounded notes",
  system_prompt: "Stay factual",
  tags: ["zeta", "alpha", "zeta"],
  extensions: {
    backstory: "A long history",
    appearance: "White coat",
    entitySummary: provenance.entitySummary,
    entitySummaryContentHash: provenance.entitySummaryContentHash,
    importMetadata: { source: "ignored" },
  },
});
const characterProjection = projectAndHashEntitySummary("character", characterData);
const changedSummaryOnly = projectAndHashEntitySummary("character", {
  ...characterData,
  extensions: { ...characterData.extensions, entitySummary: "A different summary." },
});
assert.deepEqual(characterProjection.projection.tags, ["alpha", "zeta"]);
assert.equal(characterProjection.projection.name, "Summary Hero");
assert.equal(characterProjection.contentHash, changedSummaryOnly.contentHash);

const personaProjection = projectAndHashEntitySummary("persona", {
  name: "Researcher",
  description: "Studies entities",
  tags: ["beta", "alpha"],
  entitySummary: "Ignored by projection",
});
assert.match(personaProjection.contentHash, /^sha256:[a-f0-9]{64}$/u);

const lorebookProjection = projectAndHashEntitySummary(
  "lorebook",
  { name: "Archive", description: "Facts", category: "world", tags: ["beta", "alpha"] },
  [
    { name: "Second", content: "B", order: 20, keys: ["z", "a"] },
    { name: "First", content: "A", order: 10, keys: ["b"] },
  ],
);
assert.deepEqual(
  lorebookProjection.projection.entries.map((entry) => entry.name),
  ["First", "Second"],
);
assert.equal(
  lorebookProjection.contentHash,
  projectAndHashEntitySummary(
    "lorebook",
    { name: "Archive", description: "Facts", category: "world", tags: ["alpha", "beta"] },
    [
      { name: "First", content: "A", order: 10, keys: ["b"] },
      { name: "Second", content: "B", order: 20, keys: ["a", "z"] },
    ],
  ).contentHash,
);

const characterItem = characterToLibraryItem({
  id: "character",
  data: JSON.stringify(characterData),
  avatarPath: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
});
assert.equal(characterItem.summary, provenance.entitySummary);
const personaItem = personaToLibraryItem({
  id: "persona",
  name: "Researcher",
  entitySummary: provenance.entitySummary,
  creatorNotes: "Legacy fallback",
  avatarPath: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
});
assert.equal(personaItem.summary, provenance.entitySummary);

const storageDir = mkdtempSync(join(tmpdir(), "marinara-entity-summary-"));
process.env.FILE_STORAGE_DIR = storageDir;
try {
  let db = await createFileNativeDB();
  const characters = createCharactersStorage(db);
  const lorebooks = createLorebooksStorage(db);
  const createdCharacter = await characters.create(characterData as CharacterData);
  assert.ok(createdCharacter);
  const createdPersona = await characters.createPersona("Legacy Persona", "Old description");
  assert.ok(createdPersona);
  const createdLorebook = await lorebooks.create({ name: "Legacy Lorebook" });
  assert.ok(createdLorebook);
  await db._fileStore.flush();
  await db._fileStore.close();

  for (const table of ["personas", "lorebooks"]) {
    const tablePath = join(storageDir, "tables", `${table}.json`);
    const rows = JSON.parse(readFileSync(tablePath, "utf8")) as Array<Record<string, unknown>>;
    for (const row of rows) {
      delete row.entitySummary;
      delete row.entitySummaryGeneratedAt;
      delete row.entitySummarySource;
      delete row.entitySummaryContentHash;
      delete row.entitySummaryProjectionVersion;
    }
    writeFileSync(tablePath, JSON.stringify(rows));
  }

  db = await createFileNativeDB();
  const reopenedCharacters = createCharactersStorage(db);
  const reopenedLorebooks = createLorebooksStorage(db);
  const legacyPersona = await reopenedCharacters.getPersona(createdPersona.id);
  const legacyLorebook = await reopenedLorebooks.getById(createdLorebook.id);
  assert.equal(legacyPersona?.entitySummary, "");
  assert.equal(legacyPersona?.entitySummaryGeneratedAt, null);
  assert.equal((legacyLorebook as { entitySummary?: unknown })?.entitySummary, "");
  assert.equal((legacyLorebook as { entitySummaryGeneratedAt?: unknown })?.entitySummaryGeneratedAt, null);

  await reopenedCharacters.updatePersona(createdPersona.id, provenance);
  await reopenedLorebooks.update(createdLorebook.id, provenance);
  assert.equal(
    (await reopenedCharacters.listPersonasPage({ limit: 10, offset: 0, search: "factual" })).items.length,
    1,
  );
  assert.equal((await reopenedLorebooks.listPage({ limit: 10, offset: 0, search: "factual" })).items.length, 1);
  assert.equal((await reopenedCharacters.listPage({ limit: 10, offset: 0, search: "factual" })).items.length, 1);

  const storedCharacter = await reopenedCharacters.getById(createdCharacter.id);
  assert.ok(storedCharacter);
  const characterEnvelope = (await buildNativeCharacterEnvelope(storedCharacter, JSON.parse(storedCharacter.data), {
    listByCharacterId: async () => [],
  })) as ExportEnvelope;
  const characterImport = await importMarinara(characterEnvelope, db);
  assert.equal(characterImport.success, true);
  const importedCharacter = await reopenedCharacters.getById(characterImport.id!);
  assert.ok(importedCharacter);
  assert.equal(
    (JSON.parse(importedCharacter.data) as { extensions?: { entitySummary?: unknown } }).extensions?.entitySummary,
    provenance.entitySummary,
  );

  const persona = await reopenedCharacters.getPersona(createdPersona.id);
  assert.ok(persona);
  const personaEnvelope = (await buildNativePersonaEnvelope(persona)) as ExportEnvelope;
  assert.equal((personaEnvelope.data as Record<string, unknown>).entitySummary, provenance.entitySummary);
  const personaImport = await importMarinara(personaEnvelope, db);
  assert.equal(personaImport.success, true);
  assert.equal((await reopenedCharacters.getPersona(personaImport.id!))?.entitySummary, provenance.entitySummary);

  const lorebook = (await reopenedLorebooks.getById(createdLorebook.id)) as Record<string, unknown>;
  const lorebookEnvelope = buildNativeLorebookEnvelope(lorebook, [], []);
  assert.equal(
    ((lorebookEnvelope.data as Record<string, unknown>).lorebook as Record<string, unknown>).entitySummary,
    provenance.entitySummary,
  );
  const lorebookImport = await importMarinara(lorebookEnvelope, db);
  assert.equal(lorebookImport.success, true);
  assert.equal(
    ((await reopenedLorebooks.getById(lorebookImport.id!)) as { entitySummary?: unknown }).entitySummary,
    provenance.entitySummary,
  );

  await db._fileStore.close();
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}

console.info("Entity summary contract and persistence regression checks passed.");
