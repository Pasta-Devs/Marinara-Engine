// #5599/#5600: message edit/delete concurrency.
//   - #5599: removeMessage/removeMessages were the only per-message mutations
//     NOT serialized on the per-message patch queue, so a delete could land
//     inside an in-flight edit's await gaps and silently drop the edit into a
//     404. Pinned here by holding the queue and proving a delete now waits.
//   - #5600: the edit wrote the messages row and its active-swipe mirror with
//     awaited gaps between them and no transaction, so a flush (or crash) in
//     the window persisted the edit on the message while the swipe kept the
//     pre-edit text — surfacing in exports and branches. Pinned here by
//     flushing mid-edit and reading the shard files: the store defers flushes
//     while a transaction is active, so the flush must now produce a
//     consistent pair on disk.
//
// Project imports are DYNAMIC, after the env assignments (see the gallery
// suites for why).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.MARINARA_EAGER_STORAGE === "1" || process.env.MARINARA_EAGER_STORAGE === "true") {
  // The queue and transaction semantics under test are storage-mode
  // independent, but the shard-file assertions below read the lazy layout.
  console.log("Message edit/delete race regressions skipped: MARINARA_EAGER_STORAGE is set.");
  process.exit(0);
}

const dataDir = mkdtempSync(join(tmpdir(), "marinara-edit-delete-races-"));
const storeDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storeDir;

const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage, withMessageExtraPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");

const chatRow = (id: string) => ({ id, name: id, mode: "conversation" });
const messageRow = (id: string, chatId: string, content: string) => ({
  id,
  chatId,
  role: "assistant",
  content,
  activeSwipeIndex: 0,
  createdAt: `2026-08-28T10:00:00.000Z`,
});
const swipeRow = (id: string, messageId: string, content: string) => ({ id, messageId, index: 0, content });

const shardPath = (table: string, key: string) => join(storeDir, "tables", table, `${encodeShardKey(key)}.json`);
const writeShard = (table: string, key: string, rows: unknown[]) => {
  mkdirSync(join(storeDir, "tables", table), { recursive: true });
  writeFileSync(shardPath(table, key), JSON.stringify(rows));
};

writeShard("chats", "c1", [chatRow("c1")]);
writeShard("messages", "c1", [
  messageRow("m-hold", "c1", "hold me"),
  messageRow("m-bulk", "c1", "bulk me"),
  messageRow("m-race", "c1", "race me"),
  messageRow("m-tear", "c1", "old text"),
]);
writeShard("message_swipes", "c1", [swipeRow("s-race", "m-race", "race me"), swipeRow("s-tear", "m-tear", "old text")]);

