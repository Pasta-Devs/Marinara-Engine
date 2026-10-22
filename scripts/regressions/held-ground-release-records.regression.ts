// What the game keeps of a Held Ground release (Capability API 1.369):
//   - a release the story leaves for an unfinished fight names that fight, and only that fight lets it go;
//   - a fight's record that it let the ground go is kept only while its step is saved: a save that throws
//     puts the record and the waiting release back as they were;
//   - a release whose party sheets could not be read says so rather than forgiving the Owing silently.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-ground-records-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const {
  heldGroundReleaseDueInFight,
  keepHeldGroundPending,
  keepHeldGroundReleasedWhile,
  pendingRelease,
  rollStoryOwingWith,
} = await import("../../packages/server/src/services/game/story-held-ground.service.js");

try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Held ground records", mode: "game", characterIds: [] });
  assert(chat);
  const metaNow = async () => JSON.parse((await chats.getById(chat.id))?.metadata || "{}") as Record<string, unknown>;
  const release = { id: "autumn", label: "The Held Autumn", felled: "die" as const, owing: { track: "owing" } };
  const fightOn = (id: string) =>
    ({ id, style: "ruleset", rulesetFight: { encounter: { heldGround: { label: "Held" } } } }) as never;

  // Left for fight A: fight A lets it go; fight B does not spend it.
  await keepHeldGroundPending(db, chat.id, release, "fight-a");
  assert.equal(pendingRelease(await metaNow())?.fight, "fight-a");
  assert.deepEqual(await heldGroundReleaseDueInFight(db, chat.id, fightOn("fight-a")), release);
  assert.equal(await heldGroundReleaseDueInFight(db, chat.id, fightOn("fight-b")), null, "another fight's");

  // The step that lets it go fails to save: the record is not kept, and the release still waits.
  await assert.rejects(
    keepHeldGroundReleasedWhile(db, chat.id, "autumn", async () => {
      const during = await metaNow();
      assert.equal((during.gameHeldGroundReleased as { id?: string } | null)?.id, "autumn", "kept while saving");
      assert.equal(during.gameHeldGroundPending ?? null, null);
      throw new Error("the fight could not be saved");
    }),
    /could not be saved/,
  );
  const after = await metaNow();
  assert.equal(after.gameHeldGroundReleased ?? null, null, "a failed save keeps no record");
  assert.equal(pendingRelease(after)?.id, "autumn", "and the release still waits for its fight");

  // Saved: the record is kept and the waiting release dropped.
  assert.equal(await keepHeldGroundReleasedWhile(db, chat.id, "autumn", async () => "saved"), "saved");
  const saved = await metaNow();
  assert.equal((saved.gameHeldGroundReleased as { id?: string }).id, "autumn");
  assert.equal(saved.gameHeldGroundPending ?? null, null);

  // No sheets to roll from: the Game Master is told the debts were not rolled.
  const turn = { tells: [], sheet: "", released: release } as never;
  const told = rollStoryOwingWith(null, {}, turn);
  assert.ok(
    told.tells.some((line) => /sheets could not be read/.test(line)),
    JSON.stringify(told.tells),
  );
  console.log("Held ground records: a release waits for its own fight, and its record lives only with its save.");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
