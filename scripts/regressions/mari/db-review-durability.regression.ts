// #4813 (durable review): Professor Mari's Keep/Restore undo card used to live only in an
// in-memory Map that was dropped after a 10-minute timer or on restart, so an applied change
// could quietly become permanent. These regressions drive the REAL MariDbService against a
// file-native store and assert that:
//   - a create's pending review is persisted to a sidecar on disk,
//   - a fresh service instance (a "restart") rehydrates it from disk,
//   - Restore and Keep still work after the restart and clean up the sidecar,
//   - a sidecar past its retention deadline is pruned on load,
//   - the persisted set is capped so it cannot grow without bound.
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { lorebookEntries } from "../../../packages/server/src/db/schema/lorebooks.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

// Mirrors PENDING_REVIEW_LIMIT in mari-db.service.ts (module-local constant).
const PENDING_REVIEW_LIMIT = 50;

function tempStorageDir() {
  const dir = mkdtempSync(join(tmpdir(), "marinara-mari-review-"));
  process.env.FILE_STORAGE_DIR = dir;
  return dir;
}

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;

const sidecarPath = (dir: string, id: string) => join(dir, "journal", "pending", `${id}.json`);

async function withRenameFailure<T>(sourcePath: string, action: () => Promise<T>): Promise<T> {
  const originalRenameSync = fs.renameSync;
  let restored = false;
  const restore = () => {
    if (restored) return;
    fs.renameSync = originalRenameSync;
    syncBuiltinESMExports();
    restored = true;
  };

  fs.renameSync = ((source, destination) => {
    if (source === sourcePath) {
      throw Object.assign(new Error(`EBUSY: resource busy or locked, rename '${sourcePath}'`), {
        code: "EBUSY",
        path: sourcePath,
        syscall: "rename",
      }) as NodeJS.ErrnoException;
    }
    return originalRenameSync(source, destination);
  }) as typeof fs.renameSync;
  syncBuiltinESMExports();

  try {
    return await action();
  } finally {
    restore();
  }
}

