// #5651 + #5652: two residual transaction-isolation gaps behind the #5631 gate.
//
// #5651 - reads never take the write gate: a CONCURRENT request's read can
//   lazily load a cold unit into memory mid-transaction. The load runs outside
//   the transaction's AsyncLocalStorage context, so the snapshot mirror in
//   mergeLoadedRows never saw it - the loaded rows landed in the live table
//   AFTER the transaction's first-mutation snapshot, and a rollback restored
//   the snapshot, erasing persisted rows while loadedUnits still said the unit
//   was resident. The rows stayed invisible until restart. The fix mirrors
//   load effects into the ACTIVE transaction's context regardless of the
//   loader's own context (the queue admits at most one transaction).
//
// #5652 - transaction()'s opening flush wait was check-once. Two flushes can
//   park on the same activeFlush with the second subscribed first: when it
//   resolves, that flush's recursion re-enters, sees no active transaction,
//   captures the dirty set, and installs a NEW activeFlush - and the
//   transaction's continuation then sailed past its consumed check, running
//   its callback concurrently with the fresh flush's I/O. saveFileSnapshots
//   reads live tables, so uncommitted rows could be persisted with no dirty
//   mark left after rollback. The fix loops the wait.
//
// Part 3 - the #5651 mirror refilled the snapshot with push(...mirrored): a
//   spread passes every row as a call argument, which overflows the call
//   stack past ~100k rows - and the throw landed AFTER the length = 0
//   truncation, leaving an EMPTY rollback snapshot that rollback then
//   installed as the live messages table. The fix builds the merged array
//   first and refills with a loop.
//
// Part 4 - flush()'s wait on active transactions was ALSO check-once (the
//   mirror image of #5652). A transaction queued behind the one the flush is
//   waiting out resumes on a one-hop microtask chain; the flush's wake from
//   waitForTransactions is two-hop, so the queued transaction activates
//   first. While the store is open the pendingTransactionFlush handoff
//   rescues that ordering, but the handoff is skipped once writesClosed - so
//   during shutdown the woken flush ran saveFileSnapshots concurrently with
//   the freshly activated transaction's callback and persisted uncommitted
//   rows whose dirty marks the rollback erased. The fix loops that wait too.
//
// Project imports are DYNAMIC, after the env assignments (see tx-gate-window).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.MARINARA_EAGER_STORAGE === "1" || process.env.MARINARA_EAGER_STORAGE === "true") {
  // The lazy-load half of the pin has no meaning under eager storage.
  console.log("Store transaction-isolation regression skipped: MARINARA_EAGER_STORAGE is set.");
  process.exit(0);
}

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tx-isolation-"));
const storeDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storeDir;

