/** Capability API 1.164: one trait raised and lowered from its starting value without a buy-and-sell
 *  credit loop, a level owned and paid for under a better default, and a closed creation trade out of
 *  one score into another. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderSpendAction,
  rulesetBuilderSpending,
  type RulesetBuilderState,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-trades-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push({ id: "lore", label: "Lore", type: "number", min: 0, max: 20, default: 2 });
  doc.sheet.builder = {
    pools: [{ id: "cp", label: "Character points", budget: { const: 20 }, creditLimit: 20 }],
    steps: [
      {
        id: "traits",
        label: "Traits",
        kind: "spend",
        pool: "cp",
        offers: [
          {
            id: "st",
            label: "Strength",
            target: { ability: "str" },
            direction: "both",
            baseline: 10,
            min: 7,
            max: 14,
            cost: { flat: 10 },
          },
          {
            id: "lore",
            label: "Lore familiarity",
            target: { field: "lore" },
            effect: "ownership",
            baseline: 0,
            min: 0,
            max: 4,
            cost: { flat: 1 },
          },
          {
            id: "wis_to_int",
            label: "Lower Wisdom to raise Intelligence",
            target: { ability: "int" },
            exchange: { from: { ability: "wis" }, units: 2, floor: 9 },
            min: 3,
            max: 18,
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
  const definition = parse(fixture());
  const catalogs = {};
  let state: RulesetBuilderState = readRulesetBuilderState(undefined);
  const blank = defaultRulesetSheetBuild(definition);
  let build: RulesetSheetBuild = {
    ...blank,
    abilities: { ...blank.abilities, str: 10, int: 12, wis: 13 },
  };
  const apply = () => ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  const pool = () => rulesetBuilderSpending(definition, build, state, catalogs)[0]!;
  const row = (id: string) => pool().rows.find((each) => each.offer.id === id)!;
  const act = (id: string, action: "buy" | "refund" | "reduce") => {
    const before = state;
    state = rulesetBuilderSpendAction(definition, build, state, catalogs, "traits", id, action);
    const changed = state !== before;
    apply();
    return changed;
  };
  apply();

  // ── One trait, both ways ──
  assert.equal(row("st").canReduce, true);
  assert.ok(act("st", "buy"));
  assert.equal(build.abilities.str, 11);
  assert.equal(pool().spent, 10);
  // Lowering what was bought refunds it at its own price: no credit comes of buying and lowering.
  assert.deepEqual(row("st").reduce, { from: 11, to: 10, paid: -10 });
  assert.ok(act("st", "reduce"));
  assert.equal(build.abilities.str, 10);
  assert.equal(pool().spent, 0);
  assert.equal(pool().credit, 0);
  assert.deepEqual(state.spending?.traits?.st, []);
  // Lowering past the start is credit, held to the pool's limit.
  assert.ok(act("st", "reduce"));
  assert.ok(act("st", "reduce"));
  assert.equal(build.abilities.str, 8);
  assert.equal(pool().credit, 20);
  assert.equal(pool().remaining, 40);
  assert.equal(row("st").canReduce, false, "a third reduction is past the credit limit");
  assert.equal(act("st", "reduce"), false);
  // Raising again takes a reduction back, paying its credit back.
  assert.deepEqual(row("st").next, { from: 8, to: 9, paid: 10 });
  assert.ok(act("st", "buy"));
  assert.equal(build.abilities.str, 9);
  assert.equal(pool().credit, 10);
  assert.ok(act("st", "buy"));
  assert.equal(pool().spent, 0);

  // ── A level owned under a better default ──
  assert.equal(build.fields.lore, 2);
  assert.ok(act("lore", "buy"));
  assert.equal(row("lore").total, 1);
  assert.equal(pool().spent, 1, "the point is paid");
  assert.equal(build.fields.lore, 2, "and never lowers the better value");
  assert.ok(act("lore", "buy"));
  assert.ok(act("lore", "buy"));
  assert.equal(build.fields.lore, 3, "a level past the default shows");
  assert.ok(act("lore", "refund"));
  assert.equal(build.fields.lore, 2);
  assert.ok(act("lore", "refund"));
  assert.ok(act("lore", "refund"));
  assert.equal(pool().spent, 0, "taking it off refunds exactly what it cost");
  assert.equal(build.fields.lore, 2);

  // ── A closed trade ──
  assert.equal(row("wis_to_int").donor, 13);
  assert.ok(act("wis_to_int", "buy"));
  assert.equal(build.abilities.wis, 11);
  assert.equal(build.abilities.int, 13);
  assert.equal(pool().spent, 0, "a trade costs the pool nothing");
  assert.ok(act("wis_to_int", "buy"));
  assert.equal(build.abilities.wis, 9);
  assert.equal(build.abilities.int, 14);
  assert.equal(row("wis_to_int").canBuy, false, "Wisdom stops at its floor");
  assert.equal(act("wis_to_int", "buy"), false);
  assert.ok(act("wis_to_int", "refund"));
  assert.equal(build.abilities.wis, 11);
  assert.equal(build.abilities.int, 13);
  // The target's cap stops it too.
  {
    let capped: RulesetSheetBuild = { ...blank, abilities: { ...blank.abilities, str: 10, int: 18, wis: 16 } };
    let fresh: RulesetBuilderState = readRulesetBuilderState(undefined);
    ({ build: capped, state: fresh } = applyRulesetBuilder(definition, capped, fresh, catalogs));
    const trade = rulesetBuilderSpending(definition, capped, fresh, catalogs)[0]!.rows.find(
      (each) => each.offer.id === "wis_to_int",
    )!;
    assert.equal(trade.canBuy, false);
  }
  // It survives the envelope.
  state = readRulesetBuilderState({ builder: JSON.parse(JSON.stringify(state)) });
  apply();
  assert.equal(build.abilities.wis, 11);
  assert.equal(build.abilities.int, 13);

  // An offer not yet priceable (its price reads a choice not made) holds nothing up while unbought.
  {
    const waiting = parse(
      fixture((doc) => {
        doc.sheet.fields.push({ id: "career", label: "Career", type: "enum", values: ["sage", "smith"] });
        doc.sheet.derived.push({
          id: "career_sage",
          label: "Sage career",
          op: "enumTable",
          from: { field: "career" },
          table: { sage: 1, smith: 0 },
        });
        doc.sheet.builder.steps[0].offers.push({
          id: "career_skill",
          label: "Career skill",
          target: { field: "lore" },
          min: 0,
          max: 20,
          cost: { flat: 2 },
          overrides: [{ when: { derived: "career_sage" }, cost: { flat: 1 } }],
        });
        doc.sheet.builder.steps[0].offers.splice(1, 1);
      }),
    );
    let waitingState: RulesetBuilderState = readRulesetBuilderState(undefined);
    let waitingBuild: RulesetSheetBuild = { ...blank, abilities: { ...blank.abilities, str: 10, int: 12, wis: 13 } };
    ({ build: waitingBuild, state: waitingState } = applyRulesetBuilder(waiting, waitingBuild, waitingState, catalogs));
    const pools = rulesetBuilderSpending(waiting, waitingBuild, waitingState, catalogs);
    assert.equal(pools[0]!.invalid, false);
    assert.equal(pools[0]!.rows.find((each) => each.offer.id === "st")!.canBuy, true);
    assert.equal(pools[0]!.rows.find((each) => each.offer.id === "career_skill")!.canBuy, false);
  }

  // ── The schema ──
  const offer = (index: number, change: (offer: Record<string, any>) => void) =>
    issuesOf(fixture((doc) => change(doc.sheet.builder.steps[0].offers[index])));
  assert.match(
    offer(2, (each) => (each.cost = { flat: 1 })),
    /An exchange costs the pool nothing/,
  );
  assert.match(
    offer(2, (each) => (each.exchange.from = { ability: "int" })),
    /trades out of another rating/,
  );
  assert.match(
    offer(2, (each) => (each.exchange.floor = 99)),
    /The floor fits/,
  );
  assert.match(
    offer(0, (each) => (each.credit = true)),
    /earns no declared credit/,
  );
  assert.match(
    offer(1, (each) => delete each.cost),
    /needs a cost/,
  );
  assert.match(
    offer(0, (each) => (each.baseline = 20)),
    /baseline is inside/,
  );
  assert.match(
    offer(1, (each) => (each.direction = "both")),
    /only ever bought up/,
  );
  // Traded points are never traded on: once Intelligence was raised by a trade it gives nothing to
  // another, and before then the other trade stands open.
  {
    const chained = parse(
      fixture((doc) =>
        doc.sheet.builder.steps[0].offers.push({
          id: "int_to_cha",
          label: "Lower Intelligence",
          target: { ability: "cha" },
          exchange: { from: { ability: "int" }, units: 2, floor: 9 },
          min: 3,
          max: 18,
        }),
      ),
    );
    let chainState: RulesetBuilderState = readRulesetBuilderState(undefined);
    let chainBuild: RulesetSheetBuild = {
      ...blank,
      abilities: { ...blank.abilities, str: 10, int: 14, wis: 13, cha: 8 },
    };
    const chainApply = () =>
      ({ build: chainBuild, state: chainState } = applyRulesetBuilder(chained, chainBuild, chainState, catalogs));
    const chainRow = (id: string) =>
      rulesetBuilderSpending(chained, chainBuild, chainState, catalogs)[0]!.rows.find((each) => each.offer.id === id)!;
    chainApply();
    assert.equal(chainRow("int_to_cha").canBuy, true);
    chainState = rulesetBuilderSpendAction(chained, chainBuild, chainState, catalogs, "traits", "wis_to_int", "buy");
    chainApply();
    assert.equal(chainBuild.abilities.int, 15);
    assert.equal(chainRow("int_to_cha").canBuy, false, "raised Intelligence is not traded on");
    chainState = rulesetBuilderSpendAction(chained, chainBuild, chainState, catalogs, "traits", "wis_to_int", "refund");
    chainApply();
    chainState = rulesetBuilderSpendAction(chained, chainBuild, chainState, catalogs, "traits", "int_to_cha", "buy");
    chainApply();
    assert.equal(chainBuild.abilities.cha, 9);
    assert.equal(chainRow("wis_to_int").canBuy, false, "lowered Intelligence is not raised by a trade");
  }
  assert.match(
    issuesOf(
      fixture((doc) =>
        doc.sheet.builder.steps[0].offers.push({
          id: "st2",
          label: "Strength again",
          target: { ability: "str" },
          min: 3,
          max: 18,
          cost: { flat: 5 },
        }),
      ),
    ),
    /two-way target has one offer/,
  );
  assert.match(
    offer(0, (each) => (each.direction = "decrease")),
    /signed reduction declares credit/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "trades",
    name: "Trades",
    version: "1.0.0",
    description: "Trades proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(163, fixture()) ?? "", /1\.164/);
  assert.equal(gate(164, fixture()), null);
  for (const keep of [0, 1, 2]) {
    const one = fixture((doc) => {
      doc.sheet.builder.steps[0].offers = [doc.sheet.builder.steps[0].offers[keep]];
    });
    assert.match(gate(163, one) ?? "", /1\.164/, `offer ${keep} alone needs 1.164`);
  }

  console.log("game-ruleset-trades: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
