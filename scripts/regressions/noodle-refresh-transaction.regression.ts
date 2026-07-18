import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { noodleGeneratedRefreshSchema, noodleSettingsSchema } from "../../packages/shared/src/schemas/noodle.schema.js";

const rootDir = mkdtempSync(join(tmpdir(), "marinara-noodle-refresh-transaction-"));
process.env.DATA_DIR = join(rootDir, "data");
process.env.FILE_STORAGE_DIR = join(rootDir, "storage");

const [dbModule, imageModule, activityModule, noodleModule, galleryModule] = await Promise.all([
  import("../../packages/server/src/db/file-backed-store.js"),
  import("../../packages/server/src/services/image/image-generation.js"),
  import("../../packages/server/src/services/noodle/noodle-generated-activity.service.js"),
  import("../../packages/server/src/services/storage/noodle.storage.js"),
  import("../../packages/server/src/services/storage/character-gallery.storage.js"),
]);
const fileDb = await dbModule.createFileNativeDB();
const noodle = noodleModule.createNoodleStorage(fileDb);

try {
  const author = await noodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "transaction-author",
    displayName: "Transaction Author",
    invited: true,
  });
  const actor = await noodle.upsertAccountFromProfile({
    kind: "random_user",
    entityId: "transaction-actor",
    displayName: "Transaction Actor",
    invited: true,
  });
  const generated = noodleGeneratedRefreshSchema.parse({
    posts: [{ tempId: "new-post", authorHandle: author.handle, content: "Atomic post" }],
    interactions: [
      { actorHandle: actor.handle, targetTempId: "new-post", type: "reply", content: "Atomic reply" },
    ],
    follows: [{ actorHandle: author.handle, targetHandle: actor.handle }],
  });
  const settings = noodleSettingsSchema.parse({ maxGeneratedPostsPerRefresh: 1, maxRepliesPerRefresh: 1 });
  const duplicateHandlePersona = { ...author, id: "duplicate-persona", kind: "persona" as const };
  const duplicateHandlePrepared = await activityModule.prepareGeneratedNoodleMedia({
    db: fileDb,
    characters: {} as never,
    chats: {} as never,
    gallery: {} as never,
    characterGallery: {} as never,
    promptOverrides: {} as never,
    generated,
    selectedParticipants: [author, actor],
    personaAccount: duplicateHandlePersona,
    settings,
    imageConnection: null,
    debugMode: false,
    reviewImagePromptsBeforeSend: false,
  });
  assert.equal(
    duplicateHandlePrepared.posts.has(generated.posts[0]!),
    true,
    "a participant must win when a persona shares the same normalized handle",
  );
  const run = await noodle.createRefreshRun({ activeAccountIds: [author.id, actor.id], prompt: "durable prompt" });
  await noodle.recordRefreshAttempt(run.id, {
    sequence: 1,
    kind: "initial",
    response: "durable response",
    rejectionReason: null,
    createdAt: new Date().toISOString(),
  });

  const stagedFile = imageModule.stageImageToDisk(
    `characters/${author.entityId}`,
    Buffer.from("image").toString("base64"),
    "png",
  );
  const finalPath = join(process.env.DATA_DIR, "gallery", stagedFile.filePath);
  assert.equal(existsSync(finalPath), false, "staged media must not be visible before finalization");
  const stagedMedia = {
    file: stagedFile,
    characterGalleryInput: {
      characterId: author.entityId,
      filePath: stagedFile.filePath,
      prompt: "portrait",
      provider: "regression",
      model: "regression",
      width: 1,
      height: 1,
    },
  };
  const preparedPost = {
    imagePrompt: "portrait",
    imageUrl: `/api/characters/${author.entityId}/gallery/file/${stagedFile.filePath.split("/").at(-1)}`,
    metadata: { imageGenerated: true },
    preview: null,
    stagedMedia,
  };
  const failingDb = {
    ...fileDb,
    transaction: <T>(operation: (tx: typeof fileDb) => Promise<T> | T) =>
      fileDb.transaction(async (tx) => {
        await operation(tx);
        throw new Error("forced final transaction failure");
      }),
  } as typeof fileDb;

  await assert.rejects(
    activityModule.commitGeneratedNoodleActivity({
      db: failingDb,
      generated,
      selectedParticipants: [author, actor],
      personaAccount: null,
      settings,
      runId: run.id,
      result: "must roll back",
      recalledPostIds: [],
      preparedMedia: { posts: new Map([[generated.posts[0], preparedPost]]), stagedMedia: [stagedMedia] },
    }),
    /forced final transaction failure/,
  );
  assert.equal(existsSync(finalPath), false, "a failed final transaction must compensate promoted media");
  assert.deepEqual(await noodle.listPosts(), []);
  assert.deepEqual(await noodle.listDigests(), []);
  assert.deepEqual(await galleryModule.createCharacterGalleryStorage(fileDb).listByCharacterId(author.entityId), []);
  assert.equal((await noodle.getAccountById(author.id))?.settings.social.followingAccountIds?.includes(actor.id) ?? false, false);
  const rolledBackRun = (await noodle.listRefreshRuns())[0];
  assert.equal(rolledBackRun.status, "running");
  assert.equal(rolledBackRun.attempts.length, 1, "run creation and attempts must survive rollback");

  await noodle.finishRefreshRun(run.id, { status: "failed", error: "forced final transaction failure" });
  assert.equal((await noodle.listRefreshRuns())[0].status, "failed", "failure is recorded after rollback");

  const success = noodleGeneratedRefreshSchema.parse({
    posts: [{ authorHandle: author.handle, content: "Post without failed media" }],
  });
  const successRun = await noodle.createRefreshRun({ activeAccountIds: [author.id], prompt: "success prompt" });
  await activityModule.commitGeneratedNoodleActivity({
    db: fileDb,
    generated: success,
    selectedParticipants: [author],
    personaAccount: null,
    settings,
    runId: successRun.id,
    result: "success",
    recalledPostIds: [],
    preparedMedia: {
      posts: new Map([
        [
          success.posts[0],
          {
            imagePrompt: null,
            imageUrl: null,
            metadata: { imageGenerationFailed: true, imageGenerationError: "provider failed" },
            preview: null,
            stagedMedia: null,
          },
        ],
      ]),
      stagedMedia: [],
    },
  });
  const persistedPost = (await noodle.listPosts())[0];
  assert.equal(persistedPost.metadata.imageGenerationFailed, true);
  assert.equal(persistedPost.imageUrl, null);
  assert.equal((await noodle.listRefreshRuns({ status: "completed" }))[0].id, successRun.id);

  const stagingDir = join(process.env.DATA_DIR, "gallery", ".staging", "noodle");
  assert.equal(existsSync(stagingDir) ? readdirSync(stagingDir).length : 0, 0, "staging must be empty after compensation");
} finally {
  await fileDb._fileStore.close();
  rmSync(rootDir, { recursive: true, force: true });
}

process.stdout.write("Noodle refresh transaction regression passed.\n");
