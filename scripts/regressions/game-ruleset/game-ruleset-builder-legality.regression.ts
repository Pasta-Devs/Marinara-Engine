/** Capability API 1.155: offer eligibility, sheet-read and discrete bounds, replacement pools and rules. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderConstraintFailures,
  rulesetBuilderRemaining,
  rulesetBuilderSpending,
  rulesetBuilderSpendAction,
  rulesetBuilderTrainedSlots,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-legality-"));
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
const issuesOf = (doc: unknown) => {
  const parsed = parseRulesetDefinition(doc);
  return parsed.ok ? "" : parsed.issues.join("; ");
};
const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const fixture = () => {
  const doc = base();
  for (const [id, max] of [
    ["may_ancestors", 1],
    ["ancestors", 5],
    ["dodge", 99],
    ["merit", 5],
    ["credit_rating", 99],
    ["cr_min", 99],
    ["cr_max", 99],
  ] as const)
    doc.sheet.fields.push({ id, label: id, type: "number", min: 0, max, default: 0, integer: true });
  doc.sheet.fields.push({ id: "approved", label: "Approved", type: "boolean", default: false });
  doc.sheet.lists.push({
    id: "quirks",
    label: "Quirks",
    maxItems: 10,
    columns: [
      { id: "name", label: "Name", type: "text", maxLength: 80 },
      { id: "cost", label: "Cost", type: "number", min: -10, max: 10, default: -1 },
    ],
  });
  doc.catalogs.push({
    id: "origins",
    label: "Origins",
    entries: [
      {
        id: "acolyte",
        label: "Acolyte",
        grants: {
          trained: {
            skills: ["religion"],
            choose: [
              {
                id: "pick",
                what: "skills",
                count: 1,
                from: ["religion", "insight"],
                onDuplicate: "replace",
                replacementFrom: ["stealth", "survival", "religion"],
              },
            ],
          },
        },
      },
    ],
  });
  doc.sheet.builder = {
    tier: "proficient",
    pools: [{ id: "points", label: "Points", budget: { const: 100 } }],
    steps: [
      { id: "origin", label: "Origin", kind: "catalog", catalog: "origins" },
      { id: "info", label: "Info", kind: "fields", fields: ["may_ancestors", "cr_min", "cr_max", "approved"] },
      {
        id: "buy",
        label: "Buy",
        kind: "spend",
        pool: "points",
        offers: [
          {
            id: "ancestors",
            label: "Ancestors",
            target: { field: "ancestors" },
            min: 0,
            max: 5,
            cost: { flat: 1 },
            when: { field: "may_ancestors" },
          },
          {
            id: "dodge",
            label: "Dodge",
            target: { field: "dodge" },
            min: 0,
            max: 99,
            cost: { flat: 1 },
            maxFrom: { abilityScore: "dex" },
          },
          {
            id: "merit",
            label: "Merit",
            target: { field: "merit" },
            min: 0,
            max: 5,
            cost: { flat: 2 },
            allowedRatings: [1, 3, 5],
          },
          {
            id: "credit",
            label: "Credit Rating",
            target: { field: "credit_rating" },
            min: 0,
            max: 99,
            cost: { flat: 1 },
            minFrom: { field: "cr_min" },
            maxFrom: { field: "cr_max" },
          },
        ],
      },
      { id: "quirks", label: "Quirks", kind: "rows", list: "quirks" },
    ],
    constraints: [
      {
        id: "cr_range",
        label: "Credit Rating sits inside the occupation's range.",
        step: "buy",
        value: { field: "credit_rating" },
        min: { field: "cr_min" },
        max: { field: "cr_max" },
      },
      {
        id: "quirk_count",
        label: "Take at most five quirks.",
        step: "quirks",
        rows: { list: "quirks" },
        max: 5,
      },
      {
        id: "disadvantage_cap",
        label: "Disadvantages give at most 4 points.",
        step: "quirks",
        rows: { list: "quirks", filter: { column: "cost", below: 0 }, sum: "cost" },
        min: -4,
      },
      {
        id: "distinct",
        label: "Each quirk is different.",
        step: "quirks",
        distinct: { list: "quirks", column: "name" },
      },
      {
        id: "approval",
        label: "The Storyteller approves Ancestors.",
        step: "info",
        when: { field: "ancestors" },
        approved: "approved",
      },
    ],
  };
  return doc;
};

try {
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  let result: { build: RulesetSheetBuild; state: RulesetBuilderState } = applyRulesetBuilder(
    definition,
    defaultRulesetSheetBuild(definition),
    readRulesetBuilderState(undefined),
    catalogs,
  );
  const rows = () => rulesetBuilderSpending(definition, result.build, result.state, catalogs)[0]!;
  const row = (id: string) => rows().rows.find((each) => each.offer.id === id)!;
  const act = (offer: string, action: "buy" | "refund") => {
    result = applyRulesetBuilder(
      definition,
      result.build,
      rulesetBuilderSpendAction(definition, result.build, result.state, catalogs, "buy", offer, action),
      catalogs,
    );
  };
  const setField = (id: string, value: number | boolean) => {
    result = applyRulesetBuilder(
      definition,
      { ...result.build, fields: { ...result.build.fields, [id]: value } },
      result.state,
      catalogs,
    );
  };

  // An offer the character may not take is shown, not bought, and leaves the pool valid.
  assert.equal(row("ancestors").unavailable, true);
  assert.equal(row("ancestors").canBuy, false);
  assert.equal(rows().invalid, false);
  setField("may_ancestors", 1);
  assert.equal(row("ancestors").canBuy, true);
  act("ancestors", "buy");
  assert.equal(result.build.fields.ancestors, 1);
  // Its rule asks for approval only once Ancestors is bought.
  assert.deepEqual(
    rulesetBuilderConstraintFailures(definition, result.build).map((rule) => rule.id),
    ["approval"],
  );
  setField("approved", true);
  assert.deepEqual(rulesetBuilderConstraintFailures(definition, result.build), []);
  // Taking it away keeps the saved purchase, inactive, for repair.
  setField("may_ancestors", 0);
  assert.equal(row("ancestors").inactive, true);
  assert.equal(row("ancestors").purchases.length, 1);
  assert.equal(rows().invalid, true);
  act("ancestors", "refund");
  assert.equal(rows().invalid, false);

  // Dodge stops at DEX, read off the sheet.
  assert.equal(row("dodge").max, 10);
  for (let n = 0; n < 12; n++) if (row("dodge").canBuy) act("dodge", "buy");
  assert.equal(result.build.fields.dodge, 10);
  assert.equal(row("dodge").next, null);

  // A Merit is bought 1, 3, 5: never the dots between.
  act("merit", "buy");
  assert.equal(result.build.fields.merit, 1);
  assert.deepEqual(row("merit").next, { from: 1, to: 3, paid: 4 });
  act("merit", "buy");
  assert.equal(result.build.fields.merit, 3);

  // Credit Rating has no range until the occupation sets one; then a purchase lands on its floor.
  assert.equal(row("credit").unavailable, false);
  setField("cr_min", 9);
  setField("cr_max", 20);
  assert.ok(
    rulesetBuilderConstraintFailures(definition, result.build).some((rule) => rule.id === "cr_range"),
    "a Credit Rating below the range is a failed rule",
  );
  assert.equal(rulesetBuilderRemaining(definition, result.build, result.state, catalogs).buy, 1);
  assert.deepEqual(row("credit").next, { from: 0, to: 9, paid: 9 });
  act("credit", "buy");
  assert.equal(result.build.fields.credit_rating, 9);
  assert.equal(rulesetBuilderRemaining(definition, result.build, result.state, catalogs).buy, 0);
  // A narrower range later leaves the purchase saved and inactive rather than selling it.
  setField("cr_max", 5);
  setField("cr_min", 0);
  assert.equal(row("credit").inactive, true);
  assert.deepEqual(row("credit").purchases, [{ from: 0, to: 9, paid: 9 }]);

  // Rules over a list: count, a filtered sum and distinct names.
  const quirks = (list: { name: string; cost: number }[]) => {
    result = { ...result, build: { ...result.build, lists: { ...result.build.lists, quirks: list } } };
    return rulesetBuilderConstraintFailures(definition, result.build)
      .map((rule) => rule.id)
      .filter((id) => id !== "cr_range");
  };
  assert.deepEqual(quirks([{ name: "Hums", cost: -1 }]), []);
  assert.deepEqual(quirks(["a", "b", "c", "d", "e", "f"].map((name) => ({ name, cost: -1 }))), [
    "quirk_count",
    "disadvantage_cap",
  ]);
  assert.deepEqual(
    quirks([
      { name: "Hums", cost: -1 },
      { name: " hums", cost: 1 },
    ]),
    ["distinct"],
  );

  // A duplicate replaced only from the named pool: never Perception, never a skill already held.
  result = applyRulesetBuilder(
    definition,
    defaultRulesetSheetBuild(definition),
    {
      ...readRulesetBuilderState(undefined),
      picks: { origin: ["acolyte"] },
      trainedChoices: { "origin/acolyte/pick": ["religion"] },
    },
    catalogs,
  );
  const replacement = rulesetBuilderTrainedSlots(definition, result.state, catalogs, result.build).find(
    (slot) => slot.replacement,
  );
  assert.ok(replacement, "a duplicate opens a replacement");
  assert.deepEqual(
    replacement!.from.filter((id) => !replacement!.disabled?.[id]),
    ["stealth", "survival"],
  );

  // Schema checks.
  const broken = (change: (doc: any) => void) => {
    const next = fixture();
    change(next);
    return issuesOf(next);
  };
  const offer = (doc: any, id: string) => doc.sheet.builder.steps[2].offers.find((each: any) => each.id === id);
  assert.match(
    broken((doc) => (offer(doc, "merit").allowedRatings = [1, 7])),
    /7 is outside the offer's bounds/,
  );
  assert.match(
    broken((doc) => (offer(doc, "dodge").maxFrom = { field: "missing" })),
    /missing/,
  );
  assert.match(
    broken((doc) => (offer(doc, "dodge").maxFrom = { field: "merit" })),
    /cannot read purchased targets/,
  );
  assert.match(
    broken((doc) => delete doc.catalogs.at(-1).entries[0].grants.trained.choose[0].onDuplicate),
    /Only a choice that replaces duplicates/,
  );
  assert.match(
    broken((doc) => (doc.catalogs.at(-1).entries[0].grants.trained.choose[0].replacementFrom = ["nope"])),
    /Unknown skill "nope"/,
  );
  assert.match(
    broken((doc) => (doc.sheet.builder.constraints[0].step = "nope")),
    /Unknown step "nope"/,
  );
  assert.match(
    broken((doc) => (doc.sheet.builder.constraints[3].distinct.column = "nope")),
    /Unknown column "nope"/,
  );
  assert.match(
    broken((doc) => (doc.sheet.builder.constraints[4].approved = "merit")),
    /No boolean field "merit"/,
  );
  assert.match(
    broken((doc) => delete doc.sheet.builder.constraints[1].max),
    /names a min or a max/,
  );
  assert.match(
    broken((doc) => (doc.sheet.builder.constraints[2].rows.filter = { column: "name", below: 0 })),
    /Only a number column/,
  );

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "builder-legality",
    name: "Builder legality",
    version: "1.0.0",
    description: "Legality proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue = (minor: number, value: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, value);
  assert.match(issue(154, doc) ?? "", /1\.155/);
  assert.equal(issue(155, doc), null);
  for (const strip of [
    (next: any) => delete next.sheet.builder.constraints,
    (next: any) => next.sheet.builder.steps[2].offers.forEach((each: any) => delete each.when),
  ]) {
    const next = fixture();
    next.sheet.builder.steps.pop();
    strip(next);
    assert.match(issue(154, next) ?? "", /1\.155/, "each 1.155 key alone needs 1.155");
  }
  const only = fixture();
  only.sheet.builder.steps.pop();
  delete only.sheet.builder.constraints;
  only.sheet.builder.steps[2].offers.forEach((each: any) => {
    delete each.when;
    delete each.minFrom;
    delete each.maxFrom;
    delete each.allowedRatings;
  });
  assert.match(issue(154, only) ?? "", /1\.155/, "a catalog grant's replacement pool needs 1.155");
  delete only.catalogs.at(-1).entries[0].grants.trained.choose[0].replacementFrom;
  assert.equal(issue(154, only), null);
  console.log("game-ruleset-builder-legality: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
