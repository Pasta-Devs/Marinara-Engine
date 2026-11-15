/**
 * A creature's blow that lowers the health maximum (Capability API 1.203).
 *
 *   - `reducesMax`: on a failed save the damage taken comes off the maximum too (5e's Life Drain),
 *     no heal gives it back, a rest does; with `lasting` (a clay golem's Slam) only an unsealing
 *     does. Lowered to 0 that way, the target dies. A made save lowers nothing.
 *   - The same on a creature without a sheet.
 *   - Import refusals and the install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reduces-max-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 198);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  // 1d6 + 4 on a 3: 7 necrotic.
  const drain = { count: 1, sides: 6, flat: 4, type: "necrotic" };
  const wraith: RulesetStatBlock = {
    health: 60,
    defense: 13,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "drain",
        name: "Life Drain",
        budget: "action",
        toHit: 30,
        damage: drain,
        // Any, so it can be tried on a fellow creature without a sheet.
        targets: "any",
        reducesMax: { save: "con_save", difficulty: 14 },
      },
      {
        id: "slam",
        name: "Slam",
        budget: "action",
        toHit: 30,
        damage: drain,
        reducesMax: { save: "con_save", difficulty: 15, lasting: true },
      },
      { id: "claw", name: "Claw", budget: "action", toHit: 30, damage: drain },
    ],
  } as unknown as RulesetStatBlock;
  let d20 = 2;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
  });
  const fight = (live: unknown = {}, target: "brenna" | "ally" = "brenna"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "brenna", name: "Brenna", side: "party", build, live, catalogs: {} } as RulesetCombatantInput,
        {
          id: "ally",
          name: "Ally",
          side: "enemy",
          block: { health: 20, defense: 5, initiativeModifier: 0, speed: 30, actions: [] },
        },
        { id: "w", name: "Wraith", side: "enemy", block: wraith },
      ],
    });
    state.order = ["w", target === "brenna" ? "ally" : "brenna", target];
    state.turn = 0;
    return state;
  };
  const strike = (state: RulesetEncounterState, label: string, target = "brenna") => {
    rulesetCombatant(state, "w")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "w").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "w", optionId: option.id, targetIds: [target] },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const pool = (live: unknown) => readRulesetLive(definition, build, live).pools.find((one) => one.key === "hp")!;
  const liveOf = (state: RulesetEncounterState) => rulesetCombatant(state, "brenna")!.sheet!.live;
  const apply = (live: unknown, op: Parameters<typeof applyRulesetSheetOp>[3]) => {
    const result = applyRulesetSheetOp(definition, build, live, op);
    assert.ok(result.ok, JSON.stringify(result));
    return result.live;
  };

  // ── Life Drain: a failed save takes the damage off the maximum until a rest ──
  {
    d20 = 2;
    const step = strike(fight(), "Life Drain");
    assert.ok(step.events.some((one) => one.type === "save" && one.save === "con_save" && !one.success));
    const live = liveOf(step.state);
    assert.deepEqual([pool(live).value, pool(live).sealed, pool(live).lasting], [13, 7, 0]);
    // No heal lifts it past 13.
    assert.equal(pool(apply(live, { op: "restore", pool: "hp", amount: 10 })).value, 13);
    // A long rest gives it all back.
    const rested = apply(live, { op: "rest", rest: "long" });
    assert.deepEqual([pool(rested).value, pool(rested).sealed], [20, 0]);
    // A made save lowers nothing (the same 20 is a critical: 10).
    d20 = 20;
    const made = liveOf(strike(fight(), "Life Drain").state);
    assert.deepEqual([pool(made).value, pool(made).sealed], [10, 0]);
    // A plain blow lowers nothing and rolls no save.
    d20 = 2;
    const clawed = strike(fight(), "Claw");
    assert.equal(pool(liveOf(clawed.state)).sealed, 0);
    assert.ok(!clawed.events.some((one) => one.type === "save"));
  }

  // ── A clay golem's Slam: no rest gives it back, only an unsealing ──
  {
    d20 = 2;
    const live = liveOf(strike(fight(), "Slam").state);
    assert.deepEqual([pool(live).sealed, pool(live).lasting], [7, 7]);
    const rested = apply(live, { op: "rest", rest: "long" });
    assert.deepEqual([pool(rested).value, pool(rested).sealed, pool(rested).lasting], [13, 7, 7]);
    const restored = apply(rested, { op: "restore", pool: "hp", amount: 0, unseals: true });
    assert.deepEqual([pool(restored).sealed, pool(restored).lasting], [0, 0]);
    // Drained by both, a rest leaves only the golem's.
    const both = liveOf(strike(strike(fight(), "Slam").state, "Life Drain").state);
    assert.deepEqual([pool(both).sealed, pool(both).lasting], [14, 7]);
    const after = apply(both, { op: "rest", rest: "long" });
    assert.deepEqual([pool(after).sealed, pool(after).lasting], [7, 7]);
  }

  // ── Lowered to 0, the target dies ──
  {
    d20 = 2;
    const step = strike(fight({ pools: { hp: { value: 7, sealed: 13 } } }), "Life Drain");
    const brenna = rulesetCombatant(step.state, "brenna")!;
    assert.ok(brenna.defeated, "dead, not dying");
    assert.ok(step.events.some((one) => one.type === "slain" && one.targetId === "brenna"));
    // Short of 0, only down.
    const down = rulesetCombatant(
      strike(fight({ pools: { hp: { value: 7, sealed: 6 } } }), "Life Drain").state,
      "brenna",
    )!;
    assert.ok(down.down && !down.defeated);
  }

  // ── A creature without a sheet ──
  {
    d20 = 2;
    const ally = rulesetCombatant(strike(fight({}, "ally"), "Life Drain", "ally").state, "ally")!;
    assert.deepEqual([ally.health!.value, ally.health!.sealed], [13, 7]);
  }

  // ── A catalog creature carries it onto its block ──
  {
    const doc = fiveE((one) => {
      const creature = one.catalogs
        .find((catalog: { id: string }) => catalog.id === "creatures")
        .entries.find((entry: { creature?: unknown }) => entry.creature).creature;
      creature.actions[0].reducesMax = { save: "con_save", difficulty: 14, lasting: true };
    });
    const read = parsed(doc);
    const creature = read
      .catalogs!.find((catalog) => catalog.id === "creatures")!
      .entries.find((entry) => entry.creature)!.creature!;
    const block = rulesetStatBlockFromCreature(read, creature)!;
    assert.deepEqual(block.actions[0]!.reducesMax, { save: "con_save", difficulty: 14, lasting: true });
  }

  // ── Import refusals ──
  {
    const refused = (change: (action: Record<string, any>) => void, pattern: RegExp, edit?: (doc: any) => void) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          const creature = doc.catalogs
            .find((one: { id: string }) => one.id === "creatures")
            .entries.find((one: { creature?: unknown }) => one.creature).creature;
          const action = creature.actions[0];
          action.reducesMax = { save: "con_save", difficulty: 14 };
          change(action);
          edit?.(doc);
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    refused((action) => (action.reducesMax.save = "luck_save"), /Unknown save "luck_save"/);
    refused((action) => delete action.damage, /A maximum is lowered by the damage taken, so it has damage/);
    refused((action) => (action.reducesMax.lasting = false), /lasting/);
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
      "A ruleset with creature actions that lower the health maximum on a failed save requires schemaVersion 2 and capabilityApi 1.203 or newer";
    const without = JSON.parse(fiveEText);
    const withDrain = { ...without, extra: { creature: { actions: wraith.actions } } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(202) as never, withDrain), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(203) as never, withDrain), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(202) as never, without), gate);
    const files = new Map([["creatures.json", { entries: [{ creature: { actions: wraith.actions } }] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(202) as never, without, files as never), gate);
  }

  console.log(
    "Ruleset reduces max: Life Drain lowers the maximum on a failed save until a rest, a golem's Slam until an unsealing, and kills at 0; gated at 1.203.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