const { createFileNativeDB, encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { chats: chatsTable, messages } = await import("../../packages/server/src/db/schema/index.js");

const chatRow = (id: string) => ({ id, name: id, mode: "conversation" });
const messageRow = (id: string, chatId: string, content: string) => ({
  id,
  chatId,
  role: "assistant",
  content,
  activeSwipeIndex: 0,
  createdAt: `2026-08-30T10:00:00.000Z`,
});

const writeShard = (table: string, key: string, rows: unknown[]) => {
  mkdirSync(join(storeDir, "tables", table), { recursive: true });
  writeFileSync(join(storeDir, "tables", table, `${encodeShardKey(key)}.json`), JSON.stringify(rows));
};

// cold stays NON-resident until the mid-transaction read; warm is loaded early.
writeShard("chats", "cold", [chatRow("cold")]);
writeShard("messages", "cold", [messageRow("m-cold", "cold", "persisted before the transaction")]);
writeShard("chats", "warm", [chatRow("warm")]);
writeShard("messages", "warm", [messageRow("m-warm", "warm", "pre-transaction text")]);

// A six-figure unit for Part 3: big enough that a spread refill of the
// snapshot mirror is guaranteed to overflow the call stack (Node's argument
// limit sits near ~120k at shallow depth and falls with stack depth).
const BIG_ROW_COUNT = 200_000;
writeShard("chats", "big", [chatRow("big")]);
writeShard(
  "messages",
  "big",
  Array.from({ length: BIG_ROW_COUNT }, (_, i) => messageRow(`m-big-${i}`, "big", `big row ${i}`)),
);

// One-shot flush hold, armed per flush: the first table write of the armed
// flush parks until released (firing its taken-signal on the way in, so the
// staging can PROVE the flush reached its mid-write hold instead of sleeping
// and hoping). Later writes of the same flush pass through. The hook also
// watches for Part 4's forbidden overlap: a flush table write landing while
// the close-path transaction's callback is still mid-flight.
let pendingFlushHold: { hold: Promise<void>; taken: () => void } | null = null;
let flushHoldsTaken = 0;
let closeTxActive = false;
let closeOverlapDetected = false;
const db = await createFileNativeDB({
  beforeTableWrite: async () => {
    if (closeTxActive) closeOverlapDetected = true;
    const pending = pendingFlushHold;
    pendingFlushHold = null;
    if (pending) {
      flushHoldsTaken += 1;
      pending.taken();
      await pending.hold;
    }
  },
});
const storage = createChatsStorage(db);
const store = db._fileStore;
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Every staged gate registers its release here: the finally fires them all
// before close(), so a mid-part assertion or thrown defect surfaces as ITS
// OWN error instead of deadlocking close() behind a still-parked gate and
// dying as an opaque unsettled-top-level-await exit.
const gateReleases: Array<() => void> = [];

// A staged lifecycle signal: the staged code fires it at a known point, and
// the main flow awaits it with a loud deadline - staging is proven, never
// assumed from a sleep. An unfired signal fails as its own named error
// instead of letting a mis-staged run pass (or hang).
const signal = (what: string) => {
  let fire!: () => void;
  const fired = new Promise<void>((resolve) => {
    fire = resolve;
  });
  gateReleases.push(fire);
  const wait = async () => {
    let timer!: NodeJS.Timeout;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`staging signal never arrived: ${what}`)), 5000);
    });
    try {
      await Promise.race([fired, deadline]);
    } finally {
      clearTimeout(timer);
    }
  };
  return { fire, wait };
};

