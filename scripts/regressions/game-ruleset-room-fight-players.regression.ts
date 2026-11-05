/**
 * A shared room's fight (owner's decision 2026-10-26): every room player plays their own character's
 * turns.
 *
 * What is pinned here:
 *   - The fight knows whose own character each party member is, read from the host's live room: the
 *     host's, each guest's, and nobody's for a companion no player plays.
 *   - Defaults: the host's own character is the host's; a companion nobody plays is the Engine's as in a
 *     solo game; a guest's character is the guest's to play (2026-10-27), the Engine's only while that
 *     guest is not connected as the fight starts, and never covered by what the host chose for their own
 *     companions before.
 *   - A command acting for a party member (ruleset, choose, deploy, control, orders) is accepted only
 *     from the player who owns it: the host owns their own and the unowned ones, a guest only their
 *     own. A command about the whole fight is the host's. A refusal changes nothing and says why in a
 *     stable code.
 *   - The view tells each viewer which members are theirs, and sends the menu only to the one whose
 *     member is asked. A guest who leaves hands their character back to the host.
 *   - The host's stand-in for a dead or absent character is never another player's.
 *   - Through the room (2026-10-27): the room is told each time the fight moves; a guest is shown the fight
 *     on the board now as theirs, and their commands go through the same checks as the host's, a shape
 *     aimed at a square catching whoever the menu says it catches there.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  rulesetSheetBuildSchema,
  type DirectedCombatView,
  type DirectedCommand,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-room-fight-players-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { createGameEngineStateStorage } =
  await import("../../packages/server/src/services/storage/game-engine-state.storage.js");
const { combatDirectorRoutes, COMBAT_DIRECTOR_NAMESPACE } =
  await import("../../packages/server/src/routes/combat-director.routes.js");
const { ROOM_GUEST_FIGHT_CONTROLLER, roomFightPlayers } =
  await import("../../packages/server/src/services/multiplayer/fight-players.js");
const {
  commandRulesetCombatDirector,
  directedRulesetView,
  rulesetCommandRefusal,
  rulesetCompanionIds,
  rulesetController,
  rulesetCombatantOf,
  RULESET_ROOM_HOST,
} = await import("../../packages/server/src/services/game/ruleset-combat-director.service.js").then((module) => ({
  ...module,
  rulesetCombatantOf: (state: any, id: string) =>
    state.rulesetFight.encounter.combatants.find((one: { id: string }) => one.id === id),
}));

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const RULESET_ID = "local/5e-room";
const document = JSON.parse(read("../../docs/development/ruleset-5e-2014.example.json")) as Record<string, any>;
document.id = "5e-room";
const parsed = parseRulesetDefinition(JSON.parse(JSON.stringify(document)));
assert.ok(parsed.ok, `the fixture ruleset must import: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
const definition: RulesetDefinition = parsed.definition;

const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
const fighter = (hp: number) =>
  build({
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 14, speed: 30, hp_max: hp },
    lists: {
      attacks: [
        { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
      ],
    },
  });

const HOST = { id: "host_participant", displayName: "Hana", name: "Brenna" };
const GUEST = { id: "guest_participant", displayName: "Gil", name: "Corwin" };
const participant = (who: typeof HOST, isHost: boolean) => ({
  id: who.id,
  displayName: who.displayName,
  persona: { name: who.name, description: "" },
  isHost,
  joinsNextRound: false,
  lastSequence: -1,
});
const room = (guests: boolean) => ({
  version: 1,
  role: "host",
  roomId: "room_fixture_01",
  status: "active",
  participants: [participant(HOST, true), ...(guests ? [participant(GUEST, false)] : [])],
  characters: [],
});

const unit = (id: string, name: string, side: "player" | "enemy") => ({
  id,
  name,
  side,
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 6,
  speed: 6,
  level: 3,
  skills: [],
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
let bridge: import("../../packages/server/src/routes/combat-director.routes.js").RoomFightBridge | undefined;
let absent = new Set<string>();
const changed: string[] = [];
await app.register(combatDirectorRoutes, {
  prefix: "/combat",
  room: { absent: () => absent, changed: (chatId: string) => changed.push(chatId), ready: (ready) => (bridge = ready) },
});
const chats = createChatsStorage(db);
const states = createGameStateStorage(db);
const store = createGameEngineStateStorage(db);
await createGameRulesetsStorage(db).put({
  rulesetId: RULESET_ID,
  version: 1,
  sourceKind: "local",
  definition: JSON.stringify(document),
});
const host = await createCharactersStorage(db).createPersona(HOST.name, "The host's character.");
assert.ok(host);
const post = (url: string, payload: unknown) => app.inject({ method: "POST", url, payload });

async function newRoomGame(extra: Record<string, unknown> = {}) {
  const chat = await chats.create({ name: "Room fight", mode: "game", characterIds: [], personaId: host!.id });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: { combatDirector: true, difficulty: "Normal" },
    gameRuleset: { id: RULESET_ID, version: 1, packageId: null, options: {} },
    gameCharacterCards: [
      { name: "Brenna", rulesetSheet: { v: 1, build: fighter(40) }, multiplayerParticipantId: HOST.id },
      { name: "Corwin", rulesetSheet: { v: 1, build: fighter(36) }, multiplayerParticipantId: GUEST.id },
      { name: "Dace", rulesetSheet: { v: 1, build: fighter(32) } },
    ],
    multiplayer: room(true),
    ...extra,
  });
  await states.create({
    chatId: chat.id,
    messageId: anchor.id,
    swipeIndex: 0,
    date: "",
    time: "",
    location: "road",
    weather: "",
    temperature: "",
    worldCustomFields: [],
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: {},
    hiddenTrackerFields: [],
    committed: true,
  });
  return { chat, anchor };
}

try {
  // ── Whose each member is, read from the room ──
  {
    const party = [
      { id: "brenna", name: "Brenna" },
      { id: "corwin", name: "Corwin" },
      { id: "dace", name: "Dace" },
    ];
    const meta = { multiplayer: room(true), gameCharacterCards: [] };
    assert.deepEqual(roomFightPlayers(meta, party), {
      brenna: { participantId: HOST.id, name: "Hana", host: true },
      corwin: { participantId: GUEST.id, name: "Gil" },
    });
    // A card bound to the player wins over a persona name, as a renamed persona's card is.
    assert.deepEqual(
      roomFightPlayers(
        { multiplayer: room(true), gameCharacterCards: [{ name: "Dace", multiplayerParticipantId: GUEST.id }] },
        party,
      )?.dace,
      { participantId: GUEST.id, name: "Gil" },
    );
    assert.equal(roomFightPlayers({}, party), undefined, "no room, no players");
    assert.equal(
      roomFightPlayers({ multiplayer: { ...room(true), status: "ended" } }, party),
      undefined,
      "an ended room has no players",
    );
    assert.equal(
      roomFightPlayers({ multiplayer: room(true) }, [...party, { id: "corwin2", name: "corwin" }])?.corwin,
      undefined,
      "two members by one name are never guessed between",
    );
    // A room's fight is set up around every player's own character (room playtest 2026-10-27).
    const { roomCharacterNames } = await import("../../packages/server/src/services/multiplayer/fight-players.js");
    const { withRoomCharacters } = await import("../../packages/server/src/routes/encounter.routes.js");
    const named = roomCharacterNames({
      multiplayer: room(true),
      gameCharacterCards: [{ name: "Dace", multiplayerParticipantId: GUEST.id }],
    });
    assert.equal(named?.host?.name, "Brenna");
    assert.deepEqual(named?.others, ["Dace"]);
    assert.equal(roomCharacterNames({}), null, "no room, no characters");
    const filled = withRoomCharacters([{ name: "Brenna", hp: 12, maxHp: 12, isPlayer: true }], named!.others);
    assert.deepEqual(
      filled.map((member) => member.name),
      ["Brenna", "Dace"],
      "a player's character the setup left out joins the party",
    );
    assert.equal(withRoomCharacters([{ name: "dace" }], ["Dace"]).length, 1, "one already there is not added twice");
  }

  // ── A room fight through the real routes ──
  // The host once handed every companion to themselves; that never covers the guest's character.
  const game = await newRoomGame({ combatControllers: { corwin: "manual", dace: "ai" } });
  const body = {
    chatId: game.chat.id,
    anchor: game.anchor.id,
    style: "ruleset",
    party: [unit("brenna", "Brenna", "player"), unit("corwin", "Corwin", "player"), unit("dace", "Dace", "player")],
    enemies: [unit("hound", "Cinder Hound", "enemy"), unit("hound2", "Cinder Hound", "enemy")],
  };
  const start = await post("/combat/start", body);
  assert.equal(start.statusCode, 200, start.body);
  let s = start.json().session as DirectedCombatView;
  assert.equal(s.ruleset!.lead, "brenna", "the host plays their own character");
  assert.deepEqual(s.ruleset!.players, {
    brenna: { participantId: HOST.id, name: "Hana", host: true },
    corwin: { participantId: GUEST.id, name: "Gil" },
  });
  assert.deepEqual([...s.ruleset!.yours!].sort(), ["brenna", "dace"], "the host commands their own and Dace");
  const controllerOf = (id: string) => s.party.find((member) => member.id === id)?.controller;
  assert.equal(controllerOf("brenna"), "manual");
  assert.equal(controllerOf("dace"), "ai", "a companion nobody plays is the Engine's, as in a solo game");
  assert.equal(ROOM_GUEST_FIGHT_CONTROLLER, "manual");
  assert.equal(
    controllerOf("corwin"),
    ROOM_GUEST_FIGHT_CONTROLLER,
    "the guest's character is played for them, whatever the host chose before",
  );
  assert.ok(!s.ruleset!.deploy?.ids.includes("corwin"), "the host never sets the guest's character down");

  const cmd = (command: DirectedCommand) =>
    post("/combat/command", {
      chatId: game.chat.id,
      anchor: game.anchor.id,
      id: s.id,
      instanceId: s.instanceId,
      revision: s.revision,
      requestId: crypto.randomUUID(),
      command,
    });
  const accept = async (command: DirectedCommand) => {
    const response = await cmd(command);
    assert.equal(response.statusCode, 200, response.body);
    s = response.json().session;
  };
  const refuse = async (command: DirectedCommand, code: string, error?: string) => {
    const revision = s.revision;
    const response = await cmd(command);
    assert.equal(response.statusCode, 400, `${command.type}: ${response.body}`);
    assert.equal(response.json().code, code, command.type);
    if (error) assert.equal(response.json().error, error);
    const after = await app.inject({ url: `/combat/state?chatId=${game.chat.id}&anchor=${game.anchor.id}` });
    assert.equal(after.json().session.revision, revision, "a refusal changes nothing");
  };

  // The guest's character is the guest's alone: the host may neither take it, order it nor place it.
  await refuse(
    { type: "control", unitId: "corwin", controller: "manual" },
    "ruleset_combat_not_yours",
    "Corwin is Gil's to play.",
  );
  await refuse({ type: "orders", unitId: "corwin", orders: { posture: "guard" } }, "ruleset_combat_not_yours");
  await refuse({ type: "deploy", unitId: "corwin", to: { x: 0, y: 0 } }, "ruleset_combat_not_yours");
  // The unowned companion stays the host's to hand over, and every companion at once means the host's.
  await accept({ type: "control", unitId: "dace", controller: "manual" });
  assert.equal(controllerOf("dace"), "manual");
  await accept({ type: "controlCompanions", controller: "ai" });
  assert.equal(controllerOf("dace"), "ai");
  assert.equal(controllerOf("corwin"), ROOM_GUEST_FIGHT_CONTROLLER, "and leaves the guest's character alone");
  const remembered = JSON.parse((await chats.getById(game.chat.id))!.metadata || "{}").combatControllers;
  assert.equal(remembered.dace, "ai");
  assert.equal(remembered.corwin, "manual", "only what the host chose for their own is remembered over");

  // ── The same fight seen and commanded by each player (the model a guest's path will use) ──
  {
    const row = await store.getByChatAndMessage(game.chat.id, game.anchor.id, 0, COMBAT_DIRECTOR_NAMESPACE);
    const state = JSON.parse(row!.state);
    const fight = state.rulesetFight;
    const guest = { host: false, participantId: GUEST.id };
    const stranger = { host: false, participantId: "someone_else" };
    // Once guests command their fights, their character is theirs to play.
    fight.controllers.corwin = "manual";
    assert.deepEqual(rulesetCompanionIds(state, fight), ["dace"], "the host's companions leave the guest's out");
    // Begun, and walked to the guest's turn by the Engine and the host's own picks.
    if (fight.deploy) assert.equal(commandRulesetCombatDirector(definition, state, { type: "deployed" }).ok, true);
    fight.controllers.brenna = "ai";
    for (let guard = 0; guard < 40; guard++) {
      const actor = fight.encounter.combatants.find(
        (one: { id: string }) => one.id === fight.encounter.order[fight.encounter.turn],
      );
      if (actor?.id === "corwin" && !fight.encounter.window && !state.window) break;
      assert.equal(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok, true);
    }
    assert.equal(rulesetController(state, fight, rulesetCombatantOf(state, "corwin")), "manual");
    const hostView = directedRulesetView(definition, state, RULESET_ROOM_HOST)!;
    const guestView = directedRulesetView(definition, state, guest)!;
    assert.equal(hostView.actorId, "corwin");
    assert.equal(hostView.options, undefined, "the host is not offered the guest's turn");
    assert.ok(guestView.options?.length, "the guest is");
    assert.deepEqual(guestView.yours, ["corwin"], "the guest commands only their own");
    assert.equal(directedRulesetView(definition, state, stranger)!.options, undefined);
    const end = guestView.options!.find((option) => option.kind === "end-turn")!;
    const ruleset: DirectedCommand = { type: "ruleset", optionId: end.id, targetIds: [] };
    assert.equal(rulesetCommandRefusal(state, fight, ruleset, RULESET_ROOM_HOST)?.code, "ruleset_combat_not_yours");
    assert.equal(rulesetCommandRefusal(state, fight, ruleset, stranger)?.code, "ruleset_combat_not_yours");
    assert.equal(rulesetCommandRefusal(state, fight, ruleset, guest), null, "the guest plays their own turn");
    const control = (unitId: string): DirectedCommand => ({ type: "control", unitId, controller: "ai" });
    assert.equal(rulesetCommandRefusal(state, fight, control("corwin"), guest), null);
    assert.equal(rulesetCommandRefusal(state, fight, control("dace"), guest)?.code, "ruleset_combat_not_yours");
    assert.equal(rulesetCommandRefusal(state, fight, control("brenna"), guest)?.error, "Brenna is Hana's to play.");
    assert.equal(rulesetCommandRefusal(state, fight, control("dace"), RULESET_ROOM_HOST), null);
    for (const whole of [
      { type: "continue" },
      { type: "flee" },
      { type: "controlCompanions", controller: "ai" },
    ] as const)
      assert.equal(rulesetCommandRefusal(state, fight, whole, guest)?.code, "ruleset_combat_host_only", whole.type);
    assert.equal(commandRulesetCombatDirector(definition, state, ruleset).ok, true, "and the resolver takes it");
    // Outside a room nothing is checked: the one player commands the whole party.
    delete fight.players;
    assert.equal(rulesetCommandRefusal(state, fight, control("corwin"), RULESET_ROOM_HOST), null);
    assert.equal(directedRulesetView(definition, state)!.yours, undefined);
  }

  // ── A guest who leaves hands their character back to the host ──
  await chats.patchMetadata(game.chat.id, { multiplayer: room(false) });
  const left = await app.inject({ url: `/combat/state?chatId=${game.chat.id}&anchor=${game.anchor.id}` });
  s = left.json().session;
  assert.equal(s.ruleset!.players?.corwin, undefined);
  assert.ok(s.ruleset!.yours!.includes("corwin"));
  await accept({ type: "control", unitId: "corwin", controller: "manual" });
  assert.equal(controllerOf("corwin"), "manual");

  // ── The host's stand-in is never another player's character ──
  {
    const away = await newRoomGame();
    const response = await post("/combat/start", {
      ...body,
      chatId: away.chat.id,
      anchor: away.anchor.id,
      // The host's own Brenna is not sent to this fight; the guest's Corwin is first in line.
      party: [unit("corwin", "Corwin", "player"), unit("dace", "Dace", "player")],
    });
    assert.equal(response.statusCode, 200, response.body);
    const view = response.json().session as DirectedCombatView;
    assert.equal(view.ruleset!.lead, "dace", "the host plays the companion nobody else plays");
    assert.equal(view.party.find((member) => member.id === "dace")?.controller, "manual");
    assert.equal(view.party.find((member) => member.id === "corwin")?.controller, ROOM_GUEST_FIGHT_CONTROLLER);
  }

  // ── Outside a room nothing changes ──
  {
    const solo = await newRoomGame({});
    await chats.patchMetadata(solo.chat.id, { multiplayer: { ...room(true), status: "ended" } });
    const response = await post("/combat/start", { ...body, chatId: solo.chat.id, anchor: solo.anchor.id });
    assert.equal(response.statusCode, 200, response.body);
    const view = response.json().session as DirectedCombatView;
    assert.equal(view.ruleset!.players, undefined);
    assert.equal(view.ruleset!.yours, undefined);
    assert.equal(view.party.find((member) => member.id === "corwin")?.controller, "ai", "a companion, as in solo");
  }

  // ── Through the room (2026-10-27) ──
  {
    assert.ok(bridge, "the routes hand the room its bridge");
    const guest = { host: false, participantId: GUEST.id };
    // A guest not connected as the fight starts has the Engine play for them until they take it back.
    absent = new Set([GUEST.id]);
    const late = await newRoomGame();
    const begun = await post("/combat/start", { ...body, chatId: late.chat.id, anchor: late.anchor.id });
    assert.equal(begun.statusCode, 200, begun.body);
    const lateView = begun.json().session as DirectedCombatView;
    assert.equal(lateView.party.find((member) => member.id === "corwin")?.controller, "ai");
    assert.ok(changed.includes(late.chat.id), "the room is told a fight began");
    absent = new Set();

    const fresh = await newRoomGame();
    const opened = await post("/combat/start", {
      ...body,
      positioned: true,
      chatId: fresh.chat.id,
      anchor: fresh.anchor.id,
    });
    assert.equal(opened.statusCode, 200, opened.body);
    let hostView = opened.json().session as DirectedCombatView;
    assert.equal(hostView.party.find((member) => member.id === "corwin")?.controller, "manual");
    const shown = async () => {
      const seen = await bridge!.view(fresh.chat.id, guest);
      assert.ok(seen, "the guest is shown the fight on the board now");
      assert.equal(seen.anchor, fresh.anchor.id);
      return seen.view;
    };
    let guestView = await shown();
    assert.deepEqual(guestView.ruleset!.yours, ["corwin"]);
    // Set down first, the guest places their own character and the host keeps theirs (room playtest 2026-10-27).
    assert.deepEqual(guestView.ruleset!.deploy?.ids, ["corwin"]);
    assert.deepEqual(hostView.ruleset!.deploy?.ids, ["brenna"]);
    const send = (command: DirectedCommand, at = guestView) =>
      bridge!.command(
        fresh.chat.id,
        { anchor: fresh.anchor.id, id: at.id, instanceId: at.instanceId!, revision: at.revision, command },
        guest,
      );
    const hostSend = async (command: DirectedCommand) => {
      const response = await post("/combat/command", {
        chatId: fresh.chat.id,
        anchor: fresh.anchor.id,
        id: hostView.id,
        instanceId: hostView.instanceId,
        revision: hostView.revision,
        requestId: crypto.randomUUID(),
        command,
      });
      assert.equal(response.statusCode, 200, response.body);
      hostView = response.json().session;
    };
    // Someone else's character is not the guest's, and a command at an old revision moves nothing.
    assert.deepEqual(await send({ type: "control", unitId: "brenna", controller: "ai" }), { ok: false, stale: false });
    const before = changed.length;
    assert.deepEqual(await send({ type: "control", unitId: "corwin", controller: "ai" }), { ok: true });
    assert.ok(changed.length > before, "the room is told the fight moved");
    assert.deepEqual(await send({ type: "control", unitId: "corwin", controller: "manual" }), {
      ok: false,
      stale: true,
    });
    guestView = await shown();
    assert.deepEqual(await send({ type: "control", unitId: "corwin", controller: "manual" }), { ok: true });
    // The host begins and plays their own side on its own, until the guest's character is asked.
    hostView = (await app.inject({ url: `/combat/state?chatId=${fresh.chat.id}&anchor=${fresh.anchor.id}` })).json()
      .session;
    if (hostView.ruleset!.deploy) await hostSend({ type: "deployed" });
    await hostSend({ type: "control", unitId: "brenna", controller: "ai" });
    for (let guard = 0; guard < 60; guard++) {
      guestView = await shown();
      if (guestView.ruleset!.options?.length || guestView.outcome) break;
      await hostSend({ type: "continue" });
    }
    assert.equal(guestView.ruleset!.actorId, "corwin", "the fight reaches the guest's own turn");
    assert.equal(hostView.ruleset!.options, undefined, "which the host is not offered");
    const end = guestView.ruleset!.options!.find((option) => option.kind === "end-turn")!;
    assert.deepEqual(await send({ type: "ruleset", optionId: end.id, targetIds: [] }), { ok: true });
    guestView = await shown();
    assert.notEqual(guestView.ruleset!.actorId, "corwin", "the guest's turn is played");
    // A guest who goes away mid-fight (Leave, or gone quiet) has the Engine play their character, and the
    // fight does not wait on them (laptop room playtest 2026-10-30).
    absent = new Set([GUEST.id]);
    hostView = (await app.inject({ url: `/combat/state?chatId=${fresh.chat.id}&anchor=${fresh.anchor.id}` })).json()
      .session;
    assert.equal(hostView.party.find((member) => member.id === "corwin")?.controller, "ai");
    absent = new Set();
  }

  console.log("game-ruleset-room-fight-players: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
