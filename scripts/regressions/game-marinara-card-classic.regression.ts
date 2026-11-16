/**
 * The Classic picks on a library card (owner's pick 2026-11-05): the card's Game Mode section sets a
 * starting tree and up to two strong stats and one weak one. A game's first Classic fight makes the
 * progression with that tree, and the picks lean the hidden aptitudes; a card without picks keeps the
 * old guesses from the game card.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dataDir = mkdtempSync(join(tmpdir(), "marinara-card-classic-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { combatDirectorRoutes } = await import("../../packages/server/src/routes/combat-director.routes.js");
const party = await import("../../packages/shared/src/features/marinara-party.js");
const db = await getDB(),
  app = Fastify(),
  chats = createChatsStorage(db),
  characters = createCharactersStorage(db);
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
try {
  // Reading the picks: unknown values dropped, at most two strong, a weak stat never also strong.
  assert.deepEqual(
    party.readMarinaraCardClassic({ tree: "marksman", strong: ["skill", "speed", "luck", "nope"], weak: "skill" }),
    { tree: "marksman", strong: ["speed", "luck"], weak: "skill" },
  );
  assert.equal(party.readMarinaraCardClassic({ tree: "wizard", strong: [] }), undefined, "nothing picked");
  // A finished builder is kept even when every pick was left on Auto, so the card shows its picks.
  assert.deepEqual(party.readMarinaraCardClassic({ built: true }), { built: true }, "built with nothing picked");
  assert.deepEqual(
    party.readMarinaraCardClassic({ built: "yes", weak: "luck" }),
    { weak: "luck" },
    "built is only true",
  );
  assert.equal(party.marinaraArchetypeInText("A soft-spoken archer from the marsh"), "marksman");
  assert.equal(party.marinaraArchetypeInText("A baker"), null, "no tree words reads as none");

  // The picks lean the aptitudes the same seed would otherwise roll.
  const plain = party.createMarinaraCardProgression({
    gameId: "g",
    card: { name: "Seren" },
    temperament: "patient",
  });
  const leaned = party.createMarinaraCardProgression({
    gameId: "g",
    card: { name: "Seren" },
    temperament: "patient",
    classic: { tree: "marksman", strong: ["speed"], weak: "strength" },
  });
  assert.equal(plain.primary, "blade", "no card words: the old fallback");
  assert.equal(leaned.primary, "marksman", "the card's starting tree wins");
  assert.ok(leaned.aptitudes.speed > plain.aptitudes.speed, "a strong stat leans its aptitude up");
  assert.ok(leaned.aptitudes.strength < plain.aptitudes.strength, "a weak stat leans its aptitude down");

  // Through the fight route: the chat's library card carries the picks; the game card says "Knight".
  const made = await characters.create({
    name: "Seren Vale",
    description: "A knight of the marsh.",
    extensions: { classic: { tree: "marksman", strong: ["skill", "speed"], weak: "strength" } },
  } as never);
  const chat = await chats.create({ name: "Card picks proof", mode: "game", characterIds: [made.id] });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: { combatDirector: true, marinaraClasses: true, difficulty: "normal" },
    gameCharacterCards: [
      { name: "Seren Vale", class: "Knight", temperament: "patient", temperamentInitial: "patient" },
      { name: "Brom", class: "Knight", temperament: "protective", temperamentInitial: "protective" },
    ],
  });
  const started = await app.inject({
    method: "POST",
    url: "/combat/start",
    payload: {
      chatId: chat.id,
      anchor: anchor.id,
      style: "classic",
      party: [unit("p1", "Seren Vale", "player"), unit("p2", "Brom", "player")],
      enemies: [unit("e1", "Bandit", "enemy", 12)],
    },
  });
  assert.equal(started.statusCode, 200, started.body);
  const cards = JSON.parse((await chats.getById(chat.id))!.metadata || "{}").gameCharacterCards;
  const seren = cards.find((card: { name: string }) => card.name === "Seren Vale").marinara;
  const brom = cards.find((card: { name: string }) => card.name === "Brom").marinara;
  assert.equal(seren.primary, "marksman", "the library card's tree beats the game card's Knight");
  assert.equal(brom.primary, "guard", "a member without picks keeps the guess from the game card");
  console.log("game-marinara-card-classic: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
