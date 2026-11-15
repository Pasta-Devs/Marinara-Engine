/**
 * A pool that pays for another group, and targets that grow with the cost (Capability API 1.171).
 *
 *   - A live pool's `pays` lets it pay for a cost of another group at its own level: 5e's pact slots
 *     paying for a spell costed from the spell slots, growing it by as many steps as it is above.
 *   - A pact slot below the spell's own level is not offered, and an ordinary slot still is.
 *   - A spell whose own pool is empty is still offered, paid only from a higher pool.
 *   - `targetsPerCostStep` adds targets for each step paid up: Hold Person.
 *   - The sheet's `use` command accepts the same, import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  planRulesetUse,
  rowsFromCatalogEntry,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cast-ladder-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 166);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const pactPays = (doc: Record<string, any>) => {
    const pact = doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "pact_slots");
    pact.level = { field: "pact_slot_level" };
    pact.pays = ["slots"];
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `must refuse ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(fiveE(pactPays));
  const plain = parsed(fiveE());

  const spells = [
    {
      id: "missile",
      label: "Missile",
      rows: [{ list: "spells", values: { name: "Missile", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        amount: { flat: 3 },
        damageType: "force",
        cost: [{ pool: "slots_1", amount: 1 }],
        perCostStep: { flat: 1 },
      },
    },
    {
      id: "hold",
      label: "Hold",
      rows: [{ list: "spells", values: { name: "Hold", level: 2, prepared: true } }],
      mechanics: {
        kind: "debuff",
        autoHit: true,
        targetCount: 1,
        targetsPerCostStep: 1,
        cost: [{ pool: "slots_2", amount: 1 }],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  /** A warlock 5 with a 3rd-level pact slot and, as a wizard 1, two 1st-level slots. */
  const build = (fields: Record<string, number> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 12, int: 16, wis: 10, cha: 16 },
      fields: {
        level: 6,
        ac: 12,
        speed: 30,
        hp_max: 40,
        spellcasting_ability: "cha",
        slots_max_1: 2,
        slots_max_2: 1,
        pact_slots_max: 2,
        pact_slot_level: 3,
        ...fields,
      },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const foe = (id: string) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 50,
      defense: 10,
      initiativeModifier: -20,
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    },
  });
  const fight = (
    rules: RulesetDefinition,
    pools: Record<string, number> = {},
    fields: Record<string, number> = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "lock",
          name: "Lock",
          side: "party",
          build: build(fields),
          live: { pools: Object.fromEntries(Object.entries(pools).map(([id, value]) => [id, { value }])) },
          catalogs: { spells },
        },
        foe("a"),
        foe("b"),
        foe("c"),
        foe("d"),
      ],
    });
    state.turn = state.order.indexOf("lock");
    return state;
  };
  const optionOf = (rules: RulesetDefinition, state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(rules, state, "lock").find((one) => one.label === label);
  const dealt = (events: RulesetCombatEvent[]) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .reduce((total, one) => total + one.dealt, 0);
  const refusedWith = (step: { events: RulesetCombatEvent[] }) =>
    step.events.find((one): one is Extract<RulesetCombatEvent, { type: "refused" }> => one.type === "refused")?.reason;
  const cast = (
    rules: RulesetDefinition,
    state: RulesetEncounterState,
    label: string,
    targetIds: string[],
    payWith?: string,
  ) =>
    applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "lock", optionId: optionOf(rules, state, label)!.id, targetIds, ...(payWith ? { payWith } : {}) },
      () => 10,
    );

  // A pact slot pays for a 1st-level spell, grown by two steps; an ordinary slot still pays as it did.
  {
    const state = fight(definition);
    const missile = optionOf(definition, state, "Missile")!;
    assert.deepEqual(missile.payWith, ["slots_2", "pact_slots"]);
    assert.equal(missile.upcastOnly, undefined);
    const pact = cast(definition, state, "Missile", ["a"], "pact_slots");
    assert.equal(refusedWith(pact), undefined);
    assert.equal(dealt(pact.events), 3 + 2, "3 and a step for each level above the 1st");
    const lock = pact.state.combatants.find((one) => one.id === "lock")!;
    assert.equal(
      (lock.sheet!.live.pools as Record<string, { value: number }>).pact_slots!.value,
      1,
      "a pact slot spent",
    );
    assert.equal(dealt(cast(definition, fight(definition), "Missile", ["a"]).events), 3, "its own slot");
    assert.equal(dealt(cast(definition, fight(definition), "Missile", ["a"], "slots_2").events), 4, "a 2nd-level slot");
  }

  // Without `pays` the pact pool pays for nothing but its own group.
  assert.deepEqual(optionOf(plain, fight(plain), "Missile")!.payWith, ["slots_2"]);

  // A pact slot below the spell's own level is not offered.
  {
    const state = fight(definition, {}, { pact_slot_level: 1 });
    assert.deepEqual(optionOf(definition, state, "Hold")!.payWith ?? [], []);
    assert.deepEqual(
      optionOf(definition, state, "Missile")!.payWith,
      ["slots_2", "pact_slots"],
      "a level-1 pact slot pays at 1st",
    );
    const at = cast(definition, state, "Missile", ["a"], "pact_slots");
    assert.equal(dealt(at.events), 3, "and grows nothing");
  }

  // Its own slots gone, a spell is offered from a higher pool only; without a payer it is not offered.
  {
    const state = fight(definition, { slots_1: 0 });
    const missile = optionOf(definition, state, "Missile")!;
    assert.equal(missile.upcastOnly, true);
    assert.deepEqual(missile.payWith, ["slots_2", "pact_slots"]);
    assert.ok(
      missile.cost?.some((one) => one.pool === "slots_2"),
      "it shows the cheapest price",
    );
    assert.equal(refusedWith(cast(definition, state, "Missile", ["a"])), "insufficient", "never at its own price");
    assert.equal(dealt(cast(definition, state, "Missile", ["a"], "slots_2").events), 4);
    assert.equal(
      optionOf(definition, fight(definition, { slots_1: 0, slots_2: 0, pact_slots: 0 }), "Missile"),
      undefined,
    );
  }

  // Hold takes one target at its own level, and one more for each step paid up.
  {
    const state = fight(definition);
    const hold = optionOf(definition, state, "Hold")!;
    assert.equal(hold.targets.count, 1);
    assert.deepEqual(hold.targetsWith, { pact_slots: 2 });
    assert.equal(refusedWith(cast(definition, state, "Hold", ["a", "b"])), "bad-target", "two at its own level");
    assert.equal(refusedWith(cast(definition, state, "Hold", ["a"])), undefined);
    assert.equal(refusedWith(cast(definition, fight(definition), "Hold", ["a", "b"], "pact_slots")), undefined);
    assert.equal(
      refusedWith(cast(definition, fight(definition), "Hold", ["a", "b", "c"], "pact_slots")),
      "bad-target",
      "three at 3rd",
    );
    const four = fight(definition, {}, { slots_max_3: 1, slots_max_4: 1, pact_slot_level: 4 });
    assert.deepEqual(optionOf(definition, four, "Hold")!.targetsWith, { slots_3: 2, slots_4: 3, pact_slots: 3 });
    assert.equal(refusedWith(cast(definition, four, "Hold", ["a", "b", "c"], "slots_4")), undefined);
    assert.equal(refusedWith(cast(definition, four, "Hold", ["a", "b", "c", "d"], "slots_4")), "bad-target");
  }

  // The sheet's use command pays the same way, and refuses a pact slot below the cost.
  {
    const live = { pools: {} };
    const use = (rules: RulesetDefinition, name: string, pool: string, fields: Record<string, number> = {}) =>
      planRulesetUse(rules, build(fields), live, { spells }, { op: "use", name, pool });
    assert.ok(use(definition, "Missile", "pact_slots").ok);
    assert.ok(!use(plain, "Missile", "pact_slots").ok, "not without pays");
    assert.ok(!use(definition, "Hold", "pact_slots", { pact_slot_level: 1 }).ok, "not below the cost's level");
  }

  // Import refusals.
  refused(
    fiveE((doc) => {
      doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "pact_slots").pays = ["runes"];
    }),
    /Unknown pool group "runes"/,
  );
  refused(
    fiveE((doc) => {
      doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "pact_slots").pays = ["pact"];
    }),
    /already pays for its own group/,
  );

  // The gate.
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
      "A ruleset whose pools pay for another group or whose targets grow with the cost requires schemaVersion 2 and capabilityApi 1.171 or newer";
    const withHold = fiveE((doc) => {
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells")?.entries?.push(spells[1]);
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(170) as never, fiveE(pactPays)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(171) as never, fiveE(pactPays)), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(170) as never, fiveE()),
      gate,
      "nothing without the keys",
    );
    const catalogs = new Map([["spells.json", { entries: [spells[1]] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(170) as never, withHold, catalogs as never), gate);
  }

  console.log(
    "Cast ladder: a pact slot pays a 1st-level spell two steps up, an empty slot climbs, Hold takes a target a step, gated at 1.171.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
