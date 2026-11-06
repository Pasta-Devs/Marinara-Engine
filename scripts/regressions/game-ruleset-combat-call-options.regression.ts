/**
 * A creature's call with options, kept for rounds and by its caller (Capability API 1.446), and sent
 * away as an action (1.449).
 *
 *   - Summon Demon: a vrock picks 2d4 dretches or another vrock, one use a day shared by both; they
 *     leave once a minute has passed, or as soon as the vrock that called them is out, and never
 *     call demons of their own.
 *   - Without `endsWithCaller`, they stay when their caller falls.
 *   - Refusals and the install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-call-options-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 449);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const summonDemon = {
    options: [
      { creature: "creatures/dretch", count: { dice: "2d4" }, label: "2d4 dretches" },
      { creature: "creatures/vrock", count: { flat: 1 }, label: "Another vrock" },
    ],
    rounds: 10,
    endsWithCaller: true,
    cantCall: true,
    dismissible: true,
  };
  const claws = { id: "claws", name: "Claws", budget: "action", toHit: 4, reach: 5, damage: { flat: 3 } };
  const creature = (actions: unknown[]) => ({
    health: 40,
    defense: 15,
    initiativeModifier: 0,
    speed: 30,
    tier: "cr_5",
    actions,
  });
  const fiveE = (calls: Record<string, unknown> = summonDemon): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const summon = {
      id: "summon",
      name: "Summon Demon",
      budget: "action",
      uses: { per: "day", count: 1 },
      calls,
      // Its 30 percent, carried from the catalog (1.441); a roll of 10 answers it.
      chance: { sides: 100, atMost: 30 },
    };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(
        { id: "vrock", label: "Vrock", creature: creature([claws, summon]) },
        { id: "dretch", label: "Dretch", creature: creature([claws]) },
      );
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const roll = (sides: number) => Math.min(sides, 10);
  const setUp = (calls?: Record<string, unknown>) => {
    const definition = parsed(fiveE(calls));
    const bestiary: RulesetCatalogEntriesById = {
      creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
    };
    const fight = (): RulesetEncounterState => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: roll,
        bestiary,
        combatants: [
          {
            id: "ada",
            name: "Ada",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
              fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
            }),
            live: {},
          },
          { id: "vrock", name: "Vrock", side: "enemy", creature: { catalogId: "creatures", entryId: "vrock" } },
        ],
        board: {
          grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
          placements: { ada: { x: 2, y: 2 }, vrock: { x: 10, y: 4 } },
        },
      });
      for (const one of state.combatants) one.initiative = { ada: 5, vrock: 20 }[one.id]!;
      state.order = ["vrock", "ada"];
      state.turn = 0;
      return state;
    };
    const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
      const taken = applyRulesetCombatChoice(definition, state, choice, roll);
      assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
      return taken;
    };
    const summon = (state: RulesetEncounterState, mode: string) => {
      const option = rulesetCombatOptions(definition, state, "vrock").find((one) => one.id === "summon");
      assert.ok(
        option,
        rulesetCombatOptions(definition, state, "vrock")
          .map((one) => one.id)
          .join(", "),
      );
      return { option, taken: step(state, { actorId: "vrock", optionId: "summon", targetIds: [], mode }) };
    };
    const end = (state: RulesetEncounterState) =>
      step(state, { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] });
    return { definition, fight, summon, end };
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const here = (state: RulesetEncounterState) =>
    state.combatants.filter((one) => one.calledBy && !one.dismissed).map((one) => one.name);

  // ── Summon Demon ──
  {
    const { definition, fight, summon, end } = setUp();
    const { option, taken } = summon(fight(), "call-1");
    assert.deepEqual(
      option.modes?.map((one) => one.label),
      ["2d4 dretches", "Another vrock"],
      "its options, as modes",
    );
    let state = taken.state;
    assert.deepEqual(
      of(taken.events, "chance").map((one) => [one.roll, one.needed, one.outcome]),
      [[10, 30, "answered"]],
      "a catalog creature's chance is rolled",
    );
    assert.deepEqual(here(state), ["Vrock"], "another vrock");
    const called = state.combatants.find((one) => one.calledBy === "vrock")!;
    assert.ok(
      called.actions.some((one) => one.id === "claws"),
      "with its own claws",
    );
    assert.ok(!called.actions.some((one) => one.id === "summon"), "but never a demon of its own");
    assert.equal(called.calledUntil, state.round + 10, "a minute");
    // One use a day, shared by both options.
    who(state, "vrock").budgets.action = 1;
    assert.ok(!rulesetCombatOptions(definition, state, "vrock").some((one) => one.id === "summon"), "not again today");
    // The dretches, 2d4 of them.
    const dretches = summon(fight(), "call-0").taken.state;
    assert.equal(here(dretches).length, 8);
    assert.ok(here(dretches).every((name) => name.startsWith("Dretch")));
    // Sent away as an action (1.449), offered only while they are here; the called vrock has none.
    assert.ok(!called.actions.some((one) => one.switches), "nothing to dismiss of its own");
    const dismissing = structuredClone(state);
    who(dismissing, "vrock").budgets.action = 1;
    const dismiss = rulesetCombatOptions(definition, dismissing, "vrock").find(
      (one) => one.id === "dismiss-called:summon",
    );
    assert.ok(dismiss?.dismiss, "offered");
    const sent = applyRulesetCombatChoice(
      definition,
      dismissing,
      { actorId: "vrock", optionId: "dismiss-called:summon", targetIds: [] },
      roll,
    );
    assert.deepEqual(
      of(sent.events, "sentAway").map((one) => [one.reason, one.ids]),
      [["dismissed", [called.id]]],
    );
    assert.deepEqual(here(sent.state), []);
    assert.equal(who(sent.state, "vrock").budgets.action, 0, "on its action");
    assert.ok(
      !rulesetCombatOptions(definition, sent.state, "vrock").some((one) => one.id === "dismiss-called:summon"),
      "nobody left to dismiss",
    );
    // Over 30: nobody comes, and the day's use is spent.
    const missed = fight();
    const failed = applyRulesetCombatChoice(
      definition,
      missed,
      { actorId: "vrock", optionId: "summon", targetIds: [], mode: "call-0" },
      (sides) => (sides === 100 ? 31 : roll(sides)),
    );
    assert.equal(of(failed.events, "chance")[0]?.outcome, "failed");
    assert.deepEqual(here(failed.state), [], "31: no demons");
    // The vrock that called them out: they leave with it.
    who(state, "vrock").defeated = true;
    state.turn = state.order.indexOf("ada");
    const gone = end(state);
    assert.deepEqual(
      of(gone.events, "sentAway").map((one) => [one.actorId, one.reason, one.ids]),
      [["vrock", "caller", [called.id]]],
    );
    assert.deepEqual(here(gone.state), []);
    // A minute up, they leave too.
    state = structuredClone(dretches);
    // Called in round 1, they are gone as the vrock's turn of round 11 starts.
    const until = state.round + 10;
    for (let turn = 0; turn < 200 && state.round < until - 1; turn += 1) state = end(state).state;
    assert.equal(here(state).length, 8, "still here in round 10");
    for (let turn = 0; turn < 200 && state.round < until; turn += 1) state = end(state).state;
    assert.deepEqual(here(state), [], "gone once the minute is up");
  }

  // ── From the fight's bestiary only: the called vrock's own call, never filled, is gone too ──
  {
    const definition = parsed(fiveE());
    const creatures = definition.catalogs!.find((catalog) => catalog.holds === "creatures")!;
    const bestiary: RulesetCatalogEntriesById = { creatures: [...creatures.entries!] };
    creatures.entries = creatures.entries!.filter((entry) => entry.id !== "vrock" && entry.id !== "dretch");
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "vrock", name: "Vrock", side: "enemy", creature: { catalogId: "creatures", entryId: "vrock" } },
      ],
    });
    state.order = ["vrock"];
    state.turn = 0;
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "vrock", optionId: "summon", targetIds: [], mode: "call-1" },
      roll,
    );
    assert.deepEqual(of(taken.events, "refused"), []);
    const called = taken.state.combatants.find((one) => one.calledBy === "vrock")!;
    assert.ok(called, "a vrock came");
    assert.ok(!called.actions.some((one) => one.id === "summon"), JSON.stringify(called.actions.map((one) => one.id)));
  }

  // ── Without endsWithCaller: they stay ──
  {
    const { fight, summon, end } = setUp({ ...summonDemon, endsWithCaller: undefined });
    const state = summon(fight(), "call-1").taken.state;
    who(state, "vrock").defeated = true;
    state.turn = state.order.indexOf("ada");
    const after = end(state);
    assert.equal(of(after.events, "sentAway").length, 0);
    assert.deepEqual(here(after.state), ["Vrock"]);
  }

  // ── Refusals ──
  refused(fiveE({ ...summonDemon, count: { flat: 1 } }), /own "count"/);
  refused(fiveE({ ...summonDemon, creature: "creatures/dretch" }), /one of them/);
  refused(fiveE({ options: [summonDemon.options[0]] }), /two at least/);
  refused(fiveE({ creature: "creatures/dretch" }), /"count"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose creatures call others by options, for rounds or bound to their caller (calls) requires schemaVersion 2 and capabilityApi 1.446 or newer";
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
    const kept = fiveE({ ...summonDemon, dismissible: undefined });
    assert.equal(getCapabilityPackageInstallIssue(manifest(445) as never, kept), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(446) as never, kept), gate);
    const plain = fiveE({ creature: "creatures/dretch", count: { flat: 1 } });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(445) as never, plain), gate);
    const dismissGate =
      "A ruleset whose creatures may send away those they called as an action (dismissible) requires schemaVersion 2 and capabilityApi 1.449 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(448) as never, fiveE()), dismissGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(449) as never, fiveE()), dismissGate);
  }

  console.log(
    "Call options: Summon Demon picks dretches or a vrock on one use a day; they leave after a minute or with their caller and call nobody; gated at 1.446, dismissed as an action at 1.449.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
