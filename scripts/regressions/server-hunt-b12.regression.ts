// Server hunt batch 12 (conversation.routes.ts):
//   - /schedule/generate, GET /status and /autonomous/check must patch only the
//     extension keys they own, never a stale spread of the whole extensions
//     object (which reverted concurrent memory / editor writes),
//   - /autonomous/exchange must not re-read the whole transcript on every call
//     once the chat's activity state is seeded,
//   - /autonomous/check and /activity/presence must not (re)create activity
//     state for a deleted or unknown chat.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hunt-b12-"));

let app: {
  ready(): Promise<unknown>;
  close(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): unknown }>;
  db: unknown;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.MARINARA_LITE = "true";
  process.env.MARINARA_MAX_RESIDENT_CHATS = "2";

  const writeShard = (table: string, key: string, rows: unknown[]) => {
    const dir = join(fileStorageDir, "tables", table);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${key}.json`), JSON.stringify(rows));
  };
  const chatRow = (id: string, characterIds: string[], metadata: Record<string, unknown> = {}) => ({
    id,
    name: id,
    mode: "conversation",
    characterIds: JSON.stringify(characterIds),
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
  writeShard("chats", "chat-grp", [
    chatRow("chat-grp", ["char-a", "char-b"], { autonomousMessages: true, characterExchanges: true }),
  ]);
  writeShard("chats", "chat-f1", [chatRow("chat-f1", ["char-a"])]);
  writeShard("chats", "chat-f2", [chatRow("chat-f2", ["char-a"])]);
  writeShard("messages", "chat-grp", [
    messageRow("m-1", "chat-grp", "user", 1),
    messageRow("m-2", "chat-grp", "assistant", 2),
  ]);
  writeShard("messages", "chat-f1", [messageRow("m-f1", "chat-f1", "user", 1)]);
  writeShard("messages", "chat-f2", [messageRow("m-f2", "chat-f2", "user", 1)]);

  const [{ buildApp }, { eq }, { messages }, svc, { createCharactersStorage }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/file-query.js"),
    import("../../packages/server/src/db/schema/index.js"),
    import("../../packages/server/src/services/conversation/autonomous.service.js"),
    import("../../packages/server/src/services/storage/characters.storage.js"),
  ]);

  app = (await buildApp()) as unknown as NonNullable<typeof app>;
  await app.ready();
  const db = app.db as unknown as {
    select: () => { from: (t: unknown) => { where: (c: unknown) => Promise<Array<Record<string, unknown>>> } };
    _fileStore: { flush(): Promise<void>; getResidentChatUnits(): ReadonlySet<string> };
  };

  // ── Exchange check does not re-read the transcript after the seed ──
  {
    const check = await app.inject({
      method: "POST",
      url: "/api/conversation/autonomous/check",
      payload: { chatId: "chat-grp", userStatus: "active", source: "background" },
    });
    assert.equal(check.statusCode, 200, "the seeding check responds 200");
    assert.ok((svc.getActivityState("chat-grp")?.lastUserMessageAt ?? 0) > 0, "the check seeded activity state");

    await db.select().from(messages).where(eq(messages.chatId, "chat-f1"));
    await db.select().from(messages).where(eq(messages.chatId, "chat-f2"));
    await db._fileStore.flush();
    assert.equal(
      db._fileStore.getResidentChatUnits().has("chat-grp"),
      false,
      "the group chat ages out of the resident cap",
    );

    for (let i = 0; i < 2; i++) {
      const exchange = await app.inject({
        method: "POST",
        url: "/api/conversation/autonomous/exchange",
        payload: { chatId: "chat-grp", lastSpeakerCharId: "char-a" },
      });
      assert.equal(exchange.statusCode, 200, "the exchange check responds 200");
      assert.equal(
        db._fileStore.getResidentChatUnits().has("chat-grp"),
        false,
        "an exchange check on a seeded chat does not reload the whole transcript",
      );
    }
  }

  // ── Unknown / deleted chats do not get activity state back ──
  {
    const presence = await app.inject({
      method: "POST",
      url: "/api/conversation/activity/presence",
      payload: { chatId: "chat-gone", userStatus: "active" },
    });
    assert.equal(presence.statusCode, 404, "presence for an unknown chat is a 404");
    assert.equal(svc.getActivityState("chat-gone"), undefined, "presence does not create state for an unknown chat");

    const check = await app.inject({
      method: "POST",
      url: "/api/conversation/autonomous/check",
      payload: { chatId: "chat-gone2", userStatus: "active", source: "background" },
    });
    assert.equal(check.statusCode, 404, "a check for an unknown chat is a 404");
    assert.equal(svc.getActivityState("chat-gone2"), undefined, "a check does not create state for an unknown chat");

    const known = await app.inject({
      method: "POST",
      url: "/api/conversation/activity/presence",
      payload: { chatId: "chat-f1", userStatus: "idle" },
    });
    assert.equal(known.statusCode, 200, "presence for a live chat still works");
    assert.equal(svc.getActivityState("chat-f1")?.clientPresence?.status, "idle", "presence is recorded");
  }

  // ── Status writes patch only their own keys ──
  {
    // The partial patch these routes now send must keep every other live key.
    const chars = createCharactersStorage(app.db as never);
    const created = (await chars.create({
      name: "Patch Target",
      extensions: {
        characterMemories: [{ id: "mem-1", text: "original" }],
        conversationScheduleAutoRenew: false,
      },
    } as never)) as { id: string } | null;
    assert.ok(created?.id, "character created");
    await chars.update(
      created!.id,
      { extensions: { conversationStatus: "busy", conversationActivity: "working" } } as never,
      undefined,
      { skipVersionSnapshot: true },
    );
    const after = JSON.parse((await chars.getById(created!.id))!.data as string) as {
      extensions: Record<string, unknown>;
    };
    assert.equal(after.extensions.conversationStatus, "busy", "status key written");
    assert.equal(after.extensions.conversationActivity, "working", "activity key written");
    assert.deepEqual(
      after.extensions.characterMemories,
      [{ id: "mem-1", text: "original" }],
      "a partial extensions patch keeps unrelated live keys",
    );
    assert.equal(after.extensions.conversationScheduleAutoRenew, false, "scalar extension keys survive too");

    // Source guard: the race itself (a write landing during the slow LLM call
    // or between read and update) cannot be staged deterministically, so pin
    // that no status write spreads a previously read extensions snapshot.
    const source = readFileSync(
      new URL("../../packages/server/src/routes/conversation.routes.ts", import.meta.url),
      "utf8",
    );
    for (const stale of ["...(charData.extensions ?? {})", "...(charData!.extensions ?? {})", "...currentExtensions"]) {
      assert.equal(source.includes(stale), false, `conversation.routes.ts no longer spreads ${stale} into a write`);
    }
  }

  console.log("Server hunt batch 12 regressions passed.");
} finally {
  if (app) await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
