import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PROFESSOR_MARI_ID } from "../../packages/shared/src/constants/defaults.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { eq, ne } from "../../packages/server/src/db/file-query.js";
import {
  characterCardVersions,
  characterGroups,
  characters,
  personaCardVersions,
  personas,
} from "../../packages/server/src/db/schema/index.js";
import {
  collectCharacterAvatarPaths,
  collectPersonaAvatarPaths,
  mutateAvatarReferencesAndCleanup,
  resolveStoredAvatarFile,
  unlinkAvatarFilesIfUnreferenced,
} from "../../packages/server/src/services/image/avatar-file-lifecycle.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-avatar-delete-storage-"));
const avatarRoot = mkdtempSync(join(tmpdir(), "marinara-avatar-delete-files-"));
const outsideFile = `${avatarRoot}-outside.png`;
const previousStorageRoot = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;

const now = "2026-08-06T00:00:00.000Z";
const localAvatar = (filename: string, query = "") => `/api/avatars/file/${filename}${query}`;
const writeAvatar = (filename: string) => {
  const path = join(avatarRoot, filename);
  writeFileSync(path, filename);
  return path;
};
const characterData = (name: string) => JSON.stringify({ name });

const db = await createFileNativeDB();
try {
  const currentFile = writeAvatar("deleted-current.png");
  const historicalFile = writeAvatar("deleted-history.png");
  await db.insert(characters).values({
    id: "deleted-character",
    data: characterData("Deleted"),
    comment: "",
    avatarPath: localAvatar("deleted-current.png"),
    spriteFolderPath: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(characterCardVersions).values({
    id: "deleted-version",
    characterId: "deleted-character",
    data: characterData("Deleted"),
    comment: "",
    avatarPath: localAvatar("deleted-history.png"),
    version: "1.0",
    source: "manual",
    reason: "Avatar update",
    createdAt: now,
  });

  const deletedPaths = await collectCharacterAvatarPaths(db, ["deleted-character"]);
  assert.deepEqual(
    new Set(deletedPaths),
    new Set([localAvatar("deleted-current.png"), localAvatar("deleted-history.png")]),
  );
  await db.delete(characters).where(eq(characters.id, "deleted-character"));
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: deletedPaths, avatarRoot }),
    2,
    "current and historical files must be removed after their character is deleted",
  );
  assert.equal(existsSync(currentFile), false);
  assert.equal(existsSync(historicalFile), false);

  const sharedFile = writeAvatar("shared.png");
  const personaHistoryFile = writeAvatar("persona-history.png");
  await db.insert(characters).values({
    id: "shared-character",
    data: characterData("Shared"),
    comment: "",
    avatarPath: localAvatar("shared.png", "?v=old"),
    spriteFolderPath: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(personas).values({
    id: "shared-persona",
    name: "Shared Persona",
    avatarPath: localAvatar("shared.png", "?v=new"),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(personaCardVersions).values({
    id: "shared-persona-version",
    personaId: "shared-persona",
    data: JSON.stringify({ name: "Shared Persona" }),
    comment: "",
    avatarPath: localAvatar("persona-history.png"),
    version: "1.0",
    source: "manual",
    reason: "Avatar update",
    createdAt: now,
  });
  const sharedCharacterPaths = await collectCharacterAvatarPaths(db, ["shared-character"]);
  await db.delete(characters).where(eq(characters.id, "shared-character"));
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: sharedCharacterPaths, avatarRoot }), 0);
  assert.equal(existsSync(sharedFile), true, "a surviving persona reference must preserve a shared avatar file");

  const sharedPersonaPaths = await collectPersonaAvatarPaths(db, ["shared-persona"]);
  assert.deepEqual(
    new Set(sharedPersonaPaths),
    new Set([localAvatar("shared.png", "?v=new"), localAvatar("persona-history.png")]),
  );
  await db.delete(personas).where(eq(personas.id, "shared-persona"));
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: sharedPersonaPaths, avatarRoot }), 2);
  assert.equal(existsSync(sharedFile), false, "the final database reference must release a shared avatar file");
  assert.equal(existsSync(personaHistoryFile), false, "Persona card-version avatars must be released with the Persona");

  const groupFile = writeAvatar("group.png");
  await db.insert(characters).values({
    id: "group-character",
    data: characterData("Group"),
    comment: "",
    avatarPath: localAvatar("group.png"),
    spriteFolderPath: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(characterGroups).values({
    id: "avatar-group",
    name: "Avatar Group",
    description: "",
    avatarPath: localAvatar("group.png"),
    characterIds: "[]",
    createdAt: now,
    updatedAt: now,
  });
  const groupCharacterPaths = await collectCharacterAvatarPaths(db, ["group-character"]);
  await db.delete(characters).where(eq(characters.id, "group-character"));
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: groupCharacterPaths, avatarRoot }), 0);
  assert.equal(existsSync(groupFile), true, "a surviving character-group reference must preserve its avatar file");
  await db.delete(characterGroups).where(eq(characterGroups.id, "avatar-group"));
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: groupCharacterPaths, avatarRoot }), 1);

  const raceFile = writeAvatar("delete-race.png");
  await db.insert(characters).values({
    id: "delete-race-character",
    data: characterData("Delete Race"),
    comment: "",
    avatarPath: localAvatar("delete-race.png"),
    spriteFolderPath: null,
    createdAt: now,
    updatedAt: now,
  });
  let signalDeletionStarted!: () => void;
  const deletionStarted = new Promise<void>((resolve) => {
    signalDeletionStarted = resolve;
  });
  let allowDeletion!: () => void;
  const deletionMayFinish = new Promise<void>((resolve) => {
    allowDeletion = resolve;
  });
  const racingDeletion = mutateAvatarReferencesAndCleanup({
    db,
    avatarRoot,
    collectAvatarPaths: () => collectCharacterAvatarPaths(db, ["delete-race-character"]),
    mutateReferences: async () => {
      signalDeletionStarted();
      await deletionMayFinish;
      await db.delete(characters).where(eq(characters.id, "delete-race-character"));
    },
  });
  await deletionStarted;
  let duplicateSettled = false;
  const racingDuplicate = createCharactersStorage(db).duplicateCharacter("delete-race-character").then((result) => {
    duplicateSettled = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(duplicateSettled, false, "avatar reference creation must wait for in-flight cleanup");
  allowDeletion();
  assert.equal((await racingDeletion).filesDeleted, 1);
  assert.equal(await racingDuplicate, null, "a duplicate must not retain a reference after its source was deleted");
  assert.equal(existsSync(raceFile), false);

  const mariFile = writeAvatar("professor-mari.png");
  const dangerZoneFile = writeAvatar("danger-zone.png");
  await db.insert(characters).values([
    {
      id: PROFESSOR_MARI_ID,
      data: characterData("Professor Mari"),
      comment: "",
      avatarPath: localAvatar("professor-mari.png"),
      spriteFolderPath: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "danger-zone-character",
      data: characterData("Danger Zone"),
      comment: "",
      avatarPath: localAvatar("danger-zone.png"),
      spriteFolderPath: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const dangerZoneRows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(ne(characters.id, PROFESSOR_MARI_ID));
  const dangerZonePaths = await collectCharacterAvatarPaths(
    db,
    dangerZoneRows.map((row) => row.id),
  );
  await db.delete(characters).where(ne(characters.id, PROFESSOR_MARI_ID));
  assert.equal(await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: dangerZonePaths, avatarRoot }), 1);
  assert.equal(existsSync(dangerZoneFile), false, "Danger Zone character deletion must remove owned avatars");
  assert.equal(existsSync(mariFile), true, "Danger Zone character deletion must preserve Professor Mari's avatar");
  assert.equal((await db.select().from(characters)).length, 1);

  writeFileSync(outsideFile, "outside");
  assert.equal(resolveStoredAvatarFile("https://example.com/avatar.png", avatarRoot), null);
  assert.equal(resolveStoredAvatarFile("data:image/png;base64,AAAA", avatarRoot), null);
  assert.equal(resolveStoredAvatarFile("/api/avatars/npc/chat/avatar.png", avatarRoot), null);
  assert.equal(resolveStoredAvatarFile("/api/avatars/file/%2e%2e%2foutside.png", avatarRoot), null);
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({
      db,
      avatarPaths: ["https://example.com/avatar.png", "/api/avatars/file/%2e%2e%2foutside.png"],
      avatarRoot,
    }),
    0,
  );
  assert.equal(existsSync(outsideFile), true, "external and unsafe paths must never be unlinked");
  assert.equal(
    await unlinkAvatarFilesIfUnreferenced({ db, avatarPaths: [localAvatar("missing.png")], avatarRoot }),
    0,
    "a missing orphan file must be tolerated",
  );
} finally {
  await db._fileStore.close();
  if (previousStorageRoot === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageRoot;
  rmSync(storageRoot, { recursive: true, force: true });
  rmSync(avatarRoot, { recursive: true, force: true });
  rmSync(outsideFile, { force: true });
}
