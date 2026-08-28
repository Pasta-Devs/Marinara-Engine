// #5592 PR-B: the autonomous-messaging idle check must be storage-free after
// its one-time activity seed. Before this, every 30s background poll read the
// full transcript of every autonomous-enabled chat — loading and LRU-touching
// each chat's whole storage unit — which churned the Termux eviction cap and
// could evict the chat the user was actively viewing. These regressions drive
// the REAL app + store and pin:
//   - the first check seeds activity state (one unit load, correct answer),
//   - an evicted autonomous chat STAYS evicted across repeat idle checks
//     (zero lazy-table queries — the unit would reload if any ran),
//   - the check still answers correctly from the in-memory tracker.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-auto-check-"));

let app: {
  ready(): Promise<unknown>;
  close(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): unknown }>;
  db: {
    select: (...args: unknown[]) => unknown;
    _fileStore: { flush(): Promise<void>; getResidentChatUnits(): ReadonlySet<string> };
  };
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";

  // Seed shard files BEFORE the app boots: one autonomous-enabled chat with
  // history, plus two filler chats used to age it out of the resident cap.
  const writeShard = (table: string, key: string, rows: unknown[]) => {
    const dir = join(fileStorageDir, "tables", table);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${key}.json`), JSON.stringify(rows));
  };
  const chatRow = (id: string, metadata: Record<string, unknown> = {}) => ({
    id,
    name: id,
    mode: "conversation",
    characterIds: JSON.stringify(["char-x"]),
    metadata: JSON.stringify(metadata),
    createdAt: "2026-08-28T10:00:00.000Z",
    lastMessageAt: "2026-08-28T10:00:02.000Z",
  });
  const messageRow = (id: string, chatId: string, role: string, seconds: number) => ({
    id,
    chatId,
    role,
    content: `${role} says`,
    createdAt: `2026-08-28T10:00:0${seconds}.000Z`,
  });
  writeShard("chats", "chat-auto", [chatRow("chat-auto", { autonomousMessages: true })]);
  writeShard("chats", "chat-f1", [chatRow("chat-f1")]);
  writeShard("chats", "chat-f2", [chatRow("chat-f2")]);
  writeShard("messages", "chat-auto", [
    messageRow("m-1", "chat-auto", "user", 1),
    messageRow("m-2", "chat-auto", "assistant", 2),
  ]);
  writeShard("messages", "chat-f1", [messageRow("m-f1", "chat-f1", "user", 1)]);
  writeShard("messages", "chat-f2", [messageRow("m-f2", "chat-f2", "user", 1)]);

  const [{ buildApp }, { eq }, { messages }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/file-query.js"),
    import("../../packages/server/src/db/schema/index.js"),
  ]);

  app = (await buildApp()) as unknown as NonNullable<typeof app>;
  await app.ready();
  const db = app.db as unknown as {
    select: () => { from: (t: unknown) => { where: (c: unknown) => Promise<Array<Record<string, unknown>>> } };
    _fileStore: { flush(): Promise<void>; getResidentChatUnits(): ReadonlySet<string> };
  };

  const check = async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/conversation/autonomous/check",
      // A client-sourced check records presence FIRST, creating a partial
      // activity state before the seed runs — the seed must merge transcript
      // data into it, not bail on mere existence.
      payload: { chatId: "chat-auto", userStatus: "active", source: "background" },
    });
    assert.equal(response.statusCode, 200, "the check responds 200");
    return response.json() as { shouldTrigger: boolean };
  };

  // First check: seeds the activity tracker (this is the one allowed unit load).
  const first = await check();
  assert.equal(typeof first.shouldTrigger, "boolean", "the check returns a verdict");
  {
    const svc = await import("../../packages/server/src/services/conversation/autonomous.service.js");
    const seeded = svc.getActivityState("chat-auto");
    assert.ok(seeded, "the first check leaves an activity state");
    assert.ok(
      seeded.lastUserMessageAt > 0,
      "transcript timestamps are seeded even though presence created a partial state first",
    );
    assert.equal(seeded.lastMessageRole, "assistant", "the transcript's last-message role is seeded");
  }
  assert.equal(
    db._fileStore.getResidentChatUnits().has("chat-auto"),
    true,
    "the first check seeds from the transcript, loading the unit once",
  );

  // Age chat-auto out of the cap with the filler chats, then sweep.
  await db.select().from(messages).where(eq(messages.chatId, "chat-f1"));
  await db.select().from(messages).where(eq(messages.chatId, "chat-f2"));
  await db._fileStore.flush();
  assert.equal(
    db._fileStore.getResidentChatUnits().has("chat-auto"),
    false,
    "the autonomous chat ages out of the resident cap like any other unit",
  );

  // Repeat idle checks must be storage-free: if the route still read the
  // transcript (or probed the turn-game state), the unit would reload here.
  for (let i = 0; i < 3; i++) {
    const repeat = await check();
    assert.equal(typeof repeat.shouldTrigger, "boolean", "repeat checks still answer");
    assert.equal(
      db._fileStore.getResidentChatUnits().has("chat-auto"),
      false,
      "a repeat idle check issues zero lazy-table queries — the evicted unit stays on disk",
    );
  }

  // ── lastMessageRole ordering guard ──
  // The assistant record runs a few awaits after its row persisted; a user
  // message landing in that window must keep the role — a delayed assistant
  // record with an OLDER message timestamp cannot steal it back.
  {
    const svc = await import("../../packages/server/src/services/conversation/autonomous.service.js");
    const roleChat = "role-order-test-chat";
    svc.recordUserActivity(roleChat);
    svc.recordAssistantActivity(roleChat, undefined, Date.now() - 60_000);
    assert.equal(
      svc.getActivityState(roleChat)?.lastMessageRole,
      "user",
      "a delayed assistant record with an older message timestamp does not steal the role",
    );
    svc.recordAssistantActivity(roleChat, undefined, Date.now() + 1_000);
    assert.equal(
      svc.getActivityState(roleChat)?.lastMessageRole,
      "assistant",
      "an assistant message newer than the last user message takes the role",
    );
    svc.recordUserActivity(roleChat);
    svc.recordAssistantActivity(roleChat);
    assert.equal(
      svc.getActivityState(roleChat)?.lastMessageRole,
      "assistant",
      "a generic activity ping without a message timestamp keeps last-writer-wins",
    );
  }

  console.log("Autonomous-check storage regressions passed.");
} finally {
  if (app) await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
