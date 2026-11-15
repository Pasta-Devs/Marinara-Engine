/**
 * Font of Magic (Capability API 1.252).
 *
 *   - An entry's `restore`: a spell slot paid for Sorcery Points, one more for each slot level above
 *     the first, never past the points' maximum.
 *   - `overMax`: a slot made from points goes past the slots' maximum, is spent like any other, and
 *     goes at a long rest. A slot of a level the sorcerer has none of is not on the menu.
 *   - Import refusals and the install gate.
 *   - Spending another entry's counter (`usesOf`) pays this entry's own price and that counter only,
 *     never the other entry's cost or its other rows.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetLiveState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-font-of-magic-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 247);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const toPoints = {
    id: "font-slot-to-points",
    label: "Font of Magic: slot to points",
    rows: [
      { list: "features", values: { name: "Font of Magic" } },
      { list: "counters", values: { name: "Sorcery Points", max: 5, recharge: "long" } },
      // A second counter of the same entry, which spending its points by name must leave alone.
      { list: "counters", values: { name: "Font Charges", max: 2, recharge: "long" } },
    ],
    mechanics: {
      kind: "buff",
      budget: "bonus",
      targets: "self",
      cost: [{ pool: "slots_1", amount: 1 }],
      perCostStep: { flat: 1 },
      restore: { pool: "Sorcery Points", amount: { flat: 1 } },
    },
  };
  const create = (level: number, price: number) => ({
    id: `font-create-${level}`,
    label: `Font of Magic: level ${level} slot`,
    rows: [{ list: "features", values: { name: `Font of Magic ${level}` } }],
    mechanics: {
      kind: "buff",
      budget: "bonus",
      targets: "self",
      usesOf: "Sorcery Points",
      usesSpent: price,
      restore: { pool: `slots_${level}`, amount: { flat: 1 }, overMax: true },
    },
  });
  const features = [toPoints, create(2, 3), create(4, 2)] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "sorcery",
      label: "Sorcery",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const roll = () => 3;
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("sorcery", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
    fields: {
      level: 5,
      ac: 13,
      speed: 30,
      hp_max: 32,
      spellcasting_ability: "cha",
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 2,
    },
    lists: { features: rows("features"), counters: rows("counters") },
  });
  const fight = (live: RulesetLiveState = {}, catalog = features): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "sorc", name: "Sorcerer", side: "party", build, live, catalogs: { sorcery: catalog } },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["sorc", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState) => rulesetCombatant(state, "sorc")!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const pool = (live: RulesetLiveState, key: string) =>
    readRulesetLive(definition, build, live).pools.find((one) => one.key === key)?.value;
  const points = (state: RulesetEncounterState) => pool(who(state).sheet!.live, "counters:sorcery points");
  const slots = (state: RulesetEncounterState, level: number) => pool(who(state).sheet!.live, `slots_${level}`);
  const options = (state: RulesetEncounterState) => rulesetCombatOptions(definition, state, "sorc");
  const take = (state: RulesetEncounterState, label: string, payWith?: string) => {
    const option = options(state).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "sorc", optionId: option.id, targetIds: ["sorc"], ...(payWith ? { payWith } : {}) },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const spent = { pools: { "counters:sorcery points": { value: 1 } } } satisfies RulesetLiveState;

  // ── A slot becomes points equal to its level ──
  {
    const state = fight(spent);
    assert.equal(points(state), 1);
    const option = options(state).find((one) => one.label === "Font of Magic")!;
    assert.deepEqual(option.payWith, ["slots_2", "slots_3"], "a higher slot may pay for it");
    const step = take(state, "Font of Magic", "slots_2");
    assert.equal(points(step.state), 3, "a 2nd-level slot is two points");
    assert.equal(slots(step.state, 2), 2);
    assert.equal(slots(step.state, 1), 4, "the 1st-level slots are untouched");
    const restored = of(step.events, "restored");
    assert.equal(restored.length, 1, "the log says what came back");
    assert.equal(restored[0]!.pool, "Sorcery Points");
    assert.equal(restored[0]!.amount, 2);
    const first = take(fight(spent), "Font of Magic");
    assert.equal(points(first.state), 2, "a 1st-level slot is one");
    assert.equal(slots(first.state, 1), 3);
    const third = take(fight(spent), "Font of Magic", "slots_3");
    assert.equal(points(third.state), 4, "a 3rd-level slot is three");
    const full = take(fight(), "Font of Magic", "slots_3");
    assert.equal(points(full.state), 5, "never past the points' maximum");
  }

  // ── Points become a slot past the maximum, spent like any other, gone at a long rest ──
  {
    const state = fight();
    assert.ok(!options(state).some((one) => one.label === "Font of Magic 4"), "no 4th-level slots, so none is made");
    const step = take(state, "Font of Magic 2");
    assert.equal(points(step.state), 2, "a 2nd-level slot costs three points");
    assert.equal(slots(step.state, 2), 4, "and goes past the three the sorcerer has");
    assert.equal(slots(step.state, 1), 4, "the points' own entry is not paid for too: no 1st-level slot goes");
    assert.deepEqual(
      of(step.events, "spend").map((one) => one.label),
      ["Sorcery Points"],
      "only the counter it names is spent",
    );
    const priced = structuredClone(features) as Array<Record<string, any>>;
    priced[1]!.mechanics.cost = [{ pool: "slots_3", amount: 1 }];
    const own = take(fight({}, priced as unknown as RulesetCatalogEntry[]), "Font of Magic 2");
    assert.equal(slots(own.state, 3), 1, "a price of its own is paid");
    assert.equal(slots(own.state, 1), 4, "and still not the other entry's");
    assert.equal(points(own.state), 2);
    const restored = of(step.events, "restored");
    assert.equal(restored[0]!.value, 4);
    assert.equal(restored[0]!.max, 3);
    let live = who(step.state).sheet!.live;
    const spend = applyRulesetSheetOp(definition, build, live, { op: "spend", pool: "slots_2", amount: 2 });
    assert.ok(spend.ok);
    assert.equal(pool(spend.live, "slots_2"), 2, "spent like any other");
    live = who(step.state).sheet!.live;
    const rested = applyRulesetSheetOp(definition, build, live, { op: "rest", rest: "long" });
    assert.ok(rested.ok);
    assert.equal(pool(rested.live, "slots_2"), 3, "a long rest sets it back to its maximum");
    assert.equal(rested.live.pools?.slots_2, undefined, "and nothing past it is kept");
    const short = applyRulesetSheetOp(definition, build, live, { op: "rest", rest: "short" });
    assert.ok(short.ok);
    assert.equal(pool(short.live, "slots_2"), 4, "a short rest leaves it");
    // A plain restore never takes it back down, and never adds past the maximum either.
    const topped = applyRulesetSheetOp(definition, build, live, { op: "restore", pool: "slots_2", amount: 1 });
    assert.ok(topped.ok);
    assert.equal(pool(topped.live, "slots_2"), 4);
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>) =>
      doc.catalogs.find((one: { id: string }) => one.id === "sorcery").entries[0].mechanics;
    refused((doc) => (entry(doc).kind = "attack"), /A restore is on an entry that helps/);
    refused((doc) => (entry(doc).restore.amount = {}), /A restore says how much it gives back/);
    refused((doc) => (entry(doc).restore.pool = "hp"), /Health comes back with a heal, not a restore/);
  }

  // ── The install gate ──
  {
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
      "A ruleset with entries that give back to a pool, or past its maximum, requires schemaVersion 2 and capabilityApi 1.252 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [{ mechanics: { restore: { pool: "slots_1" } } }, { overMax: true }]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(251, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(252, document), gate);
    }
    // An item's own use.restore is older than this.
    const item = structuredClone(without);
    item.extra = { item: { use: { restore: { pool: "slots_1" } } } };
    assert.notEqual(issue(251, item), gate);
    assert.notEqual(issue(251, without), gate);
    assert.equal(issue(251, without, new Map([["sorcery.json", { entries: [toPoints] }]])), gate);
  }

  console.log(
    "Ruleset Font of Magic: a slot becomes Sorcery Points equal to its level, points make a slot past the maximum that a long rest takes away, none of a level the sorcerer lacks; gated at 1.252.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
