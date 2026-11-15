/**
 * A broken concentration that picks one of a list of lair actions (Capability API 1.336).
 *
 *   - `brokenNextLair` may be a list: broken, the lair's next action is one of those and no other,
 *     whoever runs the creature picking (Father Ivo's Litany of Keeping, the shelves leaning north or
 *     south); taken, the choice is free again.
 *   - An opponent the Engine runs takes the one that would catch the most foes, even when another
 *     would hit one of them harder.
 *   - Refused shapes, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetOpenLairWindow,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lair-list-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 336);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // The north shelf leans hard onto one; the south one lightly onto everybody near it.
  const lean = (id: string, name: string, shelf: string, flat: number) => ({
    id,
    name,
    budget: "action",
    lair: true,
    range: 120,
    area: { shape: "burst", size: 10, aroundProp: shelf },
    save: { save: "dex_save", difficulty: 30, onSuccess: "none" },
    damage: { flat, type: "bludgeoning" },
  });
  const north = lean("shelves_lean_north", "Shelves Lean (north)", "North Shelf", 20);
  const south = lean("shelves_lean_south", "Shelves Lean (south)", "South Shelf", 2);
  const bell = { id: "bell", name: "The Hour Bell", budget: "action", lair: true, range: 120, autoHit: true };
  const litany = {
    id: "litany",
    name: "Litany of Keeping",
    budget: "bonus",
    self: true,
    concentration: true,
    applies: [{ condition: "invisible", duration: { rounds: 100 } }],
    brokenNextLair: ["shelves_lean_north", "shelves_lean_south"],
  };
  const ivo = {
    id: "father-ivo",
    label: "Father Ivo",
    creature: {
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      lairInitiative: 50,
      saves: { con_save: -30 },
      actions: [bell, north, south, litany],
    },
  };
  const cat = {
    id: "cat",
    label: "Cat",
    creature: {
      health: 20,
      defense: 10,
      initiativeModifier: 0,
      speed: 40,
      tier: "cr_0",
      actions: [
        { id: "claw", name: "Claw", budget: "action", reach: 5, autoHit: true, damage: { flat: 4, type: "slashing" } },
      ],
    },
  };
  const withIvo = (edit: (actions: Record<string, unknown>[]) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    const entry = structuredClone(ivo);
    edit(entry.creature.actions as Record<string, unknown>[]);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(entry, cat);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(withIvo());
  const creaturesId = definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.id;
  const bestiary: RulesetCatalogEntriesById = {
    [creaturesId]: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const roll = (sides: number) => Math.min(sides, 10);
  // Ada and Bo stand by the south shelf, Ada by the north one too; Ivo is far off.
  const encounter = (withCat = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "bo", name: "Bo", side: "party", build, live: {} },
        { id: "ivo", name: "Father Ivo", side: "enemy", creature: { catalogId: creaturesId, entryId: "father-ivo" } },
        ...(withCat
          ? [{ id: "cat", name: "Cat", side: "enemy" as const, creature: { catalogId: creaturesId, entryId: "cat" } }]
          : []),
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada: { x: 3, y: 4 }, bo: { x: 3, y: 7 }, ivo: { x: 13, y: 4 }, cat: { x: 12, y: 4 } },
        props: [
          { label: "North Shelf", cells: [{ x: 3, y: 2 }], health: 20 },
          { label: "South Shelf", cells: [{ x: 3, y: 6 }], health: 20 },
        ],
      },
      inLair: ["ivo"],
    });
    // The cat fights for the party, to break Ivo's concentration.
    if (withCat) rulesetCombatant(state, "cat")!.side = "party";
    const counts: Record<string, number> = { ada: 22, ivo: 21, cat: 21, bo: 5 };
    for (const one of state.combatants) one.initiative = counts[one.id]!;
    state.order = state.combatants
      .map((one) => one.id)
      .sort((a, b) => counts[b]! - counts[a]! || (a === "ivo" ? -1 : 1));
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const lairIds = (state: RulesetEncounterState) =>
    rulesetWindowOptions(definition, state, "ivo")
      .filter((one) => one.id.startsWith("lair>"))
      .map((one) => one.id)
      .sort();

  // ── Broken: one of the two shelves, and nothing else ──
  {
    let state = encounter(true);
    state = step(state, { actorId: "ada", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(state.order[state.turn], "ivo");
    state = step(state, { actorId: "ivo", optionId: "litany", targetIds: [] }).state;
    assert.equal(who(state, "ivo").concentrating?.actionId, "litany");
    state = step(state, { actorId: "ivo", optionId: "end-turn", targetIds: [] }).state;
    // The cat's claw breaks it: a Constitution save of -30.
    assert.equal(state.order[state.turn], "cat");
    const clawed = step(state, { actorId: "cat", optionId: "claw", targetIds: ["ivo"] });
    state = clawed.state;
    assert.equal(who(state, "ivo").concentrating, null, JSON.stringify(clawed.events));
    assert.deepEqual(who(state, "ivo").lair?.next, ["shelves_lean_north", "shelves_lean_south"]);
    // Even the shelf it leaned last round may be leaned again.
    who(state, "ivo").lair!.last = { round: state.round, id: "shelves_lean_north" };
    state = step(state, { actorId: "cat", optionId: "end-turn", targetIds: [] }).state;
    state = step(state, { actorId: "bo", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(state.window?.kind, "signature", "the lair's count, ahead of round 2");
    assert.deepEqual(
      lairIds(state),
      ["lair>shelves_lean_north", "lair>shelves_lean_south"],
      "either shelf, the one leaned last round too, and never the bell",
    );
    const leaned = step(state, {
      actorId: "ivo",
      optionId: "lair>shelves_lean_north",
      targetIds: [],
      at: { x: 3, y: 2 },
      window: state.window!.id,
    });
    assert.equal(who(leaned.state, "ivo").lair?.next, undefined, "taken, the choice is free again");
  }

  // ── The Engine running Ivo leans the shelf that catches the most ──
  {
    const fight = createRulesetFight({
      definition,
      seed: 3,
      party: [
        { id: "ada", name: "Ada" },
        { id: "bo", name: "Bo" },
      ],
      enemies: [{ id: "ivo", name: "Father Ivo", creature: `${creaturesId}/father-ivo` }],
      cards: [
        { name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } },
        { name: "Bo", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } },
      ],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
      inLair: ["ivo"],
    } as never);
    assert.ok(fight.ok, fight.ok ? "" : (fight as { error: string }).error);
    const built = (fight as { fight: { encounter: RulesetEncounterState } }).fight;
    // The board above, with the Litany already broken and the lair's count come round.
    const mine = encounter();
    who(mine, "ivo").lair!.next = ["shelves_lean_north", "shelves_lean_south"];
    built.encounter = rulesetOpenLairWindow(definition, mine);
    assert.equal(built.encounter.window?.kind, "signature");
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
      party: [unit("ada", "Ada", "player"), unit("bo", "Bo", "player")],
      enemies: [unit("ivo", "Father Ivo", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = built as never;
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const lairs = state.rulesetFight!.events.map((entry) => entry.event).filter((event) => event.type === "lair");
    assert.equal(lairs.length >= 1, true, JSON.stringify(state.rulesetFight!.events.map((entry) => entry.event)));
    assert.equal(
      (lairs[0] as { label: string }).label,
      "Shelves Lean (south)",
      "two caught by the south shelf beat one hit harder by the north",
    );
  }

  // ── Refused shapes, and the gate ──
  {
    const refused = (edit: (actions: Record<string, unknown>[]) => void, pattern: RegExp) => {
      const read = parseRulesetDefinition(withIvo(edit));
      assert.equal(read.ok, false);
      if (!read.ok)
        assert.ok(
          read.issues.some((issue) => pattern.test(issue)),
          read.issues.join("; "),
        );
    };
    refused((actions) => {
      actions[3] = { ...litany, brokenNextLair: ["shelves_lean_north", "litany"] };
    }, /"litany" is not one of its lair actions/);
    refused((actions) => {
      actions[3] = { ...litany, brokenNextLair: ["shelves_lean_north", "shelves_lean_north"] };
    }, /listed twice/);
    assert.equal(
      parseRulesetDefinition(withIvo((actions) => void (actions[3] = { ...litany, brokenNextLair: [] }))).ok,
      false,
    );
    const gate =
      "A ruleset with a broken concentration that picks one of a list of lair actions requires schemaVersion 2 and capabilityApi 1.336 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(335) as never, withIvo()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(336) as never, withIvo()), gate);
    const single = withIvo((actions) => void (actions[3] = { ...litany, brokenNextLair: "shelves_lean_south" }));
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(335) as never, single), gate);
    // In a catalog file too, however deep its creature sits.
    const listed = { brokenNextLair: ["shelves_lean_north", "shelves_lean_south"] };
    const deep = { wrap: { wrap: { wrap: { wrap: { wrap: { wrap: { creature: { actions: [listed] } } } } } } } };
    const filed = new Map([["catalogs/creatures.json", { id: "creatures", entries: [{ id: "ivo", ...deep }] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(335) as never, single, filed), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(336) as never, single, filed), gate);
  }

  console.log(
    "Broken lair list: the Litany broken leaves either shelf, and the Engine leans the one catching the most.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
