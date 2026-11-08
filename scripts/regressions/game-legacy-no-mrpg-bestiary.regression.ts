/**
 * A Legacy game never meets the MRPG bestiary (owner's question, 2026-11-07): the encounter prompt
 * offers its families only to an MRPG game, and a Legacy fight that is handed an enemy carrying a
 * family and tier anyway (a model that wrote them unasked) starts as a Legacy fight, the enemy with the
 * numbers it came with. An MRPG game is offered the families and fights them as MRPG foes.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DirectedCombatView } from "../../packages/shared/src/features/combat-director.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-legacy-bestiary-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { combatDirectorRoutes } = await import("../../packages/server/src/routes/combat-director.routes.js");
const { marinaraEncounterBrief, buildInitPrompt } =
  await import("../../packages/server/src/routes/encounter.routes.js");

// The encounter's bestiary: MRPG games only, never a Legacy or a ruleset game.
const legacySetup = { genre: "fantasy", difficulty: "normal" };
const mrpgSetup = { ...legacySetup, marinaraClasses: true };
assert.equal(marinaraEncounterBrief({}, legacySetup, false), null, "a Legacy game gets no MRPG bestiary");
assert.equal(marinaraEncounterBrief({}, mrpgSetup, true), null, "a ruleset game gets its ruleset's bestiary");
assert.ok(marinaraEncounterBrief({}, mrpgSetup, false)!.menu.length > 0, "an MRPG game picks from the families");

const db = await getDB();
const app = Fastify();
const chats = createChatsStorage(db);
app.decorate("db", db);
await app.register(combatDirectorRoutes, { prefix: "/combat", chooseBoss: async () => "fallback" });
const unit = (id: string, name: string, side: "player" | "enemy", hp = 30) => ({
  id,
  name,
  side,
  hp,
  maxHp: hp,
  mp: 0,
  maxMp: 0,
  attack: 5,
  defense: 5,
  speed: 5,
  level: 1,
  skills: [],
});
// What an MRPG encounter puts on an enemy: its family and tier, read by an MRPG fight's start.
const tagged = { ...unit("e1", "Grave-Mound Wolf", "enemy", 14), family: "wolf", tier: "elite" };

const fight = async (setup: Record<string, unknown>) => {
  const chat = await chats.create({ name: "Bestiary check", mode: "game", characterIds: [] });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: { combatDirector: true, ...setup },
    gameCharacterCards: [
      {
        name: "Ayla",
        class: "Knight",
        temperament: "protective",
        rpgStats: { attributes: [{ name: "STR", value: 14 }], hp: { value: 30, max: 30 } },
      },
    ],
  });
  const started = await app.inject({
    method: "POST",
    url: "/combat/start",
    payload: {
      chatId: chat.id,
      anchor: anchor.id,
      style: "classic",
      party: [unit("p1", "Ayla", "player")],
      enemies: [tagged],
    },
  });
  assert.equal(started.statusCode, 200, started.body);
  return {
    session: started.json().session as DirectedCombatView,
    cards: JSON.parse((await chats.getById(chat.id))!.metadata).gameCharacterCards as Array<Record<string, unknown>>,
  };
};

try {
  const legacy = await fight(legacySetup);
  const wolf = legacy.session.enemies.find((one) => one.id === "e1")!;
  assert.equal((wolf as { marinara?: unknown }).marinara, undefined, "no MRPG fighter in a Legacy fight");
  assert.ok(
    legacy.session.party.every((one) => !(one as { marinara?: unknown }).marinara),
    "the party fights on its Legacy sheets",
  );
  assert.equal(wolf.maxHp, 14, "the enemy keeps the numbers it came with");
  assert.equal(wolf.attack, 5);
  assert.equal(legacy.cards[0]!.marinara, undefined, "a Legacy card is given no MRPG progression");

  const mrpg = await fight(mrpgSetup);
  assert.ok(
    mrpg.session.enemies.every((one) => (one as { marinara?: unknown }).marinara),
    "an MRPG fight's foes are MRPG fighters",
  );
  assert.ok(mrpg.cards[0]!.marinara, "and the card gets its progression");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("Legacy games never meet the MRPG bestiary; MRPG games do.");
