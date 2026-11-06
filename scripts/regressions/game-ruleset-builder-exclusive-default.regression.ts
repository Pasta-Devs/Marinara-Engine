/**
 * A group's default (Capability API 1.772): `exclusiveDefault` on a catalog entry.
 *
 *   - A step that takes all it offers takes, of a group nobody picked from, its default, or the one
 *     entry of it offered, so the step waits on nothing.
 *   - A pick of the group still replaces it.
 *   - A feat in the default's place is judged without the default (1.100): the improvement it
 *     replaces never meets its prerequisite.
 *   - What a step that takes all it offers took, written to a field (1.773).
 *   - Refusals and the install gates.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetBuilderPickAdded,
  rulesetBuilderOptions,
  rulesetBuilderPicks,
  rulesetBuilderRemaining,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-exclusive-default-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const base = () =>
  JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"));
const parse = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const refuse = (doc: unknown, message: RegExp) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(
    !result.ok && result.issues.some((issue) => message.test(issue)),
    result.ok ? "unexpectedly accepted" : result.issues.join("; "),
  );
};
const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const feature = (id: string, filters: Record<string, string | number>, exclusive?: string) => ({
  id,
  label: id,
  filters,
  ...(exclusive ? { exclusive } : {}),
  rows: [{ list: "features", values: { name: id } }],
});
const fixture = () => {
  const doc = base();
  for (const id of ["level_fighter", "level_wizard"])
    doc.sheet.fields.push({ id, label: id, type: "number", min: 0, max: 20, default: 0 });
  doc.catalogs.push({
    id: "class_features",
    label: "Class features",
    feeds: ["features"],
    filters: [
      { id: "level", label: "Level", type: "number" },
      { id: "class_id", label: "Class", type: "text" },
    ],
    entries: [
      feature("second-wind", { level: 1, class_id: "fighter" }),
      feature("action-surge", { level: 2, class_id: "fighter" }),
      feature("extra-attack", { level: 5, class_id: "fighter" }),
      feature("asi-4-strength", { level: 4, class_id: "fighter" }, "asi_4"),
      feature("asi-4-feat", { level: 4, class_id: "fighter" }, "asi_4"),
      feature("arcane-recovery", { level: 1, class_id: "wizard" }),
      feature("arcane-tradition", { level: 2, class_id: "wizard" }),
      feature("common-ground", { level: 1 }),
    ],
  });
  doc.sheet.builder = {
    tier: "proficient",
    steps: [
      { id: "levels", label: "Levels", kind: "fields", fields: ["level", "level_fighter", "level_wizard"] },
      {
        id: "features",
        label: "Class features",
        kind: "catalog",
        catalog: "class_features",
        takesAll: true,
        upTo: { filter: "level", value: { field: "level" }, per: { filter: "class_id", prefix: "level_" } },
      },
    ],
  };
  return doc;
};

try {
  const build = (definition: RulesetDefinition, wizard = 1) => {
    const one = defaultRulesetSheetBuild(definition);
    one.fields = { ...one.fields, level: 4 + wizard, level_fighter: 4, level_wizard: wizard };
    return one;
  };
  const none: RulesetBuilderState = { picks: {} };
  const ids = (definition: RulesetDefinition, state: RulesetBuilderState, wizard = 1) =>
    rulesetBuilderPicks(definition, "features", state, catalogsOf(definition), build(definition, wizard))
      .map((entry) => entry.id)
      .filter((id) => id.startsWith("asi-"));
  const left = (definition: RulesetDefinition, state: RulesetBuilderState, wizard = 1) =>
    rulesetBuilderRemaining(definition, build(definition, wizard), state, catalogsOf(definition)).features;

  // ── The only entry of a group offered is taken ──
  {
    const doc = fixture();
    doc.catalogs.at(-1).entries.find((entry: any) => entry.id === "asi-4-feat").offeredWhen = { field: "level_wizard" };
    const definition = parse(doc);
    assert.deepEqual(ids(definition, none, 1), [], "both offered: the player picks");
    assert.equal(left(definition, none, 1), 1);
    assert.deepEqual(ids(definition, none, 0), ["asi-4-strength"], "one offered: it is taken");
    assert.equal(left(definition, none, 0), 0, "and nothing waits");
  }
  // ── The default is taken until the player picks another ──
  const withDefault = () => {
    const doc = fixture();
    doc.catalogs.at(-1).entries.find((entry: any) => entry.id === "asi-4-strength").exclusiveDefault = true;
    return doc;
  };
  {
    const definition = parse(withDefault());
    assert.deepEqual(ids(definition, none), ["asi-4-strength"], "the default with nothing picked");
    assert.equal(left(definition, none), 0);
    const step = definition.sheet.builder!.steps[1]! as Parameters<typeof rulesetBuilderPickAdded>[0];
    const feat: RulesetBuilderState = {
      picks: { features: rulesetBuilderPickAdded(step, [], "asi-4-feat", catalogsOf(definition)) },
    };
    assert.deepEqual(ids(definition, feat), ["asi-4-feat"], "a pick replaces it");
    const applied = JSON.stringify(
      applyRulesetBuilder(definition, build(definition), none, catalogsOf(definition)).build,
    );
    assert.ok(applied.includes("asi-4-strength"), "the default is written to the sheet");
  }

  // ── The default never meets a prerequisite of what replaces it ──
  {
    // The improvement gives Strength +1; the feat in its place asks for a Strength modifier above 0.
    const doc = withDefault();
    const entries = doc.catalogs.at(-1).entries;
    entries.find((entry: any) => entry.id === "asi-4-strength").grants = { abilities: { add: { str: 1 } } };
    entries.find((entry: any) => entry.id === "asi-4-feat").offeredWhen = { abilityMod: "str" };
    doc.sheet.builder.steps.push({ id: "scores", label: "Scores", kind: "abilities", methods: { manual: true } });
    const definition = parse(doc);
    const catalogs = catalogsOf(definition);
    const step = definition.sheet.builder!.steps[1]! as Parameters<typeof rulesetBuilderOptions>[1];
    const made = (str: number, features: string[]) =>
      applyRulesetBuilder(
        definition,
        build(definition),
        { method: "manual", base: { str, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, picks: { features } },
        catalogs,
      );
    const offeredFeat = (m: ReturnType<typeof made>) =>
      rulesetBuilderOptions(definition, step, m.state, catalogs, m.build).some((entry) => entry.id === "asi-4-feat");
    const improved = made(11, []);
    assert.equal(improved.build.abilities.str, 12, "the default's +1");
    assert.ok(!offeredFeat(improved), "Strength 12 only from the improvement the feat would drop: no feat");
    const both = made(11, ["asi-4-strength", "asi-4-feat"]);
    assert.deepEqual(
      rulesetBuilderPicks(definition, "features", both.state, catalogs, both.build)
        .map((entry) => entry.id)
        .filter((id) => id.startsWith("asi-")),
      ["asi-4-strength"],
      "stored after the improvement, the feat counts for nothing and the improvement keeps its place",
    );
    assert.equal(both.build.abilities.str, 12, "and its +1 stays");
    assert.ok(offeredFeat(made(12, [])), "Strength 12 of its own: the feat is offered");
  }

  // ── What a step that takes all it offers took, written to a field (1.773): 5e's subclass ──
  const withField = () => {
    const doc = withDefault();
    doc.sheet.fields.push({ id: "taken", label: "Taken", type: "text", maxLength: 200 });
    doc.sheet.builder.steps[1].field = "taken";
    return doc;
  };
  {
    const definition = parse(withField());
    const made = (wizard: number, state: RulesetBuilderState = none) =>
      applyRulesetBuilder(definition, build(definition, wizard), state, catalogsOf(definition)).build.fields.taken;
    assert.equal(made(1), "second-wind, action-surge, asi-4-strength, arcane-recovery, common-ground");
    assert.equal(
      made(2),
      "second-wind, action-surge, asi-4-strength, arcane-recovery, arcane-tradition, common-ground",
    );
    const step = definition.sheet.builder!.steps[1]! as Parameters<typeof rulesetBuilderPickAdded>[0];
    const feat: RulesetBuilderState = {
      picks: { features: rulesetBuilderPickAdded(step, [], "asi-4-feat", catalogsOf(definition)) },
    };
    assert.match(made(1, feat)!, /asi-4-feat/, "rewritten as what it takes changes");
  }

  // ── Refusals ──
  const lone = fixture();
  lone.catalogs.at(-1).entries.find((entry: any) => entry.id === "second-wind").exclusiveDefault = true;
  refuse(lone, /Only an entry of an "exclusive" group is its default/);
  const twice = withDefault();
  twice.catalogs.at(-1).entries.find((entry: any) => entry.id === "asi-4-feat").exclusiveDefault = true;
  refuse(twice, /"asi-4-strength" is already the default of group "asi_4"/);

  // ── The gate ──
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
    "A ruleset with a catalog entry that is its exclusive group's default (exclusiveDefault) requires schemaVersion 2 and capabilityApi 1.772 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(771) as never, withDefault()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(772) as never, withDefault()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(771) as never, fixture()), gate, "nothing without the key");
  const fieldGate =
    "A ruleset with a builder step that takes all it offers and writes them to a field (takesAll with field) requires schemaVersion 2 and capabilityApi 1.773 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(772) as never, withField()), fieldGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(773) as never, withField()), fieldGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(772) as never, withDefault()), fieldGate);

  console.log(
    "exclusiveDefault: a group nobody picked from takes its default or its one offered entry, a pick still replaces it; what it took is written to a field; refusals; gated at 1.772 and 1.773.",
  );
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