try {
  // ── Professor Mari can create a persona with every required storage default ──
  {
    const previousBlockStorageDir = process.env.FILE_STORAGE_DIR;
    const dir = tempStorageDir();
    let db: Awaited<ReturnType<typeof createFileNativeDB>> | null = null;
    try {
      db = await createFileNativeDB();
      const mari = new MariDbService(db);
      const created = await mari.executeAction({
        action: "persona.create",
        personaId: "created-persona",
        data: { name: "Created Persona", description: "A durable identity." },
        apply: true,
      });
      assert.equal(created.ok, true, "Professor Mari's persona.create action passes storage validation");
      assert.equal(created.mode, "apply");
      assert.equal(created.approval?.status, "pending", "the applied persona still receives a review card");
      const reviewId = created.approval?.id;
      assert.ok(reviewId, "the applied persona review has an id");
      const reviewPath = sidecarPath(dir, reviewId);
      assert.ok(existsSync(reviewPath), "the persona review is persisted to a sidecar");
      assert.equal(
        (JSON.parse(readFileSync(reviewPath, "utf8")) as { id?: string }).id,
        reviewId,
        "the sidecar contains the registered persona review",
      );

      const fetched = await mari.executeAction({ action: "persona.get", personaId: "created-persona" });
      assert.equal(fetched.ok, true, "the created persona is persisted");
      assert.equal(
        (fetched.output as Record<string, unknown>).useCharacterSheetAsReference,
        "false",
        "the persona stores the required character-sheet reference default",
      );
    } finally {
      if (db) await db._fileStore.close();
      if (previousBlockStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
      else process.env.FILE_STORAGE_DIR = previousBlockStorageDir;
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── A pending review persists to a sidecar, rehydrates after a restart, and Restore works ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const create = await mari.executeAction({
        action: "character.create",
        characterId: "durable-character",
        data: { name: "Durable Character" },
        apply: true,
      });
      assert.equal(create.approval?.status, "pending", "a create registers a pending review");
      const reviewId = create.approval?.id;
      assert.ok(reviewId, "the pending review has an id");
      assert.ok(existsSync(sidecarPath(dir, reviewId)), "the pending review is persisted to a sidecar file");

      // A fresh service instance starts with an empty in-memory Map: the "restart".
      const restarted = new MariDbService(db);
      const rehydrated = restarted.getPendingApprovals().find((approval) => approval.id === reviewId);
      assert.ok(rehydrated, "a persisted pending review is rehydrated after a restart");
      assert.equal(
        (await restarted.executeAction({ action: "character.get", id: "durable-character" })).ok,
        true,
        "the applied row is still present before the undo",
      );

      await restarted.restoreAppliedReview(reviewId);
      assert.equal(
        (await restarted.executeAction({ action: "character.get", id: "durable-character" })).ok,
        false,
        "Restore after a restart still deletes the created row",
      );
      assert.ok(!existsSync(sidecarPath(dir, reviewId)), "resolving a review removes its sidecar");
      assert.equal(
        restarted.getPendingApprovals().some((approval) => approval.id === reviewId),
        false,
        "a resolved review leaves the pending list",
      );
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── Keep after a restart persists the row and removes the sidecar ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const create = await mari.executeAction({
        action: "character.create",
        characterId: "kept-durable",
        data: { name: "Kept Durable" },
        apply: true,
      });
      const reviewId = create.approval?.id;
      assert.ok(reviewId);

      const restarted = new MariDbService(db);
      assert.ok(
        restarted.getPendingApprovals().find((approval) => approval.id === reviewId),
        "the review rehydrates after a restart",
      );
      await restarted.keepAppliedReview(reviewId);
      assert.equal(
        (await restarted.executeAction({ action: "character.get", id: "kept-durable" })).ok,
        true,
        "Keep leaves the row in place",
      );
      assert.ok(!existsSync(sidecarPath(dir, reviewId)), "Keep removes the sidecar");
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── A sidecar past its retention deadline is pruned on load, never rehydrated ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const pendingDir = join(dir, "journal", "pending");
      mkdirSync(pendingDir, { recursive: true });
      const staleId = "stale-review";
      const stalePath = join(pendingDir, `${staleId}.json`);
      writeFileSync(
        stalePath,
        JSON.stringify({
          kind: "applied_review",
          id: staleId,
          sessionId: "test",
          command: "app_data character.create",
          reason: null,
          operationHash: "hash",
          requestedAt: "2020-01-01T00:00:00.000Z",
          expiresAt: "2020-01-15T00:00:00.000Z", // long past the retention window
          affectedTables: { characters: 1 },
          affectedRows: 1,
          validationStatus: "passed",
          diffPreview: [],
          diffTruncated: false,
          plan: { changes: [] },
          historyId: null,
          journalPath: null,
        }),
        "utf8",
      );
      const mari = new MariDbService(db);
      assert.equal(
        mari.getPendingApprovals().some((approval) => approval.id === staleId),
        false,
        "an expired persisted review is not rehydrated",
      );
      assert.ok(!existsSync(stalePath), "an expired sidecar is pruned on load");
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── The persisted set is capped: creating more than the limit evicts the oldest ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    const pendingDir = join(dir, "journal", "pending");
    try {
      const mari = new MariDbService(db);
      let firstReviewId = "";
      let lastReviewId = "";
      for (let index = 0; index <= PENDING_REVIEW_LIMIT; index += 1) {
        const created = await mari.executeAction({
          action: "character.create",
          characterId: `capped-character-${index}`,
          data: { name: `Capped ${index}` },
          apply: true,
        });
        if (index === 0) firstReviewId = created.approval?.id ?? "";
        lastReviewId = created.approval?.id ?? "";
      }
      assert.equal(
        mari.getPendingApprovals().length,
        PENDING_REVIEW_LIMIT,
        "the in-memory pending set never exceeds the retention cap",
      );
      // The cap must drop the OLDEST review (insertion order), never the one just created.
      const cappedPending = mari.getPendingApprovals();
      assert.equal(
        cappedPending.some((approval) => approval.id === firstReviewId),
        false,
        "the oldest review is the one evicted past the cap",
      );
      assert.equal(
        cappedPending.some((approval) => approval.id === lastReviewId),
        true,
        "the newest review is retained, never evicted by its own creation",
      );
      assert.equal(
        readdirSync(pendingDir).filter((file) => file.endsWith(".json")).length,
        PENDING_REVIEW_LIMIT,
        "the persisted sidecars are capped in lockstep with the in-memory set",
      );

      const oldestRetained = cappedPending[0];
      assert.ok(oldestRetained, "the capped pending set contains an oldest retained review");
      const oldestRetainedPath = sidecarPath(dir, oldestRetained.id);
      const appliedPastLockedCap = await withRenameFailure(oldestRetainedPath, () =>
        mari.executeAction({
          action: "character.create",
          characterId: "capped-character-locked-sidecar",
          data: { name: "Applied despite locked retention" },
          apply: true,
        }),
      );
      assert.equal(appliedPastLockedCap.approval?.status, "pending", "retention cleanup cannot report an applied mutation as failed");
      assert.equal(
        mari.getPendingApprovals().length,
        PENDING_REVIEW_LIMIT + 1,
        "a locked oldest sidecar is retained temporarily instead of losing its undo",
      );
      assert.ok(
        mari.getPendingApprovals().some((approval) => approval.id === oldestRetained.id),
        "the selected oldest review stays pending when its retirement fails",
      );
      assert.ok(existsSync(oldestRetainedPath), "the selected oldest sidecar remains on disk when retirement fails");
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── An update's review rehydrates after a restart and Restore reverts to the pre-update row ──
  // This exercises the `beforeRaw` JSON round-trip, which the insert-only cases above never touch.
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const created = await mari.executeAction({
        action: "character.create",
        characterId: "revert-durable",
        data: { name: "Original" },
        apply: true,
      });
      await mari.keepAppliedReview(created.approval?.id ?? "");

      const updated = await mari.executeAction({
        action: "character.update",
        characterId: "revert-durable",
        data: { name: "Changed" },
        apply: true,
      });
      const reviewId = updated.approval?.id;
      assert.ok(reviewId, "an update registers a pending review");
      const readName = async (service: MariDbService) =>
        ((await service.executeAction({ action: "character.get", id: "revert-durable" })).output as {
          data?: { name?: string };
        })?.data?.name;
      assert.equal(await readName(mari), "Changed", "the update is applied before the undo");

      const restarted = new MariDbService(db);
      assert.ok(
        restarted.getPendingApprovals().find((approval) => approval.id === reviewId),
        "the update's review rehydrates after a restart",
      );
      await restarted.restoreAppliedReview(reviewId);
      assert.equal(
        await readName(restarted),
        "Original",
        "Restoring an update after a restart reverts to the pre-update row (beforeRaw survived the JSON round-trip)",
      );
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── A sidecar whose id doesn't match its filename, or whose timestamps don't parse, is rejected ──
  // (id-vs-filename binding is a path-traversal guard; unparseable timestamps would poison the sort)
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const pendingDir = join(dir, "journal", "pending");
      mkdirSync(pendingDir, { recursive: true });
      const baseRecord = {
        kind: "applied_review",
        sessionId: "test",
        command: "app_data character.create",
        reason: null,
        operationHash: "hash",
        affectedTables: { characters: 1 },
        affectedRows: 1,
        validationStatus: "passed",
        diffPreview: [],
        diffTruncated: false,
        plan: { changes: [] },
        historyId: null,
        journalPath: null,
      };
      // Forged id (path-traversal attempt): the file is innocent.json but the record claims ../../escape.
      writeFileSync(
        join(pendingDir, "innocent.json"),
        JSON.stringify({
          ...baseRecord,
          id: "../../escape",
          requestedAt: "2999-01-01T00:00:00.000Z",
          expiresAt: "2999-01-02T00:00:00.000Z",
        }),
        "utf8",
      );
      // Unparseable timestamps.
      writeFileSync(
        join(pendingDir, "badtime.json"),
        JSON.stringify({ ...baseRecord, id: "badtime", requestedAt: "not-a-date", expiresAt: "also-bad" }),
        "utf8",
      );
      const mari = new MariDbService(db);
      const pending = mari.getPendingApprovals();
      assert.equal(
        pending.some((approval) => approval.id === "../../escape"),
        false,
        "a sidecar whose id doesn't match its filename is rejected (path-traversal guard)",
      );
      assert.equal(
        pending.some((approval) => approval.id === "badtime"),
        false,
        "a sidecar with unparseable timestamps is rejected",
      );
      assert.ok(!existsSync(join(pendingDir, "innocent.json")), "the mismatched sidecar is pruned");
      assert.ok(!existsSync(join(pendingDir, "badtime.json")), "the bad-timestamp sidecar is pruned");
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── F2: Restoring a stale review whose row a newer write already changed is refused ──
  // A→B (review R1, left pending), then B→C (kept). Restoring R1 would write B over C, so it must
  // abort with outcome "state_changed", leave C in place, and keep R1 pending for a fresh review,
  // instead of the old behavior, which unconditionally clobbered C back to B.
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const readName = async (service: MariDbService) =>
        ((await service.executeAction({ action: "character.get", id: "sc-durable" })).output as {
          data?: { name?: string };
        })?.data?.name;

      const created = await mari.executeAction({
        action: "character.create",
        characterId: "sc-durable",
        data: { name: "Original" },
        apply: true,
      });
      const createdReviewId = created.approval?.id;
      assert.ok(createdReviewId, "the create registers a pending review");
      await mari.keepAppliedReview(createdReviewId);

      // R1: Original → Changed, left PENDING (the stale review we will try to restore).
      const staleUpdate = await mari.executeAction({
        action: "character.update",
        characterId: "sc-durable",
        data: { name: "Changed" },
        apply: true,
      });
      const staleReviewId = staleUpdate.approval?.id;
      assert.ok(staleReviewId, "the first update registers a pending review");

      // A NEWER write diverges the row from what R1 applied: Changed → Newer, kept.
      const newerUpdate = await mari.executeAction({
        action: "character.update",
        characterId: "sc-durable",
        data: { name: "Newer" },
        apply: true,
      });
      const newerReviewId = newerUpdate.approval?.id;
      assert.ok(newerReviewId, "the newer update registers a pending review");
      await mari.keepAppliedReview(newerReviewId);
      assert.equal(await readName(mari), "Newer", "the newer write is the live state before the stale Restore");

      const outcome = await mari.restoreAppliedReview(staleReviewId);
      assert.ok(
        outcome && "outcome" in outcome && outcome.outcome === "state_changed",
        "Restoring a superseded review reports state_changed instead of clobbering",
      );
      assert.equal(await readName(mari), "Newer", "the newer write is left untouched (the stale Restore did not clobber it)");
      assert.ok(
        mari.getPendingApprovals().some((approval) => approval.id === staleReviewId),
        "a refused (state_changed) Restore leaves its pending review in place for a fresh review",
      );
      assert.ok(existsSync(sidecarPath(dir, staleReviewId)), "a refused Restore keeps the pending sidecar on disk");
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── Sidecar retirement failure leaves Keep pending and restart-durable ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const created = await mari.executeAction({
        action: "character.create",
        characterId: "retire-failure",
        data: { name: "Retire failure" },
        apply: true,
      });
      const reviewId = created.approval?.id;
      assert.ok(reviewId);
      await withRenameFailure(sidecarPath(dir, reviewId), async () => {
        await assert.rejects(mari.keepAppliedReview(reviewId), (error: unknown) => (error as NodeJS.ErrnoException).code === "EBUSY");
      });
      assert.ok(mari.getPendingApprovals().some((approval) => approval.id === reviewId), "failed Keep stays pending");
      assert.ok(
        new MariDbService(db).getPendingApprovals().some((approval) => approval.id === reviewId),
        "failed Keep survives restart",
      );
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── Failed partial-review replacement cannot resurrect its obsolete full plan ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const created = await mari.executeAction({
        action: "lorebook.create",
        lorebookId: "write-failure",
        data: {
          name: "Write failure",
          entries: [
            { name: "Reject", content: "a" },
            { name: "Keep", content: "b" },
          ],
        },
        apply: true,
      });
      const reviewId = created.approval?.id;
      assert.ok(reviewId);
      const approval = mari.getPendingApprovals().find((candidate) => candidate.id === reviewId);
      const index =
        approval?.diffPreview.findIndex(
          (change) => change.table === "lorebook_entries" && change.after?.name === "Reject",
        ) ?? -1;
      assert.ok(approval && index >= 0);
      const change = approval.diffPreview[index]!;
      const tempPath = `${sidecarPath(dir, reviewId)}.${process.pid}.tmp`;
      mkdirSync(tempPath);
      await assert.rejects(
        mari.rejectRows(reviewId, [{ index, table: change.table, id: change.id, action: change.action }]),
        /remaining review could not be saved safely/iu,
      );
      rmSync(tempPath, { recursive: true, force: true });
      assert.ok(!existsSync(sidecarPath(dir, reviewId)), "obsolete sidecar is not hydratable");
      assert.ok(
        !new MariDbService(db).getPendingApprovals().some((candidate) => candidate.id === reviewId),
        "obsolete review stays gone after restart",
      );
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── apply:false cascade snapshots cannot overwrite a newer same-id child on Restore ──
  {
    const dir = tempStorageDir();
    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const created = await mari.executeAction({
        action: "lorebook.create",
        lorebookId: "cascade-supersede",
        data: { name: "Cascade", entries: [{ name: "Original", content: "old" }] },
        apply: true,
      });
      await mari.keepAppliedReview(created.approval?.id ?? "");
      const child = (
        (await mari.executeAction({ action: "lorebook.entries", lorebookId: "cascade-supersede" })).output as Array<{
          id: string;
        }>
      )[0]!;
      const deleted = await mari.executeCli({ argv: ["lorebooks", "delete", "cascade-supersede", "--cascade", "--apply"] });
      const reviewId = deleted.approval?.id;
      assert.ok(reviewId);
      const timestamp = new Date().toISOString();
      await db.insert(lorebookEntries).values({
        id: child.id,
        lorebookId: "cascade-supersede",
        name: "Newer",
        content: "new",
        keys: "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const outcome = await mari.restoreAppliedReview(reviewId);
      assert.ok(outcome && "outcome" in outcome && outcome.outcome === "state_changed", "cascade supersede is refused");
      assert.equal(
        (await db.select().from(lorebookEntries).where(eq(lorebookEntries.id, child.id)))[0]?.content,
        "new",
        "newer child survives",
      );
    } finally {
      await db._fileStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}

console.log("Mari review durability regressions passed.");