const db = await createFileNativeDB();
const storage = createChatsStorage(db);
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  // Warm-up: load the chat unit before any timed block, so the sleeps below
  // budget for in-memory work only, never the first lazy shard load.
  await storage.getMessage("m-hold");

  // ── #5599: a delete waits for the per-message queue ──
  {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = withMessageExtraPatchQueue("m-hold", () => hold);
    const deletion = storage.removeMessage("m-hold");
    await settle(150);
    assert.notEqual(
      await storage.getMessage("m-hold"),
      null,
      "removeMessage waits for the message's patch queue instead of racing past an in-flight mutation",
    );
    release();
    await held;
    await deletion;
    assert.equal(await storage.getMessage("m-hold"), null, "the queued delete completes once the queue frees");
  }

  // ── #5599: the bulk delete waits for every affected message's queue ──
  {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = withMessageExtraPatchQueue("m-bulk", () => hold);
    const deletion = storage.removeMessages(["m-bulk"], "c1");
    await settle(150);
    assert.notEqual(
      await storage.getMessage("m-bulk"),
      null,
      "removeMessages waits for each affected message's patch queue",
    );
    release();
    await held;
    await deletion;
    assert.equal(await storage.getMessage("m-bulk"), null, "the queued bulk delete completes once the queue frees");
  }

  // ── #5599: a delete landing mid-edit no longer nulls the edit out ──
  // Deterministic injection: the edit's SECOND getMessage call (its post-write
  // re-read) fires the delete and gives it time to run. Pre-fix the delete is
  // unqueued, completes inside the gap, and the edit's re-read returns null —
  // the silent-404 symptom. Post-fix the delete waits on the queue, the edit
  // completes with its result, and the delete lands after.
  {
    const originalGetMessage = storage.getMessage.bind(storage);
    let editReads = 0;
    let injectedDeletion: Promise<void> | null = null;
    storage.getMessage = (async (id: string) => {
      if (id === "m-race") {
        editReads += 1;
        if (editReads === 2) {
          storage.getMessage = originalGetMessage;
          injectedDeletion = storage.removeMessage("m-race");
          await settle(200);
        }
      }
      return originalGetMessage(id);
    }) as typeof storage.getMessage;
    const edited = await storage.updateMessageContent("m-race", "edited before deletion");
    storage.getMessage = originalGetMessage;
    assert.notEqual(injectedDeletion, null, "the injection point was reached");
    await injectedDeletion;
    assert.equal(
      edited?.content,
      "edited before deletion",
      "an in-flight edit completes with its result instead of a silent null when a delete lands mid-edit",
    );
    assert.equal(await storage.getMessage("m-race"), null, "the delete still lands afterward");
  }

  // ── #5600: a flush initiated mid-edit cannot persist a torn pair ──
  // Deterministic injection: the edit's getSwipes call marks the exact window
  // between the messages-row write and the swipe-mirror write. A flush is
  // fired from the OUTER (non-transaction) context inside that window and
  // given time to finish. Pre-fix it wrote the messages shard while the swipe
  // shard kept the old text — the crash-persisted tear. With the edit inside
  // a transaction, the store parks that flush until commit, so the on-disk
  // pair can never be torn.
  {
    const originalGetSwipes = storage.getSwipes.bind(storage);
    let midEditSnapshot: { messageEdited: boolean; swipeEdited: boolean } | null = null;
    storage.getSwipes = (async (messageId: string) => {
      if (messageId === "m-tear") {
        storage.getSwipes = originalGetSwipes;
        // Escape the ambient transaction context: a flush from inside it
        // returns without writing, which would prove nothing. setImmediate
        // callbacks run outside the AsyncLocalStorage transaction scope only
        // if scheduled from outside — so signal a pre-armed outer waiter.
        armFlush();
        await flushWindowDone;
      }
      return originalGetSwipes(messageId);
    }) as typeof storage.getSwipes;

    let armFlush!: () => void;
    const flushArmed = new Promise<void>((resolve) => {
      armFlush = resolve;
    });
    let finishWindow!: () => void;
    const flushWindowDone = new Promise<void>((resolve) => {
      finishWindow = resolve;
    });
    const outerFlushDriver = (async () => {
      await flushArmed;
      const flushAttempt = db._fileStore.flush();
      // Give a pre-fix flush ample time to write the torn pair to disk; the
      // post-fix flush is parked by the store until the transaction commits.
      await Promise.race([flushAttempt, settle(400)]);
      midEditSnapshot = {
        messageEdited: readFileSync(shardPath("messages", "c1"), "utf8").includes("EDITED TEXT"),
        swipeEdited: readFileSync(shardPath("message_swipes", "c1"), "utf8").includes("EDITED TEXT"),
      };
      finishWindow();
      await flushAttempt;
    })();

    const edited = await storage.updateMessageContent("m-tear", "EDITED TEXT");
    storage.getSwipes = originalGetSwipes;
    await outerFlushDriver;
    assert.notEqual(midEditSnapshot, null, "the mid-edit flush window was exercised");
    const snapshot = midEditSnapshot!;
    assert.equal(
      snapshot.messageEdited && !snapshot.swipeEdited,
      false,
      `a mid-edit flush must not persist the edit on the message while the swipe keeps the old text ` +
        `(message edited: ${snapshot.messageEdited}, swipe edited: ${snapshot.swipeEdited})`,
    );
    assert.equal(edited?.content, "EDITED TEXT", "the edit completes normally");
    await db._fileStore.flush();
    assert.equal(
      readFileSync(shardPath("message_swipes", "c1"), "utf8").includes("EDITED TEXT"),
      true,
      "the swipe mirror carries the edit after the final flush",
    );
  }
} finally {
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Message edit/delete race regressions passed.");
