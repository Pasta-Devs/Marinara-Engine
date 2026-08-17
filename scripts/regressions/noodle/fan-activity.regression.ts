import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NoodleAuthorSnapshot } from "../../../packages/shared/src/index.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { noodleInteractions, noodlePosts, noodlerFanActivityState } from "../../../packages/server/src/db/schema/noodle.js";
import { createNoodleStorage } from "../../../packages/server/src/services/storage/noodle.storage.js";

const snapshotA: NoodleAuthorSnapshot = {
  id: "fan-a",
  kind: "random_user",
  entityId: "fan-entity-a",
  handle: "fan_a",
  displayName: "Fan A",
  avatarUrl: null,
  avatarCrop: null,
};
const snapshotB: NoodleAuthorSnapshot = {
  id: "fan-b",
  kind: "random_user",
  entityId: "fan-entity-b",
  handle: "fan_b",
  displayName: "Fan B",
  avatarUrl: null,
  avatarCrop: null,
};
const snapshotC: NoodleAuthorSnapshot = {
  id: "fan-c",
  kind: "random_user",
  entityId: "fan-entity-c",
  handle: "fan_c",
  displayName: "Fan C",
  avatarUrl: null,
  avatarCrop: null,
};

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodler-fans-"));
process.env.FILE_STORAGE_DIR = storageDir;
let fileDb = await createFileNativeDB();

try {
  const db = fileDb as unknown as DB;
  const noodle = createNoodleStorage(db);
  const source = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "source-1",
    displayName: "Source",
  });
  const creator = await noodle.createNoodlerAccount(source.id, {
    handle: "creator",
    displayName: "Creator",
    bio: "Bio",
    disclosureMode: "secret",
    stagePersonality: "Voice",
  });
  assert.ok(creator);
  const post = await noodle.createNoodlerPost({
    authorAccountId: creator.id,
    title: null,
    content: "Public post",
    access: "public",
    source: "generated",
    metadata: {},
  });
  assert.ok(post);
  await noodle.updateSettings({ fanActivityEnabled: true });

  const runId = "fan-run-1";
  const replyA = {
    id: "fan-run-1-reply-a",
    creatorAccountId: creator.id,
    actorId: snapshotA.id,
    actorSnapshot: snapshotA,
    runId,
    type: "reply" as const,
    content: "Event-local reply",
  };
  const likeB = {
    id: "fan-run-1-like-b",
    creatorAccountId: creator.id,
    actorId: snapshotB.id,
    actorSnapshot: snapshotB,
    runId,
    type: "like" as const,
    content: null,
  };
  const lockedLikeC = {
    id: "fan-run-1-like-c",
    creatorAccountId: creator.id,
    actorId: snapshotC.id,
    actorSnapshot: snapshotC,
    runId,
    type: "like" as const,
    content: null,
  };
  await db.insert(noodlerFanActivityState).values({
    id: "fan-day:2026-01-01:UTC",
    updatedAt: "2026-01-01T00:00:00.000Z",
    plan: JSON.stringify({
      version: 1,
      localDate: "2026-01-01",
      timezone: "UTC",
      nextCreatorOffset: 0,
      runs: [
        {
          id: runId,
          scheduledAt: "2026-01-01T00:00:00.000Z",
          creatorIds: [creator.id],
          status: "applying",
          claimedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: null,
          acceptedActivities: [
            {
              id: replyA.id,
              creatorId: creator.id,
              actorId: snapshotA.id,
              type: replyA.type,
              targetPostId: post.id,
              content: replyA.content,
              snapshot: snapshotA,
              applied: false,
            },
            {
              id: likeB.id,
              creatorId: creator.id,
              actorId: snapshotB.id,
              type: likeB.type,
              targetPostId: post.id,
              content: likeB.content,
              snapshot: snapshotB,
              applied: false,
            },
            {
              id: lockedLikeC.id,
              creatorId: creator.id,
              actorId: snapshotC.id,
              type: lockedLikeC.type,
              targetPostId: post.id,
              content: lockedLikeC.content,
              snapshot: snapshotC,
              applied: false,
            },
          ],
        },
      ],
    }),
  });

  const acceptedReply = await noodle.createNoodlerFanInteraction(post.id, replyA);
  if (!acceptedReply) throw new Error("accepted reply must create an interaction");
  assert.equal(acceptedReply.created, true);
  assert.equal(acceptedReply.interaction.id, replyA.id);
  assert.equal(acceptedReply.interaction.content, replyA.content);

  const acceptedLike = await noodle.createNoodlerFanInteraction(post.id, likeB);
  if (!acceptedLike) throw new Error("accepted like must create an interaction");
  assert.equal(acceptedLike.created, true);
  assert.equal(acceptedLike.interaction.id, likeB.id);

  let rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, post.id));
  assert.equal(rows.length, 2);

  const repeatedReply = await noodle.createNoodlerFanInteraction(post.id, replyA);
  if (!repeatedReply) throw new Error("stable repeated reply must resolve to its interaction");
  assert.equal(repeatedReply.created, false);
  assert.equal(repeatedReply.interaction.id, replyA.id);
  rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, post.id));
  assert.equal(rows.length, 2);

  const unlisted = await noodle.createNoodlerFanInteraction(post.id, {
    id: "fan-run-1-unlisted",
    creatorAccountId: creator.id,
    actorId: snapshotA.id,
    actorSnapshot: snapshotA,
    runId,
    type: "reply",
    content: "Not accepted by the plan",
  });
  assert.equal(unlisted, null);
  rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, post.id));
  assert.equal(rows.length, 2);

  assert.equal(await noodle.getAccountById(snapshotA.id), null);
  assert.equal(await noodle.getAccountById(snapshotB.id), null);
  const storedReply = rows.find((row) => row.id === replyA.id);
  const storedLike = rows.find((row) => row.id === likeB.id);
  assert.ok(storedReply);
  assert.ok(storedLike);
  assert.deepEqual(JSON.parse(storedReply.actorSnapshot), snapshotA);
  assert.deepEqual(JSON.parse(storedLike.actorSnapshot), snapshotB);

  await db.update(noodlePosts).set({ access: "locked" }).where(eq(noodlePosts.id, post.id));
  const blocked = await noodle.createNoodlerFanInteraction(post.id, lockedLikeC);
  assert.equal(blocked, null);
  rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, post.id));
  assert.equal(rows.some((row) => row.id === lockedLikeC.id), false);
  assert.equal(rows.length, 2);
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("NoodleR fan activity regression passed.\n");
