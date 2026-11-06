/**
 * The In hand row of a ruleset fight (owner-approved 2026-10-26): what a party member holds in hand,
 * taking a carried weapon or shield in hand on their own turn, and the ammunition a weapon shoots first.
 *
 *   - `draw` takes a carried weapon or shield in hand by its place in the fighter's items, as an item
 *     drawn as it is used is drawn (1.808): the fewest weapons in its way are put away, and the menu is
 *     read again from what they hold, so the attacks offered change mid-fight.
 *   - Nothing else is ever put away for it: a buckler in the hand it needs refuses it, named.
 *   - It spends the turn's one free interaction with an object (the free pick-up, 1.266): a second in
 *     one turn is refused, and the next turn has its own.
 *   - `ammo` picks the stack a weapon shoots first; the shot comes out of that stack, and what was drawn
 *     and shot is written back to the inventory stack by stack.
 *   - In a shared room only the member's own player may send either, and the classic director refuses
 *     both.
 *   - Through the real route, the answer to either command already carries the new hands and the
 *     fight's line for the draw, so the screen shows them without a reload (cloud playtest 129eede5e).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetSheetItems,
  type DirectedCombatView,
  type DirectedCommand,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-in-hand-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { commandCombatDirector, createCombatDirector },
  {
    commandRulesetCombatDirector,
    directedRulesetView,
    rulesetCommandRefusal,
    rulesetDirectorStage,
    syncRulesetCombatants,
    RULESET_ROOM_HOST,
  },
  { rulesetCombatEventLine, rulesetCombatNames, rulesetRefusalText },
] = await Promise.all([
  import("../../packages/server/src/services/game/combat-director.service.js"),
  import("../../packages/server/src/services/game/ruleset-combat-director.service.js"),
  import("../../packages/client/src/lib/ruleset-combat-log.js"),
]);

try {
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const messages = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url)),
      "utf8",
    ),
  ) as Record<string, string>;
  const t = ((key: string, params: Record<string, unknown> = {}) => {
    const text = messages[key];
    if (text === undefined) return (params.defaultValue as string | undefined) ?? key;
    return text.replace(/\{\{\s*(\w+)\s*\}\}/gu, (_, name: string) => String(params[name] ?? ""));
  }) as never;

  // Ember Roads has two hands and no `items.drawOnUse`: a weapon is used only while it is on. A buckler
  // (armor in one hand) is added; its axe and spear take a hand each, its bow both.
  const doc = JSON.parse(emberText) as Record<string, any>;
  doc.catalogs
    .find((catalog: { id: string }) => catalog.id === "outfitter")
    .entries.push({
      id: "buckler",
      label: "Buckler",
      item: { category: "armor", rarity: "common", stats: { bulk: 1, guard: 1 }, slots: { hands: 1 } },
    });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, `imports cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  const ember: RulesetDefinition = parsed.definition;
  const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
    (ember.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const book = rulesetItemBook(ember, entries, { actor: "player" });
  const stack = (id: string, name: string, ref: string, quantity = 1, equipped = false): GameInventoryStack => ({
    id,
    name,
    item: `outfitter/${ref}`,
    quantity,
    ...(equipped ? { equipped: true as const } : {}),
  });

  /** A fight Ada begins, against a foe that does nothing, as the director holds it. */
  const directed = (stacks: GameInventoryStack[]) => {
    const encounter = createRulesetEncounter({
      definition: ember,
      seed: 5,
      roller: () => 4,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: defaultRulesetSheetBuild(ember),
          items: rulesetSheetItems(book, stacks, undefined),
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 60, defense: 1, initiativeModifier: -20, actions: [] },
        },
      ],
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
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("foe", "Foe", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 5,
    } as never);
    state.rulesetFight = {
      encounter,
      eventSeq: 0,
      events: [],
      controllers: {},
      bosses: [],
      adjustments: [],
    };
    syncRulesetCombatants(ember, state);
    state.stage = rulesetDirectorStage(state);
    return state;
  };
  const optionIds = (encounter: RulesetEncounterState) =>
    rulesetCombatOptions(ember, encounter, "ada").map((option) => option.id);
  const worn = (stacks: readonly GameInventoryStack[]) =>
    stacks
      .filter((one) => one.equipped)
      .map((one) => one.id)
      .sort();
  const command = (state: ReturnType<typeof directed>, sent: DirectedCommand) =>
    commandRulesetCombatDirector(ember, state, sent);
  const refused = (state: ReturnType<typeof directed>, sent: DirectedCommand, code: string, error?: string) => {
    const before = JSON.stringify(state.rulesetFight);
    const result = command(state, sent);
    assert.equal(result.ok, false, `${sent.type} is refused`);
    if (result.ok) return;
    assert.equal(result.code, code, result.error);
    if (error) assert.equal(result.error, error);
    assert.equal(JSON.stringify(state.rulesetFight), before, "a refusal changes nothing");
  };

  // ── A swap mid-fight changes the attacks offered, and is written back ──
  const stacks = [
    stack("axe", "Hand axe", "hand-axe", 1, true),
    stack("spear", "Boar spear", "boar-spear", 1, true),
    stack("bow", "Hunting bow", "hunting-bow"),
    stack("arrows", "Arrows", "arrows", 10),
    stack("bodkins", "Bodkin arrows", "arrows", 5),
  ];
  const state = directed(stacks);
  const fight = state.rulesetFight!;
  const start = structuredClone(fight.encounter);
  assert.equal(directedRulesetView(ember, state)!.actorId, "ada", "Ada acts first");
  {
    const before = optionIds(fight.encounter);
    assert.ok(before.includes("item:0") && before.includes("item:1"), "the axe and the spear in hand are offered");
    assert.equal(before.includes("item:2"), false, "the carried bow is not: this ruleset never draws as it uses");
    const hands = directedRulesetView(ember, state)!.combatants.find((one) => one.id === "ada")!.hands!;
    assert.deepEqual(hands.slots, [{ id: "hands", label: "Hands", count: 2 }]);
    assert.deepEqual(hands.holding, [
      { item: 0, name: "Hand axe", takes: 1 },
      { item: 1, name: "Boar spear", takes: 1 },
    ]);
    assert.deepEqual(hands.carried, [{ item: 2, name: "Hunting bow" }], "the bow could go in, both weapons put away");
    assert.equal(hands.free, true);
    assert.equal(hands.ammo.length, 0, "no weapon in hand shoots yet");

    assert.ok(command(state, { type: "draw", unitId: "ada", item: 2 }).ok, "the bow is taken in hand");
    const after = optionIds(fight.encounter);
    assert.ok(after.includes("item:2"), "the bow's shot is offered now");
    assert.equal(after.includes("item:0") || after.includes("item:1"), false, "and the weapons put away are not");
    const ada = rulesetCombatant(fight.encounter, "ada")!;
    assert.deepEqual(ada.drawn, { 0: false, 1: false, 2: true });
    const said = fight.events.at(-1)!.event;
    assert.deepEqual(said, { type: "drew", actorId: "ada", label: "Hunting bow", stowed: ["Hand axe", "Boar spear"] });
    assert.equal(
      rulesetCombatEventLine(said, rulesetCombatNames(ember, directedRulesetView(ember, state)!, t), t),
      "Ada takes Hunting bow in hand, putting away Hand axe, Boar spear.",
    );
    const view = directedRulesetView(ember, state)!.combatants.find((one) => one.id === "ada")!.hands!;
    assert.deepEqual(view.holding, [{ item: 2, name: "Hunting bow", takes: 2 }]);
    assert.deepEqual(
      view.carried.map((one) => one.name),
      ["Hand axe", "Boar spear"],
    );
    assert.equal(view.free, false, "the turn's free interaction is spent");
    assert.deepEqual(view.ammo, [
      {
        weapon: 2,
        name: "Hunting bow",
        first: 3,
        stacks: [
          { item: 3, name: "Arrows", left: 10 },
          { item: 4, name: "Bodkin arrows", left: 5 },
        ],
      },
    ]);
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, fight.encounter))!;
    assert.deepEqual(worn(written.stacks), ["bow"], "the bow is on, the axe and spear put away, in the bag");
  }

  // ── The turn's one free interaction: a second swap is refused ──
  refused(
    state,
    { type: "draw", unitId: "ada", item: 0 },
    "ruleset_combat_interaction_spent",
    "The turn's free interaction with an object is already spent.",
  );
  assert.equal(
    rulesetRefusalText("ruleset_combat_interaction_spent", "x", t),
    "Their free interaction with an object this turn is already spent.",
  );
  refused(state, { type: "draw", unitId: "ada", item: 3 }, "ruleset_combat_not_carried");
  refused(state, { type: "draw", unitId: "foe", item: 0 }, "ruleset_combat_not-your-turn");

  // ── The ammunition picked is the ammunition shot, and written back ──
  {
    refused(state, { type: "ammo", unitId: "ada", weapon: 2, stack: 0 }, "ruleset_combat_no_ammo");
    refused(state, { type: "ammo", unitId: "ada", weapon: 0, stack: 3 }, "ruleset_combat_no_ammo");
    assert.ok(command(state, { type: "ammo", unitId: "ada", weapon: 2, stack: 4 }).ok);
    const hands = directedRulesetView(ember, state)!.combatants.find((one) => one.id === "ada")!.hands!;
    assert.equal(hands.ammo[0]!.first, 4, "the bodkins are shot first now");
    const before = structuredClone(fight.encounter);
    assert.ok(command(state, { type: "ruleset", optionId: "item:2", targetIds: ["foe"] }).ok, "the bow shoots");
    const ada = rulesetCombatant(fight.encounter, "ada")!;
    assert.deepEqual(ada.itemsUsed, { 4: 1 }, "out of the bodkins, not the arrows first in the bag");
    const changes = rulesetFightItemChanges(before, fight.encounter);
    assert.deepEqual(
      changes.map((change) => [change.stack.id, change.taken]),
      [["bodkins", 1]],
    );
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, fight.encounter))!;
    assert.deepEqual(
      written.stacks.map((one) => [one.id, one.quantity, one.equipped === true]),
      [
        ["axe", 1, false],
        ["spear", 1, false],
        ["bow", 1, true],
        ["arrows", 10, false],
        ["bodkins", 4, false],
      ],
    );
  }

  // ── The next turn has its own free interaction ──
  {
    for (let guard = 0; guard < 10; guard++) {
      const view = directedRulesetView(ember, state)!;
      const end = view.actorId === "ada" ? view.options?.find((option) => option.kind === "end-turn") : undefined;
      assert.ok(command(state, end ? { type: "ruleset", optionId: end.id, targetIds: [] } : { type: "continue" }).ok);
      if (fight.encounter.round > 1 && directedRulesetView(ember, state)!.actorId === "ada") break;
    }
    assert.equal(fight.encounter.round, 2);
    assert.equal(directedRulesetView(ember, state)!.combatants.find((one) => one.id === "ada")!.hands!.free, true);
    assert.ok(command(state, { type: "draw", unitId: "ada", item: 0 }).ok, "the axe is taken back in hand");
    assert.deepEqual(rulesetCombatant(fight.encounter, "ada")!.drawn, { 0: true, 1: false, 2: false });
    assert.deepEqual(
      optionIds(fight.encounter).filter((id) => /^item:/.test(id)),
      ["item:0"],
    );
  }

  // ── Never past a buckler: refused as slots full, naming it ──
  {
    const shielded = directed([
      stack("buckler", "Buckler", "buckler", 1, true),
      stack("axe", "Hand axe", "hand-axe", 1, true),
      stack("bow", "Hunting bow", "hunting-bow"),
      stack("spear", "Boar spear", "boar-spear"),
    ]);
    const hands = directedRulesetView(ember, shielded)!.combatants.find((one) => one.id === "ada")!.hands!;
    assert.deepEqual(hands.holding, [
      { item: 0, name: "Buckler", takes: 1 },
      { item: 1, name: "Hand axe", takes: 1 },
    ]);
    assert.deepEqual(hands.carried, [
      { item: 2, name: "Hunting bow", blockedBy: ["Buckler"] },
      { item: 3, name: "Boar spear" },
    ]);
    refused(
      shielded,
      { type: "draw", unitId: "ada", item: 2 },
      "ruleset_combat_slots_full",
      "Hunting bow cannot be taken in hand: its slots are held by Buckler.",
    );
    // The spear goes in the axe's hand, and the buckler stays.
    assert.ok(commandRulesetCombatDirector(ember, shielded, { type: "draw", unitId: "ada", item: 3 }).ok);
    assert.deepEqual(rulesetCombatant(shielded.rulesetFight!.encounter, "ada")!.drawn, { 1: false, 3: true });
  }

  // ── In a shared room, only the member's own player sends them ──
  {
    fight.players = { ada: { participantId: "guest", name: "Gil" } };
    const guest = { host: false, participantId: "guest" };
    const stranger = { host: false, participantId: "someone_else" };
    for (const sent of [
      { type: "draw", unitId: "ada", item: 1 },
      { type: "ammo", unitId: "ada", weapon: 2, stack: 3 },
    ] as DirectedCommand[]) {
      assert.equal(rulesetCommandRefusal(state, fight, sent, RULESET_ROOM_HOST)?.code, "ruleset_combat_not_yours");
      assert.equal(rulesetCommandRefusal(state, fight, sent, RULESET_ROOM_HOST)?.error, "Ada is Gil's to play.");
      assert.equal(rulesetCommandRefusal(state, fight, sent, stranger)?.code, "ruleset_combat_not_yours");
      assert.equal(rulesetCommandRefusal(state, fight, sent, guest), null, `${sent.type}: the guest's own`);
    }
    delete fight.players;
  }

  // ── The classic director has neither ──
  {
    const classic = createCombatDirector({
      id: "classic",
      anchor: "anchor",
      style: "classic",
      party: [
        {
          id: "ada",
          name: "Ada",
          side: "player",
          hp: 30,
          maxHp: 30,
          attack: 8,
          defense: 6,
          speed: 6,
          level: 3,
          skills: [],
        },
      ],
      enemies: [
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          hp: 30,
          maxHp: 30,
          attack: 8,
          defense: 6,
          speed: 1,
          level: 3,
          skills: [],
        },
      ],
      gm: false,
      difficulty: "normal",
      seed: 5,
    } as never);
    assert.throws(
      () => commandCombatDirector(classic, { type: "draw", unitId: "ada", item: 0 }),
      /Only a ruleset fight/,
    );
    assert.throws(
      () => commandCombatDirector(classic, { type: "ammo", unitId: "ada", weapon: 0, stack: 1 }),
      /Only a ruleset fight/,
    );
  }

  // ── Through the route: the answer carries the new hands and the draw's line ──
  // (cloud playtest 129eede5e: the row read "Longsword, Shield" and the log had no draw until a reload.)
  {
    const [
      { default: Fastify },
      { getDB, closeDB },
      { createChatsStorage },
      { createGameStateStorage },
      { createGameRulesetsStorage },
      { combatDirectorRoutes },
    ] = await Promise.all([
      import("../../packages/server/node_modules/fastify/fastify.js"),
      import("../../packages/server/src/db/connection.js"),
      import("../../packages/server/src/services/storage/chats.storage.js"),
      import("../../packages/server/src/services/storage/game-state.storage.js"),
      import("../../packages/server/src/services/storage/game-rulesets.storage.js"),
      import("../../packages/server/src/routes/combat-director.routes.js"),
    ]);
    const db = await getDB();
    const app = Fastify();
    app.decorate("db", db);
    await app.register(combatDirectorRoutes, { prefix: "/combat", chooseBoss: async () => "" });
    try {
      const RULESET_ID = "local/ember-in-hand";
      await createGameRulesetsStorage(db).put({
        rulesetId: RULESET_ID,
        version: ember.version,
        sourceKind: "local",
        definition: JSON.stringify({ ...doc, id: "ember-in-hand" }),
      });
      const chats = createChatsStorage(db);
      const chat = await chats.create({ name: "In hand", mode: "game", characterIds: [] });
      const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
      await chats.patchMetadata(chat.id, {
        gameSetupConfig: { combatDirector: true, difficulty: "Normal" },
        gameRuleset: { id: RULESET_ID, version: ember.version, packageId: null, options: {} },
        gameCharacterCards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(ember) } }],
        gameInventory: stacks,
      });
      await createGameStateStorage(db).create({
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
      const fighter = (id: string, name: string, side: "player" | "enemy", speed: number) => ({
        id,
        name,
        side,
        hp: 30,
        maxHp: 30,
        attack: 8,
        defense: 6,
        speed,
        level: 3,
        skills: [],
      });
      const started = await app.inject({
        method: "POST",
        url: "/combat/start",
        payload: {
          chatId: chat.id,
          anchor: anchor.id,
          style: "ruleset",
          party: [fighter("ada", "Ada", "player", 9)],
          enemies: [fighter("foe", "Foe", "enemy", 1)],
        },
      });
      assert.equal(started.statusCode, 200, started.body);
      let session = started.json().session as DirectedCombatView;
      const send = async (sent: DirectedCommand) => {
        const answer = await app.inject({
          method: "POST",
          url: "/combat/command",
          payload: {
            chatId: chat.id,
            anchor: anchor.id,
            id: session.id,
            instanceId: session.instanceId,
            revision: session.revision,
            requestId: crypto.randomUUID(),
            command: sent,
          },
        });
        assert.equal(answer.statusCode, 200, answer.body);
        assert.equal(answer.json().stale, undefined, `${sent.type} is applied, not answered as stale`);
        session = answer.json().session as DirectedCombatView;
      };
      for (let guard = 0; guard < 10 && session.ruleset!.actorId !== "ada"; guard++) await send({ type: "continue" });
      const handsOf = (view: DirectedCombatView) => view.ruleset!.combatants.find((one) => one.id === "ada")!.hands!;
      assert.equal(session.ruleset!.actorId, "ada");
      assert.deepEqual(
        handsOf(session).holding.map((one) => one.name),
        ["Hand axe", "Boar spear"],
      );
      const seen = session.ruleset!.events.at(-1)!.seq;

      await send({ type: "draw", unitId: "ada", item: 2 });
      const hands = handsOf(session);
      assert.deepEqual(hands.holding, [{ item: 2, name: "Hunting bow", takes: 2 }], "the answer holds the bow");
      assert.deepEqual(
        hands.carried.map((one) => one.name),
        ["Hand axe", "Boar spear"],
      );
      assert.equal(hands.free, false);
      const said = session.ruleset!.events.filter((one) => one.seq > seen).map((one) => one.event);
      assert.deepEqual(said, [
        { type: "drew", actorId: "ada", label: "Hunting bow", stowed: ["Hand axe", "Boar spear"] },
      ]);
      assert.equal(
        rulesetCombatEventLine(said[0]!, rulesetCombatNames(ember, session.ruleset!, t), t),
        "Ada takes Hunting bow in hand, putting away Hand axe, Boar spear.",
        "the answer's log says it",
      );

      await send({ type: "ammo", unitId: "ada", weapon: 2, stack: 4 });
      assert.equal(handsOf(session).ammo[0]!.first, 4, "and the ammunition picked, at once");

      // What a reload reads is what the answers said.
      const read = await app.inject({ url: `/combat/state?chatId=${chat.id}&anchor=${anchor.id}` });
      const reloaded = read.json().session as DirectedCombatView;
      assert.equal(reloaded.revision, session.revision);
      assert.deepEqual(handsOf(reloaded), handsOf(session));
      assert.deepEqual(reloaded.ruleset!.events, session.ruleset!.events);
    } finally {
      await app.close();
      await closeDB();
    }
  }

  console.log(
    "In hand: a swap mid-fight changes the attacks offered and is written back, a buckler refuses it, one free a turn, the ammunition picked is shot, only the member's own player sends either, and the route's answer shows both at once.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
