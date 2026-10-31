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
  combatInterruptFields,
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
const { combatDirectorRoutes, COMBAT_DIRECTOR_NAMESPACE, proposedSheetLists } =
  await import("../../packages/server/src/routes/combat-director.routes.js");
const { buildInitPrompt, encounterBlueprintSchema, encounterRulesetBrief } =
  await import("../../packages/server/src/routes/encounter.routes.js");

const { buildRulesetCombatBossPrompt } = await import("../../packages/server/src/services/game/combat-boss.service.js");
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
    filters: { classes: ["Cleric", "Wizard"] },
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
  {
    id: "spells",
    label: "Spells",
    feeds: ["spells"],
    // Open by class, as the 5e package's list is, so an invented caster is held to its own.
    filters: [{ id: "classes", label: "Class", type: "tags", startFrom: { field: "class" } }],
    entries: [
      ...spellEntries,
      {
        id: "sacred-spark",
        label: "Sacred Spark",
        filters: { classes: ["Cleric"] },
        rows: [{ list: "spells", values: { name: "Sacred Spark", level: 0, prepared: false } }],
        mechanics: { kind: "attack", attackRoll: true, amount: { dice: "1d8" }, damageType: "radiant" },
      },
    ],
  },
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

// An invented sheet that sets fields wants the catalogs of rows that set them (a class), read off the
// PARSED ruleset, whose catalogs of rows say `holds: "rows"` (cloud re-test 2026-10-25: an invented
// Cleric 5 never loaded the classes catalog, and cast only cantrips).
{
  const rows = (definition.catalogs ?? []).filter(
    (catalog) => catalog.holds !== "items" && catalog.holds !== "creatures",
  );
  assert.ok(
    rows.length > 0 && rows.every((catalog) => catalog.holds !== undefined),
    "parsed catalogs say what they hold",
  );
  const lists = proposedSheetLists(definition, [{ proposed: { tier: "cr_1", sheet: { fields: { level: 3 } } } }]);
  for (const catalog of rows) for (const list of catalog.feeds ?? []) assert.ok(lists.has(list), list);
  assert.ok(lists.has(":fields"));
  assert.ok(!proposedSheetLists(definition, [{ proposed: { tier: "cr_1", sheet: {} } }]).has(":fields"));
  // A foe written with the Game Master's own skills, one a heal, reads them as its attacks do (cloud
  // and laptop re-tests 2026-10-26: a Cult Healer's Cure Wounds dropped, and a returning one's too).
  const healerSkills = proposedSheetLists(definition, [{ skills: [{ type: "attack" }, { type: "heal" }] }]);
  for (const catalog of rows) for (const list of catalog.feeds ?? []) assert.ok(healerSkills.has(list), list);
  assert.ok(!proposedSheetLists(definition, [{ skills: [{ type: "attack" }] }]).has(":fields"));
  // And one written with numbers and no sheet, its spells beside them (laptop pass 6 2026-10-26).
  const numbered = proposedSheetLists(definition, [
    { proposed: { tier: "cr_1", health: 30 }, skills: [{ type: "attack" }, { type: "attack", spell: true }] },
  ]);
  for (const catalog of rows) for (const list of catalog.feeds ?? []) assert.ok(numbered.has(list), list);
}

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
let firstBossState: unknown = null;
await app.register(combatDirectorRoutes, {
  prefix: "/combat",
  chooseBoss: async (_db: unknown, _chat: string, asked: unknown) => {
    bossCalls++;
    // The first since it was cleared: a hero left dying keeps the fight going (no threat by then).
    firstBossState ??= asked;
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
// The same ruleset giving the Game Master the whole opposition (1.774).
const OPPOSITION_ID = "local/5e-gm-opposition";
const opposed = JSON.parse(fixtureText) as Record<string, any>;
opposed.id = "5e-gm-opposition";
opposed.gm.opposition = "game-master";
await createGameRulesetsStorage(db).put({
  rulesetId: OPPOSITION_ID,
  version: 1,
  sourceKind: "local",
  definition: JSON.stringify(opposed),
});
// The same ruleset with no bestiary sheet that marks a spell, so the only thing that can make the
// route load the spell catalog is a Game Master's invented sheet naming one.
const PLAIN_BESTIARY_ID = "local/5e-plain-bestiary";
const plainBestiary = JSON.parse(fixtureText) as Record<string, any>;
plainBestiary.id = "5e-plain-bestiary";
for (const catalog of plainBestiary.catalogs) {
  if (catalog.holds === "creatures") {
    catalog.entries = catalog.entries.filter((entry: Record<string, any>) => !entry.creature?.sheet);
  }
}
await createGameRulesetsStorage(db).put({
  rulesetId: PLAIN_BESTIARY_ID,
  version: 1,
  sourceKind: "local",
  definition: JSON.stringify(plainBestiary),
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

async function newGame(options: { ruleset: boolean; gm?: boolean; named?: boolean; rulesetId?: string }) {
  const chat = await chats.create({ name: "Ruleset fight", mode: "game", characterIds: [] });
  const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
  await chats.patchMetadata(chat.id, {
    gameSetupConfig: {
      combatDirector: true,
      gmBossControl: options.gm === true,
      ...(options.named ? { gmNamedControl: true } : {}),
      difficulty: "Normal",
    },
    ...(options.ruleset
      ? {
          gameRuleset: { id: options.rulesetId ?? RULESET_ID, version: 1, packageId: null, options: {} },
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
  // Nobody on the party's side, or nobody to fight, is refused in plain words (Kenhito prep K3).
  const empty = await post("/combat/start", { ...body, party: [] });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.json().error, "This fight has nobody on the party's side.");
  const none = await post("/combat/start", { ...body, enemies: [] });
  assert.equal(none.json().error, "This fight has nobody to fight.");
  // A mechanic no interval drives may say 0 (laptop party B fight 2: an hp_threshold one's refused
  // the whole fight), and a value that is refused is named where it is.
  const blight = {
    name: "Blighted Sap",
    description: "Sap that corrodes.",
    trigger: "hp_threshold",
    interval: 0,
    hpThreshold: 75,
    effectType: "damage_all",
    power: 0.8,
    status: { name: "Corroded", emoji: "", duration: 2, modifier: -2 },
  };
  const named = await post("/combat/start", { ...body, mechanics: [{ ...blight, interval: -1 }] });
  assert.equal(named.statusCode, 400);
  assert.match(named.json().error, /^mechanics\.0\.interval: /);
  const start = await post("/combat/start", { ...body, mechanics: [blight] });
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

  // ── Who the scene caught unaware starts the fight surprised (1.237) ──
  {
    const ambushed = await newGame({ ruleset: true });
    const opened = await post("/combat/start", {
      chatId: ambushed.chat.id,
      anchor: ambushed.anchor.id,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player")],
      enemies: [{ ...unit("lurker", "Thorn Lurker", "enemy"), creature: "creatures/thorn-lurker", surprised: true }],
    });
    assert.equal(opened.statusCode, 200, opened.body);
    const fight = opened.json().session as DirectedCombatView;
    const surprised = fight.ruleset!.combatants.filter((one) => one.surprised).map((one) => one.id);
    assert.deepEqual(surprised, ["lurker"], JSON.stringify(fight.ruleset!.combatants.map((one) => one.id)));
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
    // The player sets Brenna down before the first turn (2026-10-24): nobody acts until they begin.
    assert.equal(fight.stage, "deploy", "the fight waits for the party to be set down");
    assert.deepEqual(fight.ruleset!.deploy?.ids, ["brenna"]);
    assert.equal((await send({ type: "continue" })).statusCode, 400, "and no turn is taken meanwhile");
    assert.equal((await send({ type: "deployed" })).statusCode, 200);
    assert.equal(fight.ruleset!.deploy, undefined, "beginning it ends the setting down");
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
      // Water is no wall: a crocodile's prey dragged into it is where the resolver put it (re-test 15).
      const wet = await tamper((combatants, tiles) => {
        tiles[combatants[0]!.y as number]![combatants[0]!.x as number] = "water";
      });
      assert.equal(wet.statusCode, 200, wet.body);
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

      // One the resolver itself took off the board, a called creature sent away, stands nowhere and
      // is let be (class re-test 2026-10-24); one merely beaten and taken off is still refused.
      const sentAway = await tamper((combatants) => {
        delete combatants[1]!.x;
        delete combatants[1]!.y;
        combatants[1]!.defeated = true;
        combatants[1]!.dismissed = true;
      });
      assert.equal(sentAway.statusCode, 200, sentAway.body);
      const vanished = await tamper((combatants) => {
        delete combatants[1]!.x;
        delete combatants[1]!.y;
        combatants[1]!.defeated = true;
      });
      assert.equal(vanished.statusCode, 400, vanished.body);
      assert.match(vanished.json().error, /Invalid saved position/);

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
    // Alone, with no persona, it is the player: the first card fights in its place.
    const game4 = await newGame({ ruleset: true });
    const alone = await post("/combat/start", {
      chatId: game4.chat.id,
      anchor: game4.anchor.id,
      style: "ruleset",
      party: [unit("tam", "Tam", "player")],
      enemies: [{ ...unit("lurker", "Thorn Lurker", "enemy") }],
    });
    assert.equal(alone.statusCode, 200, alone.body);
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

  // ── A named opponent (combat AI P9): the Game Master plays it too, when the game asks for that; and
  //    every opponent, named or not, where the ruleset gives it the opposition (1.774) ──
  for (const [named, rulesetId] of [
    [true, undefined],
    [false, undefined],
    [false, OPPOSITION_ID],
  ] as const) {
    const game = await newGame({ ruleset: true, gm: true, named, ...(rulesetId ? { rulesetId } : {}) });
    const opened = await post("/combat/start", {
      chatId: game.chat.id,
      anchor: game.anchor.id,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player")],
      enemies: [
        { ...unit("sentinel", "Hollow Sentinel", "enemy"), ...(rulesetId ? {} : { aiHints: { named: true } }) },
      ],
    });
    assert.equal(opened.statusCode, 200, opened.body);
    let fight = opened.json().session as DirectedCombatView;
    const send = async (command: DirectedCommand) => {
      const response = await post("/combat/command", {
        chatId: game.chat.id,
        anchor: game.anchor.id,
        id: fight.id,
        instanceId: fight.instanceId,
        revision: fight.revision,
        requestId: crypto.randomUUID(),
        command,
      });
      assert.equal(response.statusCode, 200, response.body);
      fight = response.json().session;
    };
    await send({ type: "control", unitId: "brenna", controller: "ai" });
    const callsBefore = bossCalls;
    firstBossState = null;
    let windows = 0;
    for (let guard = 0; guard < 300 && !fight.outcome; guard++) {
      if (fight.window?.controller === "gm") {
        windows++;
        assert.equal(fight.window.actorId, "sentinel");
        bossAnswer = fight.window.options[0]!.id;
      }
      await send({ type: "continue" });
    }
    assert.ok(fight.outcome, `the fight finished: ${named}`);
    if (rulesetId) {
      assert.ok(windows > 0 && bossCalls > callsBefore, "the ruleset gives the Game Master every opponent");
      continue;
    }
    if (!named) {
      assert.equal(windows, 0, "with bosses only, a named opponent is the Engine's own");
      assert.equal(bossCalls, callsBefore);
      continue;
    }
    assert.ok(windows > 0 && bossCalls > callsBefore, "the named opponent's turns went to the Game Master");
    // What it is told: how the opponent fights, the other side by danger, and the companions' orders.
    const prompt = JSON.parse(buildRulesetCombatBossPrompt(definition, firstBossState as never)[1]!.content) as Record<
      string,
      any
    >;
    assert.ok(prompt.profile && typeof prompt.profile === "object", JSON.stringify(Object.keys(prompt)));
    assert.deepEqual(
      prompt.threats.map((one: { id: string }) => one.id),
      ["brenna"],
    );
    assert.equal(typeof prompt.threats[0].threat, "number");
    // And what the Engine's own tactics would do, best first, each on a line that names a real
    // candidate and says why (re-test 9 follow-up).
    assert.ok(Array.isArray(prompt.engineSuggestions) && prompt.engineSuggestions.length > 0, JSON.stringify(prompt));
    const ids = new Set(prompt.candidates.map((one: { candidateId: string }) => one.candidateId));
    for (const [index, line] of (prompt.engineSuggestions as string[]).entries()) {
      const match = /^(\d+)\. CANDIDATE: (\S+) ACTION: .+ REASON: .+$/.exec(line);
      assert.ok(match, line);
      assert.equal(Number(match![1]), index + 1, line);
      assert.ok(ids.has(match![2]), `a candidate it was offered: ${line}`);
    }
  }

  // ── The blueprint prompt: today's words without a combat block, the ruleset's terms with one ──
  {
    const plain = buildInitPrompt("Ada", "persona", "cards", [], "", "", false, undefined, null);
    // A ruleset that turns Game Mode's own items off (#6822) is not asked what the inventory does.
    const noItems = buildInitPrompt("Ada", "persona", "cards", [], "", "", false, undefined, null, {
      guess: false,
      ruleset: [],
    })
      .map((message) => message.content)
      .join("\n");
    assert.doesNotMatch(noItems, /"itemEffects"/);
    assert.match(
      noItems,
      /- items: the game's ruleset says what its own items do in a fight, so give no itemEffects\./,
    );
    assert.match(plain.map((message) => message.content).join("\n"), /"itemEffects": \[/);
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
    // The ruleset's own sheet, so an invented caster can be written on it.
    assert.match(text, /may be proposed as a SHEET/);
    assert.match(text, /abilities: str 1 to 30, dex 1 to 30/);
    assert.match(text, /saves, each set to one of none\|proficient: str_save/);
    assert.match(text, /lists\.spells: rows of name \(text, required\)/);
    assert.match(text, /a row counts only when "prepared" is true or when "level" is 0/);
    assert.match(text, /\{"name":"<name>"\}.*Mending Light/);
    assert.match(text, /Which of these a creature may have depends on fields\.class, so set it\./);
    assert.match(text, /fields: .*class text up to \d+ characters/, "including the text field it is told to set");
    assert.match(text, /A boss is written in full by you and may be the exception/);
    assert.ok(
      brief!.sheet.lists.every((list) => list.names.length <= 60),
      "the names are bounded",
    );
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
    // Who the scene caught unaware (1.237) survives on both sides, and a bad value only drops it.
    const caught = encounterBlueprintSchema.safeParse({
      party: [{ name: "Brenna", hp: 10, maxHp: 10, surprised: true }],
      enemies: [{ name: "Goblin", hp: 7, maxHp: 7, surprised: "yes" }],
      environment: "a road",
    });
    assert.ok(caught.success, JSON.stringify(caught.error?.issues));
    assert.equal((caught.data!.party[0] as Record<string, unknown>).surprised, true);
    assert.equal((caught.data!.enemies[0] as Record<string, unknown>).surprised, undefined);
    // A number out of an ability's bounds is pulled to them, and one that is not a number left out,
    // rather than refusing the whole setup (playtest 2026-10-23: Second Wind written with range 0).
    const bounded = encounterBlueprintSchema.safeParse({
      party: [
        {
          name: "Brannoc",
          hp: 10,
          maxHp: 10,
          attacks: [
            { name: "Second Wind", kind: "heal", range: 0 },
            { name: "Longbow", range: 30, areaRadius: -1, slotLevel: "high" },
          ],
        },
      ],
      enemies: [{ name: "Goblin", hp: 7, maxHp: 7 }],
      environment: "a road",
    });
    assert.ok(bounded.success, JSON.stringify(bounded.error?.issues));
    const attacks = (bounded.data!.party[0] as { attacks: Array<Record<string, unknown>> }).attacks;
    assert.equal(attacks[0]!.range, 1);
    assert.deepEqual([attacks[1]!.range, attacks[1]!.areaRadius, attacks[1]!.slotLevel], [12, 0, undefined]);
    // Only the setup is lenient: a turn or a replayed save still refuses an ability out of bounds.
    assert.equal(combatInterruptFields.range.safeParse(0).success, false);
    // A word it does not know is left out too, and the rest of the ability kept (laptop playtest
    // 2026-10-25: a duelist's Parry written as reaction "counterattack" refused the whole fight).
    const worded = encounterBlueprintSchema.safeParse({
      party: [{ name: "Brannoc", hp: 10, maxHp: 10 }],
      enemies: [
        {
          name: "Duelist",
          hp: 12,
          maxHp: 12,
          attacks: [
            { name: "Parry", reaction: "counterattack", range: 1 },
            { name: "Fan of Blades", targetScope: "everyone", spell: "no", friendlyFire: 1 },
            { name: "Ward", reaction: "guard" },
          ],
        },
      ],
      environment: "a hall",
    });
    assert.ok(worded.success, JSON.stringify(worded.error?.issues));
    const duelist = (worded.data!.enemies[0] as { attacks: Array<Record<string, unknown>> }).attacks;
    assert.deepEqual([duelist[0]!.name, duelist[0]!.reaction, duelist[0]!.range], ["Parry", undefined, 1]);
    assert.deepEqual(
      [duelist[1]!.targetScope, duelist[1]!.spell, duelist[1]!.friendlyFire],
      [undefined, undefined, undefined],
    );
    assert.equal(duelist[2]!.reaction, "guard", "a word it knows is kept");
    // An attack's kind is read the same way: a word for one of the four is that one, and an unknown
    // one is left out (laptop 2026-10-25: kind "damage" refused a whole fight).
    const kinded = encounterBlueprintSchema.safeParse({
      party: [{ name: "Brannoc", hp: 10, maxHp: 10, attacks: [{ name: "Mend", kind: "Healing" }] }],
      enemies: [
        {
          name: "Ogre",
          hp: 30,
          maxHp: 30,
          attacks: [
            { name: "Club", kind: "damage" },
            { name: "Roar", kind: "intimidate" },
            { name: "Bellow", kind: "debuff" },
          ],
        },
      ],
      environment: "a cave",
    });
    assert.ok(kinded.success, JSON.stringify(kinded.error?.issues));
    const ogre = (kinded.data!.enemies[0] as { attacks: Array<Record<string, unknown>> }).attacks;
    assert.deepEqual(
      ogre.map((attack) => attack.kind),
      ["attack", undefined, "debuff"],
    );
    assert.equal((kinded.data!.party[0] as { attacks: Array<Record<string, unknown>> }).attacks[0]!.kind, "heal");
    assert.equal(combatInterruptFields.reaction.safeParse("counterattack").success, false);
    // So is a temperament or proficiency it has no word for, and a mind written as its temperament
    // or back is moved where it belongs (laptop 2026-10-25: temperament "cunning", mind "disciplined").
    const tempered = encounterBlueprintSchema.safeParse({
      party: [{ name: "Brannoc", hp: 10, maxHp: 10 }],
      enemies: [
        { name: "Fox", hp: 6, maxHp: 6, aiHints: { temperament: "Cunning", proficiency: "elite", leader: true } },
        { name: "Sergeant", hp: 9, maxHp: 9, aiHints: { mind: "disciplined" } },
        { name: "Hound", hp: 9, maxHp: 9, aiHints: { mind: "reckless" } },
      ],
      environment: "a wood",
    });
    assert.ok(tempered.success, JSON.stringify(tempered.error?.issues));
    const hintsOf = (index: number) => (tempered.data!.enemies[index] as { aiHints: Record<string, unknown> }).aiHints;
    assert.deepEqual(hintsOf(0), { mind: "cunning", proficiency: undefined, leader: true });
    assert.deepEqual(hintsOf(1), { temperament: "disciplined" });
    assert.deepEqual(hintsOf(2), { temperament: "reckless" });
    assert.ok(withBrief.at(-1)!.content.includes('"surprised": true'), "the prompt asks who was caught unaware");
    // An invention may be a sheet in the ruleset's own terms, and numbers written beside it go.
    const caster = blueprint({
      tier: "cr_1_4",
      health: 12,
      sheet: { abilities: { int: 16 }, lists: { spells: [{ name: "Mending Light", prepared: true }] } },
    });
    assert.ok(caster.success, JSON.stringify(caster.error?.issues));
    const casterProposal = (caster.data!.enemies[0] as Record<string, any>).proposed;
    assert.ok(casterProposal?.sheet, "a proposed sheet survives the blueprint");
    assert.equal(casterProposal.health, undefined, "and the number beside it is not kept");
    for (const malformed of [
      { health: 12 },
      { health: 12, defense: 13, initiativeModifier: 2, tier: "cr_1_4", actions: [] },
      "a wall of prose",
      { health: 12, defense: 13, initiativeModifier: 2, tier: "cr_1_4", actions: [{ name: "Strike" }], extra: 1 },
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

  // ── Who plays a companion is kept for the chat's next fight (laptop party A 2026-10-25) ──
  {
    const kept = await newGame({ ruleset: true });
    const fightBody = (anchor: string) => ({
      chatId: kept.chat.id,
      anchor,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player"), unit("corwin", "Corwin", "player")],
      enemies: [unit("hound", "Cinder Hound", "enemy")],
    });
    const first = (await post("/combat/start", fightBody(kept.anchor.id))).json().session as DirectedCombatView;
    const handed = await post("/combat/command", {
      chatId: kept.chat.id,
      anchor: kept.anchor.id,
      id: first.id,
      instanceId: first.instanceId,
      revision: first.revision,
      requestId: crypto.randomUUID(),
      command: { type: "control", unitId: "corwin", controller: "ai" },
    });
    assert.equal(handed.statusCode, 200, handed.body);
    const meta = JSON.parse((await chats.getById(kept.chat.id))!.metadata || "{}");
    assert.deepEqual(meta.combatControllers, { corwin: "ai" });
    const later = await chats.createMessage({ chatId: kept.chat.id, role: "assistant", content: "[state: combat]" });
    const next = (await post("/combat/start", fightBody(later.id))).json().session as DirectedCombatView;
    assert.equal(next.party.find((one) => one.id === "corwin")?.controller, "ai", "the Engine plays Corwin again");
    assert.notEqual(next.party.find((one) => one.id === "brenna")?.controller, "ai", "Brenna stays the player's");
  }

  // ── The orders the player gave a companion are kept for the chat's next fight (laptop playtest
  //    2026-10-25: orders set back to none at every fight) ──
  {
    const kept = await newGame({ ruleset: true });
    const fightBody = (
      anchor: string,
      party = [unit("brenna", "Brenna", "player"), unit("corwin", "Corwin", "player")],
    ) => ({
      chatId: kept.chat.id,
      anchor,
      style: "ruleset",
      party,
      enemies: [unit("hound", "Cinder Hound", "enemy")],
    });
    const first = (await post("/combat/start", fightBody(kept.anchor.id))).json().session as DirectedCombatView;
    const ordered = await post("/combat/command", {
      chatId: kept.chat.id,
      anchor: kept.anchor.id,
      id: first.id,
      instanceId: first.instanceId,
      revision: first.revision,
      requestId: crypto.randomUUID(),
      command: { type: "orders", unitId: "corwin", orders: { posture: "protect", protectId: "brenna", heal: true } },
    });
    assert.equal(ordered.statusCode, 200, ordered.body);
    const meta = JSON.parse((await chats.getById(kept.chat.id))!.metadata || "{}");
    assert.deepEqual(meta.combatOrders, { corwin: { posture: "protect", protectId: "brenna", heal: true } });
    const later = await chats.createMessage({ chatId: kept.chat.id, role: "assistant", content: "[state: combat]" });
    const next = (await post("/combat/start", fightBody(later.id))).json().session as DirectedCombatView;
    assert.deepEqual(next.party.find((one) => one.id === "corwin")?.orders, {
      posture: "protect",
      protectId: "brenna",
      heal: true,
    });
    assert.equal(next.party.find((one) => one.id === "brenna")?.orders, undefined, "Brenna has none");
    // Whom it protects is not in this fight: its orders wait for one they are.
    const alone = await chats.createMessage({ chatId: kept.chat.id, role: "assistant", content: "[state: combat]" });
    const without = (await post("/combat/start", fightBody(alone.id, [unit("corwin", "Corwin", "player")]))).json()
      .session as DirectedCombatView;
    assert.equal(without.party.find((one) => one.id === "corwin")?.orders, undefined);
  }

  // ── A word in the setup the Engine has none of never refuses the fight (laptop playtest 2026-10-25:
  //    a mechanic's trigger "charge") ──
  {
    const loose = await newGame({ ruleset: true });
    const started = await post("/combat/start", {
      chatId: loose.chat.id,
      anchor: loose.anchor.id,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player")],
      enemies: [{ ...unit("hound", "Cinder Hound", "enemy"), movementMode: "burrow", start: "rooftop" }],
      mechanics: [{ name: "Bull Rush", description: "It charges.", trigger: "charge", effectType: "trample" }],
    });
    assert.equal(started.statusCode, 200, started.body);
  }

  // ── One that got away comes back as it was (laptop playtest 2026-10-25: a Cult Mage that fled at
  //    CR 3 with 32 health came back at CR 4 with 65) ──
  {
    const away = await newGame({ ruleset: true });
    const fightBody = (anchor: string, enemies: unknown[]) => ({
      chatId: away.chat.id,
      anchor,
      style: "ruleset",
      party: [unit("brenna", "Brenna", "player")],
      enemies,
    });
    const first = await post(
      "/combat/start",
      fightBody(away.anchor.id, [
        // A named one comes back by its name even beside another called so.
        { ...unit("mage", "Cult Mage", "enemy"), creature: "creatures/thorn-lurker", aiHints: { named: true } },
        { ...unit("mender", "Hedge Mender", "enemy"), creature: "creatures/hedge-mender" },
        unit("hound", "Cinder Hound", "enemy"),
      ]),
    );
    assert.equal(first.statusCode, 200, first.body);
    const fought = first.json().session as DirectedCombatView;
    const madeMax = fought.ruleset!.combatants.find((one) => one.id === "mage")!.health.max;
    const engineStates = createGameEngineStateStorage(db);
    const row = (await engineStates.getByChatAndMessage(away.chat.id, away.anchor.id, 0, COMBAT_DIRECTOR_NAMESPACE))!;
    const doc = JSON.parse(row.state);
    for (const one of doc.rulesetFight.encounter.combatants) {
      if (one.id === "mage") {
        Object.assign(one, { defeated: true, away: { by: "mage", label: "Fled", left: true } });
        one.health.value = one.health.max - 3;
      }
      // One made from a sheet keeps its health on the sheet: 10 of its 22 left.
      if (one.id === "mender") {
        Object.assign(one, { defeated: true, away: { by: "mender", label: "Fled", left: true } });
        one.sheet.live = { ...one.sheet.live, pools: { ...one.sheet.live?.pools, hp: { value: 10 } } };
      }
      if (one.id === "hound") Object.assign(one, { defeated: true, down: true });
    }
    // One still standing as a fight ends (it won: laptop playtest 2026-10-25, a War-mage that beat
    // the party came back rebuilt at 40 health from 65) is remembered as one that got away is.
    {
      const { rulesetFightReturningFoes } =
        await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
      const won = structuredClone(doc.rulesetFight);
      const hound = won.encounter.combatants.find((one: { id: string }) => one.id === "hound");
      delete hound.defeated;
      delete hound.down;
      const kept = rulesetFightReturningFoes(definition, won);
      assert.deepEqual(kept.fled.map((one: { name: string }) => one.name).sort(), [
        "Cinder Hound",
        "Cult Mage",
        "Hedge Mender",
      ]);
      assert.deepEqual(kept.beaten, []);
      // Two nameless ones of a name are both kept, each to come back where the Game Master marks it
      // ("Cult Thug (Scarred)", laptop playtest 2026-10-25), never to an unmarked pair of the name.
      const pair = structuredClone(won);
      const twin = structuredClone(pair.encounter.combatants.find((one: { id: string }) => one.id === "hound"));
      twin.id = "hound2";
      pair.encounter.combatants.push(twin);
      pair.made.hound2 = structuredClone(pair.made.hound);
      const twins = rulesetFightReturningFoes(definition, pair);
      assert.equal(twins.fled.filter((one: { name: string }) => one.name === "Cinder Hound").length, 2);
      assert.deepEqual(twins.beaten, []);
    }
    await engineStates.updateStateById(row.id, JSON.stringify(doc), undefined, away.chat.id);
    const ended = await post("/combat/command", {
      chatId: away.chat.id,
      anchor: away.anchor.id,
      id: fought.id,
      instanceId: fought.instanceId,
      revision: fought.revision,
      requestId: crypto.randomUUID(),
      command: { type: "control", unitId: "brenna", controller: "ai" },
    });
    assert.equal(ended.statusCode, 200, ended.body);
    assert.equal(ended.json().session.outcome, "victory", ended.body);
    const meta = JSON.parse((await chats.getById(away.chat.id))!.metadata || "{}");
    assert.deepEqual(
      Object.keys(meta.gameReturningFoes ?? {}).sort(),
      ["cult mage", "hedge mender"],
      "those that got away",
    );
    assert.equal(meta.gameReturningFoes["cult mage"].creature, "creatures/thorn-lurker");
    // With the temperament it fought with, to come back the same (cloud re-test 2026-10-25).
    assert.equal(typeof meta.gameReturningFoes["cult mage"].temperament, "string");
    const later = await chats.createMessage({ chatId: away.chat.id, role: "assistant", content: "[state: combat]" });
    const back = await post(
      "/combat/start",
      fightBody(later.id, [
        unit("mage2", "Cult Mage", "enemy"),
        // Of two of its name, the one marked is the one that got away (laptop playtest 2026-10-25: a
        // fresh "Cult Thug" took the sheet of "Cult Thug (Wounded)").
        { ...unit("mender4", "Hedge Mender", "enemy"), creature: "creatures/hedge-mender" },
        unit("mender2", "Hedge Mender (Wounded)", "enemy"),
        // A second of the name is a fresh one (cloud re-test 2026-10-25: two Bandits came back as the
        // one that fled).
        { ...unit("mage3", "Cult Mage", "enemy"), creature: "creatures/thorn-lurker" },
      ]),
    );
    assert.equal(back.statusCode, 200, back.body);
    const again = back.json().session as DirectedCombatView;
    assert.equal(again.ruleset!.combatants.find((one) => one.id === "mage2")!.health.max, madeMax, "made as before");
    assert.ok(again.ruleset!.adjustments.includes("Cult Mage is the same one the party met before."));
    assert.equal(
      again.ruleset!.combatants.find((one) => one.id === "mage2")!.health.value,
      madeMax - 3,
      "still missing what it got away without",
    );
    assert.equal(
      again.ruleset!.adjustments.filter((line) => line === "Cult Mage is the same one the party met before.").length,
      1,
      "only one Cult Mage comes back",
    );
    assert.equal(
      again.ruleset!.combatants.find((one) => one.id === "mage3")!.health.value,
      again.ruleset!.combatants.find((one) => one.id === "mage3")!.health.max,
      "the other is fresh",
    );
    const mender = again.ruleset!.combatants.find((one) => one.id === "mender2")!.health;
    assert.deepEqual([mender.value, mender.max], [10, 22], "on its sheet too");
    const fresh = again.ruleset!.combatants.find((one) => one.id === "mender4")!.health;
    assert.equal(fresh.value, fresh.max, "the unmarked one is a fresh one");
    // Written again in other words, it is still the one (laptop playtest 2026-10-25: "Cult Thug
    // (Highwayman)" came back as "Highwayman Thug", escaped druids as "Vengeful Cult Druid").
    const { rulesetReturningFoeReworded } =
      await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
    assert.equal(rulesetReturningFoeReworded("Cult Thug (Highwayman)", "Highwayman Thug"), true);
    assert.equal(rulesetReturningFoeReworded("Cult Druid", "Vengeful Cult Druid"), true);
    assert.equal(rulesetReturningFoeReworded("Cult Thug", "Thug"), false, "one word is anybody");
    assert.equal(rulesetReturningFoeReworded("Cult Thug", "Cult Mage"), false);
    const third = await chats.createMessage({ chatId: away.chat.id, role: "assistant", content: "[state: combat]" });
    const reworded = await post(
      "/combat/start",
      fightBody(third.id, [
        { ...unit("mender5", "Vengeful Hedge Mender", "enemy"), creature: "creatures/hedge-mender" },
        { ...unit("mender6", "Desperate Hedge Mender", "enemy"), creature: "creatures/hedge-mender" },
      ]),
    );
    assert.equal(reworded.statusCode, 200, reworded.body);
    const view = reworded.json().session as DirectedCombatView;
    const vengeful = view.ruleset!.combatants.find((one) => one.id === "mender5")!.health;
    assert.deepEqual([vengeful.value, vengeful.max], [10, 22], "the one that got away, in other words");
    const desperate = view.ruleset!.combatants.find((one) => one.id === "mender6")!.health;
    assert.equal(desperate.value, desperate.max, "only one was kept, so the other is fresh");
    const rewordedRow = (await engineStates.getByChatAndMessage(away.chat.id, third.id, 0, COMBAT_DIRECTOR_NAMESPACE))!;
    assert.deepEqual(JSON.parse(rewordedRow.state).rulesetFight.returnedFrom, ["hedge mender"]);
    // Several marked of the name are a group told apart, not the one coming back (laptop pass 5
    // 2026-10-26: two of four "Cult Thug (…)" linked to two kept from earlier fights).
    const fourth = await chats.createMessage({ chatId: away.chat.id, role: "assistant", content: "[state: combat]" });
    const group = await post(
      "/combat/start",
      fightBody(fourth.id, [
        { ...unit("mender7", "Hedge Mender (Left)", "enemy"), creature: "creatures/hedge-mender" },
        { ...unit("mender8", "Hedge Mender (Right)", "enemy"), creature: "creatures/hedge-mender" },
      ]),
    );
    assert.equal(group.statusCode, 200, group.body);
    const grouped = group.json().session as DirectedCombatView;
    for (const id of ["mender7", "mender8"]) {
      const health = grouped.ruleset!.combatants.find((one) => one.id === id)!.health;
      assert.equal(health.value, health.max, `${id} is a fresh one`);
    }
    assert.ok(!grouped.ruleset!.adjustments.some((line) => line.includes("the same one the party met before")));
  }

  console.log(
    "Ruleset combat director route: start, idempotency, refusal codes, the live sheet write-back, the board, an unchanged classic fight, the boss window, a named opponent the Game Master plays and the blueprint prompt passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
