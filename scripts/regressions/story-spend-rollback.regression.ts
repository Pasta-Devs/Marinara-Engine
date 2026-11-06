// An item use that costs a story number (Capability API 1.359) is kept with the game only while the
// fight saves the step that used it. A save that throws takes the spend back, so the request's replay
// is judged against the story as it was and the flag is charged once, by the replay that was saved.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-story-spend-rollback-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { gameStorySpends, keepStorySpendWhile } =
  await import("../../packages/server/src/services/game/story-item-uses.service.js");

try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Story spend rollback", mode: "game", characterIds: [] });
  assert(chat);
  const spendsNow = async () => gameStorySpends(JSON.parse((await chats.getById(chat.id))?.metadata || "{}"));
  const jar = { flag: "debts_settled", add: -2, label: "Jar of Someone Else's Death" };

  // The first attempt's save throws: the spend is gone again, and the error still reaches the route.
  await assert.rejects(
    keepStorySpendWhile(db, chat.id, { ...jar, id: "first" }, async () => {
      assert.deepEqual(
        (await spendsNow()).map((each) => each.id),
        ["first"],
        "kept while the step is saved",
      );
      throw new Error("the fight could not be saved");
    }),
    /could not be saved/,
  );
  assert.deepEqual(await spendsNow(), [], "a failed save charges nothing");

  // The replay of the same request is saved: charged once, by it.
  const saved = await keepStorySpendWhile(db, chat.id, { ...jar, id: "replay" }, async () => "saved");
  assert.equal(saved, "saved");
  assert.deepEqual(
    (await spendsNow()).map((each) => each.id),
    ["replay"],
  );
  // A withdrawal that fails too is said in a warn line, and the step's own error still reaches the
  // route rather than the withdrawal's.
  const warnings: unknown[][] = [];
  const warn = logger.warn.bind(logger);
  logger.warn = ((...args: unknown[]) => void warnings.push(args)) as typeof logger.warn;
  let failing = false;
  const flaky = new Proxy(db, {
    get(target, key, receiver) {
      if (failing) throw new Error("the database went away");
      return Reflect.get(target, key, receiver);
    },
  });
  try {
    await assert.rejects(
      keepStorySpendWhile(flaky, chat.id, { ...jar, id: "stranded" }, async () => {
        failing = true;
        throw new Error("the fight could not be saved");
      }),
      /could not be saved/,
    );
  } finally {
    logger.warn = warn;
  }
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]![0] instanceof Error && /went away/.test((warnings[0]![0] as Error).message));
  assert.match(String(warnings[0]![1]), /could not be taken back/);
  console.log("Story spend rollback: a save that fails takes its spend back; the saved replay is charged once.");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
