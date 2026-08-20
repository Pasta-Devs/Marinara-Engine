import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "../../packages/server/src/db/file-query.js";
import { fileTable, text } from "../../packages/server/src/db/file-schema.js";

// These separate table instances model the definitions bundled by the
// downloadable Slurp package. Engine must resolve them by registered name.
const packageSlurpAccounts = fileTable("slurp_accounts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  entityId: text("entity_id").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
const packageSlurpPosts = fileTable("slurp_posts", {
  id: text("id").primaryKey(),
  authorAccountId: text("author_account_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
const packageSlurpInteractions = fileTable("slurp_interactions", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  parentInteractionId: text("parent_interaction_id"),
  actorAccountId: text("actor_account_id").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  createdAt: text("created_at").notNull(),
});
const packageSlurpCreatorReplyClaims = fileTable("slurp_creator_reply_claims", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  parentInteractionId: text("parent_interaction_id").notNull(),
  creatorAccountId: text("creator_account_id").notNull(),
  replyInteractionId: text("reply_interaction_id"),
  claimedAt: text("claimed_at").notNull(),
});

const storageDir = mkdtempSync(join(tmpdir(), "marinara-slurp-storage-"));
process.env.FILE_STORAGE_DIR = storageDir;
const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const now = new Date().toISOString();

let fileDb = await createFileNativeDB();
try {
  await fileDb
    .insert(packageSlurpAccounts)
    .values({
      id: "slurp-creator",
      kind: "character",
      entityId: "character-1",
      handle: "slurp_creator",
      displayName: "Slurp Creator",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  await fileDb
    .insert(packageSlurpPosts)
    .values({
      id: "slurp-post",
      authorAccountId: "slurp-creator",
      content: "Package-owned storage proof",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  await fileDb
    .insert(packageSlurpInteractions)
    .values([
      {
        id: "slurp-comment",
        postId: "slurp-post",
        parentInteractionId: null,
        actorAccountId: "slurp-creator",
        type: "comment",
        content: "Parent comment",
        createdAt: now,
      },
      {
        id: "slurp-reply",
        postId: "slurp-post",
        parentInteractionId: "slurp-comment",
        actorAccountId: "slurp-creator",
        type: "comment",
        content: "Creator reply",
        createdAt: now,
      },
    ])
    .run();
  await fileDb
    .insert(packageSlurpCreatorReplyClaims)
    .values({
      id: "slurp-claim",
      postId: "slurp-post",
      parentInteractionId: "slurp-comment",
      creatorAccountId: "slurp-creator",
      replyInteractionId: "slurp-reply",
      claimedAt: now,
    })
    .run();
} finally {
  await fileDb._fileStore.close();
}

assert.equal(existsSync(join(storageDir, "tables", "slurp_accounts", `${encodeShardKey("slurp-creator")}.json`)), true);
assert.equal(existsSync(join(storageDir, "tables", "slurp_posts", `${encodeShardKey("slurp-creator")}.json`)), true);

fileDb = await createFileNativeDB();
try {
  assert.equal(
    (await fileDb.select().from(packageSlurpPosts).where(eq(packageSlurpPosts.id, "slurp-post"))).at(0)?.content,
    "Package-owned storage proof",
  );
  await fileDb.delete(packageSlurpInteractions).where(eq(packageSlurpInteractions.id, "slurp-comment")).run();
  assert.equal(
    (await fileDb.select().from(packageSlurpInteractions)).length,
    0,
    "deleting a parent interaction cascades to its replies",
  );
  assert.equal(
    (await fileDb.select().from(packageSlurpCreatorReplyClaims)).length,
    0,
    "deleting a parent interaction clears its reply claim",
  );

  await fileDb
    .insert(packageSlurpInteractions)
    .values([
      {
        id: "slurp-comment-2",
        postId: "slurp-post",
        parentInteractionId: null,
        actorAccountId: "slurp-creator",
        type: "comment",
        content: "Second parent comment",
        createdAt: now,
      },
      {
        id: "slurp-reply-2",
        postId: "slurp-post",
        parentInteractionId: "slurp-comment-2",
        actorAccountId: "slurp-creator",
        type: "comment",
        content: "Second creator reply",
        createdAt: now,
      },
    ])
    .run();
  await fileDb
    .insert(packageSlurpCreatorReplyClaims)
    .values({
      id: "slurp-claim-2",
      postId: "slurp-post",
      parentInteractionId: "slurp-comment-2",
      creatorAccountId: "slurp-creator",
      replyInteractionId: "slurp-reply-2",
      claimedAt: now,
    })
    .run();
  await fileDb.delete(packageSlurpInteractions).where(eq(packageSlurpInteractions.id, "slurp-reply-2")).run();
  assert.equal(
    (await fileDb.select().from(packageSlurpCreatorReplyClaims)).length,
    0,
    "deleting a reply interaction clears the claim that points to it",
  );
  assert.equal(
    (await fileDb.select().from(packageSlurpInteractions).where(eq(packageSlurpInteractions.id, "slurp-comment-2")))
      .length,
    1,
    "deleting a reply preserves its parent interaction",
  );

  await fileDb.delete(packageSlurpAccounts).where(eq(packageSlurpAccounts.id, "slurp-creator")).run();
  assert.equal((await fileDb.select().from(packageSlurpPosts)).length, 0, "deleting a Creator cascades to its posts");
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Slurp package-owned storage regression passed.\n");
