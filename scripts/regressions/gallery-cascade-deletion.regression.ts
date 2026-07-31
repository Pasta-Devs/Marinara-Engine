import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { characterImages } from "../../packages/server/src/db/schema/index.js";
import { deleteChatGalleryImageEverywhere } from "../../packages/server/src/services/image/chat-gallery-cascade-deletion.js";
import {
  decodeSafePathSegment,
  findGalleryRowByFilename,
  resolveStoredGalleryFile,
  unlinkGalleryFileIfUnreferenced,
} from "../../packages/server/src/services/image/gallery-file-lifecycle.js";
import { persistGeneratedImageToEntityGalleries } from "../../packages/server/src/services/image/generated-image-entity-gallery.js";
import { createCharacterGalleryStorage } from "../../packages/server/src/services/storage/character-gallery.storage.js";
import { createGalleryStorage } from "../../packages/server/src/services/storage/gallery.storage.js";
import { createPersonaGalleryStorage } from "../../packages/server/src/services/storage/persona-gallery.storage.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-gallery-cascade-storage-"));
const galleryRoot = mkdtempSync(join(tmpdir(), "marinara-gallery-cascade-files-"));
const outsideFile = `${galleryRoot}-outside.png`;
const previousStorageRoot = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;

const writeGalleryFile = (relativePath: string, content = "generated-image") => {
  const filePath = join(galleryRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
};

const sourceMetadata = {
  prompt: "A generated scene with a character and persona.",
  provider: "image_generation",
  model: "regression-image-model",
  width: 1024,
  height: 1024,
};

const db = await createFileNativeDB();
try {
  const chatGallery = createGalleryStorage(db);
  const characterGallery = createCharacterGalleryStorage(db);
  const personaGallery = createPersonaGalleryStorage(db);
  const sourceRelativePath = "shared/generated.png";
  const sourceFile = writeGalleryFile(sourceRelativePath);
  const source = await chatGallery.create({
    chatId: "chat-1",
    filePath: sourceRelativePath,
    ...sourceMetadata,
  });
  assert.ok(source);

  const persisted = await persistGeneratedImageToEntityGalleries({
    sourceFilePath: sourceRelativePath,
    sourceChatImageId: source.id,
    characterIds: ["character-1", "character-2"],
    personaIds: ["persona-1", "persona-2"],
    characterGallery,
    personaGallery,
    galleryRoot,
    ...sourceMetadata,
  });
  assert.deepEqual(persisted, { characterCount: 2, personaCount: 2 });

  const linkedCharacters = await characterGallery.listBySourceChatImageId(source.id);
  const linkedPersonas = await personaGallery.listBySourceChatImageId(source.id);
  assert.equal(linkedCharacters.length, 2);
  assert.equal(linkedPersonas.length, 2);
  for (const reference of [...linkedCharacters, ...linkedPersonas]) {
    assert.equal(reference.filePath, sourceRelativePath);
  }
  assert.equal(existsSync(join(galleryRoot, "characters")), false, "character references must not copy image bytes");
  assert.equal(existsSync(join(galleryRoot, "personas")), false, "persona references must not copy image bytes");

  const windowsRelativePath = "shared\\windows-path.png";
  const windowsFile = writeGalleryFile("shared/windows-path.png", "windows-path");
  assert.equal(resolveStoredGalleryFile(windowsRelativePath, galleryRoot)?.absolutePath, windowsFile);
  for (const unsafeSegment of ["%2F", "%5C", ".", "..", "%00", "%E0%A4%A"]) {
    assert.equal(decodeSafePathSegment(unsafeSegment), null, `unsafe URL segment must be rejected: ${unsafeSegment}`);
  }
  assert.equal(decodeSafePathSegment("generated%20image.png"), "generated image.png");

  const servedCharacter = findGalleryRowByFilename(
    await characterGallery.listByCharacterId("character-1"),
    "generated.png",
  );
  assert.ok(servedCharacter);
  assert.equal(resolveStoredGalleryFile(servedCharacter.filePath, galleryRoot)?.absolutePath, sourceFile);

  await characterGallery.remove(linkedCharacters[0]!.id);
  assert.equal(
    await unlinkGalleryFileIfUnreferenced({ db, filePath: linkedCharacters[0]!.filePath, galleryRoot }),
    false,
  );
  await personaGallery.remove(linkedPersonas[0]!.id);
  assert.equal(
    await unlinkGalleryFileIfUnreferenced({ db, filePath: linkedPersonas[0]!.filePath, galleryRoot }),
    false,
  );
  assert.equal(existsSync(sourceFile), true, "deleting one gallery reference must preserve the shared file");

  const creationFirstPath = "shared/creation-first.png";
  const creationFirstFile = writeGalleryFile(creationFirstPath, "creation-first");
  let releaseCreation!: () => void;
  const creationMayFinish = new Promise<void>((resolveCreation) => {
    releaseCreation = resolveCreation;
  });
  let signalCreationStarted!: () => void;
  const creationStarted = new Promise<void>((resolveStarted) => {
    signalCreationStarted = resolveStarted;
  });
  const creationFirstPersistence = persistGeneratedImageToEntityGalleries({
    sourceFilePath: creationFirstPath,
    characterIds: ["race-character"],
    characterGallery: {
      create: async (input) => {
        signalCreationStarted();
        await creationMayFinish;
        return characterGallery.create(input);
      },
    },
    personaGallery,
    galleryRoot,
    ...sourceMetadata,
  });
  await creationStarted;
  const creationFirstCleanup = unlinkGalleryFileIfUnreferenced({
    db,
    filePath: creationFirstPath,
    galleryRoot,
  });
  releaseCreation();
  assert.deepEqual(await creationFirstPersistence, { characterCount: 1, personaCount: 0 });
  assert.equal(await creationFirstCleanup, false);
  assert.equal(existsSync(creationFirstFile), true, "concurrent reference creation must win before final-file cleanup");

  const cleanupFirstPath = "shared/cleanup-first.png";
  const cleanupFirstFile = writeGalleryFile(cleanupFirstPath, "cleanup-first");
  const cleanupFirst = unlinkGalleryFileIfUnreferenced({ db, filePath: cleanupFirstPath, galleryRoot });
  const latePersistence = persistGeneratedImageToEntityGalleries({
    sourceFilePath: cleanupFirstPath,
    characterIds: ["late-character"],
    characterGallery,
    personaGallery,
    galleryRoot,
    ...sourceMetadata,
  });
  assert.equal(await cleanupFirst, true);
  assert.deepEqual(await latePersistence, { characterCount: 0, personaCount: 0 });
  assert.equal(existsSync(cleanupFirstFile), false, "late reference creation must not point at a deleted file");

  const legacyCharacterPath = "characters/legacy-character/generated.png";
  const legacyPersonaPath = "personas/legacy-persona/generated.png";
  writeGalleryFile(legacyCharacterPath);
  writeGalleryFile(legacyPersonaPath);
  const legacyCharacter = await characterGallery.create({
    characterId: "legacy-character",
    filePath: legacyCharacterPath,
    ...sourceMetadata,
  });
  const legacyPersona = await personaGallery.create({
    personaId: "legacy-persona",
    filePath: legacyPersonaPath,
    ...sourceMetadata,
  });
  assert.ok(legacyCharacter);
  assert.ok(legacyPersona);

  const unrelatedPath = "characters/unrelated/same-bytes.png";
  writeGalleryFile(unrelatedPath);
  const unrelated = await characterGallery.create({
    characterId: "unrelated",
    filePath: unrelatedPath,
    ...sourceMetadata,
    prompt: "An independently saved duplicate with different metadata.",
  });
  assert.ok(unrelated);

  const differentContentPath = "characters/different-content/different-bytes.png";
  writeGalleryFile(differentContentPath, "different-image");
  const differentContent = await characterGallery.create({
    characterId: "different-content",
    filePath: differentContentPath,
    ...sourceMetadata,
  });
  assert.ok(differentContent);

  const otherSourcePath = "characters/other-source/same-bytes.png";
  writeGalleryFile(otherSourcePath);
  const otherSource = await characterGallery.create({
    characterId: "other-source",
    sourceChatImageId: "different-chat-image",
    filePath: otherSourcePath,
    ...sourceMetadata,
  });
  assert.ok(otherSource);

  const oldLegacyPath = "characters/old-legacy/same-bytes.png";
  writeGalleryFile(oldLegacyPath);
  await db.insert(characterImages).values({
    id: "old-legacy-image",
    characterId: "old-legacy",
    sourceChatImageId: null,
    filePath: oldLegacyPath,
    ...sourceMetadata,
    customKind: null,
    customName: null,
    createdAt: "2020-01-01T00:00:00.000Z",
  });

  writeFileSync(outsideFile, "generated-image");
  const unsafeLinked = await characterGallery.create({
    characterId: "unsafe-linked",
    sourceChatImageId: source.id,
    filePath: `../${basename(outsideFile)}`,
    ...sourceMetadata,
  });
  const missingLinked = await characterGallery.create({
    characterId: "missing-linked",
    sourceChatImageId: source.id,
    filePath: "characters/missing-linked/missing.png",
    ...sourceMetadata,
  });
  assert.ok(unsafeLinked);
  assert.ok(missingLinked);

  const finalReferencePath = "shared/final-reference.png";
  const finalReferenceFile = writeGalleryFile(finalReferencePath, "final-reference");
  const finalReference = await characterGallery.create({
    characterId: "final-reference",
    filePath: finalReferencePath,
    ...sourceMetadata,
  });
  assert.ok(finalReference);
  await characterGallery.remove(finalReference.id);
  assert.equal(await unlinkGalleryFileIfUnreferenced({ db, filePath: finalReferencePath, galleryRoot }), true);
  assert.equal(existsSync(finalReferenceFile), false, "the final metadata release must remove the physical file");

  const deletion = await deleteChatGalleryImageEverywhere({ db, image: source, galleryRoot });
  assert.deepEqual(deletion, {
    characterCopiesRemoved: 4,
    personaCopiesRemoved: 2,
    filesRemoved: 3,
  });

  assert.equal(await chatGallery.getById(source.id), null);
  for (const removed of [linkedCharacters[1]!, legacyCharacter, unsafeLinked, missingLinked]) {
    assert.equal(await characterGallery.getById(removed.id), null);
  }
  for (const removed of [linkedPersonas[1]!, legacyPersona]) {
    assert.equal(await personaGallery.getById(removed.id), null);
  }
  for (const removedFile of [
    sourceFile,
    join(galleryRoot, legacyCharacter.filePath),
    join(galleryRoot, legacyPersona.filePath),
  ]) {
    assert.equal(existsSync(removedFile), false);
  }

  assert.ok(await characterGallery.getById(unrelated.id));
  assert.ok(await characterGallery.getById(differentContent.id));
  assert.ok(await characterGallery.getById(otherSource.id));
  assert.ok(await characterGallery.getById("old-legacy-image"));
  assert.equal(existsSync(join(galleryRoot, unrelatedPath)), true);
  assert.equal(existsSync(join(galleryRoot, differentContentPath)), true);
  assert.equal(existsSync(join(galleryRoot, otherSourcePath)), true);
  assert.equal(existsSync(join(galleryRoot, oldLegacyPath)), true);
  assert.equal(
    existsSync(outsideFile),
    true,
    "an unsafe stored path must never delete a file outside the gallery root",
  );
} finally {
  await db._fileStore.close();
  if (previousStorageRoot === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageRoot;
  rmSync(storageRoot, { recursive: true, force: true });
  rmSync(galleryRoot, { recursive: true, force: true });
  rmSync(outsideFile, { force: true });
}

console.info("Chat gallery cascade deletion regression passed.");
