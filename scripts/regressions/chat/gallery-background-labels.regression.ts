// Gallery background labels: a character's or persona's gallery picture can be labeled "background"
// with the places it shows, a chat picture can be assigned to a character or persona (label included,
// same file, no second copy), and the label survives deleting the chat picture.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  galleryBackgroundPlaceList,
  isGalleryTagKind,
  normalizeGalleryBackgroundPlaces,
} from "../../../packages/shared/src/utils/gallery-tags.js";
import { readGalleryTagPayload } from "../../../packages/server/src/services/image/gallery-tag-payload.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-gallery-labels-storage-"));
const galleryRoot = mkdtempSync(join(tmpdir(), "marinara-gallery-labels-files-"));
const previousStorageRoot = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;

const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { assignChatPictureToGallery } =
  await import("../../../packages/server/src/services/image/assign-chat-gallery-image.js");
const { deleteChatGalleryImageEverywhere } =
  await import("../../../packages/server/src/services/image/chat-gallery-cascade-deletion.js");
const { createCharacterGalleryStorage } =
  await import("../../../packages/server/src/services/storage/character-gallery.storage.js");
const { createGalleryStorage } = await import("../../../packages/server/src/services/storage/gallery.storage.js");
const { createPersonaGalleryStorage } =
  await import("../../../packages/server/src/services/storage/persona-gallery.storage.js");

// ── Labels ──
assert.equal(isGalleryTagKind("background"), true);
assert.equal(isGalleryTagKind("wallpaper"), false);
assert.equal(normalizeGalleryBackgroundPlaces("  John's bedroom,\n John's room \u0007"), "John's bedroom, John's room");
assert.equal(normalizeGalleryBackgroundPlaces("x".repeat(400)).length, 240);
assert.deepEqual(galleryBackgroundPlaceList("John's bedroom; John's room, John's bedroom,"), [
  "John's bedroom",
  "John's room",
]);

assert.deepEqual(
  readGalleryTagPayload({ customKind: "background", customName: " John's bedroom " }, { allowBackground: true }),
  {
    patch: { customKind: "background", customName: "John's bedroom" },
  },
);
assert.deepEqual(
  readGalleryTagPayload({ customKind: "background", customName: "" }, { allowBackground: true }),
  { patch: { customKind: "background", customName: null } },
  "a background may name no places",
);
assert.deepEqual(
  readGalleryTagPayload({ customKind: "background", customName: "x" }, { allowBackground: false }),
  { error: "Invalid customKind" },
  "galleries without backgrounds refuse the label",
);
assert.deepEqual(
  readGalleryTagPayload({ customKind: "emoji", customName: "wave", width: 64 }, { allowBackground: true }),
  {
    patch: { customKind: "emoji", customName: "wave", width: 64, height: undefined },
  },
);
assert.ok("error" in readGalleryTagPayload({ customKind: "emoji", customName: "Bad Name" }, { allowBackground: true }));
assert.ok(
  "error" in
    readGalleryTagPayload({ customKind: "sticker", customName: "big", width: 4096 }, { allowBackground: true }),
);
assert.deepEqual(readGalleryTagPayload({ customKind: null }, { allowBackground: true }), {
  patch: { customKind: null, customName: null },
});

// ── Assign a chat picture ──
const writeGalleryFile = (relativePath: string) => {
  const filePath = join(galleryRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, "picture");
  return filePath;
};

