/**
 * Ruleset combat, slice C3a: the real routes.
 *
 * What is pinned here:
 *   - ONE ledger and one idempotency scheme. A restart is idempotent, a stale revision changes
 *     nothing, a replayed request id changes nothing, and a refused choice spends neither.
 *   - A `ruleset` command from the browser goes through the resolver's own menu and answers 400
 *     with a stable `code` when the rules refuse it.
 *   - The party's live sheet state is written where the sheet reads it after every accepted step,
 *     and rides back on the response so the client's store needs no refetch.
 *   - A classic fight in a game with no ruleset behaves exactly as it did before this style existed.
 *   - The boss window asks the Game Master for one candidate id, and a good id, a bad id and
 *     garbage all leave the fight resolvable.
 *   - The encounter blueprint asks for opponents in the ruleset's own terms only when the ruleset
 *     resolves its own fights, and a malformed proposal costs its opponent the proposal.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  RULESET_MOVE_OPTION,
  RULESET_PASS_OPTION,
  rulesetSheetBuildSchema,
  type DirectedCombatView,
  type DirectedCommand,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-combat-route-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { createGameEngineStateStorage } =
  await import("../../packages/server/src/services/storage/game-engine-state.storage.js");
const { combatDirectorRoutes, COMBAT_DIRECTOR_NAMESPACE } =
  await import("../../packages/server/src/routes/combat-director.routes.js");
const { buildInitPrompt, encounterBlueprintSchema, encounterRulesetBrief } =
  await import("../../packages/server/src/routes/encounter.routes.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
// An imported ruleset keeps its own bare id in the file and is filed under a namespaced one, which
// is what a game pins. That is the shortest way to give this lane a ruleset with no package.
const RULESET_ID = "local/5e-fight";
const document = JSON.parse(read("../../docs/development/ruleset-5e-2014.example.json")) as Record<string, any>;
document.id = "5e-fight";

const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
const spellEntries = [
  {
    id: "mending-light",
    label: "Mending Light",
    rows: [{ list: "spells", values: { name: "Mending Light", level: 1, prepared: true } }],
    mechanics: {
      kind: "heal",
      targets: "ally",
      amount: { dice: "1d8", flat: 4 },
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
] as unknown as RulesetCatalogEntry[];
const spellRows = spellEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));
// The fixture ruleset carries the catalog the party's rows point at, so the server finds it the way
// it finds any catalog: from the ruleset the game pins.
document.catalogs = [
  ...(document.catalogs ?? []),
  { id: "spells", label: "Spells", feeds: ["spells"], entries: spellEntries },
];
// And a creature written as a sheet whose spell lives in that same catalog, which the route has to
// load for the BESTIARY as well as for the party, or the creature walks in with nothing to cast.
document.catalogs
  .find((catalog: Record<string, any>) => catalog.id === "creatures")
  .entries.push({
    id: "hedge-mender",
    label: "Hedge Mender",
    creature: {
      tier: "cr_1",
      sheet: {
        abilities: { str: 8, dex: 12, con: 12, int: 10, wis: 16, cha: 10 },
        fields: { level: 3, ac: 12, hp_max: 22, spellcasting_ability: "wis", slots_max_1: 2 },
        lists: { spells: [{ name: "Mending Light", level: 1, prepared: true, _catalog: "spells/mending-light" }] },
      },
    },
  });
const parsed = parseRulesetDefinition(JSON.parse(JSON.stringify(document)));
assert.ok(parsed.ok, `the fixture ruleset must import: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
const definition: RulesetDefinition = parsed.definition;
const fixtureText = JSON.stringify(document);

const fighterBuild = build({
  abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
  saves: { str_save: "proficient", con_save: "proficient" },
  // Deliberately easy to hit: this lane has to see a blow land on a sheet, not roll for it.
  fields: { level: 7, ac: 1, speed: 30, hp_max: 60 },
  lists: {
    attacks: [
      { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
    ],
  },
});
const wizardBuild = build({
  abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
  saves: { int_save: "proficient", wis_save: "proficient" },
  fields: { level: 7, ac: 1, speed: 30, hp_max: 38, spellcasting_ability: "int", slots_max_1: 4 },
  lists: { spells: spellRows },
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
let bossAnswer: string | null = null;
let bossCalls = 0;
await app.register(combatDirectorRoutes, {
  prefix: "/combat",
  chooseBoss: async () => {
    bossCalls++;
    if (bossAnswer === null) throw new Error("the Game Master answered with garbage");
    return bossAnswer;
  },
});
const chats = createChatsStorage(db);
const states = createGameStateStorage(db);
await createGameRulesetsStorage(db).put({
  rulesetId: RULESET_ID,
  version: 1,
  sourceKind: "local",
  definition: fixtureText,
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
const post = (url: string, payload: unknown) => app.inject({ method: "POST", url, payload });

async function newGame(options: { ruleset: boolean; gm?: boolean }) {
  const chat = await chats.create({ name: "Ruleset fight", mode: "game", characterIds: [] });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: { combatDirector: true, gmBossControl: options.gm === true, difficulty: "Normal" },
    ...(options.ruleset
      ? {
          gameRuleset: { id: RULESET_ID, version: 1, packageId: null, options: {} },
          gameCharacterCards: [
            { name: "Brenna", rulesetSheet: { v: 1, build: fighterBuild } },
            { name: "Corwin", rulesetSheet: { v: 1, build: wizardBuild } },
            { name: "Tam" },
          ],
        }
      : {}),
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

const storedLive = async (chatId: string) => {
  const row = await states.getLatest(chatId);
  return row?.rulesetLive ? (JSON.parse(row.rulesetLive as string) as Record<string, unknown>) : null;
};
const poolOf = (live: unknown, sheet: RulesetSheetBuild, key: string) =>
  readRulesetLive(definition, sheet, live).pools.find((entry) => entry.key === key);

try {
  // ── A ruleset fight, start to finish, through the real routes ──
  const game = await newGame({ ruleset: true });
  const body = {
    chatId: game.chat.id,
    anchor: game.anchor.id,
    style: "ruleset",
    party: [unit("brenna", "Brenna", "player"), unit("corwin", "Corwin", "player")],
    enemies: [
      { ...unit("lurker", "Thorn Lurker", "enemy"), creature: "creatures/thorn-lurker" },
      unit("lurker2", "Thorn Lurker", "enemy"),
      unit("hound", "Cinder Hound", "enemy"),
    ],
  };
  const start = await post("/combat/start", body);
  assert.equal(start.statusCode, 200, start.body);
  let s = start.json().session as DirectedCombatView;
  assert.equal(s.style, "ruleset");
  assert.ok(s.ruleset, "a ruleset fight carries its own view");
  assert.equal(s.ruleset!.ruleset.id, RULESET_ID);
  assert.equal(s.ruleset!.combatants.length, 5);
  assert.equal(s.ruleset!.combatants.find((c) => c.id === "brenna")!.health.max, 60, "the sheet's own maximum");
  assert.equal(s.party.find((u) => u.id === "brenna")!.maxHp, 60, "and the Engine's array agrees");
  assert.deepEqual(s.ruleset!.adjustments, [], "a creature out of the bestiary needs no adjusting");
  assert.deepEqual(
    (await post("/combat/start", body)).json().session,
    s,
    "reopening a ruleset fight returns the one already on the ledger",
  );

  const cmd = (command: DirectedCommand, requestId = crypto.randomUUID(), revision = s.revision) =>
    post("/combat/command", {
      chatId: game.chat.id,
      anchor: game.anchor.id,
      id: s.id,
      instanceId: s.instanceId,
      revision,
      requestId,
      command,
    });
  const accept = async (command: DirectedCommand) => {
    const response = await cmd(command);
    assert.equal(response.statusCode, 200, response.body);
    s = response.json().session;
    return response;
  };

  // A stale revision changes nothing and hands back the current session.
  const staleRevision = s.revision;
  await accept({ type: "control", unitId: "corwin", controller: "ai" });
  const stale = await cmd(
    { type: "control", unitId: "corwin", controller: "manual" },
    crypto.randomUUID(),
    staleRevision,
  );
  assert.equal(stale.statusCode, 200);
  assert.equal(stale.json().session.revision, s.revision, "a stale revision is answered, not applied");
  assert.equal(stale.json().session.ruleset.combatants.length, 5);
  await accept({ type: "control", unitId: "corwin", controller: "manual" });

  // A replayed request id changes nothing either.
  const replayed = crypto.randomUUID();
  const revisionBefore = s.revision;
  await cmd({ type: "control", unitId: "corwin", controller: "ai" }, replayed, revisionBefore);
  const again = await cmd({ type: "control", unitId: "corwin", controller: "ai" }, replayed, revisionBefore);
  assert.equal(again.json().session.revision, revisionBefore + 1, "the replay is the same answer, not a second step");
  s = again.json().session;
  await accept({ type: "control", unitId: "corwin", controller: "manual" });

  // Walk to a turn the player plays, one `continue` at a time.
  for (let guard = 0; guard < 20 && s.ruleset!.controller !== "manual" && !s.outcome; guard++) {
    await accept({ type: "continue" });
  }
  assert.equal(s.ruleset!.controller, "manual", "the fight stops at the human");
  assert.equal(s.stage, "action");
  assert.ok(s.ruleset!.options?.length, "and a menu is sent with it");
  for (const option of s.ruleset!.options!) {
    assert.ok(Array.isArray(option.targetIds), "every option lists who it may be pointed at");
  }

  // A choice the rules refuse changes nothing, spends no request id and says why in a code.
  const refusedRevision = s.revision;
  const refused = await cmd({ type: "ruleset", optionId: "nothing-like-this", targetIds: ["lurker"] });
  assert.equal(refused.statusCode, 400, refused.body);
  assert.equal(refused.json().code, "ruleset_combat_unknown-option");
  assert.ok(refused.json().error, "and a sentence beside the code");
  const afterRefusal = await app.inject({
    url: `/combat/state?chatId=${game.chat.id}&anchor=${game.anchor.id}`,
  });
  assert.equal(afterRefusal.json().session.revision, refusedRevision, "a refusal never bumps the revision");

  const sheetOf = (id: string) => (id === "brenna" ? fighterBuild : wizardBuild);

  // Play the rest out with nobody manual, and check a hit on a party member reaches the sheet.
  for (const member of ["brenna", "corwin"]) await accept({ type: "control", unitId: member, controller: "ai" });
  let hurt = false;
  for (let guard = 0; guard < 160 && !s.outcome; guard++) {
    await accept({ type: "continue" });
    // Whoever the opponents went for: the picker aims at the party member it expects to hurt most.
    const wounded = s.ruleset!.combatants.find((c) => c.side === "party" && c.health.value < c.health.max);
    if (!hurt && wounded) {
      hurt = true;
      const live = await storedLive(game.chat.id);
      const hp = poolOf(live?.[wounded.id], sheetOf(wounded.id), "hp");
      assert.ok(hp, "a hit on a party member writes their health where the sheet reads it");
      assert.equal(hp!.value, wounded.health.value, "and the row and the fight hold the same number");
      assert.equal(
        s.party.find((u) => u.id === wounded.id)!.hp,
        wounded.health.value,
        "and so does the Engine's array",
      );
    }
  }
  assert.ok(s.outcome, `the fight finished: ${s.outcome}`);
  assert.equal(s.stage, "finished");
  assert.ok(s.summary, "the Engine's own summary is filled");
  assert.ok(s.ruleset!.summary, "and the ruleset's own summary rides beside it");
  assert.ok(hurt, "somebody in the party was hit at least once");
  assert.equal((await cmd({ type: "continue" })).statusCode, 400, "a finished fight takes no more commands");

  // ── The same routes, a game with no ruleset, unchanged ──
  {
    const plain = await newGame({ ruleset: false });
    const classic = await post("/combat/start", {
      chatId: plain.chat.id,
      anchor: plain.anchor.id,
      style: "classic",
      party: [unit("hero", "Hero", "player")],
      enemies: [unit("thug", "Thug", "enemy")],
    });
    assert.equal(classic.statusCode, 200, classic.body);
    const session = classic.json().session as DirectedCombatView;
    assert.equal(session.style, "classic");
    assert.equal(session.ruleset, undefined, "no ruleset, no ruleset view");
    const response = await post("/combat/command", {
      chatId: plain.chat.id,
      anchor: plain.anchor.id,
      id: session.id,
      instanceId: session.instanceId,
      revision: session.revision,
      requestId: crypto.randomUUID(),
      command: { type: "ruleset", optionId: "anything", targetIds: [] },
    });
    assert.equal(response.statusCode, 400, "a ruleset command is not a classic fight's command");
    assert.equal(await storedLive(plain.chat.id), null, "and nothing wrote live sheet state");
    // A ruleset fight cannot be started for a game that pins none. Its own anchor, because a
    // restart at an anchor that already holds a fight is answered with that fight.
    const fresh = await chats.createMessage({
      chatId: plain.chat.id,
      role: "assistant",
      content: "[state: combat]",
    });
    const refusedStart = await post("/combat/start", {
      chatId: plain.chat.id,
      anchor: fresh.id,
      style: "ruleset",
      party: [unit("hero", "Hero", "player")],
      enemies: [unit("thug", "Thug", "enemy")],
    });
    assert.equal(refusedStart.statusCode, 400);
    assert.match(refusedStart.json().error, /does not pin a ruleset/);
  }

  // ── A player who swiped back: the fight writes the row the sheet SHOWS, not the newest one ──
  {
    const swiped = await newGame({ ruleset: true });
    const shown = await states.getByChatAndMessage(swiped.chat.id, swiped.anchor.id, 0);
    assert.ok(shown, "the row of the telling the player is looking at");
    // A later telling of the same message, which the player swiped away from. It is the NEWEST row.
    const { id: _id, createdAt: _createdAt, ...telling } = shown!;
    await states.create({
      ...telling,
      swipeIndex: 1,
      worldCustomFields: [],
      presentCharacters: [],
      recentEvents: [],
      fieldLocks: {},
      hiddenTrackerFields: [],
      committed: true,
    } as Parameters<typeof states.create>[0]);
    assert.equal((await states.getLatest(swiped.chat.id))?.swipeIndex, 1, "the newest row is the other telling");
    const opened = await post("/combat/start", {
      chatId: swiped.chat.id,
      anchor: swiped.anchor.id,
      style: "ruleset",
      party: [unit("corwin", "Corwin", "player")],
      enemies: [{ ...unit("lurker", "Thorn Lurker", "enemy"), creature: "creatures/thorn-lurker" }],
    });
    assert.equal(opened.statusCode, 200, opened.body);
    let fight = opened.json().session as DirectedCombatView;
    const send = async (command: DirectedCommand) => {
      const response = await post("/combat/command", {
        chatId: swiped.chat.id,
        anchor: swiped.anchor.id,
        id: fight.id,
        instanceId: fight.instanceId,
        revision: fight.revision,
        requestId: crypto.randomUUID(),
        command,
      });
      assert.equal(response.statusCode, 200, response.body);
      fight = response.json().session;
      return response;
    };
    for (let guard = 0; guard < 20 && fight.ruleset!.controller !== "manual" && !fight.outcome; guard++) {
      await send({ type: "continue" });
    }
    const priced = fight.ruleset!.options?.find((option) => (option.cost?.length ?? 0) > 0);
    assert.ok(priced, "the wizard has something on the menu that spends a pool");
    // One wizard and one opponent, so who is on turn and what they can pay for is certain, whatever
    // seed the route drew: this is where the write-back is checked number by number.
    const answer = await send({ type: "ruleset", optionId: priced!.id, targetIds: [priced!.targetIds[0]!] });
    const payload = answer.json() as { rulesetLive?: Record<string, unknown> };
    assert.ok(payload.rulesetLive, "an accepted step carries the new live sheet state back");
    const spentPool = poolOf(payload.rulesetLive!.corwin, wizardBuild, priced!.cost![0]!.pool);
    assert.ok(spentPool, `the spent pool ${priced!.cost![0]!.pool} is in the written state`);
    assert.equal(
      spentPool!.value,
      spentPool!.max - 1,
      "one lower than a fresh sheet, because the fight spent it through the sheet's own rules",
    );
    const liveOf = async (swipeIndex: number) =>
      (await states.getByChatAndMessage(swiped.chat.id, swiped.anchor.id, swipeIndex))?.rulesetLive ?? null;
    const shownLive = await liveOf(0);
    assert.ok(shownLive, "the spent pool is on the row the sheet shows");
    assert.deepEqual(
      (JSON.parse(shownLive as string) as Record<string, unknown>).corwin,
      payload.rulesetLive!.corwin,
      "and that row holds exactly what came back",
    );
    assert.equal(await liveOf(1), null, "and the telling the player swiped away from is untouched");
  }

  // ── A ruleset fight on a board, through the real routes ──
  {
    const boarded = await newGame({ ruleset: true });
    const opened = await post("/combat/start", {
      chatId: boarded.chat.id,
      anchor: boarded.anchor.id,
      style: "ruleset",
      positioned: true,
      party: [unit("brenna", "Brenna", "player")],
      enemies: [{ ...unit("lurker", "Thorn Lurker", "enemy"), creature: "creatures/thorn-lurker" }],
    });
    assert.equal(opened.statusCode, 200, opened.body);
    let fight = opened.json().session as DirectedCombatView;
    const grid = fight.ruleset!.grid;
    assert.ok(grid, "asking for a board on a ruleset that declares a cell size gets one");
    assert.deepEqual(grid!.distance, { label: "ft", perCell: 5 }, "and it says what one cell is worth");
    assert.equal(grid!.tiles.length, grid!.height);
    for (const row of grid!.tiles) assert.equal(row.length, grid!.width);
    // The board sizes are the tactical style's own; this fight has no generator of its own.
    assert.ok(grid!.width >= 12 && grid!.width <= 14 && grid!.height >= 8 && grid!.height <= 10);
    for (const combatant of fight.ruleset!.combatants) {
      assert.equal(typeof combatant.x, "number", `${combatant.id} stands somewhere`);
      assert.ok(combatant.x! >= 0 && combatant.x! < grid!.width && combatant.y! >= 0 && combatant.y! < grid!.height);
      assert.ok((combatant.movement ?? 0) >= 1, "and walks what its own numbers say");
    }

    const send = async (command: DirectedCommand) => {
      const response = await post("/combat/command", {
        chatId: boarded.chat.id,
        anchor: boarded.anchor.id,
        id: fight.id,
        instanceId: fight.instanceId,
        revision: fight.revision,
        requestId: crypto.randomUUID(),
        command,
      });
      if (response.statusCode === 200) fight = response.json().session;
      return response;
    };
    for (let guard = 0; guard < 20 && fight.ruleset!.controller !== "manual" && !fight.outcome; guard++) {
      await send({ type: "continue" });
    }
    assert.equal(fight.ruleset!.controller, "manual", "the fight stops at the human");

    // Every attack the menu offers is filtered by where the actor stands, and the refusal for one
    // further off than it reaches carries its own code. The board's own deployment strips put the
    // two sides a long way apart, and both sides of this are asserted so the seed cannot matter.
    const mine = fight.ruleset!.combatants.find((combatant) => combatant.id === fight.ruleset!.actorId)!;
    const foe = fight.ruleset!.combatants.find((combatant) => combatant.side === "enemy" && !combatant.defeated)!;
    const away = Math.max(Math.abs(mine.x! - foe.x!), Math.abs(mine.y! - foe.y!));
    const sword = fight.ruleset!.options!.find((option) => option.kind === "attack")!;
    assert.ok(sword, "the fighter's own weapon is on the menu");
    if (away > 1) {
      assert.equal(sword.targetIds.includes(foe.id), false, "somebody that far off is not on the sword's list");
      const refusedReach = await send({ type: "ruleset", optionId: sword.id, targetIds: [foe.id] });
      assert.equal(refusedReach.statusCode, 400, refusedReach.body);
      assert.equal(refusedReach.json().code, "ruleset_combat_out-of-reach");
    } else {
      assert.equal(sword.targetIds.includes(foe.id), true, "and somebody in the next square is");
    }

    // A walk the menu offered is taken, and where they ended up survives a reload.
    const move = fight.ruleset!.options!.find((option) => option.id === RULESET_MOVE_OPTION)!;
    assert.ok(move, "a positioned menu offers the walk");
    assert.ok(move.cells!.length > 0);
    const target = move.cells![0]!;
    const walked = await send({
      type: "ruleset",
      optionId: RULESET_MOVE_OPTION,
      targetIds: [],
      to: { x: target.x, y: target.y },
    });
    assert.equal(walked.statusCode, 200, walked.body);
    const mover = fight.ruleset!.combatants.find((combatant) => combatant.id === mine.id)!;
    assert.equal(mover.x, target.x);
    assert.equal(mover.y, target.y);
    assert.equal(mover.movementLeft, mine.movementLeft! - target.cost);
    const reloaded = await app.inject({
      url: `/combat/state?chatId=${boarded.chat.id}&anchor=${boarded.anchor.id}`,
    });
    assert.equal(reloaded.statusCode, 200, reloaded.body);
    const saved = (reloaded.json().session as DirectedCombatView).ruleset!;
    assert.deepEqual(saved.grid, grid, "the board is stored and read back exactly");
    const restored = saved.combatants.find((combatant) => combatant.id === mine.id)!;
    assert.equal(restored.x, target.x);
    assert.equal(restored.y, target.y);
    assert.equal(restored.movementLeft, mover.movementLeft);

    // A save the resolver could not have written is refused rather than resumed: two standing
    // combatants on one cell, or somebody inside something solid, would make every distance wrong.
    {
      const engineStates = createGameEngineStateStorage(db);
      const row = await engineStates.getByChatAndMessage(
        boarded.chat.id,
        boarded.anchor.id,
        0,
        COMBAT_DIRECTOR_NAMESPACE,
      );
      assert.ok(row, "the positioned fight is stored under the director's own namespace");
      const honest = row.state;
      const stateUrl = `/combat/state?chatId=${boarded.chat.id}&anchor=${boarded.anchor.id}`;
      const tamper = async (change: (combatants: Array<Record<string, unknown>>, tiles: string[][]) => void) => {
        const doc = JSON.parse(honest);
        change(doc.rulesetFight.encounter.combatants, doc.rulesetFight.encounter.board.grid.tiles);
        await engineStates.updateStateById(row.id, JSON.stringify(doc), undefined, boarded.chat.id);
        return app.inject({ url: stateUrl });
      };
      // Two of them standing on one square is NOT refused: a walk may end on a fallen ally, and
      // healing that ally stands two people on one square, which the resolver itself does.
      const stacked = await tamper((combatants) => {
        combatants[1]!.x = combatants[0]!.x;
        combatants[1]!.y = combatants[0]!.y;
      });
      assert.equal(stacked.statusCode, 200, stacked.body);
      const walled = await tamper((combatants, tiles) => {
        tiles[combatants[0]!.y as number]![combatants[0]!.x as number] = "wall";
      });
      assert.equal(walled.statusCode, 400, walled.body);
      assert.match(walled.json().error, /Invalid saved position/);
      // A fight with NO board carrying any coordinate at all is refused, whatever the value is.
      for (const stray of [{ y: 2 }, { x: null }, { x: "2" }] as Array<Record<string, unknown>>) {
        const doc = JSON.parse(honest);
        delete doc.rulesetFight.encounter.board;
        for (const combatant of doc.rulesetFight.encounter.combatants) {
          delete combatant.x;
          delete combatant.y;
          delete combatant.movement;
          delete combatant.movementLeft;
        }
        Object.assign(doc.rulesetFight.encounter.combatants[0], stray);
        await engineStates.updateStateById(row.id, JSON.stringify(doc), undefined, boarded.chat.id);
        const answer = await app.inject({ url: stateUrl });
        assert.equal(answer.statusCode, 400, `${JSON.stringify(stray)} is not a position: ${answer.body}`);
        assert.match(answer.json().error, /Invalid saved position/);
      }

      // Off the board altogether is still refused.
      const outside = await tamper((combatants, tiles) => {
        combatants[1]!.x = tiles[0]!.length + 5;
      });
      assert.equal(outside.statusCode, 400, outside.body);
      assert.match(outside.json().error, /Invalid saved position/);
      await engineStates.updateStateById(row.id, honest, undefined, boarded.chat.id);
      assert.equal((await app.inject({ url: stateUrl })).statusCode, 200, "the honest save is back");
    }

    // A cell the menu did not offer is refused with its own code, and bumps nothing.
    const revisionBefore = fight.revision;
    const nowhere = await send({ type: "ruleset", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 63, y: 63 } });
    assert.equal(nowhere.statusCode, 400, nowhere.body);
    assert.equal(nowhere.json().code, "ruleset_combat_unreachable");
    assert.equal(fight.revision, revisionBefore, "a refusal never bumps the revision");

    // And the fight still ends.
    await send({ type: "control", unitId: "brenna", controller: "ai" });
    for (let guard = 0; guard < 200 && !fight.outcome; guard++) await send({ type: "continue" });
    assert.ok(fight.outcome, `a positioned fight finishes: ${fight.outcome}`);
  }

  // ── The same game without asking for a board is the fight it always was ──
  {
    const flatGame = await newGame({ ruleset: true });
    const opened = await post("/combat/start", {
      chatId: flatGame.chat.id,
      anchor: flatGame.anchor.id,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player")],
      enemies: [{ ...unit("lurker", "Thorn Lurker", "enemy"), creature: "creatures/thorn-lurker" }],
    });
    assert.equal(opened.statusCode, 200, opened.body);
    const flat = opened.json().session as DirectedCombatView;
    assert.equal(flat.ruleset!.grid, undefined, "no board was asked for, so none was drawn");
    for (const combatant of flat.ruleset!.combatants) {
      assert.equal(combatant.x, undefined);
      assert.equal(combatant.movementLeft, undefined);
    }
    assert.equal(
      (flat.ruleset!.options ?? []).some((option) => option.kind === "move"),
      false,
      "and nothing on the menu walks anywhere",
    );
  }

  // ── A creature's sheet reads its spells out of the ruleset's other catalogs ──
  {
    const game4 = await newGame({ ruleset: true });
    const response = await post("/combat/start", {
      chatId: game4.chat.id,
      anchor: game4.anchor.id,
      style: "ruleset",
      // Brenna has no spells of her own, so nothing loads the spell catalog for the party's sake.
      party: [unit("brenna", "Brenna", "player")],
      enemies: [{ ...unit("mender", "Hedge Mender", "enemy"), creature: "creatures/hedge-mender" }],
    });
    assert.equal(response.statusCode, 200, response.body);
    const row = await createGameEngineStateStorage(db).getByChatAndMessage(
      game4.chat.id,
      game4.anchor.id,
      0,
      COMBAT_DIRECTOR_NAMESPACE,
    );
    const stored = JSON.parse(row!.state) as {
      rulesetFight: { encounter: { combatants: Array<Record<string, any>> } };
    };
    const mender = stored.rulesetFight.encounter.combatants.find((combatant) => combatant.id === "mender");
    assert.ok(mender?.sheet, "the creature fights with its sheet");
    assert.ok(
      (mender.actions as Array<{ label: string }>).some((action) => action.label === "Mending Light"),
      "and the spell its sheet lists, read out of the catalog the route loaded for it",
    );
    // And the saved fight, sheet and all, loads back.
    const reread = await app.inject({ url: `/combat/state?chatId=${game4.chat.id}&anchor=${game4.anchor.id}` });
    assert.equal(reread.statusCode, 200, reread.body);
  }

  // ── A party member with no sheet is refused by name ──
  {
    const game3 = await newGame({ ruleset: true });
    const response = await post("/combat/start", {
      chatId: game3.chat.id,
      anchor: game3.anchor.id,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player"), unit("tam", "Tam", "player")],
      enemies: [{ ...unit("lurker", "Thorn Lurker", "enemy") }],
    });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /^Tam has no ruleset sheet/);
  }

  // ── The Game Master's window: a good id, a bad id and garbage ──
  for (const answer of ["good", "bad", "garbage"] as const) {
    const bossGame = await newGame({ ruleset: true, gm: true });
    const bossBody = {
      chatId: bossGame.chat.id,
      anchor: bossGame.anchor.id,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player")],
      // The sturdiest creature the fixture ships, so the boss always lives long enough to be asked.
      enemies: [{ ...unit("sentinel", "Hollow Sentinel", "enemy"), boss: { points: 3, anticipation: true } }],
    };
    const opened = await post("/combat/start", bossBody);
    assert.equal(opened.statusCode, 200, opened.body);
    let boss = opened.json().session as DirectedCombatView;
    const send = async (command: DirectedCommand) => {
      const response = await app.inject({
        method: "POST",
        url: "/combat/command",
        payload: {
          chatId: bossGame.chat.id,
          anchor: bossGame.anchor.id,
          id: boss.id,
          instanceId: boss.instanceId,
          revision: boss.revision,
          requestId: crypto.randomUUID(),
          command,
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      boss = response.json().session;
      return response;
    };
    await send({ type: "control", unitId: "brenna", controller: "ai" });
    const callsBefore = bossCalls;
    let windows = 0;
    let held = 0;
    for (let guard = 0; guard < 300 && !boss.outcome; guard++) {
      if (boss.window?.controller === "gm") {
        windows++;
        assert.equal(boss.stage, "decision");
        assert.ok(
          boss.window.options.every((option) => typeof option.optionId === "string"),
          "every window option carries the ruleset's own option id",
        );
        // A decision the fight is holding open may always be declined, and it says so exactly once:
        // letting the moment go by is one of the candidates the Engine's own picker weighs, not an
        // extra line added beside them. A decision about the boss's OWN turn has no such answer.
        const passes = boss.window.options.filter((option) => option.optionId === RULESET_PASS_OPTION).length;
        if (boss.ruleset?.window) held++;
        assert.equal(passes, boss.ruleset?.window ? 1 : 0, `${answer}: one way to let the moment go by`);
        bossAnswer = answer === "good" ? boss.window.options[0]!.id : answer === "bad" ? "not-a-candidate" : null;
      }
      await send({ type: "continue" });
    }
    assert.ok(windows > 0, `${answer}: the boss's turn opened a decision`);
    assert.ok(held > 0, `${answer}: and at least one of them was a moment the fight was holding open`);
    assert.ok(bossCalls > callsBefore, `${answer}: the Game Master was asked`);
    assert.ok(boss.outcome, `${answer}: the fight still finished, with ${boss.outcome}`);
  }

  // ── The blueprint prompt: today's words without a combat block, the ruleset's terms with one ──
  {
    const plain = buildInitPrompt("Ada", "persona", "cards", [], "", "", false, undefined, null);
    const same = buildInitPrompt("Ada", "persona", "cards", [], "", "", false, undefined, undefined);
    assert.deepEqual(plain, same, "no brief and no ruleset are the same prompt, byte for byte");

    const brief = await encounterRulesetBrief(definition, null);
    assert.ok(brief, "a ruleset that resolves its own fights lends the prompt a brief");
    assert.deepEqual(
      brief!.tiers.map((tier) => tier.id).slice(0, 3),
      ["cr_0", "cr_1_8", "cr_1_4"],
      "the tiers are listed in declaration order",
    );
    assert.ok(brief!.bestiary.some((entry) => entry.label === "Thorn Lurker"));
    assert.ok(brief!.bestiary.every((entry) => typeof entry.tier === "string"));
    assert.ok(brief!.bestiary.length <= 60, "the index is bounded");
    assert.deepEqual(brief!.budgets, ["action", "bonus", "reaction"]);

    const withBrief = buildInitPrompt("Ada", "persona", "cards", [], "", "", false, undefined, brief);
    assert.notDeepEqual(withBrief, plain);
    const text = withBrief.map((message) => message.content).join("\n");
    assert.match(text, /RULESET RESOLVES ITS OWN FIGHTS/);
    assert.match(text, /cr_1_4 \(CR 1\/4\)/);
    assert.match(text, /Thorn Lurker \[cr_1_2\]/);
    assert.match(text, /"creature"/);
    assert.match(text, /"proposed"/);
    // Nothing today's prompt says is taken away: the ruleset's terms are only ever added.
    assert.deepEqual(withBrief.slice(0, -1), plain.slice(0, -1), "only the instruction message changes");
    for (const line of plain.at(-1)!.content.split("\n")) {
      assert.ok(withBrief.at(-1)!.content.includes(line), `this line of today's prompt was lost: ${line}`);
    }

    // A blueprint keeps the ruleset's own terms, and a malformed stat block costs its opponent the
    // proposal rather than costing the whole blueprint.
    const blueprint = (proposed: unknown) =>
      encounterBlueprintSchema.safeParse({
        party: [{ name: "Brenna", hp: 10, maxHp: 10 }],
        enemies: [
          {
            name: "Invented Horror",
            hp: 10,
            maxHp: 10,
            creature: "thorn-lurker",
            tier: "cr_1_4",
            ...(proposed === undefined ? {} : { proposed }),
          },
        ],
        environment: "a road",
      });
    const good = blueprint({
      health: 12,
      defense: 13,
      initiativeModifier: 2,
      tier: "cr_1_4",
      actions: [{ id: "strike", name: "Strike", budget: "action", toHit: 4, damage: { dice: "1d6" } }],
    });
    assert.ok(good.success, JSON.stringify(good.error?.issues));
    const keptEnemy = good.data!.enemies[0] as Record<string, unknown>;
    assert.equal(keptEnemy.creature, "thorn-lurker");
    assert.equal(keptEnemy.tier, "cr_1_4");
    assert.ok(keptEnemy.proposed, "a stat block in the shared form survives");
    for (const malformed of [
      { health: 12 },
      { health: 12, defense: 13, initiativeModifier: 2, tier: "cr_1_4", actions: [] },
      "a wall of prose",
      { health: 12, defense: 13, initiativeModifier: 2, tier: "cr_1_4", actions: [{ name: "Strike" }], extra: 1 },
      // An invention is never a sheet: the clamp cannot hold one to its tier.
      {
        health: 12,
        defense: 13,
        initiativeModifier: 2,
        tier: "cr_1_4",
        actions: [{ id: "strike", name: "Strike", budget: "action", toHit: 4, damage: { dice: "1d6" } }],
        sheet: { fields: { hp_max: 500 } },
      },
    ]) {
      const dropped = blueprint(malformed);
      assert.ok(dropped.success, `a malformed proposal must not fail the blueprint: ${JSON.stringify(malformed)}`);
      const enemy = dropped.data!.enemies[0] as Record<string, unknown>;
      assert.equal(enemy.proposed, undefined, "and it is dropped");
      assert.equal(enemy.creature, "thorn-lurker", "while everything else about the opponent stays");
    }

    // A ruleset without a combat block is asked for exactly today's blueprint.
    const noCombat = JSON.parse(fixtureText) as Record<string, any>;
    delete noCombat.combat;
    noCombat.catalogs = (noCombat.catalogs ?? []).filter(
      (catalog: Record<string, any>) => catalog.holds !== "creatures",
    );
    const plainRuleset = parseRulesetDefinition(noCombat);
    assert.ok(
      plainRuleset.ok,
      `the fixture without combat must import: ${plainRuleset.ok ? "" : plainRuleset.issues.join("; ")}`,
    );
    assert.equal(await encounterRulesetBrief(plainRuleset.definition, null), null);
  }

  console.log(
    "Ruleset combat director route: start, idempotency, refusal codes, the live sheet write-back, the board, an unchanged classic fight, the boss window and the blueprint prompt passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
