/**
 * A character added to a game on a ruleset from the Characters panel or Chat Settings (PATCH
 * /api/chats/:id) joins with a copy of their card's ruleset sheet, as one the Game Master recruits
 * does: the laptop playtest (2026-10-24) found Kesh, a level 5 monk, on a blank level-1 sheet. One
 * who already has a game card keeps it, and a game with no ruleset gets no card from here. The game's
 * party list follows who joins and leaves, on any game (six in the chat, four in the party, the same
 * playtest).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "marinara-party-add-sheet-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");

const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  const ember = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
  ) as Record<string, any>;
  await createGameRulesetsStorage(db).put({
    rulesetId: "local/ember-roads",
    version: ember.version,
    sourceKind: "local",
    definition: JSON.stringify(ember),
  });
  const ability = ember.sheet.abilities[0].id as string;
  const characters = createCharactersStorage(db);
  const sheet = { v: 1, build: { abilities: { [ability]: 4 } } };
  const kesh = await characters.create(
    characterDataSchema.parse({ name: "Kesh", extensions: { rulesetSheets: { "local/ember-roads": sheet } } }),
  );
  const mara = await characters.create(characterDataSchema.parse({ name: "Mara" }));
  const bram = await characters.create(characterDataSchema.parse({ name: "Bram" }));
  const game = async (ruleset: boolean) => {
    const made = await chats.create({
      name: "Party add",
      mode: "game",
      characterIds: [bram.id],
      connectionId: null,
      promptPresetId: null,
    });
    assert.ok(made);
    await chats.patchMetadata(made.id, {
      ...(ruleset
        ? { gameRuleset: { id: "local/ember-roads", version: ember.version, packageId: null, options: {} } }
        : {}),
      gameCharacterCards: [{ name: "Bram", class: "Ranger", rulesetSheet: { v: 1, build: {} } }],
      gamePartyCharacterIds: [bram.id, "npc:guide"],
    });
    return made;
  };
  const cardsOf = async (chatId: string) => {
    const row = await chats.getById(chatId);
    const meta = (typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata) as Record<string, any>;
    return meta.gameCharacterCards as Array<Record<string, any>>;
  };
  const partyOf = async (chatId: string) => {
    const row = await chats.getById(chatId);
    const meta = (typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata) as Record<string, any>;
    return meta.gamePartyCharacterIds as string[];
  };
  const add = (chatId: string, ids: string[]) =>
    app.inject({ method: "PATCH", url: `/api/chats/${chatId}`, payload: { characterIds: ids } });

  const played = await game(true);
  const response = await add(played.id, [bram.id, kesh.id, mara.id]);
  assert.equal(response.statusCode, 200, response.body);
  const cards = await cardsOf(played.id);
  assert.deepEqual(
    cards.map((card) => card.name),
    ["Bram", "Kesh", "Mara"],
  );
  assert.equal(cards[0]!.class, "Ranger", "a member who had a card keeps it");
  assert.equal(cards[1]!.rulesetSheet.build.abilities[ability], 4, "Kesh joins with his own sheet");
  assert.ok(cards[2]!.rulesetSheet, "Mara, with no sheet of her own, joins with a blank one");
  // The response carries the new cards, which the client caches.
  const answered = JSON.parse(response.body);
  const answeredMeta = typeof answered.metadata === "string" ? JSON.parse(answered.metadata) : answered.metadata;
  assert.equal(answeredMeta.gameCharacterCards.length, 3);
  // Sent again, nothing is added twice.
  await add(played.id, [bram.id, kesh.id, mara.id]);
  assert.equal((await cardsOf(played.id)).length, 3);
  // The party list follows who joins and leaves, its NPCs kept.
  assert.deepEqual(await partyOf(played.id), [bram.id, "npc:guide", kesh.id, mara.id]);
  await add(played.id, [bram.id, kesh.id]);
  assert.deepEqual(await partyOf(played.id), [bram.id, "npc:guide", kesh.id]);

  // A game with no ruleset is left as it was.
  const plain = await game(false);
  await add(plain.id, [bram.id, kesh.id]);
  assert.equal((await cardsOf(plain.id)).length, 1);
  assert.deepEqual(await partyOf(plain.id), [bram.id, "npc:guide", kesh.id], "its party list follows too");

  console.log("game-party-add-sheet: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
