/** Capability API 1.159: builder picks and the player's own rows paid out of a shared pool, and rows
 *  copied from a catalog as often as the player likes, each priced and removed on its own. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderPickReason,
  rulesetBuilderRemaining,
  rulesetBuilderSpendAction,
  rulesetBuilderSpending,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-priced-choices-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push({ id: "renown", label: "Renown", type: "number", min: 0, max: 10, default: 0 });
  doc.sheet.lists.push(
    {
      id: "charms",
      label: "Charms",
      maxItems: 12,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "cost", label: "Cost", type: "number", min: 0, max: 20, default: 1 },
      ],
    },
    {
      id: "flaws",
      label: "Flaws",
      maxItems: 6,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "value", label: "Value", type: "number", min: -10, max: 0, default: 0 },
      ],
    },
  );
  doc.catalogs.push({
    id: "charm_book",
    label: "Charm book",
    feeds: ["charms"],
    entries: [
      {
        id: "ox-body",
        label: "Ox-Body Technique",
        rows: [{ list: "charms", values: { name: "Ox-Body Technique", cost: 3 } }],
      },
    ],
  });
  doc.sheet.builder = {
    pools: [{ id: "bp", label: "Bonus points", budget: { const: 10 }, creditLimit: 4 }],
    steps: [
      {
        id: "feats",
        label: "Talents",
        kind: "catalog",
        catalog: "feats",
        min: 0,
        max: 3,
        pool: "bp",
        cost: { filter: "level" },
      },
      {
        id: "charms",
        label: "Charms",
        kind: "rows",
        list: "charms",
        pool: "bp",
        cost: { column: "cost" },
        from: "charm_book",
      },
      { id: "flaws", label: "Flaws", kind: "rows", list: "flaws", pool: "bp", cost: { column: "value" } },
      {
        id: "buy",
        label: "Buy",
        kind: "spend",
        pool: "bp",
        offers: [{ id: "renown", label: "Renown", target: { field: "renown" }, min: 0, max: 10, cost: { flat: 2 } }],
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
  const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  const step = definition.sheet.builder!.steps[0]! as Extract<
    (typeof definition.sheet.builder)["steps"][number],
    { kind: "catalog" }
  >;
  let state: RulesetBuilderState = readRulesetBuilderState(undefined);
  let build: RulesetSheetBuild = defaultRulesetSheetBuild(definition);
  const apply = () => ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  const pool = () => rulesetBuilderSpending(definition, build, state, catalogs).find((each) => each.id === "bp")!;
  const withRows = (list: string, rows: Record<string, unknown>[]) => {
    build = { ...build, lists: { ...build.lists, [list]: rows } } as RulesetSheetBuild;
    apply();
  };
  const ox = { name: "Ox-Body Technique", cost: 3 };
  apply();

  // Talents cost their level out of the pool.
  state = { ...state, picks: { feats: ["sly-strike", "quick-hands"] } };
  apply();
  assert.equal(pool().spent, 3);
  assert.deepEqual(
    pool().priced.map((item) => [item.label, item.cost]),
    [
      ["Sly Strike", 1],
      ["Quick Hands", 2],
    ],
  );

  // The same Charm copied twice is two rows, paid twice.
  withRows("charms", [{ ...ox }, { ...ox }]);
  assert.equal(pool().spent, 9);
  assert.equal(pool().remaining, 1);
  // A talent the pool cannot pay for is not offered; one already picked stays.
  assert.equal(rulesetBuilderPickReason(definition, step, state, catalogs, build, "second-effort"), "unaffordable");
  assert.equal(rulesetBuilderPickReason(definition, step, state, catalogs, build, "quick-hands"), undefined);

  // Removing one copy refunds exactly that one.
  withRows("charms", [{ ...ox, name: "Ox-Body (second)" }]);
  assert.equal(pool().spent, 6);
  assert.deepEqual(
    pool()
      .priced.filter((item) => item.stepId === "charms")
      .map((item) => item.label),
    ["Ox-Body (second)"],
  );

  // A flaw is a credit, held to the pool's credit limit.
  withRows("flaws", [{ name: "Hunted", value: -3 }]);
  assert.equal(pool().spent, 3);
  assert.equal(pool().credit, 3);
  state = rulesetBuilderSpendAction(definition, build, state, catalogs, "buy", "renown", "buy");
  apply();
  state = rulesetBuilderSpendAction(definition, build, state, catalogs, "buy", "renown", "buy");
  apply();
  state = rulesetBuilderSpendAction(definition, build, state, catalogs, "buy", "renown", "buy");
  apply();
  assert.equal(build.fields.renown, 3);
  assert.equal(pool().spent, 9);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).flaws, 0);

  // Taking the flaw away overspends: the bought Renown stops applying, nothing is sold, and the
  // priced steps say there is something to repair.
  withRows("flaws", []);
  assert.equal(pool().invalid, true);
  assert.equal(pool().spent, 12);
  assert.equal(build.fields.renown, 0, "overspent purchases go inactive");
  assert.deepEqual(state.picks?.feats, ["sly-strike", "quick-hands"]);
  assert.equal((build.lists.charms ?? []).length, 1);
  assert.equal(state.spending?.buy?.renown?.length, 3, "the ledger is kept for repair");
  const remaining = rulesetBuilderRemaining(definition, build, state, catalogs);
  assert.equal(remaining.feats, 1);
  assert.equal(remaining.charms, 1);
  // Putting it back restores everything as it was.
  withRows("flaws", [{ name: "Hunted", value: -3 }]);
  assert.equal(pool().invalid, false);
  assert.equal(build.fields.renown, 3);

  // Credit past the limit is not spendable.
  withRows("flaws", [
    { name: "Hunted", value: -3 },
    { name: "Cursed", value: -2 },
  ]);
  assert.equal(pool().invalid, true, "5 credit is over the limit of 4");

  // ── The schema ──
  const broken = (index: number, change: (step: Record<string, any>) => void) =>
    issuesOf(fixture((doc) => change(doc.sheet.builder.steps[index])));
  assert.match(
    broken(0, (step) => delete step.cost),
    /pool and cost together/,
  );
  assert.match(
    broken(1, (step) => (step.pool = "nowhere")),
    /Unknown builder pool "nowhere"/,
  );
  assert.match(
    broken(0, (step) => (step.cost = { filter: "missing" })),
    /No number filter "missing"/,
  );
  assert.match(
    broken(1, (step) => (step.cost = { column: "name" })),
    /No number column "name"/,
  );
  assert.match(
    broken(2, (step) => (step.from = "charm_book")),
    /writes no rows to "flaws"/,
  );
  assert.match(
    broken(1, (step) => (step.from = "creatures")),
    /No catalog of rows "creatures"/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "priced-choices",
    name: "Priced choices",
    version: "1.0.0",
    description: "Priced choices proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(158, fixture()) ?? "", /1\.159/);
  assert.equal(gate(159, fixture()), null);

  console.log("game-ruleset-priced-choices: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
