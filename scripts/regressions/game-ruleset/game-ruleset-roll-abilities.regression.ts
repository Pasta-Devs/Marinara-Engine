/** Capability API 1.209: a creation roll written to an ability score. An improvement check adds to
 *  the score as an increase, so rolling or buying the score again keeps it (CoC's EDU improvement). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderRemaining,
  rulesetBuilderRoll,
  rulesetBuilderRollScoresInOrder,
  type RulesetBuilderState,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-roll-abilities-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.builder = {
    steps: [
      {
        id: "scores",
        label: "Characteristics",
        kind: "abilities",
        methods: { rolls: [{ abilities: ["str", "dex", "con", "int", "wis", "cha"], dice: { count: 3, sides: 6 } }] },
        default: "rolls",
      },
      {
        id: "age",
        label: "Age",
        kind: "roll",
        rolls: [
          {
            id: "int_check",
            label: "Intelligence improvement",
            ability: "int",
            dice: { count: 1, sides: 20 },
            gain: { count: 1, sides: 4 },
          },
          { id: "cha_roll", label: "Presence", ability: "cha", dice: { count: 2, sides: 6, add: 6 }, floor: 9 },
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
  const definition = parse(fixture());
  const catalogs = {};
  let state: RulesetBuilderState = readRulesetBuilderState(undefined);
  let build: RulesetSheetBuild = defaultRulesetSheetBuild(definition);
  const apply = () => ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  const scores = (int: number[]) =>
    (state = rulesetBuilderRollScoresInOrder(definition, state, {
      str: [3, 3, 3],
      dex: [3, 3, 3],
      con: [3, 3, 3],
      int,
      wis: [3, 3, 3],
      cha: [3, 3, 3],
    }));
  scores([4, 4, 4]);
  apply();
  assert.equal(build.abilities.int, 12);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).age, 2);

  // A check above the score improves it.
  ({ build, state } = rulesetBuilderRoll(definition, build, state, "age", "int_check", [[15]], [3]));
  assert.equal(build.abilities.int, 15);
  assert.equal(state.rolls?.age?.int_check?.added, 3);
  // Running the builder again keeps the improvement once.
  apply();
  apply();
  assert.equal(build.abilities.int, 15);
  // Rolling the score again keeps the improvement on top of the new roll.
  scores([2, 2, 2]);
  apply();
  assert.equal(build.abilities.int, 9);
  // It survives the envelope.
  state = readRulesetBuilderState({ builder: JSON.parse(JSON.stringify(state)) });
  apply();
  assert.equal(build.abilities.int, 9);

  // A roll written outright, held to its floor.
  ({ build, state } = rulesetBuilderRoll(definition, build, state, "age", "cha_roll", [[1, 1]]));
  assert.equal(build.abilities.cha, 9);
  apply();
  assert.equal(build.abilities.cha, 9);

  // A failed check changes nothing, and nothing is kept as an increase.
  let fresh: RulesetBuilderState = readRulesetBuilderState(undefined);
  let freshBuild = defaultRulesetSheetBuild(definition);
  ({ build: freshBuild, state: fresh } = applyRulesetBuilder(definition, freshBuild, fresh, catalogs));
  const before = freshBuild.abilities.int;
  ({ build: freshBuild, state: fresh } = rulesetBuilderRoll(
    definition,
    freshBuild,
    fresh,
    "age",
    "int_check",
    [[1]],
    [4],
  ));
  assert.equal(freshBuild.abilities.int, before);
  assert.equal(fresh.rolls?.age?.int_check?.added, 0);
  // Never above the ability's own bounds.
  freshBuild = { ...freshBuild, abilities: { ...freshBuild.abilities, int: 19 } };
  fresh = { ...fresh, rolls: {} };
  ({ build: freshBuild, state: fresh } = rulesetBuilderRoll(
    definition,
    freshBuild,
    fresh,
    "age",
    "int_check",
    [[20]],
    [4],
  ));
  const intMax = definition.sheet.abilities.find((each) => each.id === "int")!.max;
  assert.equal(freshBuild.abilities.int, Math.min(23, intMax));

  // ── The schema ──
  const roll = (edit: (roll: Record<string, any>) => void) =>
    issuesOf(fixture((doc) => edit(doc.sheet.builder.steps[1].rolls[0])));
  assert.match(
    roll((each) => (each.field = "nope")),
    /a field or an ability, exactly one/,
  );
  assert.match(
    roll((each) => delete each.ability),
    /a field or an ability, exactly one/,
  );
  assert.match(
    roll((each) => (each.ability = "nope")),
    /Unknown ability "nope"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[1].rolls[1].ability = "int"))),
    /"int" is rolled twice/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "roll-abilities",
    name: "Roll abilities",
    version: "1.0.0",
    description: "Roll abilities proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(208, fixture()) ?? "", /1\.209/);
  assert.equal(gate(209, fixture()), null);

  console.log("game-ruleset-roll-abilities: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
