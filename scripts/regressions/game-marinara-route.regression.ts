/**
 * Classic Marinara through the fight routes (2026-11-01): a game with the Classic Marinara classes
 * toggle starts a Classic fight with progressions made from the party's cards and written back, plays
 * it out through the command route, and once it is won writes XP onto the cards and the summary.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DirectedCombatView, DirectedCommand } from "../../packages/shared/src/features/combat-director.js";
const dataDir = mkdtempSync(join(tmpdir(), "marinara-classes-route-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { combatDirectorRoutes } = await import("../../packages/server/src/routes/combat-director.routes.js");
const db = await getDB(),
  app = Fastify(),
  chats = createChatsStorage(db);
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
const post = (url: string, payload: unknown) => app.inject({ method: "POST", url, payload });
try {
  const chat = await chats.create({ name: "Classic Marinara route proof", mode: "game", characterIds: [] });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: { combatDirector: true, marinaraClasses: true, difficulty: "normal" },
    gameCharacterCards: [
      { name: "Ayla", class: "Knight", temperament: "protective", temperamentInitial: "protective" },
      { name: "Corin", class: "Hedge mage", abilities: ["Firebolt"], temperament: "reckless" },
      { name: "Dessa", class: "Healer", temperament: "supportive" },
    ],
  });
  const started = await post("/combat/start", {
    chatId: chat.id,
    anchor: anchor.id,
    style: "classic",
    party: [unit("p1", "Ayla", "player"), unit("p2", "Corin", "player"), unit("p3", "Dessa", "player")],
    enemies: [unit("e1", "Bandit", "enemy", 12), unit("e2", "Bandit Archer", "enemy", 12)],
  });
  assert.equal(started.statusCode, 200, started.body);
  let s = started.json().session as DirectedCombatView;
  assert.ok(
    s.party.every((u) => u.marinara),
    "every party member fights as a Classic Marinara fighter",
  );
  const cardsAfterStart = JSON.parse((await chats.getById(chat.id))!.metadata || "{}").gameCharacterCards;
  assert.ok(
    cardsAfterStart.every((card: { marinara?: unknown }) => card.marinara),
    "each card was given its progression on its first fight",
  );
  assert.equal(cardsAfterStart[0].marinara.primary, "guard", "a knight's sheet reads as the Guard tree");

  const cmd = (command: DirectedCommand) =>
    post("/combat/command", {
      chatId: chat.id,
      anchor: anchor.id,
      id: s.id,
      instanceId: s.instanceId,
      revision: s.revision,
      requestId: crypto.randomUUID(),
      command,
    });
  for (let step = 0; step < 600 && !s.outcome; step++) {
    let command: DirectedCommand;
    if (s.stage === "action" && s.actorId) {
      const foe = s.enemies.find((u) => u.hp > 0)!;
      command = { type: "classic", action: { type: "attack", targetId: foe.id } };
    } else if (s.window) command = { type: "fallback" };
    else command = { type: "continue" };
    const response = await cmd(command);
    assert.equal(response.statusCode, 200, `${JSON.stringify(command)}: ${response.body}`);
    s = response.json().session;
  }
  assert.equal(s.outcome, "victory", "three heroes beat two bandits");
  assert.ok(s.summary?.marinara?.length, "the summary says what the party gained");
  const cardsAfter = JSON.parse((await chats.getById(chat.id))!.metadata || "{}").gameCharacterCards;
  assert.ok(
    cardsAfter.some(
      (card: { marinara: { xp: number; level: number } }) => card.marinara.xp > 0 || card.marinara.level > 1,
    ),
    "the XP is on the cards",
  );

  // A won fight where every foe left (surrendered or fled) saves with no enemies, and still reopens.
  {
    const { createGameEngineStateStorage } =
      await import("../../packages/server/src/services/storage/game-engine-state.storage.js");
    const { COMBAT_DIRECTOR_NAMESPACE } = await import("../../packages/server/src/routes/combat-director.routes.js");
    const store = createGameEngineStateStorage(db);
    const row = (await store.getByChatAndMessage(chat.id, anchor.id, 0, COMBAT_DIRECTOR_NAMESPACE))!;
    const saved = JSON.parse(row.state);
    saved.enemies = [];
    if (saved.tactical) saved.tactical.units = saved.tactical.units.filter((u: { side: string }) => u.side !== "enemy");
    await store.updateStateById(row.id, JSON.stringify(saved), true, chat.id);
    const reopened = await app.inject({ method: "GET", url: `/combat/state?chatId=${chat.id}&anchor=${anchor.id}` });
    assert.equal(reopened.statusCode, 200, `a won fight with every foe gone reopens: ${reopened.body}`);
  }

  // Between fights a party member switches to another open class; a class not open is refused.
  const { marinaraClassBlock, marinaraOpenClasses } =
    await import("../../packages/shared/src/features/marinara-classes.js");
  const corin = cardsAfter.find((card: { name: string }) => card.name === "Corin").marinara;
  const other = marinaraOpenClasses(corin).find(
    (def) => def.id !== corin.activeClass && !marinaraClassBlock(corin, def.id),
  );
  assert.ok(other, "a character opens a second tree's base class from the start");
  const switched = await post("/combat/marinara/progression", { chatId: chat.id, name: "Corin", classId: other!.id });
  assert.equal(switched.statusCode, 200, switched.body);
  assert.equal(switched.json().progression.activeClass, other!.id);
  const refused = await post("/combat/marinara/progression", { chatId: chat.id, name: "Corin", classId: "nope" });
  assert.equal(refused.statusCode, 400, "an unknown class is refused");
  const stored = JSON.parse((await chats.getById(chat.id))!.metadata || "{}").gameCharacterCards;
  assert.equal(stored.find((card: { name: string }) => card.name === "Corin").marinara.activeClass, other!.id);

  // Before their first fight the player picks a member's main tree and row (Classic UI review 2026-11-01);
  // the tree stays once they have gained experience, and the row reaches the fight.
  {
    const pickChat = await chats.create({ name: "Tree and row pick proof", mode: "game", characterIds: [] });
    await chats.patchMetadata(pickChat.id, {
      gameSetupConfig: { combatDirector: true, marinaraClasses: true, difficulty: "normal" },
      gameCharacterCards: [
        { name: "Wren", class: "Knight", temperament: "cautious", temperamentInitial: "cautious" },
        { name: "Brom", class: "Knight", temperament: "protective", temperamentInitial: "protective" },
      ],
    });
    const pick = (body: Record<string, unknown>) =>
      post("/combat/marinara/progression", { chatId: pickChat.id, name: "Wren", ...body });
    const picked = await pick({ primary: "marksman" });
    assert.equal(picked.statusCode, 200, picked.body);
    assert.equal(picked.json().progression.primary, "marksman", "a knight's player may still make them a Marksman");
    const rowed = await pick({ row: "front" });
    assert.equal(rowed.json().progression.row, "front");
    const repicked = await pick({ primary: "hexer" });
    assert.equal(repicked.json().progression.primary, "hexer", "the tree can change until they grow");
    assert.equal(repicked.json().progression.row, "front", "a re-pick keeps the row");
    const cleared = await pick({ row: null });
    assert.equal(cleared.json().progression.row, undefined, "null goes back to the class's own row");
    await pick({ row: "back" });
    const pickAnchor = await chats.createMessage({
      chatId: pickChat.id,
      role: "assistant",
      content: "[state: combat]",
    });
    const fought = await post("/combat/start", {
      chatId: pickChat.id,
      anchor: pickAnchor.id,
      style: "classic",
      party: [unit("p1", "Wren", "player"), unit("p2", "Brom", "player")],
      enemies: [unit("e1", "Bandit", "enemy", 12)],
    });
    assert.equal(fought.statusCode, 200, fought.body);
    const wren = (fought.json().session as DirectedCombatView).party[0]!;
    // (Brom, a Guard, stands in front; alone, Wren's back row would count as the front.)
    assert.equal(wren.marinara?.row, "back", "the picked row is the one they fight in");
    const meta = JSON.parse((await chats.getById(pickChat.id))!.metadata || "{}");
    meta.gameCharacterCards[0].marinara.xp = 40;
    await chats.patchMetadata(pickChat.id, { gameCharacterCards: meta.gameCharacterCards });
    const late = await pick({ primary: "blade" });
    assert.equal(late.statusCode, 400, "the tree is set once they have experience");
    // A new main tree for one who hasn't grown keeps their tamed beasts, and one who fell stays fallen
    // (Dottore review, PR 8964).
    const pickBrom = (body: Record<string, unknown>) =>
      post("/combat/marinara/progression", { chatId: pickChat.id, name: "Brom", ...body });
    const hound = { id: "c1", name: "Hound", stat: "spd" };
    const bromCards = JSON.parse((await chats.getById(pickChat.id))!.metadata || "{}").gameCharacterCards;
    const bromBefore = bromCards[1].marinara;
    assert.equal(bromBefore.xp, 0, "Brom hasn't grown yet");
    bromCards[1].marinara = { ...bromBefore, companions: [hound], activeCompanion: "c1" };
    await chats.patchMetadata(pickChat.id, { gameCharacterCards: bromCards });
    const retreed = await pickBrom({ primary: "scout" });
    assert.equal(retreed.statusCode, 200, retreed.body);
    assert.equal(retreed.json().progression.primary, "scout");
    assert.deepEqual(retreed.json().progression.companions, [hound], "a new main tree keeps their tamed beasts");
    assert.equal(retreed.json().progression.activeCompanion, "c1");
    const fallenCards = JSON.parse((await chats.getById(pickChat.id))!.metadata || "{}").gameCharacterCards;
    fallenCards[1].marinara = { ...fallenCards[1].marinara, fallen: true };
    await chats.patchMetadata(pickChat.id, { gameCharacterCards: fallenCards });
    const revived = await pickBrom({ primary: "guard" });
    assert.equal(revived.statusCode, 400, "a fallen member's tree can't be changed");
    const afterFall = JSON.parse((await chats.getById(pickChat.id))!.metadata || "{}").gameCharacterCards[1].marinara;
    assert.equal(afterFall.fallen, true, "and they stay fallen");
    assert.equal(afterFall.primary, "scout");
  }

  // The setup's bestiary families reach the fight through the start route, fitted to the fight's difficulty.
  const { marinaraBestiaryFor } = await import("../../packages/shared/src/features/marinara-bestiary.js");
  const family = marinaraBestiaryFor("high_fantasy", 1).find((one) => one.tiers.includes("standard"))!;
  const beastChat = await chats.create({ name: "Bestiary route proof", mode: "game", characterIds: [] });
  const beastAnchor = await chats.createMessage({
    chatId: beastChat.id,
    role: "assistant",
    content: "[state: combat]",
  });
  await chats.patchMetadata(beastChat.id, {
    gameSetupConfig: { combatDirector: true, marinaraClasses: true, difficulty: "normal", genre: "High Fantasy" },
    gameCharacterCards: [{ name: "Ayla", class: "Knight", temperament: "protective" }],
  });
  const beasts = await post("/combat/start", {
    chatId: beastChat.id,
    anchor: beastAnchor.id,
    style: "classic",
    party: [unit("p1", "Ayla", "player")],
    enemies: [0, 1, 2, 3, 4, 5].map((i) => ({
      ...unit(`b${i}`, `Beast ${i}`, "enemy"),
      marinara: { family: { familyId: family.id, tier: "standard" }, encounter: "easy" },
    })),
  });
  assert.equal(beasts.statusCode, 200, beasts.body);
  const fought = beasts.json().session as DirectedCombatView;
  assert.ok(fought.enemies.length < 6, "six beasts are too many for one hero on an easy fight");
  console.log("game-marinara-route: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
