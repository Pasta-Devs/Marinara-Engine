/** Capability API 1.153: separate formula budgets, original prices and reversible paid deltas. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderSpending,
  rulesetBuilderSpendAction,
  rulesetBuilderRemaining,
  type RulesetBuilderState,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-spend-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
const base = () =>
  JSON.parse(readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"));
const parse = (doc: unknown) => {
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const fixture = () => {
  const doc = base();
  for (const [id, value, max] of [
    ["edu", 20, 100],
    ["intellect", 10, 100],
    ["accounting", 5, 99],
    ["history", 10, 99],
    ["background_value", 0, 10],
    ["flaw", 0, 10],
    ["weakness", 10, 10],
    ["career", 0, 1],
    ["secondary_speed", 5, 10],
  ] as const)
    doc.sheet.fields.push({
      id,
      label: id,
      type: "number",
      min: 0,
      max,
      default: value,
      integer: id !== "secondary_speed",
    });
  doc.sheet.derived.push(
    { id: "occupation_points", label: "Occupation points", op: "scale", of: { field: "edu" }, multiplier: 4 },
    { id: "interest_points", label: "Interest points", op: "scale", of: { field: "intellect" }, multiplier: 2 },
  );
  doc.catalogs.push({
    id: "heritages",
    label: "Heritages",
    entries: [
      {
        id: "free",
        label: "Free background_value",
        grants: { ratings: [{ target: { field: "background_value" }, add: 2 }] },
      },
    ],
  });
  doc.sheet.builder = {
    pools: [
      {
        id: "occupation",
        label: "Occupation",
        budget: { derived: "occupation_points" },
        creditLimit: 4,
        caps: [{ filter: "flaw", maxCredit: 2 }],
      },
      { id: "interest", label: "Interest", budget: { derived: "interest_points" } },
    ],
    steps: [
      { id: "source", label: "Source", kind: "catalog", catalog: "heritages" },
      { id: "career", label: "Career", kind: "fields", fields: ["career"] },
      {
        id: "occupation",
        label: "Occupation",
        kind: "spend",
        pool: "occupation",
        offers: [
          {
            id: "accounting",
            label: "Accounting",
            target: { field: "accounting" },
            min: 5,
            max: 99,
            cost: { flat: 1 },
          },
          {
            id: "background_value",
            label: "Background",
            target: { field: "background_value" },
            min: 0,
            max: 10,
            cost: { perRank: 2 },
            overrides: [{ when: { field: "career" }, cost: { perRank: 1 } }],
          },
          {
            id: "flaw",
            label: "Flaw",
            target: { field: "flaw" },
            min: 0,
            max: 10,
            cost: { flat: -1 },
            credit: true,
            tags: ["flaw"],
          },
          {
            id: "weakness",
            label: "Weakness",
            target: { field: "weakness" },
            min: 0,
            max: 10,
            baseline: 10,
            cost: { flat: 1 },
            credit: true,
          },
        ],
      },
      {
        id: "more",
        label: "More",
        kind: "spend",
        pool: "occupation",
        offers: [
          { id: "history", label: "History", target: { field: "history" }, min: 10, max: 99, cost: { flat: 1 } },
        ],
      },
      {
        id: "interest",
        label: "Interest",
        kind: "spend",
        pool: "interest",
        offers: [
          {
            id: "accounting",
            label: "Accounting",
            target: { field: "accounting" },
            min: 5,
            max: 99,
            cost: { flat: 1 },
          },
          {
            id: "secondary_speed",
            label: "Speed",
            target: { field: "secondary_speed" },
            min: 5,
            max: 6,
            cost: {
              table: [
                [5, 0],
                [5.25, 5],
                [5.5, 12],
                [6, 20],
              ],
            },
          },
        ],
      },
    ],
  };
  return doc;
};
const catalogsOf = (definition: RulesetDefinition) =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));

try {
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  const planted: RulesetBuilderState = {
    picks: { source: ["free"] },
    spending: {
      occupation: {
        accounting: [{ from: 5, to: 10, paid: 5 }],
        background_value: [{ from: 2, to: 7, paid: 50 }],
        flaw: [{ from: 0, to: 2, paid: -2 }],
        weakness: [{ from: 10, to: 8, paid: -2 }],
      },
      more: { history: [{ from: 10, to: 15, paid: 5 }] },
      interest: { accounting: [{ from: 10, to: 15, paid: 5 }] },
    },
  };
  let result = applyRulesetBuilder(definition, defaultRulesetSheetBuild(definition), planted, catalogs);
  const pools = () => rulesetBuilderSpending(definition, result.build, result.state, catalogs);
  const act = (step: string, offer: string, action: "buy" | "refund" | "reprice") => {
    result = applyRulesetBuilder(
      definition,
      result.build,
      rulesetBuilderSpendAction(definition, result.build, result.state, catalogs, step, offer, action),
      catalogs,
    );
  };
  assert.equal(
    result.build.fields.accounting,
    15,
    "occupation and interest own separate paid deltas on the starting 5%",
  );
  assert.equal(result.build.fields.background_value, 7, "free Background 2 plus purchased 5");
  assert.equal(result.build.fields.weakness, 8, "a signed reduction starts at the declared baseline");
  assert.deepEqual(
    pools().map((pool) => [pool.budget, pool.spent, pool.remaining]),
    [
      [80, 56, 24],
      [20, 5, 15],
    ],
  );
  assert.equal(
    pools()[0]!.rows.find((row) => row.offer.id === "background_value")!.next!.paid,
    16,
    "next rank 8 costs 2 × 8",
  );
  assert.equal(pools()[0]!.rows.find((row) => row.offer.id === "flaw")!.canBuy, false, "flaw tag cap");
  assert.equal(pools()[0]!.rows.find((row) => row.offer.id === "weakness")!.canBuy, false, "total credit cap");
  assert.equal(
    rulesetBuilderRemaining(definition, result.build, result.state, catalogs).occupation,
    0,
    "unspent points are informational",
  );
  assert.deepEqual(
    applyRulesetBuilder(definition, result.build, readRulesetBuilderState({ builder: result.state }), catalogs),
    result,
    "reopen never awards again",
  );
  act("interest", "secondary_speed", "buy");
  assert.equal(result.build.fields.secondary_speed, 5.25);
  act("interest", "secondary_speed", "buy");
  assert.equal(result.build.fields.secondary_speed, 5.5);
  assert.equal(pools()[1]!.spent, 17, "cumulative table charges marginal differences");
  assert.equal(pools()[1]!.rows.find((row) => row.offer.id === "secondary_speed")!.canBuy, false);
  act("interest", "secondary_speed", "refund");
  assert.equal(result.build.fields.secondary_speed, 5.25);
  assert.equal(pools()[1]!.spent, 10);
  act("interest", "secondary_speed", "refund");
  assert.equal(result.build.fields.secondary_speed, 5);
  result = applyRulesetBuilder(
    definition,
    { ...result.build, fields: { ...result.build.fields, career: 1 } },
    result.state,
    catalogs,
  );
  assert.equal(
    result.state.spending!.occupation!.background_value![0]!.paid,
    50,
    "career change keeps the original price",
  );
  assert.equal(pools()[0]!.rows.find((row) => row.offer.id === "background_value")!.preview, 25);
  assert.ok(pools()[0]!.invalid);
  assert.ok(pools()[0]!.canReprice);
  act("occupation", "background_value", "reprice");
  assert.equal(result.state.spending!.occupation!.background_value![0]!.paid, 25);
  assert.equal(result.build.fields.background_value, 7);
  assert.deepEqual(
    applyRulesetBuilder(definition, result.build, result.state, catalogs),
    result,
    "repricing is idempotent",
  );
  act("occupation", "background_value", "refund");
  assert.equal(result.build.fields.background_value, 2, "refund preserves free ranks");
  assert.equal(pools()[0]!.spent, 6, "refund removes the exact recorded 25-point line");
  act("occupation", "weakness", "refund");
  assert.equal(result.build.fields.weakness, 10);
  assert.equal(pools()[0]!.spent, 8, "refunding a credit removes the credit");

  const original = applyRulesetBuilder(definition, defaultRulesetSheetBuild(definition), planted, catalogs);
  const changedCareer = applyRulesetBuilder(
    definition,
    { ...original.build, fields: { ...original.build.fields, career: 1 } },
    original.state,
    catalogs,
  );
  const refundedBeforeRepair = applyRulesetBuilder(
    definition,
    changedCareer.build,
    rulesetBuilderSpendAction(
      definition,
      changedCareer.build,
      changedCareer.state,
      catalogs,
      "occupation",
      "background_value",
      "refund",
    ),
    catalogs,
  );
  assert.equal(
    rulesetBuilderSpending(definition, refundedBeforeRepair.build, refundedBeforeRepair.state, catalogs)[0]!.spent,
    6,
    "refund before repricing removes the original 50-point charge, never the proposed 25",
  );
  const manual = { ...original.build, fields: { ...original.build.fields, background_value: 9 } };
  const kept = applyRulesetBuilder(definition, manual, original.state, catalogs);
  assert.equal(kept.build.fields.background_value, 9);
  assert.equal(
    rulesetBuilderSpending(definition, kept.build, kept.state, catalogs)[0]!.rows.find(
      (row) => row.offer.id === "background_value",
    )!.override,
    9,
  );
  const refunded = applyRulesetBuilder(
    definition,
    kept.build,
    rulesetBuilderSpendAction(definition, kept.build, kept.state, catalogs, "occupation", "background_value", "refund"),
    catalogs,
  );
  assert.equal(
    refunded.build.fields.background_value,
    4,
    "refund moves only its delta, retaining the manual difference",
  );
  const described = applyRulesetBuilder(definition, manual, { ...planted, describing: true }, catalogs);
  assert.deepEqual(described.build, manual);
  const ended = applyRulesetBuilder(definition, manual, { ...described.state, describing: false }, catalogs);
  assert.deepEqual(ended.build, manual, "ending describing does not award purchases");
  assert.deepEqual(applyRulesetBuilder(definition, ended.build, ended.state, catalogs), ended);

  const over = applyRulesetBuilder(
    definition,
    { ...original.build, fields: { ...original.build.fields, edu: 1 } },
    original.state,
    catalogs,
  );
  assert.equal(over.state.spending!.occupation!.background_value![0]!.paid, 50);
  assert.ok(rulesetBuilderSpending(definition, over.build, over.state, catalogs)[0]!.remaining! < 0);
  assert.ok(rulesetBuilderRemaining(definition, over.build, over.state, catalogs).occupation! > 0);
  const missingBuild = defaultRulesetSheetBuild(definition);
  delete missingBuild.fields.edu;
  const missing = applyRulesetBuilder(definition, missingBuild, {}, catalogs);
  assert.equal(
    rulesetBuilderSpending(definition, missing.build, missing.state, catalogs)[0]!.budget,
    null,
    "missing budget source is not configured",
  );
  const tolerant = readRulesetBuilderState({
    builder: { ...original.state, spending: { ...planted.spending, broken: { bad: "oops" } } },
  });
  assert.deepEqual(tolerant.spending!.occupation, planted.spending!.occupation);

  // The 24-step builder limit (1.112) also applies to persisted purchase ledgers (1.153).
  const longDoc = fixture();
  longDoc.sheet.builder = {
    pools: [{ id: "shared", label: "Shared", budget: { const: 24 } }],
    steps: Array.from({ length: 24 }, (_, index) => ({
      id: `stage_${index}`,
      label: `Stage ${index}`,
      kind: "spend",
      pool: "shared",
      offers: [{ id: "rank", label: "Rank", target: { field: "accounting" }, min: 5, max: 99, cost: { flat: 1 } }],
    })),
  };
  const longDef = parse(longDoc);
  let longBuild = applyRulesetBuilder(longDef, defaultRulesetSheetBuild(longDef), {}, {});
  for (const step of longDef.sheet.builder!.steps) {
    longBuild = applyRulesetBuilder(
      longDef,
      longBuild.build,
      rulesetBuilderSpendAction(longDef, longBuild.build, longBuild.state, {}, step.id, "rank", "buy"),
      {},
    );
  }
  assert.equal(longBuild.build.fields.accounting, 29);
  const reopenedLong = readRulesetBuilderState({ builder: longBuild.state });
  assert.equal(Object.keys(reopenedLong.spending ?? {}).length, 24);
  assert.deepEqual(applyRulesetBuilder(longDef, longBuild.build, reopenedLong, {}), longBuild);
  assert.equal(rulesetBuilderSpending(longDef, longBuild.build, reopenedLong, {})[0]!.remaining, 0);

  for (const edit of [
    (doc: any) => doc.sheet.builder.pools.push(doc.sheet.builder.pools[0]),
    (doc: any) => (doc.sheet.builder.pools[0].budget = { const: 100001 }),
    (doc: any) => (doc.sheet.builder.pools[0].budget = { livePool: "hp" }),
    (doc: any) => (doc.sheet.builder.pools[0].budget = { field: "accounting" }),
    (doc: any) => (doc.sheet.builder.pools[0].budget = { derived: "missing" }),
    (doc: any) => (doc.sheet.builder.steps[2].pool = "missing"),
    (doc: any) => doc.sheet.builder.steps[2].offers.push(doc.sheet.builder.steps[2].offers[0]),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].cost.flat = 0),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].cost.flat = -1),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].target = { field: "race" }),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].target = { ability: "str", field: "accounting" }),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].target = { skill: "athletics" }),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].min = 100),
    (doc: any) => (doc.sheet.builder.steps[2].offers[1].overrides[0].when = { field: "history" }),
    (doc: any) => delete doc.sheet.builder.steps[2].offers[2].credit,
    (doc: any) => (doc.sheet.builder.pools[0].creditLimit = 0),
    (doc: any) => (doc.sheet.builder.pools[0].caps[0].filter = "unknown"),
    (doc: any) => (doc.sheet.builder.steps[2].offers[3].baseline = 9),
    (doc: any) => (doc.sheet.builder.steps[4].offers[1].cost.table[1][1] = -1),
    (doc: any) => (doc.sheet.builder.steps[4].offers[1].cost.table[1][0] = 5),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].formula = "script()"),
    (doc: any) => (doc.sheet.builder.steps[2].offers[0].cost = { flat: 1, perRank: 1 }),
    (doc: any) => {
      doc.sheet.derived.push({ id: "feedback", label: "Feedback", op: "sum", of: [{ field: "accounting" }] });
      doc.sheet.builder.pools[0].budget = { derived: "feedback" };
    },
    (doc: any) => {
      doc.sheet.builder.steps[4].offers.push({ ...doc.sheet.builder.steps[2].offers[2], id: "other" });
    },
  ]) {
    const bad = fixture();
    edit(bad);
    assert.equal(parseRulesetDefinition(bad).ok, false, "invalid spending contract is refused");
  }
  const hiddenDoc = fixture();
  hiddenDoc.sheet.builder.steps[3].when = { field: "career" };
  const hiddenDef = parse(hiddenDoc);
  const hidden = applyRulesetBuilder(hiddenDef, defaultRulesetSheetBuild(hiddenDef), {}, catalogsOf(hiddenDef));
  const hiddenPool = rulesetBuilderSpending(hiddenDef, hidden.build, hidden.state, catalogsOf(hiddenDef))[0]!;
  assert.equal(hiddenPool.invalid, false, "an empty hidden step does not block its shared pool");
  assert.equal(hiddenPool.rows.find((row) => row.offer.id === "history")!.canBuy, false);
  assert.equal(hiddenPool.rows.find((row) => row.offer.id === "accounting")!.canBuy, true);

  const capDoc = fixture();
  capDoc.sheet.skills.find((skill: any) => skill.id === "athletics").cap = { field: "accounting" };
  capDoc.sheet.builder.pools[1].budget = { skillMod: "athletics" };
  assert.equal(
    parseRulesetDefinition(capDoc).ok,
    false,
    "a cap cannot hide a dependency on an earlier purchased target",
  );

  const reduced = { ...original.build, fields: { ...original.build.fields, background_value: 0 } };
  const floorRefund = applyRulesetBuilder(
    definition,
    reduced,
    rulesetBuilderSpendAction(
      definition,
      reduced,
      original.state,
      catalogs,
      "occupation",
      "background_value",
      "refund",
    ),
    catalogs,
  );
  assert.equal(floorRefund.build.fields.background_value, 0, "refund never crosses the storage floor");
  const rebought = applyRulesetBuilder(
    definition,
    floorRefund.build,
    { ...floorRefund.state, spending: planted.spending },
    catalogs,
  );
  assert.equal(
    rebought.build.fields.background_value,
    5,
    "a floor refund releases ownership instead of leaving a debt",
  );

  const badRank = structuredClone(planted);
  badRank.spending!.occupation!.background_value = [{ from: 2, to: 2.5, paid: 1 }];
  const fractionalRank = applyRulesetBuilder(definition, defaultRulesetSheetBuild(definition), badRank, catalogs);
  assert.ok(rulesetBuilderSpending(definition, fractionalRank.build, fractionalRank.state, catalogs)[0]!.invalid);
  assert.equal(
    fractionalRank.build.fields.background_value,
    2,
    "a corrupt fractional rank never writes to an integer field",
  );

  const firstMatchDoc = fixture();
  firstMatchDoc.sheet.builder.steps[2].offers[1].overrides = [
    { when: { const: 1 }, cost: { perRank: 2 } },
    { when: { const: 1 }, cost: { perRank: 9 } },
  ];
  const firstMatch = parse(firstMatchDoc);
  const firstMatched = applyRulesetBuilder(
    firstMatch,
    defaultRulesetSheetBuild(firstMatch),
    planted,
    catalogsOf(firstMatch),
  );
  assert.equal(
    rulesetBuilderSpending(firstMatch, firstMatched.build, firstMatched.state, catalogsOf(firstMatch))[0]!.invalid,
    false,
    "the first matching price wins",
  );
  const targetsDoc = fixture();
  targetsDoc.sheet.builder = {
    pools: [{ id: "all", label: "All", budget: { const: 100000 } }],
    ratingTiers: [
      { target: { skill: "athletics" }, tiers: ["none", "proficient", "expertise"] },
      { target: { save: "str_save" }, tiers: ["none", "proficient"] },
    ],
    steps: [
      {
        id: "all",
        label: "All",
        kind: "spend",
        pool: "all",
        offers: [
          { id: "strength", label: "Strength", target: { ability: "str" }, min: 1, max: 20, cost: { flat: 1 } },
          { id: "training", label: "Training", target: { skill: "athletics" }, min: 0, max: 2, cost: { perRank: 5 } },
          { id: "save", label: "Save", target: { save: "str_save" }, min: 0, max: 1, cost: { flat: 2 } },
          { id: "bonus", label: "Bonus", target: { bonus: "perception" }, min: 0, max: 5, cost: { flat: 1 } },
        ],
      },
    ],
  };
  const targetsDef = parse(targetsDoc);
  let targets = applyRulesetBuilder(targetsDef, defaultRulesetSheetBuild(targetsDef), {}, {});
  const describedBlank = defaultRulesetSheetBuild(targetsDef);
  const describesTargets = applyRulesetBuilder(targetsDef, describedBlank, { describing: true }, {});
  assert.deepEqual(
    applyRulesetBuilder(targetsDef, describedBlank, { ...describesTargets.state, describing: false }, {}).build,
    describedBlank,
    "ending describing preserves absent training and bonus keys",
  );
  const initialStrength = targets.build.abilities.str!;
  for (const id of ["strength", "training", "save", "bonus"]) {
    targets = applyRulesetBuilder(
      targetsDef,
      targets.build,
      rulesetBuilderSpendAction(targetsDef, targets.build, targets.state, {}, "all", id, "buy"),
      {},
    );
  }
  assert.equal(targets.build.abilities.str, initialStrength + 1);
  assert.equal(targets.build.skills.athletics, "proficient");
  assert.equal(targets.build.saves.str_save, "proficient");
  assert.equal(targets.build.bonuses.perception, 1);
  assert.deepEqual(applyRulesetBuilder(targetsDef, targets.build, targets.state, {}), targets);
  for (const id of ["strength", "training", "save", "bonus"]) {
    targets = applyRulesetBuilder(
      targetsDef,
      targets.build,
      rulesetBuilderSpendAction(targetsDef, targets.build, targets.state, {}, "all", id, "refund"),
      {},
    );
  }
  assert.equal(targets.build.abilities.str, initialStrength);
  assert.equal(targets.build.skills.athletics, "none");
  assert.equal(targets.build.saves.str_save, "none");
  assert.equal(targets.build.bonuses.perception, 0);
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "builder-spend",
    name: "Builder spending",
    version: "1.0.0",
    description: "Spending proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(152) as any, doc) ?? "", /1\.153/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(153) as any, doc), null);
  const poolOnly = fixture();
  poolOnly.sheet.builder.steps = [{ id: "source", label: "Source", kind: "fields", fields: ["career"] }];
  delete poolOnly.sheet.builder.pools[0].caps;
  assert.match(getCapabilityPackageInstallIssue(manifest(152) as any, poolOnly) ?? "", /1\.153/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(152) as any, base()), null);
  console.log("game-ruleset-builder-spend: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
