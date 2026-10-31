/** Capability API 1.766: a builder step that takes all it offers, its groups picked one each, and
 *  an `upTo` read for each entry from its own class's level. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetBuilderPickAdded,
  rulesetBuilderPicks,
  rulesetBuilderRemaining,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-takes-all-"));
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
  // A fighter 4 / wizard 1: each class's features up to its own level, the rest up to the character's.
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  const build = defaultRulesetSheetBuild(definition);
  build.fields = { ...build.fields, level: 5, level_fighter: 4, level_wizard: 1 };
  const none: RulesetBuilderState = { picks: {} };
  const ids = (state: RulesetBuilderState) =>
    rulesetBuilderPicks(definition, "features", state, catalogs, build)
      .map((entry) => entry.id)
      .sort();
  assert.deepEqual(ids(none), ["action-surge", "arcane-recovery", "common-ground", "second-wind"]);
  assert.equal(rulesetBuilderRemaining(definition, build, none, catalogs).features, 1, "the ASI or feat waits");

  // The group is the player's: one of it, the latest, and nothing else needs picking.
  const step = definition.sheet.builder!.steps[1]! as Parameters<typeof rulesetBuilderPickAdded>[0];
  const stored = rulesetBuilderPickAdded(
    step,
    rulesetBuilderPickAdded(step, [], "asi-4-strength", catalogs),
    "asi-4-feat",
    catalogs,
  );
  assert.deepEqual(stored, ["asi-4-feat"]);
  const picked: RulesetBuilderState = { picks: { features: stored } };
  assert.deepEqual(ids(picked), ["action-surge", "arcane-recovery", "asi-4-feat", "common-ground", "second-wind"]);
  assert.equal(rulesetBuilderRemaining(definition, build, picked, catalogs).features, 0);

  // Applied, every taken feature is on the sheet.
  const applied = applyRulesetBuilder(definition, build, picked, catalogs);
  const names = JSON.stringify(applied.build);
  for (const id of ["second-wind", "action-surge", "asi-4-feat", "arcane-recovery", "common-ground"])
    assert.ok(names.includes(id), `${id} on the sheet: ${names.slice(0, 400)}`);
  for (const id of ["extra-attack", "asi-4-strength", "arcane-tradition"]) assert.ok(!names.includes(`"${id}"`), id);

  // A level gained takes the next feature with it.
  const later = { ...build, fields: { ...build.fields, level: 6, level_fighter: 5 } };
  assert.ok(
    rulesetBuilderPicks(definition, "features", picked, catalogs, later).some((entry) => entry.id === "extra-attack"),
  );

  // Refusals: nothing to count or price on a step that takes everything, and a prefix that names nothing.
  const counted = fixture();
  counted.sheet.builder.steps[1].countFrom = { field: "level" };
  refuse(counted, /takes all it offers has no "countFrom"/);
  const badPrefix = fixture();
  badPrefix.sheet.builder.steps[1].upTo.per.prefix = "tier_";
  refuse(badPrefix, /No field or derived value starts with "tier_"/);
  const badFilter = fixture();
  badFilter.sheet.builder.steps[1].upTo.per.filter = "level";
  refuse(badFilter, /No text or tags filter "level"/);

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
    "A ruleset with a builder step that takes all it offers (takesAll) or limits each entry by its own value (upTo.per) requires schemaVersion 2 and capabilityApi 1.766 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(765) as never, fixture()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(766) as never, fixture()), gate);
  const perOnly = fixture();
  delete perOnly.sheet.builder.steps[1].takesAll;
  assert.equal(getCapabilityPackageInstallIssue(manifest(765) as never, perOnly), gate, "upTo.per alone");
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(765) as never, base()), gate, "nothing without the keys");

  console.log(
    "takesAll: class features taken up to each class's own level, the ASI-or-feat group picked once, applied to the sheet; refusals; gated at 1.766.",
  );
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
