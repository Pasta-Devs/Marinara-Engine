/**
 * Picking which of the conditions an action ends (Capability API 1.442).
 *
 *   - Greater Restoration (`ends.chosen`, one of): the menu offers what the target holds of its list,
 *     and the one picked ends rather than the first named; nothing picked, the first named.
 *   - A pick it does not offer is refused.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ends-picked-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 442);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const restoration = (ends: Record<string, unknown>) => ({
    id: "greater-restoration",
    label: "Greater Restoration",
    rows: [{ list: "features", values: { name: "Greater Restoration" } }],
    mechanics: { kind: "utility", targets: "ally", range: 5, ends },
  });
  const oneOf = { conditions: ["charmed", "petrified", "cursed"], count: 1, chosen: true };
  const fiveE = (ends: Record<string, unknown> = oneOf): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "cursed", label: "Cursed" });
    doc.combat.conditions.push({ condition: "cursed", effects: [] });
    doc.catalogs.push({ id: "cleric", label: "Cleric", feeds: ["features"], entries: [restoration(ends)] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "cleric")!.entries! as RulesetCatalogEntry[];
  const block = (): RulesetStatBlock =>
    ({ health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")),
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 18, cha: 10 },
            fields: { level: 9, ac: 16, speed: 30, hp_max: 60 },
            lists: {
              features: entries.flatMap((entry) => rowsFromCatalogEntry("cleric", entry).map((one) => one.row)),
            },
          }),
          live: {},
          catalogs: { cleric: entries },
        },
        { id: "ally", name: "Ally", side: "party", block: block() },
      ],
      board: { grid: grid(), placements: { cleric: { x: 1, y: 1 }, ally: { x: 2, y: 1 } } },
    });
    state.order = ["cleric", "ally"];
    state.turn = 0;
    for (const condition of ["charmed", "cursed"]) {
      rulesetCombatant(state, "ally")!.tracked.push({ condition, rounds: null } as never);
    }
    return state;
  };
  const holds = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "ally")!
      .tracked.map((one) => one.condition)
      .sort();
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const restore = (choice: Partial<RulesetCombatChoice> = {}) => {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Greater Restoration");
    assert.ok(option, "offered");
    return {
      option,
      step: applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "cleric", optionId: option.id, targetIds: ["ally"], ...choice },
        () => 10,
      ),
    };
  };

  // ── Greater Restoration ──
  {
    const { option, step } = restore({ ends: ["cursed"] });
    assert.deepEqual(
      option.endsChoices?.ally?.map((one) => one.condition),
      ["charmed", "cursed"],
      "what the ally holds of its list",
    );
    assert.deepEqual(of(step.events, "refused"), []);
    assert.deepEqual(holds(step.state), ["charmed"], "the curse picked ends; the charm stays");
    const unpicked = restore().step;
    assert.deepEqual(holds(unpicked.state), ["cursed"], "nothing picked: the first named");
    const wrong = restore({ ends: ["petrified"] }).step;
    assert.ok(of(wrong.events, "refused").length > 0, "not held, not offered");
    const two = restore({ ends: ["charmed", "cursed"] }).step;
    assert.ok(of(two.events, "refused").length > 0, "one of, not two");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries let their user pick which conditions end (ends chosen) requires schemaVersion 2 and capabilityApi 1.442 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(441) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(442) as never, fiveE()), gate);
    const plain = fiveE({ conditions: ["charmed"], count: 1 });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(441) as never, plain), gate);
  }

  console.log(
    "Ends picked: Greater Restoration ends the effect picked of those the target holds, the first named when none is, and refuses a pick it did not offer; gated at 1.442.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
