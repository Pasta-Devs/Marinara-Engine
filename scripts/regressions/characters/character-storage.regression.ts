// Saving characters and personas: names normalized on every path, version snapshots, duplicates, referenced cards in
// prompts, embedded lorebooks that stay hidden from searches, and deletion links. Runs on a fresh database.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  characterCardVersions,
  characters,
  lorebookCharacterLinks,
  lorebooks,
} from "../../../packages/server/src/db/schema/index.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import {
  createLorebookEntrySchema,
  createLorebookSchema,
} from "../../../packages/shared/src/schemas/lorebook.schema.js";
import { characterDataSchema, updateCharacterSchema } from "../../../packages/shared/src/schemas/character.schema.js";
import { createCharactersStorage } from "../../../packages/server/src/services/storage/characters.storage.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import {
  buildReferencedCharacterContext,
  buildReferencedPersonaContext,
  extractPersonaReferenceIds,
  MAX_REFERENCED_CHARACTERS,
} from "../../../packages/server/src/services/prompt/macro-context.js";
import { assemblePrompt } from "../../../packages/server/src/services/prompt/assembler.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-character-storage-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const characterStorage = createCharactersStorage(db);
  const lorebookStorage = createLorebooksStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const storageTrimFixture = await characterStorage.create({
    ...characterDataSchema.parse({ name: "Storage trim fixture" }),
    name: "  Storage trim fixture  ",
  });
  assert.equal(
    (JSON.parse(storageTrimFixture.data) as { name: string }).name,
    "Storage trim fixture",
    "Character storage must normalize names even when a caller bypasses route validation",
  );
  const storageTrimFixtureData = JSON.parse(storageTrimFixture.data) as Record<string, unknown>;
  await db
    .update(characters)
    .set({ data: JSON.stringify({ ...storageTrimFixtureData, name: "  Version snapshot fixture  " }) })
    .where(eq(characters.id, storageTrimFixture.id));
  const normalizedSnapshot = await characterStorage.createVersionSnapshot(storageTrimFixture.id);
  assert.equal(
    normalizedSnapshot?.data.name,
    "Version snapshot fixture",
    "Character version snapshots must normalize legacy padded names",
  );
  const resetTrimFixture = await characterStorage.resetVersions(storageTrimFixture.id);
  assert.equal(
    (JSON.parse(resetTrimFixture?.data ?? "{}") as { name?: string }).name,
    "Version snapshot fixture",
    "Resetting Character versions must normalize legacy padded names",
  );
  await db
    .update(characters)
    .set({ data: JSON.stringify({ ...storageTrimFixtureData, name: "  Duplicate fixture  " }) })
    .where(eq(characters.id, storageTrimFixture.id));
  const duplicateTrimFixture = await characterStorage.duplicateCharacter(storageTrimFixture.id);
  assert.equal(
    (JSON.parse(duplicateTrimFixture?.data ?? "{}") as { name?: string }).name,
    "Duplicate fixture (Copy)",
    "Duplicating a Character must normalize legacy padded names",
  );
  const referencedCharacter = await characterStorage.create(
    characterDataSchema.parse({
      name: "Susie",
      description: "A trusted friend from the western district.",
      first_mes: "REFERENCED_GREETING_MUST_STAY_OUT",
      mes_example: "REFERENCED_EXAMPLE_SHOULD_APPEAR",
      creator_notes: "REFERENCED_CREATOR_NOTES_MUST_STAY_OUT",
      extensions: {
        appearance: "Blonde hair and a blue summer dress.",
      },
    }),
  );
  const hiddenCharacterLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({
      name: "Susie's private memories",
      category: "character",
      characterIds: [referencedCharacter.id],
      hiddenFromLibrary: true,
    }),
  );
  await lorebookStorage.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: hiddenCharacterLorebook.id,
      name: "The cafe meeting",
      content: "REFERENCED_LOREBOOK_MEMORY",
      keys: ["cafe"],
    }),
  );
  const knownPersonaReferenceId = "PriorPersonaRef123456";
  const referencedPersona = await characterStorage.createPersona(
    "Professor Mari",
    "A brilliant engineer who understands every machine in the laboratory.",
    undefined,
    {
      personality: "Warm, incisive, and knowingly amused.",
      backstory: "She designed the laboratory's most reliable systems.",
      appearance: "Pink hair, a lab coat, and a knowing smile.",
      scenario: `She is visiting the cafe after a long experiment with {{persona-${knownPersonaReferenceId}}}.`,
      creatorNotes: "PERSONA_CREATOR_NOTES_MUST_STAY_OUT",
    },
  );
  assert.ok(referencedPersona);
  const hiddenPersonaLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({
      name: "Professor Mari's private notes",
      personaIds: [referencedPersona.id],
      hiddenFromLibrary: true,
    }),
  );
  await lorebookStorage.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: hiddenPersonaLorebook.id,
      name: "The cafe prototype",
      content: "REFERENCED_PERSONA_LOREBOOK_MEMORY",
      keys: ["cafe"],
    }),
  );
  const countOnlyReferencedCharacter = await characterStorage.create(
    characterDataSchema.parse({
      name: "Count-only character reference",
      description: `This card can see ${"{{"}lorebooksize::${hiddenCharacterLorebook.id}}} saved memory.`,
    }),
  );
  const countOnlyReferencedPersona = await characterStorage.createPersona(
    "Count-only Persona reference",
    `This Persona can see ${"{{"}lorebooksize::${hiddenPersonaLorebook.id}}} saved memory.`,
  );
  assert.ok(countOnlyReferencedPersona);
  const countOnlyCharacterContext = await buildReferencedCharacterContext({
    db,
    activeCharacterIds: [],
    sources: [`{{${countOnlyReferencedCharacter.id}}}`],
    chatMessages: [],
    macroCtx: { user: "Mari", char: "Character", characters: [], variables: {} },
    wrapFormat: "xml",
    chatId: "count-only-character-reference",
    includeLorebooks: false,
  });
  assert.match(
    countOnlyCharacterContext.content,
    /This card can see 1 saved memory\./u,
    "referenced Character fields must load lorebook counts without an attached lorebook scan",
  );
  const countOnlyPersonaContext = await buildReferencedPersonaContext({
    db,
    sources: [`{{persona-${countOnlyReferencedPersona.id}}}`],
    chatMessages: [],
    macroCtx: { user: "Mari", char: "Character", characters: [], variables: {} },
    wrapFormat: "xml",
    chatId: "count-only-persona-reference",
    includeLorebooks: false,
  });
  assert.match(
    countOnlyPersonaContext.content,
    /This Persona can see 1 saved memory\./u,
    "referenced Persona fields must load lorebook counts without an attached lorebook scan",
  );
  assert.equal(
    (await lorebookStorage.list()).some((book) => book.id === hiddenCharacterLorebook.id),
    true,
    "Hidden lorebooks must remain available to internal prompt processing",
  );
  assert.equal(
    (await lorebookStorage.listPage({ limit: 100, offset: 0, search: "Susie's private memories" })).items.length,
    0,
    "Hidden embedded lorebooks must not appear in general library searches",
  );
  const removedOwner = await characterStorage.create(characterDataSchema.parse({ name: "Removed owner" }));
  const removedOwnerLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({
      name: "Formerly private notes",
      characterIds: [removedOwner.id],
      hiddenFromLibrary: true,
    }),
  );
  await characterStorage.remove(removedOwner.id);
  assert.equal(
    (
      await db
        .select()
        .from(lorebookCharacterLinks)
        .where(eq(lorebookCharacterLinks.lorebookId, removedOwnerLorebook.id))
    ).length,
    0,
    "Deleting a Character must remove its lorebook ownership link",
  );
  const retainedOrphan = (await db.select().from(lorebooks).where(eq(lorebooks.id, removedOwnerLorebook.id)))[0];
  assert.ok(retainedOrphan, "An orphaned lorebook must remain available for recovery and management");
  assert.equal(retainedOrphan.enabled, "false");
  assert.equal(retainedOrphan.hiddenFromLibrary, "false");
  const legacyOwner = await characterStorage.create(characterDataSchema.parse({ name: "Legacy owner" }));
  const legacyLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({ name: "Legacy notes", characterIds: [legacyOwner.id], hiddenFromLibrary: true }),
  );
  await db.delete(lorebookCharacterLinks).where(eq(lorebookCharacterLinks.lorebookId, legacyLorebook.id));
  await characterStorage.remove(legacyOwner.id);
  const retainedLegacyOrphan = (await db.select().from(lorebooks).where(eq(lorebooks.id, legacyLorebook.id)))[0];
  assert.equal(retainedLegacyOrphan.characterId, null, "Deleting a Character must clear legacy direct ownership");
  assert.equal(retainedLegacyOrphan.enabled, "false", "Legacy orphaned lorebooks must be deactivated");
  assert.equal(retainedLegacyOrphan.hiddenFromLibrary, "false", "Legacy orphaned lorebooks must be manageable");
  const unlinkedOwner = await characterStorage.create(characterDataSchema.parse({ name: "Unlinked owner" }));
  const unlinkedLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({ name: "Unlinked notes", characterIds: [unlinkedOwner.id], hiddenFromLibrary: true }),
  );
  const unlinked = await lorebookStorage.update(unlinkedLorebook.id, { characterIds: [] });
  assert.equal(unlinked?.enabled, false, "Unlinking the final owner must deactivate the lorebook");
  assert.equal(unlinked?.hiddenFromLibrary, false, "An unlinked lorebook must return to the manageable library");
  const concurrentCharacterOwner = await characterStorage.create(
    characterDataSchema.parse({ name: "Concurrent owner" }),
  );
  const concurrentPersonaOwner = await characterStorage.createPersona("Concurrent persona", "Regression fixture");
  const concurrentlyUnlinkedLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({
      name: "Concurrently unlinked notes",
      characterIds: [concurrentCharacterOwner.id],
      personaIds: [concurrentPersonaOwner.id],
      hiddenFromLibrary: true,
    }),
  );
  await Promise.all([
    lorebookStorage.update(concurrentlyUnlinkedLorebook.id, { characterIds: [] }),
    lorebookStorage.update(concurrentlyUnlinkedLorebook.id, { personaIds: [] }),
  ]);
  const concurrentlyUnlinked = await lorebookStorage.getById(concurrentlyUnlinkedLorebook.id);
  assert.deepEqual(concurrentlyUnlinked?.characterIds, [], "Concurrent unlinking must not restore a Character owner");
  assert.deepEqual(concurrentlyUnlinked?.personaIds, [], "Concurrent unlinking must not restore a Persona owner");
  assert.equal(concurrentlyUnlinked?.enabled, false, "Concurrent final-owner unlinking must deactivate the lorebook");
  assert.equal(
    concurrentlyUnlinked?.hiddenFromLibrary,
    false,
    "Concurrent final-owner unlinking must leave the lorebook manageable",
  );
  const referencedContext = await buildReferencedCharacterContext({
    db,
    activeCharacterIds: [storageTrimFixture.id],
    sources: [],
    chatMessages: [
      {
        role: "user",
        content: `I went to the cafe with {{${referencedCharacter.id}}}.`,
      },
    ],
    macroCtx: {
      user: "Mari",
      char: "Version snapshot fixture",
      characters: ["Version snapshot fixture"],
      variables: {},
    },
    wrapFormat: "xml",
    chatId: "character-reference-regression",
  });
  assert.equal(referencedContext.references[referencedCharacter.id], "Susie");
  assert.match(referencedContext.content, /A trusted friend from the western district\./u);
  assert.match(referencedContext.content, /Blonde hair and a blue summer dress\./u);
  assert.match(referencedContext.content, /REFERENCED_LOREBOOK_MEMORY/u);
  assert.doesNotMatch(referencedContext.content, /REFERENCED_GREETING_MUST_STAY_OUT/u);
  // #8582: a referenced card's creator notes are never sent.
  assert.doesNotMatch(referencedContext.content, /REFERENCED_CREATOR_NOTES_MUST_STAY_OUT|creator_notes/u);
  assert.match(referencedContext.content, /REFERENCED_EXAMPLE_SHOULD_APPEAR/u);
  const referencedPersonaContext = await buildReferencedPersonaContext({
    db,
    activePersonaId: null,
    sources: [],
    chatMessages: [
      {
        role: "user",
        content: `I went to the cafe with {{persona-${referencedPersona.id}}}.`,
      },
    ],
    macroCtx: {
      user: "Mari",
      char: "Version snapshot fixture",
      characters: ["Version snapshot fixture"],
      variables: {},
      personaReferences: { [knownPersonaReferenceId]: "Ada" },
    },
    wrapFormat: "xml",
    chatId: "persona-reference-regression",
  });
  assert.equal(referencedPersonaContext.references[referencedPersona.id], "Professor Mari");
  assert.match(referencedPersonaContext.content, /A brilliant engineer who understands every machine/u);
  assert.match(referencedPersonaContext.content, /Warm, incisive, and knowingly amused\./u);
  assert.match(referencedPersonaContext.content, /with Ada\./u);
  assert.match(referencedPersonaContext.content, /REFERENCED_PERSONA_LOREBOOK_MEMORY/u);
  assert.doesNotMatch(referencedPersonaContext.content, /PERSONA_CREATOR_NOTES_MUST_STAY_OUT|creator_notes/u);
  const activePersonaReferenceContext = await buildReferencedPersonaContext({
    db,
    activePersonaId: referencedPersona.id,
    sources: [],
    chatMessages: [{ role: "user", content: `I am {{persona-${referencedPersona.id}}}.` }],
    macroCtx: {
      user: "Mari",
      char: "Version snapshot fixture",
      characters: ["Version snapshot fixture"],
      variables: {},
    },
    wrapFormat: "xml",
    chatId: "persona-reference-regression-active",
  });
  assert.equal(activePersonaReferenceContext.references[referencedPersona.id], "Mari");
  assert.equal(activePersonaReferenceContext.content, "");
  const knownPersonaIds = new Set(
    Array.from({ length: 8 }, (_, index) => `KnownPersona${String(index).padStart(9, "0")}`),
  );
  const newPersonaId = "NewPersona00000000001";
  assert.deepEqual(
    extractPersonaReferenceIds(
      [[...knownPersonaIds, newPersonaId].map((id) => `{{persona-${id}}}`).join(" ")],
      knownPersonaIds,
    ),
    [newPersonaId],
    "known Persona references must not consume the discovery cap",
  );
  const macroLorebook = await lorebookStorage.create(
    createLorebookSchema.parse({
      name: "Active character references",
      category: "character",
      characterIds: [storageTrimFixture.id],
    }),
  );
  await lorebookStorage.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: macroLorebook.id,
      name: "Cafe companion",
      content: `The cafe companion is {{${referencedCharacter.id}}}.`,
      keys: ["cafe"],
    }),
  );
  await lorebookStorage.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: macroLorebook.id,
      name: "Cafe specialist",
      content: `The cafe specialist is {{persona-${referencedPersona.id}}}.`,
      keys: ["cafe"],
    }),
  );
  const assembleCharacterReferenceFixture = (chatId: string, content: string, includePlacementMarker = false) =>
    assemblePrompt({
      db,
      preset: {
        id: "character-reference-preset",
        name: "Character reference fixture",
        sectionOrder: JSON.stringify([
          "lorebook",
          ...(includePlacementMarker ? ["id-macro-cards"] : []),
          "history",
          ...(includePlacementMarker ? ["duplicate-id-macro-cards"] : []),
        ]),
        groupOrder: JSON.stringify([]),
        wrapFormat: "xml",
        parameters: JSON.stringify({}),
        variableGroups: JSON.stringify([]),
        variableValues: JSON.stringify({}),
      },
      sections: [
        {
          id: "lorebook",
          presetId: "character-reference-preset",
          identifier: "lorebook",
          name: "Lorebook",
          content: "",
          role: "system",
          enabled: "true",
          isMarker: "true",
          groupId: null,
          markerConfig: JSON.stringify({ type: "lorebook" }),
          injectionPosition: "relative",
          injectionDepth: 0,
          injectionOrder: 0,
          forbidOverrides: "false",
        },
        ...(includePlacementMarker
          ? [
              {
                id: "id-macro-cards",
                presetId: "character-reference-preset",
                identifier: "id_macro_cards",
                name: "ID Macro Cards",
                content: "",
                role: "system",
                enabled: "true",
                isMarker: "true",
                groupId: null,
                markerConfig: JSON.stringify({ type: "id_macro_cards" }),
                injectionPosition: "ordered",
                injectionDepth: 0,
                injectionOrder: 1,
                forbidOverrides: "false",
              },
            ]
          : []),
        {
          id: "history",
          presetId: "character-reference-preset",
          identifier: "chatHistory",
          name: "Chat History",
          content: "",
          role: "system",
          enabled: "true",
          isMarker: "true",
          groupId: null,
          markerConfig: JSON.stringify({ type: "chat_history" }),
          injectionPosition: "relative",
          injectionDepth: 0,
          injectionOrder: 1,
          forbidOverrides: "false",
        },
        ...(includePlacementMarker
          ? [
              {
                id: "duplicate-id-macro-cards",
                presetId: "character-reference-preset",
                identifier: "id_macro_cards",
                name: "Duplicate ID Macro Cards",
                content: "",
                role: "system",
                enabled: "true",
                isMarker: "true",
                groupId: null,
                markerConfig: JSON.stringify({ type: "id_macro_cards" }),
                injectionPosition: "ordered",
                injectionDepth: 0,
                injectionOrder: 2,
                forbidOverrides: "false",
              },
            ]
          : []),
      ],
      groups: [],
      choiceBlocks: [],
      chatChoices: {},
      chatId,
      characterIds: [storageTrimFixture.id],
      personaName: "Mari",
      personaDescription: "",
      chatMessages: [{ role: "user", content }],
    });
  const assembledReference = await assembleCharacterReferenceFixture(
    "character-reference-regression",
    "I went to the cafe.",
  );
  const assembledReferenceText = assembledReference.messages.map((message) => message.content).join("\n");
  assert.match(assembledReferenceText, /The cafe companion is Susie\./u);
  assert.match(assembledReferenceText, /A trusted friend from the western district\./u);
  assert.match(assembledReferenceText, /REFERENCED_EXAMPLE_SHOULD_APPEAR/u);
  assert.match(assembledReferenceText, /The cafe specialist is Professor Mari\./u);
  assert.match(assembledReferenceText, /A brilliant engineer who understands every machine/u);
  assert.match(assembledReferenceText, /REFERENCED_PERSONA_LOREBOOK_MEMORY/u);
  assert.doesNotMatch(assembledReferenceText, /REFERENCED_GREETING_MUST_STAY_OUT/u);
  assert.ok(
    assembledReferenceText.indexOf("<referenced_characters>") <
      assembledReferenceText.indexOf("The cafe companion is Susie."),
    "Presets without the placement marker must keep ID macro cards in the legacy leading position",
  );
  const placedReference = await assembleCharacterReferenceFixture(
    "character-reference-marker-regression",
    "I went to the cafe.",
    true,
  );
  const placedReferenceText = placedReference.messages.map((message) => message.content).join("\n");
  assert.ok(
    placedReferenceText.indexOf("The cafe companion is Susie.") <
      placedReferenceText.indexOf("<referenced_characters>"),
    "The ID Macro Cards marker must own placement after lorebook-discovered references are resolved",
  );
  assert.equal(
    placedReferenceText.match(/<referenced_characters>/gu)?.length,
    1,
    "Only the first explicit marker may own placement, without a duplicate legacy fallback block",
  );
  const cappedDirectReferences = [];
  for (let index = 0; index < MAX_REFERENCED_CHARACTERS; index += 1) {
    cappedDirectReferences.push(
      await characterStorage.create(
        characterDataSchema.parse({
          name: `Reference cap ${index + 1}`,
          description: `DIRECT_REFERENCE_${index + 1}_MUST_APPEAR`,
        }),
      ),
    );
  }
  const overflowReference = await characterStorage.create(
    characterDataSchema.parse({
      name: "Overflow reference must stay out",
      description: "OVERFLOW_REFERENCE_CONTEXT_MUST_STAY_OUT",
    }),
  );
  await lorebookStorage.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: macroLorebook.id,
      name: "Reference cap overflow",
      content: `The overflow reference is {{${overflowReference.id}}}.`,
      keys: ["reference-cap"],
    }),
  );
  const cappedReferencePrompt = await assembleCharacterReferenceFixture(
    "character-reference-cap-regression",
    `${cappedDirectReferences.map((character) => `{{${character.id}}}`).join(" ")} reference-cap`,
  );
  const cappedReferenceText = cappedReferencePrompt.messages.map((message) => message.content).join("\n");
  for (let index = 0; index < MAX_REFERENCED_CHARACTERS; index += 1) {
    assert.match(cappedReferenceText, new RegExp(`DIRECT_REFERENCE_${index + 1}_MUST_APPEAR`, "u"));
  }
  assert.doesNotMatch(cappedReferenceText, /OVERFLOW_REFERENCE_CONTEXT_MUST_STAY_OUT/u);
  assert.doesNotMatch(cappedReferenceText, /Overflow reference must stay out/u);
  await lorebookStorage.update(hiddenCharacterLorebook.id, { hiddenFromLibrary: false });
  assert.equal(
    (await lorebookStorage.listPage({ limit: 100, offset: 0, search: "Susie's private memories" })).items.length,
    1,
    "Making an embedded lorebook visible must restore it to general library searches",
  );
  const restoreTrimFixture = await characterStorage.create(characterDataSchema.parse({ name: "Restore source" }));
  await db
    .update(characters)
    .set({ data: JSON.stringify({ ...JSON.parse(restoreTrimFixture.data), name: "  Current legacy  " }) })
    .where(eq(characters.id, restoreTrimFixture.id));
  const restoreVersionId = "padded-name-restore-version";
  await db.insert(characterCardVersions).values({
    id: restoreVersionId,
    characterId: restoreTrimFixture.id,
    data: JSON.stringify({ ...JSON.parse(restoreTrimFixture.data), name: "  Restored fixture  " }),
    comment: "",
    avatarPath: null,
    version: "1.0",
    source: "regression",
    reason: "Padded legacy fixture",
    createdAt: "2026-07-30T12:00:00.000Z",
  });
  const restoredTrimFixture = await characterStorage.restoreVersion(restoreTrimFixture.id, restoreVersionId);
  const restoreSnapshots = await db
    .select()
    .from(characterCardVersions)
    .where(eq(characterCardVersions.characterId, restoreTrimFixture.id));
  const preRestoreSnapshot = restoreSnapshots.find((row) => row.source === "restore");
  assert.equal(
    (JSON.parse(preRestoreSnapshot?.data ?? "{}") as { name?: string }).name,
    "Current legacy",
    "Restoring a Character version must normalize the pre-restore snapshot",
  );
  assert.equal(
    (JSON.parse(restoredTrimFixture?.data ?? "{}") as { name?: string }).name,
    "Restored fixture",
    "Restoring a Character version must normalize legacy padded names",
  );
  const patchFixture = characterDataSchema.parse({
    name: "Nested patch fixture",
    extensions: {
      fav: false,
      depth_prompt: { prompt: "Original", depth: 7, role: "assistant" },
      thirdParty: { retained: true },
    },
    character_book: {
      name: "Original book",
      description: "Keep this description",
      entries: [{ id: 9, content: "Keep this entry" }],
      custom_top_level_property: "preserved",
    },
  });
  const createdPatchFixture = await characterStorage.create(patchFixture);
  assert.ok(createdPatchFixture);
  const nestedPatch = updateCharacterSchema.parse({
    data: {
      extensions: { fav: true, depth_prompt: { prompt: "Updated only" } },
      character_book: { name: "Renamed" },
    },
  });
  const patchedFixture = await characterStorage.update(createdPatchFixture.id, nestedPatch.data);
  assert.ok(patchedFixture);
  const patchFixtureVersions = await characterStorage.listVersions(createdPatchFixture.id);
  assert.equal(patchFixtureVersions.length, 2);
  assert.equal(patchFixtureVersions[0]?.isCurrent, true);
  assert.equal(patchFixtureVersions[0]?.revision, 2);
  assert.equal(patchFixtureVersions[0]?.createdAt, patchedFixture.updatedAt);
  assert.equal(patchFixtureVersions[1]?.isCurrent, false);
  assert.equal(patchFixtureVersions[1]?.revision, 1);
  assert.equal(patchFixtureVersions[1]?.createdAt, createdPatchFixture.updatedAt);
  const patchedFixtureData = JSON.parse(patchedFixture.data) as {
    extensions: Record<string, unknown> & {
      fav: boolean;
      depth_prompt: { prompt: string; depth: number; role: string };
      thirdParty: { retained: boolean };
    };
    character_book: Record<string, unknown> & {
      name: string;
      description: string;
      entries: Array<{ content: string }>;
    };
  };
  assert.equal(patchedFixtureData.extensions.fav, true);
  assert.deepEqual(patchedFixtureData.extensions.depth_prompt, {
    prompt: "Updated only",
    depth: 7,
    role: "assistant",
  });
  assert.deepEqual(patchedFixtureData.extensions.thirdParty, { retained: true });
  assert.equal(patchedFixtureData.character_book.name, "Renamed");
  assert.equal(patchedFixtureData.character_book.description, "Keep this description");
  assert.equal(patchedFixtureData.character_book.entries[0]!.content, "Keep this entry");
  assert.equal(patchedFixtureData.character_book.custom_top_level_property, "preserved");
  const emptyBookFixture = await characterStorage.create(characterDataSchema.parse({ name: "Empty book fixture" }));
  assert.ok(emptyBookFixture);
  const createdBookFixture = await characterStorage.update(
    emptyBookFixture.id,
    updateCharacterSchema.parse({ data: { character_book: { name: "New book" } } }).data,
  );
  assert.ok(createdBookFixture);
  const createdBookData = JSON.parse(createdBookFixture.data) as { character_book: Record<string, unknown> };
  assert.deepEqual(createdBookData.character_book, {
    name: "New book",
    description: "",
    scan_depth: 2,
    token_budget: 512,
    recursive_scanning: false,
    extensions: {},
    entries: [],
  });
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
