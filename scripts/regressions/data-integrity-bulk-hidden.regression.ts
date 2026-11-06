import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-data-integrity-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.MARINARA_ENV_FILE = join(dir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const schema = await import("../../packages/server/src/db/schema/index.js");
const db = await getDB();

const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
try {
  const storage = createChatsStorage(db);
  const chat = (await storage.create({
    name: "Visibility",
    mode: "roleplay",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
  }))!;
  const ids = await storage.createMessagesBatch(
    chat.id,
    [false, true].map((hidden) => ({
      role: "assistant" as const,
      characterId: null,
      content: "Selected",
      extra: { hiddenFromAI: hidden, keep: "message" },
      activeSwipeIndex: 1,
      swipes: [
        { index: 0, content: "Other", extra: { keep: "alternate" } },
        { index: 1, content: "Selected", extra: { hiddenFromAI: hidden, visibilityManual: false, keep: "active" } },
      ],
    })),
  );
  const beforeMessages = await db.select().from(schema.messages);
  const beforeSwipes = await db.select().from(schema.messageSwipes);
  for (const failAt of [1, 2, 4]) {
    const originalUpdate = db.update;
    let writes = 0;
    db.update = ((table: any) => {
      if (table === schema.messageSwipes && ++writes === failAt) throw new Error("injected swipe update failure");
      return originalUpdate(table);
    }) as typeof db.update;
    try {
      await assert.rejects(
        storage.bulkSetHiddenFromAI(chat.id, ids, true, { visibilityManual: true }),
        /injected swipe update failure/,
      );
    } finally {
      db.update = originalUpdate;
    }
    assert.deepEqual(
      await db.select().from(schema.messages),
      beforeMessages,
      "restore the failing message and exact metadata including absent keys",
    );
    assert.deepEqual(
      await db.select().from(schema.messageSwipes),
      beforeSwipes,
      "restore every alternate's distinct metadata",
    );
  }
  assert.deepEqual(
    await storage.bulkSetHiddenFromAI(chat.id, [...ids, ids[0]!, "foreign"], true, { visibilityManual: true }),
    [ids[0]],
  );
  for (const row of await db.select().from(schema.messageSwipes)) {
    assert.equal(JSON.parse(row.extra).hiddenFromAI, true);
    assert.equal(JSON.parse(row.extra).visibilityManual, true);
  }
  await Promise.all([
    storage.bulkSetHiddenFromAI(chat.id, ids, false),
    storage.updateMessageExtra(ids[0]!, { concurrent: "kept" }),
  ]);
  const concurrent = JSON.parse((await storage.getMessage(ids[0]!))!.extra);
  assert.equal(concurrent.concurrent, "kept");
  assert.equal(concurrent.hiddenFromAI, false);
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
