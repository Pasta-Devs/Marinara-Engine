// #6842: Professor Mari's Keep/Restore cards piled up in every chat and some could not be
// cleared. Drives the real MariDbService against a file-native store and asserts that:
//   - (slice 71 F3) a sensitive file or install review belongs to its chat too, and the status filters it,
//   - (slice 71 F1) a delete waits on the user like an install or a file; an applied edit does not,
//   - (slice 71 N3) a held change is saved as what it would change, and read back in plain words,
//   - Mari's own built-in card cannot be edited or deleted, by action or raw db command,
//   - a write that changes nothing is not applied and makes no card,
//   - a card belongs to the chat that made it, and deleting that chat keeps its reviews,
//   - a refused Restore tells the user Keep dismisses the card,
//   - a failed Keep reports why instead of a bare "Internal Server Error".
import assert from "node:assert/strict";
import fs, { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFESSOR_MARI_ID } from "../../../packages/shared/src/index.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { seedProfessorMari } from "../../../packages/server/src/db/seed-mari.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import {
  isMariReviewVisibleInChat,
  mariWorkspaceSessionId,
} from "../../../packages/server/src/services/professor-mari/mari-session.js";
import { reviewActionFailure } from "../../../packages/server/src/routes/professor-mari-workspace.routes.js";
import { WorkspaceChangeReviewService } from "../../../packages/server/src/services/professor-mari/workspace-change-review.service.js";
import { describeHeldCommands } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  countBlockingReviews,
  describeMariHeldChanges,
  isMariReviewWaiting,
} from "../../../packages/client/src/lib/professor-mari-presentation.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-review-cards-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();

const source = (path: string) => readFileSync(new URL(`../../../packages/server/src/${path}`, import.meta.url), "utf8");

