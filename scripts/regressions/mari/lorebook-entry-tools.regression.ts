// Mari's lorebook entry tools: the full-entry reader keeps the whole body, create and update save the keyword and
// selective fields, deleteEntry removes exactly one entry, and editing an embedded lorebook resyncs its character's
// copy. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterDataSchema } from "../../../packages/shared/src/schemas/character.schema.js";
import { createCharactersStorage } from "../../../packages/server/src/services/storage/characters.storage.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";
import { createLibraryFoldersStorage } from "../../../packages/server/src/services/storage/library-folders.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { PROFESSOR_MARI_APP_DATA_ACTIONS } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-lorebook-entry-tools-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const characterStorage = createCharactersStorage(db);
  const lorebookStorage = createLorebooksStorage(db);
  const libraryFolderStorage = createLibraryFoldersStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  const professorMariLorebookId = "professor-mari-lorebook-create-regression";
  const professorMariFullEntryContent = `The entry starts here. ${"Full lorebook body segment. ".repeat(20)}The entry ends here.`;
  const professorMariLorebookResult = await mariDb.executeAction({
    action: "lorebook.create",
    lorebookId: professorMariLorebookId,
    data: {
      name: "Professor Mari lorebook regression",
      entries: [{ name: "Verified entry", content: professorMariFullEntryContent, keys: ["verified"] }],
    },
    apply: true,
  });
  assert.equal(professorMariLorebookResult.ok, true, "Professor Mari must create lorebooks after visibility was added");
  const professorMariLorebook = await lorebookStorage.getById(professorMariLorebookId);
  assert.equal(professorMariLorebook?.hiddenFromLibrary, false);
  const professorMariEntries = await lorebookStorage.listEntries(professorMariLorebookId);
  assert.equal(professorMariEntries.length, 1);
  const professorMariEntryId = professorMariEntries[0]?.id;
  assert.ok(professorMariEntryId);
  assert.ok(PROFESSOR_MARI_APP_DATA_ACTIONS.includes("lorebook.getEntry"));
  const professorMariEntryIndex = await mariDb.executeAction({
    action: "lorebook.entries",
    lorebookId: professorMariLorebookId,
  });
  assert.equal(
    (professorMariEntryIndex.output as { items: Array<{ content: string }> }).items[0]?.content.endsWith("…"),
    true,
    "the lorebook entry index should remain compact",
  );
  const professorMariFullEntry = await mariDb.executeAction({
    action: "lorebook.getEntry",
    entryId: professorMariEntryId,
  });
  assert.equal(professorMariFullEntry.ok, true);
  assert.equal(
    (professorMariFullEntry.output as { content?: string }).content,
    professorMariFullEntryContent,
    "Professor Mari's full-entry reader must preserve the complete lorebook body",
  );
  assert.ok(PROFESSOR_MARI_APP_DATA_ACTIONS.includes("lorebook.folder.create"));
  assert.ok(PROFESSOR_MARI_APP_DATA_ACTIONS.includes("lorebook.libraryFolder.create"));
  const professorMariRootFolderId = "professor-mari-entry-folder-root";
  const professorMariChildFolderId = "professor-mari-entry-folder-child";
  assert.equal(
    (
      await mariDb.executeAction({
        action: "lorebook.folder.create",
        lorebookId: professorMariLorebookId,
        folderId: professorMariRootFolderId,
        name: "People",
        apply: true,
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await mariDb.executeAction({
        action: "lorebook.folder.create",
        lorebookId: professorMariLorebookId,
        folderId: professorMariChildFolderId,
        data: { name: "Researchers", parentFolderId: professorMariRootFolderId },
        apply: true,
      })
    ).ok,
    true,
  );
  const concurrentEntryFolderIds = ["professor-mari-entry-folder-a", "professor-mari-entry-folder-b"];
  const concurrentEntryFolderResults = await Promise.all(
    concurrentEntryFolderIds.map((folderId, index) =>
      mariDb.executeAction({
        action: "lorebook.folder.create",
        lorebookId: professorMariLorebookId,
        folderId,
        name: `Concurrent folder ${index + 1}`,
        apply: true,
      }),
    ),
  );
  assert.equal(
    concurrentEntryFolderResults.every((result) => result.ok),
    true,
  );
  const professorMariFolderList = await mariDb.executeAction({
    action: "lorebook.folder.list",
    lorebookId: professorMariLorebookId,
  });
  const professorMariFolders = professorMariFolderList.output as Array<{
    id: string;
    parentFolderId: string | null;
    order: number;
  }>;
  assert.deepEqual(
    professorMariFolders.slice(0, 2).map((folder) => ({
      id: folder.id,
      parentFolderId: folder.parentFolderId,
    })),
    [
      { id: professorMariRootFolderId, parentFolderId: null },
      { id: professorMariChildFolderId, parentFolderId: professorMariRootFolderId },
    ],
  );
  assert.equal(new Set(professorMariFolders.map((folder) => folder.order)).size, professorMariFolders.length);
  const professorMariLibraryFolderId = "professor-mari-library-folder";
  assert.equal(
    (
      await mariDb.executeAction({
        action: "lorebook.libraryFolder.create",
        folderId: professorMariLibraryFolderId,
        name: "Test folder",
        apply: true,
      })
    ).ok,
    true,
  );
  const concurrentLibraryFolderIds = ["professor-mari-library-folder-a", "professor-mari-library-folder-b"];
  const concurrentLibraryFolderResults = await Promise.all(
    concurrentLibraryFolderIds.map((folderId, index) =>
      mariDb.executeAction({
        action: "lorebook.libraryFolder.create",
        folderId,
        name: `Concurrent library folder ${index + 1}`,
        apply: true,
      }),
    ),
  );
  assert.equal(
    concurrentLibraryFolderResults.every((result) => result.ok),
    true,
  );
  const professorMariLibraryFolders = await mariDb.executeAction({ action: "lorebook.libraryFolder.list" });
  const professorMariLibraryFolderRows = professorMariLibraryFolders.output as Array<{
    id: string;
    scope: string;
    name: string;
    collapsed: string;
    sortOrder: number;
    itemIds: string[];
  }>;
  const professorMariLibraryFolder = professorMariLibraryFolderRows.find(
    (folder) => folder.id === professorMariLibraryFolderId,
  );
  assert.equal(professorMariLibraryFolder?.scope, "lorebooks");
  assert.equal(professorMariLibraryFolder?.name, "Test folder");
  assert.deepEqual(professorMariLibraryFolder?.itemIds, []);
  const createdLibraryFolderRows = professorMariLibraryFolderRows.filter((folder) =>
    [professorMariLibraryFolderId, ...concurrentLibraryFolderIds].includes(folder.id),
  );
  assert.equal(
    new Set(createdLibraryFolderRows.map((folder) => folder.sortOrder)).size,
    createdLibraryFolderRows.length,
  );
  for (const folderId of [professorMariLibraryFolderId, ...concurrentLibraryFolderIds]) {
    await libraryFolderStorage.remove("lorebooks", folderId);
  }
  await lorebookStorage.remove(professorMariLorebookId);
  assert.equal(await lorebookStorage.getById(professorMariLorebookId), null);
  assert.equal((await lorebookStorage.listEntries(professorMariLorebookId)).length, 0);
  // #4791 — Professor Mari's lorebook.create + updateEntry now persist the keyword-matching and
  // selective fields that were previously hardcoded, so her authoring + fidelity pass can set them.
  const professorMariParamLorebookId = "professor-mari-param-lorebook-regression";
  const professorMariParamCreate = await mariDb.executeAction({
    action: "lorebook.create",
    lorebookId: professorMariParamLorebookId,
    data: {
      name: "Professor Mari parameterized entries",
      entries: [
        {
          name: "Vlad",
          content: "The immortal count.",
          keys: ["Vlad"],
          secondaryKeys: ["count", "castle"],
          selective: true,
          selectiveLogic: "and_all",
          matchWholeWords: true,
          caseSensitive: true,
          // Embedded entries must also receive the full user-editable settings, not just the
          // keyword-matching subset the builder handles.
          probability: 25,
          sticky: 6,
          groupWeight: 8,
          excludeRecursion: true,
          characterFilterMode: "include",
          characterFilterIds: ["char-embedded"],
        },
      ],
    },
    apply: true,
  });
  assert.equal(professorMariParamCreate.ok, true);
  const professorMariParamEntry = (await lorebookStorage.listEntries(professorMariParamLorebookId))[0];
  assert.ok(professorMariParamEntry);
  assert.equal(professorMariParamEntry.selective, true, "create must persist selective");
  assert.equal(professorMariParamEntry.selectiveLogic, "and_all", "create must persist selectiveLogic");
  assert.equal(professorMariParamEntry.matchWholeWords, true, "create must persist matchWholeWords");
  assert.equal(professorMariParamEntry.caseSensitive, true, "create must persist caseSensitive");
  assert.equal(professorMariParamEntry.useRegex, false, "unset useRegex stays default");
  assert.equal(professorMariParamEntry.probability, 25, "create must persist an embedded entry's probability");
  assert.equal(professorMariParamEntry.sticky, 6, "create must persist an embedded entry's timing field");
  assert.equal(professorMariParamEntry.groupWeight, 8, "create must persist an embedded entry's groupWeight");
  assert.equal(
    professorMariParamEntry.excludeRecursion,
    true,
    "create must persist an embedded entry's recursion flag",
  );
  assert.equal(
    professorMariParamEntry.characterFilterMode,
    "include",
    "create must persist an embedded entry's filter mode",
  );
  assert.deepEqual(
    professorMariParamEntry.characterFilterIds,
    ["char-embedded"],
    "create must persist an embedded entry's filter ids",
  );
  // updateEntry (the fidelity-pass path, via assignLorebookEntryActionFields) patches the same fields.
  const professorMariEntryUpdate = await mariDb.executeAction({
    action: "lorebook.updateEntry",
    entryId: professorMariParamEntry.id,
    patch: { matchWholeWords: false, selectiveLogic: "not", useRegex: true },
    apply: true,
  });
  assert.equal(professorMariEntryUpdate.ok, true);
  const professorMariUpdatedEntry = (await lorebookStorage.listEntries(professorMariParamLorebookId))[0];
  assert.ok(professorMariUpdatedEntry);
  assert.equal(professorMariUpdatedEntry.matchWholeWords, false, "updateEntry must clear matchWholeWords");
  assert.equal(professorMariUpdatedEntry.selectiveLogic, "not", "updateEntry must patch selectiveLogic");
  assert.equal(professorMariUpdatedEntry.useRegex, true, "updateEntry must set useRegex");
  // An invalid selectiveLogic is ignored; a valid sibling field in the same patch still applies.
  const professorMariBadLogicUpdate = await mariDb.executeAction({
    action: "lorebook.updateEntry",
    entryId: professorMariParamEntry.id,
    patch: { content: "Updated body.", selectiveLogic: "nonsense" },
    apply: true,
  });
  assert.equal(professorMariBadLogicUpdate.ok, true);
  const professorMariAfterBadLogic = (await lorebookStorage.listEntries(professorMariParamLorebookId))[0];
  assert.ok(professorMariAfterBadLogic);
  assert.equal(professorMariAfterBadLogic.content, "Updated body.", "valid sibling field still applies");
  assert.equal(professorMariAfterBadLogic.selectiveLogic, "not", "invalid selectiveLogic is ignored");
  // #4791 follow-up: the remaining user-editable entry settings (activation chance, timing,
  // recursion, grouping, scan depth, lock, filters) are now patchable via updateEntry too, and
  // probability is clamped to 0-100.
  const professorMariSettingsUpdate = await mariDb.executeAction({
    action: "lorebook.updateEntry",
    entryId: professorMariParamEntry.id,
    patch: {
      probability: 150,
      sticky: 3,
      cooldown: 2,
      delay: 1,
      groupWeight: 5,
      scanDepth: 4,
      preventRecursion: false,
      excludeRecursion: true,
      delayUntilRecursion: true,
      excludeFromVectorization: true,
      locked: true,
      characterFilterIds: ["char-1", "char-2"],
    },
    apply: true,
  });
  assert.equal(
    professorMariSettingsUpdate.ok,
    true,
    `settings updateEntry must succeed: ${JSON.stringify(professorMariSettingsUpdate)}`,
  );
  const professorMariSettingsEntry = (await lorebookStorage.listEntries(professorMariParamLorebookId))[0];
  assert.ok(professorMariSettingsEntry);
  assert.equal(professorMariSettingsEntry.probability, 100, "probability is clamped to 0-100");
  assert.equal(professorMariSettingsEntry.sticky, 3, "updateEntry sets sticky");
  assert.equal(professorMariSettingsEntry.cooldown, 2, "updateEntry sets cooldown");
  assert.equal(professorMariSettingsEntry.delay, 1, "updateEntry sets delay");
  assert.equal(professorMariSettingsEntry.groupWeight, 5, "updateEntry sets groupWeight");
  assert.equal(professorMariSettingsEntry.scanDepth, 4, "updateEntry sets scanDepth");
  assert.equal(professorMariSettingsEntry.preventRecursion, false, "updateEntry clears preventRecursion");
  assert.equal(professorMariSettingsEntry.excludeRecursion, true, "updateEntry sets excludeRecursion");
  assert.equal(professorMariSettingsEntry.delayUntilRecursion, true, "updateEntry sets delayUntilRecursion");
  assert.equal(professorMariSettingsEntry.excludeFromVectorization, true, "updateEntry sets excludeFromVectorization");
  assert.equal(professorMariSettingsEntry.locked, true, "updateEntry sets locked");
  assert.deepEqual(
    professorMariSettingsEntry.characterFilterIds,
    ["char-1", "char-2"],
    "updateEntry sets characterFilterIds",
  );
  // #4791 follow-up (hardening): nullable numbers clear on explicit null, ephemeral honors its int>=0
  // bound, filter modes are enum-validated (and case-normalized), and unknown matching sources drop.
  const professorMariHardeningUpdate = await mariDb.executeAction({
    action: "lorebook.updateEntry",
    entryId: professorMariParamEntry.id,
    patch: {
      sticky: null,
      ephemeral: -5,
      characterFilterMode: "Include",
      characterTagFilterMode: "bogus",
      additionalMatchingSources: ["character_description", "not_a_source"],
    },
    apply: true,
  });
  assert.equal(
    professorMariHardeningUpdate.ok,
    true,
    `hardening updateEntry must succeed: ${JSON.stringify(professorMariHardeningUpdate)}`,
  );
  const professorMariHardenedEntry = (await lorebookStorage.listEntries(professorMariParamLorebookId))[0];
  assert.ok(professorMariHardenedEntry);
  assert.equal(professorMariHardenedEntry.sticky, null, "explicit null clears a nullable numeric field");
  assert.equal(professorMariHardenedEntry.ephemeral, 0, "ephemeral clamps a negative to its 0 minimum");
  assert.equal(professorMariHardenedEntry.characterFilterMode, "include", "a filter mode is normalized and validated");
  assert.equal(
    professorMariHardenedEntry.characterTagFilterMode,
    "any",
    "an invalid filter mode is dropped, leaving the default",
  );
  assert.deepEqual(
    professorMariHardenedEntry.additionalMatchingSources,
    ["character_description"],
    "unknown additionalMatchingSources values are filtered out",
  );
  // folderId must reference an existing folder in the entry's own lorebook: a bad id is rejected
  // (unlike the pre-fix path, which stored a dangling reference), and an explicit null clears it.
  const professorMariBadFolder = await mariDb.executeAction({
    action: "lorebook.updateEntry",
    entryId: professorMariParamEntry.id,
    patch: { folderId: "no-such-folder" },
    apply: true,
  });
  assert.equal(
    professorMariBadFolder.ok,
    false,
    "updateEntry rejects a folderId that is not a folder in the entry's lorebook",
  );
  const professorMariClearFolder = await mariDb.executeAction({
    action: "lorebook.updateEntry",
    entryId: professorMariParamEntry.id,
    patch: { folderId: null },
    apply: true,
  });
  assert.equal(professorMariClearFolder.ok, true, "updateEntry accepts a folder-only null clear");
  const professorMariClearedEntry = (await lorebookStorage.listEntries(professorMariParamLorebookId))[0];
  assert.equal(professorMariClearedEntry.folderId, null, "explicit null clears folderId");
  // lorebook.addEntry (app_data action) shares the same whitelist + builders; confirm the create path
  // also persists the new fields when they arrive as top-level keys (exercising the addentry allowlist).
  const professorMariAddEntry = await mariDb.executeAction({
    action: "lorebook.addEntry",
    lorebookId: professorMariParamLorebookId,
    data: { name: "Regex entry", content: "Pattern-matched lore.", keys: ["\\bLycan\\b"], useRegex: true },
    probability: 20,
    excludeRecursion: true,
    sticky: 7,
    characterFilterIds: ["char-9"],
    apply: true,
  });
  assert.equal(professorMariAddEntry.ok, true);
  const professorMariAddedEntry = (await lorebookStorage.listEntries(professorMariParamLorebookId)).find(
    (entry) => entry.name === "Regex entry",
  );
  assert.ok(professorMariAddedEntry);
  assert.equal(professorMariAddedEntry.useRegex, true, "addEntry must persist useRegex");
  assert.equal(professorMariAddedEntry.probability, 20, "addEntry persists a top-level allowlisted number");
  assert.equal(professorMariAddedEntry.excludeRecursion, true, "addEntry persists a top-level allowlisted boolean");
  assert.equal(professorMariAddedEntry.sticky, 7, "addEntry persists a top-level allowlisted timing field");
  assert.deepEqual(
    professorMariAddedEntry.characterFilterIds,
    ["char-9"],
    "addEntry persists a top-level allowlisted list field",
  );
  await lorebookStorage.remove(professorMariParamLorebookId);
  // #4924: lorebook.deleteEntry removes exactly ONE entry (scoped), so Mari never needs a raw
  // `mari db delete --where` that can mass-delete unrelated rows.
  const professorMariDeleteLorebookId = "professor-mari-delete-entry-regression";
  try {
    const professorMariDeleteCreate = await mariDb.executeAction({
      action: "lorebook.create",
      lorebookId: professorMariDeleteLorebookId,
      data: {
        name: "Delete-entry regression",
        entries: [
          { name: "Keep me", content: "This entry must survive." },
          { name: "Remove me", content: "This entry gets deleted." },
        ],
      },
      apply: true,
    });
    assert.equal(professorMariDeleteCreate.ok, true);
    const professorMariDeleteEntries = await lorebookStorage.listEntries(professorMariDeleteLorebookId);
    assert.equal(professorMariDeleteEntries.length, 2, "both entries were created");
    const professorMariEntryToDelete = professorMariDeleteEntries.find((entry) => entry.name === "Remove me");
    const professorMariEntryToKeep = professorMariDeleteEntries.find((entry) => entry.name === "Keep me");
    assert.ok(professorMariEntryToDelete && professorMariEntryToKeep, "both named entries are present before delete");

    // Deleting a non-existent entry is rejected, not a silent no-op.
    const professorMariDeleteMissing = await mariDb.executeAction({
      action: "lorebook.deleteEntry",
      entryId: "no-such-entry-id",
      apply: true,
    });
    assert.equal(professorMariDeleteMissing.ok, false, "deleting a missing entry is rejected");

    const professorMariDeleteResult = await mariDb.executeAction({
      action: "lorebook.deleteEntry",
      entryId: professorMariEntryToDelete.id,
      apply: true,
    });
    assert.equal(
      professorMariDeleteResult.ok,
      true,
      `lorebook.deleteEntry must succeed: ${JSON.stringify(professorMariDeleteResult)}`,
    );
    const professorMariAfterDelete = await lorebookStorage.listEntries(professorMariDeleteLorebookId);
    assert.equal(professorMariAfterDelete.length, 1, "exactly one entry was removed (scoped, not a mass delete)");
    assert.equal(professorMariAfterDelete[0]?.id, professorMariEntryToKeep.id, "the untargeted entry survives");
  } finally {
    await lorebookStorage.remove(professorMariDeleteLorebookId);
  }
  // #4927: a Mari lorebook entry mutation resyncs an embedded character's data.character_book on
  // both apply and Restore. The generic mari-db mutation path used to skip
  // syncCharacterBookFromLorebook, so add/update/delete of an embedded lorebook's entries left the
  // character's derived copy stale.
  const embeddedSyncLorebook = await lorebookStorage.create({ name: "Embedded sync book" });
  const embeddedSyncCharacter = await characterStorage.create(
    characterDataSchema.parse({
      name: "Embedded sync host",
      character_book: { name: "Embedded sync book", entries: [] },
      extensions: { importMetadata: { embeddedLorebook: { lorebookId: embeddedSyncLorebook.id } } },
    }),
  );
  assert.ok(embeddedSyncCharacter, "embedded host character created");
  let embeddedReparentTargetId: string | null = null;
  let embeddedLinkDecoyId: string | null = null;
  try {
    await lorebookStorage.update(embeddedSyncLorebook.id, { characterId: embeddedSyncCharacter.id });
    const embeddedSyncEntry = await lorebookStorage.createEntry({
      lorebookId: embeddedSyncLorebook.id,
      name: "Embedded entry",
      content: "original content",
      keys: ["embed"],
    });
    const readEmbeddedBookContent = async () => {
      const row = await characterStorage.getById(embeddedSyncCharacter.id);
      const data = JSON.parse(String(row?.data ?? "{}")) as {
        character_book?: { entries?: Array<{ content?: string }> };
      };
      return (data.character_book?.entries ?? []).map((entry) => entry.content ?? "");
    };

    const beforeEmbeddedSync = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
    const embeddedSyncUpdate = await mariDb.executeAction({
      action: "lorebook.updateEntry",
      entryId: embeddedSyncEntry.id,
      patch: { content: "edited content" },
      apply: true,
    });
    assert.equal(embeddedSyncUpdate.ok, true);
    assert.ok(
      (await readEmbeddedBookContent()).includes("edited content"),
      "applying a Mari entry edit resyncs the embedded character_book",
    );

    const embeddedSyncApproval = mariDb.getPendingApprovals().find((approval) => !beforeEmbeddedSync.has(approval.id));
    assert.ok(embeddedSyncApproval, "the entry edit produced a reviewable approval");
    const embeddedSyncRestore = await mariDb.restoreAppliedReview(embeddedSyncApproval.id);
    assert.ok(
      embeddedSyncRestore && "history" in embeddedSyncRestore,
      `restoring the entry edit must succeed (not null / state_changed): ${JSON.stringify(embeddedSyncRestore)}`,
    );
    assert.ok(
      (await readEmbeddedBookContent()).includes("original content"),
      "restoring the edit resyncs the embedded character_book back",
    );

    // #4927 (reparent): moving an entry to a DIFFERENT lorebook must resync the entry's FORMER
    // lorebook too, not just the destination. syncAffectedCharacterBooks collects both sides of a
    // lorebook_entries change, so the embedded book the entry LEFT rebuilds without it. (The old
    // `after ?? before` collection synced only the destination and left this book stale.)
    const embeddedReparentTarget = await lorebookStorage.create({ name: "Reparent target book" });
    embeddedReparentTargetId = embeddedReparentTarget.id;
    const embeddedReparent = await mariDb.executeCli({
      argv: [
        "db",
        "patch",
        "lorebook_entries",
        embeddedSyncEntry.id,
        "--json",
        JSON.stringify({ lorebookId: embeddedReparentTarget.id }),
        "--apply",
      ],
    });
    assert.equal(
      embeddedReparent.ok,
      true,
      `reparenting an entry to another lorebook must succeed: ${JSON.stringify(embeddedReparent)}`,
    );
    assert.deepEqual(
      await readEmbeddedBookContent(),
      [],
      "reparenting an entry OUT of the embedded lorebook resyncs the former lorebook (the moved entry no longer appears)",
    );

    // #4932: whole-lorebook deletion must resolve the actual embedding character before the
    // generic cascade removes its links. Keep a different linked character first to prove the
    // hydrated lorebook's derived characterId is not treated as the embedded owner.
    const embeddedLinkDecoy = await characterStorage.create(characterDataSchema.parse({ name: "A linked decoy" }));
    assert.ok(embeddedLinkDecoy);
    embeddedLinkDecoyId = embeddedLinkDecoy.id;
    await lorebookStorage.update(embeddedSyncLorebook.id, {
      characterIds: [embeddedLinkDecoy.id, embeddedSyncCharacter.id],
    });
    const pendingBeforeDelete = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
    const embeddedWholeDelete = await mariDb.executeCli({
      argv: ["db", "delete", "lorebooks", embeddedSyncLorebook.id, "--cascade", "--apply"],
    });
    assert.equal(
      embeddedWholeDelete.ok,
      true,
      `deleting an embedded lorebook through mari-db must succeed: ${JSON.stringify(embeddedWholeDelete)}`,
    );
    const deletedHost = await characterStorage.getById(embeddedSyncCharacter.id);
    const deletedHostData = JSON.parse(String(deletedHost?.data ?? "{}")) as {
      character_book?: unknown;
      extensions?: { importMetadata?: { embeddedLorebook?: unknown } };
    };
    assert.equal(deletedHostData.character_book, null, "whole-lorebook delete clears the embedded character book");
    assert.equal(
      deletedHostData.extensions?.importMetadata?.embeddedLorebook,
      undefined,
      "whole-lorebook delete clears the embedded lorebook pointer",
    );
    const wholeDeleteApproval = mariDb.getPendingApprovals().find((approval) => !pendingBeforeDelete.has(approval.id));
    assert.ok(wholeDeleteApproval, "whole-lorebook delete produced a reviewable approval");
    const restoredWholeDelete = await mariDb.restoreAppliedReview(wholeDeleteApproval.id);
    assert.ok(restoredWholeDelete && "history" in restoredWholeDelete, "whole-lorebook Restore must succeed");
    const restoredHost = await characterStorage.getById(embeddedSyncCharacter.id);
    const restoredHostData = JSON.parse(String(restoredHost?.data ?? "{}")) as {
      character_book?: { entries?: unknown[] };
      extensions?: { importMetadata?: { embeddedLorebook?: { lorebookId?: string } } };
    };
    assert.deepEqual(restoredHostData.character_book?.entries, [], "Restore re-embeds even an empty character book");
    assert.equal(
      restoredHostData.extensions?.importMetadata?.embeddedLorebook?.lorebookId,
      embeddedSyncLorebook.id,
      "Restore reinstates the embedded lorebook pointer on the actual host",
    );
  } finally {
    await lorebookStorage.remove(embeddedSyncLorebook.id);
    await characterStorage.remove(embeddedSyncCharacter.id);
    if (embeddedReparentTargetId) await lorebookStorage.remove(embeddedReparentTargetId);
    if (embeddedLinkDecoyId) await characterStorage.remove(embeddedLinkDecoyId);
  }
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