const db = await createFileNativeDB();
try {
  const chatGallery = createGalleryStorage(db);
  const characterGallery = createCharacterGalleryStorage(db);
  const personaGallery = createPersonaGalleryStorage(db);
  const filePath = "chat-1/bedroom.png";
  const file = writeGalleryFile(filePath);
  const picture = await chatGallery.create({
    chatId: "chat-1",
    filePath,
    prompt: "A cozy bedroom",
    provider: "image_generation",
    model: "regression-model",
    width: 1536,
    height: 1024,
  });
  assert.ok(picture);
  const tagged = await chatGallery.setTag(picture.id, "chat-1", {
    customKind: "background",
    customName: "John's bedroom, John's room",
  });
  assert.equal(tagged?.customKind, "background");
  assert.equal(tagged?.customName, "John's bedroom, John's room");

  const assigned = await assignChatPictureToGallery({
    image: tagged!,
    target: { type: "character", id: "john" },
    characterGallery,
    personaGallery,
    galleryRoot,
  });
  assert.equal(assigned.ok, true);
  const [johnRow] = await characterGallery.listByCharacterId("john");
  assert.equal(johnRow?.filePath, filePath, "the gallery row points at the same file (no copy)");
  assert.equal(johnRow?.customKind, "background", "the label comes along");
  assert.equal(johnRow?.customName, "John's bedroom, John's room");
  assert.equal(johnRow?.sourceChatImageId, null, "not linked to the chat picture");

  const again = await assignChatPictureToGallery({
    image: { ...tagged!, customName: "John's bedroom" },
    target: { type: "character", id: "john" },
    characterGallery,
    personaGallery,
    galleryRoot,
  });
  assert.equal(again.ok && again.alreadyThere, true);
  assert.equal(again.ok && again.labelUpdated, true, "a labeled re-assign reports the label update");
  const johnRows = await characterGallery.listByCharacterId("john");
  assert.equal(johnRows.length, 1, "assigning again never duplicates");
  assert.equal(johnRows[0]?.customName, "John's bedroom", "assigning again refreshes the label");

  // The chat picture's label was removed: re-assigning keeps the gallery's own label and says so
  // (the toast must not claim a label update).
  const unlabeledAgain = await assignChatPictureToGallery({
    image: { ...tagged!, customKind: null, customName: null },
    target: { type: "character", id: "john" },
    characterGallery,
    personaGallery,
    galleryRoot,
  });
  assert.equal(unlabeledAgain.ok && unlabeledAgain.alreadyThere, true);
  assert.equal(unlabeledAgain.ok && unlabeledAgain.labelUpdated, false, "no label update is reported");
  const keptRows = await characterGallery.listByCharacterId("john");
  assert.equal(keptRows.length, 1, "still one row on that file");
  assert.equal(keptRows[0]?.customKind, "background", "the gallery keeps its own label");

  const toPersona = await assignChatPictureToGallery({
    image: { ...picture, customKind: null, customName: null },
    target: { type: "persona", id: "alyssa" },
    characterGallery,
    personaGallery,
    galleryRoot,
  });
  assert.equal(toPersona.ok, true);
  assert.equal(
    (await personaGallery.listByPersonaId("alyssa"))[0]?.customKind,
    null,
    "an unlabeled picture stays unlabeled",
  );

  const missing = await assignChatPictureToGallery({
    image: { ...picture, filePath: "chat-1/gone.png" },
    target: { type: "character", id: "john" },
    characterGallery,
    personaGallery,
    galleryRoot,
  });
  assert.deepEqual(missing, { ok: false, reason: "missing-file" });

  // Deleting the chat picture (even right after assigning, inside the legacy-copy window) keeps
  // the assigned rows and their file.
  await deleteChatGalleryImageEverywhere({ db, image: { ...picture, chatId: "chat-1" }, galleryRoot });
  assert.equal(await chatGallery.getById(picture.id, "chat-1"), null);
  assert.equal((await characterGallery.listByCharacterId("john")).length, 1, "the character keeps it");
  assert.equal((await personaGallery.listByPersonaId("alyssa")).length, 1, "the persona keeps it");
  assert.ok(existsSync(file), "the file stays while a gallery uses it");
} finally {
  await db._fileStore.close();
  if (previousStorageRoot === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageRoot;
  rmSync(storageRoot, { recursive: true, force: true });
  rmSync(galleryRoot, { recursive: true, force: true });
}

console.log("gallery background labels regression passed");
