/**
 * A use that works only on a roll (Capability API 1.441).
 *
 *   - Divine Intervention: a d100 at or under the cleric's level works and spends its own row; one
 *     over it does nothing and spends the long-rest row on the same entry instead (1.443), leaving its
 *     own; from 20th level it
 *     works without a roll. Once the long-rest row is spent it is not offered.
 *   - A creature's printed chance: a demon's 30 percent.
 *   - Refusals and the install gate.
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
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-use-chance-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 443);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const intervention = (chance: Record<string, unknown>) => ({
    id: "divine-intervention",
    label: "Divine Intervention",
    rows: [
      { list: "features", values: { name: "Divine Intervention" } },
      { list: "counters", values: { name: "Divine Intervention", max: 1, recharge: "none" } },
      // On the same entry (1.443): a use spends only the row it names, its own by `usesOf`.
      { list: "counters", values: { name: "Divine Plea", max: 1, recharge: "long" } },
    ],
    mechanics: {
      kind: "buff",
      usesOf: "Divine Intervention",
      targets: "ally",
      range: 30,
      chance,
      applies: [{ condition: "blessed", duration: { rounds: 10 } }],
    },
  });
  const plea = {
    sides: 100,
    atMost: { field: "level" },
    sure: { value: { field: "level" }, atLeast: 20 },
    failUses: "Divine Plea",
  };
  const fiveE = (chance: Record<string, unknown> = plea): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "blessed", label: "Blessed" });
    doc.combat.conditions.push({ condition: "blessed", effects: [] });
    doc.catalogs.push({
      id: "cleric",
      label: "Cleric",
      feeds: ["features", "counters"],
      entries: [intervention(chance)],
    });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "cleric")!.entries! as RulesetCatalogEntry[];
  const rows = (list: string) =>
    entries.flatMap((entry) =>
      rowsFromCatalogEntry("cleric", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const demon = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        {
          id: "howl",
          name: "Howl",
          budget: "action",
          toHit: 20,
          reach: 5,
          damage: { count: 0, sides: 0, flat: 7 },
          chance: { sides: 100, atMost: 30 },
        },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")),
  });
  const fight = (level: number, roll: number): { state: RulesetEncounterState; roller: () => number } => {
    const roller = (sides: number) => (sides === 100 ? roll : 15);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 18, cha: 10 },
            fields: { level, ac: 16, speed: 30, hp_max: 80 },
            lists: { features: rows("features"), counters: rows("counters") },
          }),
          live: {},
          catalogs: { cleric: entries },
        },
        { id: "ally", name: "Ally", side: "party", block: demon() },
        { id: "demon", name: "Demon", side: "enemy", block: demon() },
      ],
      board: {
        grid: grid(),
        placements: { cleric: { x: 1, y: 1 }, ally: { x: 2, y: 1 }, demon: { x: 3, y: 1 } },
      },
    });
    state.order = ["cleric", "ally", "demon"];
    state.turn = 0;
    return { state, roller: () => roll };
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const left = (state: RulesetEncounterState, label: string) => {
    const sheet = who(state, "cleric").sheet!;
    return readRulesetLive(definition, sheet.build, sheet.live).pools.find((pool) => pool.label === label)?.value;
  };
  const pray = (level: number, roll: number) => {
    const { state } = fight(level, roll);
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Divine Intervention");
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "cleric")
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds: ["ally"] },
      (sides) => (sides === 100 ? roll : 15),
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const blessed = (state: RulesetEncounterState) =>
    who(state, "ally").tracked.some((one) => one.condition === "blessed");

  // ── Divine Intervention ──
  {
    // 12 on the d100 at 12th level: it works, and spends its own row.
    const answered = pray(12, 12);
    assert.deepEqual(
      of(answered.events, "chance").map((one) => [one.roll, one.needed, one.outcome]),
      [[12, 12, "answered"]],
    );
    assert.ok(blessed(answered.state), "the deity intervenes");
    assert.equal(left(answered.state, "Divine Intervention"), 0);
    assert.equal(left(answered.state, "Divine Plea"), 1);
    // 13: nothing, and the long-rest row is spent instead of its own.
    const failed = pray(12, 13);
    assert.deepEqual(of(failed.events, "chance")[0]?.outcome, "failed");
    assert.ok(!blessed(failed.state), "nothing happens");
    assert.equal(left(failed.state, "Divine Intervention"), 1, "its own row is given back");
    assert.equal(left(failed.state, "Divine Plea"), 0);
    // With the long-rest row spent, it is not offered until a long rest.
    const again = failed.state;
    again.turn = 0;
    who(again, "cleric").budgets.action = 1;
    assert.ok(
      !rulesetCombatOptions(definition, again, "cleric").some((one) => one.label === "Divine Intervention"),
      "not offered again before a long rest",
    );
    // At 20th level it works on any roll.
    const sure = pray(20, 99);
    assert.deepEqual(of(sure.events, "chance")[0]?.outcome, "sure");
    assert.ok(blessed(sure.state));
  }

  // ── A demon's 30 percent ──
  {
    const howl = (roll: number) => {
      const { state } = fight(5, roll);
      state.turn = 2;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        {
          actorId: "demon",
          optionId: who(state, "demon").actions.find((one) => one.label === "Howl")!.id,
          targetIds: ["ally"],
        },
        (sides) => (sides === 100 ? roll : 15),
      );
      assert.deepEqual(of(step.events, "refused"), []);
      return step;
    };
    const hits = howl(30);
    assert.equal(of(hits.events, "chance")[0]?.outcome, "answered");
    assert.ok(of(hits.events, "damage").length > 0, "30 or under: it works");
    const misses = howl(31);
    assert.equal(of(misses.events, "chance")[0]?.outcome, "failed");
    assert.equal(of(misses.events, "damage").length, 0, "31: nothing");
  }

  // ── Refusals ──
  refused(fiveE({ ...plea, atMost: { field: "no_such_field" } }), /no_such_field/);
  refused(fiveE({ sides: 20, atMost: 25 }), /always works/);
  refused(fiveE({ sides: 1, atMost: 1 }), /sides/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose uses work only on a roll (chance) requires schemaVersion 2 and capabilityApi 1.441 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(440) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(441) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(440) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Use chance: Divine Intervention works at or under the cleric's level, spends the long-rest row instead when it fails, and is sure at 20th; a demon's 30 percent; gated at 1.441.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
