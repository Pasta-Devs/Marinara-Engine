// Server hunt batch 30: server-side autonomous scheduler.
//  1. The concurrency cap must not starve every eligible chat after the first
//     two in list order: consecutive sweeps rotate through all eligible chats.
//  2. A busy-delayed generation re-validates the chat and the claim when its
//     timer fires, instead of generating on the state captured at arm time.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";
const storageDir = mkdtempSync(join(tmpdir(), "marinara-b30-"));
process.env.DATA_DIR = storageDir;
process.env.FILE_STORAGE_DIR = storageDir;

let closeStore: (() => Promise<void>) | undefined;
const realSetTimeout = globalThis.setTimeout;

try {
  const [{ createFileNativeDB }, { chats }, scheduler] = await Promise.all([
    import("../../packages/server/src/db/file-backed-store.js"),
    import("../../packages/server/src/db/schema/index.js"),
    import("../../packages/server/src/services/conversation/server-autonomous-scheduler.service.js"),
  ]);
  const { orderAutonomousSweepCandidates, getDelayedAutonomousAbortReason, startServerAutonomousScheduler } =
    scheduler;

  // Pure rotation helper.
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id).join(",");
  assert.equal(ids(orderAutonomousSweepCandidates(list, null)), "a,b,c,d");
  assert.equal(ids(orderAutonomousSweepCandidates(list, "b")), "c,d,a,b");
  assert.equal(ids(orderAutonomousSweepCandidates(list, "d")), "a,b,c,d");
  assert.equal(ids(orderAutonomousSweepCandidates(list, "gone")), "a,b,c,d", "missing cursor falls back to the top");

  // Behavioural: drive the real scheduler over a real file store with a fake
  // inject, and check that every eligible chat gets evaluated within a few
  // sweeps (before the fix only the top two were ever checked).
  const db = await createFileNativeDB();
  closeStore = () => db._fileStore.close();
  const chatIds = ["c1", "c2", "c3", "c4", "c5"];
  for (const [index, id] of chatIds.entries()) {
    await db.insert(chats).values({
      id,
      name: id,
      mode: "conversation",
      metadata: JSON.stringify({ autonomousMessages: true }),
      updatedAt: `2026-09-2${index}T10:00:00.000Z`,
    });
  }

  const checkedIds: string[] = [];
  let resolveEnough: () => void = () => {};
  const enough = new Promise<void>((resolve) => {
    resolveEnough = resolve;
  });
  const fakeApp = {
    db,
    addHook: () => {},
    inject: async (options: { url: string; payload: { chatId: string } }) => {
      if (options.url === "/api/conversation/autonomous/check") {
        checkedIds.push(options.payload.chatId);
        if (checkedIds.length >= 12) resolveEnough();
        return { statusCode: 200, payload: JSON.stringify({ shouldTrigger: false, reason: "not_idle" }) };
      }
      throw new Error(`unexpected inject ${options.url}`);
    },
  };

  // Compress the scheduler's poll delays so several sweeps run quickly.
  (globalThis as { setTimeout: unknown }).setTimeout = ((fn: () => void, _ms?: number) =>
    realSetTimeout(fn, 5)) as unknown as typeof setTimeout;
  const handle = startServerAutonomousScheduler(fakeApp as never);
  const timeout = new Promise<never>((_, reject) =>
    realSetTimeout(() => reject(new Error(`timed out; checked ${checkedIds.join(",")}`)), 10_000),
  );
  try {
    await Promise.race([enough, timeout]);
  } finally {
    handle.stop();
    globalThis.setTimeout = realSetTimeout;
  }
  const seen = new Set(checkedIds);
  for (const id of chatIds) {
    assert.ok(seen.has(id), `chat ${id} is evaluated within a few sweeps (checked: ${checkedIds.join(",")})`);
  }

  // Fire-time re-validation for delayed generations.
  const eligibleChat = { id: "x", mode: "conversation", metadata: JSON.stringify({ autonomousMessages: true }) };
  const claimedAt = 1_000;
  const heldState = { generationInProgressSince: claimedAt, lastUserMessageAt: 500 };
  assert.equal(getDelayedAutonomousAbortReason({ claimedAt, state: heldState, chat: eligibleChat }), null);
  assert.equal(
    getDelayedAutonomousAbortReason({
      claimedAt,
      state: heldState,
      chat: { ...eligibleChat, metadata: JSON.stringify({ autonomousMessages: false }) },
    }),
    "chat_ineligible",
    "autonomous turned off during the delay aborts",
  );
  assert.equal(
    getDelayedAutonomousAbortReason({
      claimedAt,
      state: heldState,
      chat: { ...eligibleChat, metadata: JSON.stringify({ autonomousMessages: true, sceneStatus: "active" }) },
    }),
    "chat_ineligible",
  );
  assert.equal(getDelayedAutonomousAbortReason({ claimedAt, state: heldState, chat: null }), "chat_ineligible");
  assert.equal(
    getDelayedAutonomousAbortReason({
      claimedAt,
      state: { generationInProgressSince: null, lastUserMessageAt: 2_000 },
      chat: eligibleChat,
    }),
    "claim_released",
    "a user reply that released the claim aborts",
  );
  assert.equal(
    getDelayedAutonomousAbortReason({
      claimedAt,
      state: { generationInProgressSince: claimedAt, lastUserMessageAt: 2_000 },
      chat: eligibleChat,
    }),
    "user_replied",
  );

  // Wiring: the delay timer consults the re-validation and no longer holds an
  // evaluation slot.
  const source = readFileSync(
    join(
      import.meta.dirname,
      "../../packages/server/src/services/conversation/server-autonomous-scheduler.service.ts",
    ),
    "utf8",
  );
  const timerBody = source.slice(source.indexOf("const scheduleDelayedGeneration"), source.indexOf("const evaluateChat"));
  assert.match(timerBody, /getDelayedAutonomousAbortReason\(/u, "delay timer re-validates before generating");
  assert.match(timerBody, /delayedChats\.delete\(chatId\)/u);
  assert.doesNotMatch(timerBody, /runningChats\.delete/u, "delay timer does not own an evaluation slot");

  console.info("Server hunt batch 30 regressions passed.");
} finally {
  globalThis.setTimeout = realSetTimeout;
  try {
    await closeStore?.();
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }
}
