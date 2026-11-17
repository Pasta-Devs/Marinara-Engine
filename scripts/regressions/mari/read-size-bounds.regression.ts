// A heavy single-item read bounds its own size: oversized fields are left out whole, with a signal, and can be read
// field by field, instead of the output being cut mid-JSON. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterGroups } from "../../../packages/server/src/db/schema/index.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-read-size-bounds-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  const characterId = "partial-update-preservation";
  const createResult = await mariDb.executeAction({
    action: "character.create",
    id: characterId,
    data: {
      name: "Preserved Character",
      personality: "Before the update.",
      firstMes: "Welcome to the laboratory.",
      mesExample: "{{char}}: Observe carefully.",
      creatorNotes: "Created for integration coverage.",
      systemPrompt: "Stay in character.",
      postHistoryInstructions: "Remain concise.",
      characterVersion: "1.2.3",
      alternateGreetings: ["You made it."],
    },
  });
  assert.equal(createResult.ok, true, "The character update regression fixture must be created");
  const updateResult = await mariDb.executeAction({
    action: "character.update",
    id: characterId,
    patch: { personality: "After the update." },
    apply: true,
  });
  assert.equal(updateResult.ok, true, "A personality-only character.update must apply");
  const readResult = await mariDb.executeAction({ action: "character.get", id: characterId });
  assert.equal(readResult.ok, true);
  const updatedCard = (readResult.output as { data: Record<string, unknown> }).data;
  assert.deepEqual(
    {
      personality: updatedCard.personality,
      first_mes: updatedCard.first_mes,
      mes_example: updatedCard.mes_example,
      creator_notes: updatedCard.creator_notes,
      system_prompt: updatedCard.system_prompt,
      post_history_instructions: updatedCard.post_history_instructions,
      character_version: updatedCard.character_version,
      alternate_greetings: updatedCard.alternate_greetings,
    },
    {
      personality: "After the update.",
      first_mes: "Welcome to the laboratory.",
      mes_example: "{{char}}: Observe carefully.",
      creator_notes: "Created for integration coverage.",
      system_prompt: "Stay in character.",
      post_history_instructions: "Remain concise.",
      character_version: "1.2.3",
      alternate_greetings: ["You made it."],
    },
    "character.update must preserve every omitted Character Card field through the real merge and persistence path",
  );
  // #4767: a heavy single-item read must bound its own size — eliding whole
  // oversized fields (identity preserved) with a structured signal, and staying
  // re-readable field by field — instead of getting sliced mid-JSON at the
  // workspace output cap with no way to recover the lost content.
  const heavyCharacterId = "heavy-card-4767";
  const heavyGreeting = "G".repeat(40_000);
  const heavyCreate = await mariDb.executeAction({
    action: "character.create",
    id: heavyCharacterId,
    data: {
      name: "Heavy Card",
      description: "A compact identity that must survive the bounding.",
      alternateGreetings: [heavyGreeting],
    },
  });
  assert.equal(heavyCreate.ok, true, "#4767 heavy-card fixture must be created");
  const heavyRead = await mariDb.executeAction({ action: "character.get", id: heavyCharacterId });
  assert.equal(heavyRead.ok, true);
  const heavyData = (heavyRead.output as { data: Record<string, unknown> }).data;
  assert.equal(heavyData.name, "Heavy Card", "#4767 bounding must preserve the character name");
  assert.equal(
    heavyData.description,
    "A compact identity that must survive the bounding.",
    "#4767 bounding must preserve the description",
  );
  assert.equal(heavyRead.truncation?.truncated, true, "#4767 a heavy read must report structured truncation");
  // The oversized greetings array is elided as a unit (one placeholder, not one
  // per element), naming the array path for drill-down.
  const greetingElision = (heavyRead.truncation?.fields ?? []).find(
    (entry) => entry.path === "data.alternate_greetings",
  );
  assert.ok(greetingElision, "#4767 must elide the oversized greetings array and name its field path");
  assert.ok(
    greetingElision.fullLength >= 40_000,
    "#4767 truncation metadata must report the elided value's true (serialized) length",
  );
  assert.ok(
    !JSON.stringify(heavyData.alternate_greetings).includes("GGGGGGGGGG"),
    "#4767 the oversized greetings must be elided in the overview, not inlined",
  );
  assert.ok(
    JSON.stringify(heavyRead.output, null, 2).length < 30_000,
    "#4767 the bounded overview must fit well under the 32k workspace output cap",
  );
  // The complete value must reassemble across field= windows — nothing is lost.
  // Element-level drill-down still resolves even though elision was array-level.
  const firstWindow = await mariDb.executeAction({
    action: "character.get",
    id: heavyCharacterId,
    field: "data.alternate_greetings[0]",
    offset: 0,
    limit: 20_000,
  });
  const secondWindow = await mariDb.executeAction({
    action: "character.get",
    id: heavyCharacterId,
    field: "data.alternate_greetings[0]",
    offset: 20_000,
    limit: 20_000,
  });
  assert.equal(firstWindow.truncation?.field?.total, 40_000, "#4767 a field read must report the true total length");
  assert.equal(
    String(firstWindow.output) + String(secondWindow.output),
    heavyGreeting,
    "#4767 field= windows must reassemble the complete original value with nothing lost",
  );
  // The guaranteed bound: a card whose bulk is MANY short strings (a huge tags
  // array) must NOT inflate past the cap by turning each short value into a
  // longer placeholder — the whole array is elided as one unit. This is the
  // regression for the review's major finding.
  const manyTagsId = "many-tags-4767";
  const manyTagsCreate = await mariDb.executeAction({
    action: "character.create",
    id: manyTagsId,
    data: {
      name: "Tag Storm",
      description: "Short identity.",
      tags: Array.from({ length: 4000 }, (_, i) => `tag-${i}`),
    },
  });
  assert.equal(manyTagsCreate.ok, true, "#4767 tag-storm fixture must be created");
  const tagsRead = await mariDb.executeAction({ action: "character.get", id: manyTagsId });
  assert.equal(tagsRead.ok, true);
  assert.equal(
    (tagsRead.output as { data: Record<string, unknown> }).data.name,
    "Tag Storm",
    "#4767 name survives a tag storm",
  );
  assert.ok(
    JSON.stringify(tagsRead.output, null, 2).length < 30_000,
    "#4767 a many-short-strings card must be bounded, never inflated past the cap",
  );
  // Description-dominated card: description is elided (last-resort) but the name
  // still survives and the description remains recoverable via field=.
  const descHeavyId = "desc-heavy-4767";
  const heavyDescription = "D".repeat(40_000);
  const descHeavyCreate = await mariDb.executeAction({
    action: "character.create",
    id: descHeavyId,
    data: { name: "Wordy", description: heavyDescription },
  });
  assert.equal(descHeavyCreate.ok, true, "#4767 description-heavy fixture must be created");
  const descRead = await mariDb.executeAction({ action: "character.get", id: descHeavyId });
  assert.equal(descRead.ok, true);
  assert.equal(
    (descRead.output as { data: Record<string, unknown> }).data.name,
    "Wordy",
    "#4767 name survives even when description is the bulk",
  );
  assert.ok(
    (descRead.truncation?.fields ?? []).some((f) => f.path === "data.description"),
    "#4767 a description-dominated card elides the description (recoverable), not the identity",
  );
  const descWindow = await mariDb.executeAction({
    action: "character.get",
    id: descHeavyId,
    field: "data.description",
    offset: 0,
    limit: 20_000,
  });
  assert.equal(
    descWindow.truncation?.field?.total,
    40_000,
    "#4767 the elided description must be fully recoverable via field=",
  );
  // A field= path that does not resolve returns the overview WITH a not-found signal.
  const missingField = await mariDb.executeAction({
    action: "character.get",
    id: heavyCharacterId,
    field: "data.no_such_field",
  });
  assert.equal(
    missingField.truncation?.unresolvedField,
    "data.no_such_field",
    "#4767 an unresolved field= must be flagged, not silently swallowed",
  );
  // Same path on a SMALL row that needs no elision: still flags the miss, and
  // reports no elided fields (so the note must not promise a field list).
  const smallMissingField = await mariDb.executeAction({
    action: "character.get",
    id: characterId,
    field: "data.no_such_field",
  });
  assert.equal(
    smallMissingField.truncation?.unresolvedField,
    "data.no_such_field",
    "#4767 a small-row unresolved field= must still be flagged",
  );
  assert.equal(
    (smallMissingField.truncation?.fields ?? []).length,
    0,
    "#4767 a small-row unresolved field= reports no elided fields",
  );
  // A path reaching an inherited/prototype key must resolve to nothing, not the
  // Object constructor (which would crash the field window). Own-property only.
  const prototypeField = await mariDb.executeAction({
    action: "character.get",
    id: heavyCharacterId,
    field: "constructor",
  });
  assert.equal(prototypeField.ok, true, "#4767 a prototype-key field= must not crash the read");
  assert.equal(
    prototypeField.truncation?.unresolvedField,
    "constructor",
    "#4767 an inherited key must resolve as unresolved, not the constructor",
  );
  // A small read is untouched: no truncation metadata, behavior identical to before.
  const smallRead = await mariDb.executeAction({ action: "character.get", id: characterId });
  assert.equal(smallRead.truncation, undefined, "#4767 a small read must not be bounded or flagged");
  const characterFolderTimestamp = "2026-08-04T12:00:00.000Z";
  await db.insert(characterGroups).values({
    id: "character-folder-source",
    name: "Source Folder",
    description: "",
    characterIds: JSON.stringify([characterId]),
    createdAt: characterFolderTimestamp,
    updatedAt: characterFolderTimestamp,
  });
  await db.insert(characterGroups).values({
    id: "character-folder-target",
    name: "Target Folder",
    description: "",
    characterIds: "[]",
    createdAt: characterFolderTimestamp,
    updatedAt: characterFolderTimestamp,
  });
  const folderListResult = await mariDb.executeAction({ action: "character.folder.list" });
  assert.equal(folderListResult.ok, true, "Professor Mari must be able to list character folders");
  assert.deepEqual(
    (folderListResult.output as Array<{ id: string }>).map((folder) => folder.id),
    ["character-folder-source", "character-folder-target"],
  );
  const folderMoveResult = await mariDb.executeAction({
    action: "character.moveToFolder",
    characterId,
    folderName: "Target Folder",
    reason: "Regression coverage for issue #4568",
    apply: true,
  });
  assert.equal(folderMoveResult.ok, true, "Professor Mari must be able to move a character into a named folder");
  const foldersAfterMove = await db.select().from(characterGroups);
  const sourceFolder = foldersAfterMove.find((folder) => folder.id === "character-folder-source");
  const targetFolder = foldersAfterMove.find((folder) => folder.id === "character-folder-target");
  assert.deepEqual(JSON.parse(sourceFolder?.characterIds ?? "[]"), []);
  assert.deepEqual(JSON.parse(targetFolder?.characterIds ?? "[]"), [characterId]);
  const unchangedFolderTimestamp = "2026-08-04T12:30:00.000Z";
  const unchangedMembership = ["neighbor-before", characterId, "neighbor-after"];
  await db
    .update(characterGroups)
    .set({ characterIds: JSON.stringify(unchangedMembership), updatedAt: unchangedFolderTimestamp })
    .where(eq(characterGroups.id, "character-folder-target"));
  const noOpFolderMoveResult = await mariDb.executeAction({
    action: "character.moveToFolder",
    characterId,
    folderId: "character-folder-target",
    apply: true,
  });
  assert.equal(noOpFolderMoveResult.ok, true);
  const unchangedFolder = (await db.select().from(characterGroups)).find(
    (folder) => folder.id === "character-folder-target",
  );
  assert.deepEqual(JSON.parse(unchangedFolder?.characterIds ?? "[]"), unchangedMembership);
  assert.equal(unchangedFolder?.updatedAt, unchangedFolderTimestamp);
  for (const id of ["character-folder-duplicate-a", "character-folder-duplicate-b"]) {
    await db.insert(characterGroups).values({
      id,
      name: "Duplicate Folder",
      description: "",
      characterIds: "[]",
      createdAt: characterFolderTimestamp,
      updatedAt: characterFolderTimestamp,
    });
  }
  const ambiguousFolderMoveResult = await mariDb.executeAction({
    action: "character.moveToFolder",
    characterId,
    folderName: "Duplicate Folder",
    apply: true,
  });
  assert.equal(ambiguousFolderMoveResult.ok, false, "Duplicate folder names must require an explicit folder ID");
  assert.match(String(ambiguousFolderMoveResult.error), /send the folderId from character.folder.list/);
  // #7949: a folder miss points to the list and never to a create action, which does not exist.
  const unknownFolderNameResult = await mariDb.executeAction({
    action: "character.moveToFolder",
    characterId,
    folderName: "Nowhere Folder",
    apply: true,
  });
  assert.equal(unknownFolderNameResult.ok, false);
  assert.match(
    String(unknownFolderNameResult.error),
    /No character folder is named "Nowhere Folder". List folders with character.folder.list; folders are created in the UI only/,
  );
  assert.doesNotMatch(String(unknownFolderNameResult.error), /folder.create/);
  const unknownFolderIdResult = await mariDb.executeAction({
    action: "character.moveToFolder",
    characterId,
    folderId: "character-folder-missing",
    apply: true,
  });
  assert.equal(unknownFolderIdResult.ok, false);
  assert.match(String(unknownFolderIdResult.error), /No character folder has the id "character-folder-missing"./);
  const duplicateFoldersAfterAmbiguousMove = (await db.select().from(characterGroups)).filter((folder) =>
    folder.id.startsWith("character-folder-duplicate-"),
  );
  assert.deepEqual(
    duplicateFoldersAfterAmbiguousMove.map((folder) => JSON.parse(folder.characterIds)),
    [[], []],
  );
  const duplicateFolderIdMoveResult = await mariDb.executeAction({
    action: "character.moveToFolder",
    characterId,
    folderId: "character-folder-duplicate-a",
    apply: true,
  });
  assert.equal(duplicateFolderIdMoveResult.ok, true, "An explicit folder ID must disambiguate duplicate names");
  const duplicateFoldersAfterIdMove = (await db.select().from(characterGroups)).filter((folder) =>
    folder.id.startsWith("character-folder-duplicate-"),
  );
  const selectedDuplicateFolder = duplicateFoldersAfterIdMove.find((folder) => folder.id.endsWith("-a"));
  const unselectedDuplicateFolder = duplicateFoldersAfterIdMove.find((folder) => folder.id.endsWith("-b"));
  assert.deepEqual(JSON.parse(selectedDuplicateFolder?.characterIds ?? "[]"), [characterId]);
  assert.deepEqual(JSON.parse(unselectedDuplicateFolder?.characterIds ?? "[]"), []);
  const concurrentCharacterId = "character-folder-concurrent-character";
  const concurrentCharacterCreateResult = await mariDb.executeAction({
    action: "character.create",
    characterId: concurrentCharacterId,
    data: { name: "Concurrent Folder Character" },
    apply: true,
  });
  assert.equal(concurrentCharacterCreateResult.ok, true);
  await db.insert(characterGroups).values({
    id: "character-folder-concurrent-target",
    name: "Concurrent Target",
    description: "",
    characterIds: "[]",
    createdAt: characterFolderTimestamp,
    updatedAt: characterFolderTimestamp,
  });
  const concurrentFolderMoves = await Promise.all(
    [characterId, concurrentCharacterId].map((movingCharacterId) =>
      mariDb.executeAction({
        action: "character.moveToFolder",
        characterId: movingCharacterId,
        folderId: "character-folder-concurrent-target",
        apply: true,
      }),
    ),
  );
  assert.ok(
    concurrentFolderMoves.every((result) => result.ok),
    "Concurrent folder moves must both succeed",
  );
  const concurrentTargetFolder = (await db.select().from(characterGroups)).find(
    (folder) => folder.id === "character-folder-concurrent-target",
  );
  assert.deepEqual(
    JSON.parse(concurrentTargetFolder?.characterIds ?? "[]").sort(),
    [characterId, concurrentCharacterId].sort(),
    "Serialized folder moves must preserve both memberships",
  );
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
