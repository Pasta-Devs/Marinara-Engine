/**
 * A sense that sees things as they truly are (Capability API 1.649): 5e's Witch Sight.
 *
 *   - An image (`calls.illusion`) is never offered to whoever sees it truly, in range; out of range it
 *     is.
 *   - Illusory duplicates (Mirror Image) draw none of their attacks.
 *   - The install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSeesTrue,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sees-true-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 649);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const double = {
    id: "illusory-double",
    label: "Illusory Double",
    creature: {
      health: 1,
      defense: 10,
      initiativeModifier: 0,
      speed: 60,
      tier: "cr_0",
      actions: [{ id: "feint", name: "Feint", budget: "action", toHit: 0, damage: { flat: 0 } }],
    },
  };
  const document = (illusion = true) => {
    const doc = JSON.parse(fiveEText);
    doc.combat.senses = [{ id: "witch_sight", label: "Witch Sight", seesTrue: true }];
    doc.sheet.live.conditions.push({ id: "mirrored", label: "Mirror Image" });
    doc.combat.conditions.push({
      condition: "mirrored",
      effects: [],
      duplicates: { count: 3, thresholds: [11, 8, 6], defense: { flat: 10 } },
    });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(double));
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "mislead",
          label: "Mislead",
          rows: [{ list: "spells", values: { name: "Mislead", level: 5, prepared: true } }],
          mechanics: {
            kind: "utility",
            targets: "self",
            budget: "action",
            calls: {
              creature: "creatures/illusory-double",
              count: { flat: 1 },
              initiative: "after",
              commandedWith: "bonus",
              ...(illusion ? { illusion: true } : {}),
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const roll = () => 15;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const brute = (id: string, witchSight?: number) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 100,
      defense: 10,
      initiativeModifier: -5,
      speed: 30,
      ...(witchSight ? { senses: { witch_sight: witchSight } } : {}),
      actions: [{ name: "Club", budget: "action", toHit: 5, damage: { count: 1, sides: 6, flat: 3 } }],
    } as never,
  });
  const board = (gap: number) => ({
    grid: { width: 20, height: 1, tiles: [Array.from({ length: 20 }, () => "plains")] },
    placements: { wizard: { x: 0, y: 0 }, seer: { x: gap, y: 0 } },
  });
  const fight = (gap?: number): RulesetEncounterState => {
    let state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      ...(gap !== undefined ? { board: board(gap) } : {}),
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 18, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 40 },
            lists: {
              spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        brute("seer", 30),
        ...(gap === undefined ? [brute("brute")] : []),
      ],
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Mislead")!;
    state = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: [] },
      roll,
    ).state;
    return state;
  };
  const aimable = (state: RulesetEncounterState, who: string) => {
    state.turn = state.order.indexOf(who);
    rulesetCombatant(state, who)!.budgets.action = 1;
    const club = rulesetCombatOptions(definition, state, who).find((one) => one.label === "Club")!;
    return rulesetOptionTargets(definition, state, who, club);
  };
  const doubleOf = (state: RulesetEncounterState) => state.combatants.find((one) => one.calledBy === "wizard")!.id;

  // ── An image, seen truly ──
  {
    const state = fight();
    const double = doubleOf(state);
    assert.ok(aimable(state, "brute").includes(double), "fooled without it");
    assert.ok(!aimable(state, "seer").includes(double), "never offered to Witch Sight");
    assert.ok(aimable(state, "seer").includes("wizard"));
  }

  // ── Within its range only ──
  {
    const state = fight(1);
    const seer = rulesetCombatant(state, "seer")!;
    const double = rulesetCombatant(state, doubleOf(state))!;
    double.x = 5;
    double.y = 0;
    assert.equal(rulesetSeesTrue(definition, state, seer, double), true, "20 feet away: seen truly");
    double.x = 19;
    assert.equal(rulesetSeesTrue(definition, state, seer, double), false, "90 feet away: not");
  }

  // ── Mirror Image draws nothing from it ──
  {
    const swing = (who: string) => {
      const state = fight();
      rulesetCombatant(state, "wizard")!.tracked.push({ condition: "mirrored", rounds: 10 } as never);
      state.turn = state.order.indexOf(who);
      rulesetCombatant(state, who)!.budgets.action = 1;
      const club = rulesetCombatOptions(definition, state, who).find((one) => one.label === "Club")!;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: who, optionId: club.id, targetIds: ["wizard"] },
        roll,
      );
      assert.deepEqual(of(step.events, "refused"), []);
      return of(step.events, "duplicate").length;
    };
    assert.ok(swing("brute") > 0, "the brute rolls against the duplicates");
    assert.equal(swing("seer"), 0, "Witch Sight is not fooled");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a sense that sees things as they truly are (combat.senses[].seesTrue) requires schemaVersion 2 and capabilityApi 1.649 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(648) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(649) as never, document()), gate);
  }

  console.log("Witch Sight: no image or duplicate fools a sense that sees truly; gated at 1.649.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
