import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { noodlePosts } from "../../packages/server/src/db/schema/index.js";
import { createNoodleStorage } from "../../packages/server/src/services/storage/noodle.storage.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-image-claim-"));
process.env.FILE_STORAGE_DIR = storageDir;
let fileDb = await createFileNativeDB();

try {
  let db = fileDb as unknown as DB;
  let noodle = createNoodleStorage(db);
  const account = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "image-claim-persona",
    displayName: "Image Claim",
  });
  const post = await noodle.createPost({
    authorAccountId: account.id,
    content: "Atomic image claim",
    imagePrompt: "a focused regression image",
  });
  assert.ok(post);

  const [firstClaim, secondClaim] = await Promise.all([
    noodle.claimPostImage(post.id, "token-a", "2026-07-18T12:02:00.000Z", "2026-07-18T12:00:00.000Z"),
    noodle.claimPostImage(post.id, "token-b", "2026-07-18T12:02:00.000Z", "2026-07-18T12:00:00.000Z"),
  ]);
  assert.equal([firstClaim, secondClaim].filter(Boolean).length, 1, "only one concurrent claimant should win");
  const winningToken = firstClaim ? "token-a" : "token-b";
  const staleToken = firstClaim ? "token-b" : "token-a";
  assert.equal("imageClaimToken" in (firstClaim ?? secondClaim)!, false, "claim fields must stay out of NoodlePost");
  assert.equal(
    await noodle.renewPostImageClaim(post.id, staleToken, "2026-07-18T12:03:00.000Z", "2026-07-18T12:01:00.000Z"),
    false,
  );
  assert.equal(
    await noodle.finalizePostImageClaim(
      post.id,
      winningToken,
      { imageUrl: "/expired.png", metadata: { expired: true } },
      "2026-07-18T12:03:00.000Z",
    ),
    false,
    "an expired owner must not finalize before another request reclaims the post",
  );

  await fileDb._fileStore.flush();
  await fileDb._fileStore.close();
  fileDb = await createFileNativeDB();
  db = fileDb as unknown as DB;
  noodle = createNoodleStorage(db);
  const persistedRows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, post.id));
  assert.equal(persistedRows[0]?.imageClaimToken, winningToken, "claim ownership should persist across reload");

  const replacement = await noodle.claimPostImage(
    post.id,
    "replacement-token",
    "2026-07-18T12:05:00.000Z",
    "2026-07-18T12:03:00.000Z",
  );
  assert.ok(replacement, "an expired lease should be reclaimable");
  assert.equal(
    await noodle.finalizePostImageClaim(post.id, winningToken, {
      imageUrl: "/stale.png",
      metadata: { stale: true },
    }),
    false,
    "a stale owner must not finalize newer work",
  );
  assert.equal(await noodle.releasePostImageClaim(post.id, winningToken), false);
  assert.equal(
    await noodle.renewPostImageClaim(
      post.id,
      "replacement-token",
      "2026-07-18T12:06:00.000Z",
      "2026-07-18T12:04:00.000Z",
    ),
    true,
  );
  assert.equal(
    await noodle.finalizePostImageClaim(
      post.id,
      "replacement-token",
      {
        imageUrl: "/generated.png",
        metadata: { imageGenerated: true },
      },
      "2026-07-18T12:04:00.000Z",
    ),
    true,
  );
  const completed = await noodle.getPostById(post.id);
  assert.equal(completed?.imageUrl, "/generated.png");
  assert.equal(completed?.imagePrompt, "a focused regression image");
  assert.equal(completed?.metadata.imageGenerated, true);

  const failedPost = await noodle.createPost({
    authorAccountId: account.id,
    content: "Terminal failure",
    imagePrompt: "will fail",
  });
  assert.ok(failedPost);
  assert.ok(
    await noodle.claimPostImage(failedPost.id, "failure-token", "2026-07-18T12:02:00.000Z", "2026-07-18T12:00:00.000Z"),
  );
  assert.equal(
    await noodle.finalizePostImageClaim(
      failedPost.id,
      "failure-token",
      {
        imageUrl: null,
        imagePrompt: null,
        metadata: { imageGenerationFailed: true, imageGenerationError: "provider failed" },
      },
      "2026-07-18T12:01:00.000Z",
    ),
    true,
  );
  const failed = await noodle.getPostById(failedPost.id);
  assert.equal(failed?.imagePrompt, null);
  assert.equal(failed?.metadata.imageGenerationFailed, true);

  const releasedPost = await noodle.createPost({
    authorAccountId: account.id,
    content: "Released claim",
    imagePrompt: "available after release",
  });
  assert.ok(releasedPost);
  assert.ok(
    await noodle.claimPostImage(
      releasedPost.id,
      "release-token",
      "2026-07-18T12:02:00.000Z",
      "2026-07-18T12:00:00.000Z",
    ),
  );
  assert.equal(await noodle.releasePostImageClaim(releasedPost.id, "release-token"), true);
  assert.ok(
    await noodle.claimPostImage(
      releasedPost.id,
      "after-release-token",
      "2026-07-18T12:03:00.000Z",
      "2026-07-18T12:01:00.000Z",
    ),
    "a released claim should be immediately available",
  );
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle image claim regression passed.\n");
