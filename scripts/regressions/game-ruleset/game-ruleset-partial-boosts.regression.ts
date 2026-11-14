/** Capability API 1.211: a score choice that gives a partial increase to a score already at a mark,
 *  two partials making one whole increase (Pathfinder 2e's boost to a +4 modifier). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-partial-boosts-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const boost = (id: string) => ({
  id,
  label: id,
  grants: { abilities: { choose: [{ id: `boost_${id}`, count: 2, amount: 1, partialFrom: 12 }] } },
});
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.catalogs.push({ id: "levels", label: "Boost sets", entries: [boost("l5"), boost("l10"), boost("l15")] });
  doc.sheet.builder = {
    steps: [{ id: "levels", label: "Boosts", kind: "catalog", catalog: "levels", min: 0, max: 3 }],
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
  const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  let build: RulesetSheetBuild = defaultRulesetSheetBuild(definition);
  let state: RulesetBuilderState = readRulesetBuilderState(undefined);
  const apply = (next: RulesetBuilderState) =>
    ({ build, state } = applyRulesetBuilder(definition, build, next, catalogs));
  const sets = (picks: string[], choices: Record<string, string[]>) =>
    apply({
      ...state,
      picks: { levels: picks },
      abilityChoices: Object.fromEntries(
        Object.entries(choices).map(([id, chosen]) => [`levels/${id}/boost_${id}`, chosen]),
      ),
    });

  // Below the mark a boost is whole: 10 -> 11 -> 12.
  sets(["l5"], { l5: ["str", "dex"] });
  assert.equal(build.abilities.str, 11);
  sets(["l5", "l10"], { l5: ["str", "dex"], l10: ["str", "con"] });
  assert.equal(build.abilities.str, 12);
  // At the mark the next boost is a partial, which shows nothing alone...
  sets(["l5", "l10", "l15"], { l5: ["str", "dex"], l10: ["str", "con"], l15: ["str", "con"] });
  assert.equal(build.abilities.str, 12, "one partial");
  assert.equal(build.abilities.con, 12);
  // ...and its pair makes one whole increase.
  const doubled = parse(
    fixture((doc) => {
      doc.catalogs.at(-1).entries.push(boost("l20"));
      doc.sheet.builder.steps[0].max = 4;
    }),
  );
  const doubledCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (doubled.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  const four = applyRulesetBuilder(
    doubled,
    defaultRulesetSheetBuild(doubled),
    {
      picks: { levels: ["l5", "l10", "l15", "l20"] },
      abilityChoices: {
        "levels/l5/boost_l5": ["str", "dex"],
        "levels/l10/boost_l10": ["str", "dex"],
        "levels/l15/boost_l15": ["str", "dex"],
        "levels/l20/boost_l20": ["str", "con"],
      },
    },
    doubledCatalogs,
  );
  assert.equal(four.build.abilities.str, 13, "two partials make one");
  assert.equal(four.build.abilities.dex, 12, "a lone partial");
  // Unpicking takes the boosts back exactly.
  sets([], {});
  assert.equal(build.abilities.str, 10);
  assert.equal(build.abilities.con, 10);

  // ── The schema ──
  assert.match(
    issuesOf(fixture((doc) => (doc.catalogs.at(-1).entries[0].grants.abilities.choose[0].partialFrom = 1.5))),
    /partialFrom/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "partial-boosts",
    name: "Partial boosts",
    version: "1.0.0",
    description: "Partial boosts proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(210, fixture()) ?? "", /1\.211/);
  assert.equal(gate(211, fixture()), null);

  console.log("game-ruleset-partial-boosts: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
