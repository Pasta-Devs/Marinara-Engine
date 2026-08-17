// The sibling `noodle-autopost-image` regression checks schemas and path helpers, which stay
// intact even when the lifecycle around them breaks. This one drives the real reserve lifecycle
// a generated image goes through — prepared with media, published, discarded, and recovered from
// a crash that lost the media file — against the file-native store.
//
// Every import is dynamic: the media module resolves its gallery directory from DATA_DIR at load
// time, so the temporary data dir has to exist in the environment before anything is imported.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-image-lifecycle-"));
process.env.DATA_DIR = storageDir;
process.env.FILE_STORAGE_DIR = join(storageDir, "storage");

const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { noodlePosts } = await import("../../../packages/server/src/db/schema/noodle.js");
const { createNoodleStorage, noodlerReservePolicyFingerprint } = await import(
  "../../../packages/server/src/services/storage/noodle.storage.js"
);
const { noodlerPostMediaUrl, resolveNoodlerMediaAbsolutePath } = await import(
  "../../../packages/server/src/services/noodle/noodle-noodler-media.js"
);
type DB = import("../../../packages/server/src/db/connection.js").DB;

const fileDb = await createFileNativeDB();
try {
  const db = fileDb as unknown as DB;
  const noodle = createNoodleStorage(db);
  const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
  const { characterDataSchema } = await import("../../../packages/shared/src/schemas/character.schema.js");
  const sourceCharacter = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Image Source" }));
  if (!sourceCharacter) throw new Error("Could not create the Noodle image source character fixture");
  await noodle.updateSettings({ enableNoodler: true, autoPostingScheduleEnabled: true });
  const source = await noodle.upsertAccountFromProfile({
    kind: "character",
    entityId: sourceCharacter.id,
    displayName: "Image Source",
  });
  const creator = await noodle.createNoodlerAccount(source.id, {
    displayName: "Image Creator",
    handle: "image_creator",
    bio: "Posts pictures",
    stagePersonality: "Visual.",
    disclosureMode: "secret",
  });
  assert.ok(creator);
  await noodle.patchAccountSettings(creator.id, {
    subtree: "scheduler",
    patch: { autoPosting: { enabled: true, imagesEnabled: true } },
  });
  const enabled = await noodle.getNoodlerAccountById(creator.id);
  assert.ok(enabled);
  const fingerprint = async () =>
    noodlerReservePolicyFingerprint(enabled, await noodle.getSettings(), source.updatedAt);

  const writeMedia = (relativePath: string) => {
    const absolute = resolveNoodlerMediaAbsolutePath(relativePath)!;
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, Buffer.from("fake-image-bytes"));
    return absolute;
  };

  // A prepared slot with media publishes into a post whose image route is the access-checked
  // NoodleR endpoint, and publication leaves the file it references in place.
  const publishAt = "2026-07-30T12:00:00.000Z";
  const publishedPath = `noodler-media/${creator.id}/published.png`;
  const publishedAbsolute = writeMedia(publishedPath);
  await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator.id,
    generatedAt: "2026-07-30T11:30:00.000Z",
    publishAt,
    payload: {
      title: null,
      content: "With a picture.",
      access: "locked",
      imagePrompt: "a studio",
      metadata: { noodlerMediaPath: publishedPath },
    },
    policyFingerprint: await fingerprint(),
  });
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(publishAt)), 1);
  const withImage = (await db.select().from(noodlePosts)).find((post) => post.content === "With a picture.");
  assert.ok(withImage);
  assert.equal(withImage.imageUrl, noodlerPostMediaUrl(withImage.id));
  assert.equal(existsSync(publishedAbsolute), true, "publishing must not remove the media it references");

  // Discarding a prepared slot removes the media file it owned.
  const discardPath = `noodler-media/${creator.id}/discarded.png`;
  const discardAbsolute = writeMedia(discardPath);
  const discardId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator.id,
    generatedAt: "2026-07-30T11:30:00.000Z",
    publishAt: "2026-07-30T18:00:00.000Z",
    payload: {
      title: null,
      content: "Never published.",
      access: "locked",
      imagePrompt: null,
      metadata: { noodlerMediaPath: discardPath },
    },
    policyFingerprint: await fingerprint(),
  });
  await noodle.discardNoodlerPreparedPost(discardId, new Date("2026-07-30T12:30:00.000Z"));
  assert.equal(existsSync(discardAbsolute), false, "a discarded slot must not leak its media file");

  // A crash between the durable row write and the media promotion leaves a row referencing a file
  // that is not there. Reconciliation drops the reference, so the slot publishes as text rather
  // than as a post whose image route 404s.
  const missingId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator.id,
    generatedAt: "2026-07-30T11:30:00.000Z",
    publishAt: "2026-07-30T20:00:00.000Z",
    payload: {
      title: null,
      content: "Media never promoted.",
      access: "locked",
      imagePrompt: null,
      metadata: { noodlerMediaPath: `noodler-media/${creator.id}/missing.png` },
    },
    policyFingerprint: await fingerprint(),
  });
  await noodle.reconcileNoodlerPreparedPosts(new Date("2026-07-30T12:30:00.000Z"));
  const repaired = (await noodle.listNoodlerPreparedPosts()).find((item) => item.id === missingId);
  assert.equal(repaired?.state, "prepared", "a missing media file must not discard the post itself");
  assert.equal(repaired?.payload.metadata.noodlerMediaPath, undefined);
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date("2026-07-30T20:00:00.000Z")), 1);
  const textOnly = (await db.select().from(noodlePosts)).find((post) => post.content === "Media never promoted.");
  assert.equal(textOnly?.imageUrl, null, "a post whose media vanished publishes without an image route");
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle autopost image lifecycle regression passed.\n");
