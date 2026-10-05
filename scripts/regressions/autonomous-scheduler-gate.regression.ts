// #4705: the server autonomous scheduler skips its 60s full sweep when the
// chats table hasn't been written since a conclusive none-eligible sweep. The
// gate rides the file store's per-table write-generation counter — these
// regressions pin the counter semantics the gate depends on.
// #7055: the scheduler evaluates at most two chats per poll. It must take turns
// through every enabled chat instead of re-checking the first two listed, only a
// saved message counts as a generated one, and a character without a schedule
// keeps the check's reason so that reason's cooldown is recorded.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";
import { setImmediate as yieldImmediate } from "node:timers/promises";
import type { FastifyInstance } from "fastify";
import { eq } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { appSettings, chats } from "../../packages/server/src/db/schema/index.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-write-gen-"));
process.env.FILE_STORAGE_DIR = storageDir;

// Closed from the finally path even when an assertion fails mid-run: an
// unclosed store keeps its beforeExit flush handler armed, which could
// recreate the temp dir after rmSync removes it.
let closeStore: (() => Promise<void>) | undefined;

try {
  const db = await createFileNativeDB();
  closeStore = () => db._fileStore.close();

  // Never-written table reads generation 0.
  assert.equal(db._fileStore.getTableWriteGeneration("chats"), 0, "fresh table starts at generation 0");

  // Every write bumps the counter monotonically.
  await db.insert(chats).values({ id: "gen-chat-1", name: "Gen", mode: "conversation" });
  const afterInsert = db._fileStore.getTableWriteGeneration("chats");
  assert.ok(afterInsert > 0, "insert bumps the generation");

  await db.update(chats).set({ name: "Gen 2" }).where(eq(chats.id, "gen-chat-1"));
  const afterUpdate = db._fileStore.getTableWriteGeneration("chats");
  assert.ok(afterUpdate > afterInsert, "update bumps the generation further");

  // Writes to other tables leave this table's generation untouched — the
  // scheduler's gate must not be re-armed by unrelated storage traffic.
  await db.insert(appSettings).values({ key: "gen-probe", value: "x", updatedAt: "2026-08-07" });
  assert.equal(
    db._fileStore.getTableWriteGeneration("chats"),
    afterUpdate,
    "unrelated table writes do not bump the chats generation",
  );

  // A rolled-back transaction KEEPS the in-transaction bump AND adds a
  // rollback bump. The second half is the load-bearing part: reads are not
  // transaction-isolated, so a poll landing DURING the transaction can store
  // a generation derived from uncommitted rows — the restore must advance the
  // generation past that sample or the stale conclusion would never be
  // re-examined (the dormant-scheduler dirty-read found in review).
  const beforeRollback = db._fileStore.getTableWriteGeneration("chats");
  let generationSampledDuringTx = -1;
  await db
    .transaction(async (tx) => {
      await tx.update(chats).set({ name: "Rolled Back" }).where(eq(chats.id, "gen-chat-1"));
      // What a concurrently-polling reader would observe mid-transaction:
      generationSampledDuringTx = db._fileStore.getTableWriteGeneration("chats");
      throw new Error("force rollback");
    })
    .catch(() => {});
  const rolledBack = await db.select().from(chats).where(eq(chats.id, "gen-chat-1"));
  assert.equal(rolledBack[0]?.name, "Gen 2", "row content rolled back");
  assert.ok(generationSampledDuringTx > beforeRollback, "in-transaction write bumped the generation");
  assert.ok(
    db._fileStore.getTableWriteGeneration("chats") > generationSampledDuringTx,
    "rollback bumps the generation PAST any mid-transaction sample, so conclusions derived from uncommitted rows are re-examined",
  );

  // The sweep gate's state machine (pure, pinned against refactors): only a
  // conclusive none-eligible sweep may arm the skip, and the skip requires a
  // real, unchanged generation on both sides.
  const { concludeAutonomousSweep, shouldSkipAutonomousSweep, startServerAutonomousScheduler } = await import(
    "../../packages/server/src/services/conversation/server-autonomous-scheduler.service.js"
  );
  assert.equal(concludeAutonomousSweep({ inconclusive: false, sawEligible: false, generation: 7 }), 7);
  assert.equal(concludeAutonomousSweep({ inconclusive: true, sawEligible: false, generation: 7 }), null, "cap-break/stopped sweeps prove nothing");
  assert.equal(concludeAutonomousSweep({ inconclusive: false, sawEligible: true, generation: 7 }), null, "eligible chats keep sweeping");
  assert.equal(concludeAutonomousSweep({ inconclusive: false, sawEligible: false, generation: null }), null, "no counter -> never arm");
  assert.equal(shouldSkipAutonomousSweep(7, 7), true);
  assert.equal(shouldSkipAutonomousSweep(7, 8), false, "any write re-arms the sweep");
  assert.equal(shouldSkipAutonomousSweep(null, 7), false, "unarmed gate always sweeps");
  assert.equal(shouldSkipAutonomousSweep(7, null), false, "counter unavailable -> degrade to sweeping");

  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const storage = createChatsStorage(db);
  const chatIds = ["auto-1", "auto-2", "auto-3", "auto-4", "auto-5"];
  for (const id of chatIds) {
    await db.insert(chats).values({
      id,
      name: id,
      mode: "conversation",
      characterIds: JSON.stringify(["friend"]),
      metadata: JSON.stringify({ autonomousMessages: true }),
    });
  }
  const due = new Set<string>();
  let generated = 'data: {"type":"done"}\n\n';
  let checked: string[] = [];
  let generatedIntentKey: unknown;
  const app = {
    db,
    addHook() {},
    async inject(input: { url: string; payload: { chatId: string; autonomousIntentKey?: string } }) {
      if (!input.url.endsWith("/check")) {
        generatedIntentKey = input.payload.autonomousIntentKey;
        return { statusCode: 200, payload: generated };
      }
      checked.push(input.payload.chatId);
      const shouldTrigger = due.has(input.payload.chatId);
      return {
        statusCode: 200,
        payload: JSON.stringify({
          shouldTrigger,
          characterIds: shouldTrigger ? ["friend"] : [],
          reason: "none",
          autonomousIntentKey: "long_absence_check_in",
        }),
      };
    },
  } as unknown as FastifyInstance;
  mock.timers.enable({ apis: ["setTimeout"] });
  const scheduler = startServerAutonomousScheduler(app);
  const nextPoll = async (milliseconds = 60_000) => {
    checked = [];
    mock.timers.tick(milliseconds);
    for (let turn = 0; turn < 100; turn++) await yieldImmediate();
    return checked;
  };
  const unreadCount = async (id: string) =>
    JSON.parse(String((await storage.getById(id))!.metadata)).autonomousUnreadCount as number | undefined;
  try {
    const seen = new Set<string>();
    for (const polled of [await nextPoll(20_000), await nextPoll(), await nextPoll()]) {
      assert.ok(polled.length <= 2, `a poll still checks at most two chats (got ${polled.length})`);
      for (const id of polled) seen.add(id);
    }
    assert.deepEqual([...seen].sort(), chatIds, "every chat with autonomous messages gets checked in turn");

    for (const id of chatIds.slice(1)) await storage.patchMetadata(id, { autonomousMessages: false });
    due.add("auto-1");
    assert.deepEqual(await nextPoll(), ["auto-1"]);
    assert.equal(await unreadCount("auto-1"), undefined, "a generation that saved nothing is not a new message");
    generated = `data: ${JSON.stringify({ type: "message_saved", data: { role: "assistant" } })}\n\n${generated}`;
    assert.deepEqual(await nextPoll(), ["auto-1"]);
    assert.equal(await unreadCount("auto-1"), 1, "a saved autonomous message marks the chat unread");
    assert.equal(
      generatedIntentKey,
      "long_absence_check_in",
      "a character without a schedule keeps the check's reason, so a long-absence check-in is not repeated",
    );
  } finally {
    scheduler.stop();
    mock.timers.reset();
  }

  console.info("Autonomous scheduler gate regressions passed.");
} finally {
  try {
    await closeStore?.();
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }
}
