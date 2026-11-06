/**
 * A legendary move after what its action does, and on one named speed (Capability API 1.285).
 *
 *   - A dragon's Wing Attack: a burst around it, then "the dragon can then fly up to half its flying
 *     speed": `move: { share: 0.5, speed: "fly" }` on the same signature action. The burst lands
 *     first, then the flight to a cell the menu offered, struck at leaving reach as any walk is; going
 *     nowhere is a choice too.
 *   - A move on one named speed is measured off that speed alone, and with none of it goes nowhere.
 *   - The director flies off after the buffet when it is badly hurt.
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
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-move-after-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 280);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
  const definition = parsed(fiveE());
  const sword = rulesetSheetBuildSchema.parse({
    abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 40 },
    lists: { attacks: [{ name: "Sword", ability: "str", proficient: true, bonus: 0, damage: "1d8", reach: 5 }] },
  });
  const bite = { id: "bite", name: "Bite", budget: "action", toHit: 9, reach: 10, damage: { count: 2, sides: 10 } };
  const wing = (move: Record<string, unknown> = { share: 0.5, speed: "fly" }) => ({
    id: "wing",
    name: "Wing Attack",
    budget: "action",
    signature: { cost: 2 },
    autoHit: true,
    damage: { count: 0, sides: 6, flat: 5 },
    area: { shape: "burst", size: 10, around: true },
    move,
  });
  const grid: TacticalGrid = {
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 30 }, () => "plains")),
  };
  const frail = rulesetSheetBuildSchema.parse({ ...sword, fields: { ...sword.fields, hp_max: 3 } });
  const fight = (options: { action?: Record<string, unknown>; flies?: boolean; frail?: boolean } = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "fighter", name: "Fighter", side: "party", build: options.frail ? frail : sword, live: {} },
        { id: "rogue", name: "Rogue", side: "party", build: sword, live: {} },
        {
          id: "dragon",
          name: "Dragon",
          side: "enemy",
          block: {
            health: 200,
            defense: 18,
            initiativeModifier: 0,
            speed: 40,
            ...(options.flies === false ? {} : { speeds: { fly: 80 } }),
            signaturePoints: 3,
            actions: [bite, options.action ?? wing()],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid,
        placements: { fighter: { x: 11, y: 7 }, rogue: { x: 2, y: 2 }, dragon: { x: 10, y: 7 } },
      },
    });
    state.order = ["rogue", "fighter", "dragon"];
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
      { actorId: "rogue", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(ended.state.window?.kind, "signature");
    return ended.state;
  };
  const offered = (state: RulesetEncounterState, id = "wing") =>
    rulesetWindowOptions(definition, state, "dragon").find((one) => one.id === id);
  const buy = (state: RulesetEncounterState, extra: Record<string, unknown> = {}, id = "wing") =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "dragon", optionId: id, targetIds: [], window: state.window!.id, ...extra },
      roll,
    );
  const hurt = (step: RulesetCombatStep, id: string) =>
    step.events.some((one) => one.type === "damage" && one.targetId === id);

  // ── The menu: the buffet, and where the flight may end ──
  {
    const option = offered(between(fight()));
    assert.ok(option, "offered");
    assert.equal(option!.moveAfter, true);
    assert.deepEqual(option!.targets, { side: "self", count: 0 }, "a burst around it, aimed at nobody");
    const cells = keys(option!.cells);
    assert.ok(cells.has("18,7") && !cells.has("19,7"), "half of 80 feet of flight is 8 cells");
  }

  // ── The buffet, then the flight: struck at leaving the fighter's reach ──
  {
    const state = between(fight());
    const step = buy(state, { to: { x: 18, y: 7 } });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(hurt(step, "fighter"), "the buffet lands first");
    const damageAt = step.events.findIndex((one) => one.type === "damage");
    const windowAt = step.events.findIndex((one) => one.type === "window");
    assert.ok(damageAt >= 0 && windowAt > damageAt, "then the flight is struck at");
    assert.equal(step.state.window?.trigger.kind, "leaves-reach");
    const passed = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "fighter", optionId: RULESET_PASS_OPTION, targetIds: [] },
      roll,
    );
    assert.deepEqual(at(passed.state, "dragon"), { x: 18, y: 7 });
    assert.equal(passed.state.window, undefined);
    assert.equal(passed.state.order[passed.state.turn], "fighter", "the next turn begins");
    assert.equal(who(passed.state, "dragon").signature!.points, 1);
  }

  // ── Going nowhere is a choice too; a cell not offered is refused ──
  {
    const state = between(fight());
    const stay = buy(state);
    assert.equal(refused(stay), undefined, JSON.stringify(refused(stay)));
    assert.ok(hurt(stay, "fighter"));
    assert.deepEqual(at(stay.state, "dragon"), { x: 10, y: 7 });
    assert.equal(stay.state.order[stay.state.turn], "fighter");
    const far = buy(state, { to: { x: 19, y: 7 } });
    assert.equal(refused(far)?.type === "refused" && refused(far)!.reason, "unreachable");
    assert.equal(far.state, state, "nothing moved");
  }

  // ── One named speed: none of it, nowhere to go ──
  {
    const grounded = between(fight({ flies: false }));
    const option = offered(grounded);
    assert.ok(option, "the buffet is still offered");
    assert.equal(option!.cells, undefined, "with no flight there is nowhere to fly");
    const step = buy(grounded, { to: { x: 12, y: 7 } });
    assert.equal(refused(step)?.type === "refused" && refused(step)!.reason, "unreachable");
    // A move that only moves, on flight alone.
    const glide = {
      id: "glide",
      name: "Glide",
      budget: "action",
      signature: { cost: 1 },
      move: { share: 0.25, speed: "fly" },
    };
    const only = offered(between(fight({ action: glide })), "glide");
    assert.ok(only && !only.moveAfter, "only moves");
    const cells = keys(only!.cells);
    assert.ok(cells.has("14,7") && !cells.has("15,7"), "a quarter of 80 feet is 4 cells");
    const nowhere = applyRulesetCombatChoice(
      definition,
      fight({ action: glide, flies: false }),
      { actorId: "rogue", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(nowhere.state.window, undefined, "nothing to glide on, so nobody is asked");
  }

  // ── A blow at one target, then the move; where the blow changed the board, the move gives way ──
  {
    const tail = {
      id: "tail",
      name: "Tail",
      budget: "action",
      signature: { cost: 1 },
      toHit: 30,
      reach: 10,
      damage: { count: 1, sides: 4 },
      push: 10,
      move: { share: 0.5, speed: "fly" },
    };
    const state = between(fight({ action: tail }));
    const option = offered(state, "tail");
    assert.deepEqual(option!.targets, { side: "enemy", count: 1 }, "aimed at somebody");
    assert.ok(keys(option!.cells).has("13,7"), "the square past the fighter is open now");
    const step = buy(state, { targetIds: ["fighter"], to: { x: 13, y: 7 } }, "tail");
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(hurt(step, "fighter"));
    assert.deepEqual(at(step.state, "fighter"), { x: 13, y: 7 }, "knocked into it");
    assert.deepEqual(at(step.state, "dragon"), { x: 10, y: 7 }, "so the dragon stays where it is");
    assert.equal(step.state.order[step.state.turn], "fighter");
    const moved = buy(state, { targetIds: ["fighter"], to: { x: 10, y: 3 } }, "tail");
    assert.deepEqual(at(moved.state, "dragon"), { x: 10, y: 3 }, "elsewhere it flies on");
  }

  // ── A blow that drops the last of the party: they still roll to live, so the fight goes on (laptop
  //    pass 8 2026-10-26), and the dragon flies on as it would ──
  {
    const state = fight({ frail: true });
    who(state, "rogue").defeated = true;
    const step = buy(between(state), { to: { x: 18, y: 7 } });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(!step.events.some((one) => one.type === "outcome"), "still rolling to live");
    assert.equal(who(step.state, "fighter").dying, true);
    assert.deepEqual(at(step.state, "dragon"), { x: 18, y: 7 }, "flown on");
  }

  // ── A distance on a speed it does not have goes nowhere ──
  {
    const hop = {
      id: "hop",
      name: "Hop",
      budget: "action",
      signature: { cost: 1 },
      move: { distance: 30, speed: "fly" },
    };
    const has = offered(between(fight({ action: hop })), "hop");
    assert.ok(has && keys(has.cells).has("16,7"), "30 feet of flight is 6 cells");
    const none = applyRulesetCombatChoice(
      definition,
      fight({ action: hop, flies: false }),
      { actorId: "rogue", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(none.state.window, undefined, "no flight, nowhere to hop");
  }

  // ── The director buffets and flies off when badly hurt ──
  {
    const withDragon = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const entry = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        entry.id = "dragon";
        entry.label = "Dragon";
        entry.creature.speeds = { fly: 80 };
        entry.creature.signaturePoints = 3;
        entry.creature.actions = [
          { ...bite, damage: { dice: "1d4" } },
          { ...wing(), damage: { dice: "3d6", flat: 4 } },
        ];
        creatures.entries.push(entry);
      }),
    );
    const bestiary = Object.fromEntries(
      (withDragon.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (withDragon.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const sturdy = defaultRulesetSheetBuild(withDragon);
    sturdy.fields = { ...sturdy.fields, hp_max: 30 };
    const built = createRulesetFight({
      definition: withDragon,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "dragon", name: "Dragon", creature: `${creaturesId}/dragon` }],
      // Sturdy enough to stand through the buffet, so the dragon has somebody to fly from.
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: sturdy } }],
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
      enemies: [unit("dragon", "Dragon", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    // Beside Ada and badly hurt.
    const encounter = state.rulesetFight!.encounter;
    const ada = rulesetCombatant(encounter, "ada")!;
    const dragon = rulesetCombatant(encounter, "dragon")!;
    dragon.x = ada.x! + 1;
    dragon.y = ada.y;
    (dragon as unknown as { health: { value: number } }).health.value = 5;
    syncRulesetCombatants(withDragon, state);
    state.stage = rulesetDirectorStage(state);
    // Ada only stands there: on the AI she may grapple the dragon, and a grappled dragon flies nowhere.
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      const now = state.rulesetFight!.encounter;
      const waiting = now.window?.waiting[0];
      const command =
        waiting === "ada"
          ? { type: "ruleset" as const, optionId: RULESET_PASS_OPTION, targetIds: [] }
          : !now.window && now.order[now.turn] === "ada"
            ? { type: "ruleset" as const, optionId: "end-turn", targetIds: [] }
            : { type: "continue" as const };
      assert.ok(commandRulesetCombatDirector(withDragon, state, command as never).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    const bought = events.findIndex(
      (event) => event.type === "signature" && event.actorId === "dragon" && event.label === "Wing Attack",
    );
    assert.ok(bought >= 0, `the dragon buffeted: ${JSON.stringify(events.map((event) => event.type))}`);
    const flew = events.slice(bought + 1).find((event) => event.type === "move");
    assert.ok(
      flew?.type === "move" && flew.actorId === "dragon" && flew.path.length > 1,
      `and flew: ${JSON.stringify(flew)}`,
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
    parsed(fiveE(withCreature({ ...wing(), damage: { dice: "2d6" } })));
    parsed(fiveE(withCreature({ signature: { cost: 1 }, move: { speed: "swim", distance: 30 } })));
    refusedDoc(withCreature({ signature: { cost: 1 }, move: { speed: "teleport" } }), /speed/);
    refusedDoc(
      withCreature({ signature: { cost: 1 }, move: {}, sequence: [{ action: "b" }] }),
      /A move follows what its action does, so it carries no sequence/,
    );
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
    const gate =
      "A ruleset with a legendary move after its action or on one speed requires schemaVersion 2 and capabilityApi 1.285 or newer";
    const docOf = (action: Record<string, unknown>) =>
      fiveE((doc) =>
        doc.catalogs.push({ id: "x", label: "X", entries: [{ id: "a", label: "A", creature: { actions: [action] } }] }),
      );
    for (const [label, action] of [
      ["after", wing({ share: 0.5 })],
      ["on one speed", { id: "g", name: "G", budget: "action", signature: { cost: 1 }, move: { speed: "fly" } }],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(284) as never, docOf(action)), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(285) as never, docOf(action)), gate, label);
    }
    const plain = docOf({ id: "m", name: "M", budget: "action", signature: { cost: 1 }, move: { share: 0.5 } });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(284) as never, plain), gate, "a 1.283 move");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(284) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset moves after their action: a dragon's Wing Attack buffets, then flies half its flying speed to a cell it picks, struck at leaving reach; a move on one speed goes nowhere without it.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