try {
  await seedProfessorMari(db);
  const mari = new MariDbService(db);
  const pendingIds = () => new Set(mari.getPendingApprovals().map((review) => review.id));
  const character = async (id: string) =>
    (await mari.executeAction({ action: "character.get", id })).output as Record<string, unknown> | undefined;

  // ── Mari's own built-in card is off limits, by action and by raw db command ──
  {
    const before = JSON.stringify(await character(PROFESSOR_MARI_ID));
    const viaAction = await mari.executeAction({
      action: "character.update",
      characterId: PROFESSOR_MARI_ID,
      patch: { description: "Rewritten." },
      apply: true,
    });
    assert.equal(viaAction.ok, false, "character.update refuses Mari's own card");
    assert.ok(
      viaAction.validation?.errors.some((issue) => /built-in card is managed by Marinara/u.test(issue.message)),
      "and says why",
    );
    const viaRaw = await mari.executeCli({
      argv: ["db", "patch", "characters", PROFESSOR_MARI_ID, "--json", JSON.stringify({ comment: "raw" }), "--apply"],
    });
    assert.equal(viaRaw.ok, false, "a raw db patch of Mari's card is refused too");
    const viaDelete = await mari.executeCli({ argv: ["db", "delete", "characters", PROFESSOR_MARI_ID, "--apply"] });
    assert.equal(viaDelete.ok, false, "and so is deleting it");
    assert.equal(JSON.stringify(await character(PROFESSOR_MARI_ID)), before, "the card is untouched");
    assert.equal(mari.getPendingApprovals().length, 0, "and no card was made");
  }

  // ── A write that changes nothing is not applied and makes no card ──
  {
    const created = await mari.executeAction({
      action: "character.create",
      characterId: "plain-character",
      data: { name: "Plain Character", description: "Quiet." },
      apply: true,
    });
    assert.equal(created.approval?.status, "pending");
    await mari.keepAppliedReview(created.approval!.id!);
    const stampBefore = (await character("plain-character"))?.updatedAt;

    const same = await mari.executeAction({
      action: "character.update",
      characterId: "plain-character",
      patch: { name: "Plain Character" },
      apply: true,
    });
    assert.equal(same.ok, true, "an unchanged update is not an error");
    assert.equal(same.approval?.status, "not_required", "and needs no review");
    assert.match(String(same.output), /^No changes/u, "Mari is told nothing changed");
    assert.equal(mari.getPendingApprovals().length, 0, "no empty card");
    assert.equal((await character("plain-character"))?.updatedAt, stampBefore, "nothing was written");

    const rawSame = await mari.executeCli({
      argv: ["db", "patch", "characters", "plain-character", "--json", JSON.stringify({ comment: "" }), "--apply"],
    });
    assert.equal(rawSame.approval?.status, "not_required", "an unchanged raw patch makes no card either");

    // Positive control: a real change still gets its card.
    const changed = await mari.executeAction({
      action: "character.update",
      characterId: "plain-character",
      patch: { description: "Louder." },
      apply: true,
    });
    assert.equal(changed.approval?.status, "pending", "a real change still makes a card");
    await mari.keepAppliedReview(changed.approval!.id!);
  }

  // ── Cards belong to the chat that made them; deleting it keeps them ──
  {
    const make = async (id: string, sessionId: string) => {
      const result = await mari.executeAction({
        action: "character.create",
        characterId: id,
        data: { name: id },
        apply: true,
        sessionId,
      });
      assert.equal(result.approval?.status, "pending");
      return result.approval!.id!;
    };
    const inA = await make("made-in-a", mariWorkspaceSessionId("chat-a"));
    const inB = await make("made-in-b", mariWorkspaceSessionId("chat-b"));
    const fromCli = await make("made-in-cli", "cli:1234");
    const visibleIn = (chatId: string) =>
      new Set(
        mari
          .getPendingApprovals()
          .filter((review) => isMariReviewVisibleInChat(review.sessionId, chatId))
          .map((review) => review.id),
      );
    assert.deepEqual(visibleIn("chat-a"), new Set([inA, fromCli]), "chat A shows its card and the CLI one");
    assert.deepEqual(visibleIn("chat-b"), new Set([inB, fromCli]), "chat B shows its card and the CLI one");
    assert.deepEqual(visibleIn("chat-new"), new Set([fromCli]), "a new chat starts without other chats' cards");

    assert.equal(await mari.keepReviewsForChat("chat-a"), 1, "deleting chat A keeps its one review");
    assert.deepEqual(pendingIds(), new Set([inB, fromCli]), "only chat A's card went");
    assert.ok(await character("made-in-a"), "and its change stays applied");
    assert.equal(
      (await mari.getHistory()).find((entry) => entry.status === "kept" && entry.command.includes("made-in-a"))?.status,
      "kept",
      "recorded as kept",
    );
    await mari.keepAppliedReview(inB);
    await mari.keepAppliedReview(fromCli);
  }

  // ── A refused Restore says Keep dismisses the card ──
  {
    const created = await mari.executeAction({
      action: "character.create",
      characterId: "edited-later",
      data: { name: "Edited Later" },
      apply: true,
    });
    const reviewId = created.approval!.id!;
    // A newer edit lands after Mari's change, outside the review (the user's editor).
    const { characters } = await import("../../../packages/server/src/db/schema/characters.js");
    const { eq } = await import("../../../packages/server/src/db/file-query.js");
    await db.update(characters).set({ comment: "edited by the user" }).where(eq(characters.id, "edited-later"));
    const refused = await mari.restoreAppliedReview(reviewId);
    assert.ok(refused && "outcome" in refused && refused.outcome === "state_changed", "Restore is refused");
    assert.match(refused.error, /Press Keep to dismiss this card/u, "and points at Keep");
    assert.ok(pendingIds().has(reviewId), "the card stays until the user chooses");
    assert.ok(await mari.keepAppliedReview(reviewId), "Keep dismisses it");
    assert.equal(pendingIds().has(reviewId), false);
  }

  // ── A failed Keep reports why ──
  {
    const created = await mari.executeAction({
      action: "character.create",
      characterId: "locked-review",
      data: { name: "Locked Review" },
      apply: true,
    });
    const reviewId = created.approval!.id!;
    const sidecar = join(dir, "journal", "pending", `${reviewId}.json`);
    const originalRenameSync = fs.renameSync;
    fs.renameSync = ((from, to) => {
      if (from === sidecar)
        throw Object.assign(new Error(`EACCES: permission denied, rename '${sidecar}'`), { code: "EACCES" });
      return originalRenameSync(from, to);
    }) as typeof fs.renameSync;
    syncBuiltinESMExports();
    let failure: unknown;
    try {
      await mari.keepAppliedReviewAndWait(reviewId);
    } catch (err) {
      failure = err;
    } finally {
      fs.renameSync = originalRenameSync;
      syncBuiltinESMExports();
    }
    assert.ok(failure, "Keep fails closed when the review file cannot be retired");
    assert.ok(pendingIds().has(reviewId), "the card stays");
    const message = reviewActionFailure(failure, "keep");
    assert.match(message, /EACCES/u);
    assert.match(message, /data folder/u, "the user is told where to look");
    assert.doesNotMatch(message, /Internal Server Error/u);
    await mari.keepAppliedReview(reviewId);
  }

  // ── Reviews of Mari's own card saved before the fix are retired on load ──
  {
    // Such a review can no longer be made, so build one from an ordinary review's file,
    // the way an install that ran the old build has them on disk.
    const ordinary = await mari.executeAction({
      action: "character.create",
      characterId: "older-review",
      data: { name: "Older Review" },
      apply: true,
    });
    const ordinaryId = ordinary.approval!.id!;
    const pendingDir = join(dir, "journal", "pending");
    const record = JSON.parse(readFileSync(join(pendingDir, `${ordinaryId}.json`), "utf8")) as {
      id: string;
      sessionId: string;
      plan: { changes: Array<{ table: string; id: string }> };
    };
    const legacyId = "legacyMariCardReview";
    record.id = legacyId;
    record.sessionId = "professor-mari-workspace";
    for (const change of record.plan.changes) {
      change.table = "characters";
      change.id = PROFESSOR_MARI_ID;
    }
    writeFileSync(join(pendingDir, `${legacyId}.json`), JSON.stringify(record));

    const restarted = new MariDbService(db);
    const loadedIds = new Set(restarted.getPendingApprovals().map((review) => review.id));
    assert.equal(loadedIds.has(legacyId), false, "an old review of Mari's own card is retired on load");
    assert.equal(existsSync(join(pendingDir, `${legacyId}.json`)), false, "its file is gone");
    assert.ok(loadedIds.has(ordinaryId), "an ordinary review is still there to Keep or Restore");
    await restarted.keepAppliedReview(ordinaryId);
  }

  // ── Slice 71 F3: a file or install review stays in the chat that made it ──
  {
    const workspace = mkdtempSync(join(tmpdir(), "marinara-mari-review-file-"));
    try {
      writeFileSync(join(workspace, "package.json"), '{ "name": "scratch" }\n');
      const reviews = new WorkspaceChangeReviewService(workspace);
      const staged = await reviews.stageSensitiveFileChange({
        absolutePath: join(workspace, "package.json"),
        afterContent: '{ "name": "scratch", "scripts": { "start": "node index.js" } }\n',
        reason: null,
        sessionId: mariWorkspaceSessionId("chat-a"),
      });
      const fileVisibleIn = (chatId: string) =>
        [...mari.getPendingApprovals(), ...reviews.getPendingApprovals()]
          .filter((review) => isMariReviewVisibleInChat(review.sessionId, chatId))
          .some((review) => review.id === staged.id);
      assert.equal(fileVisibleIn("chat-a"), true, "the file review shows in the chat that made it");
      assert.equal(fileVisibleIn("chat-new"), false, "and not in a new chat");
      reviews.clear();
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }

  // ── Slice 71 F1: what waits on the user ──
  {
    const row = (action: string, table = "lorebook_entries") => ({ table, id: `${table}-1`, action });
    const deleteReview = { kind: "applied_review", affectedRows: 2, diffPreview: [row("delete"), row("delete")] };
    const editReview = { kind: "applied_review", affectedRows: 1, diffPreview: [row("update", "characters")] };
    assert.equal(isMariReviewWaiting(deleteReview), true, "a delete waits: its rows stay hidden until you choose");
    assert.equal(isMariReviewWaiting(editReview), false, "an applied edit only offers Undo");
    assert.equal(isMariReviewWaiting({ kind: "sensitive_file" }), true, "a file review waits");
    assert.equal(countBlockingReviews([deleteReview, editReview, { kind: "dependency_install" }]), 2);
    const mariChat = readFileSync(
      new URL("../../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
      "utf8",
    );
    assert.match(
      mariChat,
      /const waiting = entries\.filter\(\(\{ approval, outcome \}\) => !outcome && isMariReviewWaiting\(approval\)\);/u,
      "the turn files a waiting delete under Needs you, not Changed",
    );
  }

  // ── Slice 71 N3: a held change in plain words ──
  {
    const held = describeHeldCommands([
      {
        id: "c1",
        name: "app_data",
        arguments: {
          action: "character.update",
          characterId: "shrek",
          patch: { description: "An ogre.", personality: "Blunt.", first_mes: "What broke?" },
          apply: true,
        },
      },
    ]);
    assert.deepEqual(
      held[0]?.fields?.map(({ key }) => key),
      ["description", "personality", "first_mes"],
    );
    const said = describeMariHeldChanges(held, (id) => (id === "shrek" ? "Shrek" : undefined));
    assert.deepEqual([said.kind, said.name, said.count], ["update", "Shrek", 3], "Rewrite 3 fields of Shrek");
    const many = describeHeldCommands([
      { id: "d1", name: "app_data", arguments: { action: "lorebook.deleteEntry", entryId: "e1" } },
      { id: "w1", name: "write", arguments: { path: "/work/package.json", content: "{}" } },
    ]);
    assert.equal(many[1]?.name, "package.json", "a file command is named by its file");
    assert.equal(describeMariHeldChanges(many, () => undefined).kind, "many");
    assert.equal(describeMariHeldChanges(null, () => undefined).kind, "change", "an old turn still gets a card");
  }

  // ── Wiring: Mari's commands name their chat, status filters, deletion keeps ──
  {
    const agent = source("services/professor-mari/workspace-agent.service.ts");
    assert.equal(
      (agent.match(/sessionId: this\.runSessionId\(\)/gu) ?? []).length,
      6,
      "executeCli, executeAction and (slice 71 F3) every file and install review carry the run's chat",
    );
    assert.doesNotMatch(agent, /sessionId: SESSION_ID/u, "no review is staged without its chat");
    assert.match(agent, /env\.MARI_WORKSPACE_SESSION_ID = this\.runSessionId\(\);/u, "so does Mari's shell");
    assert.match(
      agent,
      /\.\.\.this\.workspaceChangeReviews\.getPendingApprovals\(\),\s*\]\.filter\(\(approval\) => isMariReviewVisibleInChat\(approval\.sessionId, chatId\)\)/u,
      "the status filters file and install reviews by chat too",
    );
    assert.match(
      agent,
      /if \(runEndedWithDeferral && runHeldChanges\.length > 0\) extraUpdate\.mariHeldChanges = runHeldChanges;/u,
      "a held change is saved on her turn for the card",
    );
    const chats = source("routes/chats.routes.ts");
    const deleteRoute = chats.slice(
      chats.indexOf('app.delete<{ Params: { id: string } }>("/internal/professor-mari/chats/:id"'),
    );
    assert.match(
      deleteRoute.slice(0, deleteRoute.indexOf("return reply.status(204)")),
      /keepReviewsForChat\(target\.id\)/u,
      "deleting a Mari chat keeps its reviews",
    );
    const routes = source("routes/professor-mari-workspace.routes.ts");
    assert.equal(
      (routes.match(/reviewActionFailure\(err, "(?:keep|restore)"\)/gu) ?? []).length,
      2,
      "Keep and Restore both report failures",
    );
  }
} finally {
  await db._fileStore.close();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("mari review-cards regression passed");
