// Saving a generated image to the galleries of the chat's characters and personas: each gets one copy, a cancelled
// save stops writing, and an aborted wait for the gallery file lock never runs or lets the next one in early.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persistGeneratedImageToEntityGalleries } from "../../../packages/server/src/services/image/generated-image-entity-gallery.js";
import { withGalleryFileLifecycleLock } from "../../../packages/server/src/services/image/gallery-file-lifecycle.js";

const entityGalleryRoot = mkdtempSync(join(tmpdir(), "marinara-generated-entity-gallery-"));
try {
  const sourceDir = join(entityGalleryRoot, "chat-id");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, "generated.png"), Buffer.from("generated-image"));
  const characterRows: Array<Record<string, unknown>> = [];
  const personaRows: Array<Record<string, unknown>> = [];
  const persisted = await persistGeneratedImageToEntityGalleries({
    sourceFilePath: "chat-id/generated.png",
    characterIds: ["character-1", "character-1"],
    personaIds: ["persona-1"],
    characterGallery: {
      create: async (input) => {
        characterRows.push(input as unknown as Record<string, unknown>);
        return input;
      },
    },
    personaGallery: {
      create: async (input) => {
        personaRows.push(input as unknown as Record<string, unknown>);
        return input;
      },
    },
    prompt: "A generated scene with both identities.",
    provider: "image_generation",
    model: "regression-image-model",
    width: 1024,
    height: 1024,
    galleryRoot: entityGalleryRoot,
  });
  assert.deepEqual(persisted, { characterCount: 1, personaCount: 1 });
  assert.equal(characterRows.length, 1);
  assert.equal(personaRows.length, 1);
  const characterFile = join(entityGalleryRoot, String(characterRows[0]!.filePath));
  const personaFile = join(entityGalleryRoot, String(personaRows[0]!.filePath));
  assert.equal(characterFile, join(sourceDir, "generated.png"));
  assert.equal(personaFile, join(sourceDir, "generated.png"));
  assert.equal(readFileSync(characterFile, "utf8"), "generated-image");
  assert.equal(readFileSync(personaFile, "utf8"), "generated-image");
  assert.equal(existsSync(join(sourceDir, "generated.png")), true);

  const cancelledGalleryPersistence = new AbortController();
  let cancelledCharacterWrites = 0;
  let cancelledPersonaWrites = 0;
  await assert.rejects(
    persistGeneratedImageToEntityGalleries({
      sourceFilePath: "chat-id/generated.png",
      characterIds: ["character-cancelled"],
      personaIds: ["persona-cancelled"],
      characterGallery: {
        create: async () => {
          cancelledCharacterWrites += 1;
          cancelledGalleryPersistence.abort();
          return {};
        },
      },
      personaGallery: {
        create: async () => {
          cancelledPersonaWrites += 1;
          return {};
        },
      },
      prompt: "Cancelled gallery propagation.",
      provider: "image_generation",
      model: "regression-image-model",
      width: 1024,
      height: 1024,
      signal: cancelledGalleryPersistence.signal,
      galleryRoot: entityGalleryRoot,
    }),
    /aborted/iu,
  );
  assert.equal(cancelledCharacterWrites, 1);
  assert.equal(cancelledPersonaWrites, 0, "Cancellation must stop later generated-image gallery writes");

  let releaseHeldGalleryLock: () => void = () => undefined;
  let markGalleryLockEntered: () => void = () => undefined;
  const galleryLockEntered = new Promise<void>((resolve) => {
    markGalleryLockEntered = resolve;
  });
  const heldGalleryLock = withGalleryFileLifecycleLock(
    "chat-id/generated.png",
    async () => {
      markGalleryLockEntered();
      await new Promise<void>((resolve) => {
        releaseHeldGalleryLock = resolve;
      });
    },
    entityGalleryRoot,
  );
  await galleryLockEntered;

  const waitingGalleryLockAbort = new AbortController();
  let waitingGalleryOperationRan = false;
  const waitingGalleryLock = withGalleryFileLifecycleLock(
    "chat-id/generated.png",
    () => {
      waitingGalleryOperationRan = true;
    },
    entityGalleryRoot,
    waitingGalleryLockAbort.signal,
  );
  waitingGalleryLockAbort.abort();
  let galleryLockTimeout: ReturnType<typeof setTimeout> | undefined;
  let followingGalleryOperationRan = false;
  let followingGalleryLock: Promise<void> | undefined;
  try {
    await assert.rejects(
      Promise.race([
        waitingGalleryLock,
        new Promise<never>((_, reject) => {
          galleryLockTimeout = setTimeout(() => reject(new Error("Gallery lock abort timed out")), 500);
        }),
      ]),
      /aborted/iu,
    );
    followingGalleryLock = withGalleryFileLifecycleLock(
      "chat-id/generated.png",
      () => {
        followingGalleryOperationRan = true;
      },
      entityGalleryRoot,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(followingGalleryOperationRan, false, "An aborted waiter must preserve the preceding gallery lock");
  } finally {
    if (galleryLockTimeout) clearTimeout(galleryLockTimeout);
    releaseHeldGalleryLock();
    await heldGalleryLock;
    await followingGalleryLock;
  }
  assert.equal(waitingGalleryOperationRan, false, "An aborted gallery lock waiter must never run its operation");
  assert.equal(followingGalleryOperationRan, true);
} finally {
  rmSync(entityGalleryRoot, { recursive: true, force: true });
}
