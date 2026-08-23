import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { createNoodleStorage } from "../../../packages/server/src/services/storage/noodle.storage.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-deletion-"));
process.env.FILE_STORAGE_DIR = storageDir;
const fileDb = await createFileNativeDB();
const db = fileDb as unknown as DB;

try {
  const noodle = createNoodleStorage(db);
  const account = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "deletion-regression-persona",
    displayName: "Deletion Regression",
  });
  const post = await noodle.createPost({ authorAccountId: account.id, content: "A live post" });
  assert.ok(post);

  const postDigest = await noodle.createDigest({
    accountIds: [account.id],
    content: "canonical post digest",
    sourcePostId: post.id,
  });
  await noodle.updatePostMedia(post.id, { metadata: { activityDigestId: postDigest.id } });

  const interaction = await noodle.createInteraction(post.id, {
    actorAccountId: account.id,
    type: "reply",
    content: "delete me",
  });
  assert.ok(interaction);
  await noodle.createDigest({
    accountIds: [account.id],
    content: "linked comment digest",
    sourcePostId: post.id,
    sourceInteractionId: interaction.id,
  });
  await noodle.createDigest({
    accountIds: [account.id],
    content: "linked comment digest revised",
    sourcePostId: post.id,
    sourceInteractionId: interaction.id,
  });
  await noodle.createDigest({
    accountIds: [account.id],
    content: "legacy unlinked comment digest",
    sourcePostId: post.id,
  });
  await noodle.createDigest({
    accountIds: [account.id],
    content: "untraceable model-authored digest",
    sourceRunId: "legacy-refresh-run",
  });

  assert.deepEqual(
    (await noodle.listDigests()).map((digest) => digest.content).sort(),
    ["canonical post digest", "linked comment digest revised"],
  );

  await noodle.deleteInteractionById(interaction.id);
  assert.deepEqual(
    (await noodle.listDigests()).map((digest) => digest.content),
    ["canonical post digest"],
  );

  await noodle.deletePost(post.id);
  assert.deepEqual(await noodle.listDigests(), []);
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle deletion-memory regression passed.\n");
