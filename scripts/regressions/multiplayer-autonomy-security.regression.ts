import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { mock } from "node:test";
import { setImmediate as yieldImmediate } from "node:timers/promises";
import type { FastifyInstance } from "fastify";
import { createMultiplayerAutonomyAdapter } from "../../packages/server/src/services/multiplayer/autonomy.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-room-autonomy-"));
process.env.FILE_STORAGE_DIR = directory;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { chats, characters } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { startServerAutonomousScheduler } =
  await import("../../packages/server/src/services/conversation/server-autonomous-scheduler.service.js");
const db = await createFileNativeDB();

try {
  const schedules = {
    "room-character": {
      weekStart: "2026-09-28T00:00:00.000Z",
      days: {},
      inactivityThresholdMinutes: 10,
      talkativeness: 50,
    },
    "outside-character": {
      weekStart: "2026-09-28T00:00:00.000Z",
      days: {},
      inactivityThresholdMinutes: 10,
      talkativeness: 50,
    },
  };
  const override = { status: "idle", createdAt: "2026-09-29T00:00:00.000Z" };
  const privateCard = JSON.stringify({ name: "Private character", extensions: {} });
  await db.insert(characters).values({ id: "room-character", name: "Private character", data: privateCard });
  const storage = createChatsStorage(db);
  for (const marker of [{ multiplayerSetup: true }, { multiplayer: { role: "host", status: "active" } }]) {
    const id = marker.multiplayer ? "room-host" : "room-prepared";
    await db.insert(chats).values({
      id,
      name: id,
      mode: "conversation",
      characterIds: JSON.stringify(["room-character"]),
      metadata: JSON.stringify({
        ...marker,
        characterSchedules: schedules,
        conversationStatusOverrides: { "room-character": override, "outside-character": override },
      }),
    });
    assert.deepEqual(await storage.resolveConversationPresenceState(id), {
      schedules: { "room-character": schedules["room-character"] },
      statusOverrides: { "room-character": override },
    });
    assert.equal(
      (await db.select().from(characters).where(eq(characters.id, "room-character")))[0]?.data,
      privateCard,
      "room routines and overrides cannot be hoisted into a private card",
    );
  }
  await db
    .update(characters)
    .set({
      data: JSON.stringify({
        name: "Private character",
        extensions: { conversationSchedule: { ...schedules["room-character"], talkativeness: 99 } },
      }),
    })
    .where(eq(characters.id, "room-character"));
  assert.deepEqual(
    await storage.resolveConversationSchedules("room-host"),
    { "room-character": schedules["room-character"] },
    "a private-card change cannot replace room-owned routines",
  );
  const { conversationRoutes } = await import("../../packages/server/src/routes/conversation.routes.js");
  const { recordUserActivity, getActivityState, markGenerationInProgress, clearGenerationInProgress } =
    await import("../../packages/server/src/services/conversation/autonomous.service.js");
  const fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");
  const app = fastify();
  app.decorate("db", db);
  await app.register(conversationRoutes);
  try {
    const acceptedAt = Date.now() - 60_000;
    await storage.patchMetadata("room-host", {
      autonomousMessages: true,
      multiplayer: { role: "host", status: "active", lastActivityAt: new Date(acceptedAt).toISOString() },
    });
    recordUserActivity("room-host", { occurredAt: acceptedAt - 3_600_000 });
    const claim = markGenerationInProgress("room-host");
    const check = await app.inject({
      method: "POST",
      url: "/autonomous/check",
      payload: { chatId: "room-host", userStatus: "idle", source: "server" },
    });
    assert.equal(check.statusCode, 200);
    assert.equal(check.json().shouldTrigger, false);
    assert.equal(
      getActivityState("room-host")!.lastUserMessageAt,
      acceptedAt,
      "host-accepted room activity replaces any stale viewer-local activity clock",
    );
    assert.equal(
      getActivityState("room-host")!.generationInProgressSince,
      claim,
      "activity reconciliation cannot clear a concurrent generation claim",
    );
    clearGenerationInProgress("room-host", claim);
    await storage.patchMetadata("room-host", { autonomousMessages: false });
  } finally {
    await app.close();
  }

  let active = true;
  const generated: string[] = [];
  const adapter = createMultiplayerAutonomyAdapter(() => ({
    async autonomousEnabled() {
      return active;
    },
    async generateAutonomous(input) {
      generated.push(input.chatId);
      return true;
    },
  }));
  assert.equal(await adapter.canGenerate("room-host"), true);
  active = false;
  assert.equal(
    await adapter.generate({
      chatId: "room-host",
      characterId: "room-character",
      autonomousIntentKey: "",
      userTimeZone: "UTC",
    }),
    false,
    "Stop Hosting during a busy delay is checked again at dispatch",
  );
  assert.deepEqual(generated, []);
  assert.equal(await createMultiplayerAutonomyAdapter(() => undefined).canGenerate("room-host"), false);

  // Drive the real scheduler timer with a real chat store. The fixed eligibility
  // operation is stubbed; these cases pin which authority receives generation.
  for (const [id, metadata, allow, expected] of [
    ["private", { autonomousMessages: true }, true, "normal"],
    ["hosted", { autonomousMessages: true, multiplayer: { role: "host" } }, true, "coordinator"],
    ["stopped", { autonomousMessages: true, multiplayer: { role: "host" } }, false, "none"],
    ["guest", { autonomousMessages: true, multiplayer: { role: "guest" } }, false, "none"],
    ["prepared", { autonomousMessages: true, multiplayerSetup: true }, true, "none"],
  ] as const) {
    await db
      .insert(chats)
      .values({ id, name: id, mode: "conversation", characterIds: "[]", metadata: JSON.stringify(metadata) });
    const calls: string[] = [];
    const app = {
      db,
      addHook() {},
      async inject(input: { url: string }) {
        calls.push(input.url);
        return {
          statusCode: 200,
          payload: input.url.endsWith("/check")
            ? JSON.stringify({ shouldTrigger: true, characterIds: ["room-character"] })
            : 'data: {"type":"done"}\n\n',
        };
      },
    } as unknown as FastifyInstance;
    mock.timers.enable({ apis: ["setTimeout"] });
    const scheduler = startServerAutonomousScheduler(app, {
      async canGenerate() {
        return allow;
      },
      async generate(input) {
        assert.equal(input.chatId, id);
        calls.push("coordinator");
        return true;
      },
    });
    try {
      mock.timers.tick(20_000);
      for (let attempt = 0; attempt < 100; attempt++) await yieldImmediate();
      if (expected === "normal") assert.deepEqual(calls, ["/api/conversation/autonomous/check", "/api/generate"]);
      else if (expected === "coordinator")
        assert.deepEqual(calls, ["/api/conversation/autonomous/check", "coordinator"]);
      else assert.deepEqual(calls, [], `${id} cannot claim or generate through the ordinary scheduler`);
    } finally {
      scheduler.stop();
      mock.timers.reset();
      await db.delete(chats).where(eq(chats.id, id));
    }
  }
  console.info(
    "multiplayer autonomy: room-only presence, coordinator dispatch, stop and ordinary-chat compatibility passed",
  );
} finally {
  mock.timers.reset();
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
