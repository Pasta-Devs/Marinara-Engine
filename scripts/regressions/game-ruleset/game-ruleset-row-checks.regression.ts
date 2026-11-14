/** Capability API 1.161: list rows that are checks of their own, one or more stances backed by a rating. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  rulesetRowChecks,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-row-checks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, rulesetCheckModifierFor, rulesetUntrainedFor } =
  await import("../../../packages/server/src/services/game/skill-check-resolution.service.js");
const { renderGameRulesetSheetBlocks } =
  await import("../../../packages/server/src/services/game/ruleset-sheet-turn.service.js");

const emberText = readFileSync(
  fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
  "utf8",
);
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(emberText) as Record<string, any>;
  doc.sheet.lists.push(
    {
      id: "lores",
      label: "Lores",
      maxItems: 12,
      columns: [
        { id: "name", label: "Lore", type: "text", maxLength: 60 },
        { id: "rating", label: "Rating", type: "number", min: 0, max: 5, default: 1 },
      ],
      checks: [{ id: "lore", name: "name", rating: "rating", ability: "wits" }],
    },
    {
      id: "dishes",
      label: "Dishes",
      maxItems: 6,
      columns: [
        { id: "name", label: "Dish", type: "text", maxLength: 60 },
        { id: "skill", label: "Skill", type: "number", min: 0, max: 5, default: 0 },
      ],
      checks: [
        { id: "bold", label: "bold", name: "name", rating: "skill", ability: "brawn" },
        { id: "careful", label: "careful", name: "name", rating: "skill", ability: "wits" },
      ],
    },
  );
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
  const blank = defaultRulesetSheetBuild(definition);
  const build: RulesetSheetBuild = {
    ...blank,
    abilities: { ...blank.abilities, brawn: 1, wits: 2 },
    lists: {
      ...blank.lists,
      lores: [
        { name: "Science (Physics)", rating: 3 },
        { name: "Science (Biology)", rating: 1 },
        { name: "Old Roads", rating: 2 },
        { name: "Old Roads", rating: 4 },
      ],
      dishes: [{ name: "Fire stew", skill: 2 }],
    },
  } as RulesetSheetBuild;
  const evaluated = evaluateRulesetSheet(definition, build);

  // Each specialty is its own check with its own rating; one stance pair reads one rating.
  const physics = matchRulesetCheckTarget(definition, "Science (Physics)", undefined, build);
  const physicsAlt = matchRulesetCheckTarget(definition, "science physics", undefined, build);
  assert.equal(physics?.type, "skill");
  assert.equal(physics?.id, physicsAlt?.id, "spelled either way, one check");
  assert.equal(evaluated.skillMods[physics!.id], 2 + 3);
  const bio = matchRulesetCheckTarget(definition, "Science (Biology) check", undefined, build)!;
  assert.equal(evaluated.skillMods[bio.id], 2 + 1);
  const bold = matchRulesetCheckTarget(definition, "Fire stew (bold)", undefined, build)!;
  const careful = matchRulesetCheckTarget(definition, "Fire stew careful", undefined, build)!;
  assert.equal(evaluated.skillMods[bold.id], 1 + 2);
  assert.equal(evaluated.skillMods[careful.id], 2 + 2);
  // A name two rows share is not guessed at.
  assert.equal(matchRulesetCheckTarget(definition, "Old Roads", undefined, build), null);
  assert.ok(!rulesetRowChecks(definition, build).some((row) => row.label === "Old Roads"));
  // Without the roller's sheet there is no such check, and the sheet's own skills still win.
  assert.equal(matchRulesetCheckTarget(definition, "Science (Physics)"), null);
  assert.equal(matchRulesetCheckTarget(definition, "Sneak", undefined, build)?.id, "sneak");
  // with= swaps the row's ability as it does a skill's.
  const swapped = matchRulesetCheckTarget(definition, "Science (Physics)", "brawn", build)!;
  assert.equal(swapped.type === "skill" && swapped.withAbility, "brawn");

  // Renaming a row moves its check; deleting it leaves the old name with nothing.
  const renamed = {
    ...build,
    lists: { ...build.lists, lores: [{ name: "Science (Chemistry)", rating: 3 }] },
  } as RulesetSheetBuild;
  assert.equal(matchRulesetCheckTarget(definition, "Science (Physics)", undefined, renamed), null);
  assert.ok(matchRulesetCheckTarget(definition, "Science (Chemistry)", undefined, renamed));

  // The Engine rolls it on the roller's own sheet, and the Game Master is told it exists.
  const cards = [{ name: "Ada", rulesetSheet: { v: 1, build } }];
  const ruleset = buildSkillCheckRulesetContext(definition, cards, cards[0]);
  assert.equal(rulesetCheckModifierFor(ruleset, "Science (Physics)"), 5);
  assert.equal(rulesetCheckModifierFor(ruleset, "Science (Physics)", "Ada"), 5);
  assert.equal(rulesetCheckModifierFor(ruleset, "Science (Physics)", "Ada", "brawn"), 4);
  assert.equal(rulesetUntrainedFor(ruleset, { skill: "Science (Physics)", dc: 8 }), null);
  const result = resolveSkillCheckWithContext(
    { skills: null, attributes: null, sheetAttributes: {}, ruleset },
    { skill: "Fire stew (careful)", dc: 8 },
    () => 3,
  );
  assert.equal(result.modifier, 4);
  const prompt = renderGameRulesetSheetBlocks(definition, cards, null).join("\n");
  assert.match(prompt, /Science \(Physics\) \+5/);
  assert.match(prompt, /Fire stew \(bold\) \+3/);
  assert.doesNotMatch(prompt, /Old Roads/);

  // ── The schema ──
  const broken = (change: (check: Record<string, unknown>) => void) =>
    issuesOf(fixture((doc) => change(doc.sheet.lists.at(-1).checks[0])));
  assert.match(
    broken((check) => (check.rating = "name")),
    /No number column "name"/,
  );
  assert.match(
    broken((check) => (check.name = "skill")),
    /No text column "skill"/,
  );
  assert.match(
    broken((check) => (check.ability = "luck")),
    /Unknown ability "luck"/,
  );
  assert.match(
    broken((check) => delete check.label),
    /told apart by their labels/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "row-checks",
    name: "Row checks",
    version: "1.0.0",
    description: "Row checks proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(160, fixture()) ?? "", /1\.161/);
  assert.equal(gate(161, fixture()), null);

  console.log("game-ruleset-row-checks: passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
