/**
 * A card that brings only a Legacy sheet into an MRPG game (owner 2026-11-06): a check before any fight
 * rolls on the MRPG stats its first fight will give it, never on the Legacy numbers, and that first fight
 * makes exactly those stats.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mrpg-legacy-card-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [{ loadSkillCheckModifierContext }, { marinaraFightStart }, { getDB, closeDB }, { createChatsStorage }] =
  await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/marinara-fight-start.service.js"),
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/services/storage/chats.storage.js"),
  ]);

try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "The marsh", mode: "game", characterIds: [] });
  const card = {
    name: "Wren",
    class: "Ranger",
    abilities: ["Volley"],
    shortDescription: "A patient hunter.",
    temperament: "patient",
    temperamentInitial: "patient",
    rpgStats: {
      attributes: [
        { name: "STR", value: 8 },
        { name: "DEX", value: 18 },
      ],
      hp: { value: 30, max: 30 },
    },
  };
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: { marinaraClasses: true },
    gameCharacterCards: [card],
  });

  const context = await loadSkillCheckModifierContext(db, chat.id);
  assert.ok(context.mrpgStats, "a check before any fight reads MRPG stats");
  assert.equal(context.attributes, null, "and not the Legacy sheet's attributes");

  const unit = { id: "p1", name: "Wren", side: "player", hp: 1, maxHp: 1, mp: 0, maxMp: 0, attack: 1, defense: 1 };
  const start = marinaraFightStart({
    gameId: chat.id,
    cards: [card],
    party: [unit as never],
    enemies: [],
    difficulty: "normal",
    storyFight: true,
  });
  const made = start.cards?.[0]?.marinara as { stats: unknown } | undefined;
  assert.deepEqual(context.mrpgStats, made?.stats, "the first fight gives the stats the checks already used");

  // A Legacy game keeps rolling on the Legacy sheet.
  const legacy = await chats.create({ name: "The old road", mode: "game", characterIds: [] });
  await chats.patchMetadata(legacy.id, { gameCharacterCards: [card] });
  const legacyContext = await loadSkillCheckModifierContext(db, legacy.id);
  assert.equal(legacyContext.mrpgStats, undefined, "a Legacy game has no MRPG stats");

  console.log("game-mrpg-legacy-card-checks: ok");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
