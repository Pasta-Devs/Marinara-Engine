// #5631: a transaction's opening gate must close atomically.
//   transaction() takes its queue slot, then AWAITS the previous transaction
//   and any in-flight flush before incrementing activeTransactionCount. A
//   plain write that passed waitForWritableTurn inside that window (count
//   still 0) could apply AFTER the transaction's first-mutation table
//   snapshot — and a rollback then restored the snapshot, silently erasing
//   the write its caller had already seen succeed. Worse, when the write
//   targeted a lazily-loaded unit, the load's rows were erased too while the
//   unit stayed marked loaded, making persisted rows invisible in memory.
//
//   The write's post-gate body is fully synchronous (lazy unit loads read
//   shard files synchronously), so the real-world hazard is the scheduler
//   placing the gate-resume microtask after the transaction's snapshot — a
//   one-tick window no natural staging hits reliably. Pinned here with the
//   hook technique: waitForWritableTurn is wrapped so the ONE raced insert
//   (never transaction-context calls) takes a test-held pause between
//   gate-pass and apply. The unfixed gate passes while the transaction is
//   still in its opening awaits, so the paused apply lands after the
//   snapshot and vanishes on rollback; the fixed gate parks INSIDE the real
//   wait until the transaction fully finishes, so the pause is moot and the
//   write survives.
//
// Project imports are DYNAMIC, after the env assignments (see the gallery
// suites for why).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.MARINARA_EAGER_STORAGE === "1" || process.env.MARINARA_EAGER_STORAGE === "true") {
  // The lazy-unit erasure half of the pin has no meaning under eager storage.
  console.log("Transaction gate-window regression skipped: MARINARA_EAGER_STORAGE is set.");
  process.exit(0);
}

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tx-gate-window-"));
const storeDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storeDir;

const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { messages } = await import("../../packages/server/src/db/schema/index.js");

const chatRow = (id: string) => ({ id, name: id, mode: "conversation" });
const messageRow = (id: string, chatId: string, content: string) => ({
  id,
  chatId,
  role: "assistant",
  content,
  activeSwipeIndex: 0,
  createdAt: `2026-08-28T10:00:00.000Z`,
});

const shardPath = (table: string, key: string) => join(storeDir, "tables", table, `${encodeShardKey(key)}.json`);
const writeShard = (table: string, key: string, rows: unknown[]) => {
  mkdirSync(join(storeDir, "tables", table), { recursive: true });
  writeFileSync(shardPath(table, key), JSON.stringify(rows));
};

// c1 stays NON-resident (never touched before the race); c2 is warmed below.
writeShard("chats", "c1", [chatRow("c1")]);
writeShard("messages", "c1", [messageRow("m1", "c1", "persisted before the race")]);
writeShard("chats", "c2", [chatRow("c2")]);
writeShard("messages", "c2", [messageRow("m2", "c2", "pre-transaction text")]);

let releaseA!: () => void;
const aGate = new Promise<void>((resolve) => {
  releaseA = resolve;
});
let releaseB!: () => void;
const bGate = new Promise<void>((resolve) => {
  releaseB = resolve;
});
let releaseApplyPause!: () => void;
const applyPause = new Promise<void>((resolve) => {
  releaseApplyPause = resolve;
});
let applyPauseArmed = false;
let applyPauseTaken = false;

// The injected pause between gate-pass and apply — the scheduling freedom the
// one-tick hazard window exposes, made deterministic. The hook only fires for
// plain writes; transaction-context writes never reach it.
const db = await createFileNativeDB({
  afterWritableTurn: async () => {
    if (!applyPauseArmed) return;
    applyPauseArmed = false;
    applyPauseTaken = true;
    await applyPause;
  },
});
const storage = createChatsStorage(db);
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let insertError: unknown = null;
try {
  // Warm c2 only: B's in-transaction mutation must be synchronous (resident
  // unit) so its first-mutation snapshot lands before the paused apply.
  await storage.getMessage("m2");

  // A occupies the transaction queue so B parks in its opening awaits — the
  // exact reservation window under test.
  const txA = db.transaction(async () => {
    await aGate;
  });
  await settle(30);

  const forced = new Error("forced rollback (#5631)");
  const txB = db
    .transaction(async () => {
      await db.update(messages).set({ content: "uncommitted tx edit" }).where(eq(messages.id, "m2"));
      await bGate;
      throw forced;
    })
    .catch((error: unknown) => error);
  await settle(30);

  // The raced plain write, fired while B sits in its opening awaits. The
  // unfixed gate sees only A (active) and returns the moment A finishes; the
  // fixed gate also sees B's reservation and parks until B fully finishes.
  applyPauseArmed = true;
  let insertSettled = false;
  const pInsert = (async () => {
    await db.insert(messages).values(messageRow("p-new", "c1", "raced insert"));
  })();
  void pInsert.then(
    () => {
      insertSettled = true;
    },
    (error: unknown) => {
      insertError = error;
    },
  );
  await settle(30);

  releaseA();
  await txA;
  // Let B activate and take its first-mutation snapshot.
  await settle(60);

  // Release the paused apply. Pre-fix it lands here — after B's snapshot,
  // inside the open transaction. Post-fix the insert is still parked inside
  // the real gate, so this release is consumed only after B finishes.
  releaseApplyPause();
  await settle(60);
  const insertAppliedDuringTransaction = insertSettled;

  releaseB();
  const txBResult = await txB;
  assert.equal(txBResult, forced, "transaction B rejects with its forced error");
  await pInsert;
  assert.equal(insertError, null, "the raced insert itself never errors");

  assert.equal(
    insertAppliedDuringTransaction,
    false,
    "a plain write racing the transaction's opening gate must wait for the transaction instead of applying inside it",
  );

  const raced = await storage.getMessage("p-new");
  assert.equal(raced?.content, "raced insert", "the raced insert survives the rollback");

  const persisted = await storage.getMessage("m1");
  assert.equal(
    persisted?.content,
    "persisted before the race",
    "the lazily-loaded unit's persisted rows survive the rollback (marked-loaded rows must not be erased)",
  );

  const rolledBack = await storage.getMessage("m2");
  assert.equal(rolledBack?.content, "pre-transaction text", "the transaction's own mutation rolled back");

  // Anti-vacuity: the staged pause must actually have engaged, or the pin
  // proved nothing about the apply's placement.
  assert.equal(applyPauseTaken, true, "the raced insert took the staged gate-to-apply pause");
} finally {
  // Never leave a gate parked: an assertion mid-block must not wedge the
  // store's close (which waits out the transaction queue) or the runner.
  releaseA();
  releaseB();
  releaseApplyPause();
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Transaction gate-window regression passed.");