try {
  // ══ Part 1 (#5651): a rollback must not erase concurrently loaded rows ══
  await storage.getMessage("m-warm"); // warm unit resident before the race

  let releaseTx!: () => void;
  const txGate = new Promise<void>((resolve) => {
    releaseTx = resolve;
  });
  gateReleases.push(releaseTx);
  const forced = new Error("forced rollback (#5651)");
  const tx1Snapshot = signal("Part 1: the transaction took its first-mutation snapshot");
  const tx = db
    .transaction(async () => {
      // First-mutation snapshot of "messages" is taken here, BEFORE the
      // concurrent load below splices the cold unit into the live table.
      await db.update(messages).set({ content: "uncommitted tx edit" }).where(eq(messages.id, "m-warm"));
      tx1Snapshot.fire();
      await txGate;
      throw forced;
    })
    .catch((error: unknown) => error);
  // The snapshot provably exists before the concurrent load - no sleep.
  await tx1Snapshot.wait();

  // The concurrent request: a plain read that lazy-loads the cold unit. It
  // runs OUTSIDE the transaction's ALS context - exactly the #5651 shape.
  const loadedDuringTx = await storage.getMessage("m-cold");
  assert.equal(
    loadedDuringTx?.content,
    "persisted before the transaction",
    "the mid-transaction lazy load itself returns the persisted row",
  );

  releaseTx();
  assert.equal(await tx, forced, "the transaction rejects with its forced error");

  const survivor = await storage.getMessage("m-cold");
  assert.equal(
    survivor?.content,
    "persisted before the transaction",
    "rollback must not erase rows a concurrent read lazily loaded mid-transaction (#5651)",
  );
  const rolledBack = await storage.getMessage("m-warm");
  assert.equal(rolledBack?.content, "pre-transaction text", "the transaction's own mutation rolled back");

  // ══ Part 2 (#5652): a transaction may not run concurrently with a flush ══
  // Stage the double-flush ordering from the issue.
  await db.insert(messages).values(messageRow("m-f1", "warm", "dirties for flush 1"));

  let releaseHold1!: () => void;
  const hold1 = new Promise<void>((resolve) => {
    releaseHold1 = resolve;
  });
  gateReleases.push(releaseHold1);
  let releaseHold2!: () => void;
  const hold2 = new Promise<void>((resolve) => {
    releaseHold2 = resolve;
  });
  gateReleases.push(releaseHold2);

  const hold1Taken = signal("Part 2: flush 1 reached its mid-write hold");
  pendingFlushHold = { hold: hold1, taken: hold1Taken.fire };
  const flush1 = store.flush(); // captures, then parks mid-write on hold1
  await hold1Taken.wait(); // flush 1 is provably parked mid-write

  await db.insert(messages).values(messageRow("m-f2", "warm", "dirties for flush 2"));
  // flush() reaches its `await this.activeFlush` synchronously, so flush 2's
  // subscription is established by the time this call returns - FIRST.
  const flush2 = store.flush();

  let txEntered = false;
  let releaseTx2!: () => void;
  const tx2Gate = new Promise<void>((resolve) => {
    releaseTx2 = resolve;
  });
  gateReleases.push(releaseTx2);
  const tx2 = db.transaction(async () => {
    txEntered = true;
    await db.update(messages).set({ content: "tx2 edit" }).where(eq(messages.id, "m-f2"));
    await tx2Gate;
  }); // reaches the same activeFlush await one microtask later - subscribed SECOND
  await settle(10); // yield so the transaction's continuation is enqueued behind flush 2's
  assert.equal(flushHoldsTaken, 1, "only flush 1 has taken a hold before hold 2 is armed");

  // Arm the hold for flush 2's recursion BEFORE waking flush 1: when flush 1
  // settles, flush 2 re-enters first, captures the new dirty set, installs a
  // new activeFlush, and parks mid-write on hold2 - with the transaction's
  // continuation scheduled right behind it.
  const hold2Taken = signal("Part 2: flush 2's recursion reached its mid-write hold");
  pendingFlushHold = { hold: hold2, taken: hold2Taken.fire };
  releaseHold1();
  await hold2Taken.wait(); // flush 2's recursion is provably mid-I/O
  await settle(20); // grace window for the transaction continuation to (wrongly) run

  assert.equal(
    txEntered,
    false,
    "the transaction callback must not run concurrently with the second flush's I/O (#5652)",
  );

  releaseHold2();
  releaseTx2(); // pre-resolving the gate is fine - tx2 passes it whenever it enters
  await tx2;
  await flush1;
  await flush2;
  assert.equal(txEntered, true, "the transaction proceeds normally once the flush chain settles");
  assert.equal((await storage.getMessage("m-f2"))?.content, "tx2 edit", "the post-flush transaction committed");

  // Anti-vacuity: both staged holds must actually have engaged, or the pin
  // proved nothing about the flush/transaction interleaving.
  assert.equal(flushHoldsTaken, 2, "both flushes took their staged mid-write holds");

  // ══ Part 3: the snapshot mirror survives six-figure concurrent loads ══
  // Same shape as Part 1, but the concurrently loaded unit holds 200k rows:
  // the old push(...mirrored) spread threw RangeError here - after the
  // length = 0 truncation - so the read 500'd and the transaction's rollback
  // snapshot was left empty, wiping the resident messages table on rollback.
  let releaseTx3!: () => void;
  const tx3Gate = new Promise<void>((resolve) => {
    releaseTx3 = resolve;
  });
  gateReleases.push(releaseTx3);
  const tx3Failure = new Error("forced rollback (large mirror)");
  const tx3Snapshot = signal("Part 3: the large-mirror transaction took its first-mutation snapshot");
  const tx3 = db
    .transaction(async () => {
      await db.update(messages).set({ content: "uncommitted large-mirror edit" }).where(eq(messages.id, "m-warm"));
      tx3Snapshot.fire();
      await tx3Gate;
      throw tx3Failure;
    })
    .catch((error: unknown) => error);
  await tx3Snapshot.wait(); // the snapshot provably exists before the six-figure load

  const bigLoaded = await storage.getMessage("m-big-0");
  assert.equal(bigLoaded?.content, "big row 0", "the six-figure mid-transaction lazy load completes");

  releaseTx3();
  assert.equal(await tx3, tx3Failure, "the large-mirror transaction rejects with its forced error");
  assert.equal(
    (await storage.getMessage(`m-big-${BIG_ROW_COUNT - 1}`))?.content,
    `big row ${BIG_ROW_COUNT - 1}`,
    "rollback must preserve a six-figure unit a concurrent read lazily loaded mid-transaction",
  );
  assert.equal(
    (await storage.getMessage("m-warm"))?.content,
    "pre-transaction text",
    "the large-mirror transaction's own mutation rolled back",
  );

  // ══ Part 4: a flush parked behind a transaction re-checks after waking ══
  // Close-path staging (the pendingTransactionFlush rescue is skipped once
  // writesClosed): T1 active with the store dirty, a flush parked in
  // waitForTransactions behind it, T2 queued behind T1, then close(). When
  // T1 finishes, T2's one-hop wake beats the flush's two-hop wake - the
  // check-once flush then ran its I/O concurrently with T2's callback and
  // persisted T2's uncommitted brand-new-unit rows, whose dirty mark the
  // rollback erased. This part runs LAST: it closes the store.
  await db.insert(messages).values(messageRow("m-close-dirty", "warm", "dirties for the close-path flush"));

  let releaseT1!: () => void;
  const t1Gate = new Promise<void>((resolve) => {
    releaseT1 = resolve;
  });
  gateReleases.push(releaseT1);
  const t1Active = signal("Part 4: T1 activated and took its first-mutation snapshot");
  const t1 = db.transaction(async () => {
    await db.update(messages).set({ content: "t1 close-path edit" }).where(eq(messages.id, "m-close-dirty"));
    t1Active.fire();
    await t1Gate;
  });
  // T1 is provably active - and pinned active by its gate - before the flush
  // below is started, so that flush parks in waitForTransactions by
  // construction (activeTransactionCount is 1 at the call), not by timing.
  await t1Active.wait();

  let parkedFlushSettled = false;
  const parkedFlush = store.flush().then(() => {
    parkedFlushSettled = true;
  });

  const t4Failure = new Error("forced rollback (close path)");
  const t2Close = db
    .transaction(async () => {
      closeTxActive = true;
      try {
        await db.insert(chatsTable).values(chatRow("k-unit"));
        await db.insert(messages).values(messageRow("m-k1", "k-unit", "uncommitted close-path row"));
        // DETECTION window, not staging: on broken code the rogue concurrent
        // flush needs real I/O time to reach a table write while this
        // callback is mid-flight - the hook records the overlap.
        await settle(60);
        throw t4Failure;
      } finally {
        closeTxActive = false;
      }
    })
    .catch((error: unknown) => error);
  // T2's queue admission is synchronous at the call above, so it is already
  // queued behind T1. And nothing can settle the parked flush while T1's
  // gate pins activeTransactionCount at 1 - assert the staging outright.
  assert.equal(parkedFlushSettled, false, "the staged flush is parked behind the active transaction");

  // close() sets writesClosed synchronously, so T1's finally will skip the
  // pendingTransactionFlush rescue - the exact open door under test.
  const closing = store.close();
  releaseT1();
  await t1;
  assert.equal(await t2Close, t4Failure, "the close-path transaction rejects with its forced error");
  await parkedFlush;
  await closing;

  assert.equal(
    closeOverlapDetected,
    false,
    "a flush parked behind a transaction must not run its I/O concurrently with the next transaction's callback (close path)",
  );
  assert.equal(
    existsSync(join(storeDir, "tables", "messages", `${encodeShardKey("k-unit")}.json`)),
    false,
    "rolled-back rows for a brand-new unit must not survive on disk after close",
  );
} finally {
  for (const release of gateReleases) release();
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Store transaction-isolation regression passed.");
