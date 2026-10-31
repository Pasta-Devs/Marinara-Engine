/**
 * Sequence steps rolled for, made after another's hit, and left out at will (Capability API 1.643).
 *
 *   - A grick's beak follows its tentacles only when they hit, at the one they hit, and takes no
 *     target of its own.
 *   - A violet fungus makes 1d4 Rotting Touch attacks: the roll is logged, and it may be aimed at as
 *     many as its dice can come to.
 *   - A gibbering mouther's Blinding Spittle may be left out: the sequence is offered with a mode
 *     without it, which aims at fewer.
 *   - What import refuses, and the install gate.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sequence-steps-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 643);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  type Step = Record<string, unknown>;
  const fiveE = (edit: (sequences: Record<string, Step[]>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const sequences: Record<string, Step[]> = {
      grick: [{ action: "tentacles" }, { action: "beak", ifHit: 0 }],
      fungus: [{ action: "touch", dice: { count: 1, sides: 4 } }],
      mouther: [{ action: "tentacles" }, { action: "spittle", optional: true }],
    };
    edit(sequences);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "lurker",
        label: "Lurker",
        creature: {
          health: 100,
          defense: 14,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_2",
          actions: [
            ...Object.entries(sequences).map(([id, sequence]) => ({ id, name: id, budget: "action", sequence })),
            { id: "tentacles", name: "Tentacles", budget: "action", toHit: 4, damage: { flat: 3 }, reach: 5 },
            { id: "beak", name: "Beak", budget: "action", toHit: 4, damage: { flat: 2 }, reach: 5 },
            { id: "touch", name: "Rotting Touch", budget: "action", toHit: 2, damage: { flat: 1 }, reach: 10 },
            {
              id: "spittle",
              name: "Spittle",
              budget: "action",
              save: { save: "dex_save", difficulty: 13, onSuccess: "negates" },
              applies: [{ condition: "blinded", duration: "instant" }],
              range: 15,
            },
          ],
        },
      });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const lurker = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "lurker"),
  );
  assert.ok(lurker);
  const hero = (id: string) => ({
    id,
    name: id,
    side: "party" as const,
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 200 },
    }),
  });
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [hero("mage"), hero("knight"), { id: "lurker", name: "Lurker", side: "enemy", block: lurker }],
    });
    state.order = ["lurker", "mage", "knight"];
    state.turn = 0;
    return state;
  };
  const option = (state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, "lurker").find((one) => one.id === id);
  const act = (
    state: RulesetEncounterState,
    id: string,
    targetIds: string[],
    roller: RulesetCombatRoller,
    mode?: string,
  ) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lurker", optionId: id, targetIds, ...(mode ? { mode } : {}) },
      roller,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const attacks = (events: RulesetCombatEvent[]) =>
    of(events, "attack").map((one) => [one.optionId, one.targetId, one.outcome === "miss" ? "miss" : "hit"]);

  // ── A grick: the beak only after the tentacles hit, at the one they hit ──
  {
    const state = fight();
    assert.equal(option(state, "grick")!.targets.count, 1, "the beak takes no target of its own");
    const hit = act(state, "grick", ["knight"], () => 10);
    assert.deepEqual(attacks(hit.events), [
      ["tentacles", "knight", "hit"],
      ["beak", "knight", "hit"],
    ]);
    const missed = act(fight(), "grick", ["knight"], () => 1);
    assert.deepEqual(attacks(missed.events), [["tentacles", "knight", "miss"]], "no beak after a miss");
  }

  // ── A violet fungus: 1d4 touches ──
  {
    const state = fight();
    assert.equal(option(state, "fungus")!.targets.count, 4, "as many as the dice can come to");
    const rolled = act(state, "fungus", ["mage"], (sides) => (sides === 4 ? 3 : 10));
    assert.deepEqual(
      of(rolled.events, "strikesRolled").map((one) => [one.label, one.dice, one.count]),
      [["Rotting Touch", "1d4", 3]],
    );
    assert.equal(attacks(rolled.events).length, 3);
    const spread = act(fight(), "fungus", ["mage", "knight"], (sides) => (sides === 4 ? 3 : 10));
    assert.deepEqual(
      attacks(spread.events).map((one) => one[1]),
      ["mage", "knight", "mage"],
      "round the targets given",
    );
  }

  // ── A gibbering mouther: the spittle left out at will ──
  {
    const state = fight();
    const offered = option(state, "mouther")!;
    assert.equal(offered.targets.count, 2);
    assert.deepEqual(
      offered.modes?.map((one) => [one.id, one.label, one.targets]),
      [["without-1", "without Spittle", 1]],
    );
    const all = act(state, "mouther", ["mage", "knight"], () => 10);
    assert.ok(rulesetCombatConditions(definition, rulesetCombatant(all.state, "knight")!).includes("blinded"));
    const without = act(fight(), "mouther", ["mage"], () => 10, "without-1");
    assert.deepEqual(attacks(without.events), [["tentacles", "mage", "hit"]]);
    assert.ok(!rulesetCombatConditions(definition, rulesetCombatant(without.state, "mage")!).includes("blinded"));
    assert.ok(!rulesetCombatConditions(definition, rulesetCombatant(without.state, "knight")!).includes("blinded"));
  }

  // ── What import refuses ──
  {
    const issues = (edit: (sequences: Record<string, Step[]>) => void) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.ok(!result.ok);
      return result.issues.join("; ");
    };
    assert.match(
      issues((sequences) => (sequences.grick![0] = { action: "tentacles", ifHit: 1 })),
      /names an earlier step/,
    );
    assert.match(
      issues((sequences) => (sequences.mouther = [{ action: "spittle" }, { action: "beak", ifHit: 0 }])),
      /"spittle" rolls no attack/,
    );
    assert.match(
      issues((sequences) => (sequences.mouther = [{ action: "spittle", optional: true }])),
      /at least one step that is not optional/,
    );
    assert.match(
      issues((sequences) => (sequences.fungus = [{ action: "touch", times: 2, dice: { count: 1, sides: 4 } }])),
      /rolled for/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a sequence step rolled for, made after another's hit or left out at will (sequence[].dice, ifHit, optional) requires schemaVersion 2 and capabilityApi 1.643 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(642) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(643) as never, fiveE()), gate);
  }

  console.log(
    "Sequence steps: a grick's beak follows a tentacle hit at the one hit, a violet fungus rolls 1d4 touches, a gibbering mouther may leave its spittle out as a mode; import refuses bad steps; gated at 1.643.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
