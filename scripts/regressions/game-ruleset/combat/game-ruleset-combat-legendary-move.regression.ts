/**
 * Legendary moves (Capability API 1.283).
 *
 *   - `move` on a creature's signature action: a tarrasque "moves up to half its speed" between
 *     turns, walking a path the menu offers, struck at as it leaves somebody's reach, with the window
 *     it was bought in asked on once the strike lands.
 *   - `noOpportunity`: a vampire "moves up to its speed without provoking opportunity attacks".
 *   - `distance` and `untouchable`: a mummy lord's Whirlwind of Sand, 60 feet during which nothing
 *     harms or holds it: no strike, no zone, and the grapple that held it lets go.
 *   - Its own turn's movement is kept, nothing is offered off a board or to one held still.
 *   - The director buys one to close on an enemy out of its reach.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  RULESET_PASS_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  defaultRulesetSheetBuild,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-legendary-move-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 278);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  // A lasting fire on the ground, cast by the mage, that catches whoever walks in.
  const embers = {
    id: "embers",
    label: "Embers",
    rows: [{ list: "spells", values: { name: "Embers", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      area: { shape: "burst", size: 5 },
      range: 120,
      amount: { flat: 5 },
      damageType: "fire",
      zone: { rounds: 10, triggers: ["enter"] },
    },
  } as unknown as RulesetCatalogEntry;
  const spells = [embers];
  const definition = parsed(
    fiveE((doc) => doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells })),
  );
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const slam = { id: "slam", name: "Slam", budget: "action", toHit: 9, reach: 5, damage: { count: 1, sides: 6 } };
  const legendary = (move: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    id: "move",
    name: "Move",
    budget: "action",
    signature: { cost: 1 },
    move,
    ...extra,
  });
  const grid: TacticalGrid = {
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 30 }, () => "plains")),
  };
  const fight = (options: { board?: false; move?: Record<string, unknown>; speed?: number } = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } },
        {
          id: "fighter",
          name: "Fighter",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 10 },
            lists: {
              attacks: [{ name: "Sword", ability: "str", proficient: true, bonus: 0, damage: "1d8", reach: 5 }],
            },
          }),
          live: {},
        },
        {
          id: "beast",
          name: "Beast",
          side: "enemy",
          block: {
            health: 200,
            defense: 17,
            initiativeModifier: 0,
            speed: options.speed ?? 40,
            signaturePoints: 3,
            actions: [slam, legendary(options.move ?? { share: 0.5 })],
          } as unknown as RulesetStatBlock,
        },
      ],
      ...(options.board === false
        ? {}
        : {
            board: {
              grid,
              placements: { mage: { x: 2, y: 2 }, fighter: { x: 11, y: 7 }, beast: { x: 10, y: 7 } },
            },
          }),
    });
    state.order = ["mage", "fighter", "beast"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const keys = (cells: Array<{ x: number; y: number }> | undefined) =>
    new Set((cells ?? []).map((cell) => `${cell.x},${cell.y}`));
  const between = (state: RulesetEncounterState) => {
    const ended = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(ended.state.window?.kind, "signature");
    return ended;
  };
  const offered = (state: RulesetEncounterState) =>
    rulesetWindowOptions(definition, state, "beast").find((one) => one.id === "move");
  const moveTo = (state: RulesetEncounterState, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "beast", optionId: "move", targetIds: [], to, window: state.window!.id },
      roll,
    );

  // ── A tarrasque's half speed: struck at leaving the fighter's reach, then the next turn begins ──
  {
    const state = between(fight()).state;
    who(state, "beast").movementLeft = 3;
    const option = offered(state);
    assert.ok(option, "the beast may move between turns");
    assert.deepEqual(option!.targets, { side: "self", count: 0 });
    const cells = keys(option!.cells);
    assert.ok(cells.has("6,7") && !cells.has("5,7"), "half of 40 feet is 4 cells");
    const step = moveTo(state, { x: 6, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(step.state.window?.kind, "reaction", "the fighter is asked first");
    assert.equal(step.state.window?.trigger.kind, "leaves-reach");
    assert.deepEqual(step.state.window?.waiting, ["fighter"]);
    assert.deepEqual(at(step.state, "beast"), { x: 10, y: 7 }, "held where it was");
    const strike = rulesetWindowOptions(definition, step.state, "fighter").find(
      (one) => one.id !== RULESET_PASS_OPTION,
    );
    assert.ok(strike, "the fighter may strike");
    const struck = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "fighter", optionId: strike!.id, targetIds: ["beast"], window: step.state.window!.id },
      roll,
    );
    assert.equal(refused(struck), undefined, JSON.stringify(refused(struck)));
    assert.ok(struck.events.some((one) => one.type === "opportunity" && one.actorId === "fighter"));
    assert.deepEqual(at(struck.state, "beast"), { x: 6, y: 7 }, "then the walk goes on");
    assert.equal(struck.state.window, undefined, "the window it was bought in is done");
    assert.equal(struck.state.order[struck.state.turn], "fighter", "and the next turn begins");
    assert.equal(who(struck.state, "beast").signature!.points, 2, "one point spent");
    assert.equal(who(struck.state, "beast").movementLeft, 3, "its own movement kept");
    assert.equal(who(struck.state, "beast").trail, undefined, "nobody's turn's walk");
    // Passing the strike goes on the same way.
    const passed = applyRulesetCombatChoice(
      definition,
      moveTo(between(fight()).state, { x: 6, y: 7 }).state,
      { actorId: "fighter", optionId: RULESET_PASS_OPTION, targetIds: [] },
      roll,
    );
    assert.deepEqual(at(passed.state, "beast"), { x: 6, y: 7 });
    assert.equal(passed.state.order[passed.state.turn], "fighter");
    // Only to a cell the menu offered.
    const far = moveTo(between(fight()).state, { x: 5, y: 7 });
    assert.equal(refused(far)?.type === "refused" && refused(far)!.reason, "unreachable");
  }

  // ── A vampire's: nobody strikes at it leaving ──
  {
    const step = moveTo(between(fight({ move: { noOpportunity: true } })).state, { x: 2, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(!step.events.some((one) => one.type === "opportunity"));
    assert.deepEqual(at(step.state, "beast"), { x: 2, y: 7 }, "its whole speed");
    assert.equal(step.state.window, undefined);
    assert.equal(step.state.order[step.state.turn], "fighter");
  }

  // ── Whirlwind of Sand: 60 feet, out of a grapple, through fire, struck by nobody ──
  {
    const whirl = { distance: 60, untouchable: true };
    let state = fight({ move: whirl, speed: 20 });
    const cast = applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "mage",
        optionId: rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Embers")!.id,
        targetIds: [],
        at: { x: 8, y: 7 },
      },
      roll,
    );
    assert.equal(refused(cast), undefined, JSON.stringify(refused(cast)));
    state = cast.state;
    who(state, "beast").tracked.push({ condition: "grappled", rounds: null, source: "fighter" } as never);
    state = between(state).state;
    const option = offered(state);
    assert.ok(option, "held, and still offered");
    const cells = keys(option!.cells);
    assert.ok(cells.has("22,7") && !cells.has("23,7"), "60 feet is 12 cells, whatever its own speed");
    const step = moveTo(state, { x: 4, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(!step.events.some((one) => one.type === "opportunity"), "nobody strikes");
    assert.ok(!step.events.some((one) => one.type === "zone" && one.targetId === "beast"), "the fire does nothing");
    assert.ok(!who(step.state, "beast").tracked.some((one) => one.condition === "grappled"), "the grapple let go");
    assert.deepEqual(at(step.state, "beast"), { x: 4, y: 7 });
    assert.equal(who(step.state, "beast").health.value, 200);
    // The same 60 feet without it, held: nowhere to go.
    const held = between(fight({ move: { distance: 60 } })).state;
    who(held, "beast").tracked.push({ condition: "grappled", rounds: null, source: "fighter" } as never);
    assert.equal(offered(held), undefined, "a grapple holds an ordinary move");
    const plain = moveTo(between(fight({ move: { distance: 60 } })).state, { x: 4, y: 7 });
    assert.ok(plain.state.window?.trigger.kind === "leaves-reach", "an ordinary move is struck at");
  }

  // ── Nothing off a board, nor on its own turn ──
  {
    const off = applyRulesetCombatChoice(
      definition,
      fight({ board: false }),
      { actorId: "mage", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(off.state.window, undefined, "nowhere to go, so nobody is asked");
    const state = fight();
    state.turn = 2;
    assert.ok(!rulesetCombatOptions(definition, state, "beast").some((one) => one.id === "move"), "not on its turn");
  }

  // ── The director closes on an enemy out of its reach ──
  {
    const withBeast = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const beast = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        beast.id = "beast";
        beast.label = "Beast";
        beast.creature.speed = 5;
        beast.creature.signaturePoints = 3;
        beast.creature.actions = [
          { ...slam, damage: { dice: "1d4" } },
          { id: "rush", name: "Rush", budget: "action", signature: { cost: 1 }, move: { distance: 60 } },
        ];
        creatures.entries.push(beast);
      }),
    );
    const bestiary = Object.fromEntries(
      (withBeast.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (withBeast.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition: withBeast,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "beast", name: "Beast", creature: `${creaturesId}/beast` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withBeast) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
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
      enemies: [unit("beast", "Beast", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    // Ada held where she stands, eleven cells off: too far for the beast to walk, near enough to rush.
    const ada = rulesetCombatant(state.rulesetFight!.encounter, "ada")!;
    ada.tracked.push({ condition: "grappled", rounds: null } as never);
    syncRulesetCombatants(withBeast, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(withBeast, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(withBeast, state, { type: "continue" }).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    assert.ok(
      events.some((event) => event.type === "signature" && event.actorId === "beast" && event.label === "Rush"),
      `the creature rushed in: ${JSON.stringify(events.map((event) => event.type))}`,
    );
    const rushed = events.findIndex(
      (event) => event.type === "signature" && event.actorId === "beast" && event.label === "Rush",
    );
    const walked = events.slice(rushed + 1).find((event) => event.type === "move");
    assert.ok(
      walked?.type === "move" && walked.actorId === "beast" && walked.path.length > 2,
      `and walked further than its own speed: ${JSON.stringify(walked)}`,
    );
  }

  // ── Import refusals ──
  {
    const withCreature = (action: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "d",
            label: "D",
            creature: {
              health: 10,
              defense: 10,
              initiativeModifier: 0,
              speed: 30,
              tier: "cr_0",
              signaturePoints: 3,
              actions: [{ id: "a", name: "A", budget: "action", ...action }],
            },
          },
        ],
      });
    };
    parsed(fiveE(withCreature({ signature: { cost: 1 }, move: { share: 0.5 } })));
    parsed(fiveE(withCreature({ signature: { cost: 2 }, move: { distance: 60, untouchable: true } })));
    parsed(fiveE(withCreature({ signature: { cost: 1 }, move: { noOpportunity: true } })));
    refusedDoc(withCreature({ move: { share: 0.5 } }), /A move is bought with points between turns/);
    refusedDoc(
      withCreature({ signature: { cost: 1 }, move: { share: 0.5, distance: 30 } }),
      /A move is a "share" of its speed or a "distance", not both/,
    );
    refusedDoc(
      withCreature({ signature: { cost: 1 }, move: { share: 0.5 }, teleport: { distance: 30 } }),
      /A move follows what its action does, so it carries no teleport/,
    );
    refusedDoc(withCreature({ signature: { cost: 1 }, move: { share: 1.5 } }), /share/);
  }

  // ── The install gate ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = "A ruleset with a legendary move requires schemaVersion 2 and capabilityApi 1.283 or newer";
    const doc = fiveE((doc) =>
      doc.catalogs.push({
        id: "x",
        label: "X",
        entries: [{ id: "a", label: "A", creature: { actions: [legendary({ share: 0.5 })] } }],
      }),
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(282) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(283) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(282) as never, fiveE()), gate, "the plain 5e example");
    // A lasting area's own move names its budget, and is not one.
    const moonbeam = fiveE((doc) =>
      doc.catalogs.push({
        id: "x",
        label: "X",
        entries: [
          {
            id: "m",
            label: "M",
            mechanics: {
              kind: "utility",
              zone: { rounds: 10, triggers: ["enter"], move: { budget: "action", distance: 60 } },
            },
          },
        ],
      }),
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(282) as never, moonbeam), gate, "a moving zone");
  }

  console.log(
    "Ruleset legendary moves: a tarrasque walks half its speed between turns and is struck at leaving reach, a vampire provokes nobody, a mummy lord's Whirlwind of Sand goes 60 feet out of a grapple and through fire untouched.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
