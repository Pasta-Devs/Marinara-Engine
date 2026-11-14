/**
 * A creature's action that leaves an area standing or changes the ground (Capability API 1.324).
 *
 *   - `zone` on a creature's action, aimed by its `area`: The Owed's Freezing Fog, heavy fog that
 *     lasts `untilLair`, until the next lair action; Scatter Flour's cube of flour; The Ground
 *     Freezes, hard going.
 *   - `ground` on a creature's action changes the cells its area covers for good, as a board event
 *     does: the bonfire gutters (dark), the ice cracks (water).
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
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 324);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const definition = (() => {
    const result = parseRulesetDefinition(JSON.parse(fiveEText));
    assert.ok(result.ok);
    return result.definition;
  })();
  const fog = {
    id: "fog",
    name: "Freezing Fog",
    budget: "action",
    lair: true,
    range: 120,
    area: { shape: "burst", size: 10 },
    zone: { rounds: 10, untilLair: true, triggers: [], obscures: {} },
  };
  const flour = {
    id: "flour",
    name: "Scatter Flour",
    budget: "action",
    range: 60,
    area: { shape: "box", size: 10 },
    zone: { rounds: 1, triggers: [], obscures: {} },
  };
  const freeze = {
    id: "freeze",
    name: "The Ground Freezes",
    budget: "action",
    range: 60,
    area: { shape: "burst", size: 5 },
    zone: { rounds: 10, triggers: [], terrain: { difficult: true } },
  };
  const gutter = {
    id: "gutter",
    name: "Bonfire Gutters",
    budget: "action",
    range: 60,
    area: { shape: "burst", size: 5 },
    ground: { light: "dark", tell: "The bonfire gutters out." },
  };
  const crack = {
    id: "crack",
    name: "Ice Cracks",
    budget: "action",
    range: 60,
    area: { shape: "box", size: 10 },
    ground: { terrain: "water" },
  };
  // A second lair action, since the same one is never taken two rounds running.
  const rime = { ...freeze, id: "rime", name: "Rime Creeps", lair: true };
  const block = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      actions: [fog, rime, flour, freeze, gutter, crack],
    }) as unknown as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const roll = () => 10;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "bo", name: "Bo", side: "party", build, live: {} },
        { id: "owed", name: "The Owed", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada: { x: 2, y: 2 }, bo: { x: 2, y: 6 }, owed: { x: 12, y: 4 } },
        light: "bright",
      },
      inLair: ["owed"],
    });
    for (const one of state.combatants) one.initiative = { ada: 22, owed: 21, bo: 15 }[one.id]!;
    state.order = ["ada", "owed", "bo"];
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
  const end = (state: RulesetEncounterState) =>
    step(state, { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] });
  const own = (state: RulesetEncounterState, id: string, at: { x: number; y: number }) => {
    state.turn = state.order.indexOf("owed");
    const option = rulesetCombatOptions(definition, state, "owed").find((one) => one.id === id);
    assert.ok(option, `${id}: ${rulesetCombatOptions(definition, state, "owed").map((one) => one.id)}`);
    return step(state, { actorId: "owed", optionId: id, targetIds: [], at });
  };

  // ── Read off a bestiary entry, and refused without an area ──
  {
    const doc = JSON.parse(fiveEText);
    const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
    creatures.entries[0].creature.actions.push(structuredClone(fog), structuredClone(gutter));
    const read = parseRulesetDefinition(doc);
    assert.ok(read.ok, read.ok ? "" : read.issues.join("; "));
    {
      const entry = read.definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries![0]!;
      const actions = rulesetCreatureBlock(read.definition, entry)?.actions ?? [];
      assert.equal(actions.find((one) => one.id === "fog")?.zone?.untilLair, true, "the fog read off the bestiary");
      assert.equal(actions.find((one) => one.id === "gutter")?.ground?.light, "dark", "the ground read off it");
    }
    const { area: _area, ...noArea } = gutter;
    creatures.entries[0].creature.actions.push({ ...noArea, id: "bare" });
    const bare = parseRulesetDefinition(doc);
    assert.equal(bare.ok, false);
    if (!bare.ok) assert.ok(bare.issues.some((issue) => /"ground" is where its "area" is aimed/.test(issue)));
    creatures.entries[0].creature.actions.pop();
    creatures.entries[0].creature.actions.push({ ...gutter, id: "still", ground: {} });
    const still = parseRulesetDefinition(doc);
    assert.equal(still.ok, false);
    if (!still.ok)
      assert.ok(
        still.issues.some((issue) => /changes something/.test(issue)),
        still.issues.join("; "),
      );
  }

  // ── Freezing Fog: until the next lair action ──
  {
    let state = fight();
    state = end(state).state;
    // 21 to 15 passes the lair's 20: its window.
    state = end(state).state;
    assert.equal(state.window?.kind, "signature");
    assert.ok(rulesetWindowOptions(definition, state, "owed").some((one) => one.id === "lair>fog"));
    const fogged = step(state, {
      actorId: "owed",
      optionId: "lair>fog",
      targetIds: [],
      at: { x: 2, y: 2 },
      window: state.window!.id,
    });
    state = fogged.state;
    const zone = who(state, "owed").zones?.find((one) => one.actionId === "fog");
    assert.ok(zone?.untilLair);
    // Bo's turn, then round 2: Ada, the Owed's own turn, and its lair count again ends it.
    state = end(state).state;
    state = end(state).state;
    assert.ok(
      who(state, "owed").zones?.some((one) => one.actionId === "fog"),
      "still there through round 2's start",
    );
    state = end(state).state;
    assert.equal(state.window?.kind, "signature");
    assert.equal(who(state, "owed").zones?.some((one) => one.actionId === "fog") ?? false, false, "gone at the count");
    state = step(state, {
      actorId: "owed",
      optionId: RULESET_PASS_OPTION,
      targetIds: [],
      window: state.window!.id,
    }).state;
  }

  // ── Scatter Flour and The Ground Freezes: zones on its own turn ──
  {
    const flourStep = own(fight(), "flour", { x: 2, y: 2 });
    const cloud = who(flourStep.state, "owed").zones?.find((one) => one.actionId === "flour");
    assert.ok(cloud, JSON.stringify(flourStep.events));
    assert.equal(cloud?.rounds, 1);
    const frozen = own(fight(), "freeze", { x: 5, y: 5 });
    assert.ok(who(frozen.state, "owed").zones?.some((one) => one.actionId === "freeze"));
  }

  // ── The bonfire gutters, the ice cracks ──
  {
    const lit = fight();
    lit.board!.grid.ground = { "6,6": { light: "bright" }, "7,6": { light: "bright" } };
    const guttered = own(lit, "gutter", { x: 6, y: 6 });
    assert.equal(guttered.state.board!.grid.ground?.["6,6"]?.light, "dark");
    assert.equal(guttered.state.board!.grid.ground?.["7,6"]?.light, "dark");
    assert.deepEqual(
      of(guttered.events, "boardEvent").map((one) => [one.id, one.label, one.tell]),
      [["gutter", "Bonfire Gutters", "The bonfire gutters out."]],
    );
    const cracked = own(fight(), "crack", { x: 8, y: 8 });
    assert.equal(cracked.state.board!.grid.tiles[8]![8], "water");
    assert.equal(cracked.state.board!.grid.tiles[2]![2], "plains");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature action that leaves an area standing or changes the ground, or an area that lasts until the next lair action, requires schemaVersion 2 and capabilityApi 1.324 or newer";
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
    const withAction = (action: Record<string, unknown>) => {
      const doc = JSON.parse(fiveEText);
      doc.catalogs
        .find((catalog: { holds?: string }) => catalog.holds === "creatures")
        .entries[0].creature.actions.push(action);
      return doc;
    };
    for (const action of [flour, gutter, fog]) {
      const doc = withAction(structuredClone(action));
      assert.equal(getCapabilityPackageInstallIssue(manifest(323) as never, doc), gate, action.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(324) as never, doc), gate, action.id);
    }
    // An area anywhere that lasts until the next lair action.
    const lingering = JSON.parse(fiveEText);
    lingering.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries[0].mechanics = {
      kind: "attack",
      autoHit: true,
      damageType: "cold",
      area: { shape: "burst", size: 5 },
      range: 60,
      amount: { flat: 1 },
      zone: { rounds: 10, untilLair: true, triggers: ["turn-start"] },
    };
    assert.ok(parseRulesetDefinition(lingering).ok);
    assert.equal(getCapabilityPackageInstallIssue(manifest(323) as never, lingering), gate, "untilLair");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(323) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Creature zones: Freezing Fog lasts until the next lair action, Scatter Flour and the Ground Freezes stand where aimed, and the bonfire gutters and the ice cracks for good.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
