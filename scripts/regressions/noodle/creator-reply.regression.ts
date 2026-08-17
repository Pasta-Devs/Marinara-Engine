import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS } from "../../../packages/shared/src/index.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { noodlerCreatorReplyClaims } from "../../../packages/server/src/db/schema/noodle.js";
import { createNoodleStorage } from "../../../packages/server/src/services/storage/noodle.storage.js";

assert.equal(DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS, 10, "the global default must be explicit");

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-creator-reply-"));
process.env.FILE_STORAGE_DIR = storageDir;
let fileDb = await createFileNativeDB();

try {
  let db = fileDb as unknown as DB;
  let noodle = createNoodleStorage(db);
  await noodle.updateSettings({ enableNoodler: true });
  const source = await noodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "creator-source",
    displayName: "Creator Source",
  });
  const viewer = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "real-viewer",
    displayName: "Real Viewer",
  });
  const stage = await noodle.createNoodlerAccount(source.id, {
    displayName: "Stage Creator",
    handle: "stage_creator",
    bio: "Stage bio",
    stagePersonality: "Brief and attentive.",
    disclosureMode: "secret",
  });
  assert.ok(stage);
  const post = await noodle.createNoodlerPost({
    authorAccountId: stage.id,
    content: "Readable post",
    access: "public",
  });
  assert.ok(post);
  const parent = await noodle.createNoodlerInteraction(post.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "A real viewer comment",
  });
  assert.ok(parent);

  const claimedAt = "2026-07-29T12:00:00.000Z";
  const claim = await noodle.claimNoodlerCreatorReply(stage.id, post.id, parent.id, viewer.id, claimedAt, 1);
  assert.equal(claim.status, "claimed");
  if (claim.status !== "claimed") throw new Error("expected claim");

  const duplicate = await noodle.claimNoodlerCreatorReply(stage.id, post.id, parent.id, viewer.id, claimedAt, 1);
  assert.deepEqual(duplicate, { status: "duplicate", interaction: null }, "a failed/ambiguous claim must not retry");

  const secondParent = await noodle.createNoodlerInteraction(post.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "Another comment",
  });
  assert.ok(secondParent);
  assert.deepEqual(
    await noodle.claimNoodlerCreatorReply(stage.id, post.id, secondParent.id, viewer.id, claimedAt, 1),
    { status: "exhausted" },
    "the rolling ceiling is global and checked before a claim is granted",
  );

  await fileDb._fileStore.flush();
  await fileDb._fileStore.close();
  fileDb = await createFileNativeDB();
  db = fileDb as unknown as DB;
  noodle = createNoodleStorage(db);
  assert.deepEqual(
    await noodle.claimNoodlerCreatorReply(stage.id, post.id, parent.id, viewer.id, claimedAt, 1),
    { status: "duplicate", interaction: null },
    "unfinalized claims must survive restart",
  );

  const generated = await noodle.finalizeNoodlerCreatorReplyClaim(claim.claimId, "Creator answer");
  assert.ok(generated);
  assert.equal(generated.parentInteractionId, parent.id);
  assert.equal(generated.actorAccountId, stage.id);
  const finalizedDuplicate = await noodle.claimNoodlerCreatorReply(stage.id, post.id, parent.id, viewer.id, claimedAt, 1);
  assert.equal(finalizedDuplicate.status, "duplicate");
  if (finalizedDuplicate.status === "duplicate") assert.equal(finalizedDuplicate.interaction?.id, generated.id);

  const lockedPost = await noodle.createNoodlerPost({
    authorAccountId: stage.id,
    content: "Not unlocked",
    access: "locked",
  });
  assert.ok(lockedPost);
  const lockedParent = await noodle.createNoodlerInteraction(lockedPost.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "Stored before access changed",
  });
  assert.ok(lockedParent);
  assert.deepEqual(
    await noodle.claimNoodlerCreatorReply(stage.id, lockedPost.id, lockedParent.id, viewer.id, claimedAt, 10),
    { status: "ineligible" },
    "current post access must be enforced when claiming",
  );

  // A failed attempt releases its claim, so the comment stays answerable and the released
  // claim does not permanently consume a slot.
  const retryParent = await noodle.createNoodlerInteraction(post.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "Comment whose first reply attempt fails",
  });
  assert.ok(retryParent);
  const failing = await noodle.claimNoodlerCreatorReply(stage.id, post.id, retryParent.id, viewer.id, claimedAt, 10);
  assert.equal(failing.status, "claimed");
  if (failing.status === "claimed") await noodle.releaseNoodlerCreatorReplyClaim(failing.claimId);
  const retried = await noodle.claimNoodlerCreatorReply(stage.id, post.id, retryParent.id, viewer.id, claimedAt, 10);
  assert.equal(retried.status, "claimed", "a released claim must not block the comment forever");
  if (retried.status === "claimed") {
    const retriedReply = await noodle.finalizeNoodlerCreatorReplyClaim(retried.claimId, "Answer on retry");
    assert.ok(retriedReply);
    // A claim that produced a reply is the permanent dedupe key and is never released.
    await noodle.releaseNoodlerCreatorReplyClaim(retried.claimId);
    assert.equal(
      (await noodle.claimNoodlerCreatorReply(stage.id, post.id, retryParent.id, viewer.id, claimedAt, 10)).status,
      "duplicate",
    );
  }

  // Duplicate detection must not disclose a stored reply to a caller that does not own the
  // parent comment: replaying known IDs from another persona is ineligible, not duplicate.
  const otherViewer = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "other-viewer",
    displayName: "Other Viewer",
  });
  assert.deepEqual(
    await noodle.claimNoodlerCreatorReply(stage.id, post.id, parent.id, otherViewer.id, claimedAt, 10),
    { status: "ineligible" },
    "duplicate lookup must revalidate parent ownership",
  );

  // An orphan claim left by a crash expires: the same comment stays answerable afterwards.
  const orphanParent = await noodle.createNoodlerInteraction(post.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "Comment whose claim is orphaned by a crash",
  });
  assert.ok(orphanParent);
  const orphan = await noodle.claimNoodlerCreatorReply(stage.id, post.id, orphanParent.id, viewer.id, claimedAt, 10);
  assert.equal(orphan.status, "claimed");
  // Exactly 24 hours: the claim is outside the budget window, so it must also be outside the
  // pruning window. A mismatched boundary here leaves it counted by neither and blocking forever.
  const atExpiry = new Date(Date.parse(claimedAt) + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(
    (await noodle.claimNoodlerCreatorReply(stage.id, post.id, orphanParent.id, viewer.id, atExpiry, 10)).status,
    "claimed",
    "an orphan claim exactly at the expiry boundary must be released",
  );
  const orphanClaim = (await db.select().from(noodlerCreatorReplyClaims)).find(
    (row) => row.parentInteractionId === orphanParent.id,
  );
  assert.ok(orphanClaim, "the re-claim at the expiry boundary must have left a claim row to release");
  await noodle.releaseNoodlerCreatorReplyClaim(orphanClaim.id);
  const afterExpiry = new Date(Date.parse(claimedAt) + 25 * 60 * 60 * 1000).toISOString();
  assert.equal(
    (await noodle.claimNoodlerCreatorReply(stage.id, post.id, orphanParent.id, viewer.id, afterExpiry, 10)).status,
    "claimed",
    "an expired orphan claim must not block its comment forever",
  );

  // Deleting the post exercises the storage cascade: the whole conversation and permanent
  // claims must go with it so they do not keep consuming the installation-wide reply allowance.
  const disposablePost = await noodle.createNoodlerPost({
    authorAccountId: stage.id,
    content: "Post that gets deleted",
    access: "public",
  });
  assert.ok(disposablePost);
  const disposableParent = await noodle.createNoodlerInteraction(disposablePost.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "Comment on a doomed post",
  });
  assert.ok(disposableParent);
  const disposableClaim = await noodle.claimNoodlerCreatorReply(
    stage.id,
    disposablePost.id,
    disposableParent.id,
    viewer.id,
    afterExpiry,
    10,
  );
  assert.equal(disposableClaim.status, "claimed");
  if (disposableClaim.status !== "claimed") throw new Error("expected claim");
  assert.ok(await noodle.finalizeNoodlerCreatorReplyClaim(disposableClaim.claimId, "Doomed answer"));
  assert.ok(await noodle.deleteNoodlerPost(disposablePost.id));
  assert.equal(
    (await db.select().from(noodlerCreatorReplyClaims)).some((row) => row.postId === disposablePost.id),
    false,
    "deleting a post must not leave its creator-reply claims behind",
  );
  assert.equal((await noodle.listNoodlerInteractions([disposablePost.id])).length, 0);

  // A crash can leave a reply whose claim never linked (or never landed). Finalizing again must
  // adopt that reply rather than write a second one, and claiming must report it as duplicate.
  const crashParent = await noodle.createNoodlerInteraction(post.id, {
    actorAccountId: viewer.id,
    type: "reply",
    content: "Comment answered just before the crash",
  });
  assert.ok(crashParent);
  const crashClaim = await noodle.claimNoodlerCreatorReply(stage.id, post.id, crashParent.id, viewer.id, afterExpiry, 10);
  assert.equal(crashClaim.status, "claimed");
  if (crashClaim.status !== "claimed") throw new Error("expected claim");
  const firstReply = await noodle.finalizeNoodlerCreatorReplyClaim(crashClaim.claimId, "The only answer");
  assert.ok(firstReply);
  // Simulate the lost claim-link write: the reply row survived, the link on the claim did not.
  await db
    .update(noodlerCreatorReplyClaims)
    .set({ replyInteractionId: null })
    .where(eq(noodlerCreatorReplyClaims.id, crashClaim.claimId));
  const readopted = await noodle.finalizeNoodlerCreatorReplyClaim(crashClaim.claimId, "A second answer");
  assert.equal(readopted?.id, firstReply.id, "finalizing again must adopt the existing reply");
  const replies = (await noodle.listNoodlerInteractions([post.id])).filter(
    (interaction) => interaction.parentInteractionId === crashParent.id,
  );
  assert.equal(replies.length, 1, "one creator reply per comment, even after a crash");
  const crashDuplicate = await noodle.claimNoodlerCreatorReply(stage.id, post.id, crashParent.id, viewer.id, afterExpiry, 10);
  assert.equal(crashDuplicate.status, "duplicate", "re-adopted replies must be reported as duplicate claims");
  if (crashDuplicate.status === "duplicate") {
    assert.equal(crashDuplicate.interaction?.id, firstReply.id, "duplicate claim must return the re-adopted reply");
  }

  const selfParent = await noodle.createNoodlerInteraction(post.id, {
    actorAccountId: source.id,
    type: "reply",
    content: "Creator's linked public persona",
  });
  assert.ok(selfParent);
  assert.deepEqual(
    await noodle.claimNoodlerCreatorReply(stage.id, post.id, selfParent.id, source.id, claimedAt, 10),
    { status: "ineligible" },
    "linked creator identity must not trigger a self-reply",
  );
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("NoodleR creator reply regression passed.\n");
