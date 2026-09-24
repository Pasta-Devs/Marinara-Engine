// Server hunt batch 51: chats and connections storage fixes.
//   - isValidLegacySchedule: a card schedule with a null block must not throw on
//     conversation chat create, and a block missing time/activity is rejected.
//   - setActiveSwipe to the already-active index is a no-op and keeps
//     message-only data such as attachments.
//   - createNote ids are time-sortable, so the pruning tie-break keeps the newest note.
//   - connections: a media provider never holds (or is returned as) the chat default.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b51-"));
const fileStorageDir = join(dataDir, "file-storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import(
  "../../packages/server/src/services/storage/connections.storage.js"
);
const { characters, apiConnections } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");

try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const chars = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);

  // ── isValidLegacySchedule ──
  {
    const makeCharacter = async (name: string, schedule: unknown) => {
      const row = (await chars.create({ name } as never)) as { id: string; data: string } | null;
      assert.ok(row, "character created");
      const data = JSON.parse(row.data) as Record<string, unknown>;
      const extensions = (data.extensions ?? {}) as Record<string, unknown>;
      await db
        .update(characters)
        .set({ data: JSON.stringify({ ...data, extensions: { ...extensions, conversationSchedule: schedule } }) })
        .where(eq(characters.id, row.id));
      return row.id;
    };
    const goodBlock = { time: "09:00-17:00", activity: "work", status: "online" };
    const week = (mon: unknown[]) => ({
      weekStart: "2026-09-21",
      inactivityThresholdMinutes: 30,
      talkativeness: 50,
      days: { mon },
    });
    const nullBlockId = await makeCharacter("Null block", week([null]));
    const noTimeId = await makeCharacter("No time", week([{ status: "idle" }]));
    const goodId = await makeCharacter("Good", week([goodBlock]));

    const created = (await chats.create({
      name: "Schedule chat",
      mode: "conversation",
      characterIds: [nullBlockId, noTimeId, goodId],
    } as never)) as { id: string; metadata: string } | null;
    assert.ok(created, "conversation chat create must not throw on a null schedule block");
    const meta = JSON.parse(created.metadata) as { characterSchedules?: Record<string, unknown> };
    const schedules = meta.characterSchedules ?? {};
    assert.ok(!(nullBlockId in schedules), "null block schedule is rejected");
    assert.ok(!(noTimeId in schedules), "block without time/activity is rejected");
    assert.ok(goodId in schedules, "valid schedule is still inherited");

    const resolved = await chats.resolveConversationSchedules(created.id);
    assert.ok(!(noTimeId in resolved) && !(nullBlockId in resolved), "resolve drops malformed schedules");
  }

  // ── setActiveSwipe same index keeps message-only attachments ──
  {
    const chat = (await chats.create({ name: "Swipe chat", mode: "roleplay", characterIds: [] } as never)) as {
      id: string;
    };
    const msg = (await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: "first",
    } as never)) as { id: string };
    await chats.addSwipe(msg.id, "second");
    const afterSwipe = (await chats.getMessage(msg.id)) as { activeSwipeIndex: number };
    const active = afterSwipe.activeSwipeIndex ?? 0;
    await chats.appendMessageAttachment(msg.id, { type: "image", url: "/img/a.png" });
    const result = (await chats.setActiveSwipe(msg.id, active)) as { extra: string } | null;
    assert.ok(result, "same-index select returns the message");
    const reread = (await chats.getMessage(msg.id)) as { extra: string; activeSwipeIndex: number };
    const extra = JSON.parse(reread.extra || "{}") as { attachments?: unknown[] };
    assert.equal(reread.activeSwipeIndex, active);
    assert.equal(extra.attachments?.length ?? 0, 1, "same-index select must not drop the attachment");
  }

  // ── createNote keeps the newest note under a createdAt tie ──
  {
    const source = (await chats.create({ name: "Src", mode: "conversation", characterIds: [] } as never)) as {
      id: string;
    };
    const target = (await chats.create({ name: "Dst", mode: "roleplay", characterIds: [] } as never)) as {
      id: string;
    };
    const RealDate = Date;
    const fixed = new RealDate("2026-01-01T00:00:00.000Z").getTime();
    // Freeze the clock so every note ties on createdAt.
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(fixed);
        else super(...(args as [number]));
      }
      static now() {
        return fixed;
      }
    } as DateConstructor;
    try {
      for (let round = 0; round < 8; round++) {
        await chats.createNote(source.id, target.id, `old-${round} ` + "x".repeat(3000));
        const newestId = (await chats.createNote(source.id, target.id, `new-${round} ` + "y".repeat(3000))) as
          | string
          | { id: string };
        const notes = (await chats.listNotes(target.id)) as Array<{ id: string; content: string }>;
        const newest = typeof newestId === "string" ? newestId : newestId?.id;
        assert.ok(
          notes.some((note) => note.content.startsWith(`new-${round} `)),
          `round ${round}: newest note must survive pruning (id ${newest})`,
        );
      }
    } finally {
      globalThis.Date = RealDate;
    }
  }

  // ── connections: media providers never hold the chat default ──
  {
    const lang = (await connections.create({
      name: "Lang",
      provider: "openai",
      model: "gpt",
      isDefault: true,
    } as never)) as { id: string };
    assert.equal(((await connections.getDefault()) as { id: string } | null)?.id, lang.id);

    const image = (await connections.create({
      name: "Img",
      provider: "image_generation",
      model: "img",
      isDefault: true,
    } as never)) as { id: string; isDefault: string };
    assert.equal(image.isDefault, "false", "media connection is never created as the chat default");
    assert.equal(
      ((await connections.getDefault()) as { id: string } | null)?.id,
      lang.id,
      "creating a media default must not unset the language default",
    );

    await connections.update(lang.id, { provider: "image_generation" } as never);
    const switched = (await connections.getById(lang.id)) as { isDefault: string };
    assert.equal(switched.isDefault, "false", "switching to a media provider clears isDefault");
    assert.equal(await connections.getDefault(), null, "no media connection is returned as the chat default");

    // Legacy rows already flagged on disk are ignored by getDefault.
    await db.update(apiConnections).set({ isDefault: "true" }).where(eq(apiConnections.id, image.id));
    assert.equal(await connections.getDefault(), null, "legacy media default row is ignored");
  }

  console.log("server-hunt-b51 regression passed");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
