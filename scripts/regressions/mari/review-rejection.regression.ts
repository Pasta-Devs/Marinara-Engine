// Rejecting part of a review: rejectRows reverts a dependency-closed subset of a pending review's lorebook entries,
// refuses rejections that would leave a dangling entry, stays consistent when two run at once, and prompt previews
// read the before and after snapshots. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterDataSchema } from "../../../packages/shared/src/schemas/character.schema.js";
import { createCharactersStorage } from "../../../packages/server/src/services/storage/characters.storage.js";
import { characterOverrideDb } from "../../../packages/server/src/services/professor-mari/workspace-edit-render.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-review-rejection-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const characterStorage = createCharactersStorage(db);
  const lorebookStorage = createLorebooksStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  // #4931: rejectRows reverts a dependency-closed SUBSET of a pending review's lorebook entries,
  // keeping the rest applied, and shrinks (or resolves) the pending card. Guards the audited undo
  // path: a stale tuple and a non-lorebook_entries row are both refused without reverting anything.
  const rejectLorebookId = "professor-mari-reject-rows-regression";
  try {
    const rejectApprovalsBefore = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
    const rejectCreate = await mariDb.executeAction({
      action: "lorebook.create",
      lorebookId: rejectLorebookId,
      data: {
        name: "Reject-rows regression",
        entries: [
          { name: "Entry A", content: "keep A" },
          { name: "Entry B", content: "reject B" },
          { name: "Entry C", content: "keep C" },
        ],
      },
      apply: true,
    });
    assert.equal(rejectCreate.ok, true, `reject-rows create must succeed: ${JSON.stringify(rejectCreate)}`);

    const rejectEntries = await lorebookStorage.listEntries(rejectLorebookId);
    assert.equal(rejectEntries.length, 3, "three entries created before reject");
    const entryB = rejectEntries.find((entry) => entry.name === "Entry B");
    assert.ok(entryB, "Entry B present before reject");

    const rejectApproval = mariDb.getPendingApprovals().find((approval) => !rejectApprovalsBefore.has(approval.id));
    assert.ok(rejectApproval, "lorebook create produced a reviewable approval");
    const entryBIndex = rejectApproval.diffPreview.findIndex(
      (change) => change.table === "lorebook_entries" && change.id === entryB.id,
    );
    assert.ok(entryBIndex >= 0, "Entry B appears in the approval diff preview");
    const lorebookRowIndex = rejectApproval.diffPreview.findIndex((change) => change.table === "lorebooks");
    assert.ok(lorebookRowIndex >= 0, "the lorebook row appears in the approval diff preview");

    // A stale/mismatched identity tuple is refused, not misapplied to the wrong row.
    const rejectStale = await mariDb.rejectRows(rejectApproval.id, [
      { index: entryBIndex, table: "lorebook_entries", id: entryB.id, action: "delete" },
    ]);
    assert.ok(
      rejectStale && "outcome" in rejectStale && rejectStale.outcome === "invalid_selection",
      "a mismatched action tuple is refused as invalid_selection",
    );

    // Rejecting the parent lorebook row (not a lorebook_entries change) is refused in v1.
    const rejectLorebookRow = await mariDb.rejectRows(rejectApproval.id, [
      { index: lorebookRowIndex, table: "lorebooks", id: rejectLorebookId, action: "insert" },
    ]);
    assert.ok(
      rejectLorebookRow && "outcome" in rejectLorebookRow && rejectLorebookRow.outcome === "invalid_selection",
      "rejecting a non-lorebook_entries row is refused",
    );
    assert.equal((await lorebookStorage.listEntries(rejectLorebookId)).length, 3, "a refused reject reverts nothing");

    // Reject only Entry B: it is removed, A and C stay, the lorebook stays, the card shrinks.
    const rejectB = await mariDb.rejectRows(rejectApproval.id, [
      { index: entryBIndex, table: "lorebook_entries", id: entryB.id, action: "insert" },
    ]);
    assert.ok(rejectB && "history" in rejectB, `rejecting Entry B must succeed: ${JSON.stringify(rejectB)}`);
    assert.equal(rejectB.completed, false, "the review still has rows after a partial reject");
    assert.equal(rejectB.rejected, 1, "exactly one row was rejected");
    assert.deepEqual(
      (await lorebookStorage.listEntries(rejectLorebookId)).map((entry) => entry.name).sort(),
      ["Entry A", "Entry C"],
      "only Entry B was reverted; A and C remain",
    );
    const shrunkApproval = mariDb.getPendingApprovals().find((approval) => approval.id === rejectApproval.id);
    assert.ok(shrunkApproval, "the partially-rejected review is still pending");
    assert.ok(
      !shrunkApproval.diffPreview.some((change) => change.table === "lorebook_entries" && change.id === entryB.id),
      "the rejected row is gone from the shrunken diff preview",
    );
    // The approvals list renders the mirrored affectedRows count, so a partial reject must recompute
    // it (not leave it at the pre-reject total). With < 50 changes it equals the preview length.
    assert.equal(
      shrunkApproval.affectedRows,
      shrunkApproval.diffPreview.length,
      "the mirrored affectedRows count matches the shrunken plan",
    );

    // Reject the remaining entries (re-derived from the shrunken preview, since indices shifted).
    // The un-rejectable lorebooks row remains, so the review stays pending rather than resolving.
    const remainingEntryRows = shrunkApproval.diffPreview
      .map((change, index) => ({ change, index }))
      .filter((row) => row.change.table === "lorebook_entries")
      .map((row) => ({ index: row.index, table: row.change.table, id: row.change.id, action: row.change.action }));
    const rejectRest = await mariDb.rejectRows(rejectApproval.id, remainingEntryRows);
    assert.ok(rejectRest && "history" in rejectRest, "rejecting the remaining entries must succeed");
    assert.equal(rejectRest.completed, false, "the un-rejectable lorebook row keeps the review pending");
    assert.equal(
      (await lorebookStorage.listEntries(rejectLorebookId)).length,
      0,
      "all entries reverted; the empty lorebook shell survives for Keep/Restore",
    );
  } finally {
    await lorebookStorage.remove(rejectLorebookId);
  }
  // #4931 (reject guard): a lorebook_entries DELETE cannot be rejected on its own when its parent
  // lorebook is gone (deleted in the same review, or otherwise) — re-inserting the entry would dangle,
  // and post-restore validate() would only catch that AFTER restoreChanges committed. rejectRows
  // refuses it up front with invalid_selection, reverting nothing.
  const rejectDanglingLorebook = await lorebookStorage.create({ name: "Reject-dangling parent" });
  let rejectDanglingRemoved = false;
  try {
    const danglingEntry = await lorebookStorage.createEntry({
      lorebookId: rejectDanglingLorebook.id,
      name: "Doomed entry",
      content: "about to be orphaned",
      keys: ["doomed"],
    });
    const danglingApprovalsBefore = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
    const danglingDelete = await mariDb.executeAction({
      action: "lorebook.deleteEntry",
      entryId: danglingEntry.id,
      apply: true,
    });
    assert.equal(danglingDelete.ok, true, `deleting the entry must succeed: ${JSON.stringify(danglingDelete)}`);
    const danglingApproval = mariDb.getPendingApprovals().find((approval) => !danglingApprovalsBefore.has(approval.id));
    assert.ok(danglingApproval, "the entry delete produced a reviewable approval");
    // The parent lorebook is gone by review time (simulating a separate top-level lorebook delete).
    await lorebookStorage.remove(rejectDanglingLorebook.id);
    rejectDanglingRemoved = true;
    const danglingIndex = danglingApproval.diffPreview.findIndex(
      (change) => change.table === "lorebook_entries" && change.id === danglingEntry.id,
    );
    assert.ok(danglingIndex >= 0, "the deleted entry appears in the diff preview");
    const rejectDangling = await mariDb.rejectRows(danglingApproval.id, [
      { index: danglingIndex, table: "lorebook_entries", id: danglingEntry.id, action: "delete" },
    ]);
    assert.ok(
      rejectDangling && "outcome" in rejectDangling && rejectDangling.outcome === "invalid_selection",
      `rejecting an entry whose parent lorebook is gone must be refused, not 500: ${JSON.stringify(rejectDangling)}`,
    );
    assert.ok(
      mariDb.getPendingApprovals().some((approval) => approval.id === danglingApproval.id),
      "the refused reject reverts nothing and leaves the review pending",
    );
    // The refusal must revert nothing: the entry stays deleted (a faulty path that re-inserts it AND
    // returns invalid_selection would otherwise pass the checks above).
    const danglingAfter = await lorebookStorage.listEntries(rejectDanglingLorebook.id);
    assert.ok(
      !danglingAfter.some((entry) => entry.id === danglingEntry.id),
      "the refused reject did not re-insert the orphaned entry",
    );
    // The whole-plan Restore path has no pre-check, so the in-transaction parent check is the safety
    // net (also closing the reject TOCTOU): restoring the review while the parent lorebook is gone
    // rolls back to state_changed rather than committing a dangling entry.
    const restoreDangling = await mariDb.restoreAppliedReview(danglingApproval.id);
    assert.ok(
      restoreDangling && "outcome" in restoreDangling && restoreDangling.outcome === "state_changed",
      `restoring an entry delete whose parent lorebook is gone must roll back to state_changed: ${JSON.stringify(restoreDangling)}`,
    );
    assert.ok(
      !(await lorebookStorage.listEntries(rejectDanglingLorebook.id)).some((entry) => entry.id === danglingEntry.id),
      "the rolled-back restore did not re-insert the orphaned entry",
    );
  } finally {
    if (!rejectDanglingRemoved) await lorebookStorage.remove(rejectDanglingLorebook.id);
  }
  // #4931 (reject guard, update branch): rejecting a lorebook_entries UPDATE reverts the entry to its
  // pre-edit lorebookId. If that former parent lorebook was deleted concurrently, the revert would
  // write a dangling reference. The in-transaction parent check now covers every non-insert entry
  // change (not just deletes), so the reject rolls back to state_changed instead of committing bad
  // data that only post-commit validate() would catch.
  const reparentSourceLorebook = await lorebookStorage.create({ name: "Reparent-reject source" });
  const reparentTargetLorebook = await lorebookStorage.create({ name: "Reparent-reject target" });
  let reparentSourceRemoved = false;
  try {
    const reparentEntry = await lorebookStorage.createEntry({
      lorebookId: reparentSourceLorebook.id,
      name: "Reparented entry",
      content: "moved between lorebooks",
      keys: ["reparent-reject"],
    });
    const reparentApprovalsBefore = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
    const reparentPatch = await mariDb.executeCli({
      argv: [
        "db",
        "patch",
        "lorebook_entries",
        reparentEntry.id,
        "--json",
        JSON.stringify({ lorebookId: reparentTargetLorebook.id }),
        "--apply",
      ],
    });
    assert.equal(reparentPatch.ok, true, `reparenting the entry must succeed: ${JSON.stringify(reparentPatch)}`);
    const reparentApproval = mariDb.getPendingApprovals().find((approval) => !reparentApprovalsBefore.has(approval.id));
    assert.ok(reparentApproval, "the reparent produced a reviewable approval");
    const reparentIndex = reparentApproval.diffPreview.findIndex(
      (change) => change.table === "lorebook_entries" && change.id === reparentEntry.id && change.action === "update",
    );
    assert.ok(reparentIndex >= 0, "the reparent appears as an update in the diff preview");
    // The FORMER parent lorebook is deleted before review (a separate top-level delete). Reverting the
    // reparent would point the entry back at it, so the in-tx check must roll the reject back.
    await lorebookStorage.remove(reparentSourceLorebook.id);
    reparentSourceRemoved = true;
    const rejectReparent = await mariDb.rejectRows(reparentApproval.id, [
      { index: reparentIndex, table: "lorebook_entries", id: reparentEntry.id, action: "update" },
    ]);
    assert.ok(
      rejectReparent && "outcome" in rejectReparent && rejectReparent.outcome === "state_changed",
      `rejecting a reparent whose former lorebook is gone must roll back to state_changed, not 500: ${JSON.stringify(rejectReparent)}`,
    );
    assert.ok(
      mariDb.getPendingApprovals().some((approval) => approval.id === reparentApproval.id),
      "the rolled-back reject left the review pending",
    );
    // The entry stays in its CURRENT (target) lorebook — the revert to the deleted source rolled back.
    assert.ok(
      (await lorebookStorage.listEntries(reparentTargetLorebook.id)).some((entry) => entry.id === reparentEntry.id),
      "the entry remains in the target lorebook after the rolled-back reject",
    );
  } finally {
    if (!reparentSourceRemoved) await lorebookStorage.remove(reparentSourceLorebook.id);
    await lorebookStorage.remove(reparentTargetLorebook.id);
  }
  // #4931 (reject serialization): keepAppliedReview / restoreAppliedReview / rejectRows each read
  // pending.get(id), revert across await points, then rewrite the pending record + durable sidecar.
  // Two concurrent requests for the SAME review (two devices, or a double-submit that slips the
  // client busy guard) must not clobber each other. Without the per-review lock, both rejectRows
  // calls read the same record, both revert their row, and the last writer leaves a PHANTOM entry in
  // the pending card that was already reverted from the DB. Invariant: the pending card's entry rows
  // always match the entries actually present in the DB.
  const raceLorebookId = "professor-mari-reject-race-regression";
  try {
    const raceApprovalsBefore = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
    const raceCreate = await mariDb.executeAction({
      action: "lorebook.create",
      lorebookId: raceLorebookId,
      data: {
        name: "Reject-race regression",
        entries: [
          { name: "Race A", content: "row A" },
          { name: "Race B", content: "row B" },
        ],
      },
      apply: true,
    });
    assert.equal(raceCreate.ok, true, `reject-race create must succeed: ${JSON.stringify(raceCreate)}`);
    const raceEntries = await lorebookStorage.listEntries(raceLorebookId);
    assert.equal(raceEntries.length, 2, "two entries created before the concurrent reject");
    const raceApproval = mariDb.getPendingApprovals().find((approval) => !raceApprovalsBefore.has(approval.id));
    assert.ok(raceApproval, "the create produced a reviewable approval");
    const raceSelectionFor = (entryName: string) => {
      const entry = raceEntries.find((candidate) => candidate.name === entryName);
      assert.ok(entry, `${entryName} present before reject`);
      const index = raceApproval.diffPreview.findIndex(
        (change) => change.table === "lorebook_entries" && change.id === entry.id,
      );
      assert.ok(index >= 0, `${entryName} appears in the diff preview`);
      return { index, table: "lorebook_entries", id: entry.id, action: raceApproval.diffPreview[index].action };
    };
    // Fire both rejects at once. They interleave at restoreChanges' await; the per-review lock must
    // serialize the read-modify-write so neither overwrites the other's shrunken plan.
    const [resA, resB] = await Promise.all([
      mariDb.rejectRows(raceApproval.id, [raceSelectionFor("Race A")]),
      mariDb.rejectRows(raceApproval.id, [raceSelectionFor("Race B")]),
    ]);
    assert.ok(resA && "history" in resA, "the first concurrent reject must succeed");
    assert.ok(resB && "history" in resB, "the second concurrent reject must succeed");
    // Core invariant: the pending card's entry rows exactly match the entries still in the DB. A
    // clobbering lost-update would leave a phantom entry row in the card that was already reverted.
    const raceCard = mariDb.getPendingApprovals().find((approval) => approval.id === raceApproval.id);
    const pendingEntryIds = (raceCard?.diffPreview ?? [])
      .filter((change) => change.table === "lorebook_entries")
      .map((change) => change.id)
      .sort();
    const liveEntryIds = (await lorebookStorage.listEntries(raceLorebookId)).map((entry) => entry.id).sort();
    assert.deepEqual(
      pendingEntryIds,
      liveEntryIds,
      "the pending card's entry rows match the DB after concurrent rejects (no phantom row from a lost update)",
    );
    assert.deepEqual(liveEntryIds, [], "both concurrent rejects must remove both selected entries");
  } finally {
    await lorebookStorage.remove(raceLorebookId);
  }
  // Prompt rendering cannot address changes that the capped diff preview never exposed.
  const previewLimitLorebookId = "professor-mari-preview-limit-regression";
  try {
    const created = await mariDb.executeAction({
      action: "lorebook.create",
      lorebookId: previewLimitLorebookId,
      data: {
        name: "Preview limit",
        entries: Array.from({ length: 51 }, (_, index) => ({
          name: `Row ${index}`,
          content: `row ${index}`,
        })),
      },
      apply: true,
    });
    const reviewId = created.approval?.id;
    assert.ok(reviewId);
    assert.ok(mariDb.getPendingChangeRaw(reviewId, 49), "the final visible preview change can render");
    assert.equal(mariDb.getPendingChangeRaw(reviewId, 50), null, "a hidden change cannot render");
    await mariDb.keepAppliedReview(reviewId);
  } finally {
    await lorebookStorage.remove(previewLimitLorebookId);
  }
  // #4931: the synthetic prompt-render DB proxy substitutes the target character's row (so the
  // assembler reads a before/after snapshot instead of the live row) while passing every other read
  // through untouched. Validated through the exact storage path the assembler uses (getById).
  const proxyTargetCharacter = await characterStorage.create(
    characterDataSchema.parse({ name: "Proxy target", description: "live description" }),
  );
  const proxyOtherCharacter = await characterStorage.create(characterDataSchema.parse({ name: "Proxy other" }));
  try {
    const liveTarget = await characterStorage.getById(proxyTargetCharacter.id);
    assert.ok(liveTarget, "proxy target character exists");
    const snapshot = {
      ...liveTarget,
      data: JSON.stringify({ ...JSON.parse(String(liveTarget.data)), name: "Snapshot name" }),
    };
    const overrideDb = characterOverrideDb(db, proxyTargetCharacter.id, snapshot);
    const seenTarget = await createCharactersStorage(overrideDb).getById(proxyTargetCharacter.id);
    assert.equal(
      JSON.parse(String(seenTarget?.data)).name,
      "Snapshot name",
      "the proxy substitutes the target character row with the snapshot",
    );
    const seenOther = await createCharactersStorage(overrideDb).getById(proxyOtherCharacter.id);
    assert.equal(seenOther?.id, proxyOtherCharacter.id, "the proxy passes other character reads through untouched");
    assert.equal(
      JSON.parse(String(seenOther?.data)).name,
      "Proxy other",
      "a non-target character keeps its live data through the proxy",
    );
    const removeDb = characterOverrideDb(db, proxyTargetCharacter.id, null);
    assert.equal(
      await createCharactersStorage(removeDb).getById(proxyTargetCharacter.id),
      null,
      "a null substitute drops the target row (before-side of an insert)",
    );
  } finally {
    await characterStorage.remove(proxyTargetCharacter.id);
    await characterStorage.remove(proxyOtherCharacter.id);
  }
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
