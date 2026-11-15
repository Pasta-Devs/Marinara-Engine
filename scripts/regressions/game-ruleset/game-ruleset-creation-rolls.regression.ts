/** Capability API 1.162: scores rolled in order with their own dice, and creation rolls kept with
 *  their dice so reopening never rolls again. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderBaseScores,
  rulesetBuilderRemaining,
  rulesetBuilderRoll,
  rulesetBuilderRollScoresInOrder,
  rulesetCreationDiceText,
  rulesetCreationDiceTotal,
  type RulesetBuilderState,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creation-rolls-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push(
    { id: "luck", label: "Luck", type: "number", min: 0, max: 99 },
    { id: "hp_roll", label: "Hit points", type: "number", min: 0, max: 40 },
    { id: "edu", label: "Education", type: "number", min: 0, max: 99, default: 60 },
    { id: "potential", label: "Potential", type: "number", min: 0, max: 30 },
  );
  doc.sheet.builder = {
    steps: [
      {
        id: "scores",
        label: "Characteristics",
        kind: "abilities",
        methods: {
          rolls: [
            { abilities: ["str", "dex", "con"], dice: { count: 3, sides: 6 } },
            { abilities: ["int", "wis", "cha"], dice: { count: 2, sides: 6, add: 6 } },
          ],
        },
        default: "rolls",
      },
      {
        id: "fortune",
        label: "Rolls",
        kind: "roll",
        rolls: [
          { id: "luck", label: "Luck", field: "luck", dice: { count: 3, sides: 6, multiplier: 5 }, best: 2 },
          { id: "hp", label: "Hit points", field: "hp_roll", dice: { count: 1, sides: 6, add: -3 }, floor: 1 },
          {
            id: "edu",
            label: "Education improvement",
            field: "edu",
            dice: { count: 1, sides: 100 },
            gain: { count: 1, sides: 10 },
          },
          {
            id: "potential",
            label: "Potential",
            field: "potential",
            dice: { count: 1, sides: 20 },
            floor: { abilityScore: "str" },
          },
        ],
      },
    ],
  };
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  // The dice arithmetic: CoC's 3d6x5 and (2d6+6)x5 are different formulas.
  assert.equal(rulesetCreationDiceTotal({ count: 3, sides: 6, multiplier: 5 }, [3, 4, 5]), 60);
  assert.equal(rulesetCreationDiceTotal({ count: 2, sides: 6, add: 6, multiplier: 5 }, [3, 4]), 65);
  assert.equal(rulesetCreationDiceTotal({ count: 4, sides: 6, keep: 3 }, [1, 6, 6, 2]), 14);
  assert.equal(rulesetCreationDiceTotal({ count: 3, sides: 6 }, [7, 1, 1]), null, "a face the die lacks");
  assert.equal(rulesetCreationDiceText({ count: 2, sides: 6, add: 6, multiplier: 5 }), "(2d6+6) x 5");
  assert.equal(rulesetCreationDiceText({ count: 3, sides: 6, multiplier: 5 }), "3d6 x 5");

  const definition = parse(fixture());
  const catalogs = {};
  let state: RulesetBuilderState = readRulesetBuilderState(undefined);
  let build: RulesetSheetBuild = defaultRulesetSheetBuild(definition);
  const apply = () => ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  apply();
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).scores, 6);

  // Rolled in order: every score keeps its own group's roll, in the order the step lists them.
  state = rulesetBuilderRollScoresInOrder(definition, state, {
    str: [6, 6, 5],
    dex: [1, 2, 3],
    con: [4, 4, 4],
    int: [1, 1],
    wis: [6, 6],
    cha: [2, 3],
  });
  apply();
  assert.deepEqual(rulesetBuilderBaseScores(definition, state), { str: 17, dex: 6, con: 12, int: 8, wis: 18, cha: 11 });
  assert.equal(build.abilities.str, 17);
  assert.equal(build.abilities.wis, 18);
  assert.deepEqual(state.rolledBy?.dex, { faces: [1, 2, 3], total: 6 });
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).scores, 0);
  // It survives the envelope.
  state = readRulesetBuilderState({ builder: JSON.parse(JSON.stringify(state)) });
  apply();
  assert.equal(build.abilities.str, 17);

  // Creation rolls, each kept with its dice.
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).fortune, 4);
  const roll = (id: string, sets: number[][], gain?: number[]) =>
    ({ build, state } = rulesetBuilderRoll(definition, build, state, "fortune", id, sets, gain));
  // Luck: best of two.
  roll("luck", [
    [1, 2, 3],
    [4, 4, 2],
  ]);
  assert.equal(build.fields.luck, 50);
  assert.deepEqual(state.rolls?.fortune?.luck?.sets, [
    [1, 2, 3],
    [4, 4, 2],
  ]);
  // Rolled once: a second throw is refused and changes nothing.
  roll("luck", [
    [6, 6, 6],
    [6, 6, 6],
  ]);
  assert.equal(build.fields.luck, 50);
  // Hit points never below one.
  roll("hp", [[2]]);
  assert.equal(build.fields.hp_roll, 1);
  assert.equal(state.rolls?.fortune?.hp?.total, -1, "the dice are kept as thrown");
  // A failed improvement check leaves EDU as it was; the gain dice are not used.
  roll("edu", [[45]], [7]);
  assert.equal(build.fields.edu, 60);
  assert.equal(state.rolls?.fortune?.edu?.gained, undefined);
  // The potential is never below the stat it grows from.
  roll("potential", [[3]]);
  assert.equal(build.fields.potential, 17);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).fortune, 0);
  // Reopening runs the builder again and never touches what was rolled.
  apply();
  assert.equal(build.fields.luck, 50);
  assert.equal(build.fields.potential, 17);

  // A step that allows it may roll again, and a successful check improves the field.
  const retry = parse(fixture((doc) => (doc.sheet.builder.steps[1].retry = true)));
  const again = rulesetBuilderRoll(retry, build, state, "fortune", "edu", [[88]], [4]);
  assert.equal(again.build.fields.edu, 64);
  assert.deepEqual(again.state.rolls?.fortune?.edu?.gained, [4]);
  // Describing a character never rolls.
  const described = rulesetBuilderRoll(
    definition,
    defaultRulesetSheetBuild(definition),
    { describing: true },
    "fortune",
    "luck",
    [
      [6, 6, 6],
      [6, 6, 6],
    ],
  );
  assert.equal(described.state.rolls, undefined);
  // Faces the dice could not throw are refused.
  const bad = rulesetBuilderRoll(definition, defaultRulesetSheetBuild(definition), {}, "fortune", "hp", [[9]]);
  assert.equal(bad.state.rolls, undefined);

  // ── The schema ──
  assert.match(
    issuesOf(fixture((doc) => doc.sheet.builder.steps[0].methods.rolls[1].abilities.pop())),
    /"cha" is not rolled by any group/,
  );
  assert.match(
    issuesOf(fixture((doc) => doc.sheet.builder.steps[0].methods.rolls[1].abilities.push("str"))),
    /"str" is rolled twice/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[1].rolls[0].field = "nope"))),
    /No number field "nope"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[1].rolls[2].best = 2))),
    /An improvement check is rolled once/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[1].rolls[0].dice.keep = 4))),
    /keeps at most the dice it throws/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "creation-rolls",
    name: "Creation rolls",
    version: "1.0.0",
    description: "Creation rolls proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(161, fixture()) ?? "", /1\.162/);
  assert.equal(gate(162, fixture()), null);

  console.log("game-ruleset-creation-rolls: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
