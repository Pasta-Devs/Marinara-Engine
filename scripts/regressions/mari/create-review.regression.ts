// Every Mari create goes through the same Keep and Restore review as edits and deletes, so it stays undoable, and a
// create never overwrites an existing row. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-create-review-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const lorebookStorage = createLorebooksStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  // #4813 (PR 1): every Professor Mari `*.create` now applies through the same Keep/Restore
  // review as edits and deletes — so a creation Mari made without being asked stays undoable in
  // chat — and a create may never overwrite an existing row.
  const pendingReviewIds = () => new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
  const newestReviewSince = (baseline: Set<string>) =>
    mariDb.getPendingApprovals().find((approval) => !baseline.has(approval.id));
  // (1) A create routes through review and is applied-but-undoable.
  const beforeReviewableCreate = pendingReviewIds();
  const reviewableCharacter = await mariDb.executeAction({
    action: "character.create",
    characterId: "mari-reviewable-character",
    data: { name: "Reviewable Character" },
    apply: true,
  });
  assert.equal(reviewableCharacter.ok, true);
  assert.equal(
    reviewableCharacter.approval?.status,
    "pending",
    "character.create must apply through the Keep/Restore review, not silently",
  );
  const reviewableApproval = newestReviewSince(beforeReviewableCreate);
  assert.ok(reviewableApproval, "character.create must register a pending review");
  assert.equal(
    (await mariDb.executeAction({ action: "character.get", id: "mari-reviewable-character" })).ok,
    true,
    "the row is applied immediately (apply-with-undo), so it is readable while the review is pending",
  );
  // (2) Restore removes the created row and clears the review.
  await mariDb.restoreAppliedReview(reviewableApproval.id);
  assert.equal(
    (await mariDb.executeAction({ action: "character.get", id: "mari-reviewable-character" })).ok,
    false,
    "Restoring a create must delete the row Mari added",
  );
  assert.equal(
    mariDb.getPendingApprovals().some((approval) => approval.id === reviewableApproval.id),
    false,
    "a restored review leaves the pending list",
  );
  // (3) Keep persists the created row and clears the review.
  const beforeKeptCreate = pendingReviewIds();
  await mariDb.executeAction({
    action: "character.create",
    characterId: "mari-kept-character",
    data: { name: "Kept Character" },
    apply: true,
  });
  const keptApproval = newestReviewSince(beforeKeptCreate);
  assert.ok(keptApproval);
  await mariDb.keepAppliedReview(keptApproval.id);
  assert.equal(
    (await mariDb.executeAction({ action: "character.get", id: "mari-kept-character" })).ok,
    true,
    "Keeping a create leaves the row in place",
  );
  assert.equal(
    mariDb.getPendingApprovals().some((approval) => approval.id === keptApproval.id),
    false,
    "a kept review leaves the pending list",
  );
  // (4) A create may not overwrite an existing row (the planInsert clobber guard).
  const beforeClobber = pendingReviewIds();
  const clobberAttempt = await mariDb.executeAction({
    action: "character.create",
    characterId: "mari-kept-character",
    data: { name: "Impostor" },
    apply: true,
  });
  assert.equal(clobberAttempt.ok, false, "creating over an existing id must be refused, not overwrite it");
  assert.match(String(clobberAttempt.error ?? ""), /already exists/iu);
  assert.equal(newestReviewSince(beforeClobber), undefined, "a refused create must not leave a dangling review");
  assert.equal(
    (await mariDb.executeAction({ action: "character.get", id: "mari-kept-character" })).ok,
    true,
    "the pre-existing row survives a refused create",
  );
  // (5) A multi-row create (lorebook + entry) restores every row in FK-safe order.
  const beforeReviewableLorebook = pendingReviewIds();
  await mariDb.executeAction({
    action: "lorebook.create",
    lorebookId: "mari-reviewable-lorebook",
    data: {
      name: "Reviewable Lorebook",
      entries: [{ name: "Reviewable entry", content: "Reviewable entry content", keys: ["review"] }],
    },
    apply: true,
  });
  const reviewableLorebookApproval = newestReviewSince(beforeReviewableLorebook);
  assert.ok(reviewableLorebookApproval, "lorebook.create must register a pending review");
  assert.equal((await lorebookStorage.listEntries("mari-reviewable-lorebook")).length, 1);
  await mariDb.restoreAppliedReview(reviewableLorebookApproval.id);
  assert.ok(
    !(await lorebookStorage.getById("mari-reviewable-lorebook")),
    "Restoring a lorebook create removes the lorebook itself",
  );
  assert.equal(
    (await lorebookStorage.listEntries("mari-reviewable-lorebook")).length,
    0,
    "Restoring a lorebook create also removes its entries",
  );
  // (6) A non-activating theme.create routes through review too, and Restore removes it.
  const beforeReviewableTheme = pendingReviewIds();
  const reviewableTheme = await mariDb.executeAction({
    action: "theme.create",
    themeId: "mari-reviewable-theme",
    data: { name: "Reviewable Theme", css: "body { color: inherit; }" },
    apply: true,
  });
  assert.equal(
    reviewableTheme.approval?.status,
    "pending",
    "a non-activating theme.create must also route through review",
  );
  const reviewableThemeApproval = newestReviewSince(beforeReviewableTheme);
  assert.ok(reviewableThemeApproval);
  await mariDb.restoreAppliedReview(reviewableThemeApproval.id);
  assert.equal(
    (await mariDb.executeAction({ action: "theme.get", id: "mari-reviewable-theme" })).ok,
    false,
    "Restoring a theme create removes the theme",
  );
  for (const approval of mariDb.getPendingApprovals()) {
    await mariDb.keepAppliedReview(approval.id);
  }
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
