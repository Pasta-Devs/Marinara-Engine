/**
 * Server hunt batch 29.
 *
 * 1. Auto-summary: a summary call that hits the timeout aborts the provider request
 *    (its signal fires) and is still recorded as a transient "Summary timeout" failure.
 * 2. Cross-chat awareness: a sibling chat whose newest message is older than every
 *    requested window is skipped without reading its messages, and the message read for
 *    an active sibling is bounded by createdAt.
 * 3. Week schedule parsing: a draft with blocks missing "activity" or "time" (or
 *    non-object blocks, or a non-array day) is rejected with a visible "invalid schedule"
 *    error so the user can regenerate it, and resolveIntent tolerates a stored block
 *    without an activity.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = await mkdtemp(join(tmpdir(), "server-hunt-b29-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { generateMissingConversationSummaries } =
  await import("../../packages/server/src/services/conversation/auto-summary.service.js");
const { buildAwarenessBlock } = await import("../../packages/server/src/services/conversation/awareness.service.js");
const { generateCharacterSchedule } = await import("../../packages/server/src/services/conversation/schedule.service.js");
const { resolveIntent } = await import("../../packages/server/src/services/conversation/intent.service.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { messages } = await import("../../packages/server/src/db/schema/index.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");

let dbOpened = false;
try {
  // ── 1. Summary timeout aborts the in-flight request ─────────────────────────
  {
    let seenSignal: AbortSignal | undefined;
    const provider = {
      chatComplete: (_messages: unknown, options: { signal?: AbortSignal }) => {
        seenSignal = options.signal;
        // Hangs until aborted, like a provider that never answers.
        return new Promise((_, reject) => {
          options.signal?.addEventListener("abort", () => reject(new Error("aborted by signal")), { once: true });
        });
      },
    };
    // The summary timeout timer is unref'd (the server's listener keeps the loop alive in
    // production). Nothing else here holds the loop open, so keep it alive until it fires.
    const keepAlive = setInterval(() => {}, 1000);
    const result = await generateMissingConversationSummaries({
      messages: [{ id: "m1", role: "user", content: "Hello there.", createdAt: "2026-08-02T12:00:00.000Z" }],
      metadata: {},
      provider: provider as never,
      model: "summary-model",
      personaName: "Mari",
      charIdToName: new Map(),
      now: new Date("2026-08-04T12:00:00.000Z"),
      timeZone: "UTC",
      timeoutMs: 30,
    }).finally(() => clearInterval(keepAlive));
    assert.ok(seenSignal, "summary call must pass an AbortSignal to the provider");
    assert.equal(seenSignal.aborted, true, "timeout must abort the provider request");
    assert.equal(result.failedDays.length, 1);
    assert.match(result.failedDays[0]!.error, /Summary timeout/);
  }

  // ── 2. Awareness skips dormant siblings and bounds the message read ──────────
  {
    const db = await getDB();
    dbOpened = true;
    const chatsStorage = createChatsStorage(db);
    const current = await chatsStorage.create({ name: "Current", mode: "conversation", characterIds: ["char-a"] });
    const dormant = await chatsStorage.create({ name: "Dormant", mode: "conversation", characterIds: ["char-a"] });
    const active = await chatsStorage.create({ name: "Active", mode: "conversation", characterIds: ["char-a"] });
    assert.ok(current && dormant && active);
    const old = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    await chatsStorage.createMessage(
      { chatId: dormant.id, role: "user", characterId: null, content: "Old dormant line" },
      { createdAt: old },
    );
    await chatsStorage.createMessage(
      { chatId: active.id, role: "user", characterId: null, content: "Old active line" },
      { createdAt: old },
    );
    await chatsStorage.createMessage({
      chatId: active.id,
      role: "user",
      characterId: null,
      content: "Fresh active line",
    });

    const messageWheres: unknown[] = [];
    const describe = (value: unknown) => {
      const seen = new WeakSet<object>();
      return JSON.stringify(value, (_key, inner) => {
        if (inner && typeof inner === "object") {
          if (seen.has(inner)) return undefined;
          seen.add(inner);
        }
        return inner;
      });
    };
    const wrap = <T extends object>(target: T, onMessages: boolean): T =>
      new Proxy(target, {
        get(obj, prop, receiver) {
          const value = Reflect.get(obj, prop, receiver);
          if (typeof value !== "function") return value;
          if (prop === "from") {
            return (table: unknown, ...rest: unknown[]) =>
              wrap(value.call(obj, table, ...rest), table === messages);
          }
          if (prop === "where" && onMessages) {
            return (condition: unknown, ...rest: unknown[]) => {
              messageWheres.push(condition);
              return value.call(obj, condition, ...rest);
            };
          }
          return value.bind(obj);
        },
      });
    const countingDb = new Proxy(db, {
      get(obj, prop, receiver) {
        const value = Reflect.get(obj, prop, receiver);
        if (prop === "select" && typeof value === "function") {
          return (...args: unknown[]) => wrap(value.apply(obj, args), false);
        }
        return typeof value === "function" ? value.bind(obj) : value;
      },
    }) as typeof db;

    const block = await buildAwarenessBlock(
      countingDb,
      current.id,
      ["char-a"],
      new Map([["char-a", "Aria"]]),
      "User",
      "hi",
    );
    assert.ok(block, "active sibling must still produce an awareness block");
    assert.match(block, /Fresh active line/);
    assert.doesNotMatch(block, /Old active line|Old dormant line/);
    const dormantReads = messageWheres.filter((where) => describe(where).includes(dormant.id));
    assert.equal(dormantReads.length, 0, "dormant sibling must not have its messages read");
    const activeReads = messageWheres.filter((where) => describe(where).includes(active.id));
    assert.equal(activeReads.length, 1);
    assert.match(describe(activeReads[0]), /"gte"/, "active sibling read must be bounded by createdAt");
  }

  // ── 3. Week schedule blocks without activity/time ────────────────────────────
  {
    const content = JSON.stringify({
      talkativeness: 50,
      days: {
        Monday: [
          { time: "12:00-13:00", status: "lunch" },
          { time: "13:00-14:00", status: "idle" },
          { activity: "working", status: "dnd" },
          null,
          "junk",
        ],
        Tuesday: "not an array",
      },
    });
    const provider = { maxTokensOverrideValue: null, chatComplete: async () => ({ content }) };
    await assert.rejects(
      generateCharacterSchedule(provider as never, "m", "Aria", "desc", "pers"),
      /invalid schedule for Monday/,
      "an invalid week draft is rejected with a visible error instead of being saved",
    );

    // A schedule already stored with a missing activity must not throw in resolveIntent.
    const now = new Date(2026, 8, 21, 12, 30); // a Monday
    const block = { time: "12:00-13:00", status: "idle" } as unknown as { time: string; activity: string; status: "idle" };
    const days: Record<string, Array<typeof block>> = {};
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      days[day] = [
        { time: "00:00-12:00", activity: "reading", status: "idle" },
        block,
        { time: "13:00-24:00", activity: "reading", status: "idle" },
      ];
    }
    const stored = { weekStart: "2026-09-21", days, talkativeness: 50, inactivityThresholdMinutes: 120 };
    assert.doesNotThrow(() => resolveIntent(stored as never, 60_000, false, now));
  }

  console.log("server-hunt-b29 regression passed");
} finally {
  if (dbOpened) await closeDB();
  await rm(dataDir, { recursive: true, force: true });
}
